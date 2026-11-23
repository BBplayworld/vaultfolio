// 5.143 R3-3 #280: 원/달러 연평균(연준 G.5 EXKOUS) — 변환·축·문구·공개 CSV
import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { fxAxis, fxYear } from "@/lib/invest/calc";
import { marketHistory as d } from "@/lib/invest/market-history";
import { FX_DATASET_HREF, FX_INFO, FX_SOURCE } from "@/lib/invest/text";

describe("원/달러 연평균", () => {
  it("1982~2025 연속 44점, 1981·2026은 없음", () => {
    expect(d.fx).toHaveLength(44);
    expect(d.fx[0].y).toBe(1982);
    expect(d.fx[43].y).toBe(2025);
    d.fx.forEach((r, i) => i && expect(r.y).toBe(d.fx[i - 1].y + 1));
    expect(fxYear(d, 1981)).toBeNull();
    expect(fxYear(d, 2026)).toBeNull();
  });
  it("검산 6값(spec 2절)", () => {
    expect([1982, 1989, 1997, 1998, 2008, 2025].map((y) => fxYear(d, y))).toEqual([731.7, 674.2, 954.4, 1404.2, 1100.5, 1421.7]);
    expect(Math.min(...d.fx.map((r) => r.v))).toBe(674.2);
    expect(Math.max(...d.fx.map((r) => r.v))).toBe(1421.7);
  });
  it("정수 합산 half-up으로 월 CSV에서 다시 계산한 값과 전 행 일치(이슈 data/ 원자료가 있을 때)", () => {
    const f = "../vaultfolio/.memory/issues/5.141-270-invest-r3/data/EXKOUS.csv";
    if (!fs.existsSync(f)) return;
    const by: Record<string, number[]> = {};
    fs.readFileSync(f, "utf8").trim().split("\n").slice(1).forEach((l) => { const [dt, v] = l.split(","); if (v && v !== ".") (by[dt.slice(0, 4)] ||= []).push(Math.round(parseFloat(v) * 1e4)); });
    d.fx.forEach((r) => { const s = by[r.y].reduce((a, b) => a + b, 0); expect(by[r.y]).toHaveLength(12); expect(r.v).toBe(Math.floor((2 * s + 12000) / 24000) / 10); });
  });
  it("축: 100원 단위 내림·올림 600~1,500, 눈금 3개·4개", () => {
    const a = fxAxis(d);
    expect([a.lo, a.hi]).toEqual([600, 1500]);
    expect(a.ticks3).toEqual([600, 1000, 1500]);
    expect(a.ticks4).toEqual([600, 900, 1200, 1500]);
  });
  it("공개 CSV와 같은 값, 정본 문구", () => {
    const t = fs.readFileSync("public/datasets/market-history/fx-krw-usd-annual.csv", "utf8").trim().split("\n");
    expect(t[0]).toBe("year,krw_per_usd_avg,months");
    expect(t.length - 1).toBe(d.fx.length);
    t.slice(1).forEach((l, i) => { const [y, v, m] = l.split(","); expect(+y).toBe(d.fx[i].y); expect(+v).toBe(d.fx[i].v); expect(m).toBe("12"); });
    expect(FX_SOURCE).toBe("원/달러: 미 연준 이사회(G.5) · FRED(세인트루이스 연은) 경유(EXKOUS) 자료를 가공했어요(공공 영역, 출처 표기).");
    expect(FX_INFO).toContain("그 12개를 다시 평균했어요");
    expect(FX_SOURCE + FX_INFO).not.toMatch(/H\.10|공식|제휴|로고/);
    expect(FX_DATASET_HREF).toBe("/datasets/market-history/fx-krw-usd-annual.csv");
  });
});
