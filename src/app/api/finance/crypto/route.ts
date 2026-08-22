/**
 * /api/finance/crypto
 * 업비트 코인 현재가를 스토리지 어댑터를 통해 제공한다.
 *
 * 주식(/api/finance)과 동일한 3단 흐름이되, 업비트는 여러 페어를 1회 호출로 조회할 수 있어
 * 배치 루프가 없다. 캐시는 마켓 단위(KRW-BTC) 레코드 하나에 slot·값을 함께 저장하므로
 * 같은 코인을 보유한 모든 사용자가 캐시를 공유한다.
 *
 * Rate limit 방어 (업비트 IP 기준 초당 10회 중 20%만 사용):
 *   - 슬롯 캐시 hit → 즉시 반환
 *   - miss + stale 있음 → stale 즉시 반환 + after()로 응답 후 백그라운드 갱신 (사용자 대기 0)
 *   - miss + stale 없음 → 이때만 동기 대기
 *   - 외부 호출은 분산 락으로 직렬화 + 최소 500ms 간격
 */

import { NextResponse, after } from "next/server";
import { getCacheStorage } from "@/lib/cache-storage";
import { getCoinCacheSlot } from "@/lib/finance/coin-cache-slot";
import {
  fetchUpbitKrwMarkets,
  fetchUpbitTickers,
  toUpbitMarket,
  fromUpbitMarket,
  UpbitRateLimitError,
  type CoinPriceResult,
} from "@/lib/finance/upbit-service";

// 업비트 한도(10 req/s)의 20%만 사용 — 서버리스 IP 공유·재시도 여유분 확보
const MIN_CALL_INTERVAL_MS = 500;
const LOCK_TTL_SEC = 5;          // fetch 타임아웃 3초 + 여유 2초
const LOCK_POLL_INTERVAL_MS = 100;
const LOCK_POLL_MAX = 20;        // 최대 2초 대기 후 stale 폴백

const UPBIT_UNAVAILABLE_HEADER = { "X-Upbit-Unavailable": "1" } as const;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// 로컬(FileCacheStorage)은 단일 프로세스라 Redis 락이 없다 →
// 모듈 스코프 in-flight dedup으로 동일 슬롯의 중복 외부 호출을 막는다.
const inFlight = new Map<string, Promise<Record<string, CoinPriceResult>>>();

/** 유효한 원화 마켓 목록 (1일 캐시). 실패 시 null → 검증 생략하고 요청 그대로 진행 */
async function getValidMarkets(): Promise<Set<string> | null> {
  const storage = getCacheStorage();
  const cached = await storage.getUpbitMarkets();
  if (cached) return new Set(cached);
  const fetched = await fetchUpbitKrwMarkets();
  if (!fetched) return null;
  await storage.setUpbitMarkets(fetched);
  return new Set(fetched);
}

/** 외부 호출 — 락으로 직렬화하고 최소 간격을 지킨다. 락 실패 시 캐시 폴링으로 대체 */
async function fetchWithGuard(markets: string[], slot: string): Promise<Record<string, CoinPriceResult>> {
  const storage = getCacheStorage();
  const key = `${slot}:${markets.join(",")}`;

  const existing = inFlight.get(key);
  if (existing) return existing;

  const run = async (): Promise<Record<string, CoinPriceResult>> => {
    const locked = await storage.acquireUpbitLock(LOCK_TTL_SEC);
    if (!locked) {
      // 다른 인스턴스가 조회 중 — 채워질 때까지 짧게 폴링 후 캐시에서 회수
      for (let i = 0; i < LOCK_POLL_MAX; i++) {
        await sleep(LOCK_POLL_INTERVAL_MS);
        const filled: Record<string, CoinPriceResult> = {};
        for (const m of markets) {
          const c = await storage.getCoin(m, slot);
          if (c) filled[m] = c;
        }
        if (Object.keys(filled).length === markets.length) return filled;
      }
      return {};
    }

    try {
      // 최소 호출 간격 보장
      const last = await storage.getUpbitLastCallAt();
      if (last) {
        const elapsed = Date.now() - last;
        if (elapsed < MIN_CALL_INTERVAL_MS) await sleep(MIN_CALL_INTERVAL_MS - elapsed);
      }
      await storage.setUpbitLastCallAt(Date.now());

      const prices = await fetchUpbitTickers(markets);
      for (const [market, result] of Object.entries(prices)) {
        await storage.setCoin(market, slot, result);
      }
      return prices;
    } finally {
      await storage.releaseUpbitLock();
    }
  };

  const promise = run();
  inFlight.set(key, promise);
  try {
    return await promise;
  } finally {
    inFlight.delete(key);
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbols = [...new Set(
    (searchParams.get("symbols")?.split(",").map((s) => s.trim().toUpperCase()) ?? []).filter(Boolean),
  )];
  if (symbols.length === 0) {
    return NextResponse.json({ error: "심볼 없음" }, { status: 400 });
  }

  const storage = getCacheStorage();
  const slot = getCoinCacheSlot();
  const results: Record<string, CoinPriceResult> = {};

  try {
    // 무효 마켓 코드가 섞이면 ticker 요청 전체가 400으로 실패하므로 먼저 걸러낸다
    const valid = await getValidMarkets();
    const targets = symbols
      .map((s) => ({ symbol: s, market: toUpbitMarket(s) }))
      .filter((t) => !valid || valid.has(t.market));

    // 1단계: 슬롯 캐시
    const uncached: string[] = [];
    for (const { symbol, market } of targets) {
      const cached = await storage.getCoin(market, slot);
      if (cached) results[symbol] = cached;
      else uncached.push(market);
    }
    if (uncached.length === 0) return NextResponse.json(results);

    // 2단계: stale이 모두 있으면 즉시 반환하고 갱신은 백그라운드로
    const staleMap: Record<string, CoinPriceResult> = {};
    for (const market of uncached) {
      const stale = await storage.getCoinStale(market);
      if (stale) staleMap[fromUpbitMarket(market)] = stale;
    }
    if (Object.keys(staleMap).length === uncached.length) {
      Object.assign(results, staleMap);
      after(async () => {
        try {
          await fetchWithGuard(uncached, slot);
        } catch { /* 백그라운드 실패는 stale 유지로 흡수 */ }
      });
      return NextResponse.json(results);
    }

    // 3단계: stale도 없는 최초 조회 — 이때만 동기 대기
    const fetched = await fetchWithGuard(uncached, slot);
    for (const [market, result] of Object.entries(fetched)) {
      results[fromUpbitMarket(market)] = result;
    }
    // 일부만 받았으면 남은 것은 stale로 보충
    for (const [symbol, stale] of Object.entries(staleMap)) {
      if (!results[symbol]) results[symbol] = stale;
    }
    return NextResponse.json(results);
  } catch (e) {
    // 429/418 — 재시도하지 않고 확보한 값(캐시·stale)만 반환
    if (e instanceof UpbitRateLimitError) {
      for (const symbol of symbols) {
        if (results[symbol]) continue;
        const stale = await storage.getCoinStale(toUpbitMarket(symbol));
        if (stale) results[symbol] = stale;
      }
      return NextResponse.json(results, { headers: UPBIT_UNAVAILABLE_HEADER });
    }
    console.error("[/api/finance/crypto]", e);
    return NextResponse.json(results, { headers: UPBIT_UNAVAILABLE_HEADER });
  }
}
