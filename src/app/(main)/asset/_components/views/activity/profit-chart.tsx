"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { TrendingUp, TrendingDown, Minus, Info, Globe, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { InlineSelector } from "../../layout/ui/inline-selector";
import { Switch } from "@/components/ui/switch";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useAssetData } from "@/contexts/asset-data-context";
import { formatShortCurrency } from "@/lib/number-utils";
import { normalizeTicker } from "@/lib/finance-service";
import { ASSET_THEME, MAIN_PALETTE, getProfitLossColor } from "@/config/theme";
import { fetchProfitRef, getDailyClosingRefDate, getRatesForDate, computeDailyStockProfit, type ProfitPeriod } from "@/lib/profit-utils";
import { isKrHoliday } from "@/lib/kr-holidays";
import { isUsHoliday } from "@/lib/us-holidays";
import { useProfitBasisStore } from "@/stores/profit-basis-store";
import type { ProfitRefResponse } from "@/app/api/finance/profit/route";
import { groupStocksByTickerCategory, mergeStockGroup } from "../detail/asset-detail-tabs";
import { DataSourceBadge } from "../data-source-badge";

const PROFIT_SYNC_COMPLETE_MSG = "보유 주식의 기간별 수익 동기화 완료";

// 세션 단위 toast 중복 방지: 같은 (period, tickerList) 조합으로 한 번 알린 뒤엔 재진입해도 안 띄움
// 페이지 새로고침 시 모듈 재로드 → Set 초기화 → 새 세션으로 간주
const notifiedKeysThisSession = new Set<string>();

const DOMESTIC_CATEGORIES = new Set(["domestic", "irp", "isa", "pension"]);

const CATEGORY_GROUPS = [
  { key: "domestic", label: "국내주식", color: MAIN_PALETTE[3] },
  { key: "foreign", label: "해외주식", color: MAIN_PALETTE[5] },
  { key: "irp", label: "IRP", color: MAIN_PALETTE[6] },
  { key: "isa", label: "ISA", color: MAIN_PALETTE[4] },
  { key: "pension", label: "연금저축", color: MAIN_PALETTE[7] },
] as const;

const PERIOD_LABELS: Record<ProfitPeriod, string> = {
  daily: "일별",
  weekly: "주간",
  monthly: "월간",
  yearly: "연간",
};

const PERIOD_OPTIONS = (Object.keys(PERIOD_LABELS) as ProfitPeriod[]).map((p) => ({
  value: p,
  label: PERIOD_LABELS[p],
}));

type MarketView = "all" | "kr" | "us";

const MARKET_LABELS: Record<MarketView, string> = {
  all: "전체",
  kr: "국내",
  us: "해외",
};

const MARKET_OPTIONS = (Object.keys(MARKET_LABELS) as MarketView[]).map((m) => ({
  value: m,
  label: MARKET_LABELS[m],
}));

function formatRate(rate: number): string {
  const sign = rate >= 0 ? "+" : "";
  return `${sign}${rate.toFixed(2)}%`;
}

// 종목별 응답일이 다를 수 있어 시장 단위 표시는 최빈 응답일 사용
function pickMajorityDate(dates: (string | undefined)[]): string | undefined {
  const counts = new Map<string, number>();
  for (const d of dates) if (d) counts.set(d, (counts.get(d) ?? 0) + 1);
  let best: string | undefined;
  let max = 0;
  for (const [d, c] of counts) if (c > max) { best = d; max = c; }
  return best;
}

const CLOSE_TABLE_COLS = "grid grid-cols-[2.25rem_1fr_1fr] gap-x-2";

// 시장 행: 라벨 + 시작/종료 날짜(연도 포함). 마감 시각은 표 하단 공통 안내로 일원화.
// 해외 일별만 적용 환율(startSub/endSub)을 날짜 아래 1줄로 표시.
function MarketDateRow({
  label, startDate, endDate, startSub, endSub, startNote,
}: { label: string; startDate?: string; endDate?: string; startSub?: string; endSub?: string; startNote?: string }) {
  const cell = (date?: string, align?: string, sub?: string, note?: string) =>
    date ? (
      <div className={`tabular-nums leading-tight ${align ?? ""}`}>
        <p className="text-[13px] sm:text-sm">{date}</p>
        {note && (
          <p className="text-[10px] leading-none mt-0.5 text-amber-600/80 dark:text-amber-500/80" title="휴장일이 있어 직전 영업일 종가로 비교됩니다">
            {note}
          </p>
        )}
        {sub && <p className="text-xs text-muted-foreground/70 mt-1">{sub}</p>}
      </div>
    ) : <span className="text-muted-foreground/40">-</span>;
  return (
    <div className={`${CLOSE_TABLE_COLS} items-start py-1.5 border-b border-border/30`}>
      <span className="text-muted-foreground">{label}</span>
      {cell(startDate, undefined, startSub, startNote)}
      {cell(endDate, "text-right", endSub)}
    </div>
  );
}

