// #313(5.157) 배당 공용 계산 — tech-review §6 1~10 + spec 9-1 경계 3건(당일 매수·당일 매도·매수일 = 지급일)
import { describe, expect, it } from "vitest";
import { computeDividends, heldQtyAt, isDividendPaid, monthSums, roundedAnnual, dividendStockKey, nextDividendMonth } from "../dividend-calc";
import { computeDividendYield } from "../dividend-yield";
import { groupStocksByTickerCategory, mergeStockGroup } from "@/app/(main)/_components/views/detail/asset-detail-tabs";
import type { Stock, Transaction } from "@/types/asset";
import type { DividendPayoutResult } from "../finance-service";
import { applyResync, computeDiff, defaultRemoveIds, mergeScreens, resolveScreens } from "@/lib/asset/resync";
import type { RawScreenItem } from "@/lib/asset/resync/types";
import { emptySel, row as rrow, screen, st as rst } from "@/lib/asset/resync/__tests__/fixtures";
import { computeNewPosition } from "@/lib/trade/trade-utils";
import { getPositionSnapshot } from "@/app/(main)/_components/forms/trade/stock-target-picker";

const TODAY = "2026-11-26";

const stock = (o: Partial<Stock>): Stock =>
  ({ id: "A", category: "domestic", name: "삼성", ticker: "005930", quantity: 100, averagePrice: 50_000, currentPrice: 60_000, currency: "KRW", purchaseDate: "2026-01-02", ...o }) as Stock;
let seq = 0;
const tx = (o: Partial<Transaction>): Transaction =>
  ({ id: `tx${++seq}`, stockId: "A", ticker: "005930", stockName: "삼성", type: "buy", quantity: 0, price: 50_000, currency: "KRW", date: "2026-01-02", reflected: true, createdAt: `2026-01-01T00:00:0${seq % 10}Z`, ...o }) as Transaction;
const pay = (payoutDate: string, amountPerShare: number, o: Partial<DividendPayoutResult> = {}): DividendPayoutResult =>
  ({ payoutDate, amountPerShare, ...o }) as DividendPayoutResult;

// 분기 배당 3·6·9월 확정 + 12월 추정(전년도 패턴)
const QUARTERLY = [pay("2026-03-15", 100), pay("2026-06-15", 100), pay("2026-09-15", 100), pay("2026-12-15", 100, { isEstimated: true })];

const total = (rows: { stock: Stock; payouts: DividendPayoutResult[] }[], txs: Transaction[] = [], usd = 1400, today = TODAY) =>
  computeDividends(rows, txs, usd, today);

// 수정 전(5.156까지) 계산 — 병합 행 × 지금 수량, 지급은 연-월 비교. 실패 재현용으로만 둔다
function legacyAnnual(stocks: Stock[], payouts: DividendPayoutResult[], today: string): { paid: number; total: number } {
  const merged = Array.from(groupStocksByTickerCategory(stocks).values()).map(mergeStockGroup);
  let paid = 0;
  let sum = 0;
  for (const s of merged) for (const p of payouts) {
    if (s.purchaseDate && p.payoutDate < s.purchaseDate) continue;
    const amt = p.amountPerShare * s.quantity;
    if (p.payoutDate.slice(0, 7) <= today.slice(0, 7)) paid += amt;
    sum += amt;
  }
  return { paid, total: sum };
}

describe("1. 여러 계좌 — 계좌별 행을 먼저 계산한 뒤 합친다", () => {
  const a = stock({ id: "A", quantity: 100, purchaseDate: "2026-01-02", broker: "가" });
  const b = stock({ id: "B", quantity: 50, purchaseDate: "2026-07-01", broker: "나" });
  const r = total([{ stock: a, payouts: QUARTERLY }, { stock: b, payouts: QUARTERLY }]);

  it("3·6월은 A만, 9·12월은 A+B", () => {
    const e = r.byStock.get(dividendStockKey(a))!;
    expect(e.perMonth.paid[2]).toBe(100 * 100);
    expect(e.perMonth.paid[5]).toBe(100 * 100);
    expect(e.perMonth.paid[8]).toBe(150 * 100);
    expect(e.perMonth.expected[11]).toBe(150 * 100);
    expect(r.annual.total).toBe(10_000 + 10_000 + 15_000 + 15_000);
  });

  it("수정 전 재현: 병합(150주 × 전 지급)은 값이 크다", () => {
    const legacy = legacyAnnual([a, b], QUARTERLY, TODAY);
    expect(legacy.total).toBe(150 * 100 * 4);
    expect(r.annual.total).toBeLessThan(legacy.total);
  });
});

