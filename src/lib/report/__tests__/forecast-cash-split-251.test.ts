import { describe, it, expect } from "vitest";
import { computeAttributionSince, getAttributionItems } from "../asset-report";
import { mapSettlementCauses } from "../settlement";
import type { AssetData, Cash, DailyAssetSnapshot, Loan } from "@/types/asset";
import type { CashTransaction, LoanTransaction } from "@/types/transaction";

// #251 — 예측 분해(시작 기록에 breakdown·cost 없음) 구간에서 새로 등록한 현금·대출이
// '보유자산 시세 상승/하락 · 예측'으로 보이던 결함. 등록일 = id의 13자리 ms(4.94 assetIdRegisteredDate).

const RATES = { USD: 1400, JPY: 900 };
const FROM = "2026-05-01";
const TO = "2026-05-20";
const msOf = (d: string) => Date.parse(`${d}T03:00:00Z`); // KST 같은 날 12시

const emptyData = (): AssetData => ({
  realEstate: [], stocks: [], crypto: [], cash: [], loans: [],
  yearlyNetAssets: [], transactions: [], cashTransactions: [], loanTransactions: [], cryptoTransactions: [],
  lastUpdated: new Date().toISOString(), nickname: "",
});

const cash = (o: Partial<Cash> = {}): Cash => ({
  id: `cash_${msOf("2026-05-10")}`, type: "bank", name: "통장", balance: 5_000_000, currency: "KRW", ...o,
});
const loan = (o: Partial<Loan> = {}): Loan => ({
  id: `loan_${msOf("2026-05-10")}`, type: "credit", name: "신용대출", balance: 3_000_000, interestRate: 0, startDate: "2025-01-01", ...o,
});
const cashTx = (o: Partial<CashTransaction> = {}): CashTransaction => ({
  id: "ctx_1", cashId: "c1", type: "deposit", amount: 1_000_000, currency: "KRW",
  date: "2026-05-12", reflected: true, createdAt: new Date().toISOString(), ...o,
});
const loanTx = (o: Partial<LoanTransaction> = {}): LoanTransaction => ({
  id: "ltx_1", loanId: "l1", type: "borrow", amount: 3_000_000,
  date: "2026-05-10", reflected: true, createdAt: new Date().toISOString(), ...o,
});

// 완전 레거시 시작점(netAsset만)
const legacy = (netAsset: number): DailyAssetSnapshot => ({ date: FROM, netAsset, financialAsset: netAsset } as DailyAssetSnapshot);
// breakdown만 있고 fx·cost 없는 시작점
const bdOnly = (cashV: number, loans = 0): DailyAssetSnapshot => ({
  date: FROM, netAsset: cashV - loans, financialAsset: cashV,
  breakdown: { realEstate: 0, stocks: 0, crypto: 0, cash: cashV, loans },
} as DailyAssetSnapshot);
// v2 enrich 끝점(현금만)
const enriched = (date: string, cashV: number, loans = 0): DailyAssetSnapshot => ({
  date, netAsset: cashV - loans, financialAsset: cashV,
  breakdown: { realEstate: 0, stocks: 0, crypto: 0, cash: cashV, loans },
  fx: { ...RATES }, fxBase: { USD: 0, JPY: 0 },
  cost: { total: cashV, stock: 0, crypto: 0, realEstate: 0 },
});

const run = (data: AssetData, daily: DailyAssetSnapshot[]) => computeAttributionSince(daily, [], {}, FROM, data, RATES)!;
const eff = (a: ReturnType<typeof run>, key: string) => a.effects.find((e) => e.key === key);
const sumEffects = (a: ReturnType<typeof run>) => a.effects.reduce((s, e) => s + e.amount, 0);
const sumDisplayed = (a: ReturnType<typeof run>) => getAttributionItems(a).reduce((s, i) => s + i.amount, 0);
const labels = (a: ReturnType<typeof run>) => getAttributionItems(a).map((i) => i.label);

