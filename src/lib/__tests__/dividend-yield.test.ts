import { describe, it, expect } from "vitest";
import { computeDividendYield as computeYield, stockPageDividendYield, type DividendYieldItem } from "@/lib/finance/dividend-yield";
import { computeDividends } from "@/lib/finance/dividend-calc";
import { computeNewPosition } from "@/lib/trade/trade-utils";
import { getPositionSnapshot } from "@/app/(main)/_components/forms/trade/stock-target-picker";
import { buildDividendGroups } from "@/app/(main)/_components/views/activity/use-dividend-data";
import type { Stock, Transaction } from "@/types/asset";
import type { DividendPayoutResult } from "@/lib/finance/finance-service";

const stock = (o: Partial<Stock>): Stock =>
  ({ id: "s", category: "domestic", name: "t", ticker: "T", quantity: 10, averagePrice: 10_000, currentPrice: 12_000, currency: "KRW", purchaseDate: "2020-01-01", ...o }) as Stock;
const pay = (payoutDate: string, amountPerShare: number): DividendPayoutResult =>
  ({ payoutDate, amountPerShare }) as DividendPayoutResult;

// 분자는 공용 계산(#313) — 오늘 2026-06-30이면 6월 이하 확정 지급은 '지급'(기존 YM "2026-06" 기준과 같은 픽스처 결과)
const YM = "2026-06-30";
type Item = DividendYieldItem & { payouts: DividendPayoutResult[] };
const computeDividendYield = (items: Item[], usdRate: number, mode: "all" | "actual", today: string) =>
  computeYield(items, usdRate, mode, computeDividends(items, [], usdRate, today));

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
      { stock: stock({ id: "a", ticker: "A", averagePrice: 0 }), payouts: [pay("2026-03-15", 9999)] },
      { stock: stock({ id: "b", ticker: "B", currency: "JPY", category: "foreign" }), payouts: [pay("2026-03-15", 9999)] },
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
      { stock: stock({ id: "1", ticker: "U1", currency: "USD", category: "foreign", averagePrice: 187.3, quantity: 3, purchaseExchangeRate: undefined, purchaseDate: "2026-02-10" }), payouts: [pay("2026-03-12", 0.24), pay("2025-12-12", 0.24)] },
      { stock: stock({ id: "2", ticker: "K2", averagePrice: 70_500, quantity: 7 }), payouts: [pay("2026-04-20", 361)] },
      { stock: stock({ id: "3", ticker: "K3", averagePrice: 33_000, quantity: 4 }), payouts: [] },
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

// #371(5.181) 종목 한 장 투입 대비 — 숨김 3조건, 표시면 탭과 같은 함수 값
describe("stockPageDividendYield (#371)", () => {
  const PAY = [pay("2026-03-15", 500), pay("2026-09-15", 500)];
  const run = (stocks: Stock[], txs: Transaction[] = [], usd = 1400, payouts = PAY) => {
    const groups = buildDividendGroups(stocks).grouped.map((g) => ({ ...g, payouts, isLoading: false }));
    const calc = computeDividends(groups.flatMap((g) => g.items.map((s) => ({ stock: s, payouts }))), txs, usd, YM);
    return { r: stockPageDividendYield(groups, txs, usd, calc), tab: computeYield(groups, usd, "all", calc) };
  };
  let seq = 0;
  const tx = (o: Partial<Transaction>): Transaction =>
    ({ id: `t${++seq}`, stockId: "s", ticker: "T", stockName: "t", type: "buy", quantity: 0, price: 10_000, currency: "KRW", date: "2026-01-02", reflected: true, createdAt: "2026-01-01T00:00:00Z", ...o }) as Transaction;
  // 거래를 반영한 뒤의 수량·평단은 실제 쓰기 경로와 같은 computeNewPosition으로 만든다(C162)
  const after = (base: Stock, t: Transaction): Stock => {
    const p = computeNewPosition(getPositionSnapshot(base), t);
    return { ...base, quantity: p.quantity, averagePrice: p.avgPrice, positionSource: "computed" } as Stock;
  };

  it("표시: 수량 기준이 같으면 탭과 같은 함수 값(KRW·USD·국내+ISA)", () => {
    expect(run([stock({})]).r?.text).toBe("10.0%");
    const usd = [stock({ currency: "USD", category: "foreign", averagePrice: 100, quantity: 5 })];
    expect(run(usd, [], 1300, [pay("2026-03-15", 1.5)]).r?.text).toBe(run(usd, [], 1450, [pay("2026-03-15", 1.5)]).r?.text);
    const two = [stock({ id: "a" }), stock({ id: "b", category: "isa", quantity: 30 })];
    const { r, tab } = run(two);
    expect(r).not.toBeNull();
    expect(r).toEqual(tab);
  });
  it("숨김 ①: 올해 매수(첫 지급 뒤 매수일)", () => {
    expect(run([stock({ purchaseDate: "2026-05-01" })]).r).toBeNull();
    // 1월 첫 지급 전에 샀으면 수량이 같아 표시
    expect(run([stock({ purchaseDate: "2026-01-10" })]).r?.text).toBe("10.0%");
  });
  it("숨김 ①: 지급 뒤 추가 매수·일부 매도(반영 거래)", () => {
    const base = stock({});
    const buy = tx({ type: "buy", quantity: 5, date: "2026-04-01" });
    expect(run([after(base, buy)], [buy]).r).toBeNull();
    const sell = tx({ type: "sell", quantity: 4, date: "2026-04-01" });
    expect(run([after(base, sell)], [sell]).r).toBeNull();
    // 기록만(반영 안 함) 거래는 수량을 바꾸지 않으므로 표시
    const memo = tx({ type: "buy", quantity: 5, date: "2026-04-01", reflected: false });
    expect(run([base], [memo]).r?.text).toBe("10.0%");
    // 지급일 뒤에 수량을 직접 덮어쓴 행(manual)은 heldQtyAt이 지금 수량을 쓴다 → 표시
    const manual = { ...after(base, buy), positionSource: "manual", positionEffectiveDate: "2026-10-01" } as Stock;
    expect(run([manual], [buy]).r).not.toBeNull();
  });
  it("숨김 ②: 원본 행 중 평단 0 이하(병합 평단은 양수여도)", () => {
    const rows = [stock({ id: "a" }), stock({ id: "b", broker: "나", averagePrice: 0 })];
    expect(run(rows).tab).not.toBeNull();
    expect(run(rows).r).toBeNull();
  });
  it("숨김 ③: 수량 0·환율 0·분자 0", () => {
    expect(run([stock({ quantity: 0 })]).r).toBeNull();
    expect(run([stock({ currency: "USD", category: "foreign", averagePrice: 100 })], [], 0, [pay("2026-03-15", 1.5)]).r).toBeNull();
    expect(run([stock({})], [], 1400, []).r).toBeNull();
  });
  it("극소값은 탭과 같은 '0.1% 미만'", () => {
    expect(run([stock({ averagePrice: 100_000_000 })]).r?.text).toBe("0.1% 미만");
  });
});
