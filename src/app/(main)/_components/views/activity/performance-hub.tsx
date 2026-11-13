"use client";

import { LoadingNote, LOADING_LABEL } from "@/components/ui/loading-note";
import { SKELETON_FILL } from "@/components/ui/skeleton";
import { useMemo } from "react";
import { Wallet, BadgeDollarSign, Trophy } from "lucide-react";
import { useQueries } from "@tanstack/react-query";
import { useAssetData } from "@/contexts/asset-data-context";
import { formatPriceByMode } from "@/lib/number-utils";
import { ASSET_THEME, getProfitLossColor } from "@/config/theme";
import { KpiCard } from "../../layout/ui/kpi-card";
import { HubShareButton } from "../../layout/ui/hub-share-button";
import { normalizeTicker } from "@/lib/finance/finance-service";
import type { DividendPayoutResult } from "@/lib/finance/finance-service";
import { fetchDividend, countFailedDividends, DIVIDEND_FETCH_FAILED_MESSAGE } from "@/lib/finance/dividend-client";
import { useAssetNavigation, type ActivityTab } from "../../layout/navigation/navigation-context";
import { groupStocksByTickerCategory, mergeStockGroup } from "../detail/asset-detail-tabs";
import { buildAssetReport } from "@/lib/report/asset-report";
import { readDailySnapshots, readMonthlySnapshots } from "@/lib/asset/snapshot-storage";
import { monthlyLogEntryCount } from "@/lib/report/monthly-log";
import type { SettlementWindow } from "@/lib/report/settlement";
import { pickFirstRecordStart, pickSettlementCard, resolveSettlementWindow, settlementRangeLabel, settlementWindowName } from "@/lib/report/settlement";
import { settlementDelta } from "./change-hero";
import { hasAnyAssets } from "@/lib/asset/asset-storage";
import { HubChangeRows } from "./hub-change-rows";

const DOMESTIC_CATEGORIES = new Set(["domestic", "irp", "isa", "pension"]);

// dividend-chart.tsx와 동일 쿼리 키 → 캐시 공유 (자산 성적표에서도 재사용)
export function useDividendAnnualTotals() {
  const { assetData, exchangeRates } = useAssetData();
  const usdRate = exchangeRates.USD;

  const stocksWithTicker = (() => {
    const base = assetData.stocks.filter((s) => s.ticker && s.category !== "unlisted" && s.inactiveStatus !== "delisted");
    const grouped = groupStocksByTickerCategory(base);
    return Array.from(grouped.values()).map(mergeStockGroup);
  })();

  const queries = useQueries({
    queries: stocksWithTicker.map((stock) => {
      const ticker = normalizeTicker(stock);
      const type = DOMESTIC_CATEGORIES.has(stock.category) ? "domestic" : "foreign";
      return {
        queryKey: ["dividend", "v11", ticker, type],
        queryFn: () => fetchDividend(ticker, type, "NAS"),
        staleTime: 30 * 24 * 60 * 60 * 1000,
        retry: false,
      };
    }),
  });

  const isLoading = queries.some((q) => q.isLoading);
  const failedCount = countFailedDividends(queries);

  const nowKST = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const currentYM = `${nowKST.getUTCFullYear()}-${String(nowKST.getUTCMonth() + 1).padStart(2, "0")}`;

  let annualActual = 0;
  let annualEstimated = 0;
  stocksWithTicker.forEach((stock, i) => {
    const payouts = (queries[i]?.data as DividendPayoutResult[] | undefined) ?? [];
    const rate = stock.currency === "USD" ? usdRate : 1;
    for (const p of payouts) {
      if (stock.purchaseDate && p.payoutDate < stock.purchaseDate) continue;
      const amt = p.amountPerShare * stock.quantity * rate;
      if (p.payoutDate.slice(0, 7) <= currentYM) annualActual += amt;
      else annualEstimated += amt;
    }
  });

  return {
    isLoading,
    failedCount,
    annualActual: Math.round(annualActual),
    annualEstimated: Math.round(annualEstimated),
    annualTotal: Math.round(annualActual + annualEstimated),
  };
}

