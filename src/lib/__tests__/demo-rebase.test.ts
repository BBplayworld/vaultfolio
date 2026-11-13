// 4.94 #183 S3 — 체험 데모(demo-data.json) 재기준: 순자산 = 웰컴 ±1%, 전일 대비 |Δ| ≤ 0.5%, 허브·결산·7일 원인 일관.
// 기준 시세 가정: JSON의 currentPrice와 환율 USD 1400·JPY 925(@M0 스냅샷 fx와 같은 값). 실시간 시세는 주입 시점 가격이 아니라 JSON 가격을 덮어쓰며 변동하므로
// 스트레스(주식·코인 ±10%, USD ±3%)에서도 |Δ| ≤ 0.5%가 유지되는지를 함께 본다.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { pickRebaseRef, rebaseDemoRows, rebaseRatio } from "../preview/demo-live-rebase";
import { materializeDemo } from "../preview/demo-payload";
import { computeAssetCost, computeNetAsset } from "@/contexts/asset-data-context";
import { buildLiveAttributionCurr } from "../report/asset-report";
import { resolveSettlementWindow, UNRECORDED_HINT_RATIO } from "../report/settlement";
import { computeSettlementCauses, settlementDelta } from "@/app/(main)/_components/views/activity/change-hero";
import type { AssetData, MonthlyAssetSnapshot } from "@/types/asset";
import previewData from "@/app/(main)/_components/layout/onboarding/welcome-preview-data.json";

const demoRaw = JSON.parse(readFileSync(path.resolve(__dirname, "../preview/demo-data.json"), "utf8"));
const TODAY = "2026-11-13";
const BASE = { USD: 1400, JPY: 925 };
type P = { assetData: AssetData; snapshots: { monthly: MonthlyAssetSnapshot[]; daily: (MonthlyAssetSnapshot & { date: string })[] } };
const load = (today = TODAY) => materializeDemo(demoRaw, today) as unknown as P;

/** 시세 스트레스 — 주식·코인 가격 ×pm, USD 환율 ×fm */
function stress(data: AssetData, pm: number, fm: number): { data: AssetData; rates: { USD: number; JPY: number } } {
  return {
    data: {
      ...data,
      stocks: data.stocks.map((s) => ({ ...s, currentPrice: s.currentPrice * pm })),
      crypto: data.crypto.map((c) => ({ ...c, currentPrice: c.currentPrice * pm })),
    },
    rates: { USD: BASE.USD * fm, JPY: BASE.JPY },
  };
}

function causesFrom(p: P, data: AssetData, rates: typeof BASE, start: MonthlyAssetSnapshot | null, startDate: string | null, today: string, w?: ReturnType<typeof resolveSettlementWindow>) {
  const n = computeNetAsset(data, rates);
  const c = computeAssetCost(data, rates);
  const live = buildLiveAttributionCurr(data, rates, { ...n, ...c } as never);
  const win = w ?? ({ start, end: null, startDate, endDate: today } as never);
  const { delta } = settlementDelta(win as never, n.netAsset);
  const { mapped } = computeSettlementCauses({
    start, end: null, live, deltaNet: delta, startDate, endDate: today, liveCash: n.cashValue, exchangeHistory: {}, assetData: data, rates,
  });
  return { delta, unrecorded: mapped.causes.find((x) => x.key === "unrecorded")?.amount ?? 0, sum: mapped.causes.reduce((s, x) => s + x.amount, 0), net: n.netAsset };
}

describe("체험 순자산 = 웰컴 미리보기 ±1% (안 B, demo_re_1.currentValue만)", () => {
  const w = previewData as unknown as { exchangeRates: { USD: number }; stocks: { quantity: number; currentPrice: number }[]; realEstateValue: number; loanValue: number; cryptoValue: number; cashValue: number };
  const welcome = Math.round(w.stocks.reduce((s, x) => s + x.quantity * x.currentPrice, 0) * w.exchangeRates.USD) + w.realEstateValue + w.cryptoValue + w.cashValue - w.loanValue;
  it("웰컴 합계 551,159,778원(기준값 확인)", () => expect(welcome).toBe(551_159_778));
  it("체험 JSON 가격 기준 순자산이 웰컴 합계 ±1% 안", () => {
    const net = computeNetAsset(load().assetData, BASE).netAsset;
    expect(Math.abs(net - welcome) / welcome).toBeLessThanOrEqual(0.01);
  });
  it("부동산만 조정: 현재가 약 5.36억·매입가 5억(수익률 +5~10%), 연 탭 증감 0~15%", () => {
    const p = load();
    const re = p.assetData.realEstate[0];
    expect(re.purchasePrice).toBe(500_000_000);
    expect(re.currentValue / re.purchasePrice).toBeGreaterThan(1.05);
    expect(re.currentValue / re.purchasePrice).toBeLessThan(1.1);
    const py = (p.assetData.yearlyNetAssets as { netAsset: number }[])[0].netAsset;
    const net = computeNetAsset(p.assetData, BASE).netAsset;
    expect((net - py) / py).toBeGreaterThan(0);
    expect((net - py) / py).toBeLessThan(0.15);
  });
});