describe("2·3·4. 지급일 시점 수량 역산", () => {
  it("2. 중간 매수: 1월 100주 + 5월 100주 → 3월 100주, 6월 200주", () => {
    const s = stock({ quantity: 200 });
    const txs = [tx({ type: "buy", quantity: 100, date: "2026-01-02" }), tx({ type: "buy", quantity: 100, date: "2026-05-10" })];
    expect(heldQtyAt(s, txs, "2026-03-15")).toEqual({ qty: 100, qtyUsed: "derived" });
    expect(heldQtyAt(s, txs, "2026-06-15")).toEqual({ qty: 200, qtyUsed: "derived" });
    const r = total([{ stock: s, payouts: QUARTERLY }], txs);
    expect(r.annual.paid).toBe(100 * 100 + 200 * 100 + 200 * 100);
    // 수정 전 재현: 지금 수량(200) × 3월까지 포함
    expect(legacyAnnual([s], QUARTERLY, TODAY).paid).toBe(200 * 100 * 3);
    expect(r.annual.paid).not.toBe(legacyAnnual([s], QUARTERLY, TODAY).paid);
  });

  it("3. 매도 후: 200주 → 7월 80주 매도(현재 120) → 6월 200주, 9월 120주", () => {
    const s = stock({ quantity: 120 });
    const txs = [tx({ type: "sell", quantity: 80, date: "2026-07-20" })];
    expect(heldQtyAt(s, txs, "2026-06-15").qty).toBe(200);
    expect(heldQtyAt(s, txs, "2026-09-15").qty).toBe(120);
  });

  it("4. 전량 매도 후 재매수: 0주 시점 지급은 0원(폴백 아님)", () => {
    // 1월 100주 → 4월 100주 전량 매도 → 8월 50주 재매수(현재 50)
    const s = stock({ quantity: 50 });
    const txs = [tx({ type: "buy", quantity: 100, date: "2026-01-02" }), tx({ type: "sell", quantity: 100, date: "2026-04-01" }), tx({ type: "buy", quantity: 50, date: "2026-08-01" })];
    expect(heldQtyAt(s, txs, "2026-03-15")).toEqual({ qty: 100, qtyUsed: "derived" });
    expect(heldQtyAt(s, txs, "2026-06-15")).toEqual({ qty: 0, qtyUsed: "derived" });
    expect(heldQtyAt(s, txs, "2026-09-15")).toEqual({ qty: 50, qtyUsed: "derived" });
    const r = total([{ stock: s, payouts: QUARTERLY }], txs);
    const e = r.byStock.get(dividendStockKey(s))!;
    expect(e.perMonth.paid[5]).toBe(0);
    expect(e.monthState[5]).toBe("inactive");
    expect(e.qtyUsed).toBe("derived");
  });

  it("4. 지급일 당일 매수는 넣지 않는다(당일 거래 = 지급일 뒤)", () => {
    const s = stock({ quantity: 150 });
    const txs = [tx({ type: "buy", quantity: 100, date: "2026-01-02" }), tx({ type: "buy", quantity: 50, date: "2026-06-15" })];
    expect(heldQtyAt(s, txs, "2026-06-15").qty).toBe(100);
  });

  it("4. 지급일 당일 매도는 넣는다", () => {
    const s = stock({ quantity: 70 });
    const txs = [tx({ type: "buy", quantity: 100, date: "2026-01-02" }), tx({ type: "sell", quantity: 30, date: "2026-06-15" })];
    expect(heldQtyAt(s, txs, "2026-06-15").qty).toBe(100);
  });

  it("매수일 = 지급일이면 그 행은 0원(거래 기록 없는 행)", () => {
    const s = stock({ purchaseDate: "2026-06-15" });
    expect(heldQtyAt(s, [], "2026-06-15").qty).toBe(0);
    expect(heldQtyAt(s, [], "2026-06-16").qty).toBe(100);
    const r = total([{ stock: s, payouts: QUARTERLY }]);
    expect(r.byStock.get(dividendStockKey(s))!.perMonth.paid[5]).toBe(0);
  });

  it("소수 수량 누적 오차로 음수 폴백이 걸리지 않는다", () => {
    const s = stock({ quantity: 0.3, currency: "USD", category: "foreign", ticker: "AAPL" });
    const txs = [tx({ type: "buy", quantity: 0.1, date: "2026-05-01" }), tx({ type: "buy", quantity: 0.2, date: "2026-07-01" })];
    expect(heldQtyAt(s, txs, "2026-03-15")).toEqual({ qty: 0, qtyUsed: "derived" });
  });
});

