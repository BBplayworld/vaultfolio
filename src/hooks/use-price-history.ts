"use client";

// 종목 한 장(#157) 가격 흐름 조회 — react-query 메모리만(저장 0). 요청 값은 ticker·range 둘뿐.
import { useQuery } from "@tanstack/react-query";
import type { PriceHistory, PriceRange } from "@/lib/finance/price-history";

export function buildPriceHistoryUrl(ticker: string, range: PriceRange): string {
  const qs = new URLSearchParams({ ticker, range });
  return `/api/finance/price-history?${qs.toString()}`;
}

export async function requestPriceHistory(ticker: string, range: PriceRange, signal?: AbortSignal): Promise<PriceHistory> {
  const res = await fetch(buildPriceHistoryUrl(ticker, range), { signal });
  if (!res.ok) throw new Error(`price-history ${res.status}`);
  const data = (await res.json()) as Partial<PriceHistory>;
  return {
    ticker,
    range,
    currency: data.currency === "USD" ? "USD" : "KRW",
    interval: data.interval === "W" ? "W" : "D",
    from: data.from,
    points: Array.isArray(data.points) ? data.points : [],
    listedFrom: data.listedFrom,
  };
}

// 행(상세·주식 펼침)에서는 실패한 티커가 접었다 펼 때마다 다시 요청되면 시세 서킷에 실패가 쌓이므로 retryOnMount:false(4.83 C2).
// 종목 한 장은 `다시 시도` 버튼의 명시적 refetch가 있어 기본값(true)을 그대로 쓴다
export interface PriceHistoryOptions {
  retryOnMount?: boolean;
}

export function priceHistoryQueryOptions(ticker: string, range: PriceRange, enabled: boolean, opts: PriceHistoryOptions = {}) {
  return {
    queryKey: ["price-history", ticker, range] as const,
    queryFn: ({ signal }: { signal: AbortSignal }) => requestPriceHistory(ticker, range, signal),
    enabled: enabled && !!ticker,
    staleTime: 30 * 60 * 1000,
    retry: false,
    ...(opts.retryOnMount === undefined ? {} : { retryOnMount: opts.retryOnMount }),
  };
}

// enabled=false면 요청 0(비상장·티커 없음·상장폐지, 5년 탭을 열기 전)
export function usePriceHistory(ticker: string, range: PriceRange, enabled: boolean, opts?: PriceHistoryOptions) {
  return useQuery(priceHistoryQueryOptions(ticker, range, enabled, opts));
}
