// #32 보완 — 연 탭 변화 원인: 구간(전년 12월 → 오늘), 올해 범위(C8), 경계일(C15), 합계 = Hero 증감
import { describe, expect, it } from "vitest";
import { resolveYearWindow } from "../settlement";
import { computeSettlementCauses } from "@/app/(main)/_components/views/activity/change-hero";
import type { AssetData, MonthlyAssetSnapshot } from "@/types/asset";

const RATES = { USD: 1400, JPY: 900 };
const data = (): AssetData => ({
  realEstate: [], stocks: [], crypto: [], cash: [], loans: [],
  yearlyNetAssets: [], transactions: [], cashTransactions: [], loanTransactions: [], cryptoTransactions: [],
  lastUpdated: "2026-01-01T00:00:00.000Z", nickname: "",
});
const enriched = (month: string, date: string, cash: number, re = 0): MonthlyAssetSnapshot => ({
  month, date, netAsset: cash + re, financialAsset: cash,
  breakdown: { realEstate: re, stocks: 0, crypto: 0, cash, loans: 0, tenantDeposit: 0 },
  fx: { ...RATES }, fxBase: { USD: 0, JPY: 0 },
  cost: { total: cash + (re ? 500_000_000 : 0), stock: 0, crypto: 0, realEstate: re ? 500_000_000 : 0 }, // 부동산 원가 고정 → 값 변화 = 평가 갱신
});
// 실시간 끝점(buildLiveAttributionCurr 형식)
const live = (date: string, cash: number, re = 0) => ({
  _date: date, _display: date, _isLive: true, date, netAsset: cash + re, financialAsset: cash,
  breakdown: { realEstate: re, stocks: 0, crypto: 0, cash, loans: 0, tenantDeposit: 0 },
  fx: { ...RATES }, fxBase: { USD: 0, JPY: 0 },
  cost: { total: cash + (re ? 500_000_000 : 0), stock: 0, crypto: 0, realEstate: re ? 500_000_000 : 0 }, // 부동산 원가 고정 → 값 변화 = 평가 갱신
}) as unknown as Parameters<typeof computeSettlementCauses>[0]["live"];
const deposit = (id: string, date: string, amount: number) =>
  ({ id, cashId: "c", date, type: "deposit", amount, currency: "KRW", reflected: true }) as AssetData["cashTransactions"][number];

const thirteen = Array.from({ length: 13 }, (_, i) => {
  const idx = 2025 * 12 + 9 + i; // 2025-10 ~ 2026-10
  const m = `${Math.floor(idx / 12)}-${String((idx % 12) + 1).padStart(2, "0")}`;
  return enriched(m, `${m}-28`, 10_000_000 + i * 1_000_000);
});

describe("resolveYearWindow", () => {
  it("13개월 픽스처에서 전년 12월만 시작으로 고른다(전년 1~11월 배제, C8)", () => {
    const w = resolveYearWindow(thirteen, 2025, "2026-10-28")!;
    expect(w.start.month).toBe("2025-12");
    expect(w.startDate).toBe("2025-12-28");
    expect(w.startLegacy).toBe(false);
  });
  it("12월 스냅샷이 없으면 null(기록 부족)", () => {
    expect(resolveYearWindow(thirteen.filter((s) => s.month !== "2025-12"), 2025, "2026-10-28")).toBeNull();
  });
  it("시작 기준일이 오늘이면 null(1월 경계 직후 등)", () => {
    expect(resolveYearWindow([enriched("2026-12", "2026-12-31", 1)], 2026, "2026-12-31")).toBeNull();
    // 2027-01: 보존 규칙상 남아 있는 2026-12가 올해(2027) 시작
    expect(resolveYearWindow([enriched("2026-12", "2026-12-31", 1)], 2026, "2027-01-02")!.start.month).toBe("2026-12");
  });
  it("레거시 12월(date 없음)은 말일 기준·startLegacy", () => {
    const w = resolveYearWindow([{ month: "2025-12", netAsset: 1, financialAsset: 1 }], 2025, "2026-10-28")!;
    expect(w.startDate).toBe("2025-12-31");
    expect(w.startLegacy).toBe(true);
  });
});

describe("연 구간 원인", () => {
  const run = (d: AssetData, start: MonthlyAssetSnapshot, end: ReturnType<typeof live>, deltaNet: number) =>
    computeSettlementCauses({
      start, end: null, live: end, deltaNet, startDate: start.date!, endDate: "2026-10-28",
      liveCash: 0, exchangeHistory: {}, assetData: d, rates: RATES,
    }).mapped;

  it("시작일(12월 스냅샷 기준일·12월 말일) 거래는 제외, 올해 거래는 포함(C15)", () => {
    const d = data();
    d.cashTransactions = [deposit("a", "2025-12-31", 3_000_000), deposit("b", "2026-03-10", 1_000_000)];
    const start = enriched("2025-12", "2025-12-31", 10_000_000, 500_000_000);
    const end = live("2026-10-28", 11_000_000, 520_000_000);
    const m = run(d, start, end, 21_000_000);
    expect(m.causes.find((c) => c.key === "income")?.amount).toBe(1_000_000);
    expect(m.causes.reduce((s, c) => s + c.amount, 0)).toBe(21_000_000);
  });

  it("합계 = Hero 증감 — 수동 입력 전년 값이 12월 스냅샷과 달라도 차이는 '기록 안 된 변화'로 흡수", () => {
    const d = data();
    const start = enriched("2025-12", "2025-12-28", 10_000_000, 500_000_000); // 스냅샷 5.1억
    const end = live("2026-10-28", 10_000_000, 520_000_000);                 // 5.3억
    const heroDelta = 530_000_000 - 505_000_000;                             // 수동 전년 값 5.05억 기준 2,500만
    const m = run(d, start, end, heroDelta);
    expect(m.causes.reduce((s, c) => s + c.amount, 0)).toBe(heroDelta);
    expect(m.causes.find((c) => c.key === "valuation")?.amount).toBe(20_000_000);
    expect(m.causes.find((c) => c.key === "unrecorded")?.amount).toBe(5_000_000);
  });

  it("전년 1~11월 스냅샷 유무와 무관하게 결과 동일(C8)", () => {
    const d = data();
    const end = live("2026-10-28", 25_000_000);
    const a = resolveYearWindow(thirteen, 2025, "2026-10-28")!;
    const b = resolveYearWindow(thirteen.filter((s) => s.month >= "2025-12"), 2025, "2026-10-28")!;
    expect(run(d, a.start, end, 12_000_000)).toEqual(run(d, b.start, end, 12_000_000));
  });

  it("월 결산과 인접: 12월 결산 끝 = 연 구간 시작에서만 만나 경계일 입금 1회만 계상", () => {
    const d = data();
    d.cashTransactions = [deposit("a", "2025-12-28", 500_000)];
    const nov = enriched("2025-11", "2025-11-28", 10_000_000);
    const dec = enriched("2025-12", "2025-12-28", 10_500_000);
    const decIncome = computeSettlementCauses({
      start: nov, end: dec, live: live("2026-10-28", 0), deltaNet: 500_000, startDate: nov.date!, endDate: dec.date!,
      liveCash: 0, exchangeHistory: {}, assetData: d, rates: RATES,
    }).mapped.causes.find((c) => c.key === "income")?.amount ?? 0;
    const yearIncome = run(d, dec, live("2026-10-28", 10_500_000), 0).causes.find((c) => c.key === "income")?.amount ?? 0;
    expect(decIncome + yearIncome).toBe(500_000);
    expect(yearIncome).toBe(0);
  });
});
