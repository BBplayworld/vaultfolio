// #93 후속(cto 권고 (a)③, CHECKLIST C42): 자산 간 돈의 흐름 시나리오 S1~S7 — 현금 1,000만·대출 3,000만 사용자.
// 현재 결산 엔진 동작을 기대값으로 고정한다(좋고 나쁨을 판정하지 않는다). 한 달 안의 이동은 상쇄되고, 월 경계를 넘으면 갈라진다.
import { describe, expect, it } from "vitest";
import { computeSettlementCauses } from "@/app/(main)/_components/views/activity/change-hero";
import { checkBalanceRow } from "../balance-edits";
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

  it("S3 11/28 맞추기 900만 → 거래일 11/15 출금 100만 반영 기록(이중 차감): 잔액 800만, Δ −200만 = 순유입 −100만 + 기록 안 된 변화 −100만", () => {
    const d = data();
    d.cashTransactions = [cashTx("w", "2026-11-15", "withdrawal", 100 * M)];
    const m = run(d, snap("2026-10", "2026-10-31", { cash: 1000 * M }), snap("2026-11", "2026-11-30", { cash: 800 * M }));
    expect(m.deltaNet).toBe(-200 * M);
    expect(out(m)).toEqual({ income: -100 * M, unrecorded: -100 * M });
  });

  it("S3 반영 해제(기록만): 잔액 900만, Δ −100만 = 기록 안 된 변화 −100만", () => {
    const d = data();
    d.cashTransactions = [{ ...cashTx("w", "2026-11-15", "withdrawal", 100 * M), reflected: false }];
    const m = run(d, snap("2026-10", "2026-10-31", { cash: 1000 * M }), snap("2026-11", "2026-11-30", { cash: 900 * M }));
    expect(m.deltaNet).toBe(-100 * M);
    expect(out(m)).toEqual({ unrecorded: -100 * M });
  });

  it("S3L 11/28 대출 맞추기 2,900만 → 거래일 11/20 상환 100만 반영 기록: 대출 2,800만(이중)", () => {
    const d = data();
    d.loanTransactions = [{ id: "r", loanId: "l", type: "repay", amount: 100 * M, date: "2026-11-20", reflected: true, createdAt: "2026-11-20" } as AssetData["loanTransactions"][number]];
    const dbl = run(d, snap("2026-10", "2026-10-31", { cash: 1000 * M, loans: 3000 * M }), snap("2026-11", "2026-11-30", { cash: 1000 * M, loans: 2800 * M }));
    expect(dbl.deltaNet).toBe(200 * M);
    expect(out(dbl)).toEqual({ unrecorded: 200 * M });
    d.loanTransactions = [{ ...d.loanTransactions[0], reflected: false }];
    const single = run(d, snap("2026-10", "2026-10-31", { cash: 1000 * M, loans: 3000 * M }), snap("2026-11", "2026-11-30", { cash: 1000 * M, loans: 2900 * M }));
    expect(single.deltaNet).toBe(100 * M);
    expect(out(single)).toEqual({ unrecorded: 100 * M });
  });

  it("S6b 입금 30만 반영 기록 후 맞추기 칸에 1,030만 → 행은 변경 아님, 순유입 +30만·기록 안 된 변화 0", () => {
    const d = data();
    d.cashTransactions = [cashTx("p", "2026-11-20", "deposit", 30 * M)];
    const m = run(d, snap("2026-10", "2026-10-31", { cash: 1000 * M }), snap("2026-11", "2026-11-28", { cash: 1030 * M }));
    expect(out(m)).toEqual({ income: 30 * M });
    expect(checkBalanceRow("cash", 1030 * M, 1030 * M).changed).toBe(false);
  });

  it("S7a 같은 달: 11/2 매수 500만 기록 + 대출 맞추기 3,500만 → Δ 0, 대출 0", () => {
    const d = data();
    d.transactions = [stockTx("b", "2026-11-02", "buy", 500 * M)];
    d.loans = [{ id: "l", type: "credit", name: "대출", balance: 3500 * M, interestRate: 0, startDate: "2025-01-01" }];
    const m = run(d, snap("2026-10", "2026-10-31", { cash: 1000 * M, stock: 2000 * M, loans: 3000 * M }), snap("2026-11", "2026-11-30", { cash: 1000 * M, stock: 2500 * M, loans: 3500 * M }));
    expect(m.deltaNet).toBe(0);
    expect(out(m)).toEqual({});
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
