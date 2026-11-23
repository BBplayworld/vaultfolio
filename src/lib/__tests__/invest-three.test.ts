// 5.141 #270 세 지수 A1 분류(합=공통 해 수·각 해 1행)·공통 범위·칩 값
import { describe, expect, it } from "vitest";
import { buildIndexView } from "@/lib/invest/calc";
import { marketHistory } from "@/lib/invest/market-history";
import { A1_ROWS, a1RowOf, classifyYear, classifyYears, commonRange, sameYearRets, type ThreeViews } from "@/lib/invest/three";
import { THREE_TEXT, fmtPct, threeSourceLines, topic } from "@/lib/invest/text";

const mk = (asof?: number): ThreeViews => ({ spx: buildIndexView(marketHistory, "spx", asof), ndx: buildIndexView(marketHistory, "ndx", asof), kospi: buildIndexView(marketHistory, "kospi", asof) });
const V = mk();

describe("공통 범위", () => {
  it("1986~2025 = 40해 (가장 늦은 start+1 ~ 가장 이른 last)", () => {
    expect(commonRange(V)).toEqual({ from: 1986, to: 2025, n: 40 });
  });
  it("진행 중 모의(asof=2022): 끝 해가 데이터에서 따라온다(하드코딩 0)", () => {
    expect(commonRange(mk(2022))).toEqual({ from: 1986, to: 2022, n: 37 });
  });
  it("범위가 겹치지 않으면 null", () => {
    expect(commonRange({ ...V, spx: { ...V.spx, last: 1980 } })).toBeNull();
    expect(classifyYears({ ...V, spx: { ...V.spx, last: 1980 } })).toBeNull();
  });
});

describe("A1 5분류", () => {
  const r = classifyYears(V)!;
  it("현재 데이터: 24·6·6·1·3 = 40", () => {
    expect(r.rows.map((x) => x.years.length)).toEqual([24, 6, 6, 1, 3]);
    expect(r.rows.map((x) => x.label)).toEqual(A1_ROWS.map((x) => x.label));
    expect(r.rows.reduce((a, x) => a + x.years.length, 0)).toBe(r.n);
  });
  it("각 해는 한 행에만 있고 연도 오름차순", () => {
    const all = r.rows.flatMap((x) => x.years);
    expect(new Set(all).size).toBe(all.length);
    expect([...all].sort((a, b) => a - b)).toEqual(Array.from({ length: 40 }, (_, i) => 1986 + i));
    for (const x of r.rows) expect(x.years).toEqual([...x.years].sort((a, b) => a - b));
  });
  it("분류 규칙을 격자 값(view.ret)에서 독립 재계산한 것과 일치(해마다 N/N)", () => {
    for (let y = r.from; y <= r.to; y++) {
      const [s, n, k] = [V.spx, V.ndx, V.kospi].map((v) => (v.ret[y - v.start] as number) > 0);
      const want = s !== n ? "usSplit" : s && k ? "allUp" : !s && !k ? "allDown" : s ? "usUp" : "kospiUp";
      expect(classifyYear(V, y)).toBe(want);
      expect(a1RowOf(r, y)).toBe(A1_ROWS.findIndex((x) => x.id === want));
    }
  });
  it("모의(asof=2022)도 합 = 공통 해 수", () => {
    const m = classifyYears(mk(2022))!;
    expect(m.rows.reduce((a, x) => a + x.years.length, 0)).toBe(m.n);
  });
  it("공통 범위 밖 해는 행 -1", () => {
    expect(a1RowOf(r, 1975)).toBe(-1);
    expect(a1RowOf(r, null)).toBe(-1);
  });
  it("0.0%로 보이지만 내린 해: 현재 2011 S&P 500 1건", () => {
    expect(r.zeroNotes).toEqual([{ year: 2011, label: "S&P 500" }]);
    expect(THREE_TEXT.zeroNote(2011, "S&P 500")).toBe("2011년 S&P 500은 0.0%로 보이지만 반올림 전 값이 0보다 작아 내린 해로 셌어요.");
    expect(topic("코스피")).toBe("코스피는");
    expect(topic("나스닥100")).toBe("나스닥100은");
  });
});

describe("칩 1줄 값 = 격자 값", () => {
  it("세 지수 전부 view.ret과 같고 표시 서식도 같다", () => {
    for (const y of [1986, 2008, 2011, 2020, 2025]) {
      const o = sameYearRets(V, y);
      expect(o.map((x) => x.label)).toEqual(["S&P 500", "나스닥100", "코스피"]);
      expect(o[0].ret).toBe(V.spx.ret[y - V.spx.start]);
      expect(o[1].ret).toBe(V.ndx.ret[y - V.ndx.start]);
      expect(o[2].ret).toBe(V.kospi.ret[y - V.kospi.start]);
    }
    expect(fmtPct(sameYearRets(V, 2008)[0].ret, 1)).toBe("−38.5%");
  });
});

describe("세 지수 출처·문장", () => {
  it("출처 5줄: 지수별 3 + 공통 1 + 상표 1(기준일 = 공통 끝 해)", () => {
    const L = threeSourceLines(V, { spx: marketHistory.idx.spx.rev, ndx: marketHistory.idx.ndx.rev, kospi: marketHistory.idx.kospi.rev });
    expect(L).toHaveLength(5);
    expect(L[3]).toBe("가격 지수(배당 제외) · 미국 지수는 달러, 코스피는 원 기준 · 연말 종가 기준 · 기준일 2025.12.31 · 가공 데이터는 같은 조건(CC BY-SA 4.0)으로 공개해요");
    expect(L[4]).toContain("이 기관들과 제휴 관계가 아니에요. 과거 시장 사실이며 투자 권유가 아니에요.");
  });
  it("요약 문장 정본", () => {
    expect(THREE_TEXT.summary(1986, 2025, 40)).toBe("1986~2025년, 세 지수 모두 연말 값이 있는 40해를 나눠 셌어요");
  });
});
