"use client";

// 배당 조회·계산 공용 훅(#313, 5.157) — 배당 차트·종목 표·성과 허브(성적표 입력)가 같은 값을 쓴다.
// 조회는 ticker·카테고리당 1회(병합 행 기준, 쿼리 키 불변), 계산은 계좌별 원본 행으로 computeDividends 1곳.
import { useQueries } from "@tanstack/react-query";
import { useAssetData } from "@/contexts/asset-data-context";
import { normalizeTicker } from "@/lib/finance/finance-service";
import type { DividendPayoutResult } from "@/lib/finance/finance-service";
import { dividendQueryOptions, countFailedDividends } from "@/lib/finance/dividend-client";
import { computeDividends, dividendStockKey, isDividendExcludedCurrency, type DividendCalcResult } from "@/lib/finance/dividend-calc";
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
  /** 배당 조회에서 뺀 엔화 종목 수(ticker·카테고리 묶음 기준) */
  jpyCount: number;
}

/** 조회 대상 묶음(순수) — 상장폐지·비상장 제외, 거래정지는 포함(보유 중), 엔화는 조회하지 않고 수만 센다 */
export function buildDividendGroups(stocks: readonly Stock[]): { grouped: Omit<DividendGroup, "payouts" | "isLoading">[]; jpyCount: number } {
  const base = stocks.filter((s) => s.ticker && s.category !== "unlisted" && s.inactiveStatus !== "delisted");
  const target = base.filter((s) => !isDividendExcludedCurrency(s));
  const jpyCount = groupStocksByTickerCategory(base.filter(isDividendExcludedCurrency)).size;
  const grouped = Array.from(groupStocksByTickerCategory(target).values()).map((items) => ({
    key: dividendStockKey(items[0]),
    stock: mergeStockGroup(items),
    items,
  }));
  return { grouped, jpyCount };
}

/** stocks를 주면 assetData.stocks 대신 그 행만으로 조회·계산한다(종목 한 장, #317) — 쿼리 옵션·키는 그대로 */
export function useDividendData({ enabled = true, stocks }: { enabled?: boolean; stocks?: readonly Stock[] } = {}): DividendData {
  const { assetData, exchangeRates } = useAssetData();
  const { grouped, jpyCount } = buildDividendGroups(stocks ?? assetData.stocks);

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
    jpyCount,
  };
}
