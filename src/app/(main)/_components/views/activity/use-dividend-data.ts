"use client";

// 배당 조회·계산 공용 훅(#313, 5.157) — 배당 차트·종목 표·성과 허브(성적표 입력)가 같은 값을 쓴다.
// 조회는 ticker·카테고리당 1회(병합 행 기준, 쿼리 키 불변), 계산은 계좌별 원본 행으로 computeDividends 1곳.
import { useQueries } from "@tanstack/react-query";
import { useAssetData } from "@/contexts/asset-data-context";
import { normalizeTicker } from "@/lib/finance/finance-service";
import type { DividendPayoutResult } from "@/lib/finance/finance-service";
import { dividendQueryOptions, countFailedDividends } from "@/lib/finance/dividend-client";
import { computeDividends, dividendStockKey, type DividendCalcResult } from "@/lib/finance/dividend-calc";
import { kstTodayString } from "@/lib/asset/import-inherit";
import type { Stock } from "@/types/asset";
import { groupStocksByTickerCategory, mergeStockGroup } from "../detail/asset-detail-tabs";

const DOMESTIC_CATEGORIES = new Set(["domestic", "irp", "isa", "pension"]);

export interface DividendGroup {
  key: string;
  /** 표시용 병합 행(mergeStockGroup) — 계산 입력으로 쓰지 않는다 */
  stock: Stock;
  /** 계좌별 원본 행 */
  items: Stock[];
  payouts: DividendPayoutResult[];
  isLoading: boolean;
}

export interface DividendData {
  groups: DividendGroup[];
  calc: DividendCalcResult;
  isLoading: boolean;
  loadedCount: number;
  failedCount: number;
  totalCount: number;
}

export function useDividendData({ enabled = true }: { enabled?: boolean } = {}): DividendData {
  const { assetData, exchangeRates } = useAssetData();

  // 상장폐지 종목 제외 — 배당 받을 수 없음. 거래정지는 포함 (보유 중)
  const base = assetData.stocks.filter((s) => s.ticker && s.category !== "unlisted" && s.inactiveStatus !== "delisted");
  const grouped = Array.from(groupStocksByTickerCategory(base).values()).map((items) => ({
    key: dividendStockKey(items[0]),
    stock: mergeStockGroup(items),
    items,
  }));

  const queries = useQueries({
    queries: grouped.map(({ stock }) => {
      const ticker = normalizeTicker(stock);
      const type = DOMESTIC_CATEGORIES.has(stock.category) ? "domestic" : "foreign";
      return { ...dividendQueryOptions(ticker, type, "NAS"), enabled };
    }),
  });

  const groups: DividendGroup[] = grouped.map((g, i) => ({
    ...g,
    payouts: Array.isArray(queries[i]?.data) ? (queries[i].data as DividendPayoutResult[]) : [],
    isLoading: !!queries[i]?.isLoading,
  }));

  const calc = computeDividends(
    groups.flatMap((g) => g.items.map((stock) => ({ stock, payouts: g.payouts }))),
    assetData.transactions ?? [],
    exchangeRates.USD,
    kstTodayString(),
  );

  return {
    groups,
    calc,
    isLoading: queries.some((q) => q.isLoading),
    loadedCount: queries.filter((q) => !q.isLoading).length,
    failedCount: countFailedDividends(queries),
    totalCount: queries.length,
  };
}
