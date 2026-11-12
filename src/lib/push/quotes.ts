import "server-only";
import {
  fetchExchangeRateFromKis,
  fetchKospiDailySeries,
  fetchOverseasChangeRate,
  fetchOverseasIndexDailySeries,
  fetchStocksFromKorea,
  type IndexCloseRow,
} from "@/lib/finance/finance-service";
import { getCacheStorage } from "@/lib/cache-storage";
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

/** KIS 호출 수 추정 — 예산 차감용 */
export function estimateKisCalls(topics: readonly PushTopic[]): number {
  return topics.reduce((n, t) => n + (t.source.kind === "fx" ? 2 : 1), 0);
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

  // 국내 종목·ETF는 한 번에(내부 350ms 간격)
  const krStocks = topics.filter((t) => t.source.kind === "kr-stock");
  if (krStocks.length > 0) {
    const codes = krStocks.map((t) => (t.source as { code: string }).code);
    const { prices } = await fetchStocksFromKorea(codes, ctx.todayStr, tk, ak, as_);
    for (const t of krStocks) {
      const r = prices[(t.source as { code: string }).code]?.changeRate;
      if (typeof r === "number" && Number.isFinite(r)) out[t.id] = r;
    }
  }

  let first = true;
  for (const t of topics) {
    const s = t.source;
    if (s.kind === "kr-stock") continue;
    if (!first) await sleep(350); // 레이트리밋 방어 — 기존 조회와 같은 간격
    first = false;
    try {
      if (s.kind === "kr-index") {
        const rate = changeFromSeries(await fetchKospiDailySeries(start, marketDate, tk, ak, as_, s.code), marketDate);
        if (rate !== null) out[t.id] = rate;
      } else if (s.kind === "us-index") {
        const rate = changeFromSeries(await fetchOverseasIndexDailySeries(s.code, start, marketDate, tk, ak, as_), marketDate);
        if (rate !== null) out[t.id] = rate;
      } else if (s.kind === "us-stock") {
        const rate = await fetchOverseasChangeRate(s.excd, s.symbol, tk, ak, as_);
        if (rate !== null) out[t.id] = rate;
      } else if (s.kind === "fx") {
        // 현재값은 KIS, 전일 값은 기존 환율 이력(일자별 USD) — 이력이 없으면 항목 생략
        const cur = await fetchExchangeRateFromKis(tk, ak, as_, ctx.todayStr);
        const history = await getCacheStorage().getExchangeHistory();
        const prevDate = Object.keys(history).filter((d) => d < ctx.todayStr).sort().pop();
        const prev = prevDate ? history[prevDate]?.USD : 0;
        if (cur && cur.USD > 0 && prev > 0) out[t.id] = ((cur.USD - prev) / prev) * 100;
      }
    } catch {
      // 항목 단위 실패는 생략
    }
  }
  return out;
}
