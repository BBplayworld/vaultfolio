// 5.142 #275 A2 화면(SSR 마크업·소스 검사) + PatternSection 정의·링크. DOM 상호작용·길이는 preview 실측(qa)에서 본다.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { InvestView } from "../invest-view";
import { PatternSection } from "../pattern-section";
import { ThreeView } from "../three-view";
import { buildIndexView } from "@/lib/invest/calc";
import { buildPattern } from "@/lib/invest/pattern";
import { marketHistory as d } from "@/lib/invest/market-history";
import { A2_TEXT, TERMS } from "@/lib/invest/text";

const views = { spx: buildIndexView(d, "spx"), ndx: buildIndexView(d, "ndx"), kospi: buildIndexView(d, "kospi") };
const read = (p: string) => readFileSync(join(process.cwd(), "src", p), "utf8");
const text = (h: string) => h.replace(/<[^>]*>/g, "").replace(/&amp;/g, "&").replace(/&#x27;/g, "'");
const three = (p: Partial<React.ComponentProps<typeof ThreeView>> = {}) => renderToStaticMarkup(<ThreeView data={d} views={views} yr={null} onYear={() => {}} onPattern={() => {}} {...p} />);

describe("세 지수 보기 A2", () => {
  it("A2: 기준 4칸(radiogroup), 기본 금리 3행, 정본 문장·셀·기간 줄·링크", () => {
    const h = three(), t = text(h);
    for (const b of ["rate", "cpi", "unemp", "spread"]) expect(h).toContain(`data-testid="a2-basis-${b}"`);
    expect(t).toContain(A2_TEXT.q);
    expect(t).toContain(A2_TEXT.title);
    expect(t).toContain(A2_TEXT.summary);
    expect(h.match(/data-testid="a2-row-\d"/g)).toHaveLength(3);
    expect(h).toContain('aria-label="16해 중 11해"');
    expect(t).toContain("S&P 500 1983~2025년 · 나스닥100 1986~2025년 · 코스피 1983~2025년");
    expect(t).toContain("금리 올라간 해");
    expect(t).toContain("금리 거의 그대로인 해");
    expect(t).toContain(`${A2_TEXT.linkPattern} ›`);
    expect(t).toContain(A2_TEXT.defLabel);
  });
  it("A2 기준 전환 때 표 높이 예약(min-height) 0", () => {
    const src = read("app/(main)/_components/views/invest/three-view.tsx");
    const a2 = src.slice(src.indexOf("export function ThreeA2"), src.indexOf("const A3_OPTIONS"));
    expect(a2).not.toMatch(/min-h-\[\d+px\]/);
  });
});

describe("PatternSection(대표 R4 영역) — 접힘 패널 안 정의 1문장·링크 1줄만", () => {
  const pat = buildPattern(d, views.spx);
  it("정의 = TERMS 금리 방향, 링크 문구, 결론 3줄·각주는 그대로", () => {
    const h = renderToStaticMarkup(<PatternSection pattern={pat} last={views.spx.last} onThree={() => {}} />), t = text(h);
    expect(h).toContain('data-testid="pattern-rate-def"');
    expect(t).toContain(TERMS.rateDir.def);
    expect(t).toContain(`${A2_TEXT.linkThree} ›`);
    for (const l of pat.lines) expect(t).toContain(l);
    expect(renderToStaticMarkup(<PatternSection pattern={pat} last={views.spx.last} />)).not.toContain("pattern-link-three");
  });
});