describe("5. 지금 수량 폴백", () => {
  it("거래 0건 → 지금 수량 + 매수일 규칙", () => {
    expect(heldQtyAt(stock({ quantity: 100 }), [], "2026-03-15")).toEqual({ qty: 100, qtyUsed: "current" });
  });
  it("역산 결과 음수 → 지금 수량", () => {
    const s = stock({ quantity: 10 });
    expect(heldQtyAt(s, [tx({ type: "buy", quantity: 30, date: "2026-05-01" })], "2026-03-15")).toEqual({ qty: 10, qtyUsed: "current" });
  });
  it("NaN → 지금 수량", () => {
    const s = stock({ quantity: 10 });
    expect(heldQtyAt(s, [tx({ type: "buy", quantity: Number.NaN, date: "2026-05-01" })], "2026-03-15")).toEqual({ qty: 10, qtyUsed: "current" });
  });
  it("미반영(reflected:false) 거래는 무시", () => {
    const s = stock({ quantity: 100 });
    expect(heldQtyAt(s, [tx({ type: "buy", quantity: 50, date: "2026-05-01", reflected: false })], "2026-03-15")).toEqual({ qty: 100, qtyUsed: "current" });
  });
  it("다른 행(stockId) 거래는 무시", () => {
    const s = stock({ quantity: 100 });
    expect(heldQtyAt(s, [tx({ stockId: "B", type: "buy", quantity: 50, date: "2026-05-01" })], "2026-03-15").qty).toBe(100);
  });
  it("positionSource manual + 지급일 뒤 덮어쓰기 → 지금 수량", () => {
    const s = stock({ quantity: 100, positionSource: "manual", positionEffectiveDate: "2026-08-01" });
    const txs = [tx({ type: "buy", quantity: 50, date: "2026-05-01" })];
    expect(heldQtyAt(s, txs, "2026-03-15")).toEqual({ qty: 100, qtyUsed: "current" });
    // 덮어쓰기가 지급일 이전이면 역산한다
    expect(heldQtyAt({ ...s, positionEffectiveDate: "2026-02-01" }, txs, "2026-03-15")).toEqual({ qty: 50, qtyUsed: "derived" });
  });
});

describe("6. 지급/예상 판정은 날짜 기준", () => {
  it("today=11-26: 11-15 추정 → 예상, 11-30 확정 → 예상(미래), 11-20 확정 → 지급", () => {
    expect(isDividendPaid(pay("2026-11-15", 1, { isEstimated: true }), TODAY)).toBe(false);
    expect(isDividendPaid(pay("2026-11-30", 1, { isEstimated: false }), TODAY)).toBe(false);
    expect(isDividendPaid(pay("2026-11-20", 1, { isEstimated: false }), TODAY)).toBe(true);
    expect(isDividendPaid(pay("2026-11-26", 1), TODAY)).toBe(true);
  });
  it("같은 달 지급·예상이 섞이면 월 합계에 둘 다 남는다(연-월 판정 아님)", () => {
    const s = stock({ purchaseDate: "2025-01-01" });
    const r = total([{ stock: s, payouts: [pay("2026-11-05", 10), pay("2026-11-15", 20, { isEstimated: true }), pay("2026-11-30", 30)] }]);
    const nov = monthSums(r)[10];
    expect(nov).toEqual({ paid: 1_000, expected: 5_000 });
    const e = r.byStock.get(dividendStockKey(s))!;
    expect(e.monthState[10]).toBe("expected");
    // 수정 전 재현: 연-월 판정은 11월 전부를 '지급'으로 본다
    expect(legacyAnnual([s], [pay("2026-11-05", 10), pay("2026-11-15", 20), pay("2026-11-30", 30)], TODAY).paid).toBe(6_000);
  });
});

