import { describe, expect, it } from "vitest";
import { buildIndexView } from "../invest/calc";
import { buildPattern, monthsLabel } from "../invest/pattern";
import { marketHistory as data } from "../invest/market-history";

const P = (k: "spx" | "ndx" | "kospi", asof?: number) => buildPattern(data, buildIndexView(data, k, asof));

describe("R4: CEO 판정 값(결론 3줄)", () => {
  it("S&P 500 확정 문장 3줄", () => {
    expect(P("spx").lines).toEqual([
      "크게 빠지기 전 12개월에 연준 금리가 올라간 때는 자료가 있는 3번 중 1번이었어요.",
      "1983~2024년에 연준 금리가 올라간 해는 16년이었고, 그중 그해 말이 고점이 된 해는 1년이었어요(전체 42년 중 3년).",
      "연준 금리가 내려간 해 18년 중 20% 넘게 오른 해는 8년, 올라간 해 16년 중에는 2년이었어요(1983~2025년).",
    ]);
  });
  it("나스닥100 · 코스피 값", () => {
    expect(P("ndx").lines).toEqual([
      "크게 빠지기 전 12개월에 연준 금리가 올라간 때는 자료가 있는 3번 중 1번이었어요.",
      "1986~2024년에 연준 금리가 올라간 해는 15년이었고, 그중 그해 말이 고점이 된 해는 1년이었어요(전체 39년 중 3년).",
      "연준 금리가 내려간 해 16년 중 20% 넘게 오른 해는 9년, 올라간 해 15년 중에는 4년이었어요(1986~2025년).",
    ]);
    expect(P("kospi").lines).toEqual([
      "크게 빠지기 전 12개월에 한국 금리가 올라간 때는 자료가 있는 3번 중 3번이었어요.",
      "2000~2024년에 한국 금리가 올라간 해는 12년이었고, 그중 그해 말이 고점이 된 해는 3년이었어요(전체 25년 중 3년).",
      "한국 금리가 내려간 해 14년 중 20% 넘게 오른 해는 5년, 올라간 해 12년 중에는 4년이었어요(2000~2025년).",
    ]);
  });
  it("비율 %는 결론 문장에 붙지 않는다(`20% 넘게`는 기준 값)", () => {
    for (const k of ["spx", "ndx", "kospi"] as const) for (const l of P(k).lines) expect(l.replace("20% 넘게", "")).not.toMatch(/\d\s*%/);
  });
});

describe("R4: 크게 오른 해 건수·경계(반올림 전 값)", () => {
  it("S&P 18 · 나스닥 17 · 코스피 15", () => {
    expect(P("spx").rise).toHaveLength(18);
    expect(P("ndx").rise).toHaveLength(17);
    expect(P("kospi").rise).toHaveLength(15);
  });
  it("경계: 1967 20.09·1996 20.26 포함, 1999 19.53·2017 19.42 제외, 나스닥 2025 20.17 포함", () => {
    const s = P("spx").rise.map((r) => r.y);
    expect(s).toEqual(expect.arrayContaining([1967, 1996])); expect(s).not.toContain(1999); expect(s).not.toContain(2017);
    expect(P("ndx").rise.map((r) => r.y)).toContain(2025);
  });
  it("오른 해 = 하락 고점: S&P 2021, 나스닥 1999·2021, 코스피 1999·2007·2017", () => {
    const f = (k: "spx" | "ndx" | "kospi") => P(k).rise.filter((r) => r.dropPeak).map((r) => r.y);
    expect(f("spx")).toEqual([2021]); expect(f("ndx")).toEqual([1999, 2021]); expect(f("kospi")).toEqual([1999, 2007, 2017]);
  });
});

describe("R4: 금리차 월 단위(CEO 2절)", () => {
  it("금융위기(2007)만 마이너스인 달: 10−2 1·2·3·5월(4개월), 10−3개월 1~5월(5개월), 닷컴·2021은 0", () => {
    const row = (k: "spx" | "ndx") => Object.fromEntries(P(k).preDrop.map((r) => [r.py, r.cells]));
    const s = row("spx");
    expect(s[2007][1].text).toBe("● 4개월(1·2·3·5월)");
    expect(s[2007][2].text).toBe("● 5개월(1~5월)");
    expect(s[1999][1].state).toBe("no"); expect(s[1999][2].state).toBe("no");
    expect(s[2021][1].state).toBe("no"); expect(s[2021][2].state).toBe("no");
    expect(s[1972][0].state).toBe("none");
  });
  it("기준선: S&P 10−2 14년 중 1년(49년), 10−3개월 11년 중 1년(44년) / 나스닥 9·10년 중 1년(39년), 전체 고점 3", () => {
    const b = (k: "spx" | "ndx") => P(k).preDropBase;
    expect(b("spx")[1]).toMatchObject({ from: 1976, years: 49, nCond: 14, kHit: 1, baseHit: 3 });
    expect(b("spx")[2]).toMatchObject({ from: 1981, years: 44, nCond: 11, kHit: 1, baseHit: 3 });
    expect(b("ndx")[1]).toMatchObject({ years: 39, nCond: 9, kHit: 1, baseHit: 3 });
    expect(b("ndx")[2]).toMatchObject({ years: 39, nCond: 10, kHit: 1, baseHit: 3 });
  });
  it("오른 해 기준선: S&P 내려감 18/8·올라감 16/2·그대로 9/4, 침체 끝난 해 9/5, 10년물 내림 12/5", () => {
    const r = P("spx").riseBase;
    expect(r.map((x) => [x.label, x.nCond, x.kHit])).toEqual([["금리 내려감", 18, 8], ["금리 올라감", 16, 2], ["금리 거의 그대로", 9, 4], ["경기침체가 끝난 해", 9, 5], ["10년물 1%p 넘게 내림", 12, 5]]);
    expect(r[0]).toMatchObject({ years: 43, baseHit: 14, from: 1983 });
  });
  it("monthsLabel", () => { expect(monthsLabel([1, 2, 3, 5])).toBe("1·2·3·5월"); expect(monthsLabel([1, 2, 3, 4, 5])).toBe("1~5월"); expect(monthsLabel([7])).toBe("7월"); });
});

describe("R4: 진행 중 모의·사건", () => {
  it("asof=2022 코스피도 계산되고 분모는 마지막 해−1까지", () => {
    const p = P("kospi", 2022);
    expect(p.preDropBase[0].to).toBe(2021);
  });
  it("오른 해 펼침 사건에 추가 사건 포함(2008 아님: 2014 나스닥 매입 종료), 그해 ≤2건 시간순", () => {
    const y = P("spx").rise.find((r) => r.y === 2019)!;
    expect(y.events.map((e) => e.id)).toEqual(expect.arrayContaining(["R06"]));
    for (const r of P("spx").rise) { expect(r.events.length).toBeLessThanOrEqual(2); for (let i = 1; i < r.events.length; i++) expect(r.events[i].t).toBeGreaterThanOrEqual(r.events[i - 1].t); }
  });
  it("첫 화면 점은 31건 그대로(추가 사건은 view.ev에 없다)", () => {
    expect(buildIndexView(data, "spx").ev.some((e) => e.id.startsWith("R"))).toBe(false);
  });
});
