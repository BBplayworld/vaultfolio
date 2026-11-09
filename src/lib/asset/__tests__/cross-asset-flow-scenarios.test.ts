// #93 후속(cto 권고 (a)③, CHECKLIST C42): 자산 간 돈의 흐름 시나리오 S1~S7 — 현금 1,000만·대출 3,000만 사용자.
// 현재 결산 엔진 동작을 기대값으로 고정한다(좋고 나쁨을 판정하지 않는다). 한 달 안의 이동은 상쇄되고, 월 경계를 넘으면 갈라진다.
import { describe, expect, it } from "vitest";
import { computeSettlementCauses } from "@/app/(main)/_components/views/activity/change-hero";
import { shouldWarnTxAfterResync } from "../balance-edits";
import type { AssetData, MonthlyAssetSnapshot } from "@/types/asset";

const RATES = { USD: 1400, JPY: 900 };
const data = (): AssetData => ({
  realEstate: [], stocks: [], crypto: [], cash: [], loans: [],
  yearlyNetAssets: [], transactions: [], cashTransactions: [], loanTransactions: [], cryptoTransactions: [],
  lastUpdated: "2026-01-01T00:00:00.000Z", nickname: "",
});
const snap = (month: string, date: string, o: { cash: number; stock?: number; loans?: number; stockCost?: number }): MonthlyAssetSnapshot => {
  const { cash, stock = 0, loans = 0, stockCost = stock } = o;
  return {
    month, date, netAsset: cash + stock - loans, financialAsset: cash + stock,
    breakdown: { realEstate: 0, stocks: stock, crypto: 0, cash, loans, tenantDeposit: 0 },
    fx: { ...RATES }, fxBase: { USD: 0, JPY: 0 },
    cost: { total: cash + stockCost, stock: stockCost, crypto: 0, realEstate: 0 },
  };
};
const LIVE = { date: "2026-11-30", _date: "2026-11-30", _display: "2026-11-30", netAsset: 0, financialAsset: 0 } as unknown as Parameters<typeof computeSettlementCauses>[0]["live"];
const run = (d: AssetData, a: MonthlyAssetSnapshot, b: MonthlyAssetSnapshot) =>
  computeSettlementCauses({ start: a, end: b, live: LIVE, deltaNet: b.netAsset - a.netAsset, startDate: a.date!, endDate: b.date!, liveCash: 0, exchangeHistory: {}, assetData: d, rates: RATES }).mapped;
const out = (m: ReturnType<typeof run>) => Object.fromEntries(m.causes.map((c) => [c.key, c.amount]));
const cashTx = (id: string, date: string, type: "deposit" | "withdrawal", amount: number) =>
  ({ id, cashId: "c", date, type, amount, currency: "KRW", reflected: true }) as AssetData["cashTransactions"][number];
const stockTx = (id: string, date: string, type: "buy" | "sell", amount: number) =>
  ({ id, stockId: "s", ticker: "005930", stockName: "삼성전자", type, quantity: 1, price: amount, currency: "KRW", date, reflected: true, createdAt: date }) as AssetData["transactions"][number];

