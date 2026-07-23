"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Trophy, Star, TrendingUp, Landmark, Sparkles, Banknote, PieChart, Globe2, Repeat, ChevronRight, ChevronDown, Wallet, Link2, type LucideIcon } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAssetData } from "@/contexts/asset-data-context";
import { formatPriceByMode, formatShortCurrency } from "@/lib/number-utils";
import { ASSET_THEME, MAIN_PALETTE, getProfitLossColor } from "@/config/theme";
import { buildAssetReport, computeFxExposure, computePeriodAttribution, type AttributionPeriod } from "@/lib/report/asset-report";
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
const CAPTION = "text-sm text-muted-foreground";

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
function SpecRow({ label, hint, children }: { label: ReactNode; hint?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="min-w-0 text-sm text-muted-foreground text-pretty">
        {label}
        {hint && <span className="text-muted-foreground/70"> · {hint}</span>}
      </span>
      <span className="shrink-0 text-sm font-semibold text-foreground tabular-nums">{children}</span>
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
  // 3기준 '남긴 돈'(번 돈 − 연간 이자). 모든 자산은 전체 이자, 실투자금은 이자 미부과, 레버리지는 netLeverage.
  const allNet = summary.totalProfit - report.annualInterest;
  const allNetRate = summary.totalCost > 0 ? (allNet / summary.totalCost) * 100 : null;

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
  }), [summary, report, assetData.yearlyNetAssets, dailySnapshots.length, monthlySnapshots, topShare, fxRatioSum, annualDividend, divReady, netLeverage, interestCompareReady, recordStats]);

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

  // 축별 액션 링크 (관련 화면 이동)
  const axisNavigate = (key: AxisKey) => {
    if (key === "diversification") navigate({ type: "detail", tab: "stocks-xray" });
    else if (key === "growth") navigate({ type: "activity", tab: "netasset" });
  };
  const axisHasLink = (key: AxisKey) =>
    (key === "diversification" && assetData.stocks.length > 0) || key === "growth";

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
                <p className={`text-2xl sm:text-3xl font-extrabold ${tierStyle.color}`}>{tierLabel(grade.tier)}</p>
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
              <p className={`${CAPTION} text-pretty`}>{TIER_SUMMARY[grade.tier]}</p>
            </div>

            {/* ── 투입 대비 성과 — 넣은 돈 + 레버리지를 3기준(모든 자산/실투자금/순수 레버리지) 한 표로 통합 ── */}
            <div className={SECTION}>
              <SectionHeader
                icon={Wallet}
                title="투입 대비 성과"
                badge={<span className="rounded bg-muted px-1.5 py-0.5 text-xs font-semibold text-muted-foreground shrink-0">3가지 기준</span>}
              >
                <InfoHint summary="같은 자산을 '모든 자산 / 내 돈만 / 빌린 돈만' 세 기준으로 나눠 넣은 돈·이자·번 돈을 비교해요.">
                  <p><span className="font-semibold text-foreground">모든 자산</span>: 부동산·주식·코인·현금 전부. 넣은 돈에는 대출·보증금으로 마련한 돈도 포함됩니다.</p>
                  <p><span className="font-semibold text-foreground">실투자금</span>: 넣은 돈에서 부채를 뺀 실제 내 돈. 순자산은 여기에 평가손익을 더한 값입니다.</p>
                  <p><span className="font-semibold text-foreground">순수 레버리지</span>: 투자에 쓴 대출만(금융자산 기준). 빌린 돈이 낸 이자보다 더 벌었는지 봅니다.</p>
                  <p>넣은 돈·번 돈은 <span className="font-semibold text-foreground">매입 후 누적</span>, 이자·레버리지 수익은 <span className="font-semibold text-foreground">연간</span> 기준입니다.</p>
                </InfoHint>
              </SectionHeader>

              {/* 결론 먼저(§11) — 가장 종합적인 '모든 자산' 기준으로 투입 대비 성과를 한 줄 평가 */}
              <div className="rounded-lg bg-muted/30 px-3 py-3 space-y-0.5">
                <p className={CAPTION}>이자 내고 남긴 돈 · 모든 자산 기준</p>
                <p className="flex items-baseline gap-2 flex-wrap">
                  <Signed value={Math.round(allNet)} className="text-xl sm:text-2xl font-extrabold" />
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

              {/* 3기준 × (넣은 돈·이자·남긴 돈) 비교 표 — 번 돈 열은 빼고 남긴 돈만 강조(모바일 4열) */}
              <div className="overflow-x-auto -mx-1 px-1">
                <div className="grid grid-cols-[1fr_auto_auto_auto] items-baseline gap-x-3 sm:gap-x-5 gap-y-2.5 min-w-[280px]">
                  <span className="text-xs text-muted-foreground">기준</span>
                  <span className="text-xs text-muted-foreground text-right">넣은 돈</span>
                  <span className="text-xs text-muted-foreground text-right">이자·연</span>
                  <span className="text-xs font-semibold text-foreground text-right">남긴 돈</span>
                  <div className="col-span-4 h-px bg-border/40" />

                  {/* 모든 자산 — 넣은 돈에 대출·보증금(부채)이 포함됨을 명시 */}
                  <div>
                    <p className="text-sm font-medium text-foreground">모든 자산</p>
                    <p className="text-xs text-muted-foreground/70 text-pretty">부동산·주식·코인·현금 · 부채 포함</p>
                  </div>
                  <span className="text-sm tabular-nums text-foreground text-right">{formatShortCurrency(summary.totalCost)}</span>
                  <span className={`text-sm tabular-nums text-right ${report.annualInterest > 0 ? ASSET_THEME.liability : "text-muted-foreground/70"}`}>
                    {report.annualInterest > 0 ? `−${formatShortCurrency(Math.round(report.annualInterest))}` : "—"}
                  </span>
                  <div className="text-right">
                    <p className="text-sm font-bold tabular-nums"><Signed value={Math.round(allNet)} /></p>
                    {allNetRate !== null && (
                      <p className={`text-xs font-semibold tabular-nums ${getProfitLossColor(allNetRate)}`}>
                        {allNetRate >= 0 ? "+" : ""}{allNetRate.toFixed(1)}%
                      </p>
                    )}
                  </div>

                  {/* 실투자금 — 부채가 있을 때만(무부채면 모든 자산과 동일해 중복) */}
                  {report.equity < summary.totalCost && (
                    <>
                      <div>
                        <p className="text-sm font-medium text-foreground">실투자금</p>
                        <p className="text-xs text-muted-foreground/70 text-pretty">부채 뺀 내 돈</p>
                      </div>
                      <span className="text-sm tabular-nums text-foreground text-right">{formatShortCurrency(report.equity)}</span>
                      <span className="text-sm tabular-nums text-right text-muted-foreground/70">—</span>
                      <div className="text-right">
                        <p className="text-sm font-bold tabular-nums"><Signed value={Math.round(summary.totalProfit)} /></p>
                        {report.equity > 0 && (
                          <p className={`text-xs font-semibold tabular-nums ${getProfitLossColor(report.equityReturnRate)}`}>
                            {report.equityReturnRate >= 0 ? "+" : ""}{report.equityReturnRate.toFixed(1)}%
                          </p>
                        )}
                      </div>
                    </>
                  )}

                  {/* 순수 레버리지 — 투자 대출이 있을 때만 */}
                  {report.investLoanBalance > 0 && (
                    <>
                      <div>
                        <p className="text-sm font-medium text-foreground">순수 레버리지</p>
                        <p className="text-xs text-muted-foreground/70 text-pretty">투자에 쓴 대출 · 1년</p>
                      </div>
                      <span className="text-sm tabular-nums text-foreground text-right">{formatShortCurrency(report.investLoanBalance)}</span>
                      <span className={`text-sm tabular-nums text-right ${ASSET_THEME.liability}`}>−{formatShortCurrency(Math.round(report.annualInterestInvest))}</span>
                      {kisUnavailable ? (
                        <span className="text-xs text-muted-foreground text-right self-center">점검 중</span>
                      ) : interestCompareReady ? (
                        <div className="text-right">
                          <p className="text-sm font-bold tabular-nums"><Signed value={Math.round(netLeverage)} /></p>
                          {netRate !== null && (
                            <p className={`text-xs font-semibold tabular-nums ${getProfitLossColor(netRate)}`}>
                              {netRate >= 0 ? "+" : ""}{netRate.toFixed(1)}%
                            </p>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground text-right self-center">조회 중…</span>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* 계산 근거 · 대출 상세 (압축 접기) — 레버리지가 있을 때만 노출 */}
              {report.investLoanBalance > 0 && (
                <Collapsible open={leverageDetailOpen} onOpenChange={setLeverageDetailOpen} className="rounded-lg bg-muted/10">
                  <CollapsibleTrigger className="flex w-full items-center justify-between px-3 py-3 text-sm font-semibold text-foreground">
                    <span>레버리지 계산 근거 · 대출 상세</span>
                    <ChevronDown className={`size-4 text-muted-foreground transition-transform duration-200 ${leverageDetailOpen ? "rotate-180" : ""}`} />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="px-3 pb-3 space-y-4">
                    {/* 그룹 1 — 5항목을 두 산식 체인으로 정렬(입력값 → 결과값). ▸는 결과 항목의 산식 */}
                    {report.financialInvestCost > 0 && (
                      <div className="space-y-1.5">
                        {/* 산식 A: 레버리지 총액 ÷ 금융 투자 원가 = 대출 비율 */}
                        <p><span className={GROUP_BADGE}>대출 비율</span></p>
                        <SpecRow label="레버리지 총액" hint="부동산 담보 제외">
                          {formatPriceByMode(report.investLoanBalance)}
                        </SpecRow>
                        <SpecRow label="금융 투자 원가" hint="주식·코인 (부동산·현금 제외)">
                          {formatPriceByMode(report.financialInvestCost)}
                        </SpecRow>
                        <SpecRow label="대출 비율" hint="▸ 레버리지 총액 ÷ 금융 투자 원가">
                          {(report.investLeverageRatio * 100).toFixed(0)}%
                        </SpecRow>
                        {/* 산식 B: 금융 수익 × 대출 비율 = 레버리지 몫 수익 */}
                        {interestCompareReady && !kisUnavailable && (
                          <>
                            <p className="pt-1"><span className={GROUP_BADGE}>레버리지 몫 수익</span></p>
                            <SpecRow label="금융 수익" hint="주식 지난 1년 + 올해 배당">
                              <span className="inline-flex items-baseline gap-1">
                                <Signed value={Math.round(totalFinReturn)} />
                                {totalFinReturnRate !== null && (
                                  <span className={`text-xs ${getProfitLossColor(totalFinReturnRate)}`}>
                                    ({totalFinReturnRate >= 0 ? "+" : ""}{totalFinReturnRate.toFixed(1)}%)
                                  </span>
                                )}
                              </span>
                            </SpecRow>
                            <SpecRow label="레버리지 몫 수익" hint="▸ 금융 수익 × 대출 비율">
                              <Signed value={Math.round(leveragedReturn)} />
                            </SpecRow>
                          </>
                        )}
                        <p className={`${CAPTION} text-pretty`}>부동산·코인 수익은 측정 불가로 비교에서 제외됩니다.</p>
                      </div>
                    )}
                    {/* 그룹 2 — 대출별 이자 */}
                    {report.loanInterest.length > 0 && (
                      <div className="space-y-1.5">
                        <p><span className={GROUP_BADGE}>대출별 이자</span></p>
                        {/* 종합 — 붉은색으로 노출 중인 비교 대상 대출만 합산(비교 제외 muted 항목은 빠짐) */}
                        <div className="flex items-baseline justify-between gap-2 rounded-md bg-muted/40 px-2 py-2">
                          <span className="text-sm font-semibold text-foreground">연간 이자 총합</span>
                          <span className={`text-sm sm:text-base font-bold tabular-nums ${ASSET_THEME.liability}`}>
                            −{formatPriceByMode(Math.round(report.annualInterestInvest))}<span className="text-muted-foreground font-medium">/년</span>
                          </span>
                        </div>
                        <p className={`${CAPTION} text-pretty`}>신용·마이너스대출로 부동산을 샀다면 눌러서 <span className="text-foreground font-medium">연계 부동산</span>을 지정하세요. 지정하면 이 비교에서 빠집니다.</p>
                        {report.loanInterest.map((l) => (
                          <button
                            key={l.id}
                            type="button"
                            aria-label={`${l.name} 대출 수정`}
                            onClick={() => window.dispatchEvent(new CustomEvent("trigger-edit-loan", { detail: { id: l.id } }))}
                            className="flex w-full items-baseline justify-between gap-2 rounded-md px-2 py-2 text-sm text-left hover:bg-muted/40 active:scale-[0.98] transition-[background-color,transform] duration-150"
                          >
                            <span className="min-w-0 truncate text-muted-foreground">
                              {l.name}
                              <span className="ml-1.5 tabular-nums">{l.rate}%</span>
                              {l.isRealEstate ? (
                                <span className="ml-1.5 text-xs text-muted-foreground/70">비교 제외</span>
                              ) : (
                                <span className="ml-1.5 inline-flex items-center gap-0.5 text-xs text-muted-foreground/70">
                                  <Link2 className="size-3" />부동산 연결
                                </span>
                              )}
                            </span>
                            <span className={`shrink-0 font-semibold tabular-nums ${l.isRealEstate ? "text-muted-foreground" : ASSET_THEME.liability}`}>
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
                    <p className={`${CAPTION} text-pretty`}>{axis.reason}</p>
                    {linked ? (
                      <button
                        type="button"
                        onClick={() => axisNavigate(axis.key)}
                        className="flex w-full items-center justify-between gap-2 text-left text-sm font-medium text-primary hover:underline"
                      >
                        <span className="text-pretty">{axis.action}</span>
                        <ChevronRight className="size-4 shrink-0" />
                      </button>
                    ) : (
                      <p className="text-sm font-medium text-foreground text-pretty">{axis.action}</p>
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
                  <InfoHint summary="순자산 변화를 시세·환율·신규 자산·부채 4가지 원인으로 나눠 큰 것만 보여드려요.">
                    <p>선택 기간의 순자산 변화를 <span className="font-semibold text-foreground">시세 · 환율 · 새로 넣은 자산(저축·매수) · 부채 증감</span> 4원인으로 나눠 영향이 큰 것만 표시합니다.</p>
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
                  {/* 주 원인과 나머지 원인을 같은 목록으로 — "그 외" 한 덩어리로 접으면 환율·부채가 뭉쳐 보인다.
                      홈 헤더(formatAttributionSentence)와 동일한 원인 집합을 쓴다. */}
                  <div className="space-y-2">
                    {[...attribution.topCauses, ...attribution.restCauses].map((cause) => (
                      <div key={cause.key} className="rounded-lg bg-muted/30 px-3 py-2.5 flex items-center justify-between gap-3">
                        <p className="text-sm sm:text-[15px] font-medium text-foreground text-pretty">{cause.sentence}</p>
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
                  <Sparkles className="size-4 text-primary" /> AI 평가 프롬프트
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
                AI 평가 프롬프트 확인 · 복사
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
