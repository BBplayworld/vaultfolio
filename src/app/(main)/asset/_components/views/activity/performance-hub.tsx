"use client";

import { useEffect, useState } from "react";
import { Wallet, TrendingUp, BadgeDollarSign } from "lucide-react";
import { useQueries } from "@tanstack/react-query";
import { useAssetData } from "@/contexts/asset-data-context";
import { formatShortCurrency, formatPriceByMode } from "@/lib/number-utils";
import { ASSET_THEME, getProfitLossColor } from "@/config/theme";
import { KpiCard } from "../../layout/ui/kpi-card";
import { normalizeTicker } from "@/lib/finance-service";
import type { DividendPayoutResult } from "@/lib/finance-service";
import { fetchProfitRef, computeDailyStockProfit } from "@/lib/profit-utils";
import { useProfitBasisStore } from "@/stores/profit-basis-store";
import type { ProfitRefResponse } from "@/app/api/finance/profit/route";
import { useAssetNavigation, type ActivityTab } from "../../layout/navigation/navigation-context";
import { groupStocksByTickerCategory, mergeStockGroup } from "../detail/asset-detail-tabs";

const DOMESTIC_CATEGORIES = new Set(["domestic", "irp", "isa", "pension"]);

async function fetchDividend(ticker: string, type: string): Promise<DividendPayoutResult[]> {
  const params = new URLSearchParams({ ticker, type, excd: "NAS" });
  const res = await fetch(`/api/finance/dividend?${params}`);
  if (!res.ok) return [];
  const json = await res.json();
  return json.data || [];
}

// dividend-chart.tsx와 동일 쿼리 키 → 캐시 공유
function useDividendAnnualTotals() {
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
  const { assetData, exchangeRates, getAssetSummary } = useAssetData();
  const summary = getAssetSummary();
  const { navigate } = useAssetNavigation();

  const go = (tab: ActivityTab) => navigate({ type: "activity", tab });

  // 순자산 — 전년 대비
  const yearly = [...assetData.yearlyNetAssets].sort((a, b) => a.year - b.year);
  const currentYear = new Date().getFullYear();
  const prevYearItem = yearly.find((y) => y.year === currentYear - 1);
  const netDiff = prevYearItem ? summary.netAsset - prevYearItem.netAsset : null;
  const netDiffPct = prevYearItem && prevYearItem.netAsset !== 0
    ? (netDiff! / Math.abs(prevYearItem.netAsset)) * 100
    : null;

  // 수익 — 일별(profit 페이지 디폴트와 동일)
  // profit-chart와 같은 tickerList 산출 (정렬 필수, 캐시 키 안정)
  const tickerList = Array.from(
    new Set(
      assetData.stocks
        .filter((s) => s.ticker && s.category !== "unlisted" && s.inactiveStatus !== "delisted")
        .map((s) => normalizeTicker(s))
        .filter(Boolean),
    ),
  ).sort().join(",");

  const profitBasis = useProfitBasisStore((s) => s.basis);
  const profitBasisHydrated = useProfitBasisStore((s) => s.hydrated);
  const hydrateProfitBasis = useProfitBasisStore((s) => s.hydrate);
  useEffect(() => { hydrateProfitBasis(); }, [hydrateProfitBasis]);

  const [refData, setRefData] = useState<ProfitRefResponse | undefined>(undefined);
  useEffect(() => {
    if (!profitBasisHydrated || !tickerList) return;
    const controller = new AbortController();
    setRefData(undefined);
    fetchProfitRef(tickerList, "daily", {
      signal: controller.signal,
      caller: "performance-hub:daily",
      basis: profitBasis,
      onProgress: (data) => setRefData({ ...data }),
    }).then((data) => setRefData(data)).catch(() => { /* abort 등 무시 */ });
    return () => controller.abort();
  }, [profitBasisHydrated, tickerList, profitBasis]);

  const { dailyProfit, dailyProfitRate } = computeDailyStockProfit(
    assetData.stocks,
    refData,
    exchangeRates,
  );
  const dailyReady = refData !== undefined && dailyProfit !== null;

  // 배당 — 올해 연간 합계 (실제 + 예상)
  const { isLoading: divLoading, annualActual, annualEstimated, annualTotal } = useDividendAnnualTotals();

  return (
    <div className={`flex flex-col gap-3 sm:gap-4 ${ASSET_THEME.contentPad}`}>
      <div>
        <h2 className="text-base sm:text-lg lg:text-2xl font-bold text-foreground">성과</h2>
        <p className="text-xs lg:text-sm text-muted-foreground mt-0.5">순자산·수익·배당을 각각 자세히 확인하세요</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
        <KpiCard
          icon={Wallet}
          title="순자산"
          description="자산 총액과 추이"
          primary={formatPriceByMode(summary.netAsset)}
          secondary={netDiff !== null && netDiffPct !== null ? (
            <>
              <span className={`font-semibold tabular-nums ${getProfitLossColor(netDiff)}`}>
                {netDiff >= 0 ? "+" : ""}{formatPriceByMode(netDiff)} ({netDiff >= 0 ? "+" : ""}{netDiffPct.toFixed(1)}%)
              </span>
              <span className="text-muted-foreground"> 전년 대비</span>
            </>
          ) : <span className="text-muted-foreground">전년 데이터 없음</span>}
          onClick={() => go("netasset")}
        />

        <KpiCard
          icon={TrendingUp}
          title="수익"
          description="기간별 수익"
          primary={dailyReady
            ? `${dailyProfit! >= 0 ? "+" : ""}${formatPriceByMode(dailyProfit!)}`
            : "조회 중…"}
          primaryClassName={ASSET_THEME.text.default}
          secondary={dailyReady ? (
            <span className={`font-semibold tabular-nums ${getProfitLossColor(dailyProfit!)}`}>
              {dailyProfit! >= 0 ? "+" : ""}{(dailyProfitRate ?? 0).toFixed(2)}%
              <span className="text-muted-foreground font-normal ml-1.5">일별 대비</span>
            </span>
          ) : null}
          onClick={() => go("profit")}
        />

        <KpiCard
          icon={BadgeDollarSign}
          title="배당"
          description="올해 배당 (지급 + 예상)"
          primary={divLoading && annualTotal === 0 ? "조회 중…" : formatPriceByMode(annualTotal)}
          primaryClassName={ASSET_THEME.text.default}
          secondary={!divLoading && annualTotal > 0 ? (
            <span className="text-muted-foreground">
              지급 <span className="font-semibold text-foreground tabular-nums">{formatPriceByMode(annualActual)}</span>
              <span className="mx-1.5 text-muted-foreground/60">·</span>
              예상 <span className="font-semibold text-foreground tabular-nums">{formatPriceByMode(annualEstimated)}</span>
            </span>
          ) : null}
          onClick={() => go("dividend")}
        />
      </div>
    </div>
  );
}
