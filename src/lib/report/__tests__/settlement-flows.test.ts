// qa R1~R3 — 출금→같은 날 매수·대출 상환(앱 안 이동)이 "순유입 −, 기록 안 된 변화 +"로 갈라지지 않게,
// 현금 기록이 있으면 "입출금을 기록하면" 안내를 띄우지 않게, 예측 구간 시세 잔차는 기록 안 된 변화로(금액은 가상값)
import { describe, expect, it } from "vitest";
import { computeChainCauses, computeSettlementCauses } from "@/app/(main)/_components/views/activity/change-hero";
import { resolveYearChain } from "../settlement";
import type { AssetData, MonthlyAssetSnapshot } from "@/types/asset";

const RATES = { USD: 1400, JPY: 900 };
const data = (): AssetData => ({
  realEstate: [], stocks: [], crypto: [], cash: [], loans: [],
  yearlyNetAssets: [], transactions: [], cashTransactions: [], loanTransactions: [], cryptoTransactions: [],
  lastUpdated: "2026-01-01T00:00:00.000Z", nickname: "",
});
const snap = (month: string, date: string, o: { cash: number; stock: number; stockCost: number; loans: number; re?: number }): MonthlyAssetSnapshot => {
  const re = o.re ?? 0;
  return {
    month, date, netAsset: o.cash + o.stock + re - o.loans, financialAsset: o.cash + o.stock,
    breakdown: { realEstate: re, stocks: o.stock, crypto: 0, cash: o.cash, loans: o.loans, tenantDeposit: 0 },
    fx: { ...RATES }, fxBase: { USD: 0, JPY: 0 },
    cost: { total: o.cash + o.stockCost + (re ? 500_000_000 : 0), stock: o.stockCost, crypto: 0, realEstate: re ? 500_000_000 : 0 },
  };
};
const tx = (id: string, date: string, type: "deposit" | "withdrawal", amount: number) =>
  ({ id, cashId: "c", date, type, amount, currency: "KRW", reflected: true }) as AssetData["cashTransactions"][number];
const LIVE_DUMMY = { date: "2026-10-28", _date: "2026-10-28", _display: "2026-10-28", netAsset: 0, financialAsset: 0 } as unknown as Parameters<typeof computeSettlementCauses>[0]["live"];
const month = (d: AssetData, start: MonthlyAssetSnapshot, end: MonthlyAssetSnapshot) =>
  computeSettlementCauses({
    start, end, live: LIVE_DUMMY, deltaNet: end.netAsset - start.netAsset, startDate: start.date!, endDate: end.date!,
    liveCash: 0, exchangeHistory: {}, assetData: d, rates: RATES,
  }).mapped;
const amt = (m: ReturnType<typeof month>, k: string) => m.causes.find((c) => c.key === k)?.amount ?? 0;

describe("R1 출금 → 매수·상환은 내부 이동", () => {
  it("출금 500만 후 같은 날 주식 매수 500만 → 순유입 0, 기록 안 된 변화 0", () => {
    const d = data();
    d.cashTransactions = [tx("w", "2026-09-10", "withdrawal", 5_000_000)];
    const m = month(d,
      snap("2026-08", "2026-08-28", { cash: 10_000_000, stock: 20_000_000, stockCost: 20_000_000, loans: 0 }),
      snap("2026-09", "2026-09-28", { cash: 5_000_000, stock: 25_000_000, stockCost: 25_000_000, loans: 0 }));
    expect(amt(m, "income")).toBe(0);
    expect(amt(m, "unrecorded")).toBe(0);
  });
  it("출금 300만으로 대출 상환 300만 → 순유입 0, 기록 안 된 변화 0", () => {
    const d = data();
    d.cashTransactions = [tx("w", "2026-09-10", "withdrawal", 3_000_000)];
    const m = month(d,
      snap("2026-08", "2026-08-28", { cash: 10_000_000, stock: 0, stockCost: 0, loans: 30_000_000 }),
      snap("2026-09", "2026-09-28", { cash: 7_000_000, stock: 0, stockCost: 0, loans: 27_000_000 }));
    expect(amt(m, "income")).toBe(0);
    expect(amt(m, "unrecorded")).toBe(0);
  });
  it("입금만 → 순유입 = 입금", () => {
    const d = data();
    d.cashTransactions = [tx("p", "2026-09-25", "deposit", 2_000_000)];
    const m = month(d,
      snap("2026-08", "2026-08-28", { cash: 10_000_000, stock: 0, stockCost: 0, loans: 0 }),
      snap("2026-09", "2026-09-28", { cash: 12_000_000, stock: 0, stockCost: 0, loans: 0 }));
    expect(amt(m, "income")).toBe(2_000_000);
    expect(amt(m, "unrecorded")).toBe(0);
  });
  it("현금 출금 기록 없이 산 매수는 순유입으로 새지 않는다(출금 범위만 상쇄)", () => {
    const d = data();
    d.cashTransactions = [tx("w", "2026-09-10", "withdrawal", 1_000_000)];
    const m = month(d,
      snap("2026-08", "2026-08-28", { cash: 10_000_000, stock: 20_000_000, stockCost: 20_000_000, loans: 0 }),
      snap("2026-09", "2026-09-28", { cash: 9_000_000, stock: 26_000_000, stockCost: 26_000_000, loans: 0 }));
    expect(amt(m, "income")).toBe(0);           // −100만 + min(100만, 600만)
    expect(amt(m, "unrecorded")).toBe(5_000_000); // 기록 없는 500만 매수 자금
  });
});

