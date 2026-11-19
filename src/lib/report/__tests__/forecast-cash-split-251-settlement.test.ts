// #251 qa D-2 · CEO D-2 판정 3절 — 예측 구간(레거시 시작점) 신규 대출의 주·월·연 결산 원인 전/후 대조.
// 매핑·후처리(mapSettlementCauses·withLoanCause/splitLoanCause) 코드는 그대로, 엔진 effects의 debt만 바뀐다.
// '전' 상수는 수정 전 코드(c40e461)에서 같은 픽스처로 얻은 값이고, 등록일을 못 읽는 id(현행 폴백)로도 같은 값이 나와야 한다.
import { describe, expect, it } from "vitest";
import { computeChainCauses, computeSettlementCauses } from "@/app/(main)/_components/views/activity/change-hero";
import { resolveYearChain } from "../settlement";
import { buildYearConclusion, groupYearSettlement } from "../year-settlement";
import type { AssetData, MonthlyAssetSnapshot } from "@/types/asset";

const RATES = { USD: 1400, JPY: 900 };
const M = 1_000_000;
const msOf = (d: string) => Date.parse(`${d}T03:00:00Z`);
const data = (): AssetData => ({
  realEstate: [], stocks: [], crypto: [], cash: [], loans: [],
  yearlyNetAssets: [], transactions: [], cashTransactions: [], loanTransactions: [], cryptoTransactions: [],
  lastUpdated: "2026-01-01T00:00:00.000Z", nickname: "",
});
const snap = (month: string, date: string, o: { cash: number; stock?: number; stockCost?: number; loans?: number }): MonthlyAssetSnapshot => {
  const { cash, stock = 0, stockCost = stock, loans = 0 } = o;
  return {
    month, date, netAsset: cash + stock - loans, financialAsset: cash + stock,
    breakdown: { realEstate: 0, stocks: stock, crypto: 0, cash, loans, tenantDeposit: 0 },
    fx: { ...RATES }, fxBase: { USD: 0, JPY: 0 },
    cost: { total: cash + stockCost, stock: stockCost, crypto: 0, realEstate: 0 },
  };
};
const legacyMonth = (month: string, date: string, netAsset: number) => ({ month, date, netAsset, financialAsset: netAsset }) as MonthlyAssetSnapshot;
const loanOf = (id: string, balance: number, interestRate: number) =>
  [{ id, type: "credit", name: "신용대출", balance, interestRate, startDate: "2025-01-01" }] as AssetData["loans"];
const deposit = (id: string, date: string, amount: number) =>
  ({ id, cashId: "c", date, type: "deposit", amount, currency: "KRW", reflected: true }) as AssetData["cashTransactions"][number];
const sum = (causes: { amount: number }[]) => causes.reduce((s, c) => s + c.amount, 0);

const NEW_LOAN_ID = `loan_${msOf("2026-10-10")}`; // 구간 안 등록(startDate는 과거 입력)
const OLD_LOAN_ID = `loan_${msOf("2025-01-01")}`; // 구간 밖 등록(신규 아님)
const LEGACY_ID = "loan_legacyid";                // 등록일 못 읽음 → 현행 폴백

// ── 월(주 탭도 같은 computeSettlementCauses·withLoanCause 경로) ──
const S = "2026-09-30", E = "2026-10-28";
const monthOf = (loanId: string) => {
  const d = data();
  d.loans = loanOf(loanId, 3 * M, 3); // 금리 3% → 이자 추정 몫이 함께 생긴다(qa 재현과 같은 꼴)
  d.cash = [{ id: "c", type: "bank", name: "통장", balance: 10 * M, currency: "KRW" }] as AssetData["cash"];
  const start = legacyMonth("2026-09", S, 10 * M);
  const end = snap("2026-10", E, { cash: 10 * M, loans: 3 * M }); // 빌린 돈은 자산에 남지 않음(Δ −300만)
  return computeSettlementCauses({
    start, end, live: { ...end, _date: E, _display: E } as unknown as Parameters<typeof computeSettlementCauses>[0]["live"],
    deltaNet: end.netAsset - start.netAsset, startDate: S, endDate: E, liveCash: 0, exchangeHistory: {}, assetData: d, rates: RATES,
  }).mapped;
};
// 수정 전(main c40e461) 값 — 이자 추정(300만×3%×28일/365=6,904)만 대출, 나머지는 기록 안 된 변화
const MONTH_BEFORE = [
  { key: "loan", amount: -6_904, estimated: true },
  { key: "unrecorded", amount: -2_993_096, estimated: true },
];