describe("7. 차트·표·허브·투입 대비 배당이 같은 값", () => {
  const a = stock({ id: "A", quantity: 100, purchaseDate: "2026-01-02" });
  const b = stock({ id: "B", quantity: 50, purchaseDate: "2026-07-01" });
  const u = stock({ id: "U", ticker: "AAPL", category: "foreign", currency: "USD", quantity: 3.3, averagePrice: 180, purchaseDate: "2026-02-01" });
  const uPay = [pay("2026-02-12", 0.26, { amountForeign: 0.26 }), pay("2026-05-12", 0.26, { amountForeign: 0.26 }), pay("2026-08-12", 0.26), pay("2026-11-12", 0.27, { isEstimated: true })];
  const txs = [tx({ stockId: "U", type: "buy", quantity: 1.1, date: "2026-06-01" })];
  const rows = [{ stock: a, payouts: QUARTERLY }, { stock: b, payouts: QUARTERLY }, { stock: u, payouts: uPay }];
  const r = total(rows, txs, 1387.5);

  it("월 합 = 종목 합 = 연 합 (반올림 전), 반올림 후 문자열 동일", () => {
    const monthTotal = monthSums(r).reduce((s, m) => s + m.paid + m.expected, 0);
    const stockTotal = [...r.byStock.values()].reduce((s, e) => s + e.paid + e.expected, 0);
    expect(monthTotal).toBeCloseTo(r.annual.total, 8);
    expect(stockTotal).toBeCloseTo(r.annual.total, 8);
    expect(Math.round(monthTotal)).toBe(Math.round(r.annual.total));
    expect(Math.round(stockTotal)).toBe(Math.round(r.annual.total));
    expect(r.annual.paid + r.annual.expected).toBeCloseTo(r.annual.total, 8);
  });

  it("투입 대비 배당 분자 = 공용 계산 연 합", () => {
    const merged = Array.from(groupStocksByTickerCategory([a, b, u]).values()).map((items) => ({ stock: mergeStockGroup(items) }));
    const y = computeDividendYield(merged, 1387.5, "all", r)!;
    const denom = 50_000 * 150 + 180 * 3.3 * 1387.5;
    expect(y.pct).toBe(Math.round((r.annual.total / denom) * 1000) / 10);
    const yPaid = computeDividendYield(merged, 1387.5, "actual", r)!;
    expect(yPaid.pct).toBe(Math.round((r.annual.paid / denom) * 1000) / 10);
  });
});

