import type { DividendPayoutResult } from "@/lib/finance/finance-service";

// 배당 조회 실패 안내 — 배당 탭·성과 허브 공용 1줄
export const DIVIDEND_FETCH_FAILED_MESSAGE = "일부 종목 배당을 불러오지 못했어요. 앱을 다시 열면 다시 불러올게요";

// 배당 공용 fetch — 429·500(!res.ok)·KIS 불가(X-KIS-Unavailable)는 throw해 react-query가 캐시하지 않게 한다.
// 헤더 없는 200 빈 배열은 '정말 배당 없음'이라 정상 [] 반환.
export async function fetchDividend(ticker: string, type: string, excd = "NAS"): Promise<DividendPayoutResult[]> {
  const params = new URLSearchParams({ ticker, type, excd });
  const res = await fetch(`/api/finance/dividend?${params}`);
  if (!res.ok) throw new Error(`dividend ${res.status}`);
  if (res.headers.get("X-KIS-Unavailable")) throw new Error("dividend kis-unavailable");
  const json = await res.json();
  return Array.isArray(json?.data) ? json.data : [];
}

// 실패한 쿼리 수 (data undefined 안전)
export function countFailedDividends(queries: ReadonlyArray<{ isError: boolean }>): number {
  return queries.filter((q) => q.isError).length;
}

// 배당 쿼리 공용 옵션 — retryOnMount:false 필수.
// 실패(pending 없는 error) 쿼리를 같은 키의 다른 관찰자(월별 종목 등)가 마운트할 때마다 재조회하면
// status가 pending으로 돌아가 로딩 뷰 → 관찰자 언마운트·재마운트 → 재조회가 무한 반복된다(#189 qa FAIL).
export function dividendQueryOptions(ticker: string, type: string, excd = "NAS") {
  return {
    queryKey: ["dividend", "v11", ticker, type] as const,
    queryFn: () => fetchDividend(ticker, type, excd),
    staleTime: 30 * 24 * 60 * 60 * 1000,
    retry: false as const,
    retryOnMount: false as const,
  };
}
