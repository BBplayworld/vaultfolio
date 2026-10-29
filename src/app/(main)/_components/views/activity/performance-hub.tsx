"use client";

import { useMemo } from "react";
import { Wallet, BadgeDollarSign, Trophy } from "lucide-react";
import { useQueries } from "@tanstack/react-query";
import { useAssetData } from "@/contexts/asset-data-context";
import { formatPriceByMode } from "@/lib/number-utils";
import { ASSET_THEME, getProfitLossColor } from "@/config/theme";
import { KpiCard } from "../../layout/ui/kpi-card";
import { normalizeTicker } from "@/lib/finance/finance-service";
import type { DividendPayoutResult } from "@/lib/finance/finance-service";
import { useAssetNavigation, type ActivityTab } from "../../layout/navigation/navigation-context";
import { groupStocksByTickerCategory, mergeStockGroup } from "../detail/asset-detail-tabs";
import { buildAssetReport } from "@/lib/report/asset-report";
import { readMonthlySnapshots } from "@/lib/asset/snapshot-storage";
import { pickSettlementCard, resolveSettlementWindow, settlementRangeLabel } from "@/lib/report/settlement";
import { settlementDelta, settlementName } from "./change-hero";

const DOMESTIC_CATEGORIES = new Set(["domestic", "irp", "isa", "pension"]);

async function fetchDividend(ticker: string, type: string): Promise<DividendPayoutResult[]> {
  const params = new URLSearchParams({ ticker, type, excd: "NAS" });
  const res = await fetch(`/api/finance/dividend?${params}`);
  if (!res.ok) return [];
  const json = await res.json();
  return json.data || [];
}

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
        queryFn: () => fetchDividend(ticker, type),
        staleTime: 30 * 24 * 60 * 60 * 1000,
        retry: false,
      };
    }),
  });

  const isLoading = queries.some((q) => q.isLoading);

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
    annualActual: Math.round(annualActual),
    annualEstimated: Math.round(annualEstimated),
    annualTotal: Math.round(annualActual + annualEstimated),
  };
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
  const hasAssets = assetData.stocks.length + assetData.crypto.length + assetData.cash.length + assetData.loans.length + assetData.realEstate.length > 0;
  const today = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().split("T")[0];
  const changeCard = useMemo(() => {
    if (!hasAssets || snapshotVersion < 0) return null;
    const monthly = readMonthlySnapshots();
    const settled = pickSettlementCard(monthly, today);
    if (settled) return { window: settled, inWindow: true };
    const w = resolveSettlementWindow(monthly, today.slice(0, 7), today);
    return w.kind === "first_month" ? null : { window: w, inWindow: false };
  }, [hasAssets, snapshotVersion, today]);
  const change = changeCard ? settlementDelta(changeCard.window, summary.netAsset) : null;

  // 배당 — 올해 연간 합계 (실제 + 예상)
  const { isLoading: divLoading, annualActual, annualEstimated, annualTotal } = useDividendAnnualTotals();

  return (
    <div className={`flex flex-col gap-3 sm:gap-4 ${ASSET_THEME.contentPad} motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-3 motion-safe:duration-500`}>
      <div>
        <h2 className="text-base sm:text-lg lg:text-2xl font-bold text-foreground text-balance">성과</h2>
        <p className="text-sm text-muted-foreground mt-0.5 text-pretty">자산 변화·배당·성적표를 확인하세요</p>
      </div>

      {/* 지난 접속 등락은 홈 Hero(순자산 헤더)로 통합 — 앱을 켜자마자 보는 정보라 중복 노출하지 않는다 */}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
        <div data-testid="hub-card-change">
        <KpiCard
          icon={Wallet}
          title={
            <span className="inline-flex flex-wrap items-center gap-1.5">
              자산 변화
              {changeCard?.inWindow && (
                <span data-testid="hub-change-settlement-badge" className="rounded bg-primary/10 px-1.5 py-0.5 text-xs font-semibold text-primary">
                  {settlementName(changeCard.window.month, today, true)}
                </span>
              )}
            </span>
          }
          description={
            !changeCard ? "다음 달부터 결산이 열려요"
              : changeCard.inWindow ? settlementRangeLabel(changeCard.window)
                : `${settlementName(changeCard.window.month, today, false)} · 진행 중`
          }
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
        />
        </div>

        <div data-testid="hub-card-dividend">
        <KpiCard
          icon={BadgeDollarSign}
          title="배당"
          description="올해 배당 (지급 + 예상)"
          primary={divLoading && annualTotal === 0 ? "조회 중…" : formatPriceByMode(annualTotal)}
          primaryClassName={ASSET_THEME.text.default}
          secondary={!divLoading && annualTotal > 0 ? (
            <span className="text-muted-foreground">
              지급 <span className="font-semibold text-foreground tabular-nums">{formatPriceByMode(annualActual)}</span>
              <span className="mx-1.5 text-muted-foreground">·</span>
              예상 <span className="font-semibold text-foreground tabular-nums">{formatPriceByMode(annualEstimated)}</span>
            </span>
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
