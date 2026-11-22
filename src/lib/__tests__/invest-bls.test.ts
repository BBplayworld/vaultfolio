import { describe, expect, it } from "vitest";
import { blsYear } from "@/lib/invest/calc";
import { marketHistory as d } from "@/lib/invest/market-history";
import { BLS_INFO, BLS_SOURCE } from "@/lib/invest/text";

describe("BLS 연평균(CPI-U·실업률)", () => {
  it("1961부터 연속, 2025는 10월 미공표라 빈 칸", () => {
    expect(d.bls[0].y).toBe(1961);
    d.bls.forEach((r, i) => i && expect(r.y).toBe(d.bls[i - 1].y + 1));
    expect(blsYear(d, 2025)).toEqual({ cpi: null, un: null });
    expect(blsYear(d, 2026)).toEqual({ cpi: null, un: null });
  });
  it("BLS 공표 연평균과 일치(대표 연도)", () => {
    expect(blsYear(d, 1980)).toEqual({ cpi: 13.5, un: 7.1 });
    expect(blsYear(d, 1982).un).toBe(9.7);
    expect(blsYear(d, 2022).cpi).toBe(8);
    expect(blsYear(d, 2024)).toEqual({ cpi: 2.9, un: 4 });
  });
  it("공개 CSV와 같은 값", async () => {
    const fs = await import("node:fs");
    const t = fs.readFileSync("public/datasets/market-history/macro-us-bls.csv", "utf8").trim().split("\n").slice(1);
    expect(t.length).toBe(d.bls.length);
    t.forEach((l, i) => { const [y, , c, u] = l.split(","); expect(+y).toBe(d.bls[i].y); expect(c === "" ? null : +c).toBe(d.bls[i].cpi); expect(u === "" ? null : +u).toBe(d.bls[i].un); });
  });
  it("문구는 BLS 공식·제휴 표현 없음", () => {
    expect(BLS_SOURCE + BLS_INFO).not.toMatch(/BLS 공식|제휴|로고/);
    expect(BLS_INFO).toContain("월 12개 평균");
  });
});
