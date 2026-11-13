// 4.94 #183 S3 — 체험 데모(demo-data.json) 재기준: 순자산 = 웰컴 ±1%, 전일 대비 |Δ| ≤ 0.5%, 허브·결산·7일 원인 일관.
// 기준 시세 가정: JSON의 currentPrice와 환율 USD 1400·JPY 925(@M0 스냅샷 fx와 같은 값). 실시간 시세는 주입 시점 가격이 아니라 JSON 가격을 덮어쓰며 변동하므로
// 스트레스(주식·코인 ±10%, USD ±3%)에서도 |Δ| ≤ 0.5%가 유지되는지를 함께 본다.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
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
