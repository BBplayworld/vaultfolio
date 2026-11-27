// #347 절세 시뮬·실현손익 엔화 단위 — 저장 환율(100엔당)을 1엔당으로 맞춰 계산한다
import { describe, it, expect } from "vitest";
import { computeForeignRealizedGain, getYearEndTaxSimulation, simulateSelectedForeignSale } from "../tax-utils";
import type { AssetData, Stock } from "@/types/asset";
import type { Transaction } from "@/types/transaction";

const RATES = { USD: 1400, JPY: 950 };

const data = (stocks: Stock[], transactions: Transaction[] = []): AssetData => ({
  realEstate: [], stocks, crypto: [], cash: [], loans: [], yearlyNetAssets: [], transactions,
  cashTransactions: [], loanTransactions: [], cryptoTransactions: [], lastUpdated: "", nickname: "",
} as AssetData);

const jp = (o: Partial<Stock> = {}): Stock => ({
  id: "j1", category: "foreign", name: "도요타", ticker: "7203", quantity: 100, averagePrice: 2000, currentPrice: 2500,
  currency: "JPY", purchaseDate: "2026-01-01", purchaseExchangeRate: 900, ...o,
} as Stock);

const tx = (o: Partial<Transaction>): Transaction => ({
  id: Math.random().toString(36).slice(2), stockId: "j1", ticker: "7203", stockName: "도요타", type: "buy",
  quantity: 100, price: 2000, currency: "JPY", date: "2026-01-10", reflected: true, createdAt: "2026-01-10T00:00:00.000Z", ...o,
} as Transaction);

describe("#347 엔화 단위", () => {
  it("엔화 단일 종목 절세 시뮬 = +575,000 (100주 ¥2,000→¥2,500, 매입 900·현재 950 /100엔)", () => {
    const c = getYearEndTaxSimulation(data([jp()]), 2026, RATES).candidates[0];
    expect(c.unrealizedGainKrw).toBeCloseTo(575_000, 6);
    expect(c.estimated).toBe(false);
  });

  it("엔화 매입환율 없음 → 현재 환율로 추정, 손익 = 순수 가격 차", () => {
    const c = getYearEndTaxSimulation(data([jp({ purchaseExchangeRate: undefined })]), 2026, RATES).candidates[0];
    expect(c.unrealizedGainKrw).toBeCloseTo(100 * 500 * 9.5, 6);
    expect(c.estimated).toBe(true);
  });

  it("선택 매도 시뮬도 같은 단위", () => {
    const r = simulateSelectedForeignSale(data([jp()]), [{ stockId: "j1", quantity: 100 }], 2026, RATES);
    expect(r.combinedGainKrw).toBeCloseTo(575_000, 6);
  });

  it("엔화 실현손익: 체결 환율(100엔당) replay → 1엔당으로 환산", () => {
    const r = computeForeignRealizedGain(data([jp({ quantity: 50 })], [
      tx({ type: "buy", quantity: 100, price: 2000, exchangeRate: 900 }),
      tx({ type: "sell", quantity: 50, price: 2500, exchangeRate: 950, date: "2026-06-10", createdAt: "2026-06-10T00:00:00.000Z" }),
    ]), 2026, RATES)!;
    // 50×2,500×9.5 − 50×2,000×9 = 287,500
    expect(r.gainKrw).toBeCloseTo(287_500, 6);
    expect(r.estimated).toBe(false);
  });

  it("엔화 실현손익: 매수 로그 없음 → 보유 매입환율(100엔당) 폴백도 1엔당", () => {
    const r = computeForeignRealizedGain(data([jp({ quantity: 50 })], [
      tx({ type: "sell", quantity: 50, price: 2500, exchangeRate: 950, date: "2026-06-10" }),
    ]), 2026, RATES)!;
    expect(r.gainKrw).toBeCloseTo(287_500, 6);
    expect(r.estimated).toBe(true);
  });

  it("통제: 달러 종목 값 변화 0", () => {
    const us = { ...jp(), id: "u1", ticker: "AAPL", currency: "USD", quantity: 10, averagePrice: 100, currentPrice: 120, purchaseExchangeRate: 1300 } as Stock;
    const c = getYearEndTaxSimulation(data([us]), 2026, RATES).candidates[0];
    expect(c.unrealizedGainKrw).toBeCloseTo(10 * 120 * 1400 - 10 * 100 * 1300, 6);
  });
});
