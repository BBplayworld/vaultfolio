// #104 재현: 시세 요청이 도는 동안 사용자가 저장하면, 응답 반영이 그 편집을 되돌리지 않아야 한다.
// 동기화 함수의 반영 단계(응답 -> 패치 -> 저장 시점 최신본에 병합)를 그대로 재현한다.
import { describe, expect, it } from "vitest";
import { applyPricePatches, buildCryptoPricePatches, buildStockPricePatches, cryptoKeyOf, stockKeyOf, type StockQuote } from "../price-patch";
import type { AssetData, Crypto, Stock } from "@/types/asset";

const stock = (id: string, ticker: string, extra: Partial<Stock> = {}): Stock => ({
  id, name: `종목${ticker}`, ticker, category: "domestic", broker: "증권사", quantity: 10, averagePrice: 1000, currentPrice: 1000, currency: "KRW", baseDate: "old", ...extra,
} as Stock);
const coin = (id: string, symbol: string, extra: Partial<Crypto> = {}): Crypto => ({
  id, name: symbol, symbol, quantity: 1, averagePrice: 100, currentPrice: 100, purchaseDate: "2025-01-01", baseDate: "old", ...extra,
} as Crypto);
const base = (o: Partial<AssetData>): AssetData => ({
  realEstate: [], stocks: [], crypto: [], cash: [], loans: [], yearlyNetAssets: [], transactions: [], cashTransactions: [], loanTransactions: [], cryptoTransactions: [],
  lastUpdated: "2026-11-09T00:00:00.000Z", nickname: "", ...o,
});
const SLOTS = { domestic: "2026-11-09", foreign: "2026-11-08" };
const quotes = (o: Record<string, number>): Record<string, StockQuote> =>
  Object.fromEntries(Object.entries(o).map(([k, price]) => [k, { price, updated_at: "2026-11-09T01:00:00Z" }]));

describe("주식 시세 응답 병합 (#104)", () => {
  const A = stock("a", "005930"), B = stock("b", "000660");
  const original = base({ stocks: [A, B], cash: [{ id: "c", type: "bank", name: "통장", balance: 1000, currency: "KRW" }] });

  it("요청 중 현금 잔액 변경 + 종목 추가 + 종목 삭제 -> 편집 유지, 시세는 반영, 삭제 종목은 되살아나지 않음", () => {
    const patches = buildStockPricePatches(original.stocks, quotes({ "005930": 70000, "000660": 150000 }), SLOTS);
    const C = stock("c2", "035420", { currentPrice: 500 });
    // 사용자가 요청 중에 저장한 최신본: 현금 900, B 삭제, C 추가
    const latest = base({ stocks: [A, C], cash: [{ id: "c", type: "bank", name: "통장", balance: 900, currency: "KRW" }] });
    const merged = { ...latest, stocks: applyPricePatches(latest.stocks, patches, stockKeyOf) };
    expect(merged.cash[0].balance).toBe(900);
    expect(merged.stocks.map((s) => s.id)).toEqual(["a", "c2"]);
    expect(merged.stocks[0].currentPrice).toBe(70000);
    expect(merged.stocks[0].baseDate).toBe("2026-11-09");
    expect(merged.stocks[1].currentPrice).toBe(500); // 응답에 없던 새 종목은 그대로
  });

  it("사용자가 요청 중 ticker를 고친 종목은 이전 ticker 시세를 받지 않는다, 다른 필드 편집은 유지", () => {
    const patches = buildStockPricePatches(original.stocks, quotes({ "005930": 70000 }), SLOTS);
    const latest = base({ stocks: [{ ...A, ticker: "999999", quantity: 25 }, B] });
    const out = applyPricePatches(latest.stocks, patches, stockKeyOf);
    expect(out[0].currentPrice).toBe(1000);
    expect(out[0].quantity).toBe(25);
  });

  it("사용자가 수량을 고친 종목은 수량 유지 + 시세만 갱신", () => {
    const patches = buildStockPricePatches(original.stocks, quotes({ "005930": 70000 }), SLOTS);
    const out = applyPricePatches([{ ...A, quantity: 25 }, B], patches, stockKeyOf);
    expect(out[0]).toMatchObject({ quantity: 25, currentPrice: 70000 });
    expect(out[1]).toBe(B);
  });

  it("응답이 비었거나 실패(시세 없음) -> 패치 0, 같은 배열 참조(무변경)", () => {
    const patches = buildStockPricePatches(original.stocks, {}, SLOTS);
    expect(patches).toEqual({});
    const latest = [A, B];
    expect(applyPricePatches(latest, patches, stockKeyOf)).toBe(latest);
  });

  it("거래정지는 가격 유지·상태만 갱신, 상장폐지는 응답 가격(0)으로 덮음", () => {
    const patches = buildStockPricePatches(original.stocks, {
      "005930": { price: 0, updated_at: "t", inactiveStatus: "halted" },
      "000660": { price: 0, updated_at: "t", inactiveStatus: "delisted" },
    }, SLOTS);
    const out = applyPricePatches(original.stocks, patches, stockKeyOf);
    expect(out[0]).toMatchObject({ currentPrice: 1000, inactiveStatus: "halted" });
    expect(out[1]).toMatchObject({ currentPrice: 0, inactiveStatus: "delisted" });
  });
});

describe("코인 시세 응답 병합 (#104)", () => {
  const X = coin("x", "BTC"), Y = coin("y", "ETH");
  it("요청 중 현금 변경·코인 삭제 -> 편집 유지, 삭제 코인 부활 0, 응답에 없는 심볼은 수동값 유지", () => {
    const patches = buildCryptoPricePatches([X, Y], { BTC: { price: 90_000_000 } }, "2026-11-09-H10");
    const latest = base({ crypto: [X], cash: [{ id: "c", type: "bank", name: "통장", balance: 900, currency: "KRW" }] });
    const merged = { ...latest, crypto: applyPricePatches(latest.crypto, patches, cryptoKeyOf) };
    expect(merged.cash[0].balance).toBe(900);
    expect(merged.crypto.map((c) => c.id)).toEqual(["x"]);
    expect(merged.crypto[0]).toMatchObject({ currentPrice: 90_000_000, baseDate: "2026-11-09-H10" });
  });
  it("가격 0 이하·미지원 심볼은 패치 없음", () => {
    expect(buildCryptoPricePatches([X, Y], { BTC: { price: 0 } }, "s")).toEqual({});
  });
});
