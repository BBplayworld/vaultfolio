// 4.84 A — 가격 눈금: niceTicks({1,2,5}×10^k·정수 곱·2~3줄), formatAxisPrice 표기, 도메인=원본 points(다운샘플 극값 포함), 현재가 문자열 = `현재가` 칸
import { describe, expect, it } from "vitest";
import { formatCurrencyDisplay } from "@/app/(main)/_components/views/detail/asset-detail-tabs";
import { axisGutter, buildPriceAxis, downsample, formatAxisPrice, niceTicks } from "../stock-page";
import type { PricePoint } from "../price-history";

const lin = (lo: number, hi: number, top = 8, bottom = 72) => (v: number) => bottom - ((v - lo) / (hi - lo)) * (bottom - top);
// 가격이 {1,2,5}×10^k인지
const isNice = (v: number) => {
  const e = Math.floor(Math.log10(v) + 1e-9);
  const m = v / Math.pow(10, e);
  return [1, 2, 5, 10].some((x) => Math.abs(m - x) < 1e-9);
};

describe("niceTicks", () => {
  it("KRW 6~7.7만 구간: 눈금 간격은 {1,2,5}×10^k(값은 그 정수배), 2~3개, 도메인 안", () => {
    const { ticks, step } = niceTicks(56000, 78000, lin(56000, 78000), 8, 72);
    expect(ticks.length).toBeGreaterThanOrEqual(2);
    expect(ticks.length).toBeLessThanOrEqual(3);
    expect(isNice(step)).toBe(true);
    for (const t of ticks) {
      expect(t.v).toBeGreaterThanOrEqual(56000);
      expect(t.v).toBeLessThanOrEqual(78000);
      expect(t.v % step).toBe(0);
    }
  });
  it("USD 소수 구간(0.3~0.9): 부동소수 오차 없이 정확한 10진수 값(0.1·0.2·0.5 단위)", () => {
    const { ticks, step } = niceTicks(0.3, 0.9, lin(0.3, 0.9), 8, 72);
    expect(isNice(step)).toBe(true);
    for (const t of ticks) expect(String(t.v)).toMatch(/^\d(\.\d{1,2})?$/); // 0.30000000000000004 같은 값 0
  });
  it("1억대 코인·소형주 구간도 정수 곱 값", () => {
    for (const [lo, hi] of [[98_000_000, 131_000_000], [1180, 1730], [3.1, 3.9]]) {
      const { ticks, step } = niceTicks(lo, hi, lin(lo, hi), 8, 72);
      expect(isNice(step)).toBe(true);
      for (const t of ticks) expect(Math.abs(t.v / step - Math.round(t.v / step))).toBeLessThan(1e-9); // 간격의 정수배
    }
  });
  it("keep으로 제외하고 남은 수가 2~3인 가장 작은 간격, 모두 제외되면 0개(오류 아님)", () => {
    const all = niceTicks(56000, 78000, lin(56000, 78000), 8, 72);
    const none = niceTicks(56000, 78000, lin(56000, 78000), 8, 72, () => false);
    expect(all.ticks.length).toBeGreaterThan(0);
    expect(none.ticks).toEqual([]);
    expect(niceTicks(100, 100, lin(100, 101), 8, 72).ticks).toEqual([]); // 폭 0 방어
  });
  it("플롯 위아래 6px 안쪽만, 눈금 간격은 12px 이상", () => {
    const { ticks } = niceTicks(56000, 78000, lin(56000, 78000), 8, 72);
    for (const t of ticks) {
      expect(t.y).toBeGreaterThanOrEqual(14);
      expect(t.y).toBeLessThanOrEqual(66);
    }
    for (let i = 1; i < ticks.length; i += 1) expect(Math.abs(ticks[i].y - ticks[i - 1].y)).toBeGreaterThanOrEqual(12);
  });
});

describe("formatAxisPrice (A3)", () => {
  it.each([
    [5000, "KRW", 1000, "5,000"],
    [40000, "KRW", 10000, "4만"],
    [75000, "KRW", 5000, "7.5만"],
    [120000, "KRW", 10000, "12만"],
    [1000000, "KRW", 100000, "100만"],
    [150000000, "KRW", 10000000, "1.5억"],
    [0.25, "USD", 0.05, "$0.25"],
    [12.5, "USD", 0.5, "$12.5"],
    [160, "USD", 20, "$160"],
    [1500, "USD", 500, "$1,500"],
    [1500, "JPY", 500, "¥1,500"],
  ])("%s %s → %s", (v, cur, step, out) => {
    expect(formatAxisPrice(v, cur, step)).toBe(out);
  });
});

