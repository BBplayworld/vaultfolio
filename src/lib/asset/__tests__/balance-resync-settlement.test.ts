// #93 결산 픽스처 ①~④ + 월초 귀속 — 잔액을 직접 고친 경우 결산이 어떻게 읽는지 고정한다.
// 직접 고친 차액은 입출금 기록이 없으므로 전부 "기록 안 된 변화"로 잡힌다(v1 설계). 저장 로직과 분리해 스냅샷을 직접 준다.
import { describe, expect, it } from "vitest";
import { computeSettlementCauses } from "@/app/(main)/_components/views/activity/change-hero";
import { SETTLEMENT_CAUSE_LABEL } from "../../report/settlement";
import { applyBalanceEdits } from "../balance-edits";
import type { AssetData, Cash, Loan, MonthlyAssetSnapshot } from "@/types/asset";

const RATES = { USD: 1400, JPY: 900 };
const data = (): AssetData => ({
  realEstate: [], stocks: [], crypto: [], cash: [], loans: [],
  yearlyNetAssets: [], transactions: [], cashTransactions: [], loanTransactions: [], cryptoTransactions: [],
  lastUpdated: "2026-01-01T00:00:00.000Z", nickname: "",
});
const snap = (month: string, date: string, o: { cash: number; loans?: number; fx?: { USD: number; JPY: number }; fxBaseUsd?: number }): MonthlyAssetSnapshot => {
  const { cash, loans = 0, fx = RATES, fxBaseUsd = 0 } = o;
  return {
    month, date, netAsset: cash - loans, financialAsset: cash,
    breakdown: { realEstate: 0, stocks: 0, crypto: 0, cash, loans, tenantDeposit: 0 },
    fx: { ...fx }, fxBase: { USD: fxBaseUsd, JPY: 0 },
    cost: { total: cash, stock: 0, crypto: 0, realEstate: 0 },
  };
};
const LIVE_DUMMY = { date: "2026-10-28", _date: "2026-10-28", _display: "2026-10-28", netAsset: 0, financialAsset: 0 } as unknown as Parameters<typeof computeSettlementCauses>[0]["live"];
const month = (d: AssetData, start: MonthlyAssetSnapshot, end: MonthlyAssetSnapshot, rates = RATES) =>
  computeSettlementCauses({
    start, end, live: LIVE_DUMMY, deltaNet: end.netAsset - start.netAsset, startDate: start.date!, endDate: end.date!,
    liveCash: 0, exchangeHistory: {}, assetData: d, rates,
  }).mapped;
const amt = (m: ReturnType<typeof month>, k: string) => m.causes.find((c) => c.key === k)?.amount ?? 0;
const S = "2026-09-30", E = "2026-10-28";
const sumOf = (m: ReturnType<typeof month>) => m.causes.reduce((s, c) => s + c.amount, 0);

const cash = (id: string, balance: number, currency: Cash["currency"] = "KRW"): Cash => ({ id, type: "bank", name: id, balance, currency });
const loan = (id: string, balance: number): Loan => ({ id, type: "credit", name: id, balance, interestRate: 0, startDate: "2025-01-01" });

