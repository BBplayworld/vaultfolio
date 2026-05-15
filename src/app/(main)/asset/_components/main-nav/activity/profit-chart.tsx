"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useAssetData } from "@/contexts/asset-data-context";
import { formatShortCurrency } from "@/lib/number-utils";
import { normalizeTicker } from "@/lib/finance-service";
import { ASSET_THEME, MAIN_PALETTE, getProfitLossColor } from "@/config/theme";
import { fetchProfitRef, getDailyClosingRefDate, getRatesForDate, computeDailyStockProfit, type ProfitPeriod } from "@/lib/profit-utils";
import { groupStocksByTickerCategory, mergeStockGroup } from "../detail/asset-detail-tabs";
import { DataSourceBadge } from "../data-source-badge";

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

const TAB_LIST = ASSET_THEME.tabList1;
const TAB_TRIGGER = ASSET_THEME.tabTrigger1;
const SUB_TAB_LIST = ASSET_THEME.tabList3;
const SUB_TAB_TRIGGER = ASSET_THEME.tabTrigger3;

type MarketView = "all" | "kr" | "us";

const MARKET_LABELS: Record<MarketView, string> = {
  all: "전체",
  kr: "국내",
  us: "해외",
};

function formatRate(rate: number): string {
  const sign = rate >= 0 ? "+" : "";
  return `${sign}${rate.toFixed(2)}%`;
}