// 시작~종료 날짜 사이에 해당 시장 휴장일(평일)이 끼어있는지 — 일별에서 직전 영업일이 휴장이라 폴백된 경우 감지
function hasHolidayBetween(start: string | undefined, end: string | undefined, isHoliday: (d: string) => boolean): boolean {
  if (!start || !end) return false;
  const d = new Date(`${start}T00:00:00.000Z`);
  const e = new Date(`${end}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  while (d < e) {
    const day = d.getUTCDay();
    if (day !== 0 && day !== 6 && isHoliday(toDateStr(d))) return true;
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return false;
}

// 환차손익 분해 팝오버 — 데스크톱은 마우스 hover, 모바일은 터치(탭)로 열림(바깥 탭/Esc로 닫힘)
// fxApplied=false(주/월/연간)면 현재환율 단일 적용이라 환차손익 0 → 수익이 모두 주가손익임을 안내
function FxBreakdown({ priceGain, fxGain, fxApplied }: { priceGain: number; fxGain: number; fxApplied: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="환차손익 보기"
          onPointerEnter={(e) => { if (e.pointerType === "mouse") setOpen(true); }}
          onPointerLeave={(e) => { if (e.pointerType === "mouse") setOpen(false); }}
          className="text-sky-600/70 dark:text-sky-400/70 hover:text-sky-700 dark:hover:text-sky-300 transition-colors"
        >
          <Globe className="size-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent side="left" sideOffset={4} className="w-auto p-2.5 text-xs tabular-nums">
        <div className="space-y-0.5 text-left">
          <p>주가손익: <span className={getProfitLossColor(priceGain)}>{priceGain >= 0 ? "+" : ""}{formatShortCurrency(priceGain)}</span></p>
          <p>환차손익: <span className={getProfitLossColor(fxGain)}>{fxGain >= 0 ? "+" : ""}{formatShortCurrency(fxGain)}</span></p>
          {!fxApplied && <p className="text-muted-foreground/70 text-[10px]">현재환율 적용 · 기간 환차 미반영</p>}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// 옵션 옆 info 아이콘 — 데스크톱 hover, 모바일 터치(탭)로 설명 팝오버 표시
function InfoHint({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="설명 보기"
          onPointerEnter={(e) => { if (e.pointerType === "mouse") setOpen(true); }}
          onPointerLeave={(e) => { if (e.pointerType === "mouse") setOpen(false); }}
          className="text-sky-600/70 dark:text-sky-400/70 hover:text-sky-700 dark:hover:text-sky-300 transition-colors"
        >
          <Info className="size-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent side="bottom" sideOffset={4} className="w-72 p-2.5 text-[11px] leading-relaxed text-left space-y-0.5">
        {children}
      </PopoverContent>
    </Popover>
  );
}

function toDateStr(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

function subtractWeekdays(from: Date, n: number): Date {
  const d = new Date(from);
  let count = 0;
  while (count < n) {
    d.setUTCDate(d.getUTCDate() - 1);
    const day = d.getUTCDay();
    if (day !== 0 && day !== 6) count++;
  }
  return d;
}

function subtractCalendarMonths(from: Date, months: number): Date {
  const d = new Date(from);
  d.setUTCMonth(d.getUTCMonth() - months);
  while (d.getUTCDay() === 0 || d.getUTCDay() === 6) d.setUTCDate(d.getUTCDate() - 1);
  return d;
}

function subtractCalendarYears(from: Date, years: number): Date {
  const d = new Date(from);
  d.setUTCFullYear(d.getUTCFullYear() - years);
  while (d.getUTCDay() === 0 || d.getUTCDay() === 6) d.setUTCDate(d.getUTCDate() - 1);
  return d;
}

function getExpectedRefDate(period: ProfitPeriod, market: "domestic" | "foreign" = "domestic"): string {
  const now = new Date(Date.now() + 9 * 60 * 60 * 1000);
  if (period === "daily") return getDailyClosingRefDate(market);
  if (period === "weekly") return toDateStr(subtractWeekdays(now, 5));
  if (period === "monthly") return toDateStr(subtractCalendarMonths(now, 1));
  return toDateStr(subtractCalendarYears(now, 1));
}

export function ProfitCard({ isActive = true }: { isActive?: boolean }) {
  const { assetData, exchangeRates, dataResetVersion } = useAssetData();
  const usdRate = exchangeRates.USD;
  const jpyRate = exchangeRates.JPY;
  const [period, setPeriod] = useState<ProfitPeriod>("daily");
  const [marketView, setMarketView] = useState<MarketView>("all");
  // 기준 종가 비교 표 접힘 상태 (기본 접힘 — 종목별 손익에 시선 집중)
  const [closeTableOpen, setCloseTableOpen] = useState(false);
  const profitBasis = useProfitBasisStore((s) => s.basis);
  const profitBasisHydrated = useProfitBasisStore((s) => s.hydrated);
  const setProfitBasis = useProfitBasisStore((s) => s.setBasis);
  const hydrateProfitBasis = useProfitBasisStore((s) => s.hydrate);
  useEffect(() => { hydrateProfitBasis(); }, [hydrateProfitBasis]);

  // 컷오프 경계 자동 재조회: 토큰은 render 시점에만 재계산되므로 저빈도 tick으로 재렌더 유도
  // (deps에 넣지 않음 → 매 분 재렌더되지만 토큰이 실제로 바뀌는 컷오프 시점에만 fetch effect 재실행)
  const [, setRefreshTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setRefreshTick((t) => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  // 기준일 토큰: 컷오프 경과 시 값이 바뀌어 effect 재실행을 유발
  // daily는 국내(16:00)·해외(06:00/07:00) 컷오프가 독립적이므로 두 시장 기준일을 모두 반영
  // → kstAccessDay에서 해외 컷오프만 지나도 재조회됨 (캐시 키와 동일 기준)
  const refMarket = profitBasis === "sameBusinessDay" ? "foreign" : "domestic";
  const dailyRefToken = `${getDailyClosingRefDate("domestic")}_${getDailyClosingRefDate("foreign")}`;
  const periodRefToken = period === "daily" ? dailyRefToken : getExpectedRefDate(period, refMarket);

  // tickerList: currentPrice 무관, ticker가 있고 unlisted/상장폐지 아닌 종목 전체
  // → 첫 mount부터 풀세트로 고정 → 캐시 키 안정 (syncTodayStockPrices가 백그라운드로 currentPrice를 채워도 영향 없음)
  // 거래정지는 ref 종가 조회를 시도해 "기준가 없음"으로 표시되도록 포함
  const tickerList = Array.from(
    new Set(
      assetData.stocks
        .filter((s) => s.ticker && s.category !== "unlisted" && s.inactiveStatus !== "delisted")
        .map((s) => normalizeTicker(s))
        .filter(Boolean),
    ),
  ).sort().join(",");

  // 화면 표시/계산용: 현재가가 채워진 종목만 (기존 동작 유지) + 상장폐지 제외
  const stocksWithPrice = assetData.stocks.filter(
    (s) => s.ticker && s.category !== "unlisted" && s.currentPrice && s.currentPrice > 0 && s.inactiveStatus !== "delisted"
  );

  const groupedMap = groupStocksByTickerCategory(stocksWithPrice);
  const mergedStocks = Array.from(groupedMap.values()).map(mergeStockGroup);

  // 점진 노출: 배치 응답이 올 때마다 누적된 결과를 state에 반영
  // 각 종목은 데이터가 채워지는 순서대로 화면에 표시됨
  const [refData, setRefData] = useState<ProfitRefResponse | undefined>(undefined);
  const [dailyData, setDailyData] = useState<ProfitRefResponse | undefined>(undefined);
  // 진행 중인 fetch 키 추적: cleanup 후 즉시 동일 키로 재실행되는 경우 abort 방지
  const refInFlightKeyRef = useRef<string | null>(null);
  const dailyInFlightKeyRef = useRef<string | null>(null);
  // 데이터 삭제/불러오기 시 직접 abort 가능하도록 진행 중인 controller 보관
  const refAbortRef = useRef<AbortController | null>(null);
  const dailyAbortRef = useRef<AbortController | null>(null);
  // 완료 알림: ref/daily 둘 다 네트워크로 완료됐을 때 한 번만 toast
  // 캐시 hit(fromCache=true)이면 알림 생략 (사용자가 인지할 액션 없음)
  const refDoneRef = useRef(false);
  const dailyDoneRef = useRef(false);
  const notifiedKeyRef = useRef<string | null>(null);

  const maybeNotifyComplete = (key: string) => {
    const needsDaily = period !== "daily";
    if (!refDoneRef.current) return;
    if (needsDaily && !dailyDoneRef.current) return;
    if (notifiedKeyRef.current === key) return;
    notifiedKeyRef.current = key;
    // 세션 내 동일 (period, tickerList)로 이미 알린 적 있으면 재진입 시 생략
    if (notifiedKeysThisSession.has(key)) return;
    notifiedKeysThisSession.add(key);
    toast.info(`${PERIOD_LABELS[period]} ${PROFIT_SYNC_COMPLETE_MSG}`);
  };

  // 데이터 삭제/불러오기/캐시 초기화 시 진행 중인 ref/daily fetch 강제 abort
  // 메인 fetch useEffect보다 먼저 선언 — dataResetVersion 변화 시 abort가 새 fetch 시작보다 먼저 실행되도록
  const prevResetVersionRef = useRef(dataResetVersion);
  useEffect(() => {
    if (prevResetVersionRef.current === dataResetVersion) return;
    prevResetVersionRef.current = dataResetVersion;
    refAbortRef.current?.abort();
    dailyAbortRef.current?.abort();
    refAbortRef.current = null;
    dailyAbortRef.current = null;
    refInFlightKeyRef.current = null;
    dailyInFlightKeyRef.current = null;
    setRefData(undefined);
    setDailyData(undefined);
  }, [dataResetVersion]);

  // 현재 period 결과 점진 로드
  useEffect(() => {
    if (!isActive || !profitBasisHydrated || mergedStocks.length === 0 || !tickerList) return;
    const key = `${profitBasis}:${period}:${periodRefToken}:${tickerList}`;
    if (refInFlightKeyRef.current === key) return; // 이미 진행 중
    refInFlightKeyRef.current = key;
    // 새 조회 시작: 완료 플래그 리셋 (key가 바뀌면 다시 알림)
    refDoneRef.current = false;
    dailyDoneRef.current = false;
    notifiedKeyRef.current = null;
    const controller = new AbortController();
    refAbortRef.current = controller;
    setRefData(undefined);
    fetchProfitRef(tickerList, period, {
      signal: controller.signal,
      caller: `profit-chart:ref(${period})`,
      basis: profitBasis,
      onProgress: (partial) => setRefData(partial),
      onComplete: () => {
        refDoneRef.current = true;
        maybeNotifyComplete(key);
      },
    }).finally(() => {
      if (refInFlightKeyRef.current === key) refInFlightKeyRef.current = null;
      if (refAbortRef.current === controller) refAbortRef.current = null;
    });
    return () => {
      // 동일 키로 재실행 중이면 abort 안 함 — 의존성이 잠시 흔들려도 진행 보존
      if (refInFlightKeyRef.current !== key) controller.abort();
    };
  }, [isActive, profitBasisHydrated, mergedStocks.length, tickerList, period, profitBasis, periodRefToken, dataResetVersion]);

  // daily 기준 종가 (period가 daily가 아닐 때만 별도 조회)
  useEffect(() => {
    if (!isActive || !profitBasisHydrated || mergedStocks.length === 0 || !tickerList || period === "daily") return;
    const key = `${profitBasis}:${period}:${periodRefToken}:${tickerList}`;
    const dailyKey = `${profitBasis}:daily:${dailyRefToken}:${tickerList}`;
    if (dailyInFlightKeyRef.current === dailyKey) return;
    dailyInFlightKeyRef.current = dailyKey;
    const controller = new AbortController();
    dailyAbortRef.current = controller;
    setDailyData(undefined);
    fetchProfitRef(tickerList, "daily", {
      signal: controller.signal,
      caller: "profit-chart:daily(secondary)",
      basis: profitBasis,
      onProgress: (partial) => setDailyData(partial),
      onComplete: () => {
        dailyDoneRef.current = true;
        maybeNotifyComplete(key);
      },
    }).finally(() => {
      if (dailyInFlightKeyRef.current === dailyKey) dailyInFlightKeyRef.current = null;
      if (dailyAbortRef.current === controller) dailyAbortRef.current = null;
    });
    return () => {
      if (dailyInFlightKeyRef.current !== dailyKey) controller.abort();
    };
  }, [isActive, profitBasisHydrated, mergedStocks.length, tickerList, period, profitBasis, periodRefToken, dailyRefToken, dataResetVersion]);

  const baseRefData = period === "daily" ? refData : dailyData;
  // 첫 응답이 오기 전까지만 스켈레톤. 한 종목이라도 데이터가 채워지면 즉시 부분 노출
  const isLoading = refData === undefined || (period !== "daily" && dailyData === undefined);

  if (mergedStocks.length === 0) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-1.5">
            <CardTitle>수익 현황</CardTitle>
            <DataSourceBadge kind="closing" />
          </div>
          <CardDescription>보유 주식의 기간별 수익</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex h-48 items-center justify-center rounded-lg border border-dashed">
            <p className="text-muted-foreground text-sm">현재가가 등록된 주식이 없습니다.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // 종목별 수익 계산 (병합 기준) — 모든 period 종가 vs 종가
  // - 좌측(이전 종가): 현재 period의 ref 종가 — daily=prevPrice, 그 외=refPrice
  // - 우측(기준 종가): 항상 daily ref 종가 (baseRefData)
  // daily는 prev/ref 각 일자의 환율을 dailySnapshots에서 가져와 적용 (스냅샷 일치)
  const currentRates = { USD: usdRate, JPY: jpyRate };
  const stockProfits = mergedStocks.map((stock) => {
    const ticker = normalizeTicker(stock);
    const ref = refData?.[ticker];
    const base = baseRefData?.[ticker];
    const currentPrice = stock.currentPrice ?? 0;
    const isUS = stock.currency === "USD" && !DOMESTIC_CATEGORIES.has(stock.category);
    const isJP = stock.currency === "JPY" && !DOMESTIC_CATEGORIES.has(stock.category);
    const rateFor = (rates: { USD: number; JPY: number }) =>
      isUS ? rates.USD : isJP ? rates.JPY / 100 : 1;
    const currentRate = rateFor(currentRates);
    const fallbackCurrent = currentPrice * stock.quantity * currentRate;

    if (!ref || !base) {
      return { stock, ticker, profitAmount: 0, profitRate: null as number | null, currentValue: fallbackCurrent, refValue: 0, hasRef: false, fxGain: 0, isForeign: false };
    }

    // 좌측 (이전 종가)
    const isDailyPeriod = period === "daily";
    const prevPrice = isDailyPeriod ? ref.prevPrice : ref.refPrice;
    const prevDate = isDailyPeriod ? ref.prevDate : ref.refDate;
    if (prevPrice === undefined || prevDate === undefined) {
      return { stock, ticker, profitAmount: 0, profitRate: null as number | null, currentValue: fallbackCurrent, refValue: 0, hasRef: false, fxGain: 0, isForeign: false };
    }

    // daily는 시점별 환율 적용, 그 외는 현재 환율
    // 해외는 ET 거래일을 그대로 환율 키로 사용 (ET 마감=KST 새벽, FX 미개장 → 전일 환율)
    const prevRate = isDailyPeriod ? rateFor(getRatesForDate(prevDate, currentRates)) : currentRate;
    const refRate = isDailyPeriod ? rateFor(getRatesForDate(base.refDate, currentRates)) : currentRate;
    const refValue = prevPrice * stock.quantity * prevRate;

    // 우측 (기준 종가) = daily ref
    const currentValue = base.refPrice * stock.quantity * refRate;

    const profitAmount = currentValue - refValue;
    const profitRate = refValue > 0 ? (profitAmount / refValue) * 100 : 0;
    const baseDate = prevDate;
    const compareDate = base.refDate;

    // 환차손익(표시 증감액 중 환율분) — 일별 해외만. priceGain + fxGain = profitAmount (정확)
    const fxGain = isDailyPeriod && (isUS || isJP)
      ? prevPrice * stock.quantity * (refRate - prevRate)
      : 0;

    return { stock, ticker, profitAmount, profitRate, currentValue, refValue, hasRef: true, refDate: baseDate, compareDate, fxGain, isForeign: isUS || isJP };
  });

  const filteredProfits = stockProfits.filter((p) => {
    if (marketView === "all") return true;
    const isKr = DOMESTIC_CATEGORIES.has(p.stock.category);
    return marketView === "kr" ? isKr : !isKr;
  });

  const totalCurrentValue = filteredProfits.reduce((s, r) => s + r.currentValue, 0);
  // daily + 전체 마켓뷰일 때는 공통 헬퍼 결과를 사용 (stock-tab "전일 대비"와 일치 보장)
  const dailyCommon = (period === "daily" && marketView === "all")
    ? computeDailyStockProfit(assetData.stocks, refData, currentRates)
    : null;
  const totalProfit = dailyCommon?.dailyProfit != null
    ? dailyCommon.dailyProfit
    : filteredProfits.filter((r) => r.hasRef).reduce((s, r) => s + r.profitAmount, 0);
  const totalRefValue = totalCurrentValue - totalProfit;
  const totalRate = dailyCommon?.dailyProfitRate != null
    ? dailyCommon.dailyProfitRate
    : (totalRefValue > 0 ? (totalProfit / totalRefValue) * 100 : 0);


  // 시장별 합계 (daily 비교쌍 표시용) — marketView 필터 무시, 전체 stocks 기준
  const krProfits = stockProfits.filter((r) => r.hasRef && DOMESTIC_CATEGORIES.has(r.stock.category));
  const usProfits = stockProfits.filter((r) => r.hasRef && !DOMESTIC_CATEGORIES.has(r.stock.category));
  const krRefSum = krProfits.reduce((s, r) => s + r.refValue, 0);
  const krCurrentSum = krProfits.reduce((s, r) => s + r.currentValue, 0);
  const usRefSum = usProfits.reduce((s, r) => s + r.refValue, 0);
  const usCurrentSum = usProfits.reduce((s, r) => s + r.currentValue, 0);
  // 시장별 종목들이 서로 다른 응답일을 가질 수 있으므로 최빈값으로 표시
  const krRefDate = pickMajorityDate(krProfits.map((r) => r.refDate));
  const usRefDate = pickMajorityDate(usProfits.map((r) => r.refDate));
  const krCompareDate = pickMajorityDate(krProfits.map((r) => r.compareDate));
  const usCompareDate = pickMajorityDate(usProfits.map((r) => r.compareDate));

  // 시작 종가가 휴장으로 직전 영업일에 폴백된 경우 "휴장제외" 최소 표시
  // - 일별: 시작~종료 사이에 휴장일이 끼어있는지로 판정
  // - 주/월/연간: 요청한 명목 기준 시작일(주말 보정) 자체가 그 시장 휴장일인지로 판정
  const nonDailyTarget = period !== "daily" ? getExpectedRefDate(period) : undefined;
  const krHolidayExcluded = period === "daily"
    ? hasHolidayBetween(krRefDate, krCompareDate, isKrHoliday)
    : !!nonDailyTarget && isKrHoliday(nonDailyTarget);
  const usHolidayExcluded = period === "daily"
    ? hasHolidayBetween(usRefDate, usCompareDate, isUsHoliday)
    : !!nonDailyTarget && isUsHoliday(nonDailyTarget);

  // 해외 행에 실제 적용된 USD 환율 표시 (표시값=적용값)
  // - 일별: 시작=어제, 종료=오늘 시점별 환율 (history 없으면 현재환율 fallback)
  // - 주/월/연간: 시작·종료 모두 현재환율 단일 적용 → 같은 값 노출 (환차 미반영과 일관)
  const usdRateForUsDate = (etDate?: string): string | undefined => {
    if (!etDate) return undefined;
    const rate = period === "daily"
      ? getRatesForDate(etDate, currentRates).USD
      : currentRates.USD;
    return rate > 0 ? `$1=₩${Math.round(rate).toLocaleString()}` : undefined;
  };
  // 일별은 시작·종료 환율이 달라 둘 다 표기, 비일별은 현재환율 단일이라 종료에만 1회 표기(중복 제거)
  const usStartRateText = period === "daily" ? usdRateForUsDate(usRefDate) : undefined;
  const usEndRateText = usdRateForUsDate(usCompareDate);

  const grouped = CATEGORY_GROUPS.map(({ key, label, color }) => {
    const items = filteredProfits
      .filter((r) => r.stock.category === key)
      .sort((a, b) => b.currentValue - a.currentValue);
    const catProfit = items.filter((r) => r.hasRef).reduce((s, r) => s + r.profitAmount, 0);
    const catRef = items.filter((r) => r.hasRef).reduce((s, r) => s + r.refValue, 0);
    const catCurrent = items.filter((r) => r.hasRef).reduce((s, r) => s + r.currentValue, 0);
    const catRate = catRef > 0 ? (catProfit / catRef) * 100 : null;
    return { key, label, color, items, catProfit, catRef, catCurrent, catRate };
  }).filter(({ items }) => items.length > 0);

  const TrendIcon = totalProfit > 0 ? TrendingUp : totalProfit < 0 ? TrendingDown : Minus;

  return (
    <div className="grid grid-cols-1 gap-4 *:data-[slot=card]:shadow-xs">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-2">
            <div className="space-y-1.5 min-w-0">
              <div className="flex items-center gap-1.5">
                <CardTitle>수익 현황</CardTitle>
                <DataSourceBadge kind="closing" />
              </div>
              <CardDescription>보유 주식의 기간별 수익</CardDescription>
            </div>
            <InlineSelector
              value={period}
              onChange={setPeriod}
              options={PERIOD_OPTIONS}
              ariaLabel="기간 선택"
            />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Tabs value={period} onValueChange={(v) => setPeriod(v as ProfitPeriod)}>
            {(Object.keys(PERIOD_LABELS) as ProfitPeriod[]).map((p) => (
              <TabsContent key={p} value={p} forceMount className="data-[state=inactive]:hidden space-y-4">
                <div className="flex items-center justify-end">
                  <InlineSelector
                    value={marketView}
                    onChange={setMarketView}
                    options={MARKET_OPTIONS}
                    size="sm"
                    ariaLabel="시장 선택"
                  />
                </div>
                {isLoading ? (
                  <div className="space-y-3">
                    <div className="rounded-lg border bg-muted/20 px-4 py-3 space-y-2 animate-pulse">
                      <div className="h-4 w-24 rounded bg-muted" />
                      <div className="h-6 w-36 rounded bg-muted" />
                    </div>
                    {mergedStocks.slice(0, 5).map((stock) => (
                      <div key={stock.id} className="rounded-lg border overflow-hidden">
                        <div className="flex items-center justify-between px-4 py-2.5">
                          <div className="flex items-center gap-2">
                            <span className="inline-block w-2 h-2 rounded-full bg-muted" />
                            <div className="h-3 w-16 rounded bg-muted animate-pulse" />
                          </div>
                          <div className="h-3 w-20 rounded bg-muted animate-pulse" />
                        </div>
                        <div className="divide-y">
                          {[stock].map((s) => (
                            <div key={s.id} className="grid grid-cols-[1fr_6rem] gap-x-2 px-4 py-2.5 items-center">
                              <div className="space-y-1">
                                <div className="h-3 w-24 rounded bg-muted animate-pulse" />
                                <div className="h-2.5 w-12 rounded bg-muted animate-pulse" />
                              </div>
                              <div className="h-3 w-16 rounded bg-muted animate-pulse ml-auto" />
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                    <p className="text-xs text-muted-foreground text-center py-1">
                      {PERIOD_LABELS[p]} 기준가 조회 중 ({mergedStocks.length}개 종목)...
                    </p>
                  </div>
                ) : (
                  <>
                    {/* 전체 요약 */}
                    <div className="rounded-lg border bg-muted/20 px-4 py-3 space-y-2">
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-2">
                          <TrendIcon className={`size-5 ${getProfitLossColor(totalProfit)}`} />
                          <div>
                            <p className="text-xs text-foreground">{PERIOD_LABELS[p]} 수익</p>
                            <p className={`text-base font-bold tabular-nums ${getProfitLossColor(totalProfit)}`}>
                              {totalProfit >= 0 ? "+" : ""}{formatShortCurrency(totalProfit)}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-muted-foreground">수익률</p>
                          <p className={`text-sm font-bold tabular-nums ${getProfitLossColor(totalRate)}`}>
                            {formatRate(totalRate)}
                          </p>
                        </div>
                      </div>
                      {(() => {
                        const isAll = marketView === "all";
                        const isKr = marketView === "kr";
                        const isUs = marketView === "us";
                        const hasKr = krProfits.length > 0;
                        const hasUs = usProfits.length > 0;
                        const showKrDate = (isAll || isKr) && hasKr;
                        const showUsDate = (isAll || isUs) && hasUs;
                        // 좌측 금액: 전체=합계, 국내/해외 탭=해당 시장만
                        const leftSum = isAll ? totalRefValue : isKr ? krRefSum : usRefSum;
                        const rightSum = isAll ? totalCurrentValue : isKr ? krCurrentSum : usCurrentSum;
                        return (
                          <div className="pt-1.5 border-t border-border/50 space-y-1.5">
                            {/* 기준 종가 비교: 단일 진입점. 펼치면 옵션 토글 + 종가 비교 표 */}
                            <Collapsible open={closeTableOpen} onOpenChange={setCloseTableOpen}>
                              <CollapsibleTrigger asChild>
                                <button type="button" className="flex items-center gap-1 mt-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
                                  <ChevronDown className={`size-4 transition-transform ${closeTableOpen ? "rotate-180" : ""}`} />
                                  기준 종가 비교
                                </button>
                              </CollapsibleTrigger>
                              <CollapsibleContent className="text-sm mt-2 space-y-2">
                                {/* 옵션 토글 */}
                                <div className="flex items-center gap-1.5 text-xs rounded-md bg-muted/40 py-1.5 px-2 w-fit ml-auto">
                                  <InfoHint>
                                    <p><span className="font-semibold text-foreground">동일 영업일</span> — 국내·해외를 같은 영업일의 종가로 합산합니다. (해외는 익일 새벽 마감)</p>
                                    <p><span className="font-semibold text-foreground">KST 접속일</span> — KST 접속일 기준으로 국내·해외 각 시장의 종가를 합산합니다.</p>
                                    {period === "daily" && <p className="text-muted-foreground">일별 해외는 시작·종료에 어제·오늘 환율을 각각 적용합니다.</p>}
                                  </InfoHint>
                                  <span className={`rounded px-1.5 py-0.5 ${profitBasis === "sameBusinessDay" ? "font-semibold text-foreground bg-gray-200 dark:bg-gray-700" : "text-muted-foreground"}`}>동일 영업일</span>
                                  <Switch
                                    checked={profitBasis === "kstAccessDay"}
                                    onCheckedChange={(c) => setProfitBasis(c ? "kstAccessDay" : "sameBusinessDay")}
                                    aria-label="종가 기준 옵션"
                                  />
                                  <span className={`rounded px-1.5 py-0.5 ${profitBasis === "kstAccessDay" ? "font-semibold text-foreground bg-gray-200 dark:bg-gray-700" : "text-muted-foreground"}`}>KST 접속일</span>
                                </div>
                                {/* 헤더 */}
                                <div className={`${CLOSE_TABLE_COLS} pb-1.5 border-b border-border/50 text-muted-foreground`}>
                                  <span className="text-[11px] font-normal self-end">(KST)</span>
                                  <span>시작 종가</span>
                                  <span className="text-right">종료 종가</span>
                                </div>
                                {/* 시장별 날짜 */}
                                {showKrDate && (
                                  <MarketDateRow label="국내" startDate={krRefDate} endDate={krCompareDate} startNote={krHolidayExcluded ? "휴장제외" : undefined} />
                                )}
                                {showUsDate && (
                                  <MarketDateRow label="해외" startDate={usRefDate} endDate={usCompareDate} startSub={usStartRateText} endSub={usEndRateText} startNote={usHolidayExcluded ? "휴장제외" : undefined} />
                                )}
                                {/* 합계 */}
                                <div className={`${CLOSE_TABLE_COLS} pt-1.5 font-medium tabular-nums`}>
                                  <span className="text-muted-foreground font-normal">합계</span>
                                  <span>{formatShortCurrency(leftSum)}</span>
                                  <span className="text-right">{formatShortCurrency(rightSum)}</span>
                                </div>
                                <p className="pt-1.5 text-[11px] text-muted-foreground/60">마감 기준: 국내 16:00 · 해외 익일 새벽 (KST)</p>
                              </CollapsibleContent>
                            </Collapsible>
                          </div>
                        );
                      })()}
                    </div>

                    {/* 종목별 목록 */}
                    <div className="space-y-3">
                      {grouped.map(({ key, label, color, items, catProfit, catRef, catCurrent, catRate }) => (
                        <div key={key} className="rounded-lg border overflow-hidden">
                          <div className="flex items-center justify-between px-4 py-1.5 border" style={{ borderColor: MAIN_PALETTE[0] }}>
                            <div className="flex items-center gap-2">
                              <span className="inline-block w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
                              <span className="text-sm font-semibold text-muted-foreground">{label}</span>
                            </div>
                            {catRate !== null && (
                              <div className="text-right">
                                <p className={`text-sm tabular-nums ${getProfitLossColor(catProfit)}`}>
                                  {catProfit >= 0 ? "+" : ""}{formatShortCurrency(catProfit)} ({formatRate(catRate)})
                                </p>
                                <p className="text-xs text-muted-foreground tabular-nums">
                                  {formatShortCurrency(catRef)} → {formatShortCurrency(catCurrent)}
                                </p>
                              </div>
                            )}
                          </div>
                          <div className="divide-y">
                            {items.map(({ stock, ticker, profitAmount, profitRate, currentValue, refValue, hasRef, fxGain, isForeign }) => {
                              const priceGain = profitAmount - fxGain;
                              const showFx = hasRef && isForeign;
                              return (
                                <div
                                  key={stock.id}
                                  className="grid grid-cols-[1fr_auto] gap-x-3 px-4 py-2.5 items-center hover:bg-muted/30 transition-colors"
                                >
                                  <div className="min-w-0">
                                    <p className="text-xs sm:text-sm font-semibold truncate">{stock.name || ticker}</p>
                                    <p className="text-[11px] text-muted-foreground">{ticker}</p>
                                  </div>
                                  <div className="text-right shrink-0">
                                    {hasRef ? (
                                      <>
                                        <div className="flex items-center justify-end gap-1">
                                          {showFx && <FxBreakdown priceGain={priceGain} fxGain={fxGain} fxApplied={period === "daily"} />}
                                          <p className={`text-sm tabular-nums font-medium ${getProfitLossColor(profitAmount)}`}>
                                            {profitAmount >= 0 ? "+" : ""}{formatShortCurrency(profitAmount)} ({profitRate !== null ? formatRate(profitRate) : "--"})
                                          </p>
                                        </div>
                                        <p className="text-xs text-muted-foreground tabular-nums">
                                          {formatShortCurrency(refValue)} → {formatShortCurrency(currentValue)}
                                        </p>
                                      </>
                                    ) : (
                                      <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">기준가 없음</Badge>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
