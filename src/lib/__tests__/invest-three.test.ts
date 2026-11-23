// 5.141 #270 세 지수 A1 분류(합=공통 해 수·각 해 1행)·공통 범위·칩 값
import { describe, expect, it } from "vitest";
import { buildIndexView } from "@/lib/invest/calc";
import { marketHistory } from "@/lib/invest/market-history";
import { A1_ROWS, a1RowOf, classifyYear, classifyYears, commonRange, decadeRows, decadeText, sameYearRets, type ThreeViews } from "@/lib/invest/three";
import { periodResult } from "@/lib/invest/period";
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

describe("A5 연대별 요약(#271)", () => {
  const rows = decadeRows(V), at = (d: number) => rows.find((r) => r.decade === d)!;
  it("행 1960~2020년대 7개, 자료 없는 칸은 null(—)", () => {
    expect(rows.map((r) => r.decade)).toEqual([1960, 1970, 1980, 1990, 2000, 2010, 2020]);
    expect(at(1960).cells.map((c) => c != null)).toEqual([true, false, false]);
    expect(decadeText(at(1970).cells[2], "avg")).toBe("—");
  });
  it("검산: S&P 2000년대 누적 −24%·평균 −2.7%·2해, 나스닥 1990년대 +1,556%(spec 1,557%는 반올림 전 1,556.46)·+32.4%, 코스피 1990년대 −15% 이하 3해", () => {
    const s = at(2000).cells[0]!;
    expect(decadeText(s, "cum")).toBe("−24%");
    expect(decadeText(s, "avg")).toBe("−2.7%");
    expect(decadeText(s, "dd15")).toBe("2해");
    const n = at(1990).cells[1]!;
    expect(decadeText(n, "cum")).toBe("+1,556%");
    expect(decadeText(n, "avg")).toBe("+32.4%");
    expect(decadeText(at(1990).cells[2], "dd15")).toBe("3해");
  });
  it("부분 연대 표기 4곳: 1961~·1986~·1982~·진행 중 ~2025", () => {
    expect(at(1960).cells[0]!.from).toBe(1961);
    expect(at(1980).cells[1]!.from).toBe(1986);
    expect(at(1980).cells[2]!.from).toBe(1982);
    expect(rows.filter((r) => r.to != null).map((r) => [r.decade, r.to])).toEqual([[2020, 2025]]);
    const partial = rows.flatMap((r) => r.cells).filter((c) => c?.from != null).length;
    expect(partial).toBe(3);
  });
  it("2026(진행 중 해) 값 0: 모든 연대 끝 해 ≤ 마지막 해", () => {
    for (const r of rows) for (const c of r.cells) if (c) expect(Number.isFinite(c.cum)).toBe(true);
    expect(at(2020).to).toBe(2025);
  });
  it("S&P 2010년대 = 기간 카드 2009→2019와 같은 함수", () => {
    const p = periodResult(V.spx, 2009, 2019);
    expect(at(2010).cells[0]!.cum).toBeCloseTo((p.lumpMult - 1) * 100, 9);
    expect(at(2010).cells[0]!.avg).toBeCloseTo(p.lumpCagr, 9);
  });
  it("전 셀을 격자 원값(close)에서 독립 재계산한 값과 일치(N/N)", () => {
    let n = 0;
    for (const r of rows) r.cells.forEach((c, i) => {
      const v = [V.spx, V.ndx, V.kospi][i];
      const a = Math.max(r.decade, v.start + 1), b = Math.min(r.decade + 9, v.last);
      if (a > b) { expect(c).toBeNull(); return; }
      const mult = v.close[b - v.start] / v.close[a - 1 - v.start];
      let dd = 0;
      for (let y = a; y <= b; y++) if (v.close[y - v.start] / v.close[y - 1 - v.start] - 1 <= -0.15 + 1e-12 && Math.round((v.close[y - v.start] / v.close[y - 1 - v.start] - 1) * 10000) / 100 <= -15) dd++;
      expect(c!.cum).toBeCloseTo((mult - 1) * 100, 6);
      expect(c!.avg).toBeCloseTo((Math.pow(mult, 1 / (b - a + 1)) - 1) * 100, 6);
      expect(c!.dd15).toBe(dd);
      n++;
    });
    expect(n).toBe(17); // 21칸 중 1960·70년대 나스닥·코스피 4칸은 자료 없음
  });
});