describe("체험 홈 Hero 전일 대비 |Δ| ≤ 순자산의 0.5%", () => {
  const yesterday = (p: P) => p.snapshots.daily.find((d) => d.date === "2026-11-12")!;
  it("기준 시세에서 어제 기록과 현재 순자산 차 ≤ 0.5%", () => {
    const p = load();
    const net = computeNetAsset(p.assetData, BASE).netAsset;
    expect(Math.abs(net - yesterday(p).netAsset) / net).toBeLessThanOrEqual(0.005);
  });
  it.each([
    ["주식·코인 +10%", 1.1, 1],
    ["주식·코인 -10%", 0.9, 1],
    ["USD +3%", 1, 1.03],
    ["USD -3%", 1, 0.97],
    ["모두 불리하게(+10%·+3%)", 1.1, 1.03],
    ["모두 불리하게(-10%·-3%)", 0.9, 0.97],
  ])("스트레스 %s 후에도 ≤ 0.5%", (_n, pm, fm) => {
    const p = load();
    const s = stress(p.assetData, pm, fm);
    const net = computeNetAsset(s.data, s.rates).netAsset;
    expect(Math.abs(net - yesterday(p).netAsset) / net).toBeLessThanOrEqual(0.005);
  });
  it("D-1 ≥ D-2 유지(4.92)", () => {
    const d = load().snapshots.daily;
    expect(d.find((x) => x.date === "2026-11-12")!.netAsset).toBeGreaterThanOrEqual(d.find((x) => x.date === "2026-11-11")!.netAsset);
  });
});

describe("체험 7일·허브·결산 — 기록 안 된 변화 < 50%", () => {
  it.each(["2026-11-13", "2026-12-20", "2027-03-05"])("%s: 7일(D-7 → 현재)", (today) => {
    const p = load(today);
    const d7 = p.snapshots.daily.find((d) => d.breakdown)!;
    const start = { ...d7, month: d7.date.slice(0, 7) } as MonthlyAssetSnapshot;
    for (const [pm, fm] of [[1, 1], [1.1, 1.03], [0.9, 0.97]]) {
      const s = stress(p.assetData, pm, fm);
      const r = causesFrom(p, s.data, s.rates, start, d7.date, today);
      expect(Math.abs(r.unrecorded)).toBeLessThan(Math.abs(r.delta) * UNRECORDED_HINT_RATIO);
      expect(r.sum).toBe(r.delta);
    }
  });
  it.each(["2026-11-13", "2026-12-20"])("%s: 허브·결산(직전 월 기록 → 현재) 증감이 상식 범위이고 원인 합 = Hero 증감", (today) => {
    const p = load(today);
    const w = resolveSettlementWindow(p.snapshots.monthly, today.slice(0, 7), today);
    expect(w.start?.breakdown).toBeTruthy();
    const r = causesFrom(p, p.assetData, BASE, w.start, w.startDate, today, w);
    expect(Math.abs(r.delta) / r.net).toBeLessThan(0.05);
    expect(Math.abs(r.unrecorded)).toBeLessThan(Math.abs(r.delta) * UNRECORDED_HINT_RATIO);
    expect(r.sum).toBe(r.delta);
  });
  it("직전 월 기록의 구성이 보유 종목×JSON 가격과 같은 수준(주식 ±10%)", () => {
    const p = load();
    const stocks = computeNetAsset(p.assetData, BASE).stockValue;
    const m1 = p.snapshots.monthly.filter((m) => m.breakdown).at(-1)!;
    expect(Math.abs(m1.breakdown!.stocks - stocks) / stocks).toBeLessThan(0.1);
  });
});

// ui-review R1 — 체험은 실시간 시세로 JSON 가격을 덮어쓴다. 스냅샷을 현재 평가/기준 평가 배율로 재기준(demo-live-rebase)하면
// 시세가 얼마나 움직여도 전일 대비·7일·허브가 가짜 급등락이 되지 않는다.

/** 실제 시세 근사(2026-11 ui-review 관측: 삼성 213,500·하이닉스 1,288,500·AAPL 354.88·BTC 95,840,000, USD 1470) */
const REAL: Record<string, number> = {
  demo_st_samsung: 213_500, demo_st_hynix: 1_288_500, demo_st_aapl: 354.88, demo_st_nvda: 190,
  demo_st_pension: 26_000, demo_st_isa: 105_000, demo_cr_btc: 95_840_000,
};

