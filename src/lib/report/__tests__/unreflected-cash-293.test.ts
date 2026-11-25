// #293 — 미반영(과거 소급) 입출금: 잔액이 이미 그 변화를 포함하면 cash 잔차(기록 안 된 변화) 대신 income(순유입)으로 귀속
import { describe, expect, it } from "vitest";
import { computeSettlementCauses } from "@/app/(main)/_components/views/activity/change-hero";
import type { AssetData, MonthlyAssetSnapshot } from "@/types/asset";

const RATES = { USD: 1400, JPY: 900 };
const data = (): AssetData => ({
  realEstate: [], stocks: [], crypto: [], cash: [], loans: [],
  yearlyNetAssets: [], transactions: [], cashTransactions: [], loanTransactions: [], cryptoTransactions: [],
  lastUpdated: "2026-01-01T00:00:00.000Z", nickname: "",
});
const snap = (month: string, date: string, cash: number): MonthlyAssetSnapshot => ({
  month, date, netAsset: cash, financialAsset: cash,
  breakdown: { realEstate: 0, stocks: 0, crypto: 0, cash, loans: 0, tenantDeposit: 0 },
  fx: { ...RATES }, fxBase: { USD: 0, JPY: 0 },
  cost: { total: cash, stock: 0, crypto: 0, realEstate: 0 },
});
const tx = (id: string, date: string, type: "deposit" | "withdrawal", amount: number, reflected: boolean, currency = "KRW") =>
  ({ id, cashId: "c", date, type, amount, currency, reflected }) as AssetData["cashTransactions"][number];
const LIVE = { date: "2026-10-28", _date: "2026-10-28", _display: "2026-10-28", netAsset: 0, financialAsset: 0 } as unknown as Parameters<typeof computeSettlementCauses>[0]["live"];
const run = (d: AssetData, start: MonthlyAssetSnapshot, end: MonthlyAssetSnapshot) => {
  const m = computeSettlementCauses({
    start, end, live: LIVE, deltaNet: end.netAsset - start.netAsset, startDate: start.date!, endDate: end.date!,
    liveCash: 0, exchangeHistory: {}, assetData: d, rates: RATES,
  }).mapped;
  const a = (k: string) => m.causes.find((c) => c.key === k)?.amount ?? 0;
  return { income: a("income"), unrecorded: a("unrecorded"), sum: m.causes.reduce((s, c) => s + c.amount, 0) };
};
const S = "2026-09-30", E = "2026-10-28";
const s0 = snap("2026-09", S, 10_000_000);

describe("#293 미반영 입출금", () => {
  it("재현: 잔액 이미 증가 + 미반영 입금 → 순유입, 기록 안 된 변화 0", () => {
    const d = data(); d.cashTransactions = [tx("a", "2026-10-10", "deposit", 3_000_000, false)];
    const r = run(d, s0, snap("2026-10", E, 13_000_000));
    expect(r.income).toBe(3_000_000); expect(r.unrecorded).toBe(0); expect(r.sum).toBe(3_000_000);
  });
  it("기록 없으면 종전대로 기록 안 된 변화(현금 미등록은 순유입 처리되는 기존 규칙 그대로)", () => {
    const base = run(data(), s0, snap("2026-10", E, 13_000_000));
    const d = data(); d.cashTransactions = [tx("a", "2026-10-10", "deposit", 3_000_000, true)];
    const refl = run(d, s0, snap("2026-10", E, 13_000_000));
    expect(refl.income).toBe(3_000_000);
    expect(base.sum).toBe(3_000_000);
  });
  it("U가 잔차보다 크면 잔차까지만 이동", () => {
    const d = data(); d.cashTransactions = [tx("a", "2026-10-10", "deposit", 9_000_000, false)];
    const r = run(d, s0, snap("2026-10", E, 12_000_000));
    expect(r.income).toBe(2_000_000); expect(r.unrecorded).toBe(0); expect(r.sum).toBe(2_000_000);
  });
  it("반대 부호는 이동하지 않는다", () => {
    const d = data(); d.cashTransactions = [tx("a", "2026-10-10", "withdrawal", 3_000_000, false)];
    const r = run(d, s0, snap("2026-10", E, 13_000_000));
    expect(r.income).not.toBe(0 - 3_000_000); expect(r.sum).toBe(3_000_000);
  });
  it("반영+미반영 혼재: 반영분은 그대로, 미반영분만 잔차에서 이동", () => {
    const d = data(); d.cashTransactions = [tx("a", "2026-10-10", "deposit", 2_000_000, true), tx("b", "2026-10-12", "deposit", 1_000_000, false)];
    const r = run(d, s0, snap("2026-10", E, 13_000_000));
    expect(r.income).toBe(3_000_000); expect(r.unrecorded).toBe(0); expect(r.sum).toBe(3_000_000);
  });
  it("외화 현금 미반영 입금은 KRW 환산", () => {
    const d = data(); d.cashTransactions = [tx("a", "2026-10-10", "deposit", 1000, false, "USD")];
    const r = run(d, s0, snap("2026-10", E, 11_400_000));
    expect(r.income).toBe(1_400_000); expect(r.unrecorded).toBe(0);
  });
  it("구간 밖 미반영 기록은 무관", () => {
    const d = data(); d.cashTransactions = [tx("a", "2026-08-10", "deposit", 3_000_000, false)];
    const r = run(d, s0, snap("2026-10", E, 13_000_000));
    expect(r.sum).toBe(3_000_000);
  });
});
