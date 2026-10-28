// qa D4·D6 — 습관 축 비교 범위(올해 고정)와 인접 월 결산 경계일 이중 계상 방지
import { describe, expect, it } from "vitest";
import { computeAttributionBetween } from "../asset-report";
import { scoreHabit } from "../asset-grade";
import type { AssetData, AssetSummary, MonthlyAssetSnapshot } from "@/types/asset";

const RATES = { USD: 1400, JPY: 900 };
const data = (): AssetData => ({
  realEstate: [], stocks: [], crypto: [], cash: [], loans: [],
  yearlyNetAssets: [], transactions: [], cashTransactions: [], loanTransactions: [], cryptoTransactions: [],
  lastUpdated: "2026-01-01T00:00:00.000Z", nickname: "",
});
const enriched = (month: string, date: string, cash: number): MonthlyAssetSnapshot => ({
  month, date, netAsset: cash, financialAsset: cash,
  breakdown: { realEstate: 0, stocks: 0, crypto: 0, cash, loans: 0, tenantDeposit: 0 },
  fx: { ...RATES }, fxBase: { USD: 0, JPY: 0 },
  cost: { total: cash, stock: 0, crypto: 0, realEstate: 0 },
});

describe("D6 인접 월 결산 — 경계일 입금은 한 달에만", () => {
  it("9/27 입금 50만 원: 9월 결산(8/28→9/27)에만, 10월 결산(9/27→10/28)에는 없음", () => {
    const d = data();
    d.cashTransactions = [
      { id: "a", cashId: "c", date: "2026-09-27", type: "deposit", amount: 500_000, currency: "KRW", reflected: true },
    ] as AssetData["cashTransactions"];
    const aug = enriched("2026-08", "2026-08-28", 10_000_000);
    const sep = enriched("2026-09", "2026-09-27", 10_500_000);
    const oct = enriched("2026-10", "2026-10-28", 10_500_000);
    const income = (prev: MonthlyAssetSnapshot, curr: MonthlyAssetSnapshot) =>
      computeAttributionBetween(prev, curr, {}, d, RATES, false)!.effects.find((e) => e.key === "income")?.amount ?? 0;
    expect(income(aug, sep)).toBeCloseTo(500_000, 6);
    expect(income(sep, oct)).toBeCloseTo(0, 6);
    // 기본값(true)은 기존 동작 그대로 시작일 포함
    expect(computeAttributionBetween(sep, oct, {}, d, RATES)!.effects.find((e) => e.key === "income")?.amount).toBeCloseTo(500_000, 6);
  });
});

describe("D4 습관 축 — 전년 달이 섞여도 올해분만 비교(main과 동일)", () => {
  const summary = { totalValue: 100_000_000, cashValue: 20_000_000 } as AssetSummary;
  const snap = (month: string, netAsset: number): MonthlyAssetSnapshot => ({ month, netAsset, financialAsset: netAsset });
  const prevYear = [snap("2025-07", 100), snap("2025-08", 110), snap("2025-09", 120), snap("2025-10", 130), snap("2025-11", 140), snap("2025-12", 150)];
  for (const n of [1, 2, 3, 4, 5, 6]) {
    it(`${n}월: 13개월 보존분 결과 = 올해분만(main 저장 범위) 결과`, () => {
      const thisYear = Array.from({ length: n }, (_, i) => snap(`2026-${String(i + 1).padStart(2, "0")}`, i % 2 === 0 ? 90 - i : 95 + i));
      expect(scoreHabit(summary, [...prevYear, ...thisYear])).toEqual(scoreHabit(summary, thisYear));
    });
  }
});
