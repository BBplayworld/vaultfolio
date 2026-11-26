/**
 * price-freshness.ts (#309, 5.155)
 * 시세 신선도 순수 함수 — 복귀 재조회 사전 판정·실패 종목 집계.
 * 저장 키 0: 기존 Stock.baseDate(캐시 칸)·exchangeSyncDate와 메모리 값만 읽는다.
 */
import type { Crypto, Stock } from "@/types/asset";
import { normalizeTicker } from "./finance-service";
import { getEffectiveDateStr, getStockCacheSlot } from "./stock-cache-slot";
import { getCoinCacheSlot } from "./coin-cache-slot";

const KST_MS = 9 * 60 * 60 * 1000;

export interface PriceSlots {
  domestic: string;
  foreign: string;
  coin: string;
  /** 오늘(KST) YYYY-MM-DD */
  today: string;
  /** 환율 유효 날짜(09시 전이면 어제) — 서버 updated_at이 이 값이라 09시 전 동기화도 최신으로 본다 */
  exchangeEffective: string;
}

/** 지금 시각의 캐시 칸들 */
export function currentPriceSlots(): PriceSlots {
  return {
    domestic: getStockCacheSlot("domestic"),
    foreign: getStockCacheSlot("foreign"),
    coin: getCoinCacheSlot(),
    today: new Date(Date.now() + KST_MS).toISOString().split("T")[0],
    exchangeEffective: getEffectiveDateStr("exchange"),
  };
}

/** 이번 세션에서 마지막으로 받기를 시도한 칸(메모리). 같은 칸에서 실패한 종목을 복귀마다 다시 부르지 않게 한다 */
export interface PriceAttempts {
  domestic: string | null;
  foreign: string | null;
  coin: string | null;
  exchange: string | null;
}

export const EMPTY_PRICE_ATTEMPTS: PriceAttempts = { domestic: null, foreign: null, coin: null, exchange: null };

export interface ResyncPlan {
  exchange: boolean;
  stock: boolean;
  coin: boolean;
}

/**
 * 복귀 재조회 사전 판정(호출 전). syncTodayStockPrices의 outdated 판정(티커·칸)과 같은 규칙.
 * 하나도 true가 아니면 어떤 시세 함수도 부르지 않는다(요청 0·abort 0·dataResetVersion 증가 0).
 * 칸이 달라도 이번 세션에 같은 칸으로 이미 시도했으면(응답에서 빠진 종목·서킷) 다시 부르지 않는다.
 */
export function planPriceResync(input: {
  stocks: readonly Stock[];
  crypto: readonly Crypto[];
  exchangeSyncDate: string | null;
  slots: PriceSlots;
  attempts: PriceAttempts;
}): ResyncPlan {
  const { stocks, crypto, exchangeSyncDate, slots, attempts } = input;

  let domesticOutdated = false;
  let foreignOutdated = false;
  for (const s of stocks) {
    if (!normalizeTicker(s)) continue;
    const foreign = s.category === "foreign";
    if (s.baseDate === (foreign ? slots.foreign : slots.domestic)) continue;
    if (foreign) foreignOutdated = true;
    else domesticOutdated = true;
  }
  const stock =
    (domesticOutdated && attempts.domestic !== slots.domestic) ||
    (foreignOutdated && attempts.foreign !== slots.foreign);

  const coinOutdated = crypto.some((c) => !!c.symbol?.trim() && c.baseDate !== slots.coin);
  const coin = coinOutdated && attempts.coin !== slots.coin;

  const exchangeFresh = exchangeSyncDate === slots.today || exchangeSyncDate === slots.exchangeEffective;
  const exchange = !exchangeFresh && attempts.exchange !== slots.today;

  return { exchange, stock, coin };
}

export const hasResyncWork = (p: ResyncPlan): boolean => p.exchange || p.stock || p.coin;

/** 받으려던 티커 중 패치가 만들어지지 않은 티커(정렬). 서킷으로 요청하지 못한 배치도 패치가 없으므로 포함된다 */
export function failedPriceTickers(intended: Iterable<string>, patched: Iterable<string>): string[] {
  const ok = new Set(patched);
  return Array.from(new Set(intended)).filter((t) => !ok.has(t)).sort();
}

/** 표시 대상 종목: 티커 있음·비상장 아님·상장폐지 아님 */
export const isPriceAsOfTarget = (s: Stock): boolean =>
  !!normalizeTicker(s) && s.category !== "unlisted" && s.inactiveStatus !== "delisted";
