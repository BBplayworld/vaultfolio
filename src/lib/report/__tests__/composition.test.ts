import { describe, it, expect } from "vitest";
import {
  COMPOSITION_FORBIDDEN_WORDS, compositionDisplayRatios, compositionDisplayScale, compositionScaleMode, compositionLabelVisibility, buildFxExposureLines, compositionCellAria, computeCompositionSeries, describeCompositionCell,
  type CompositionLive,
} from "../composition";
import { computeFxExposure } from "../asset-report";
import { formatShortCurrency } from "@/lib/number-utils";
import { MAIN_PALETTE } from "@/config/theme";
import type { AssetData, MonthlyAssetSnapshot } from "@/types/asset";

const bd = (realEstate: number, stocks: number, crypto: number, cash: number) => ({ realEstate, stocks, crypto, cash, loans: 0 });
const snap = (month: string, b?: ReturnType<typeof bd>, date?: string): MonthlyAssetSnapshot => ({
  month, netAsset: 100, financialAsset: 50, ...(b ? { breakdown: b } : {}), ...(date ? { date } : {}),
});
const live = (re: number, st: number, cr: number, ca: number): CompositionLive => ({ realEstateValue: re, stockValue: st, cryptoValue: cr, cashValue: ca });
const NOW = "2026-11";

