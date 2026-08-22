/**
 * upbit-service.ts
 * 업비트 Quotation API 클라이언트 (서버 전용).
 *
 * 업비트 시세 조회는 인증이 필요 없고, 여러 페어를 콤마로 한 번에 조회할 수 있다.
 * 단 **Origin 헤더가 붙으면 10초당 1회로 제한**되므로 브라우저에서 직접 호출하면 안 되고,
 * 반드시 서버에서 프록시해야 한다(이 파일이 그 역할).
 *
 * Rate limit: IP 기준 초당 10회. 실제 호출 빈도 제어는 라우트의 락·최소간격이 담당한다.
 */

import { fetchWithTimeout } from "./finance-service";

const UPBIT_BASE = "https://api.upbit.com/v1";

export interface CoinPriceResult {
  price: number;
  market: string;      // "KRW-BTC"
  updated_at: string;  // ISO
}

/** 업비트가 rate limit으로 차단한 상태 (429/418) */
export class UpbitRateLimitError extends Error {
  constructor(public status: number) {
    super(`업비트 rate limit (${status})`);
  }
}

/** 심볼 → 원화 마켓 코드. "btc" → "KRW-BTC" */
export function toUpbitMarket(symbol: string): string {
  return `KRW-${symbol.trim().toUpperCase()}`;
}

/** 마켓 코드 → 심볼. "KRW-BTC" → "BTC" */
export function fromUpbitMarket(market: string): string {
  return market.startsWith("KRW-") ? market.slice(4) : market;
}

/**
 * 원화 마켓 페어 목록 조회.
 * 무효한 마켓 코드가 하나라도 섞이면 ticker 요청 **전체가 400으로 실패**하므로,
 * 조회 전 이 목록과 교집합을 취해 걸러내는 용도.
 */
export async function fetchUpbitKrwMarkets(): Promise<string[] | null> {
  try {
    const res = await fetchWithTimeout(`${UPBIT_BASE}/market/all`, { cache: "no-store" });
    if (res.status === 429 || res.status === 418) throw new UpbitRateLimitError(res.status);
    if (!res.ok) return null;
    const data = (await res.json()) as { market?: string }[];
    if (!Array.isArray(data)) return null;
    return data
      .map((m) => m.market)
      .filter((m): m is string => typeof m === "string" && m.startsWith("KRW-"));
  } catch (e) {
    if (e instanceof UpbitRateLimitError) throw e;
    return null;
  }
}

/**
 * 현재가 조회 — 여러 마켓을 1회 호출로 처리.
 * 응답의 trade_price가 현재가. (prev_closing_price·signed_change_rate는 이번 범위 밖)
 */
export async function fetchUpbitTickers(markets: string[]): Promise<Record<string, CoinPriceResult>> {
  if (markets.length === 0) return {};
  const out: Record<string, CoinPriceResult> = {};
  try {
    const res = await fetchWithTimeout(
      `${UPBIT_BASE}/ticker?markets=${encodeURIComponent(markets.join(","))}`,
      { cache: "no-store" },
    );
    if (res.status === 429 || res.status === 418) throw new UpbitRateLimitError(res.status);
    if (!res.ok) return out;
    const data = (await res.json()) as { market?: string; trade_price?: number }[];
    if (!Array.isArray(data)) return out;
    const now = new Date().toISOString();
    for (const item of data) {
      if (!item?.market || typeof item.trade_price !== "number" || item.trade_price <= 0) continue;
      out[item.market] = { price: item.trade_price, market: item.market, updated_at: now };
    }
    return out;
  } catch (e) {
    if (e instanceof UpbitRateLimitError) throw e;
    return out;
  }
}