// ── 연(올해 결산 블록) ──
const YE = "2026-10-28";
const NEW_LOAN_ID_YEAR = `loan_${msOf("2026-05-10")}`; // 예측 구간(작년 말 앵커 ~ 8월 기록) 안 등록
const yearOf = (loanId: string) => {
  const d = data();
  d.loans = loanOf(loanId, 6 * M, 0);
  d.cash = [{ id: "c", type: "bank", name: "통장", balance: 12 * M, currency: "KRW" }] as AssetData["cash"];
  d.cashTransactions = [deposit("p", "2026-10-10", 2 * M)];
  const monthly = [snap("2026-08", "2026-08-28", { cash: 10 * M, stock: 40 * M, stockCost: 30 * M, loans: 6 * M })];
  const points = resolveYearChain(monthly, 2025, 50 * M, YE)!; // 앵커 = 작년 말 수동값(레거시) → 1구간 예측
  const live = { ...snap("2026-10", YE, { cash: 12 * M, stock: 43 * M, stockCost: 30 * M, loans: 6 * M }), _date: YE, _display: YE, _isLive: true } as unknown as Parameters<typeof computeChainCauses>[0]["live"];
  const deltaNet = 49 * M - 50 * M;
  const mapped = computeChainCauses({ points, live, deltaNet, endDate: YE, liveCash: 12 * M, exchangeHistory: {}, assetData: d, rates: RATES }).mapped;
  const groups = groupYearSettlement(mapped);
  return { mapped, groups, conclusion: buildYearConclusion(groups), deltaNet };
};

describe("#251 D-2 결산 원인 전/후 — 예측 구간 신규 대출", () => {
  it("월: 수정 전 기록 안 된 변화+대출(이자) → 수정 후 대출 · 예측 −300만에 이자 포함, 합계 = Δ", () => {
    const after = monthOf(NEW_LOAN_ID);
    expect(after.causes).toEqual([{ key: "loan", amount: -3_000_000, estimated: true }]);
    expect(sum(after.causes)).toBe(after.deltaNet);
    expect(sum(MONTH_BEFORE)).toBe(after.deltaNet);
  });

  it("월: 등록일 못 읽는 id(현행 폴백) = 수정 전 값", () => {
    expect(monthOf(LEGACY_ID).causes).toEqual(MONTH_BEFORE);
  });

  it("월: 신규 대출 아님(구간 밖 등록) = 수정 전과 같음", () => {
    expect(monthOf(OLD_LOAN_ID).causes).toEqual(MONTH_BEFORE);
  });

  it("연: 수정 후 빠져나간 돈 −600만으로 분리, 기록 안 된 변화 0 → 결론 문장 노출(40:60), 합계 = Δ", () => {
    const { mapped, groups, conclusion, deltaNet } = yearOf(NEW_LOAN_ID_YEAR);
    expect(groups.income).toBe(2_000_000);
    expect(groups.growth?.amount).toBe(3_000_000);
    expect(groups.loan).toBe(-6_000_000);
    expect(groups.unrecorded).toBeNull();
    expect(conclusion).toEqual({ n: 40, m: 60 });
    expect(sum(mapped.causes)).toBe(deltaNet);
  });

  it("연: 수정 전(=등록일 못 읽는 id) 기록 안 된 변화 −600만·대출 없음 → 결론 문장 숨김", () => {
    const { mapped, groups, conclusion, deltaNet } = yearOf(LEGACY_ID);
    expect(groups.income).toBe(2_000_000);
    expect(groups.growth?.amount).toBe(3_000_000);
    expect(groups.loan).toBeNull();
    expect(groups.unrecorded).toEqual({ key: "unrecorded", amount: -6_000_000, estimated: true });
    expect(conclusion).toBeNull();
    expect(sum(mapped.causes)).toBe(deltaNet);
  });

  it("연: 신규 대출 아님(구간 밖 등록) = 수정 전과 같음", () => {
    const a = yearOf(OLD_LOAN_ID);
    const b = yearOf(LEGACY_ID);
    expect(a.mapped.causes).toEqual(b.mapped.causes);
    expect(a.conclusion).toBeNull();
  });
});