describe("#93 결산 픽스처", () => {
  it("① 현금만 직접 고침(입출금 기록 0) → 차액 전부 기록 안 된 변화, 부호 = 잔액 증감", () => {
    const d = data();
    d.cash = [cash("a", 12_000_000)];
    const up = month(d, snap("2026-09", S, { cash: 10_000_000 }), snap("2026-10", E, { cash: 12_000_000 }));
    expect(up.causes.map((c) => [c.key, c.amount])).toEqual([["unrecorded", 2_000_000]]);
    d.cash = [cash("a", 8_000_000)];
    const down = month(d, snap("2026-09", S, { cash: 10_000_000 }), snap("2026-10", E, { cash: 8_000_000 }));
    expect(down.causes.map((c) => [c.key, c.amount])).toEqual([["unrecorded", -2_000_000]]);
    expect(SETTLEMENT_CAUSE_LABEL.unrecorded).toBe("기록 안 된 변화");
  });

  it("② 대출만 직접 감소(상환 기록 0) → 순자산 +, 기록 안 된 변화(+), 대출 항목 0, 부채 상환 라벨 0", () => {
    const d = data();
    d.loans = [loan("l", 17_000_000)];
    const m = month(d, snap("2026-09", S, { cash: 0, loans: 20_000_000 }), snap("2026-10", E, { cash: 0, loans: 17_000_000 }));
    expect(m.deltaNet).toBe(3_000_000);
    expect(amt(m, "unrecorded")).toBe(3_000_000);
    expect(amt(m, "loan")).toBe(0);
    expect(Object.values(SETTLEMENT_CAUSE_LABEL).some((l) => l.includes("부채 상환"))).toBe(false);
  });

  it("③ 입출금 기록 + 직접 수정 혼재 → 기록분은 순유입, 직접 수정분만 기록 안 된 변화, 합 = Δ순자산", () => {
    const d = data();
    d.cash = [cash("a", 13_000_000)];
    d.cashTransactions = [{ id: "p", cashId: "a", date: "2026-10-10", type: "deposit", amount: 1_000_000, currency: "KRW", reflected: true } as AssetData["cashTransactions"][number]];
    // 10M → 입금 1M(기록) + 직접 수정 2M = 13M
    const m = month(d, snap("2026-09", S, { cash: 10_000_000 }), snap("2026-10", E, { cash: 13_000_000 }));
    expect(amt(m, "income")).toBe(1_000_000);
    expect(amt(m, "unrecorded")).toBe(2_000_000);
    expect(sumOf(m)).toBe(m.deltaNet);
  });

  it("④ 외화(USD) 현금 직접 수정(환율 불변) → 원통화 차액 × 환율이 기록 안 된 변화, 환율 효과 0", () => {
    const d = data();
    d.cash = [cash("u", 1500, "USD")];
    const m = month(d, snap("2026-09", S, { cash: 1_400_000 }), snap("2026-10", E, { cash: 2_100_000 }));
    expect(amt(m, "unrecorded")).toBe(700_000);
    expect(amt(m, "fx")).toBe(0);
    expect(sumOf(m)).toBe(m.deltaNet);
  });

  it("④' 외화 직접 수정 + 환율 변동 → 환율 효과는 시작 노출 기준, 이중 계상 0(항목 합 = Δ순자산)", () => {
    const d = data();
    d.cash = [cash("u", 1500, "USD")];
    const rates = { USD: 1450, JPY: 900 };
    const start = snap("2026-09", S, { cash: 1_400_000, fxBaseUsd: 1_400_000 });
    const end = snap("2026-10", E, { cash: 1500 * 1450, fx: rates, fxBaseUsd: 1500 * 1450 });
    const m = month(d, start, end, rates);
    expect(sumOf(m)).toBe(m.deltaNet);
    expect(amt(m, "fx")).toBe(50_000); // 시작 USD 노출 1,400,000 × (1450/1400 − 1)
    expect(amt(m, "unrecorded")).toBe(700_000); // 직접 수정 +500 USD × 시작 환율 1400
    // 현행 엔진: 늘어난 500 USD의 환율 변동분(500 × 50)은 시작 노출 기준 환율 효과에 안 들어가 시세 변동에 남는다(기존 상세 수정과 동일, v1 무변경)
    expect(amt(m, "price")).toBe(25_000);
    expect(amt(m, "fx") + amt(m, "unrecorded") + amt(m, "price")).toBe(m.deltaNet);
  });

  it("대출 0 입력 결과 = 기존 상세 수정(balance 0)과 같은 목록", () => {
    const l = [loan("l", 5_000_000)];
    const viaResync = applyBalanceEdits(l, { l: 0 }).list;
    const viaDetail = l.map((x) => ({ ...x, balance: 0 }));
    expect(viaResync).toEqual(viaDetail);
  });
});

describe("#93 월초 귀속 — 수정값은 다음 스냅샷 동기화 시점의 달에 들어간다", () => {
  // 12/30 수정 → 12/31 이전 재동기화: 12월 스냅샷에 수정값
  it("① 12월 스냅샷에 수정값 → 12월 구간 변화에 반영", () => {
    const d = data();
    d.cash = [cash("a", 12_000_000)];
    const dec = month(d, snap("2026-11", "2026-11-30", { cash: 10_000_000 }), snap("2026-12", "2026-12-31", { cash: 12_000_000 }));
    expect(dec.deltaNet).toBe(2_000_000);
    expect(amt(dec, "unrecorded")).toBe(2_000_000);
  });
  // 12/30 수정 → 1/3에 처음 열림: 12월 스냅샷은 수정 전 값, 수정값은 1월 스냅샷
  it("② 12월 = 수정 전(변화 0), 1월 = 수정값(1월 구간 변화)", () => {
    const d = data();
    d.cash = [cash("a", 12_000_000)];
    const dec = month(d, snap("2026-11", "2026-11-30", { cash: 10_000_000 }), snap("2026-12", "2026-12-31", { cash: 10_000_000 }));
    const jan = month(d, snap("2026-12", "2026-12-31", { cash: 10_000_000 }), snap("2027-01", "2027-01-03", { cash: 12_000_000 }));
    expect(dec.causes).toEqual([]);
    expect(jan.deltaNet).toBe(2_000_000);
    expect(amt(jan, "unrecorded")).toBe(2_000_000);
  });
});
