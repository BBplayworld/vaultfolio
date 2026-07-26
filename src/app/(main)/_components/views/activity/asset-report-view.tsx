"use client";

import { Fragment, useEffect, useMemo, useState, type ReactNode } from "react";
import { Trophy, Star, TrendingUp, Landmark, Sparkles, Banknote, PieChart, Globe2, Repeat, ChevronRight, ChevronDown, Wallet, Link2, type LucideIcon } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAssetData } from "@/contexts/asset-data-context";
import { formatPriceByMode, formatShortCurrency } from "@/lib/number-utils";
import { ASSET_THEME, MAIN_PALETTE, getProfitLossColor } from "@/config/theme";
import { buildAssetReport, computeFxExposure, computePeriodAttribution, getOrderedCauses, type AttributionPeriod } from "@/lib/report/asset-report";
import { computeAssetGrade, tierLabel, diffGrade, toSnapshotGrade, type AxisKey, type GradeTier } from "@/lib/report/asset-grade";
import { computeRecordStats } from "@/lib/report/record-streak";
import { listArchivedDates } from "@/lib/snapshot-archive";
import { readExchangeHistory, fetchProfitRef, computePeriodStockProfitTotal } from "@/lib/profit-utils";
import { useProfitBasisStore } from "@/stores/profit-basis-store";
import type { ProfitRefResponse } from "@/app/api/finance/profit/route";
import { normalizeTicker } from "@/lib/finance-service";
import { InlineSelector } from "../../layout/ui/inline-selector";
import { InfoHint } from "../../layout/ui/info-hint";
import { computeBreakdown } from "@/lib/xray/stock-xray";
import { groupStocksByTicker, mergeStockGroup } from "../detail/asset-detail-tabs";
import { useAssetNavigation } from "../../layout/navigation/navigation-context";
import { PromptPreviewDialog } from "../../layout/ui/prompt-preview-dialog";
import { AI_PROMPT_TEMPLATES, type AssetPromptContext } from "@/lib/ai-prompts";
import { useDividendAnnualTotals } from "./performance-hub";
import { readDailySnapshots, readMonthlySnapshots } from "@/lib/snapshot-storage";

// 성적표 변화 비교 기준일 표기: YYYY-MM-DD → M/D, YYYY-MM → M월
function fmtGradeBaseDate(d: string): string {
  const parts = d.split("-");
  if (parts.length >= 3) return `${parseInt(parts[1])}/${parseInt(parts[2])}`;
  return `${parseInt(parts[1])}월`;
}

// 부호 색상 텍스트 (상승=빨강/하락=파랑)
function Signed({ value, className = "" }: { value: number; className?: string }) {
  return (
    <span className={`font-semibold tabular-nums ${getProfitLossColor(value)} ${className}`}>
      {value >= 0 ? "+" : ""}{formatPriceByMode(value)}
    </span>
  );
}

// 대주제 섹션 외피 — 그림자로 띄워 "여기부터 다른 큰 항목"임을 명확히 구분(테두리보다 그림자 우선).
const SECTION = "rounded-xl bg-card border border-border/10 dark:border-0 shadow-sm p-4 space-y-3";
const SECTION_TITLE = "text-sm sm:text-base font-bold text-foreground";
// 근거 접기 안 소그룹 라벨 — 뱃지 형태(brand 톤)로 산식 단위를 구분
const GROUP_BADGE = "inline-block rounded bg-primary/10 px-1.5 py-0.5 text-xs font-semibold text-primary";
// 계산 근거의 값 앞 범위 뱃지 — 헤더 행 없이 각 금액이 어느 기준인지 그 자리에서 읽히게.
// brand 톤은 그룹 제목(GROUP_BADGE) 전용으로 예약하고, 범위 뱃지는 중성 2단으로 낮춰 구분한다.
const SCOPE_BADGE = "shrink-0 rounded px-1.5 py-0.5 text-xs font-semibold";
const SCOPE_MAIN = `${SCOPE_BADGE} bg-foreground/10 text-foreground`;  // 주 — 전체 기준
const SCOPE_SUB = `${SCOPE_BADGE} bg-muted text-muted-foreground`;      // 보조 — 금융자산·연간
// 여러 줄 설명 캡션 — 가독성 위해 line-height ≥1.5(leading-relaxed). 단일 줄에도 무해.
const CAPTION = "text-sm text-muted-foreground leading-relaxed";

// 대주제 섹션 헤더 — 아이콘을 채운 원형 칩에 담아 각 섹션의 시작을 시각적으로 announce 한다.
function SectionHeader({ icon: Icon, title, badge, children }: {
  icon: LucideIcon; title: string; badge?: ReactNode; children?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
        <Icon className="size-4" />
      </span>
      <span className="text-sm sm:text-base font-bold text-foreground">{title}</span>
      {badge}
      {children}
    </div>
  );
}

// 근거·명세 한 줄 — 좁은 타일 밖 전폭에서 라벨(좌, 줄바꿈 허용)·값(우, 고정)으로 정렬한다.
// 값+설명을 한 캡션에 섞어 모바일에서 줄바꿈이 지저분해지던 문제를 라벨/값 분리로 해결.
// 한 줄에 못 담으면 라벨을 음절 단위로 부수는 대신(break-keep) 값을 다음 줄 우측으로 내린다.
function SpecRow({ label, hint, children }: { label: ReactNode; hint?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
      <span className="min-w-0 text-sm text-muted-foreground text-pretty break-keep">
        {label}
        {hint && <span className="text-muted-foreground/70"> · {hint}</span>}
      </span>
      <span className="ml-auto shrink-0 text-sm font-semibold text-foreground tabular-nums">{children}</span>
    </div>
  );
}

