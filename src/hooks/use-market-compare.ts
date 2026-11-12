"use client";

// 시장과 비교(#132) 화면·진입 글줄 공용 훅 — 종가 기준 설정, K1 생성 목록, 지수 기준가(react-query 메모리만).
// 같은 queryKey라 비교 페이지와 글줄 2곳이 같은 응답·같은 값을 쓴다(A11). 저장 호출 0.

import { useEffect, useMemo, useState } from "react";
import { useQueries } from "@tanstack/react-query";
import type { MarketIndexResponse } from "@/app/api/finance/market-index/route";
import { COMPARE_PERIODS, loadKospiPeerCodes, type ComparePeriod, type PeriodRefs } from "@/lib/finance/market-compare";
import { getDailyClosingRefDate, type ProfitBasis } from "@/lib/finance/profit-utils";
import { useProfitBasisStore } from "@/stores/profit-basis-store";

const NULL_INDEX: MarketIndexResponse = { KOSPI: null, SPX: null };

// 설정 '기간 수익 종가 기준'(Hero와 같은 기준일, cto Q7)
export function useCompareBasis(): { basis: ProfitBasis; hydrated: boolean } {
  const basis = useProfitBasisStore((s) => s.basis);
  const hydrated = useProfitBasisStore((s) => s.hydrated);
  const hydrate = useProfitBasisStore((s) => s.hydrate);
  useEffect(() => { hydrate(); }, [hydrate]);
  return { basis, hydrated };
}

// 컷오프 경계 자동 재조회용 일별 기준일 토큰 — 1분 tick으로 재렌더만 유도(profit-chart와 같은 방식)
export function useDailyRefToken(): string {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);
  return `${getDailyClosingRefDate("domestic")}_${getDailyClosingRefDate("foreign")}`;
}

// K1 생성 목록(동적 import). 불러오기에 실패하면 빈 목록 → 국내는 전부 '비교하지 않은 종목'(틀린 짝보다 빈 짝)
// enabled=false면 불러오지 않는다(홈: 주식 없는 사용자·첫 저장 당일은 종목 마스터 청크를 건너뜀, 4.90)
export function useKospiPeerCodes(enabled = true): ReadonlySet<string> | null {
  const [peerCodes, setPeerCodes] = useState<ReadonlySet<string> | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    loadKospiPeerCodes()
      .then((s) => { if (alive) setPeerCodes(s); })
      .catch(() => { if (alive) setPeerCodes(new Set()); });
    return () => { alive = false; };
  }, [enabled]);
  return peerCodes;
}

// 지수 기준가 — 실패·한도·점검은 null(= 시장 값 없음)로 받는다
export async function fetchMarketIndex(period: ComparePeriod, basis: ProfitBasis, signal: AbortSignal): Promise<MarketIndexResponse> {
  try {
    const res = await fetch(`/api/finance/market-index?period=${period}&basis=${basis}`, { signal });
    if (!res.ok || res.headers.get("X-KIS-Unavailable") === "1") return NULL_INDEX;
    const data = (await res.json()) as Partial<MarketIndexResponse>;
    return { KOSPI: data.KOSPI ?? null, SPX: data.SPX ?? null };
  } catch (e) {
    if (signal.aborted) throw e;
    return NULL_INDEX;
  }
}

// 기간별 지수 기준가. 1주·1개월·올해는 끝 종가가 일별 ref라 하루도 함께 받는다. 필요 없는 기간은 조회하지 않는다
export function useMarketIndexRefs(
  basis: ProfitBasis,
  enabled: boolean,
  dailyToken: string,
  periods: readonly ComparePeriod[] = COMPARE_PERIODS,
): PeriodRefs<MarketIndexResponse> {
  const queries = useQueries({
    queries: COMPARE_PERIODS.map((period) => ({
      queryKey: ["market-index", period, basis, dailyToken],
      queryFn: ({ signal }: { signal: AbortSignal }) => fetchMarketIndex(period, basis, signal),
      staleTime: 5 * 60 * 1000,
      retry: false,
      enabled: enabled && (period === "daily" || periods.includes(period)),
    })),
  });
  const [daily, weekly, monthly, ytd] = queries.map((q) => q.data);
  return useMemo(() => ({ daily, weekly, monthly, ytd }), [daily, weekly, monthly, ytd]);
}
