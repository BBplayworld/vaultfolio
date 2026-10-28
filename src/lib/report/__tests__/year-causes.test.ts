// #32 보완(B안) — 연 탭 변화 원인: 앵커(작년 수동값 또는 전년 12월) → 올해 enrich 월 → 실시간 체인.
// 운영 데이터 형태(C20): 전년 월 스냅샷 없음·연도별 수동값만·올해 1~7월 레거시·8월 이후 enrich.
import { describe, expect, it } from "vitest";
import { resolveYearChain } from "../settlement";
import { computeChainCauses, computeSettlementCauses } from "@/app/(main)/_components/views/activity/change-hero";
import type { AssetData, MonthlyAssetSnapshot } from "@/types/asset";

const RATES = { USD: 1400, JPY: 900 };
const TODAY = "2026-10-28";
const data = (): AssetData => ({
  realEstate: [], stocks: [], crypto: [], cash: [], loans: [],
  yearlyNetAssets: [], transactions: [], cashTransactions: [], loanTransactions: [], cryptoTransactions: [],
  lastUpdated: "2026-01-01T00:00:00.000Z", nickname: "",
});
// 부동산 원가 5억 고정 → 부동산 값 변화 = 평가 갱신, 주식 원가 고정 → 주식 값 변화 = 시세 변동
const point = (cash: number, re: number, stock: number) => ({
  netAsset: cash + re + stock, financialAsset: cash + stock,
  breakdown: { realEstate: re, stocks: stock, crypto: 0, cash, loans: 0, tenantDeposit: 0 },
  fx: { ...RATES }, fxBase: { USD: 0, JPY: 0 },
  cost: { total: cash + 500_000_000 + 20_000_000, stock: 20_000_000, crypto: 0, realEstate: 500_000_000 },
});
const enriched = (month: string, date: string, cash: number, re: number, stock: number): MonthlyAssetSnapshot =>
  ({ month, date, ...point(cash, re, stock) });
const legacy = (month: string, netAsset: number): MonthlyAssetSnapshot => ({ month, netAsset, financialAsset: netAsset });
const live = (cash: number, re: number, stock: number) =>
  ({ ...point(cash, re, stock), date: TODAY, _date: TODAY, _display: TODAY, _isLive: true }) as unknown as Parameters<typeof computeChainCauses>[0]["live"];
const deposit = (id: string, date: string, amount: number) =>
  ({ id, cashId: "c", date, type: "deposit", amount, currency: "KRW", reflected: true }) as AssetData["cashTransactions"][number];

// 운영 형태: 2026-01~07 레거시, 08~10 enrich(10월 = 이번 달, 체인 제외)
const opsMonthly: MonthlyAssetSnapshot[] = [
  ...["01", "02", "03", "04", "05", "06", "07"].map((m, i) => legacy(`2026-${m}`, 600_000_000 + i * 2_000_000)),
  enriched("2026-08", "2026-08-28", 12_000_000, 600_000_000, 25_000_000),
  enriched("2026-09", "2026-09-28", 12_500_000, 610_000_000, 27_000_000),
  enriched("2026-10", "2026-10-03", 13_000_000, 610_000_000, 28_000_000),
];
const LIVE = live(13_000_000, 620_000_000, 30_000_000); // 6.63억
const HERO_DELTA = 664_000_000 - 600_000_000;          // Hero: 올해 종가 upsert 6.64억 − 2025 수동 6억
const opsData = () => {
  const d = data();
  d.cashTransactions = [deposit("j", "2026-03-10", 2_000_000), deposit("s", "2026-09-15", 500_000)];
  return d;
};
const chain = (monthly: MonthlyAssetSnapshot[], d: AssetData, prevValue: number | null = 600_000_000, deltaNet = HERO_DELTA) => {
  const points = resolveYearChain(monthly, 2025, prevValue, TODAY);
  return points && computeChainCauses({ points, live: LIVE, deltaNet, endDate: TODAY, liveCash: 13_000_000, exchangeHistory: {}, assetData: d, rates: RATES });
};

