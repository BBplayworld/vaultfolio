// 5.143: N1 격자 글자 = aria = 표(한 값 한 벌), N2 A2 부제 위치, UI(a) ⓘ 끝 어절 묶음
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { buildIndexView } from "@/lib/invest/calc";
import { marketHistory } from "@/lib/invest/market-history";
import { fmtPct } from "@/lib/invest/text";
import { YearGrid } from "../year-grid";

const views = { spx: buildIndexView(marketHistory, "spx"), ndx: buildIndexView(marketHistory, "ndx"), kospi: buildIndexView(marketHistory, "kospi") };
const read = (f: string) => fs.readFileSync(path.join(__dirname, "..", f), "utf8");

describe("N1 격자 반올림 한 벌", () => {
  it("전 지수 모든 칸: 칸 글자 = aria-label 값 = fmtPct(공통), S&P 1976·2009·코스피 2009 포함", () => {
    for (const k of ["spx", "ndx", "kospi"] as const) {
      const html = renderToStaticMarkup(<YearGrid view={views[k]} period={{ sy: 2015, ey: 2025 }} showLevels />);
      const cells = [...html.matchAll(/data-y="(\d+)" data-ret="([^"]+)"[^>]*aria-label="(\d+)년 ([^",]+)[^"]*"[^>]*>([^<]+)<\/button>/g)];
      expect(cells.length).toBeGreaterThanOrEqual(40);
      for (const [, y, ret, , aria, text] of cells) {
        expect(aria, `${k} ${y} aria`).toBe(fmtPct(+ret));
        expect(`${text}%`, `${k} ${y} 칸`).toBe(aria);
      }
    }
    const g = (k: keyof typeof views, y: number) => fmtPct(views[k].ret[y - views[k].start] as number);
    const h = renderToStaticMarkup(<YearGrid view={views.spx} period={{ sy: 2015, ey: 2025 }} showLevels />);
    expect(h).toContain(`>${g("spx", 1976).slice(0, -1)}</button>`);
    expect(h).toContain(`>${g("spx", 2009).slice(0, -1)}</button>`);
  });
});

describe("N2·UI(a) 구조", () => {
  it("A2 `오른 해` 부제는 우정렬이 아니라 머리 줄 아래 좌측 전폭", () => {
    const t = read("three-view.tsx");
    expect(t).toMatch(/data-testid="a2-sub" className="text-left /);
    expect(t).not.toMatch(/className="text-right text-xs text-muted-foreground">\{A2_TEXT\.sub\}/);
  });
  it("기간 카드 ⓘ는 끝 어절과 한 묶음(nowrap)", () => {
    const t = read("period-card.tsx");
    expect(t).toMatch(/<span className="whitespace-nowrap">\{APPROX_LINE\.slice\(APPROX_LINE\.lastIndexOf\(" "\) \+ 1\)\}\s*<button[^>]*data-testid="honest-info"/);
  });
});
