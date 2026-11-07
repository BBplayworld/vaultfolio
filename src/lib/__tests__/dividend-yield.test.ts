import { describe, it, expect } from "vitest";
import { computeDividendYield } from "@/lib/finance/dividend-yield";
import type { Stock } from "@/types/asset";
import type { DividendPayoutResult } from "@/lib/finance/finance-service";

const stock = (o: Partial<Stock>): Stock =>
  ({ id: "s", category: "domestic", name: "t", ticker: "T", quantity: 10, averagePrice: 10_000, currentPrice: 12_000, currency: "KRW", purchaseDate: "2020-01-01", ...o }) as Stock;
const pay = (payoutDate: string, amountPerShare: number): DividendPayoutResult =>
  ({ payoutDate, amountPerShare }) as DividendPayoutResult;

const YM = "2026-06";

describe("computeDividendYield (#4.46 #80)", () => {
  it("예상 포함: 지급+예상 / 매입금액", () => {
    const r = computeDividendYield([{ stock: stock({}), payouts: [pay("2026-03-15", 500), pay("2026-09-15", 500)] }], 1400, "all", YM);
    expect(r?.text).toBe("10.0%");
    expect(r?.excluded).toBe(0);
  });
  it("지급만: 예상분 제외, 지급 0이면 null", () => {
    const items = [{ stock: stock({}), payouts: [pay("2026-03-15", 500), pay("2026-09-15", 500)] }];
    expect(computeDividendYield(items, 1400, "actual", YM)?.text).toBe("5.0%");
    expect(computeDividendYield([{ stock: stock({}), payouts: [pay("2026-09-15", 500)] }], 1400, "actual", YM)).toBeNull();
  });
  it("매수일 이전 지급분 제외", () => {
    const r = computeDividendYield([{ stock: stock({ purchaseDate: "2026-05-01" }), payouts: [pay("2026-03-15", 500), pay("2026-09-15", 500)] }], 1400, "all", YM);
    expect(r?.text).toBe("5.0%");
  });
  it("평단 0·JPY는 분자·분모에서 빠지고 제외 수가 맞다", () => {
    const items = [
      { stock: stock({}), payouts: [pay("2026-03-15", 500)] },
      { stock: stock({ id: "a", averagePrice: 0 }), payouts: [pay("2026-03-15", 9999)] },
      { stock: stock({ id: "b", currency: "JPY", category: "foreign" }), payouts: [pay("2026-03-15", 9999)] },
    ];
    const r = computeDividendYield(items, 1400, "all", YM);
    expect(r?.text).toBe("5.0%");
    expect(r?.excluded).toBe(2);
  });
  it("포함 종목 0·분자 0이면 null", () => {
    expect(computeDividendYield([{ stock: stock({ averagePrice: 0 }), payouts: [pay("2026-03-15", 1)] }], 1400, "all", YM)).toBeNull();
    expect(computeDividendYield([{ stock: stock({}), payouts: [] }], 1400, "all", YM)).toBeNull();
  });
  it("USD만 보유하면 환율이 바뀌어도 % 동일", () => {
    const items = [{ stock: stock({ currency: "USD", category: "foreign", averagePrice: 100, quantity: 5 }), payouts: [pay("2026-03-15", 1.5)] }];
    expect(computeDividendYield(items, 1300, "all", YM)?.text).toBe(computeDividendYield(items, 1450, "all", YM)?.text);
    expect(computeDividendYield(items, 1300, "all", YM)?.text).toBe("1.5%");
  });
  it("운영 형태: 추정 평단·매입환율 없음·올해 매수·무배당 종목 포함해도 값이 나온다", () => {
    const items = [
      { stock: stock({ id: "1", currency: "USD", category: "foreign", averagePrice: 187.3, quantity: 3, purchaseExchangeRate: undefined, purchaseDate: "2026-02-10" }), payouts: [pay("2026-03-12", 0.24), pay("2025-12-12", 0.24)] },
      { stock: stock({ id: "2", averagePrice: 70_500, quantity: 7 }), payouts: [pay("2026-04-20", 361)] },
      { stock: stock({ id: "3", averagePrice: 33_000, quantity: 4 }), payouts: [] },
    ];
    const r = computeDividendYield(items, 1380, "all", YM);
    expect(r).not.toBeNull();
    expect(r!.pct).toBeGreaterThan(0);
    expect(r!.text).not.toBe("");
  });
  it("0.1% 미만 표기", () => {
    const r = computeDividendYield([{ stock: stock({ averagePrice: 1_000_000 }), payouts: [pay("2026-03-15", 1)] }], 1400, "all", YM);
    expect(r?.text).toBe("0.1% 미만");
  });
});