describe("resolveYearChain", () => {
  it("운영 형태: 앵커 = 2025 수동값 12-31, 이어서 올해 enrich 달(이번 달 제외)만", () => {
    const pts = resolveYearChain(opsMonthly, 2025, 600_000_000, TODAY)!;
    expect(pts.map((p) => [p.month, p.date])).toEqual([["2025-12", "2025-12-31"], ["2026-08", "2026-08-28"], ["2026-09", "2026-09-28"]]);
    expect(pts[0].netAsset).toBe(600_000_000);
    expect(pts[0].breakdown).toBeUndefined();
  });
  it("전년 12월 스냅샷이 있으면 수동값 대신 앵커", () => {
    const dec = enriched("2025-12", "2025-12-28", 11_000_000, 580_000_000, 22_000_000);
    expect(resolveYearChain([dec, ...opsMonthly], 2025, 600_000_000, TODAY)![0]).toBe(dec);
  });
  it("전년 1~11월 월 스냅샷은 체인에 들어가지 않는다(C8)", () => {
    const prevYearMonths = ["10", "11"].map((m) => enriched(`2025-${m}`, `2025-${m}-28`, 1, 1, 1));
    expect(resolveYearChain([...prevYearMonths, ...opsMonthly], 2025, 600_000_000, TODAY))
      .toEqual(resolveYearChain(opsMonthly, 2025, 600_000_000, TODAY));
  });
  it("작년 수동값도 전년 12월 스냅샷도 없으면 null(기록 부족)", () => {
    expect(resolveYearChain(opsMonthly, 2025, null, TODAY)).toBeNull();
  });
  it("2027-01: 2026 앵커 + 2027 월만", () => {
    const m = [enriched("2026-11", "2026-11-28", 1, 1, 1), enriched("2026-12", "2026-12-28", 1, 1, 1), enriched("2027-01", "2027-01-02", 1, 1, 1)];
    expect(resolveYearChain(m, 2026, 600, "2027-01-20")!.map((p) => p.month)).toEqual(["2026-12"]);
  });
});

describe("연 원인 — 운영 형태 픽스처(C20)", () => {
  it("5항목 표시(기록 부족 아님)·합계 = Hero 증감·첫 구간 예측 배지", () => {
    const r = chain(opsMonthly, opsData())!;
    const keys = r.mapped.causes.map((c) => c.key);
    expect(keys).toContain("price");
    expect(keys).toContain("valuation");
    expect(keys).toContain("income");
    expect(r.mapped.causes.reduce((s, c) => s + c.amount, 0)).toBe(HERO_DELTA);
    expect(r.mapped.causes.find((c) => c.key === "price")!.estimated).toBe(true); // 연초~8/28 예측 포함
    expect(r.estimatedLabel).toBe("일부 예측");
    expect(r.mapped.causes.find((c) => c.key === "income")!.amount).toBe(2_500_000); // 올해 입금 전액(실측)
  });
  it("실측 구간 원인 = 해당 월 탭 원인의 합(9월 결산 + 10월 진행 중)", () => {
    const d = opsData();
    const aug = opsMonthly[7], sep = opsMonthly[8];
    const month = (start: MonthlyAssetSnapshot, end: MonthlyAssetSnapshot | null, delta: number, endDate: string) =>
      computeSettlementCauses({ start, end, live: LIVE, deltaNet: delta, startDate: start.date!, endDate, liveCash: 13_000_000, exchangeHistory: {}, assetData: d, rates: RATES }).mapped;
    const sepM = month(aug, sep, sep.netAsset - aug.netAsset, sep.date!);
    const octM = month(sep, null, LIVE.netAsset - sep.netAsset, TODAY);
    const yearFromAug = computeChainCauses({ points: [aug, sep], live: LIVE, deltaNet: LIVE.netAsset - aug.netAsset, endDate: TODAY, liveCash: 13_000_000, exchangeHistory: {}, assetData: d, rates: RATES }).mapped;
    const sum = (m: typeof sepM, k: string) => m.causes.find((c) => c.key === k)?.amount ?? 0;
    for (const k of ["price", "valuation", "fx", "income", "unrecorded"]) {
      expect(sum(yearFromAug, k)).toBe(sum(sepM, k) + sum(octM, k));
    }
  });
  it("앵커 12-31·구간 경계일 거래는 한 번만(C15)", () => {
    const d = opsData();
    d.cashTransactions = [deposit("y", "2025-12-31", 9_000_000), deposit("b", "2026-08-28", 700_000)];
    const r = chain(opsMonthly, d)!;
    expect(r.mapped.causes.find((c) => c.key === "income")?.amount).toBe(700_000); // 12-31(전년) 제외, 8/28은 앞 구간 1회
  });
  it("올해 enrich 달 0건 → 앵커 → 실시간 단일 예측 구간, 합계 = Hero", () => {
    const r = chain(opsMonthly.slice(0, 7), opsData())!;
    expect(r.estimatedLabel).toBe("예측");
    expect(r.mapped.causes.reduce((s, c) => s + c.amount, 0)).toBe(HERO_DELTA);
  });
  it("전년 1~11월 스냅샷 유무와 결과 동일(C8)", () => {
    const extra = ["03", "07", "11"].map((m) => enriched(`2025-${m}`, `2025-${m}-28`, 9, 9, 9));
    expect(chain([...extra, ...opsMonthly], opsData())).toEqual(chain(opsMonthly, opsData()));
  });
});
