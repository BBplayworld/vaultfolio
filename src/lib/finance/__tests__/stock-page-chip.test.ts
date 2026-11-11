// 4.84 B — 평단 칩 폴백 placeAvgChip: plot(기본 4곳·스캔) / short(짧은 글자) / gutter(가격 칸) 3분기, 칩이 가격선·점을 가리지 않음
import { describe, expect, it } from "vitest";
import { CHIP_H, placeAvgChip, type ChipPt } from "../stock-page";

const FULL = "내 평단 61,000원"; // 폭 ≈ 90.8
const SHORT = "평단 6.1만"; // 폭 ≈ 58.8
const base = { avgY: 40, left: 12, plotW: 200, maxY: 200, full: FULL, short: SHORT };
const cw = (t: string) => t.length * 6.4 + 14;

// 평단선 주변 세로 띠를 x 구간에서 촘촘히 막는 가격선 점
const wall = (x0: number, x1: number, avgY = 40): ChipPt[] => {
  const out: ChipPt[] = [];
  for (let x = x0; x <= x1; x += 4) for (const dy of [-25, -10, 14, 30, 45, 60, 75]) out.push({ x, y: avgY + dy });
  return out;
};
const covers = (r: { x: number; y: number; text: string }, pts: ChipPt[], dots: ChipPt[] = []) =>
  pts.some((q) => q.x >= r.x - 2 && q.x <= r.x + cw(r.text) + 2 && q.y >= r.y - 2 && q.y <= r.y + CHIP_H + 2) ||
  dots.some((q) => q.x >= r.x - 8 && q.x <= r.x + cw(r.text) + 8 && q.y >= r.y - 8 && q.y <= r.y + CHIP_H + 8);

describe("placeAvgChip 3분기", () => {
  it("plot: 선이 멀면 기본 4곳 중 앞 후보(왼쪽 끝·선 위)", () => {
    const r = placeAvgChip({ ...base, pts: [{ x: 100, y: 150 }], dots: [] });
    expect(r.mode).toBe("plot");
    expect(r.text).toBe(FULL);
    expect(r.x).toBe(12);
    expect(r.y).toBe(40 - CHIP_H - 4);
  });
  it("plot(스캔): 기본 4곳은 모두 막혀도 평단선 가까운 오프셋에 빈 칸이 있으면 전체 글자 유지", () => {
    // 위·아래 4곳 박스를 막는 점(선 위 y 16~38, 아래 y 42~64), 더 아래(+20 오프셋, y 60~82)는 비어 있음
    const pts: ChipPt[] = [];
    for (let x = 12; x <= 212; x += 4) pts.push({ x, y: 25 }, { x, y: 50 });
    const r = placeAvgChip({ ...base, pts, dots: [] });
    expect(r.mode).toBe("plot");
    expect(covers(r, pts)).toBe(false);
  });
  it("short: 전체 글자가 들어갈 틈이 없고 짧은 글자는 들어가면 `평단 6.1만`", () => {
    const pts = [...wall(12, 80), ...wall(160, 212)]; // 80~160 사이 틈 ≈ 80px: 전체(91+4) 불가, 짧은 글자(59+4) 가능
    const r = placeAvgChip({ ...base, pts, dots: [] });
    expect(r.mode).toBe("short");
    expect(r.text).toBe(SHORT);
    expect(covers(r, pts)).toBe(false);
  });
  it("gutter: 어디에도 들어갈 곳이 없으면 가격 칸 라벨(plot 안에 글자 0)", () => {
    const r = placeAvgChip({ ...base, pts: wall(12, 212), dots: [] });
    expect(r.mode).toBe("gutter");
    expect(r.text).toBe("");
  });
  it("매수·매도 점 ±8px 안도 겹침으로 본다", () => {
    const dots: ChipPt[] = [{ x: 30, y: 30 }]; // 왼쪽 위 후보 안
    const r = placeAvgChip({ ...base, pts: [], dots });
    expect(r.mode).toBe("plot");
    expect(covers(r, [], dots)).toBe(false);
  });
  it("플롯보다 칩이 넓으면(320 좁은 차트) 전체 글자 후보 없음 → short", () => {
    const r = placeAvgChip({ ...base, plotW: 80, pts: [], dots: [] });
    expect(r.mode).toBe("short");
  });
  it("삼성 5년형 진동 데이터(전 구간 평단선을 가로지름): 어떤 모드든 칩 박스가 가격선을 가리지 않는다", () => {
    const n = 260;
    const pts = Array.from({ length: n }, (_, i) => ({ x: 12 + (i / (n - 1)) * 200, y: 40 + Math.sin(i / 6) * 28 + Math.sin(i / 1.7) * 6 }));
    const r = placeAvgChip({ ...base, pts, dots: [] });
    if (r.mode !== "gutter") expect(covers(r, pts)).toBe(false);
    expect(["plot", "short", "gutter"]).toContain(r.mode);
  });
  it("위쪽 경계 밖(y<0)·아래 경계 밖 후보는 쓰지 않는다", () => {
    const r = placeAvgChip({ ...base, avgY: 10, pts: [], dots: [] });
    expect(r.y).toBeGreaterThanOrEqual(0);
    expect(r.y + CHIP_H).toBeLessThanOrEqual(200);
  });
});
