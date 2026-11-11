import { describe, expect, it } from "vitest";
import { niceAxisTicks, formatAxisWon, pickVisibleLabels } from "../dividend-axis";

describe("niceAxisTicks", () => {
  it("등간격 둥근 눈금이고 마지막 눈금이 최대값 이상", () => {
    expect(niceAxisTicks(52000)).toEqual([0, 20000, 40000, 60000]);
    expect(niceAxisTicks(60000)).toEqual([0, 20000, 40000, 60000]);
    expect(niceAxisTicks(1989)).toEqual([0, 500, 1000, 1500, 2000]);
    expect(niceAxisTicks(0)).toEqual([0]);
  });
  it("간격이 항상 같다", () => {
    for (const max of [137, 9375, 52000, 163477, 3_400_000]) {
      const t = niceAxisTicks(max);
      const steps = new Set(t.slice(1).map((v, i) => v - t[i]));
      expect(steps.size).toBe(1);
      expect(t.at(-1)!).toBeGreaterThanOrEqual(max);
    }
  });
});

describe("formatAxisWon", () => {
  it("1.5만원을 4만원으로 반올림하지 않는다", () => {
    expect(formatAxisWon(45000)).toBe("4.5만원");
    expect(formatAxisWon(15000)).toBe("1.5만원");
    expect(formatAxisWon(20000)).toBe("2만원");
    expect(formatAxisWon(1500)).toBe("1,500원");
    expect(formatAxisWon(0)).toBe("0원");
    expect(formatAxisWon(150000000)).toBe("1.5억원");
  });
});

describe("pickVisibleLabels", () => {
  it("겹치는 이웃은 큰 값만 남긴다", () => {
    const values = [0, 6825, 0, 9375, 0, 52000, 1875, 1875, 40000, 0, 1989, 0];
    const labels = values.map((v) => (v > 0 ? `${v.toLocaleString()}원` : ""));
    const s = pickVisibleLabels(values, labels, 23);
    expect(s.has(5)).toBe(true);
    expect(s.has(8)).toBe(true);
    expect(s.has(6) && s.has(7)).toBe(false);
    // 남은 라벨끼리 가로로 겹치지 않는다
    const idx = [...s].sort((a, b) => a - b);
    for (let k = 1; k < idx.length; k++) {
      const a = idx[k - 1], b = idx[k];
      expect((b - a) * 23).toBeGreaterThanOrEqual((labels[a].length * 7 + labels[b].length * 7) / 2 + 4);
    }
  });
  it("넓은 칸이면 전부 남긴다", () => {
    const s = pickVisibleLabels([100, 200], ["100원", "200원"], 100);
    expect(s.size).toBe(2);
  });
});
