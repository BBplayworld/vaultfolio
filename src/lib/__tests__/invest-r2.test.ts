import { describe, expect, it } from "vitest";
import { buildIndexView, blsYear } from "../invest/calc";
import { marketHistory as d } from "../invest/market-history";

const V = { spx: buildIndexView(d, "spx"), ndx: buildIndexView(d, "ndx"), kospi: buildIndexView(d, "kospi") };

describe("R2-3 같은 해 다른 지수(view.same)", () => {
  it("현재 지수 제외·값 = 각 지수 연간 등락 정본, 2008 S&P 화면에는 나스닥·코스피", () => {
    const s = V.spx.same[2008];
    expect(s.map((x) => x.label)).toEqual(["나스닥100", "코스피"]);
    expect(s[0].ret).toBe(V.ndx.ret[2008 - V.ndx.start]);
    expect(s[1].ret).toBe(V.kospi.ret[2008 - V.kospi.start]);
  });
  it("자료가 없는 지수는 생략: 1970 S&P는 나스닥·코스피 둘 다 없어 줄 0, 1990 S&P는 나스닥만 아닌 둘 다 있음", () => {
    expect(V.spx.same[1970]).toBeUndefined();
    expect(V.spx.same[1990]?.length).toBe(2);
    expect(V.spx.same[1983]?.map((x) => x.label)).toEqual(["코스피"]);
    expect(V.ndx.same[1986]?.map((x) => x.label)).toEqual(["S&P 500", "코스피"]);
  });
  it("S&P 값은 S&P 자신의 view.ret과 같은 식(Damodaran 연말값)", () => {
    expect(V.kospi.same[2008].find((x) => x.label === "S&P 500")?.ret).toBe(V.spx.ret[2008 - V.spx.start]);
  });
});

describe("R2-1 연도별 표 물가·실업률", () => {
  it("미국 지수 행에만 값, 한국 지수는 null, 2025는 빈 칸(10월 미공표)", () => {
    const r = V.spx.tbl.find((x) => x.y === 2022)!;
    expect(r.cpi).toBe(8);
    expect(r.un).toBe(3.7); // 월 12개 평균 3.65(BLS 공표 연평균 3.6과 반올림 차이 0.1)
    expect(V.kospi.tbl.every((x) => x.cpi == null && x.un == null)).toBe(true);
    const r25 = V.spx.tbl.find((x) => x.y === 2025)!;
    expect(r25.cpi).toBeNull();
    expect(r25.un).toBeNull();
  });
  it("계단선 마지막 값 해는 2024", () => {
    const ys = d.bls.filter((r) => r.cpi != null).map((r) => r.y);
    expect(Math.max(...ys)).toBe(2024);
    expect(blsYear(d, 2024).cpi).toBe(2.9);
  });
});
