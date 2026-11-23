// 5.142 #276 A3 경기침체 앞뒤 연말 등락
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildIndexView } from "@/lib/invest/calc";
import { marketHistory as d } from "@/lib/invest/market-history";
import { recessionAround } from "@/lib/invest/three";
import { A3_TEXT, LIST_NOTE_2, TERMS } from "@/lib/invest/text";

const views = { spx: buildIndexView(d, "spx"), ndx: buildIndexView(d, "ndx"), kospi: buildIndexView(d, "kospi") };
const src = (p: string) => readFileSync(join(process.cwd(), "src", p), "utf8");

describe("#276 A3 경기침체 앞뒤", () => {
  it("9구간·검산(2008·2001·1960)", () => {
    expect(d.rec).toHaveLength(9);
    const spx = recessionAround(views.spx, d.rec), ndx = recessionAround(views.ndx, d.rec);
    expect(spx).toHaveLength(9);
    const r2008 = spx.find((r) => r.label.startsWith("2008년 1월"))!, n2008 = ndx.find((r) => r.label.startsWith("2008년 1월"))!;
    const r1 = (c: { ret: number | null }) => (c.ret == null ? null : Math.round(c.ret * 10) / 10);
    expect(r2008.cells.map(r1)).toEqual([3.5, -38.5, 12.8]);
    expect(n2008.cells.map(r1)).toEqual([18.7, -41.9, 19.2]);
    expect(ndx.find((r) => r.label.startsWith("2001년 4월"))!.cells.map(r1)).toEqual([-36.8, -32.6, -37.6]);
    expect(spx.find((r) => r.label.startsWith("1960년 5월"))!.cells.map(r1)).toEqual([null, null, -11.8]);
  });
  it("구간 s·e는 NBER 기준일(고점 다음 달·저점 달)과 일치, 셀 값 = 격자 값", () => {
    const nber = [["1960-05", "1961-02"], ["1970-01", "1970-11"], ["1973-12", "1975-03"], ["1980-02", "1980-07"], ["1981-08", "1982-11"], ["1990-08", "1991-03"], ["2001-04", "2001-11"], ["2008-01", "2009-06"], ["2020-03", "2020-04"]];
    expect(d.rec.map((r) => [r.s, r.e])).toEqual(nber);
    for (const r of recessionAround(views.spx, d.rec)) for (const c of r.cells) if (c.ret != null) expect(c.ret).toBe(views.spx.ret[c.year - views.spx.start]);
  });
  it("정의 문장은 연말 기준 TERMS·LIST_NOTE_2를 참조, 코스피 열 0", () => {
    expect(A3_TEXT.def).toContain(TERMS.yearEnd.def);
    expect(A3_TEXT.def).toContain(LIST_NOTE_2);
    expect(src("app/(main)/_components/views/invest/three-view.tsx")).not.toMatch(/recessionAround\(views\.kospi/);
  });
});
