import "server-only";
import {
  fetchFxKrwDailySeries,
  fetchKospiDailySeries,
  fetchOverseasIndexDailySeries,
  type IndexCloseRow,
} from "@/lib/finance/finance-service";

// 시장 알림 시세 조회(#179, 4.91 v3) — 지수 4개(S&P 500·나스닥 종합·코스피·코스닥)와 원/달러 일봉.
// 모든 항목은 같은 날짜 검증(changeFromSeries: 마지막 행 날짜 = 기대 거래일)을 통과해야 한다. 실패·stale은 그 항목만 생략(조용한 생략 + 로그).
// 구독자와 무관한 공통 계산 — 서버는 구독자의 보유 정보를 쓰지 않는다.

const SERIES_LOOKBACK_DAYS = 12;
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export type QuoteKind = "index" | "fx";
export interface PushQuote {
  label: string;
  kind: QuoteKind;
  rate: number; // 전일 대비 %
  price: number; // 마지막 종가(환율 표시용)
}

/** 항목별 결과 — 운영 확인(C96)용. ok·stale(날짜 불일치)·fail(조회 실패) */
export type QuoteStatus = "ok" | "stale" | "fail";

export function shiftDate(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** 시리즈 마지막 2행 전일 대비 — 마지막 행 날짜가 기대 거래일이 아니면 stale로 null */
export function changeFromSeries(rows: IndexCloseRow[] | null, marketDate: string): { rate: number; price: number } | null {
  if (!rows || rows.length < 2) return null;
  const last = rows[rows.length - 1];
  const prev = rows[rows.length - 2];
  if (last.date !== marketDate || !(prev.price > 0)) return null;
  return { rate: ((last.price - prev.price) / prev.price) * 100, price: last.price };
}

export interface QuoteCtx {
  accessToken: string;
  appKey: string;
  appSecret: string;
}

export interface QuoteSegment {
  quotes: PushQuote[];
  status: Record<string, QuoteStatus>;
}

type Target = { id: string; label: string; kind: QuoteKind; load: (start: string, end: string, c: QuoteCtx) => Promise<IndexCloseRow[] | null> };

const US_TARGETS: Target[] = [
  { id: "spx", label: "S&P 500", kind: "index", load: (s, e, c) => fetchOverseasIndexDailySeries("SPX", s, e, c.accessToken, c.appKey, c.appSecret) },
  { id: "comp", label: "나스닥", kind: "index", load: (s, e, c) => fetchOverseasIndexDailySeries("COMP", s, e, c.accessToken, c.appKey, c.appSecret) },
];
const KR_TARGETS: Target[] = [
  { id: "kospi", label: "코스피", kind: "index", load: (s, e, c) => fetchKospiDailySeries(s, e, c.accessToken, c.appKey, c.appSecret, "0001") },
  { id: "kosdaq", label: "코스닥", kind: "index", load: (s, e, c) => fetchKospiDailySeries(s, e, c.accessToken, c.appKey, c.appSecret, "1001") },
  { id: "fx", label: "환율", kind: "fx", load: (s, e, c) => fetchFxKrwDailySeries(s, e, c.accessToken, c.appKey, c.appSecret) },
];

async function fetchTargets(targets: Target[], expectedDate: string, ctx: QuoteCtx, withSleep: { first: boolean }): Promise<QuoteSegment> {
  const out: QuoteSegment = { quotes: [], status: {} };
  const start = shiftDate(expectedDate, -SERIES_LOOKBACK_DAYS);
  for (const t of targets) {
    if (!withSleep.first) await sleep(350); // 레이트리밋 방어 — 기존 조회와 같은 간격
    withSleep.first = false;
    try {
      const rows = await t.load(start, expectedDate, ctx);
      const c = changeFromSeries(rows, expectedDate);
      out.status[t.id] = rows === null ? "fail" : c ? "ok" : "stale";
      if (c) out.quotes.push({ label: t.label, kind: t.kind, rate: c.rate, price: c.price });
    } catch {
      out.status[t.id] = "fail";
    }
  }
  return out;
}

/** 미국 구간(S&P 500·나스닥) — expectedDate = 직전 미국 거래일 */
export function fetchUsQuotes(expectedDate: string, ctx: QuoteCtx, first = { first: true }): Promise<QuoteSegment> {
  return fetchTargets(US_TARGETS, expectedDate, ctx, first);
}

/** 국내 구간(코스피·코스닥·환율) — expectedDate = 그 회차 기대 국내 거래일. 환율은 날짜 검증 통과 시에만 포함 */
export function fetchKrQuotes(expectedDate: string, ctx: QuoteCtx, first = { first: true }): Promise<QuoteSegment> {
  return fetchTargets(KR_TARGETS, expectedDate, ctx, first);
}

/** KIS 호출 수 추정 — 예산 차감용(항목당 1호출) */
export const estimateKisCalls = (us: boolean, kr: boolean): number => (us ? US_TARGETS.length : 0) + (kr ? KR_TARGETS.length : 0);