describe("8·9. 불리기 정의 불변·엔화·환율·반올림", () => {
  it("8. annualAtHeldQty 정의(지금 수량 × 올해 전체 지급, 매수일 무관)는 공용 계산과 다르다", () => {
    const s = stock({ quantity: 100, purchaseDate: "2026-07-01" });
    const atHeld = QUARTERLY.reduce((sum, p) => sum + p.amountPerShare * s.quantity, 0);
    expect(atHeld).toBe(40_000);
    expect(total([{ stock: s, payouts: QUARTERLY }]).annual.total).toBe(20_000);
  });
  it("9. 엔화 행은 계산에서 빠진다", () => {
    const j = stock({ id: "J", ticker: "7203", category: "foreign", currency: "JPY" });
    const r = total([{ stock: j, payouts: QUARTERLY }]);
    expect(r.annual.total).toBe(0);
    expect(r.byStock.size).toBe(0);
  });
  it("9. 원화는 환율 1, USD는 환율 환산 + 외화 금액 보존", () => {
    const k = stock({ quantity: 10, purchaseDate: "2025-01-01" });
    const u = stock({ id: "U", ticker: "AAPL", category: "foreign", currency: "USD", quantity: 10, purchaseDate: "2025-01-01" });
    const payouts = [pay("2026-03-15", 1, { amountForeign: 1 })];
    const r = total([{ stock: k, payouts }, { stock: u, payouts }], [], 1400);
    expect(r.byStock.get(dividendStockKey(k))!.paid).toBe(10);
    expect(r.byStock.get(dividendStockKey(u))!.paid).toBe(14_000);
    expect(r.byStock.get(dividendStockKey(u))!.paidForeign).toBe(10);
  });
  it("9. 반올림은 마지막 1회 — 소수 지급을 행별로 반올림하지 않는다", () => {
    // 0.4원 × 3계좌: 행별 반올림이면 0, 합산 뒤 1회면 1
    const rows = ["A", "B", "C"].map((id) => ({ stock: stock({ id, quantity: 1, purchaseDate: "2025-01-01" }), payouts: [pay("2026-03-15", 0.4)] }));
    const r = total(rows);
    expect(Math.round(r.annual.total)).toBe(1);
    expect(Math.round(monthSums(r)[2].paid)).toBe(1);
  });
});

describe("#310 이관 뒤 — 거래가 남은 행 id를 따라가면 이관 전 두 행 합과 같다", () => {
  it("경로 ②: 거래 stockId A→B, 매수일 min", () => {
    const before = [
      { stock: stock({ id: "A", quantity: 100, purchaseDate: "2026-01-02" }), payouts: QUARTERLY },
      { stock: stock({ id: "B", quantity: 50, purchaseDate: "2026-02-01" }), payouts: QUARTERLY },
    ];
    const beforeTx = [tx({ stockId: "B", type: "buy", quantity: 50, date: "2026-05-01" })];
    const after = [{ stock: stock({ id: "B", quantity: 150, purchaseDate: "2026-01-02" }), payouts: QUARTERLY }];
    const afterTx = [tx({ stockId: "B", type: "buy", quantity: 50, date: "2026-05-01" })];
    // 이관 전: 3월 A100 + B0(역산), 이관 후: B150 − 50(5월 매수) = 100
    expect(total(after, afterTx).annual.total).toBe(total(before, beforeTx).annual.total);
  });
});

describe("nextDividendMonth(#317) — 결과에서 고르기만 한다", () => {
  const a = stock({ id: "A", ticker: "005930" });
  const b = stock({ id: "B", ticker: "000660", name: "하이닉스" });
  const rows = [
    { stock: a, payouts: QUARTERLY },
    { stock: b, payouts: [pay("2026-12-20", 50, { isEstimated: true }), pay("2027-01-10", 50, { isEstimated: true })] },
  ];
  const calc = computeDividends(rows, [], 1400, TODAY);
  it("오늘 달 이상 가장 이른 예상 달과 그 달 종목 수", () => {
    expect(nextDividendMonth(calc, TODAY)).toEqual({ month: 12, count: 2 });
  });
  it("keys를 주면 그 키만 본다", () => {
    expect(nextDividendMonth(calc, TODAY, [dividendStockKey(a)])).toEqual({ month: 12, count: 1 });
    expect(nextDividendMonth(calc, TODAY, ["없음:domestic"])).toBeNull();
  });
  it("오늘 달 이전 예상은 잡지 않고, 남은 예상이 없으면 null", () => {
    const past = computeDividends([{ stock: a, payouts: [pay("2026-05-15", 100, { isEstimated: true })] }], [], 1400, TODAY);
    expect(past.annual.expected).toBeGreaterThan(0);
    expect(nextDividendMonth(past, TODAY)).toBeNull();
  });
});