describe("buildPriceAxis — 도메인은 원본 points + 현재가 (A2)", () => {
  // 원본에는 날카로운 고점(150)이 있고 40점 다운샘플은 그것을 건너뛴다
  const raw: PricePoint[] = Array.from({ length: 250 }, (_, i) => ({ d: `2026-01-${i}`, c: i === 101 ? 150 : 100 + (i % 5) }));
  it("다운샘플 40점은 극값을 놓치지만, 축은 원본 최고가를 포함한다 — 선이 최고 눈금 위로 나가지 않음", () => {
    const sampled = downsample(raw, 40);
    expect(Math.max(...sampled.map((p) => p.c))).toBeLessThan(150); // 픽스처 전제
    const axis = buildPriceAxis({ points: raw, avg: null, price: 104, currency: "KRW", top: 8, plotH: 64 });
    expect(axis.domain[1]).toBeGreaterThan(150);
    expect(axis.yOf(150)).toBeGreaterThanOrEqual(8); // 플롯 위로 삐져나가지 않음
    const sampledAxis = buildPriceAxis({ points: sampled, avg: null, price: 104, currency: "KRW", top: 8, plotH: 64 });
    expect(sampledAxis.domain[1]).toBeLessThan(axis.domain[1]); // 다운샘플 기준이면 달랐을 값
  });
  it("현재가가 범위 밖이어도 도메인에 포함(태그가 밖으로 나가지 않음), 0·null이면 태그 없음", () => {
    const pts: PricePoint[] = [{ d: "a", c: 100 }, { d: "b", c: 110 }];
    const a = buildPriceAxis({ points: pts, avg: null, price: 130, currency: "KRW", top: 8, plotH: 64 });
    expect(a.domain[1]).toBeGreaterThan(130);
    expect(a.todayY).not.toBeNull();
    expect(buildPriceAxis({ points: pts, avg: null, price: 0, currency: "KRW", top: 8, plotH: 64 }).todayY).toBeNull();
    expect(buildPriceAxis({ points: pts, avg: null, price: null, currency: "KRW", top: 8, plotH: 64 }).todayY).toBeNull();
  });
  it("눈금은 평단선과 10px 이상, 현재가 태그와 위 12px·아래 20px 이상 떨어진다", () => {
    const pts: PricePoint[] = Array.from({ length: 60 }, (_, i) => ({ d: `d${i}`, c: 56000 + i * 400 }));
    const a = buildPriceAxis({ points: pts, avg: 61000, price: 70000, currency: "KRW", top: 8, plotH: 64 });
    for (const t of a.ticks) {
      expect(Math.abs(t.y - a.avgY!)).toBeGreaterThanOrEqual(10);
      expect(t.y < a.todayY! ? a.todayY! - t.y : t.y - a.todayY!).toBeGreaterThanOrEqual(t.y < a.todayY! ? 12 : 20);
    }
  });
  it("평단이 범위 밖이면 가장자리에 고정(clamped)", () => {
    const pts: PricePoint[] = [{ d: "a", c: 100 }, { d: "b", c: 200 }];
    const a = buildPriceAxis({ points: pts, avg: 900, price: 150, currency: "KRW", top: 8, plotH: 64 });
    expect(a.clamped).toBe("up");
    expect(a.avgY).toBe(15);
  });
});

describe("현재가 문자열 = `현재가` 칸 (A4, C65)", () => {
  it("KRW·USD 모두 같은 formatter(formatCurrencyDisplay) — 행 `현재가` 칸이 쓰는 함수", () => {
    expect(formatCurrencyDisplay(70000, "KRW")).toBe("70,000원");
    expect(formatCurrencyDisplay(214.3, "USD")).toBe("$214.3");
    expect(axisGutter("70,000원")).toBeCloseTo(54.8, 1);
    expect(axisGutter("$214.3")).toBeGreaterThanOrEqual(46);
    expect(axisGutter("1,000,000,000원")).toBe(76);
  });
});