// ── 별점 (0~5, 0.5 단위 · 반개 지원) ──────────────────────────────────
function StarRating({ score, size = "sm", muted = false }: { score: number | null; size?: "sm" | "lg"; muted?: boolean }) {
  const px = size === "lg" ? "size-6 sm:size-7" : "size-4";
  const stars = [0, 1, 2, 3, 4];
  const val = score ?? 0;
  return (
    <span className="inline-flex items-center gap-0.5" role="img" aria-label={score === null ? "측정불가" : `5점 만점에 ${val}점`}>
      {stars.map((i) => {
        const fill = Math.min(1, Math.max(0, val - i)); // 0 / 0.5 / 1
        return (
          <span key={i} className={`relative inline-block ${px}`}>
            <Star className={`${px} ${muted || score === null ? "text-muted-foreground/30" : "text-muted-foreground/25"}`} />
            {fill > 0 && !muted && score !== null && (
              <span className="absolute inset-0 overflow-hidden" style={{ width: `${fill * 100}%` }}>
                <Star className={`${px} text-amber-400 fill-current`} />
              </span>
            )}
          </span>
        );
      })}
    </span>
  );
}

// 트로피 티어 색 — 테두리 대신 그림자(드롭섀도) 관례.
// 등급이 높을수록 채도·글로우가 강해진다(bronze 은은 → platinum 강렬한 블룸).
const TIER_STYLE: Record<GradeTier, { color: string; shadow: string }> = {
  bronze: { color: "text-amber-700/80", shadow: "drop-shadow-[0_2px_6px_rgba(180,83,9,0.28)]" },
  silver: { color: "text-slate-400", shadow: "drop-shadow-[0_2px_9px_rgba(148,163,184,0.45)]" },
  gold: { color: "text-amber-500", shadow: "drop-shadow-[0_2px_13px_rgba(245,158,11,0.6)]" },
  platinum: { color: "text-indigo-500", shadow: "drop-shadow-[0_0_18px_rgba(99,102,241,0.8)]" },
};

const TIER_SUMMARY: Record<GradeTier, string> = {
  bronze: "기초 체력을 다질 단계입니다. 아래 축별 액션부터 하나씩 실행해보세요.",
  silver: "기본기는 갖췄습니다. 가장 낮은 축을 끌어올리면 등급이 오릅니다.",
  gold: "탄탄한 자산 관리입니다. 약한 축 한두 개만 보완하면 최상위권입니다.",
  platinum: "최상위 수준의 자산 관리입니다. 지금의 원칙을 꾸준히 유지하세요.",
};

const AXIS_ICONS: Record<AxisKey, typeof TrendingUp> = {
  growth: TrendingUp,
  earningQuality: PieChart,
  leverage: Banknote,
  diversification: Globe2,
  habit: Repeat,
};