describe("computeCompositionSeries", () => {
  it("과거 구성 없는 달은 숨기고, 첫 구성 달부터 이번 달까지 축을 만든다", () => {
    const s = computeCompositionSeries(
      [snap("2026-07"), snap("2026-08", bd(60, 20, 5, 15)), snap("2026-10", bd(62, 25, 3, 10), "2026-10-25")],
      live(60, 29, 3, 8), NOW);
    expect(s.state).toBe("bars");
    expect(s.cells.map((c) => c.month)).toEqual(["2026-08", "2026-09", "2026-10", "2026-11"]);
    expect(s.cells[1].empty).toBe(true); // 공백 달
    expect(s.cells.map((c) => c.label)).toEqual(["8월", "9월", "10월", "이번 달"]);
    expect(s.filled).toBe(3);
    expect(describeCompositionCell(s.cells[1])).toBe("이 달은 구성 기록이 없어요");
    expect(describeCompositionCell(s.cells[2])).toBe("10월 25일 기록 · 부동산 62% · 주식 25% · 암호화폐 3% · 현금성 10%");
    expect(compositionCellAria(s.cells[1])).toBe("9월: 구성 기록 없음");
    expect(compositionCellAria(s.cells[2])).toBe("10월: 부동산 62%, 주식 25%, 암호화폐 3%, 현금성 10%");
  });

  it("문장은 직전 값 있는 칸과 비교하고 |Δ| 큰 순 최대 2개, 부호·%p", () => {
    const s = computeCompositionSeries([snap("2026-10", bd(62, 25, 3, 10))], live(58, 29, 3, 10), NOW);
    expect(s.sentence).toBe("지난 기록(10월) 대비 부동산 -4%p, 주식 +4%p"); // 동률은 부동산·주식 순
    const s3 = computeCompositionSeries([snap("2026-10", bd(50, 30, 10, 10))], live(46, 36, 8, 10), NOW);
    expect(s3.sentence).toBe("지난 기록(10월) 대비 주식 +6%p, 부동산 -4%p"); // 3개 이상 변화도 2개만
  });

  it("반올림 Δ가 0이면 문장에 안 나오고, 전부 1 미만이면 안내 문장", () => {
    const s = computeCompositionSeries([snap("2026-10", bd(62, 25, 3, 10))], live(62.3, 24.9, 3, 9.8), NOW);
    expect(s.sentence).toBe("지난 기록(10월) 대비 모든 자산군 변화가 1%p 미만이에요");
  });

  it("직전 칸이 지난해면 25년 12월 표기, 1월 칸 라벨은 연도 포함", () => {
    const s = computeCompositionSeries([snap("2025-12", bd(50, 50, 0, 0)), snap("2026-01", bd(50, 50, 0, 0))], live(50, 50, 0, 0), "2026-01");
    expect(s.cells.map((c) => c.label)).toEqual(["12월", "이번 달"]);
    const t = computeCompositionSeries([snap("2025-12", bd(50, 50, 0, 0))], live(40, 60, 0, 0), "2026-02");
    expect(t.cells.map((c) => c.label)).toEqual(["12월", "26.1", "이번 달"]);
    expect(t.cells[1].empty).toBe(true);
    const u = computeCompositionSeries([snap("2025-12", bd(50, 50, 0, 0))], live(40, 60, 0, 0), "2026-01");
    expect(u.sentence).toBe("지난 기록(25년 12월) 대비 부동산 -10%p, 주식 +10%p");
  });

  it("상태: 자산 0 숨김 / 이번 달만 single / 음수는 0 처리", () => {
    expect(computeCompositionSeries([snap("2026-10", bd(1, 1, 1, 1))], live(0, 0, 0, 0), NOW).state).toBe("hidden");
    expect(computeCompositionSeries([], live(0, 0, 0, -5), NOW).state).toBe("hidden");
    const one = computeCompositionSeries([snap("2026-10")], live(10, 0, 0, 0), NOW);
    expect(one.state).toBe("single");
    expect(one.sentence).toBeNull();
    const neg = computeCompositionSeries([], live(50, 50, 0, -30), NOW);
    expect(neg.cells[0].ratios!.cash).toBe(0);
  });

  it("미래 달·13개월 밖·이번 달 스냅샷은 쓰지 않는다", () => {
    const s = computeCompositionSeries(
      [snap("2025-10", bd(1, 1, 1, 1)), snap("2026-11", bd(1, 1, 1, 1)), snap("2026-12", bd(1, 1, 1, 1))],
      live(10, 0, 0, 0), NOW);
    expect(s.state).toBe("single");
  });

  it("색: 이번 달 최대군 = MAIN_PALETTE[0], 나머지 [3]부터, 부채색 [1][2] 미사용, 과거에만 값이 있는 군도 색을 받는다", () => {
    const s = computeCompositionSeries([snap("2026-10", bd(10, 20, 30, 40))], live(60, 25, 0, 15), NOW);
    expect(s.legendKeys).toEqual(["realEstate", "stocks", "crypto", "cash"]);
    expect(s.colors.realEstate).toBe(MAIN_PALETTE[0]);
    expect(s.colors.stocks).toBe(MAIN_PALETTE[3]);
    expect(s.colors.crypto).toBe(MAIN_PALETTE[4]);
    expect(s.colors.cash).toBe(MAIN_PALETTE[5]);
    expect(Object.values(s.colors)).not.toContain(MAIN_PALETTE[1]);
    expect(Object.values(s.colors)).not.toContain(MAIN_PALETTE[2]);
  });

  it("이번 달 비중은 summary xxxValue / totalValue toFixed(0)와 같다", () => {
    const s = computeCompositionSeries([], live(6_200, 2_500, 300, 1_000), NOW);
    expect(s.cells[0].ratios!.realEstate.toFixed(0)).toBe(((6200 / 10000) * 100).toFixed(0));
    expect(s.cells[0].ratios!.crypto.toFixed(0)).toBe("3");
  });

  it("F-REAL-1: 운영 기기 형태(3·5월 구성 없음, 7월 date 없음, 9월 공백)", () => {
    const s = computeCompositionSeries(
      [snap("2026-03"), snap("2026-05"), snap("2026-07", bd(600, 200, 30, 170)), snap("2026-08", bd(610, 210, 30, 150)), snap("2026-10", bd(620, 250, 30, 100), "2026-10-25")],
      live(630, 280, 30, 60), NOW);
    expect(s.cells.map((c) => c.month)).toEqual(["2026-07", "2026-08", "2026-09", "2026-10", "2026-11"]);
    expect(s.cells[2].empty).toBe(true);
    expect(describeCompositionCell(s.cells[0])).toBe("7월 · 부동산 60% · 주식 20% · 암호화폐 3% · 현금성 17%");
    expect(s.sentence).toBe("지난 기록(10월) 대비 현금성 -4%p, 주식 +3%p");
  });

  it("F-REAL-2: 구성 있는 과거 달 0개 → single", () => {
    const s = computeCompositionSeries([snap("2026-03"), snap("2026-05"), snap("2026-09")], live(5, 5, 5, 5), NOW);
    expect(s.state).toBe("single");
    expect(s.cells).toHaveLength(1);
  });
});

