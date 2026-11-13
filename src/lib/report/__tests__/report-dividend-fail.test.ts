import { describe, expect, it } from "vitest";
import { computeAssetGrade, type AssetGradeInputs } from "../asset-grade";
import { gradeCountCaption, gradeChipLabel } from "@/app/(main)/_components/views/activity/asset-report-view";
import { isDividendReady } from "@/lib/finance/dividend-client";

// 성적표 판정(asset-report-view): gradeSettled = totalValue>0 && 모든 축 !pending → recordGradeSnapshot 호출
function settled(loading: boolean, failed: number, annual: number) {
  const divReady = isDividendReady(loading, failed);
  const base = {
    summary: { totalValue: 10_000_000, totalCost: 8_000_000, totalProfit: 2_000_000, totalProfitRate: 25 },
    report: { financialInvestCost: 8_000_000, investLeverageRatio: 0.2, annualInterest: 0, annualInterestInvest: 0, investLoanBalance: 0, totalProfitRate: 25, priceGain: 2_000_000, currencyGain: 0, perClass: [], debtRatio: 0, loanInterest: [], investRatio: 80 },
    yearlyNetAssets: [],
    monthlySnapshots: [],
    topShare: 30,
    fxRatioSum: 0,
    dividend: { annual, ready: divReady },
    coverage: { value: 100, ready: divReady },
    recordRate: 0.5,
    savingsRhythm: null,
  } as unknown as AssetGradeInputs;
  const grade = computeAssetGrade(base);
  const pendingKeys = grade.axes.filter((a) => a.pending).map((a) => a.key);
  return { caption: gradeCountCaption(grade), chip: gradeChipLabel(grade), pendingKeys, gradeSettled: base.summary.totalValue > 0 && grade.axes.every((a) => !a.pending) };
}

describe("isDividendReady", () => {
  it("정상·로딩·일부 실패·전부 실패", () => {
    expect(isDividendReady(false, 0)).toBe(true);
    expect(isDividendReady(true, 0)).toBe(false);
    expect(isDividendReady(false, 1)).toBe(false);
    expect(isDividendReady(false, 3)).toBe(false);
  });
});

describe("성적표 배당 실패 시 기록 판정", () => {
  it("정상: 잠정 없음 → 기록 1회 대상", () => {
    expect(settled(false, 0, 500_000)).toMatchObject({ pendingKeys: [], gradeSettled: true, caption: "5축 중 4축 측정", chip: "4/5 측정" });
  });
  it("로딩 중: 수익의 질·레버리지 잠정 → 기록 0", () => {
    const r = settled(true, 0, 0);
    expect(r.pendingKeys).toEqual(["earningQuality", "leverage"]);
    expect(r.gradeSettled).toBe(false);
    expect(r.caption).toBe("5축 중 2축 잠정");
    expect(r.chip).toBe("2/5 측정");
  });
  it("1종목 실패(합계>0)도 잠정 → 기록 0", () => {
    const r = settled(false, 1, 300_000);
    expect(r.pendingKeys).toEqual(["earningQuality", "leverage"]);
    expect(r.gradeSettled).toBe(false);
  });
  it("전부 실패(합계 0) → 기록 0, 상단은 측정 완료가 아니라 잠정", () => {
    const r = settled(false, 3, 0);
    expect(r.gradeSettled).toBe(false);
    expect(r.caption).toBe("5축 중 2축 잠정");
    expect(r.caption).not.toContain("측정 완료");
    expect(r.chip).toBe("2/5 측정");
  });
});
// 재조회 루프(요청 수 ≤ 종목 수) 회귀는 dividend-client.test.ts(C100)가 담당 — 성적표는 같은 dividendQueryOptions를 공유