export function AssetReportView() {
  const { assetData, getAssetSummary, exchangeRates, snapshotVersion, recordGradeSnapshot } = useAssetData();
  const { navigate } = useAssetNavigation();
  const summary = getAssetSummary();
  const report = useMemo(() => buildAssetReport(assetData, summary), [assetData, summary]);

  const [promptOpen, setPromptOpen] = useState(false);
  // 레버리지 근거·대출 상세는 기본 접힘 — 결론(이자 내고 남는 돈)까지 시선이 빨리 닿게
  const [leverageDetailOpen, setLeverageDetailOpen] = useState(false);

  // 배당 (성과 허브·배당 차트와 동일 쿼리 키 → 캐시 공유)
  // 이자(연 환산)·주식(최근 1년)과 기간 길이를 맞추기 위해 배당도 올해 12개월(실적+예상)을 쓴다.
  // annualActual(올해 실지급분)만 쓰면 연중에는 약 N/12만 잡혀 레버리지 수익이 구조적으로 과소계상된다.
  const { isLoading: divLoading, annualTotal: annualDividend } = useDividendAnnualTotals();
  const divReady = !(divLoading && annualDividend === 0);

  // 올해 주식 시세차익 (연초 대비, KIS 기준가 — performance-hub "수익" 카드와 동일 패턴, period만 yearly)
  const tickerList = useMemo(
    () => Array.from(new Set(
      assetData.stocks
        .filter((s) => s.ticker && s.category !== "unlisted" && s.inactiveStatus !== "delisted")
        .map((s) => normalizeTicker(s))
        .filter(Boolean),
    )).sort().join(","),
    [assetData.stocks],
  );
  const profitBasis = useProfitBasisStore((s) => s.basis);
  const profitBasisHydrated = useProfitBasisStore((s) => s.hydrated);
  const hydrateProfitBasis = useProfitBasisStore((s) => s.hydrate);
  useEffect(() => { hydrateProfitBasis(); }, [hydrateProfitBasis]);

  const [yearlyRefData, setYearlyRefData] = useState<ProfitRefResponse | undefined>(undefined);
  const [kisUnavailable, setKisUnavailable] = useState(false);
  useEffect(() => {
    if (!profitBasisHydrated || !tickerList) return;
    const controller = new AbortController();
    setYearlyRefData(undefined);
    setKisUnavailable(false);
    fetchProfitRef(tickerList, "yearly", {
      signal: controller.signal,
      caller: "asset-report:yearly",
      basis: profitBasis,
      onProgress: (data) => setYearlyRefData({ ...data }),
      onKisUnavailable: () => setKisUnavailable(true),
    }).catch(() => { /* abort 등 무시 */ });
    return () => controller.abort();
  }, [profitBasisHydrated, tickerList, profitBasis]);

  // yearly 응답의 refPrice는 "1년 전 시점" 가격 — 현재가(daily)와 짝지어야 시세차익이 나옴
  const [dailyRefData, setDailyRefData] = useState<ProfitRefResponse | undefined>(undefined);
  useEffect(() => {
    if (!profitBasisHydrated || !tickerList) return;
    const controller = new AbortController();
    setDailyRefData(undefined);
    fetchProfitRef(tickerList, "daily", {
      signal: controller.signal,
      caller: "asset-report:yearly-daily-base",
      basis: profitBasis,
      onProgress: (data) => setDailyRefData({ ...data }),
      onKisUnavailable: () => setKisUnavailable(true),
    }).catch(() => { /* abort 등 무시 */ });
    return () => controller.abort();
  }, [profitBasisHydrated, tickerList, profitBasis]);

  const stockYearlyProfit = computePeriodStockProfitTotal(assetData.stocks, yearlyRefData, dailyRefData, exchangeRates);
  // 보유 주식 없으면 시세차익 0으로 즉시 확정(조회 대기 불필요)
  const stockYearlyReady = tickerList === "" || (yearlyRefData !== undefined && dailyRefData !== undefined && stockYearlyProfit !== null);
  const stockYearlyValue = tickerList === "" ? 0 : (stockYearlyProfit ?? 0);
  const interestCompareReady = !kisUnavailable && stockYearlyReady && divReady;
  // 레버리지 몫 투자 수익 = 총 투자수익(주식 1년+배당) × 대출 비율 — 빌린 돈이 벌어온 몫만 이자와 비교
  // 총 금융자산 1년 수익(주식 시세차익 + 올해 배당)과 그 수익률 — 들어오는 돈 계산 흐름을 투명하게 보여주기 위해 노출
  const totalFinReturn = stockYearlyValue + annualDividend;
  const totalFinReturnRate = report.financialInvestCost > 0 ? (totalFinReturn / report.financialInvestCost) * 100 : null;
  const leveragedReturn = totalFinReturn * report.investLeverageRatio;
  // 결론(이자 내고 남는 돈) — Hero와 등급 입력(coverage)이 같은 값을 쓰도록 여기서 1회 계산
  const netLeverage = leveragedReturn - report.annualInterestInvest;
  const netRate = report.investLoanBalance > 0 ? (netLeverage / report.investLoanBalance) * 100 : null;
  // ── 3기준 자본 분해 (누적·전 자산) ───────────────────────────────────
  // totalCost = equity + debt 가 정의상 항등식이라 완전 분해가 성립한다.
  // 수익은 자본 비중대로 귀속하고, 이자는 전부 빌린 돈이 진다 → 실투자금 + 레버리지 = 모든 자산.
  const allNet = summary.totalProfit - report.annualInterest;
  const allNetRate = summary.totalCost > 0 ? (allNet / summary.totalCost) * 100 : null;
  const debt = Math.max(0, summary.totalCost - report.equity); // 대출 잔액 + 임차보증금
  const equityShare = summary.totalCost > 0 ? summary.totalProfit * (report.equity / summary.totalCost) : 0;
  const debtShare = summary.totalProfit - equityShare;   // 차액으로 계산 → 반올림해도 합이 어긋나지 않는다
  const equityNet = equityShare;                          // 내 돈에는 이자가 붙지 않는다
  const debtNet = debtShare - report.annualInterest;      // 이자는 전부 빌린 돈 몫
  const equityNetRate = report.equity > 0 ? (equityNet / report.equity) * 100 : null;
  const debtNetRate = debt > 0 ? (debtNet / debt) * 100 : null;
  const debtRatioOfCost = summary.totalCost > 0 ? (debt / summary.totalCost) * 100 : 0;

  // 환노출 (분산 축 입력)
  const fxExposures = useMemo(
    () => computeFxExposure(assetData, exchangeRates, summary.totalValue),
    [assetData, exchangeRates, summary.totalValue],
  );
  const fxRatioSum = fxExposures.reduce((s, fx) => s + fx.ratio, 0);

  // 주식 집중도 (X-Ray theme topShare — 분산 축 입력)
  const stockConcentration = useMemo(() => {
    if (assetData.stocks.length === 0) return null;
    const merged = Array.from(groupStocksByTicker(assetData.stocks).values()).map(mergeStockGroup);
    return computeBreakdown("theme", merged, exchangeRates);
  }, [assetData.stocks, exchangeRates]);
  const topShare = stockConcentration && stockConcentration.total > 0 ? stockConcentration.topShare : null;

  // 스냅샷 (원인분해 + 습관 축 입력)
  const dailySnapshots = useMemo(
    () => readDailySnapshots(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [snapshotVersion],
  );
  const monthlySnapshots = useMemo(
    () => readMonthlySnapshots(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [snapshotVersion],
  );

  // 기록 스트릭·기록률 (습관 축 입력 — 30일 원본 + 장기 아카이브에서 파생)
  const todayStr = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().split("T")[0];
  const recordStats = useMemo(
    () => computeRecordStats(dailySnapshots.map((s) => s.date), todayStr, listArchivedDates()),
    [dailySnapshots, todayStr],
  );

  // ── 종합 등급 ──
  // 저축 규칙성 — 최근 6개월 중 현금 입금이 관측된 개월 수(습관 축 '꾸준함' 근거). 입금 기록 없으면 null(순자산 상승 폴백).
  const savingsRhythm = useMemo(() => {
    const deposits = (assetData.cashTransactions || []).filter((t) => t.type === "deposit");
    if (deposits.length === 0) return null;
    const windowMonths = 6;
    const cut = new Date();
    cut.setMonth(cut.getMonth() - (windowMonths - 1));
    const cutoffYM = `${cut.getFullYear()}-${String(cut.getMonth() + 1).padStart(2, "0")}`;
    const months = new Set<string>();
    for (const t of deposits) {
      const ym = t.date.substring(0, 7);
      if (ym >= cutoffYM) months.add(ym);
    }
    return { depositMonths: months.size, windowMonths };
  }, [assetData.cashTransactions]);

  const grade = useMemo(() => computeAssetGrade({
    summary,
    report,
    yearlyNetAssets: assetData.yearlyNetAssets,
    monthlySnapshots,
    topShare,
    fxRatioSum,
    dividend: { annual: annualDividend, ready: divReady },
    // 커버리지 = 레버리지 몫 수익 − 투자 레버리지 이자 — 화면의 "이자 내고 남는 돈"과 동일 값
    coverage: { value: netLeverage, ready: interestCompareReady },
    // 기록률 — 일별 기록이 하나도 없으면 측정 전(레거시 배점 유지)
    recordRate: dailySnapshots.length > 0 ? recordStats.monthRate : null,
    savingsRhythm,
  }), [summary, report, assetData.yearlyNetAssets, dailySnapshots.length, monthlySnapshots, topShare, fxRatioSum, annualDividend, divReady, netLeverage, interestCompareReady, recordStats, savingsRhythm]);

  // ── 성적표 이력화: 전 축 확정(non-pending) 시 오늘자 스냅샷에 기록 ──
  // recordGradeSnapshot은 동일 값 재기록을 스킵하므로 effect 재실행에도 안전(idempotent)
  const gradeSettled = summary.totalValue > 0 && grade.axes.every((a) => !a.pending);
  useEffect(() => {
    if (!gradeSettled) return;
    recordGradeSnapshot(toSnapshotGrade(grade));
  }, [gradeSettled, grade, recordGradeSnapshot]);

  // 성적표 변화 — 기록이 있는 가장 최근 과거 daily(전일 등), 없으면 이전 달 monthly 대비
  const gradeDelta = useMemo(() => {
    if (!gradeSettled) return null;
    const prevDaily = dailySnapshots
      .filter((s) => s.grade && s.date < todayStr)
      .sort((a, b) => a.date.localeCompare(b.date))
      .pop();
    if (prevDaily?.grade) return diffGrade(prevDaily.grade, grade, prevDaily.date);
    const currentMonth = todayStr.substring(0, 7);
    const prevMonthly = monthlySnapshots
      .filter((s) => s.grade && s.month < currentMonth)
      .sort((a, b) => a.month.localeCompare(b.month))
      .pop();
    if (prevMonthly?.grade) return diffGrade(prevMonthly.grade, grade, prevMonthly.month);
    return null;
  }, [gradeSettled, dailySnapshots, monthlySnapshots, grade, todayStr]);

  // ── 원인분해 (기간 선택) ──
  const [attrPeriod, setAttrPeriod] = useState<AttributionPeriod>("1m");
  const attribution = useMemo(
    () => computePeriodAttribution(dailySnapshots, monthlySnapshots, readExchangeHistory(), attrPeriod, assetData, exchangeRates),
    [dailySnapshots, monthlySnapshots, attrPeriod, assetData, exchangeRates],
  );

  const getPromptContext = (): AssetPromptContext => ({
    data: assetData,
    summary,
    exchangeRates,
  });

  const hasAssets = summary.totalValue > 0;
  const tierStyle = TIER_STYLE[grade.tier];

  // ── 투입 대비 성과 3기준 행 — 모바일 세로 스택과 sm+ 표가 같은 소스를 쓰도록 한 번만 정의 ──
  // interest: null이면 "—"(이자 미부과), 그 외엔 연간 이자(음수 표기)
  const perfRows: { key: string; title: string; desc: string; cost: string; interest: number | null; value: ReactNode }[] = [
    {
      key: "all",
      title: "모든 자산",
      desc: "부동산·주식·코인·현금 · 부채 포함",
      cost: formatShortCurrency(summary.totalCost),
      interest: report.annualInterest > 0 ? report.annualInterest : null,
      value: (
        <div className="text-right">
          <p className="text-sm font-bold tabular-nums"><Signed value={Math.round(allNet)} /></p>
          {allNetRate !== null && (
            <p className={`text-sm font-semibold tabular-nums ${getProfitLossColor(allNetRate)}`}>
              {allNetRate >= 0 ? "+" : ""}{allNetRate.toFixed(1)}%
            </p>
          )}
        </div>
      ),
    },
    // 실투자금·레버리지 — 부채가 있을 때만(무부채면 모든 자산과 동일해 중복).
    // 수익은 자본 비중대로 귀속하고 이자는 전부 빌린 돈이 져, 두 행의 합이 '모든 자산'과 정확히 맞는다.
    ...(debt > 0
      ? [
        {
          key: "equity",
          title: "실투자금",
          desc: "부채 뺀 내 돈",
          cost: formatShortCurrency(report.equity),
          interest: null, // 내 돈에는 이자가 붙지 않는다
          value: (
            <div className="text-right">
              <p className="text-sm font-bold tabular-nums"><Signed value={Math.round(equityNet)} /></p>
              {equityNetRate !== null && (
                <p className={`text-sm font-semibold tabular-nums ${getProfitLossColor(equityNetRate)}`}>
                  {equityNetRate >= 0 ? "+" : ""}{equityNetRate.toFixed(1)}%
                </p>
              )}
            </div>
          ),
        },
        {
          key: "leverage",
          title: "레버리지",
          desc: "빌린 돈 · 대출+보증금",
          cost: formatShortCurrency(debt),
          interest: report.annualInterest > 0 ? report.annualInterest : null,
          value: (
            <div className="text-right">
              <p className="text-sm font-bold tabular-nums"><Signed value={Math.round(debtNet)} /></p>
              {debtNetRate !== null && (
                <p className={`text-sm font-semibold tabular-nums ${getProfitLossColor(debtNetRate)}`}>
                  {debtNetRate >= 0 ? "+" : ""}{debtNetRate.toFixed(1)}%
                </p>
              )}
            </div>
          ),
        },
      ]
      : []),
  ];

  // 이자 열 — 값 유무에 따라 부채색/muted 전환 (그리드·스택 공용)
  const renderInterest = (v: number | null) => (
    <span className={`text-sm tabular-nums text-right ${v !== null ? ASSET_THEME.liability : "text-muted-foreground/70"}`}>
      {v !== null ? `−${formatShortCurrency(Math.round(v))}` : "—"}
    </span>
  );

  // 축별 액션 링크 (관련 화면 이동)
  const axisNavigate = (key: AxisKey) => {
    if (key === "diversification") navigate({ type: "detail", tab: "stocks-xray" });
    else if (key === "growth") navigate({ type: "activity", tab: "netasset" });
    else if (key === "habit") navigate({ type: "detail", tab: "cash" });
  };
  const axisHasLink = (key: AxisKey) =>
    (key === "diversification" && assetData.stocks.length > 0) || key === "growth" ||
    (key === "habit" && assetData.cash.length > 0);

  return (
    <Card className={`min-w-0 ${ASSET_THEME.contentCard}`}>
      <CardHeader className={ASSET_THEME.contentPad}>
        <CardTitle className="flex items-center gap-2">
          <Trophy className="size-5 text-primary" />
          자산 성적표
          <span className="ml-1 rounded-md bg-primary/15 px-1.5 py-0.5 text-xs font-bold text-primary">Plus</span>
          <InfoHint summary="5개 축을 5점 만점으로 채점해 가중 평균한 종합 등급이에요.">
            <p>5개 축(장기 순자산 성장·수익의 질·레버리지 건전성·분산·투자 습관)을 각 5점 만점으로 채점하고 가중 평균해 종합 등급을 계산합니다.</p>
            <p>데이터가 부족한 축은 <span className="font-semibold text-foreground">측정불가</span>로 제외하고, 측정 가능한 축만으로 등급을 냅니다. 기록이 쌓이면 자동으로 정밀해집니다.</p>
            <p>투자 조언이 아닌, 내 자산의 구조·습관을 일반적 자산관리 기준으로 비춰보는 참고 지표입니다.</p>
          </InfoHint>
        </CardTitle>
      </CardHeader>
      <CardContent className={`space-y-4 min-w-0 ${ASSET_THEME.contentPad} motion-safe:animate-in motion-safe:fade-in motion-safe:duration-500`}>
        {!hasAssets ? (
          <p className={`${CAPTION} py-10 text-center`}>자산을 등록하면 성적표가 계산됩니다.</p>
        ) : (
          <>
            {/* ── 등급 Hero: 트로피 티어 + 종합 별점 ── */}
            <div className="rounded-xl border border-border/10 bg-card dark:border-0 shadow-xs p-5 sm:p-6 text-center space-y-3 motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-95 motion-safe:duration-500">
              <Trophy className={`mx-auto size-14 sm:size-16 ${tierStyle.color} ${tierStyle.shadow}`} strokeWidth={1.75} />
              <div>
                <p className={`text-2xl sm:text-3xl font-bold ${tierStyle.color}`}>{tierLabel(grade.tier)}</p>
                <div className="mt-1.5 flex items-center justify-center gap-2">
                  <StarRating score={grade.overall} size="lg" />
                  <span className="text-lg font-bold tabular-nums text-foreground">{grade.overall.toFixed(1)}</span>
                </div>
                {gradeDelta && gradeDelta.overallDiff !== 0 && (
                  <p className="mt-1 text-sm tabular-nums">
                    <span className={`font-semibold ${getProfitLossColor(gradeDelta.overallDiff)}`}>
                      {gradeDelta.overallDiff > 0 ? "▲" : "▼"} {Math.abs(gradeDelta.overallDiff).toFixed(1)}
                    </span>
                    <span className="text-muted-foreground"> {fmtGradeBaseDate(gradeDelta.baseDate)} 대비</span>
                  </p>
                )}
                {gradeDelta?.tierChange && (
                  <p className={`mt-0.5 text-sm font-semibold ${gradeDelta.tierChange === "up" ? tierStyle.color : "text-muted-foreground"}`}>
                    {gradeDelta.tierChange === "up" ? `${tierLabel(grade.tier)} 승급!` : "등급이 내려갔어요"}
                  </p>
                )}
                <p className={`${CAPTION} mt-1 tabular-nums`}>{grade.measuredCount >= 5 ? "5축 모두 측정 완료" : `5축 중 ${grade.measuredCount}축 측정`}</p>
              </div>
              <p className={`${CAPTION} text-pretty break-keep`}>{TIER_SUMMARY[grade.tier]}</p>
            </div>

            {/* ── 투입 대비 성과 — 넣은 돈 + 레버리지를 3기준(모든 자산/실투자금/금융투자 레버리지) 한 표로 통합 ── */}
            <div className={SECTION}>
              <SectionHeader
                icon={Wallet}
                title="투입 대비 성과"
                badge={<span className="rounded bg-muted px-1.5 py-0.5 text-xs font-semibold text-muted-foreground shrink-0">3가지 기준</span>}
              >
                <InfoHint summary="투입 자본을 '내 돈'과 '빌린 돈'으로 나눠, 각각 얼마를 남겼는지 비교해요.">
                  <p><span className="font-semibold text-foreground">모든 자산</span>: 부동산·주식·코인·현금 전부. 넣은 돈에는 대출·보증금으로 마련한 돈도 포함됩니다.</p>
                  <p><span className="font-semibold text-foreground">실투자금</span>(내 돈)과 <span className="font-semibold text-foreground">레버리지</span>(빌린 돈)는 평가손익을 <span className="font-semibold text-foreground">자본 비중대로 나눠</span> 귀속하고, <span className="font-semibold text-foreground">이자는 전부 빌린 돈이 부담</span>합니다. 그래서 두 줄을 더하면 모든 자산과 정확히 같아집니다.</p>
                  <p>수익은 <span className="font-semibold text-foreground">매입 후 누적</span>인데 이자는 <span className="font-semibold text-foreground">연간</span>이라, 오래 보유했을수록 레버리지가 유리하게 보입니다. 계산 근거의 <span className="font-semibold text-foreground">금융자산·연간</span>은 부동산·코인의 1년 수익을 잴 수 없어 주식·코인만 담은 별점용 보조 지표입니다.</p>
                </InfoHint>
              </SectionHeader>

              {/* 결론 먼저(§11) — 가장 종합적인 '모든 자산' 기준으로 투입 대비 성과를 한 줄 평가 */}
              <div className="rounded-lg bg-muted/30 px-3 py-3 space-y-0.5">
                <p className={CAPTION}>이자 내고 남긴 돈 · 모든 자산 기준</p>
                <p className="flex items-baseline gap-2 flex-wrap">
                  <Signed value={Math.round(allNet)} className="text-xl sm:text-2xl font-bold" />
                  {allNetRate !== null && (
                    <span className={`text-base font-bold tabular-nums ${getProfitLossColor(allNetRate)}`}>
                      ({allNetRate >= 0 ? "+" : ""}{allNetRate.toFixed(1)}%)
                    </span>
                  )}
                </p>
                <p className={`${CAPTION} text-pretty`}>
                  {allNetRate === null || allNetRate < 0
                    ? "이자를 빼면 아직 손실이에요."
                    : allNetRate < 5
                      ? "이자를 내고 소폭 남기고 있어요."
                      : allNetRate < 15
                        ? "이자를 내고도 꾸준히 남기고 있어요."
                        : "투입 대비 아주 좋은 성과예요."}
                </p>
              </div>

              {/* 3기준 × (넣은 돈·이자·남긴 돈) — 모바일은 기준별 세로 스택(4열 그리드는 금액 폭에 밀려 라벨이 붕괴) */}
              <div className="space-y-2 sm:hidden">
                {perfRows.map((r) => (
                  <div key={r.key} className="rounded-lg bg-muted/30 px-3 py-2.5 space-y-1.5">
                    <div>
                      <p className="text-sm font-medium text-foreground break-keep">{r.title}</p>
                      <p className="text-sm text-muted-foreground/70 text-pretty break-keep">{r.desc}</p>
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="text-sm text-muted-foreground shrink-0">넣은 돈</span>
                        <span className="text-sm tabular-nums text-foreground text-right">{r.cost}</span>
                      </div>
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="text-sm text-muted-foreground shrink-0">이자·연</span>
                        {renderInterest(r.interest)}
                      </div>
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="text-sm font-semibold text-foreground shrink-0">남긴 돈</span>
                        {r.value}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* sm+ — 컬럼 대조 표(번 돈 열은 빼고 남긴 돈만 강조). min-w는 자연 폭 이상으로 둬야 가로 스크롤이 실제로 동작 */}
              <div className="hidden sm:block overflow-x-auto -mx-1 px-1">
                <div className="grid grid-cols-[1fr_auto_auto_auto] items-baseline gap-x-5 gap-y-2.5 min-w-[440px]">
                  <span className="text-sm text-muted-foreground">기준</span>
                  <span className="text-sm text-muted-foreground text-right">넣은 돈</span>
                  <span className="text-sm text-muted-foreground text-right">이자·연</span>
                  <span className="text-sm font-semibold text-foreground text-right">남긴 돈</span>
                  <div className="col-span-4 h-px bg-border/40" />

                  {perfRows.map((r) => (
                    <Fragment key={r.key}>
                      <div>
                        <p className="text-sm font-medium text-foreground break-keep">{r.title}</p>
                        <p className="text-sm text-muted-foreground/70 text-pretty break-keep">{r.desc}</p>
                      </div>
                      <span className="text-sm tabular-nums text-foreground text-right">{r.cost}</span>
                      {renderInterest(r.interest)}
                      {r.value}
                    </Fragment>
                  ))}
                </div>
              </div>

              {/* 합계 검산 — 수식만 남긴다(산문 설명 없이도 두 행을 더하면 맞는다는 게 읽힌다) */}
              {debt > 0 && <p className={CAPTION}>실투자금 + 레버리지 = 모든 자산</p>}

              {/* 계산 근거 · 대출 상세 (압축 접기) — 부채가 있을 때만 노출 */}
              {debt > 0 && (
                <Collapsible open={leverageDetailOpen} onOpenChange={setLeverageDetailOpen} className="rounded-lg bg-muted/10">
                  <CollapsibleTrigger className="flex w-full items-center justify-between px-3 py-3 text-sm font-semibold text-foreground">
                    <span>레버리지 계산 근거 · 대출 상세</span>
                    <ChevronDown className={`size-4 text-muted-foreground transition-transform duration-200 ${leverageDetailOpen ? "rotate-180" : ""}`} />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="px-3 pb-3 pt-4 space-y-5 border-t border-border/40">
                    {/* 그룹 1 — 두 관점을 같은 항목명으로 2열 대조.
                        동일한 7단계 계산(빌린돈÷투입원가=비율, 수익×비율=몫수익, 몫수익−이자=남긴돈)을
                        범위만 달리 적용한 것이라, 나란히 두면 금융자산·연간이 전 자산의 부분집합임이 드러난다. */}
                    <div className="space-y-1.5">
                      <p><span className={GROUP_BADGE}>계산 근거</span></p>
                      {(() => {
                        const annualOn = report.investLoanBalance > 0 && report.financialInvestCost > 0;
                        const money = (v: number) => formatShortCurrency(Math.round(v));
                        const signed = (v: number) => `${v >= 0 ? "+" : ""}${money(v)}`;
                        // [항목, 전체·누적, 금융자산·연간, KIS 시세 조회가 필요한 값인지]
                        // 잔액·원가·비율·이자는 즉시 계산되는 값이라 조회를 기다릴 이유가 없다(행별로 가린다).
                        const rows: [string, string, string, boolean][] = [
                          ["빌린 돈", money(debt), money(report.investLoanBalance), false],
                          ["투입 원가", money(summary.totalCost), money(report.financialInvestCost), false],
                          ["대출 비율", `${debtRatioOfCost.toFixed(0)}%`, `${(report.investLeverageRatio * 100).toFixed(0)}%`, false],
                          ["수익", signed(summary.totalProfit), signed(totalFinReturn), true],
                          ["레버리지 몫 수익", signed(debtShare), signed(leveragedReturn), true],
                          ["연간 이자", `−${money(report.annualInterest)}`, `−${money(report.annualInterestInvest)}`, false],
                          ["남긴 돈", signed(debtNet), signed(netLeverage), true],
                        ];
                        const ready = annualOn && interestCompareReady && !kisUnavailable;
                        const pendingLabel = kisUnavailable ? "점검 중" : "조회 중…";
                        return (
                          // 항목마다 '라벨 줄 + 값 줄' 고정 2줄 — wrap에 맡기면 값 길이에 따라 행 구조가 달라진다.
                          // 값은 2열 그리드라 뱃지 폭이 열마다 같아 금액이 세로로 정렬된다.
                          <div className="space-y-3">
                            {rows.map(([label, all, fin, needsKis], i) => {
                              const last = i === rows.length - 1;
                              // 산식 3단계 경계 — ②수익 배분(i=3), ③최종(i=5) 시작 앞에 amber 구분선으로 단락을 끊는다(별점 amber와 통일)
                              const groupStart = i === 3 || i === 5;
                              // 강조는 색이 아니라 굵기·구분선으로만 — 한 줄만 색이 튀지 않게 금액·라벨 색은 통일
                              const amount = `text-sm tabular-nums text-foreground${last ? " font-bold" : ""}`;
                              const finReady = !needsKis || ready; // 조회가 필요 없는 값은 즉시 노출
                              return (
                                <div key={label} className={`space-y-1 ${groupStart ? `${ASSET_THEME.dividerAccent} pt-3` : ""}${last ? "border-t border-border/40 pt-2.5" : ""}`}>
                                  <p className={`text-sm text-muted-foreground break-keep${last ? " font-medium" : ""}`}>{label}</p>
                                  <div className={`grid ${annualOn ? "grid-cols-2" : "grid-cols-1"} gap-x-3`}>
                                    <span className="flex min-w-0 items-baseline gap-1.5">
                                      <span className={SCOPE_MAIN}>전체·누적</span>
                                      <span className={amount}>{all}</span>
                                    </span>
                                    {annualOn && (
                                      <span className="flex min-w-0 items-baseline gap-1.5">
                                        <span className={SCOPE_SUB}>금융자산·연간</span>
                                        <span className={finReady ? amount : "text-xs text-muted-foreground"}>{finReady ? fin : pendingLabel}</span>
                                      </span>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        );
                      })()}
                    </div>
                    {/* 그룹 2 — 대출별 이자. 계산 근거와 amber 구분선으로 큰 단락을 분리(별점 색과 통일) */}
                    {report.loanInterest.length > 0 && (
                      <div className={`space-y-1.5 ${ASSET_THEME.dividerAccent} pt-4`}>
                        <p><span className={GROUP_BADGE}>대출별 이자</span></p>
                        {/* 종합 — 전 자산 기준이 주(主)이므로 부동산 담보 포함 전체 이자. 아래 목록 합계와 일치한다 */}
                        <div className="flex items-baseline justify-between gap-2 rounded-md bg-muted/40 px-2 py-2">
                          <span className="text-sm font-semibold text-foreground">연간 이자 총합</span>
                          <span className={`text-sm sm:text-base font-bold tabular-nums ${ASSET_THEME.liability}`}>
                            −{formatPriceByMode(Math.round(report.annualInterest))}<span className="text-muted-foreground font-medium">/년</span>
                          </span>
                        </div>
                        {report.loanInterest.map((l) => (
                          <button
                            key={l.id}
                            type="button"
                            aria-label={`${l.name} 대출 수정`}
                            onClick={() => window.dispatchEvent(new CustomEvent("trigger-edit-loan", { detail: { id: l.id } }))}
                            className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-2.5 text-sm text-left hover:bg-muted/40 active:scale-[0.98] transition-[background-color,transform] duration-150"
                          >
                            {/* 이름만 말줄임하고 이율·뱃지는 shrink-0 + wrap — 좁은 폭에서 "부동산 연결" 어포던스가 잘려 사라지던 문제 방지 */}
                            <span className="min-w-0 flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5 text-muted-foreground">
                              <span className="min-w-0 max-w-full truncate">{l.name}</span>
                              <span className="shrink-0 tabular-nums">{l.rate}%</span>
                              {/* 부동산 연계 대출도 전 자산 기준에는 포함된다 — "비교 제외"가 아니라 연간 지표에서만 빠짐 */}
                              {l.isRealEstate ? (
                                <span className="shrink-0 text-xs text-muted-foreground/70">연간 지표 제외</span>
                              ) : (
                                <span className="shrink-0 inline-flex items-center gap-0.5 text-xs text-muted-foreground/70">
                                  <Link2 className="size-3" />부동산 연결
                                </span>
                              )}
                            </span>
                            {/* 모든 대출이 전 자산 기준 이자에 포함되므로 금액 색을 통일한다 */}
                            <span className={`shrink-0 font-semibold tabular-nums ${ASSET_THEME.liability}`}>
                              −{formatPriceByMode(Math.round(l.annual))}<span className="text-muted-foreground font-medium">/년</span>
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </CollapsibleContent>
                </Collapsible>
              )}
            </div>

            {/* ── 5축 측정 — 대주제 섹션으로 묶어 개별 축 카드들이 흩어져 보이지 않게 ── */}
            <div className={SECTION}>
              <SectionHeader
                icon={Star}
                title="5축 측정"
                badge={<span className="rounded bg-muted px-1.5 py-0.5 text-xs font-semibold text-muted-foreground shrink-0">{grade.measuredCount}/5 측정</span>}
              />
              <div className="space-y-2">
                {grade.axes.map((axis, idx) => {
                  const Icon = AXIS_ICONS[axis.key];
                  const linked = axisHasLink(axis.key);
                  return (
                    <div
                      key={axis.key}
                      className={`rounded-lg bg-muted/30 p-3 space-y-2 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-300`}
                      style={{ animationDelay: `${idx * 60}ms` }}
                    >
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-2 min-w-0">
                        <Icon className="size-4 text-primary shrink-0" />
                        <span className={SECTION_TITLE}>{axis.label}</span>
                        {axis.pending && <span className="text-xs text-muted-foreground shrink-0">잠정</span>}
                      </span>
                      <span className="flex items-center gap-1.5 shrink-0">
                        {(() => {
                          const d = gradeDelta?.axisDiffs[axis.key];
                          return d ? (
                            <span className={`text-xs font-semibold tabular-nums ${getProfitLossColor(d)}`}>
                              {d > 0 ? "▲" : "▼"}{Math.abs(d).toFixed(1)}
                            </span>
                          ) : null;
                        })()}
                        <StarRating score={axis.score} />
                        {axis.score !== null ? (
                          <span className="text-sm font-bold tabular-nums text-foreground w-7 text-right">{axis.score.toFixed(1)}</span>
                        ) : (
                          <span className="text-sm font-semibold text-muted-foreground w-14 text-right">측정불가</span>
                        )}
                      </span>
                    </div>
                    <p className={`${CAPTION} text-pretty break-keep`}>{axis.reason}</p>
                    {linked ? (
                      <button
                        type="button"
                        onClick={() => axisNavigate(axis.key)}
                        className="flex w-full items-center justify-between gap-2 text-left text-sm font-medium text-primary hover:underline"
                      >
                        <span className="text-pretty break-keep">{axis.action}</span>
                        <ChevronRight className="size-4 shrink-0" />
                      </button>
                    ) : (
                      <p className="text-sm font-medium text-foreground text-pretty break-keep">{axis.action}</p>
                    )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ── 순자산 변화, 왜? (기간별 주요 원인 1~2가지) ── */}
            <div className={SECTION}>
              <div className="flex items-center justify-between gap-2">
                <SectionHeader icon={Landmark} title="순자산 변화, 왜?">
                  <InfoHint summary="순자산 변화를 시세·환율·매수/매도·소득·부채 원인으로 나눠 큰 것만 보여드려요.">
                    <p>선택 기간의 순자산 변화를 <span className="font-semibold text-foreground">시세 · 환율 · 주식 신규 매수 · 주식 매도 회수 · 주식 외 새로 추가한 자산 · 소득·저축 유입 · 대출 증감</span>으로 나눠 영향이 큰 것만 표시합니다.</p>
                    <p><span className="font-semibold text-foreground">주식 신규 매수·매도 회수</span>는 기록한 <span className="font-semibold text-foreground">주식 거래내역</span>에서, <span className="font-semibold text-foreground">소득·저축 유입</span>은 <span className="font-semibold text-foreground">현금 입출금 내역</span>에서 나옵니다(과거 소급 기록 포함). 주식 거래내역이 없으면(코인·부동산 매수, 주식 직접 수정 등) &quot;주식 외 새로 추가한 자산&quot;으로 묶여 표시됩니다.</p>
                    <p><span className="font-semibold text-foreground">&quot;예측&quot;</span>은 과거 기록에 원인 분해용 상세(자산군별 평가액·당시 환율)가 없어, 현재 자산의 매수일·대출일과 환율 이력으로 추정한 값입니다. 지금부터 쌓이는 기록은 실측으로 정밀 분해됩니다.</p>
                  </InfoHint>
                </SectionHeader>
                <InlineSelector
                  value={attrPeriod}
                  onChange={setAttrPeriod}
                  options={[
                    { value: "1w", label: "1주" },
                    { value: "1m", label: "1개월" },
                    { value: "3m", label: "3개월" },
                    { value: "ytd", label: "올해" },
                  ]}
                  size="sm"
                  ariaLabel="원인분해 기간"
                />
              </div>
              {attribution ? (
                <div className="space-y-3">
                  <p className={`${CAPTION} text-pretty tabular-nums`}>
                    {attribution.fromDate} → {attribution.toDate} · 순자산 <Signed value={attribution.deltaNet} />
                    {attribution.estimated && <span className="ml-1.5 rounded bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground">예측</span>}
                  </p>
                  {/* 주 원인과 나머지 원인을 같은 목록으로 — "그 외" 한 덩어리로 접으면 환율·대출이 뭉쳐 보인다.
                      홈 헤더(formatAttributionSentence)와 동일한 원인 집합을, 연관 원인(매수·매도 등)이
                      나란히 보이도록 카테고리 순서(getOrderedCauses)로 정렬해 쓴다. */}
                  <div className="space-y-2">
                    {getOrderedCauses(attribution).map((cause) => (
                      <div key={cause.key} className="rounded-lg bg-muted/30 px-3 py-2.5 flex items-center justify-between gap-3">
                        <p className="text-sm sm:text-[15px] font-medium text-foreground text-pretty break-keep">{cause.sentence}</p>
                        <Signed value={Math.round(cause.amount)} className="shrink-0" />
                      </div>
                    ))}
                  </div>
                  {/* 임계값 미만이라 위 목록에 못 낀 잔차만 표시 — 합계가 Δ순자산과 맞도록 */}
                  {(() => {
                    const shownRest = attribution.restCauses.reduce((s, c) => s + c.amount, 0);
                    const residual = attribution.restEffect - shownRest;
                    return Math.abs(residual) >= 10000 ? (
                      <p className={`${CAPTION} tabular-nums`}>
                        그 외 요인 <Signed value={Math.round(residual)} className="font-medium" />
                      </p>
                    ) : null;
                  })()}
                  {attribution.estimated && (
                    <p className={`${CAPTION} text-pretty`}>
                      과거 구간은 현재 자산의 매수일·대출일 기반 예측치예요. 지금부터 쌓이는 기록은 실측으로 분해됩니다.
                    </p>
                  )}
                </div>
              ) : (
                <div className="py-6 text-center space-y-1">
                  <p className={CAPTION}>이 기간을 비교할 기록이 아직 없습니다.</p>
                  <p className={`${CAPTION} text-pretty`}>접속할 때마다 자산 기록이 쌓여 변화 원인을 알려드립니다.</p>
                </div>
              )}
            </div>

            {/* ── AI 평가 프롬프트 ── */}
            <div className="rounded-lg bg-muted/20 p-4 space-y-3">
              <div>
                <p className={`${SECTION_TITLE} flex items-center gap-1.5`}>
                  <Sparkles className="size-4 text-primary" /> 전체 자산 AI 평가 프롬프트
                </p>
                <p className={`${CAPTION} mt-1 text-pretty`}>
                  자산 현황을 외부 AI(Grok·Gemini·GPT)에 붙여넣어 구조·리스크 진단을 받아보세요.
                </p>
              </div>
              <Button
                onClick={() => setPromptOpen(true)}
                style={{ backgroundColor: MAIN_PALETTE[0] }}
                className="text-white hover:opacity-90 border-none w-full"
              >
                전체 자산 프롬프트 확인 · 복사
              </Button>
            </div>
          </>
        )}
      </CardContent>

      <PromptPreviewDialog
        open={promptOpen}
        onOpenChange={setPromptOpen}
        title={<><Sparkles className="size-5 text-primary" />AI 평가용 자산 종합 현황</>}
        description="아래 프롬프트를 복사하여 Grok·Gemini·GPT 등 AI에게 자산 구조·리스크 진단을 요청하세요."
        tabs={AI_PROMPT_TEMPLATES.map((t) => ({
          id: t.id,
          label: t.label,
          sublabel: t.sublabel,
          getPrompt: () => t.generate(getPromptContext()),
        }))}
        copySuccessMessage="AI 평가 프롬프트가 복사되었습니다."
      />
    </Card>
  );
}