describe("#251 예측 분해 — 구간 안 등록 현금·대출 분리", () => {
  it("1. 정밀 분해(양끝 enrich) 신규 현금 500만 → 신규 현금(현행 유지)", () => {
    const data = emptyData();
    data.cash = [cash()];
    const a = run(data, [enriched(FROM, 10_000_000), enriched(TO, 15_000_000)]);
    expect(a.estimated).toBe(false);
    expect(eff(a, "cash")?.amount).toBeCloseTo(5_000_000, 6);
    expect(sumDisplayed(a)).toBeCloseTo(a.deltaNet, 6);
  });

  it("2. 예측(완전 레거시 시작) 신규 현금 500만 → 신규 현금 · 예측, 시세 0", () => {
    const data = emptyData();
    data.cash = [cash()];
    const a = run(data, [legacy(10_000_000), enriched(TO, 15_000_000)]);
    expect(a.estimated).toBe(true);
    expect(eff(a, "cash")).toEqual({ key: "cash", amount: 5_000_000, estimated: true });
    expect(eff(a, "price")?.amount ?? 0).toBeCloseTo(0, 6);
    expect(labels(a)).toEqual(["신규 현금"]);
    expect(getAttributionItems(a)[0].estimated).toBe(true);
    expect(sumEffects(a)).toBeCloseTo(a.deltaNet, 6);
    expect(sumDisplayed(a)).toBeCloseTo(a.deltaNet, 6);
  });

  it("3. 예측(시작에 breakdown만, cost 없음) 신규 현금 → 신규 현금 · 예측", () => {
    const data = emptyData();
    data.cash = [cash()];
    const a = run(data, [bdOnly(10_000_000), enriched(TO, 15_000_000)]);
    expect(a.estimated).toBe(true);
    expect(eff(a, "cash")?.amount).toBeCloseTo(5_000_000, 6);
    expect(labels(a)).toEqual(["신규 현금"]);
    expect(sumDisplayed(a)).toBeCloseTo(a.deltaNet, 6);
  });

  it("4. 예측 신규 대출 300만, startDate 구간 밖·등록일 구간 안 → 추가 대출 · 예측", () => {
    const data = emptyData();
    data.loans = [loan()];
    const a = run(data, [legacy(10_000_000), enriched(TO, 10_000_000, 3_000_000)]);
    expect(eff(a, "debt")).toEqual({ key: "debt", amount: -3_000_000, estimated: true });
    expect(eff(a, "price")?.amount ?? 0).toBeCloseTo(0, 6);
    expect(labels(a)).toEqual(["추가 대출"]);
    expect(sumDisplayed(a)).toBeCloseTo(a.deltaNet, 6);
  });

  it("5. 예측 신규 대출, startDate 구간 안 → 추가 대출(현행, 이중 계상 0)", () => {
    const data = emptyData();
    data.loans = [loan({ startDate: "2026-05-10" })];
    const a = run(data, [legacy(10_000_000), enriched(TO, 10_000_000, 3_000_000)]);
    expect(a.debtEffect).toBe(-3_000_000);
    expect(eff(a, "price")?.amount ?? 0).toBeCloseTo(0, 6);
  });

  it("6. 예측 기존 계좌 잔액 직접 수정(등록일 구간 밖) → 시세 유지(알려진 한계)", () => {
    const data = emptyData();
    data.cash = [cash({ id: `cash_${msOf("2026-03-01")}`, balance: 15_000_000 })];
    const a = run(data, [legacy(10_000_000), enriched(TO, 15_000_000)]);
    expect(eff(a, "cash")).toBeUndefined();
    expect(eff(a, "price")?.amount).toBeCloseTo(5_000_000, 6);
  });

  it("7. 같은 예측 구간의 월 결산 매핑(estimatedPriceAsUnrecorded) → 기록 안 된 변화 +500만 · 예측(불변)", () => {
    const data = emptyData();
    data.cash = [cash()];
    const a = run(data, [legacy(10_000_000), enriched(TO, 15_000_000)]);
    const m = mapSettlementCauses(a.effects, { deltaNet: a.deltaNet, cashTracked: true, estimatedPriceAsUnrecorded: true });
    expect(m.causes).toEqual([{ key: "unrecorded", amount: 5_000_000, estimated: true }]);
  });

  it("8. 등록일을 못 읽는 id(비표준) → 현행 폴백(시세)", () => {
    const data = emptyData();
    data.cash = [cash({ id: "c1" })];
    data.loans = [loan({ id: "l1" })];
    const a = run(data, [legacy(10_000_000), enriched(TO, 12_000_000, 3_000_000)]);
    expect(eff(a, "cash")).toBeUndefined();
    expect(a.debtEffect).toBe(0);
    expect(eff(a, "price")?.amount).toBeCloseTo(-1_000_000, 6);
  });

  it("9. 대출 거래가 있는 새 대출 → 거래가 권위, 이중 계상 0", () => {
    const data = emptyData();
    data.loans = [loan({ id: `loan_${msOf("2026-05-10")}` })];
    data.loanTransactions = [loanTx({ loanId: data.loans[0].id })];
    const a = run(data, [legacy(10_000_000), enriched(TO, 10_000_000, 3_000_000)]);
    expect(a.debtEffect).toBe(-3_000_000);
    expect(sumEffects(a)).toBeCloseTo(a.deltaNet, 6);
  });

  it("10. 새 현금 계좌 + 같은 계좌 입금 기록 → 신규 현금은 등록 당시 잔액, 입금은 기록 줄(이중 0)", () => {
    const data = emptyData();
    const c = cash({ balance: 6_000_000 }); // 등록 500만 + 입금 100만
    data.cash = [c];
    data.cashTransactions = [cashTx({ cashId: c.id })];
    const a = run(data, [legacy(10_000_000), enriched(TO, 16_000_000)]);
    expect(eff(a, "cash")?.amount).toBeCloseTo(5_000_000, 6);
    expect(a.incomeEffect).toBe(1_000_000);
    expect(eff(a, "price")?.amount ?? 0).toBeCloseTo(0, 6);
    expect(sumDisplayed(a)).toBeCloseTo(a.deltaNet, 6);
  });

  it("11. 외화 새 현금 → 현재 환율로 원화 환산", () => {
    const data = emptyData();
    data.cash = [cash({ balance: 1_000, currency: "USD" })];
    const a = run(data, [legacy(10_000_000), enriched(TO, 11_400_000)]);
    expect(eff(a, "cash")?.amount).toBeCloseTo(1_400_000, 6);
    expect(sumEffects(a)).toBeCloseTo(a.deltaNet, 6);
  });

  it("12. 등록일이 시작일 당일·끝일 이후인 현금 → 구간 밖(현행)", () => {
    const data = emptyData();
    data.cash = [cash({ id: `cash_${msOf(FROM)}` }), cash({ id: `cash_${msOf("2026-05-25")}` })];
    const a = run(data, [legacy(10_000_000), enriched(TO, 15_000_000)]);
    expect(eff(a, "cash")).toBeUndefined();
  });
});