const M = 10_000;
describe("C42 자산 간 흐름 S1~S7 (현재 동작 고정)", () => {
  it("S1 같은 달: 11/15 주식 100만 매수 기록 → 11/28 맞추기 현금 900만 → 전부 상쇄(0)", () => {
    const d = data();
    d.transactions = [stockTx("b", "2026-11-15", "buy", 100 * M)];
    const m = run(d, snap("2026-10", "2026-10-31", { cash: 1000 * M, stock: 2000 * M }), snap("2026-11", "2026-11-28", { cash: 900 * M, stock: 2100 * M }));
    expect(out(m)).toEqual({});
    expect(m.deltaNet).toBe(0);
  });

  it("S4 같은 달: 주식 300만 매도 기록 → 맞추기 현금 +300만 → 상쇄(0)", () => {
    const d = data();
    d.transactions = [stockTx("s", "2026-11-15", "sell", 300 * M)];
    const m = run(d, snap("2026-10", "2026-10-31", { cash: 1000 * M, stock: 2000 * M }), snap("2026-11", "2026-11-28", { cash: 1300 * M, stock: 1700 * M }));
    expect(out(m)).toEqual({});
  });

  it("S5 같은 달: 매도 500만 → 대출 상환(맞추기 대출 2,500만) → 상쇄(0)", () => {
    const d = data();
    d.transactions = [stockTx("s", "2026-11-15", "sell", 500 * M)];
    d.loans = [{ id: "l", type: "credit", name: "대출", balance: 2500 * M, interestRate: 0, startDate: "2025-01-01" }];
    const m = run(d, snap("2026-10", "2026-10-31", { cash: 1000 * M, stock: 2000 * M, loans: 3000 * M }), snap("2026-11", "2026-11-28", { cash: 1000 * M, stock: 1500 * M, loans: 2500 * M }));
    expect(out(m)).toEqual({});
  });

  it("S6 배당 30만 입금(기록 없음) → 맞추기 +30만 → 기록 안 된 변화 +30만", () => {
    const m = run(data(), snap("2026-10", "2026-10-31", { cash: 1000 * M }), snap("2026-11", "2026-11-28", { cash: 1030 * M }));
    expect(out(m)).toEqual({ unrecorded: 30 * M });
  });

  it("S3 맞추기 후 같은 100만 출금 기록(이중 반영): 현금 800만으로 순자산 −100만이 순유입 −100만으로 잡힘", () => {
    const d = data();
    d.transactions = [stockTx("b", "2026-11-05", "buy", 100 * M)];
    d.cashTransactions = [cashTx("w", "2026-11-29", "withdrawal", 100 * M)];
    const m = run(d, snap("2026-10", "2026-10-31", { cash: 1000 * M, stock: 2000 * M }), snap("2026-11", "2026-11-30", { cash: 800 * M, stock: 2100 * M }));
    expect(m.deltaNet).toBe(-100 * M);
    expect(out(m)).toEqual({ income: -100 * M }); // 같은 100만이 출금 기록으로 한 번 더 빠진 몫 = 순유입 −100만
    // 막는 장치: 11/28에 맞췄고 거래일이 11/28 이전이면 경고, 반영 해제거나 맞춘 기록이 없으면 경고 없음
    const resync = "2026-11-28T03:00:00.000Z"; // KST 11/28 12:00
    expect(shouldWarnTxAfterResync({ txDate: "2026-11-28", reflected: true, refreshedAtIso: resync })).toBe(true);
    expect(shouldWarnTxAfterResync({ txDate: "2026-11-28", reflected: false, refreshedAtIso: resync })).toBe(false);
    expect(shouldWarnTxAfterResync({ txDate: "2026-11-28", reflected: true, refreshedAtIso: null })).toBe(false);
  });

  it("S2 월 경계: 10/30 매수 기록 → 11/3 맞추기 — 10월 결산은 부풀려지고 11월에 되돌려진다", () => {
    const d = data();
    d.transactions = [stockTx("b", "2026-10-30", "buy", 100 * M)];
    const oct = run(d, snap("2026-09", "2026-09-30", { cash: 1000 * M, stock: 2000 * M }), snap("2026-10", "2026-10-31", { cash: 1000 * M, stock: 2100 * M }));
    const nov = run(d, snap("2026-10", "2026-10-31", { cash: 1000 * M, stock: 2100 * M }), snap("2026-11", "2026-11-30", { cash: 900 * M, stock: 2100 * M }));
    expect(oct.deltaNet).toBe(100 * M);
    expect(nov.deltaNet).toBe(-100 * M);
    expect({ oct: out(oct), nov: out(nov) }).toEqual({ oct: { unrecorded: 100 * M }, nov: { unrecorded: -100 * M } });
  });

  it("S7 월 경계: 대출 500만 받아 10/31 주식 매수 기록 → 11/2 대출 맞추기", () => {
    const d = data();
    d.transactions = [stockTx("b", "2026-10-31", "buy", 500 * M)];
    d.loans = [{ id: "l", type: "credit", name: "대출", balance: 3500 * M, interestRate: 0, startDate: "2025-01-01" }];
    const oct = run(d, snap("2026-09", "2026-09-30", { cash: 1000 * M, stock: 2000 * M, loans: 3000 * M }), snap("2026-10", "2026-10-31", { cash: 1000 * M, stock: 2500 * M, loans: 3000 * M }));
    const nov = run(d, snap("2026-10", "2026-10-31", { cash: 1000 * M, stock: 2500 * M, loans: 3000 * M }), snap("2026-11", "2026-11-30", { cash: 1000 * M, stock: 2500 * M, loans: 3500 * M }));
    expect({ oct: out(oct), nov: out(nov) }).toEqual({ oct: { unrecorded: 500 * M }, nov: { loan: -500 * M } });
  });
});