const fxData = (o: { usdStock?: number; usdCash?: number; jpyCash?: number; krwStock?: number }): AssetData => ({
  stocks: [
    ...(o.usdStock ? [{ currency: "USD", quantity: 1, currentPrice: o.usdStock }] : []),
    ...(o.krwStock ? [{ currency: "KRW", quantity: 1, currentPrice: o.krwStock }] : []),
  ],
  cash: [
    ...(o.usdCash ? [{ currency: "USD", balance: o.usdCash }] : []),
    ...(o.jpyCash ? [{ currency: "JPY", balance: o.jpyCash }] : []),
    { currency: "KRW", balance: 1_000_000 },
  ],
} as unknown as AssetData);
const RATES = { USD: 1400, JPY: 900 };

describe("buildFxExposureLines", () => {
  it("USD 주식 + USD 현금 + JPY 현금: N·통화별·X가 computeFxExposure와 일치", () => {
    const total = 20_000_000;
    const ex = computeFxExposure(fxData({ usdStock: 3000, usdCash: 1000, jpyCash: 500_000 }), RATES, total);
    const l = buildFxExposureLines(ex, total)!;
    const sum = ex.reduce((s, e) => s + e.ratio, 0);
    const usd = ex.find((e) => e.currency === "USD")!, jpy = ex.find((e) => e.currency === "JPY")!;
    expect(l.ratioLine).toBe(`외화 자산 비중 ${sum.toFixed(0)}% (달러 ${usd.ratio.toFixed(0)}% · 엔 ${jpy.ratio.toFixed(0)}%)`);
    const x = Math.round(ex.reduce((s, e) => s + e.exposureKrw, 0) * 0.01);
    expect(l.impactLine).toBe(`환율이 1% 움직이면 순자산이 약 ±${formatShortCurrency(x)} 움직여요`);
    expect(l.caption).toBe("주식·현금 중 달러·엔 자산, 총자산 기준");
  });
  it("통화 1개면 (달러)만, 외화 0이면 null, 총자산 0이면 null", () => {
    const ex = computeFxExposure(fxData({ usdCash: 1000 }), RATES, 10_000_000);
    expect(buildFxExposureLines(ex, 10_000_000)!.ratioLine).toBe("외화 자산 비중 14% (달러)");
    expect(buildFxExposureLines(computeFxExposure(fxData({ krwStock: 1000 }), RATES, 10_000_000), 10_000_000)).toBeNull();
    expect(buildFxExposureLines(ex, 0)).toBeNull();
  });
  it("0.5% 미만은 1% 미만, X가 0원으로 반올림되면 둘째 줄만 숨김", () => {
    const tiny = [{ currency: "USD" as const, exposureKrw: 40, ratio: 0.0001, per10Won: 0 }];
    const l = buildFxExposureLines(tiny, 1e9)!;
    expect(l.ratioLine).toBe("외화 자산 비중 1% 미만 (달러)");
    expect(l.impactLine).toBeNull();
  });
  it("F-REAL-3: 해외 자산 없음 → null", () => {
    expect(buildFxExposureLines([], 5e7)).toBeNull();
  });
});