// 한투 API가 반환하는 해외 거래일을 KST 일자 표기로 +1일 변환 (사용자 인지 기준)
function shiftUsDate(date: string | undefined): string | undefined {
  if (!date) return date;
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
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
  const { assetData, exchangeRates } = useAssetData();
  const usdRate = exchangeRates.USD;
  const jpyRate = exchangeRates.JPY;
  const [period, setPeriod] = useState<ProfitPeriod>("daily");
  const [marketView, setMarketView] = useState<MarketView>("all");

  const stocksWithPrice = assetData.stocks.filter(
    (s) => s.ticker && s.category !== "unlisted" && s.currentPrice && s.currentPrice > 0
  );

  const groupedMap = groupStocksByTickerCategory(stocksWithPrice);
  const mergedStocks = Array.from(groupedMap.values()).map(mergeStockGroup);

  // 중복 제거 + 알파벳 정렬 → 다른 컴포넌트(stock-tab 등)와 동일한 캐시 키 보장
  const tickerList = Array.from(
    new Set(mergedStocks.map((s) => normalizeTicker(s)).filter(Boolean))
  ).sort().join(",");

  const { data: refData, isLoading } = useQuery({
    queryKey: ["profit", period, tickerList],
    queryFn: () => fetchProfitRef(tickerList, period),
    staleTime: 5 * 60 * 1000,
    enabled: isActive && mergedStocks.length > 0,
  });

  // 우측 "기준 종가"는 모든 period에서 동일하게 daily ref 종가를 사용
  const { data: dailyData } = useQuery({
    queryKey: ["profit", "daily", tickerList],
    queryFn: () => fetchProfitRef(tickerList, "daily"),
    staleTime: 5 * 60 * 1000,
    enabled: isActive && mergedStocks.length > 0 && period !== "daily",
  });
  const baseRefData = period === "daily" ? refData : dailyData;

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
      return { stock, ticker, profitAmount: 0, profitRate: null as number | null, currentValue: fallbackCurrent, refValue: 0, hasRef: false };
    }

    // 좌측 (이전 종가)
    const isDailyPeriod = period === "daily";
    const prevPrice = isDailyPeriod ? ref.prevPrice : ref.refPrice;
    const prevDate = isDailyPeriod ? ref.prevDate : ref.refDate;
    if (prevPrice === undefined || prevDate === undefined) {
      return { stock, ticker, profitAmount: 0, profitRate: null as number | null, currentValue: fallbackCurrent, refValue: 0, hasRef: false };
    }

    // daily는 시점별 환율 적용, 그 외는 현재 환율
    // 해외는 한투 API 거래일이 KST 기준 -1일이므로 환율 조회 시 +1일 보정
    const prevRateDate = isDailyPeriod && (isUS || isJP) ? shiftUsDate(prevDate) : prevDate;
    const refRateDate = isDailyPeriod && (isUS || isJP) ? shiftUsDate(base.refDate) : base.refDate;
    const prevRate = isDailyPeriod ? rateFor(getRatesForDate(prevRateDate!, currentRates)) : currentRate;
    const refRate = isDailyPeriod ? rateFor(getRatesForDate(refRateDate!, currentRates)) : currentRate;
    const refValue = prevPrice * stock.quantity * prevRate;

    // 우측 (기준 종가) = daily ref
    const currentValue = base.refPrice * stock.quantity * refRate;

    const profitAmount = currentValue - refValue;
    const profitRate = refValue > 0 ? (profitAmount / refValue) * 100 : 0;
    const baseDate = prevDate;
    const compareDate = base.refDate;

    return { stock, ticker, profitAmount, profitRate, currentValue, refValue, hasRef: true, refDate: baseDate, compareDate };
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
  const krRefDate = krProfits[0]?.refDate;
  const usRefDate = usProfits[0]?.refDate;
  const krCompareDate = krProfits[0]?.compareDate;
  const usCompareDate = usProfits[0]?.compareDate;

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
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5">
              <CardTitle>수익 현황</CardTitle>
              <DataSourceBadge kind="closing" />
            </div>
            <CardDescription>보유 주식의 기간별 수익</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Tabs value={period} onValueChange={(v) => setPeriod(v as ProfitPeriod)}>
            <TabsList className={TAB_LIST}>
              {(Object.keys(PERIOD_LABELS) as ProfitPeriod[]).map((p) => (
                <TabsTrigger key={p} value={p} className={TAB_TRIGGER}>
                  {PERIOD_LABELS[p]}
                </TabsTrigger>
              ))}
            </TabsList>

            {(Object.keys(PERIOD_LABELS) as ProfitPeriod[]).map((p) => (
              <TabsContent key={p} value={p} forceMount className="data-[state=inactive]:hidden mt-4 space-y-4">
                <Tabs value={marketView} onValueChange={(v) => setMarketView(v as MarketView)}>
                  <TabsList className={SUB_TAB_LIST}>
                    {(Object.keys(MARKET_LABELS) as MarketView[]).map((m) => (
                      <TabsTrigger key={m} value={m} className={SUB_TAB_TRIGGER}>
                        {MARKET_LABELS[m]}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </Tabs>
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
                          <p className={`text-base font-bold tabular-nums ${getProfitLossColor(totalRate)}`}>
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
                          <div className="pt-1.5 border-t border-border/50 grid grid-cols-2 gap-x-4 text-xs sm:text-sm">
                            <div className="space-y-1.5">
                              <p className="text-muted-foreground">이전 종가 <span className="text-[10px] font-normal">(KST)</span></p>
                              <div className="space-y-0.5">
                                {showKrDate && krRefDate && (
                                  <p className="text-[11px] text-muted-foreground tabular-nums">국내 {krRefDate}</p>
                                )}
                                {showUsDate && usRefDate && (
                                  <p className="text-[11px] text-muted-foreground tabular-nums">해외 {usRefDate}</p>
                                )}
                              </div>
                              <p className="text-sm tabular-nums font-medium">{formatShortCurrency(leftSum)}</p>
                            </div>
                            <div className="space-y-1.5 text-right">
                              <p className="text-muted-foreground">기준 종가 <span className="text-[10px] font-normal">(KST)</span></p>
                              <div className="space-y-0.5">
                                {showKrDate && krCompareDate && (
                                  <p className="text-[11px] text-muted-foreground tabular-nums">국내 {krCompareDate}</p>
                                )}
                                {showUsDate && usCompareDate && (
                                  <p className="text-[11px] text-muted-foreground tabular-nums">해외 {usCompareDate}</p>
                                )}
                              </div>
                              <p className="text-sm tabular-nums font-medium">{formatShortCurrency(rightSum)}</p>
                            </div>
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
                            {items.map(({ stock, ticker, profitAmount, profitRate, currentValue, refValue, hasRef }) => (
                              <div
                                key={stock.id}
                                className="grid grid-cols-[1fr_auto] gap-x-3 px-4 py-2.5 items-center hover:bg-muted/30 transition-colors"
                              >
                                <div className="min-w-0">
                                  <p className="text-xs sm:text-sm font-semibold truncate">{stock.name || ticker}</p>
                                  <p className="text-xs sm:text-sm text-muted-foreground">{ticker}</p>
                                </div>
                                <div className="text-right shrink-0">
                                  {hasRef ? (
                                    <>
                                      <p className={`text-sm tabular-nums font-medium ${getProfitLossColor(profitAmount)}`}>
                                        {profitAmount >= 0 ? "+" : ""}{formatShortCurrency(profitAmount)} ({profitRate !== null ? formatRate(profitRate) : "--"})
                                      </p>
                                      <p className="text-xs text-muted-foreground tabular-nums">
                                        {formatShortCurrency(refValue)} → {formatShortCurrency(currentValue)}
                                      </p>
                                    </>
                                  ) : (
                                    <Badge variant="outline" className="text-[9px] px-1 py-0 h-4">기준가 없음</Badge>
                                  )}
                                </div>
                              </div>
                            ))}
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