describe("R2 현금 기록이 있으면 '입출금을 기록하면' 안내 없음", () => {
  it("구간에 현금 거래가 있으면 기록 안 된 변화가 커도 안내 false", () => {
    const d = data();
    d.cashTransactions = [tx("p", "2026-09-25", "deposit", 100_000)];
    const m = month(d,
      snap("2026-08", "2026-08-28", { cash: 10_000_000, stock: 0, stockCost: 0, loans: 0 }),
      snap("2026-09", "2026-09-28", { cash: 18_000_000, stock: 0, stockCost: 0, loans: 0 }));
    expect(amt(m, "unrecorded")).toBe(7_900_000);
    expect(m.showUnrecordedHint).toBe(false);
  });
  it("현금 거래가 없으면 기존처럼 안내", () => {
    const m = month(data(),
      snap("2026-08", "2026-08-28", { cash: 10_000_000, stock: 0, stockCost: 0, loans: 0 }),
      snap("2026-09", "2026-09-28", { cash: 18_000_000, stock: 0, stockCost: 0, loans: 0 }));
    expect(m.showUnrecordedHint).toBe(true);
  });
});

describe("실데이터 형태(작년 수동값 앵커 + 출금→같은 날 매수·상환) — 연 탭 체인", () => {
  it("순유입 = 입금 수준(양수), 시세 변동은 실측 구간만, 합계 = Hero 증감", () => {
    const d = data();
    d.cashTransactions = [
      tx("p1", "2026-03-25", "deposit", 3_000_000), tx("p2", "2026-09-25", "deposit", 3_000_000),
      tx("w1", "2026-09-05", "withdrawal", 4_000_000), // 같은 날 주식 매수
      tx("w2", "2026-09-12", "withdrawal", 1_000_000), // 대출 상환
    ];
    const monthly: MonthlyAssetSnapshot[] = [
      { month: "2026-05", netAsset: 300_000_000, financialAsset: 40_000_000 }, // 레거시
      snap("2026-08", "2026-08-28", { cash: 12_000_000, stock: 40_000_000, stockCost: 30_000_000, loans: 50_000_000, re: 600_000_000 }),
    ];
    const points = resolveYearChain(monthly, 2025, 580_000_000, "2026-10-28")!;
    const live = {
      ...snap("2026-10", "2026-10-28", { cash: 10_000_000, stock: 47_000_000, stockCost: 34_000_000, loans: 49_000_000, re: 600_000_000 }),
      _date: "2026-10-28", _display: "2026-10-28", _isLive: true,
    } as unknown as Parameters<typeof computeChainCauses>[0]["live"];
    const heroDelta = 610_000_000 - 580_000_000;
    const r = computeChainCauses({ points, live, deltaNet: heroDelta, endDate: "2026-10-28", liveCash: 10_000_000, exchangeHistory: {}, assetData: d, rates: RATES }).mapped;
    expect(amt(r, "income")).toBe(6_000_000);              // 입금 2건만, 출금 2건은 매수·상환과 상쇄
    expect(amt(r, "price")).toBe(3_000_000);               // 실측 구간(8/28→10/28) 주식 시세만
    expect(r.causes.find((c) => c.key === "price")!.estimated).toBe(false);
    expect(r.causes.reduce((s, c) => s + c.amount, 0)).toBe(heroDelta);
    expect(r.showUnrecordedHint).toBe(false);
  });
});