describe("금지어", () => {
  it("새 문자열에 금지어 0건", () => {
    const ex = computeFxExposure(fxData({ usdStock: 3000, jpyCash: 500_000 }), RATES, 20_000_000);
    const l = buildFxExposureLines(ex, 20_000_000)!;
    const s = computeCompositionSeries([snap("2026-10", bd(62, 25, 3, 10))], live(58, 29, 3, 7), NOW);
    const texts = [l.ratioLine, l.impactLine, l.caption, s.sentence, ...s.cells.map(describeCompositionCell), ...s.cells.map(compositionCellAria),
      "이 달은 구성 기록이 없어요", "다음 달 기록부터 구성 변화가 보여요", "기록이 쌓이면 최대 13개월까지 보여요", "자산 구성 변화", "총자산 기준"].join("\n");
    for (const w of COMPOSITION_FORBIDDEN_WORDS) expect(texts).not.toContain(w);
  });
});

describe("compositionLabelVisibility", () => {
  const shown = (n: number) => compositionLabelVisibility(n).map((v) => (v ? 1 : 0)).join("");
  it("8칸 이하는 전부 표시, 마지막 칸은 항상 표시", () => {
    expect(shown(2)).toBe("11");
    expect(shown(5)).toBe("11111");
    expect(shown(8)).toBe("11111111");
  });
  it("9칸 이상은 마지막부터 한 칸씩 건너뛰어 표시 — 표시 라벨끼리 인접하지 않는다", () => {
    expect(shown(13)).toBe("1010101010101");
    expect(shown(9)).toBe("101010101");
    expect(shown(10)).toBe("0101010101");
    for (const n of [9, 10, 11, 12, 13]) expect(shown(n)).not.toMatch(/11/);
  });
});

describe("표시용 보정 스케일(#4.44)", () => {
  const r = (realEstate: number, stocks: number, crypto: number, cash: number) => ({ realEstate, stocks, crypto, cash });
  it("작은 비중을 최소 높이로 올리고 합 100을 유지한다", () => {
    const d = compositionDisplayRatios(r(95, 3, 1, 1));
    expect(d.stocks).toBe(7);
    expect(d.crypto).toBe(7);
    expect(d.cash).toBe(7);
    expect(d.realEstate).toBeCloseTo(79, 5);
    expect(d.realEstate + d.stocks + d.crypto + d.cash).toBeCloseTo(100, 5);
  });
  it("0%는 0 유지, 충분히 큰 비중은 그대로", () => {
    expect(compositionDisplayRatios(r(60, 40, 0, 0))).toEqual(r(60, 40, 0, 0));
    const d = compositionDisplayRatios(r(90, 8, 2, 0));
    expect(d.cash).toBe(0);
    expect(d.crypto).toBe(7);
    expect(d.realEstate + d.stocks + d.crypto).toBeCloseTo(100, 5);
  });
  it("모드 결정: 10% 미만 자산군이 있으면 corrected, 없으면 linear", () => {
    const a = computeCompositionSeries([snap("2026-10", bd(60, 30, 5, 5))], live(70, 20, 5, 5), NOW);
    expect(compositionScaleMode(a.cells)).toBe("corrected");
    const b = computeCompositionSeries([snap("2026-10", bd(50, 30, 10, 10))], live(40, 30, 15, 15), NOW);
    expect(compositionScaleMode(b.cells)).toBe("linear");
  });
  it("표시 스케일: linear는 그대로, corrected는 √ 보정 + 최소 7%, 95/3/1/1에서 3% > 1%", () => {
    const x = r(95, 3, 1, 1);
    expect(compositionDisplayScale(x, "linear")).toEqual(x);
    const d = compositionDisplayScale(x, "corrected");
    expect(d.stocks).toBeGreaterThan(d.crypto);
    expect(d.crypto).toBeGreaterThanOrEqual(7);
    expect(d.realEstate + d.stocks + d.crypto + d.cash).toBeCloseTo(100, 5);
    expect(d.realEstate).toBeLessThan(80);
  });
});
