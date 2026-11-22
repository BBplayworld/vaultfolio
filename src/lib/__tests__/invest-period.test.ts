import { describe, expect, it } from "vitest";
import { buildIndexView } from "../invest/calc";
import { averageHoldYears, defaultPeriod, fixPeriod, periodPresets, periodResult, periodText } from "../invest/period";
import { marketHistory as data } from "../invest/market-history";

const V = { spx: buildIndexView(data, "spx"), ndx: buildIndexView(data, "ndx"), kospi: buildIndexView(data, "kospi") };
const r = (k: keyof typeof V, a: number, b: number) => periodResult(V[k], a, b);
const f2 = (x: number) => +x.toFixed(2);

describe("R4.1 기간 수익률 계산 — AC6 값(평균 방식)", () => {
  it("S&P 2015→2025: 한 번에 3.35배·+235%·+12.85% / 매달 2.01배·+101%·평균 5.0년", () => {
    const p = r("spx", 2015, 2025), t = periodText(p);
    expect([t.lumpMult, t.lumpTotal, t.lumpCagr]).toEqual(["3.35배", "+235%", "+12.85%"]);
    expect([t.dcaMult, t.dcaTotal, t.hold]).toEqual(["2.01배", "+101%", "5.0"]);
    expect(f2(p.dcaIrr)).toBe(13.6);
  });
  it("S&P 1999→2012: 0.97배·−3%·−0.23% / 1.19배·+19%", () => {
    const t = periodText(r("spx", 1999, 2012));
    expect([t.lumpMult, t.lumpTotal, t.lumpCagr, t.dcaMult, t.dcaTotal]).toEqual(["0.97배", "−3%", "−0.23%", "1.19배", "+19%"]);
    expect(f2(r("spx", 1999, 2012).dcaIrr)).toBe(2.66);
  });
  it("나스닥100: 2015→2025 5.50/2.73, 1999→2012 0.72/1.52", () => {
    expect([f2(r("ndx", 2015, 2025).lumpMult), f2(r("ndx", 2015, 2025).dcaMult)]).toEqual([5.5, 2.73]);
    expect([f2(r("ndx", 1999, 2012).lumpMult), f2(r("ndx", 1999, 2012).dcaMult)]).toEqual([0.72, 1.52]);
    expect(f2(r("ndx", 2015, 2025).lumpCagr)).toBe(18.58);
    expect(f2(r("ndx", 2015, 2025).dcaIrr)).toBe(19.36);
  });
  it("코스피: 2015→2025 2.15/1.72, 1999→2012 1.94/1.87", () => {
    expect([f2(r("kospi", 2015, 2025).lumpMult), f2(r("kospi", 2015, 2025).dcaMult)]).toEqual([2.15, 1.72]);
    expect([f2(r("kospi", 1999, 2012).lumpMult), f2(r("kospi", 1999, 2012).dcaMult)]).toEqual([1.94, 1.87]);
    expect(f2(r("kospi", 2015, 2025).lumpCagr)).toBe(7.95);
  });
  it("짧은 기간: S&P 2007→2009 0.76/1.02, 2000→2002 0.67/0.79", () => {
    expect([f2(r("spx", 2007, 2009).lumpMult), f2(r("spx", 2007, 2009).dcaMult)]).toEqual([0.76, 1.02]);
    expect([f2(r("spx", 2000, 2002).lumpMult), f2(r("spx", 2000, 2002).dcaMult)]).toEqual([0.67, 0.79]);
  });
  it("반올림 전 값 계산: 매달 배수는 반올림하지 않은 평가액(경계 사례 1건)", () => {
    const p = r("spx", 2015, 2025);
    expect(p.lumpMult).not.toBe(f2(p.lumpMult));
    // 배수를 2자리로 먼저 올린 3.35로 연평균을 구하면 달라지는 대신, 표시는 반올림 전 3.3492로 +12.85%
    expect((Math.pow(p.lumpMult, 0.1) - 1) * 100).toBeCloseTo(12.85, 2);
  });
  it("시계열: 한 번에 시작 1배·매달 시작 0·넣은 돈 0→1, 끝점은 결과와 같다", () => {
    const s = r("spx", 2015, 2025).series;
    expect([s.lump[0], s.dca[0], s.principal[0], s.principal[10]]).toEqual([1, 0, 0, 1]);
    expect(s.lump).toHaveLength(11);
  });
  it("평균 머문 기간 = (12n−1)/24 → 10년 5.0, 1년 0.5(11/24)", () => {
    expect(averageHoldYears(10)).toBeCloseTo(4.9583, 3);
    expect(averageHoldYears(1)).toBeCloseTo(11 / 24, 6);
  });
  it("기본 {LAST−10}→{LAST}, 알약 5·10·20·전체, 보정", () => {
    expect(defaultPeriod(V.spx)).toEqual({ sy: 2015, ey: 2025 });
    expect(periodPresets(V.spx).map((p) => p.years)).toEqual([5, 10, 20, 65]);
    expect(fixPeriod(V.spx, 2025, 2020)).toEqual({ sy: 2024, ey: 2025 });
    expect(fixPeriod(V.ndx, 1980, 2030)).toEqual({ sy: 1985, ey: 2025 });
  });
});