describe("5.162 roundedAnnual — 지급·예상 각각 반올림 후 합산", () => {
  it("지급 10.4 + 예상 10.4 → 10 + 10 = 20(합계 반올림 − 지급 반올림 = 11이 아니다)", () => {
    const calc = computeDividends([{ stock: stock({}), payouts: [pay("2026-01-15", 0.104), pay("2026-12-15", 0.104, { isEstimated: true })] }], [], 1400, TODAY);
    expect(roundedAnnual(calc)).toEqual({ paid: 10, expected: 10, total: 20 });
  });
  it("예상 0이면 total = paid", () => {
    const calc = computeDividends([{ stock: stock({}), payouts: [pay("2026-01-15", 0.104)] }], [], 1400, TODAY);
    expect(roundedAnnual(calc)).toEqual({ paid: 10, expected: 0, total: 10 });
  });
});

// 액면분할 재현(5.162 #323) — 앱에 분할 이력 데이터가 없어 heldQtyAt은 거래 수량을 그대로 +/−한다.
// S1·S2·S4는 현재(한계) 값을 고정한다. 분할 전 지급분 수량 오차 — 계산 수정은 별도 릴리스(분할 이력 데이터 필요).
describe("5.162 액면분할 재현 S1~S4 (현재 값 고정 + 한계)", () => {
  const march = "2026-03-15";
  // 분할 이력 없음 → 분할 전 지급분 수량 오차, 계산 수정은 별도 릴리스
  it("S1 1월 10주 → 4월 2:1 분할 → 5월 5주 추가(지금 25): 3월 지급 = 20주(올바른 값 10주, 과대 한계)", () => {
    const s = stock({ quantity: 25 });
    expect(heldQtyAt(s, [tx({ quantity: 5, date: "2026-05-10" })], march)).toEqual({ qty: 20, qtyUsed: "derived" });
  });
  // 분할 이력 없음 → 분할 전 지급분 수량 오차, 계산 수정은 별도 릴리스
  it("S2 분할 후 수량 20 수동 수정(4월): 3월 지급 = 20주 폴백(올바른 값 10주, 과대 한계)", () => {
    const s = stock({ quantity: 20, positionSource: "manual", positionEffectiveDate: "2026-04-10" } as Partial<Stock>);
    expect(heldQtyAt(s, [tx({ quantity: 10, date: "2026-01-02" })], march)).toEqual({ qty: 20, qtyUsed: "current" });
  });
  it("S3 통제군: S1 종목의 7월 지급 = 25주(정확)", () => {
    const s = stock({ quantity: 25 });
    expect(heldQtyAt(s, [tx({ quantity: 5, date: "2026-05-10" })], "2026-07-15")).toEqual({ qty: 25, qtyUsed: "derived" });
  });
  // 분할 이력 없음 → 분할 전 지급분 수량 오차, 계산 수정은 별도 릴리스
  it("S4 1월 20주 → 4월 2:1 병합 → 5월 5주 추가(지금 15): 3월 지급 = 10주(올바른 값 20주, 과소 한계)", () => {
    const s = stock({ quantity: 15 });
    expect(heldQtyAt(s, [tx({ quantity: 5, date: "2026-05-10" })], march)).toEqual({ qty: 10, qtyUsed: "derived" });
  });
});

