// 시세 동기화 응답 반영(#104): 응답은 시작 시점 스냅샷이 아니라 "저장 시점의 최신 목록"에 시세 필드만 병합한다.
// 시작 시점 data를 통째로 되쓰면, 요청이 도는 동안 사용자가 저장한 편집(현금 잔액·종목 추가/삭제)이 사라진다.
import { normalizeTicker, resolveStockName } from "@/lib/finance/finance-service";
import type { Crypto, Stock } from "@/types/asset";

export interface PricePatch<T> {
  /** 패치를 만들 때의 종목 키(주식=정규화 ticker, 코인=대문자 심볼). 최신 항목의 키가 다르면(편집됨) 적용하지 않는다 */
  key: string;
  fields: Partial<T>;
}

export interface StockQuote {
  price?: number;
  updated_at?: string;
  name?: string;
  inactiveStatus?: "delisted" | "halted";
  inactiveReason?: string;
}

/** 주식 응답 -> id별 시세 필드 패치. 시세가 없는 종목은 패치 없음 */
export function buildStockPricePatches(
  stocks: Stock[],
  quotes: Record<string, StockQuote | undefined>,
  slots: { domestic: string; foreign: string },
): Record<string, PricePatch<Stock>> {
  const patches: Record<string, PricePatch<Stock>> = {};
  for (const stock of stocks) {
    const key = normalizeTicker(stock);
    const result = key ? quotes[key] : undefined;
    if (result?.price === undefined || !result.updated_at) continue;
    // 거래정지(halted): 기존 currentPrice 유지, 상장폐지(delisted): API가 준 0으로 덮어쓰기, 활성 회복: inactiveStatus undefined로 리셋
    const isHalted = result.inactiveStatus === "halted";
    patches[stock.id] = {
      key,
      fields: {
        currentPrice: isHalted ? stock.currentPrice : result.price,
        baseDate: stock.category === "foreign" ? slots.foreign : slots.domestic,
        name: resolveStockName(stock.category, result.name ?? "", stock.name),
        inactiveStatus: result.inactiveStatus,
        inactiveReason: result.inactiveReason,
        inactiveCheckedAt: result.updated_at,
      },
    };
  }
  return patches;
}

/** 코인 응답 -> id별 패치. 응답에 없는 심볼은 수동 입력값 유지 */
export function buildCryptoPricePatches(
  crypto: Crypto[],
  priceMap: Record<string, { price?: number } | undefined>,
  slot: string,
): Record<string, PricePatch<Crypto>> {
  const patches: Record<string, PricePatch<Crypto>> = {};
  for (const c of crypto) {
    const key = c.symbol?.trim().toUpperCase();
    const price = key ? priceMap[key]?.price : undefined;
    if (!key || typeof price !== "number" || price <= 0) continue;
    patches[c.id] = { key, fields: { currentPrice: price, baseDate: slot } };
  }
  return patches;
}

/**
 * 최신 목록에 패치를 id로 적용. 목록에 없는 id(삭제됨)는 되살리지 않고, 키가 달라진 항목(사용자가 ticker·심볼을 고침)은 건너뛴다.
 * 적용할 게 없으면 같은 배열 참조를 돌려준다.
 */
export function applyPricePatches<T extends { id: string }>(
  latest: T[],
  patches: Record<string, PricePatch<T>>,
  keyOf: (item: T) => string,
): T[] {
  let changed = false;
  const next = latest.map((item) => {
    const p = patches[item.id];
    if (!p || keyOf(item) !== p.key) return item;
    changed = true;
    return { ...item, ...p.fields };
  });
  return changed ? next : latest;
}

export const stockKeyOf = (s: Stock): string => normalizeTicker(s);
export const cryptoKeyOf = (c: Crypto): string => c.symbol?.trim().toUpperCase() ?? "";
