import { describe, it, expect } from "vitest";
import { COMPOSITION_FORBIDDEN_WORDS, COMPOSITION_KEYS, COMPOSITION_LABELS, buildFxExposureLines } from "../composition";
import { computeFxExposure } from "../asset-report";
import { formatShortCurrency } from "@/lib/number-utils";
import type { AssetData } from "@/types/asset";

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
  it("외화 문구·구성 라벨에 금지어 0건", () => {
    const ex = computeFxExposure(fxData({ usdStock: 3000, jpyCash: 500_000 }), RATES, 20_000_000);
    const l = buildFxExposureLines(ex, 20_000_000)!;
    const texts = [l.ratioLine, l.impactLine, l.caption, ...COMPOSITION_KEYS.map((k) => COMPOSITION_LABELS[k])].join("\n");
    for (const w of COMPOSITION_FORBIDDEN_WORDS) expect(texts).not.toContain(w);
  });
});
