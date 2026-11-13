import type { DividendPayoutResult } from "@/lib/finance/finance-service";

// 배당 조회 실패 안내 — 배당 탭·성과 허브 공용 1줄
export const DIVIDEND_FETCH_FAILED_MESSAGE = "일부 종목 배당을 불러오지 못했어요. 다음에 열면 다시 불러올게요";

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
