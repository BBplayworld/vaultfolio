// 보유 현황 맞추기(#91) — 코인 어댑터. 주식과 같은 5함수(merge·match·diff·apply·undo)를 그대로 쓰기 위해
// 코인을 Stock 모양으로 옮기고 되돌린다(범위 키 = 거래소 × 단일 category, 매칭 키 = 심볼+거래소).
// 순수 함수. 거래 기록(cryptoTransactions)은 건드리지 않는다.
import { cryptoExchanges } from "@/config/asset-options";
import type { Crypto, Stock } from "@/types/asset";
import type { RawScreenItem } from "./types";

/** 코인 범위·계좌 구분이 없으므로 모든 코인은 같은 category를 쓴다(범위 = 거래소) */
export const CRYPTO_CATEGORY: Stock["category"] = "domestic";

/** 화면 글자 → 거래소 목록명(공백 무시 부분 일치). 저장 값은 기존 코인 가져오기처럼 한글 라벨이다 */
export function matchExchangeHint(hint: string): string | undefined {
  const h = hint.replace(/\s/g, "").toLowerCase();
  if (!h) return undefined;
  return cryptoExchanges.find((e) => {
    if (e.value === "other") return false;
    const l = e.label.replace(/\s/g, "").toLowerCase();
    return l.includes(h) || h.includes(l) || e.value === h;
  })?.label;
}

export function cryptoToStock(c: Crypto): Stock {
  return {
    id: c.id,
    category: CRYPTO_CATEGORY,
    name: c.name,
    ticker: c.symbol,
    quantity: c.quantity,
    averagePrice: c.averagePrice,
    currentPrice: c.currentPrice,
    currency: "KRW",
    purchaseDate: c.purchaseDate,
    ...(c.description !== undefined ? { description: c.description } : {}),
    ...(c.baseDate !== undefined ? { baseDate: c.baseDate } : {}),
    ...(c.exchange !== undefined ? { broker: c.exchange } : {}),
    ...(c.positionSource ? { positionSource: c.positionSource } : {}),
    ...(c.positionEffectiveDate ? { positionEffectiveDate: c.positionEffectiveDate } : {}),
  };
}

/** 서버 코인 응답 1건 → 맞추기 입력. 달러 표시 화면은 기존 가져오기처럼 오늘 환율로 원화 환산한다 */
export function parsedCryptoToRaw(
  p: { name: string; symbol: string; quantity: number; averagePrice: number; currentPrice: number; exchange?: string; currency?: string; averagePriceMissing?: boolean },
  usdRate: number,
): RawScreenItem {
  const mul = p.currency === "USD" ? usdRate : 1;
  const r2 = (n: number) => Math.round(n * mul * 100) / 100;
  return {
    name: p.name,
    ticker: p.symbol,
    quantity: p.quantity,
    averagePrice: p.currency === "USD" ? r2(p.averagePrice) : p.averagePrice,
    currentPrice: p.currency === "USD" ? r2(p.currentPrice) : p.currentPrice,
    category: CRYPTO_CATEGORY,
    section: "국내",
    originalCurrency: "KRW",
    brokerHint: p.exchange ?? "",
    quantityMissing: !(p.quantity > 0),
    averagePriceEstimated: !!p.averagePriceMissing,
  };
}

/**
 * applyResync 결과(Stock[])를 코인 배열로 되돌린다. 바뀌지 않은 항목은 원래 객체 그대로,
 * 바뀐 항목은 원래 코인에서 수량·평단·거래소·position 필드만 교체(id·매수일·메모·baseDate 승계), 신규는 새 코인.
 */
export function stocksToCrypto(existing: Crypto[], adapted: Stock[], result: Stock[]): Crypto[] {
  const byId = new Map(existing.map((c) => [c.id, c]));
  const adaptedById = new Map(adapted.map((s) => [s.id, s]));
  return result.map((s) => {
    const orig = byId.get(s.id);
    if (orig) {
      if (adaptedById.get(s.id) === s) return orig;
      return {
        ...orig,
        quantity: s.quantity,
        averagePrice: s.averagePrice,
        ...(s.broker ? { exchange: s.broker } : {}),
        ...(s.positionSource ? { positionSource: s.positionSource } : {}),
        ...(s.positionEffectiveDate ? { positionEffectiveDate: s.positionEffectiveDate } : {}),
      };
    }
    return {
      id: s.id,
      name: s.name,
      symbol: s.ticker ?? "",
      quantity: s.quantity,
      averagePrice: s.averagePrice,
      currentPrice: s.currentPrice,
      purchaseDate: s.purchaseDate,
      description: "",
      ...(s.broker ? { exchange: s.broker } : {}),
      positionSource: "manual" as const,
      positionEffectiveDate: s.positionEffectiveDate,
    };
  });
}