// 5.167 사업② 맞추기 이전 지급분 R1~R5 — 현재 동작을 고정한다(코드 수정 0). 맞춘 뒤 종목은 실제 applyResync로 만든다.
// R1·R2는 알려진 폴백 한계(5.162 S2와 같은 경로), R3은 5.168에서 수정(수량이 그대로면 출처·맞춘 날 유지).
describe("5.167 맞추기 이전 지급분 R1~R5 (현재 값 고정, R3은 5.168 수정)", () => {
  const resyncAt = (existing: Stock[], items: RawScreenItem[], today: string, removeIds: string[] = []) => {
    const resolved = resolveScreens([screen(0, items)], existing, { usdRate: 1400, brokerOverrides: { 0: "키움증권" } });
    const diff = computeDiff(existing, mergeScreens(resolved), resolved);
    const sel = { ...emptySel(), remove: new Set([...defaultRemoveIds(diff), ...removeIds]) };
    return { diff, stocks: applyResync(existing, diff, sel, { today, usdRate: 1400, now: 1_700_000_000_000 }).stocks };
  };
  const base = (o: Partial<Stock> = {}) => rst("A", "005930", "domestic", "키움증권", 100, 50_000, { purchaseDate: "2026-01-01", ...o });
  const march = "2026-03-15";

  // 알려진 한계 — 거래 0건이면 맞춘 날과 무관하게 모든 지급일에 맞춘 뒤 수량(올바른 값 100주)
  it("R1 거래 0건·100주 → 08-01 150주로 맞춤: 3·6월 = 150주 current(과대 한계)", () => {
    const after = resyncAt([base()], [rrow("005930", 150, 50_000)], "2026-08-01").stocks[0];
    expect(after).toMatchObject({ quantity: 150, positionSource: "manual", positionEffectiveDate: "2026-08-01" });
    expect(heldQtyAt(after, [], march)).toEqual({ qty: 150, qtyUsed: "current" });
    expect(heldQtyAt(after, [], "2026-06-15")).toEqual({ qty: 150, qtyUsed: "current" });
  });

  // 알려진 한계 — 맞춘 날 이전 지급분은 폴백 ④로 지금 수량(올바른 값 3월 100주)
  it("R2 01-02 매수 100 기록 → 08-01 150주로 맞춤: 3월 150 current(과대 한계), 9월 150 derived", () => {
    const txs = [tx({ quantity: 100, date: "2026-01-02" })];
    const after = resyncAt([base()], [rrow("005930", 150, 50_000)], "2026-08-01").stocks[0];
    expect(heldQtyAt(after, txs, march)).toEqual({ qty: 150, qtyUsed: "current" });
    expect(heldQtyAt(after, txs, "2026-09-15")).toEqual({ qty: 150, qtyUsed: "derived" });
  });

  // 5.168 수정 — 수량이 그대로면 평단만 맞춰도 출처·맞춘 날을 바꾸지 않는다(필드 없음 픽스처)
  it("R3 거래 01-02 100·07-01 50(지금 150, 필드 없음) → 11-01 평단만 맞춤: 필드 없음 유지, 3월 100 derived, 연 지급 그대로", () => {
    const txs = [tx({ quantity: 100, date: "2026-01-02" }), tx({ quantity: 50, date: "2026-07-01" })];
    const before = base({ quantity: 150 });
    expect(heldQtyAt(before, txs, march)).toEqual({ qty: 100, qtyUsed: "derived" });
    const after = resyncAt([before], [rrow("005930", 150, 52_000)], "2026-11-01").stocks[0];
    expect(after).toMatchObject({ quantity: 150, averagePrice: 52_000 });
    expect(after.positionSource).toBeUndefined();
    expect(after.positionEffectiveDate).toBeUndefined();
    expect(heldQtyAt(after, txs, march)).toEqual({ qty: 100, qtyUsed: "derived" });
    expect(total([{ stock: after, payouts: QUARTERLY }], txs).annual.paid).toBe(total([{ stock: before, payouts: QUARTERLY }], txs).annual.paid);
  });

  // 5.168 R3 — 앱 거래 기록(기본 경로)으로 만든 computed · 마지막 거래일 종목. 거래 반영은 trade-input buildReflectionPatch와 같은 계산
  const reflect = (s: Stock, t: Transaction): Stock => {
    const p = computeNewPosition(getPositionSnapshot(s), t);
    return { ...s, quantity: p.quantity, averagePrice: p.avgPrice, purchaseExchangeRate: p.avgExchangeRate || undefined, positionSource: "computed", positionEffectiveDate: t.date };
  };
  const tradedFixture = (broker = "키움증권") => {
    const txs = [tx({ quantity: 100, date: "2026-01-02" }), tx({ quantity: 50, date: "2026-07-01" })];
    const empty = rst("A", "005930", "domestic", broker, 0, 0, { purchaseDate: "2026-01-02" });
    return { txs, stock: txs.reduce(reflect, empty) };
  };

  it("R3 computed · 07-01(앱 거래 기록) → 11-01 평단만 50,000→52,000: computed · 07-01 유지, 3월 100 derived, 연 지급 35,000 불변", () => {
    const { txs, stock: before } = tradedFixture();
    expect(before).toMatchObject({ quantity: 150, averagePrice: 50_000, positionSource: "computed", positionEffectiveDate: "2026-07-01" });
    expect(total([{ stock: before, payouts: QUARTERLY }], txs).annual.paid).toBe(35_000);
    const after = resyncAt([before], [rrow("005930", 150, 52_000)], "2026-11-01").stocks[0];
    expect(after).toMatchObject({ quantity: 150, averagePrice: 52_000, positionSource: "computed", positionEffectiveDate: "2026-07-01" });
    expect(heldQtyAt(after, txs, march)).toEqual({ qty: 100, qtyUsed: "derived" });
    expect(total([{ stock: after, payouts: QUARTERLY }], txs).annual.paid).toBe(35_000);
  });

  it("R3 이어받기(수량 같음·증권사만 변경): computed · 07-01 유지, 연 지급 35,000 불변", () => {
    const { txs, stock: before } = tradedFixture("미래에셋증권");
    const { diff, stocks } = resyncAt([before], [rrow("005930", 150, 50_000)], "2026-11-01", ["A"]);
    expect(diff.rows.some((r) => r.status === "add")).toBe(true);
    expect(stocks).toHaveLength(1);
    const after = stocks[0];
    expect(after).toMatchObject({ id: "A", quantity: 150, broker: "키움증권", positionSource: "computed", positionEffectiveDate: "2026-07-01" });
    expect(heldQtyAt(after, txs, march)).toEqual({ qty: 100, qtyUsed: "derived" });
    expect(total([{ stock: after, payouts: QUARTERLY }], txs).annual.paid).toBe(35_000);
  });

  it("R3 통제군 — 같은 computed 종목에서 수량이 바뀌면 manual · 11-01, 3월 current", () => {
    const { txs, stock: before } = tradedFixture();
    const after = resyncAt([before], [rrow("005930", 160, 52_000)], "2026-11-01").stocks[0];
    expect(after).toMatchObject({ quantity: 160, positionSource: "manual", positionEffectiveDate: "2026-11-01" });
    expect(heldQtyAt(after, txs, march)).toEqual({ qty: 160, qtyUsed: "current" });
  });

  it("R3 통제군 — 이어받기에서 수량이 바뀌면 manual · 11-01", () => {
    const { stock: before } = tradedFixture("미래에셋증권");
    const after = resyncAt([before], [rrow("005930", 160, 50_000)], "2026-11-01", ["A"]).stocks[0];
    expect(after).toMatchObject({ id: "A", quantity: 160, broker: "키움증권", positionSource: "manual", positionEffectiveDate: "2026-11-01" });
  });

  // 통제군 — 화면 값이 같으면(same) 맞춘 날이 바뀌지 않아 과거 지급분 그대로
  it("R4 R3에서 결과가 같음(same): effective 그대로, 3월 100 derived 유지", () => {
    const txs = [tx({ quantity: 100, date: "2026-01-02" }), tx({ quantity: 50, date: "2026-07-01" })];
    const before = base({ quantity: 150 });
    const { stocks } = resyncAt([before], [rrow("005930", 150, 50_000)], "2026-11-01");
    expect(stocks[0].positionEffectiveDate).toBeUndefined();
    expect(stocks[0].positionSource).toBeUndefined();
    expect(heldQtyAt(stocks[0], txs, march)).toEqual({ qty: 100, qtyUsed: "derived" });
  });

  // 설계(#139) — 새로 추가된 종목은 매수일 기본값 올해 01-01이라 올해 지급분 전부 지금 수량(한계로만 기록)
  it("R5 11-27 맞추기로 새로 추가: 매수일 2026-01-01, 올해 지급분 전부 지금 수량 current", () => {
    const { stocks } = resyncAt([], [rrow("005930", 80, 50_000)], "2026-11-27");
    const added = stocks[0];
    expect(added).toMatchObject({ quantity: 80, purchaseDate: "2026-01-01", positionSource: "manual", positionEffectiveDate: "2026-11-27" });
    for (const p of QUARTERLY) expect(heldQtyAt(added, [], p.payoutDate)).toEqual({ qty: 80, qtyUsed: "current" });
  });
});