function liveAt(p: P, scale: number, usd: number) {
  const data = {
    ...p.assetData,
    stocks: p.assetData.stocks.map((s) => ({ ...s, currentPrice: (REAL[s.id] ?? s.currentPrice) * scale })),
    crypto: p.assetData.crypto.map((c) => ({ ...c, currentPrice: (REAL[c.id] ?? c.currentPrice) * scale })),
  } as AssetData;
  return { data, rates: { USD: usd, JPY: 925 } };
}

function rebased(p: P, data: AssetData, rates: typeof BASE, today: string) {
  const ref = pickRebaseRef(p.snapshots.daily as never, today)!;
  const n = computeNetAsset(data, rates);
  const ks = rebaseRatio(n.stockValue, ref.stocks);
  const kc = rebaseRatio(n.cryptoValue, ref.crypto);
  return {
    n,
    daily: rebaseDemoRows(p.snapshots.daily as never, ref, ks, kc) as unknown as P["snapshots"]["daily"],
    monthly: rebaseDemoRows(p.snapshots.monthly as never, ref, ks, kc) as unknown as MonthlyAssetSnapshot[],
  };
}

describe("실시간 시세 재기준(R1) — 실제 시세 근사 + 0.4x~2.5x 드리프트", () => {
  it("재기준 없이는 실제 시세에서 가짜 급등(회귀 확인)", () => {
    const p = load();
    const { data, rates } = liveAt(p, 1, 1470);
    const n = computeNetAsset(data, rates).netAsset;
    const d1 = p.snapshots.daily.find((d) => d.date === "2026-11-12")!.netAsset;
    expect(Math.abs(n - d1) / n).toBeGreaterThan(0.02);
  });
  it.each([0.4, 0.7, 1, 1.5, 2.5])("시세 ×%s·USD 1470: 전일 대비 |Δ| ≤ 0.5%, 7일 기록 안 된 변화 < 50%, 허브·결산 원인 합 = 증감", (scale) => {
    for (const today of ["2026-11-13", "2026-12-20"]) {
      const p = load(today);
      const { data, rates } = liveAt(p, scale, 1470);
      const r = rebased(p, data, rates, today);
      const yest = r.daily.find((d) => d.date === "2026-11-12" || d.date === `${today.slice(0, 8)}${String(Number(today.slice(8)) - 1).padStart(2, "0")}`)!;
      expect(Math.abs(r.n.netAsset - yest.netAsset) / r.n.netAsset).toBeLessThanOrEqual(0.005);
      const d7 = r.daily.find((d) => d.breakdown)!;
      const s7 = { ...d7, month: d7.date.slice(0, 7) } as MonthlyAssetSnapshot;
      const c7 = causesFrom(p, data, rates, s7, d7.date, today);
      expect(Math.abs(c7.unrecorded)).toBeLessThan(Math.abs(c7.delta) * UNRECORDED_HINT_RATIO);
      const w = resolveSettlementWindow(r.monthly, today.slice(0, 7), today);
      const cm = causesFrom(p, data, rates, w.start, w.startDate, today, w);
      expect(Math.abs(cm.delta) / cm.net).toBeLessThan(0.05); // 허브 +5.4% 같은 가짜 급등 없음
      expect(Math.abs(cm.unrecorded)).toBeLessThan(Math.abs(cm.delta) * UNRECORDED_HINT_RATIO);
      expect(cm.sum).toBe(cm.delta);
    }
  });
  it("부동산·현금·대출·투입원가는 그대로, net-only 기록도 같은 몫만 이동", () => {
    const p = load();
    const { data, rates } = liveAt(p, 2.5, 1470);
    const r = rebased(p, data, rates, TODAY);
    const o = p.snapshots.daily.find((d) => d.date === "2026-11-12")! as never as { breakdown: Record<string, number>; cost: unknown };
    const n = r.daily.find((d) => d.date === "2026-11-12")! as never as { breakdown: Record<string, number>; cost: unknown };
    for (const k of ["realEstate", "cash", "loans"]) expect(n.breakdown[k]).toBe(o.breakdown[k]);
    expect(n.cost).toEqual(o.cost);
    const net0 = p.snapshots.daily.find((d) => !d.breakdown)!.netAsset;
    expect(r.daily.find((d) => !d.breakdown)!.netAsset).toBeGreaterThan(net0);
  });
  it("배율 1이면 값 불변, 입력은 바꾸지 않는다", () => {
    const p = load();
    const before = JSON.stringify(p.snapshots.daily);
    expect(rebaseDemoRows(p.snapshots.daily as never, { stocks: 1, crypto: 1 }, 1, 1)).toEqual(p.snapshots.daily);
    expect(JSON.stringify(p.snapshots.daily)).toBe(before);
    expect(rebaseRatio(5, 0)).toBe(1);
  });
});
