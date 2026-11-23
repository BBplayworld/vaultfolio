// 5.142 #275 A2 지표로 나눠 본 오른 해 — 계산·정의 문장 일치. 검산값은 spec 3절(원자료 독립 재계산)과 같다.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildIndexView, INDEX_KEYS } from "@/lib/invest/calc";
import { marketHistory as d } from "@/lib/invest/market-history";
import { A2_BASES, A2_ROWS, criterionRows, spreadFirstMonth, type A2Basis } from "@/lib/invest/three";
import { A2_TEXT, A1_INFO_FIRST, BLS_GAP_NOTE, BLS_INFO, LIST_NOTE_2, TERMS, THREE_TEXT } from "@/lib/invest/text";
import { patternNote } from "@/lib/invest/pattern";

const views = { spx: buildIndexView(d, "spx"), ndx: buildIndexView(d, "ndx"), kospi: buildIndexView(d, "kospi") };
const src = (p: string) => readFileSync(join(process.cwd(), "src", p), "utf8");
/** 셀 `n·k`(spec 3절 검산: S&P / 나스닥100 / 코스피) */
const T: Record<A2Basis, Record<string, [number, number][]>> = {
  rate: { up: [[16, 11], [15, 12], [16, 11]], down: [[18, 14], [16, 12], [18, 12]], flat: [[9, 8], [9, 9], [9, 6]] },
  cpi: { hi: [[22, 15], [7, 5], [9, 5]], lo: [[42, 32], [32, 27], [34, 23]] },
  unemp: { up: [[19, 13], [11, 7], [12, 6]], lo: [[44, 33], [28, 25], [31, 22]] },
  spread: { neg: [[14, 10], [9, 6], [10, 5]], none: [[36, 28], [31, 27], [34, 24]] },
};

describe("#275 A2 지표로 나눠 본 오른 해", () => {
  it("4기준 × 3지수 24셀 = 원자료 재계산 검산값", () => {
    let cells = 0;
    for (const b of A2_BASES) {
      const r = criterionRows(d, views, b.value);
      for (const row of r.rows) row.cells.forEach((c, i) => { expect([c!.n, c!.k], `${b.value}/${row.id}/${INDEX_KEYS[i]}`).toEqual(T[b.value][row.id][i]); cells++; });
    }
    expect(cells).toBe(27);
  });
  it("각 열의 행 n 합 = 그 지수에서 센 해 수, 금리 첫 해 1983", () => {
    for (const b of A2_BASES) {
      const r = criterionRows(d, views, b.value);
      r.totals.forEach((t, i) => expect(t).toBe(r.rows.reduce((a, row) => a + (row.cells[i]?.n ?? 0), 0)));
      expect(r.rows.map((x) => x.id)).toEqual(A2_ROWS[b.value].map((x) => x.id));
    }
    const rate = criterionRows(d, views, "rate");
    expect(rate.ranges.map((x) => x!.from)).toEqual([1983, 1986, 1983]);
  });
  it("S&P 금리 n(16·18·9)은 머리 l3·PatternSection 기준선과 같다", async () => {
    const { headlineLines } = await import("@/lib/invest/text");
    const l3 = headlineLines(views.spx).l3;
    expect(l3).toContain("내려간 해는 18년, 올라간 해는 16년, 거의 그대로인 해는 9년");
  });
  it("분류는 PatternSection과 같은 함수를 쓴다(중복 구현 0)", () => {
    const t = src("lib/invest/three.ts");
    for (const f of ["classifyDelta(rateDelta(d,", "blsYear(d,", "spreadNegMonths(d,"]) expect(t.replace(/\s+/g, "")).toContain(f.replace(/\s+/g, ""));
    expect(src("lib/invest/pattern.ts")).toContain("export const spreadNegMonths");
  });
  it("정의 줄 4개가 TERMS·BLS_INFO·patternNote와 글자 일치", () => {
    const f = { rateFrom: d.rate.us.from, spreadFrom: spreadFirstMonth(d) };
    expect(A2_TEXT.def("rate", f)).toBe(`${A1_INFO_FIRST} ${TERMS.rateDir.def} 미 연준 목표금리(범위면 위쪽 값) 자료가 1982년 9월부터라 1983년부터 셌어요. ${LIST_NOTE_2}`);
    expect(A2_TEXT.def("cpi", f)).toContain(`${BLS_INFO} 물가 4% 이상 오른 해는 물가 연평균이 전년보다 4.0% 이상 오른 해예요. ${BLS_GAP_NOTE}`);
    expect(A2_TEXT.def("unemp", f)).toContain(`${BLS_INFO} 실업률 오른 해는 연평균 실업률이 전년보다 높았던 해예요. ${BLS_GAP_NOTE}`);
    expect(A2_TEXT.def("spread", f)).toContain(`${TERMS.spread.def} ${TERMS.spreadNeg.def} 10년−2년 금리차이고 1976년 6월부터 있어요.`);
    expect(patternNote(2025)).toContain(TERMS.spreadNeg.def);
    expect(patternNote(2025)).toBe("같은 시기에 있었다는 기록이고, 무엇이 원인인지는 말하지 않아요. 결과를 알 수 있는 2024년까지만 셌어요. 금리차는 월평균이 0보다 낮은 달이 1개 이상이면 셌어요(연준 H.15).");
    expect(THREE_TEXT.info.startsWith(A1_INFO_FIRST)).toBe(true);
  });
  it("정본 문장·기간 줄", () => {
    expect(A2_TEXT.cell(16, 11)).toBe("16해 중 11해");
    const r = criterionRows(d, views, "rate");
    expect(A2_TEXT.range(["S&P 500", "나스닥100", "코스피"], r.ranges)).toBe("S&P 500 1983~2025년 · 나스닥100 1986~2025년 · 코스피 1983~2025년");
  });
});
