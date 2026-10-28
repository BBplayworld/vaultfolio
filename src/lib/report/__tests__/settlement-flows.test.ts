// qa C21 실사용 패턴 7종(가상 금액) — 기록된 출금 ↔ 기록된 매수·상환만 ±3일 안에서 짝지어 내부 이동으로 상쇄,
// 짝 없는 출금은 순유입 −, 현금 기록이 있으면 "입출금을 기록하면" 안내 없음, 예측 구간 시세 잔차는 기록 안 된 변화
import { describe, expect, it } from "vitest";
import { computeChainCauses, computeSettlementCauses, matchRecordedTransfers } from "@/app/(main)/_components/views/activity/change-hero";
import { resolveYearChain } from "../settlement";
import type { AssetData, MonthlyAssetSnapshot } from "@/types/asset";

const RATES = { USD: 1400, JPY: 900 };
const data = (): AssetData => ({
  realEstate: [], stocks: [], crypto: [], cash: [], loans: [],
  yearlyNetAssets: [], transactions: [], cashTransactions: [], loanTransactions: [], cryptoTransactions: [],
  lastUpdated: "2026-01-01T00:00:00.000Z", nickname: "",
});
const snap = (month: string, date: string, o: { cash: number; stock?: number; stockCost?: number; loans?: number; re?: number }): MonthlyAssetSnapshot => {
  const { cash, stock = 0, stockCost = stock, loans = 0, re = 0 } = o;
  return {
    month, date, netAsset: cash + stock + re - loans, financialAsset: cash + stock,
    breakdown: { realEstate: re, stocks: stock, crypto: 0, cash, loans, tenantDeposit: 0 },
    fx: { ...RATES }, fxBase: { USD: 0, JPY: 0 },
    cost: { total: cash + stockCost + re, stock: stockCost, crypto: 0, realEstate: re },
  };
};
const cashTx = (id: string, date: string, type: "deposit" | "withdrawal", amount: number) =>
  ({ id, cashId: "c", date, type, amount, currency: "KRW", reflected: true }) as AssetData["cashTransactions"][number];
const buyTx = (id: string, date: string, amount: number) =>
  ({ id, stockId: "s", ticker: "005930", stockName: "삼성전자", type: "buy", quantity: 1, price: amount, currency: "KRW", date, reflected: true, createdAt: date }) as AssetData["transactions"][number];
const repayTx = (id: string, date: string, amount: number) =>
  ({ id, loanId: "l", type: "repay", amount, date, reflected: true, createdAt: date }) as AssetData["loanTransactions"][number];
const LIVE_DUMMY = { date: "2026-10-28", _date: "2026-10-28", _display: "2026-10-28", netAsset: 0, financialAsset: 0 } as unknown as Parameters<typeof computeSettlementCauses>[0]["live"];
const month = (d: AssetData, start: MonthlyAssetSnapshot, end: MonthlyAssetSnapshot) =>
  computeSettlementCauses({
    start, end, live: LIVE_DUMMY, deltaNet: end.netAsset - start.netAsset, startDate: start.date!, endDate: end.date!,
    liveCash: 0, exchangeHistory: {}, assetData: d, rates: RATES,
  }).mapped;
const amt = (m: ReturnType<typeof month>, k: string) => m.causes.find((c) => c.key === k)?.amount ?? 0;
const S = "2026-09-30", E = "2026-10-28";

