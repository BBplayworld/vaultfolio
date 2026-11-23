// 5.142 #276 A3 화면(SSR 마크업): 기본 접힘·2칸 선택기·9행·정의 문장
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ThreeView } from "../three-view";
import { buildIndexView } from "@/lib/invest/calc";
import { marketHistory as d } from "@/lib/invest/market-history";
import { A3_TEXT } from "@/lib/invest/text";

const views = { spx: buildIndexView(d, "spx"), ndx: buildIndexView(d, "ndx"), kospi: buildIndexView(d, "kospi") };
const read = (p: string) => readFileSync(join(process.cwd(), "src", p), "utf8");
const text = (h: string) => h.replace(/<[^>]*>/g, "").replace(/&amp;/g, "&").replace(/&#x27;/g, "'");
const three = (p: Partial<React.ComponentProps<typeof ThreeView>> = {}) => renderToStaticMarkup(<ThreeView data={d} views={views} yr={null} onYear={() => {}} onPattern={() => {}} {...p} />);

describe("세 지수 보기 A3", () => {
  it("A3: 접힘 머리 정본, 지수 2칸·9행·정의 문장은 마운트 상태에 있다(inert)", () => {
    const h = three(), t = text(h);
    expect(t).toContain(A3_TEXT.q);
    expect(t).toContain(A3_TEXT.title);
    expect(h).toContain('data-testid="a3-index-spx"');
    expect(h).toContain('data-testid="a3-index-ndx"');
    expect(h).not.toContain('data-testid="a3-index-kospi"');
    expect(h.match(/data-testid="a3-row-\d"/g)).toHaveLength(9);
    expect(t).toContain(A3_TEXT.def);
    expect(t).toContain("2008년 1월~2009년 6월");
  });
});