// 허브 자산 변화 카드 설명 줄 — 이름은 settlementWindowName 1곳(4.94). settled는 배지가 이름이라 구간만, range는 이름=구간
function hubDescription(w: SettlementWindow | undefined, today: string): string {
  if (!w) return "다음 달부터 결산이 열려요";
  if (w.kind === "settled") return settlementRangeLabel(w);
  const { name, inProgress } = settlementWindowName(w, today);
  return inProgress ? `${name} · 진행 중` : name;
}

export function PerformanceHub() {
  const { assetData, getAssetSummary, snapshotVersion } = useAssetData();
  const summary = getAssetSummary();
  const { navigate } = useAssetNavigation();

  const go = (tab: ActivityTab) => navigate({ type: "activity", tab });

  // 자산 성적표 카드 — 상세 "투입 대비 성과"와 동일하게 이자 차감 후 '남긴 돈'을 노출(같은 소스로 값 일치)
  const report = useMemo(() => buildAssetReport(assetData, summary), [assetData, summary]);
  const allNet = summary.totalProfit - report.annualInterest;
  const allNetRate = summary.totalCost > 0 ? (allNet / summary.totalCost) * 100 : 0;

  // 자산 변화 카드(#32 r2) — 결산 창(말일−3일~다음 달 10일, 비교 가능) 안이면 "N월 결산" 배지 + 구간 증감,
  // 창 밖이면 이번 달 진행 중 증감, 첫 달·자산 0건이면 금액 없이 안내. 증감은 결산 Hero와 같은 settlementDelta.
  const hasAssets = hasAnyAssets(assetData);
  const today = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().split("T")[0];
  const changeCard = useMemo(() => {
    if (!hasAssets || snapshotVersion < 0) return null;
    const monthly = readMonthlySnapshots();
    const firstRecord = pickFirstRecordStart(readDailySnapshots(), assetData, today);
    const settled = pickSettlementCard(monthly, today, firstRecord);
    if (settled) return { window: settled, inWindow: true };
    const w = resolveSettlementWindow(monthly, today.slice(0, 7), today, firstRecord);
    return w.kind === "first_month" ? null : { window: w, inWindow: false };
  }, [hasAssets, snapshotVersion, today, assetData]);
  const change = changeCard ? settlementDelta(changeCard.window, summary.netAsset) : null;
  // 허브 행 2 `N개월` — 월 탭 월별 기록 카드와 같은 노출 조건(4.83). 자산 0이면 행 목록 전체가 없다
  const monthlyCount = useMemo(
    () => (hasAssets && snapshotVersion >= 0 ? monthlyLogEntryCount(readMonthlySnapshots(), today, summary.netAsset) : null),
    [hasAssets, snapshotVersion, today, summary.netAsset],
  );

  // 배당 — 올해 연간 합계 (실제 + 예상)
  const { isLoading: divLoading, failedCount: divFailed, annualActual, annualEstimated, annualTotal } = useDividendAnnualTotals();

  return (
    <div aria-busy={divLoading && annualTotal === 0 ? true : undefined} className={`flex flex-col gap-3 sm:gap-4 ${ASSET_THEME.contentPad} motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-3 motion-safe:duration-500`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-base sm:text-lg lg:text-2xl font-bold text-foreground text-balance">성과</h2>
          <p className="text-sm text-muted-foreground mt-0.5 break-keep text-pretty">자산 변화·배당·성적표를 확인하세요</p>
        </div>
        <HubShareButton />
      </div>

      {/* 지난 접속 등락은 홈 Hero(순자산 헤더)로 통합 — 앱을 켜자마자 보는 정보라 중복 노출하지 않는다 */}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
        <div data-testid="hub-card-change" className="lg:row-span-2">
        <KpiCard
          icon={Wallet}
          title={
            <span className="inline-flex flex-wrap items-center gap-1.5">
              자산 변화
              {changeCard?.window.kind === "settled" && (
                <span data-testid="hub-change-settlement-badge" className="rounded bg-primary/10 px-1.5 py-0.5 text-xs font-semibold text-primary">
                  {settlementWindowName(changeCard.window, today).name}
                </span>
              )}
            </span>
          }
          description={<span data-testid="hub-change-desc" className="tabular-nums">{hubDescription(changeCard?.window, today)}</span>}
          primary={change ? `${change.delta >= 0 ? "+" : ""}${formatPriceByMode(change.delta)}` : undefined}
          primaryClassName={change ? getProfitLossColor(change.delta) : undefined}
          secondary={change && change.pct !== null ? (
            <span className={`font-semibold tabular-nums ${getProfitLossColor(change.delta)}`}>
              {change.pct >= 0 ? "+" : ""}{change.pct.toFixed(1)}%
              <span className="text-muted-foreground font-medium ml-1.5">지난 기록 대비</span>
            </span>
          ) : null}
          onClick={() => navigate({
            type: "activity", tab: "change",
            init: changeCard?.inWindow
              ? { scope: "all", period: "month", month: changeCard.window.month, source: "card" }
              : { scope: "all", period: "month", source: "menu" },
          })}
          rows={hasAssets ? <HubChangeRows monthlyCount={monthlyCount} /> : undefined}
        />
        </div>

        <div data-testid="hub-card-dividend">
        <KpiCard
          icon={BadgeDollarSign}
          title="배당"
          description="올해 배당 (지급 + 예상)"
          primary={divLoading && annualTotal === 0 ? <span aria-hidden className={`inline-block h-7 w-28 rounded-md align-middle ${SKELETON_FILL}`} /> : formatPriceByMode(annualTotal)}
          primaryClassName={ASSET_THEME.text.default}
          secondary={divLoading && annualTotal === 0 ? (
            <LoadingNote active label={LOADING_LABEL.dividend} className="min-h-5" />
          ) : !divLoading && (annualTotal > 0 || divFailed > 0) ? (
            <>
              {annualTotal > 0 && (
                <span className="text-muted-foreground">
                  지급 <span className="font-semibold text-foreground tabular-nums">{formatPriceByMode(annualActual)}</span>
                  <span className="mx-1.5 text-muted-foreground">·</span>
                  예상 <span className="font-semibold text-foreground tabular-nums">{formatPriceByMode(annualEstimated)}</span>
                </span>
              )}
              {divFailed > 0 && <p className="text-sm font-normal text-muted-foreground text-pretty break-keep">{DIVIDEND_FETCH_FAILED_MESSAGE}</p>}
            </>
          ) : null}
          onClick={() => go("dividend")}
        />
        </div>

        <div data-testid="hub-card-report">
        <KpiCard
          icon={Trophy}
          title={
            <span className="inline-flex items-center gap-1.5">
              자산 성적표
              <span className="rounded-md bg-primary/15 px-1.5 py-0.5 text-xs font-bold text-primary">Plus</span>
            </span>
          }
          description="이자 뺀 실수익 · AI 진단"
          primary={`${allNet >= 0 ? "+" : ""}${formatPriceByMode(Math.round(allNet))}`}
          primaryClassName={getProfitLossColor(allNet)}
          secondary={summary.totalCost > 0 ? (
            <span className={`font-semibold tabular-nums ${getProfitLossColor(allNet)}`}>
              {allNet >= 0 ? "+" : ""}{allNetRate.toFixed(1)}%
              <span className="text-muted-foreground font-medium ml-1.5">투입 대비</span>
              {/* 주식만이 아니라 부동산·코인·현금까지 포함한 값이라 기준을 못박는다 */}
              <span className="ml-1.5 rounded bg-muted px-1.5 py-0.5 text-xs font-semibold text-muted-foreground align-middle">모든 자산</span>
            </span>
          ) : <span className="text-muted-foreground">자산 등록 후 계산</span>}
          onClick={() => go("report")}
        />
        </div>
      </div>
    </div>
  );
}