describe("C21 실사용 패턴", () => {
  it("① 출금 → 같은 날 기록 매수 → 순유입 0, 기록 안 된 변화 0", () => {
    const d = data();
    d.cashTransactions = [cashTx("w", "2026-10-10", "withdrawal", 5_000_000)];
    d.transactions = [buyTx("b", "2026-10-10", 5_000_000)];
    const m = month(d, snap("2026-09", S, { cash: 10_000_000, stock: 20_000_000 }), snap("2026-10", E, { cash: 5_000_000, stock: 25_000_000 }));
    expect([amt(m, "income"), amt(m, "unrecorded")]).toEqual([0, 0]);
  });
  it("①' 출금 → 다음 날 기록 매수 → 0, 0", () => {
    const d = data();
    d.cashTransactions = [cashTx("w", "2026-10-10", "withdrawal", 5_000_000)];
    d.transactions = [buyTx("b", "2026-10-11", 5_000_000)];
    const m = month(d, snap("2026-09", S, { cash: 10_000_000, stock: 20_000_000 }), snap("2026-10", E, { cash: 5_000_000, stock: 25_000_000 }));
    expect([amt(m, "income"), amt(m, "unrecorded")]).toEqual([0, 0]);
  });
  it("② 출금 → 2일 차 기록 대출 상환 → 0, 0", () => {
    const d = data();
    d.cashTransactions = [cashTx("w", "2026-10-24", "withdrawal", 3_000_000)];
    d.loanTransactions = [repayTx("r", "2026-10-22", 3_000_000)];
    const m = month(d, snap("2026-09", S, { cash: 10_000_000, loans: 30_000_000 }), snap("2026-10", E, { cash: 7_000_000, loans: 27_000_000 }));
    expect([amt(m, "income"), amt(m, "unrecorded")]).toEqual([0, 0]);
  });
  it("③ 입금만 → 순유입 = 입금, 기록 안 된 변화 0", () => {
    const d = data();
    d.cashTransactions = [cashTx("p", "2026-10-25", "deposit", 2_000_000)];
    const m = month(d, snap("2026-09", S, { cash: 10_000_000 }), snap("2026-10", E, { cash: 12_000_000 }));
    expect([amt(m, "income"), amt(m, "unrecorded")]).toEqual([2_000_000, 0]);
  });
  it("④ 수동 앵커 → 상세 달: 시세 = 실측 구간만, 예측 잔차는 기록 안 된 변화(예측), 합 = Hero", () => {
    const d = data();
    const monthly = [snap("2026-08", "2026-08-28", { cash: 10_000_000, stock: 40_000_000, stockCost: 30_000_000 })];
    const points = resolveYearChain(monthly, 2025, 45_000_000, E)!;
    const live = { ...snap("2026-10", E, { cash: 10_000_000, stock: 43_000_000, stockCost: 30_000_000 }), _date: E, _display: E, _isLive: true } as unknown as Parameters<typeof computeChainCauses>[0]["live"];
    const hero = 54_000_000 - 45_000_000;
    const r = computeChainCauses({ points, live, deltaNet: hero, endDate: E, liveCash: 10_000_000, exchangeHistory: {}, assetData: d, rates: RATES }).mapped;
    expect(amt(r, "price")).toBe(3_000_000);
    expect(r.causes.find((c) => c.key === "price")!.estimated).toBe(false);
    expect(r.causes.find((c) => c.key === "unrecorded")!.estimated).toBe(true);
    expect(r.causes.reduce((s, c) => s + c.amount, 0)).toBe(hero);
  });
  it("⑤ 대출로 산 부동산(거래 기록 없음) → 전 항목 0", () => {
    const m = month(data(), snap("2026-09", S, { cash: 10_000_000 }), snap("2026-10", E, { cash: 10_000_000, re: 300_000_000, loans: 300_000_000 }));
    expect(m.causes).toEqual([]);
  });
  it("혼합(R4): ①+② + 같은 구간 기록 없는 마이너스 통장 사용 → 순유입 0", () => {
    const d = data();
    d.cashTransactions = [cashTx("w1", "2026-10-10", "withdrawal", 5_000_000), cashTx("w2", "2026-10-24", "withdrawal", 3_000_000)];
    d.transactions = [buyTx("b", "2026-10-10", 5_000_000)];
    d.loanTransactions = [repayTx("r", "2026-10-22", 3_000_000)];
    // 마이너스 통장 기록 없이 600만 사용(현금 +600만, 대출 +600만) → 대출 순액은 +300만(증가)
    const m = month(d,
      snap("2026-09", S, { cash: 10_000_000, stock: 20_000_000, loans: 30_000_000 }),
      snap("2026-10", E, { cash: 8_000_000, stock: 25_000_000, loans: 33_000_000 }));
    expect(amt(m, "income")).toBe(0);
    expect(m.causes.reduce((s, c) => s + c.amount, 0)).toBe(m.deltaNet);
  });
  it("무관 출금(R5): 10/2 생활비 출금 + 10/20 매수(18일 차) → 순유입 −출금", () => {
    const d = data();
    d.cashTransactions = [cashTx("w", "2026-10-02", "withdrawal", 3_000_000)];
    d.transactions = [buyTx("b", "2026-10-20", 3_000_000)];
    const m = month(d, snap("2026-09", S, { cash: 10_000_000, stock: 20_000_000 }), snap("2026-10", E, { cash: 4_000_000, stock: 23_000_000 }));
    expect(amt(m, "income")).toBe(-3_000_000);
    expect(m.causes.reduce((s, c) => s + c.amount, 0)).toBe(m.deltaNet);
  });
});

describe("짝짓기 규칙", () => {
  it("가까운 날짜 우선·후보 금액 나눠 쓰기·합계 초과 금지·결정적", () => {
    const d = data();
    d.cashTransactions = [cashTx("w1", "2026-10-10", "withdrawal", 2_000_000), cashTx("w2", "2026-10-11", "withdrawal", 2_000_000)];
    d.transactions = [buyTx("b1", "2026-10-12", 3_000_000), buyTx("b2", "2026-10-20", 9_000_000)];
    // w1(10/10): b1(2일 차) 200만 / w2(10/11): b1 남은 100만, b2는 9일 차라 제외 → 300만
    expect(matchRecordedTransfers(d, S, E, RATES)).toBe(3_000_000);
    expect(matchRecordedTransfers(d, S, E, RATES)).toBe(3_000_000);
  });
  it("구간 밖(시작일 당일 포함) 거래는 짝 대상 아님", () => {
    const d = data();
    d.cashTransactions = [cashTx("w", S, "withdrawal", 1_000_000)];
    d.transactions = [buyTx("b", S, 1_000_000)];
    expect(matchRecordedTransfers(d, S, E, RATES)).toBe(0);
  });
  it("현금 거래가 있으면 '입출금을 기록하면' 안내 없음, 없으면 기존처럼", () => {
    const d = data();
    d.cashTransactions = [cashTx("p", "2026-10-25", "deposit", 100_000)];
    const a = snap("2026-09", S, { cash: 10_000_000 }), b = snap("2026-10", E, { cash: 18_000_000 });
    expect(month(d, a, b).showUnrecordedHint).toBe(false);
    expect(month(data(), a, b).showUnrecordedHint).toBe(true);
  });
});
