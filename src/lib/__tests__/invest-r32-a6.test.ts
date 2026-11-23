// 5.142 #277 A6 시작 해마다 계산한 범위
import { describe, expect, it } from "vitest";
import { buildIndexView } from "@/lib/invest/calc";
import { marketHistory as d } from "@/lib/invest/market-history";
import { periodResult, rollingRange } from "@/lib/invest/period";
import { A6_TEXT, a6Bounds } from "@/lib/invest/text";

const views = { spx: buildIndexView(d, "spx"), ndx: buildIndexView(d, "ndx"), kospi: buildIndexView(d, "kospi") };

describe("#277 A6 시작 해마다 계산한 범위", () => {
  const f = (k: "spx" | "ndx" | "kospi", N: number) => { const r = rollingRange(views[k], N)!; return [r.n, +r.min.toFixed(1), +r.max.toFixed(1), r.loss]; };
  it("검산: S&P 10년 56개 −3.0~+16.0% 7개, 20년 46개 +2.7~+13.9% 0개, 나스닥 5년 36개 −15.3~+55.8% 5개, 코스피 10년 35개 −4.7~+21.8% 6개", () => {
    expect(f("spx", 10)).toEqual([56, -3, 16, 7]);
    expect(f("spx", 20)).toEqual([46, 2.7, 13.9, 0]);
    expect(f("ndx", 5)).toEqual([36, -15.3, 55.8, 5]);
    expect(f("kospi", 10)).toEqual([35, -4.7, 21.8, 6]);
  });
  it("최저·최고는 기간 카드 periodResult와 같은 값(해마다 평균)", () => {
    const v = views.spx, r = rollingRange(v, 10)!;
    let min = Infinity;
    for (let s = v.start; s <= v.last - 10; s++) min = Math.min(min, periodResult(v, s, s + 10).lumpCagr);
    expect(r.min).toBe(min);
  });
  it("시작 해 2개 미만(전체)이면 null", () => {
    expect(rollingRange(views.spx, views.spx.last - views.spx.start)).toBeNull();
    expect(rollingRange(views.spx, views.spx.last - views.spx.start - 1)!.n).toBe(2);
  });
  it("정본 문장: k=0 형식·부호·% 1회·해마다 평균은", () => {
    const b = a6Bounds(-3.04, 16.0);
    expect(A6_TEXT.body("S&P 500", 10, 56, b.min, b.max, 7)).toBe("S&P 500에 10년 동안 넣어 둔 경우를 시작 해 56개로 나눠 계산했어요. 해마다 평균은 −3.0~+16.0%였고, 손실로 끝난 시작 해는 7개였어요.");
    const z = a6Bounds(2.7, 13.9);
    expect(A6_TEXT.body("S&P 500", 20, 46, z.min, z.max, 0)).toContain("+2.7~+13.9%였고, 손실로 끝난 시작 해는 0개였어요.");
    expect(a6Bounds(-0.04, 1).min).toBe("0.0");
    expect(A6_TEXT.info(10)).toBe("시작 해마다 그해 말에 한 번에 넣고 10년 뒤 말까지 둔 경우를 따로 계산했어요. 시작 해가 겹쳐 서로 독립된 결과가 아니에요. 손실로 끝난 시작 해는 끝 연말 값이 시작 연말 값보다 낮았던 해예요(배당 제외).");
  });
});
