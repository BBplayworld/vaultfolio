import "server-only";
import {
  fetchKospiDailySeries,
  fetchKrStockDailyCloses,
  fetchOverseasDailyCloses,
  fetchOverseasIndexDailySeries,
  type IndexCloseRow,
} from "@/lib/finance/finance-service";
import type { PushTopic } from "./catalog";
import type { PushMarket } from "./types";

// 시장 알림 시세 조회(#179) — 대상 토픽별 전일 대비율(%). 실패·stale 항목은 결과에서 빠진다(조용한 생략).
// 요청 전체가 구독자와 무관한 공통 계산이라 서버는 구독자의 보유 정보를 쓰지 않는다.

const SERIES_LOOKBACK_DAYS = 12;
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function shiftDate(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** 시리즈 마지막 2행 전일 대비 — 마지막 행 날짜가 그 시장 직전 거래일이 아니면 stale로 null */
export function changeFromSeries(rows: IndexCloseRow[] | null, marketDate: string): number | null {
  if (!rows || rows.length < 2) return null;
  const last = rows[rows.length - 1];
  const prev = rows[rows.length - 2];
  if (last.date !== marketDate || !(prev.price > 0)) return null;
  return ((last.price - prev.price) / prev.price) * 100;
}

/** KIS 호출 수 추정 — 예산 차감용(항목당 1호출) */
export function estimateKisCalls(topics: readonly PushTopic[]): number {
  return topics.length;
}

export interface FetchCtx {
  market: PushMarket;
  marketDate: string; // 그 시장 직전 거래일(YYYY-MM-DD)
  todayStr: string; // KST 오늘
  accessToken: string;
  appKey: string;
  appSecret: string;
}

export async function fetchPushRates(topics: readonly PushTopic[], ctx: FetchCtx): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  const { accessToken: tk, appKey: ak, appSecret: as_, marketDate } = ctx;
  const start = shiftDate(marketDate, -SERIES_LOOKBACK_DAYS);

  let first = true;
  for (const t of topics) {
    const s = t.source;
    if (!first) await sleep(350); // 레이트리밋 방어 — 기존 조회와 같은 간격
    first = false;
    try {
      if (s.kind === "kr-stock") {
        // 일별 종가 행의 날짜로 stale 판정 — 지수와 같은 기준(마지막 행 = 이번 회차 기대 거래일)
        const rate = changeFromSeries(await fetchKrStockDailyCloses(s.code, tk, ak, as_), marketDate);
        if (rate !== null) out[t.id] = rate;
      } else if (s.kind === "kr-index") {
        const rate = changeFromSeries(await fetchKospiDailySeries(start, marketDate, tk, ak, as_, s.code), marketDate);
        if (rate !== null) out[t.id] = rate;
      } else if (s.kind === "us-index") {
        const rate = changeFromSeries(await fetchOverseasIndexDailySeries(s.code, start, marketDate, tk, ak, as_), marketDate);
        if (rate !== null) out[t.id] = rate;
      } else if (s.kind === "us-stock") {
        // 정규장 종가(dailyprice clos) 기준 — 시간외 반영 가능성이 있는 price-detail last는 쓰지 않는다
        const rate = changeFromSeries(await fetchOverseasDailyCloses(s.excd, s.symbol, tk, ak, as_), marketDate);
        if (rate !== null) out[t.id] = rate;
      }
    } catch {
      // 항목 단위 실패는 생략
    }
  }
  return out;
}
