// 5.142 #277 A6 화면(SSR 마크업): 버튼은 period-honest 줄 안 인라인, 본문은 접힘
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { InvestView } from "../invest-view";
import { A6_TEXT } from "@/lib/invest/text";

const text = (h: string) => h.replace(/<[^>]*>/g, "").replace(/&amp;/g, "&").replace(/&#x27;/g, "'");

describe("A6(기간 카드)", () => {
  const app = (p: Partial<React.ComponentProps<typeof InvestView>> = {}) => renderToStaticMarkup(<InvestView variant="app" defaultIndex="spx" {...p} />);
  it("A6: 버튼은 period-honest 줄 안(인라인)이고 본문은 접힘, 10년 S&P 정본 문장", () => {
    const h = app(), t = text(h);
    const honest = h.slice(h.indexOf('data-testid="period-honest"'), h.indexOf("</p>", h.indexOf('data-testid="period-honest"')));
    expect(honest).toContain('data-testid="period-range-button"');
    expect(honest).toContain('aria-expanded="false"');
    expect(t).toContain("S&P 500에 10년 동안 넣어 둔 경우를 시작 해 56개로 나눠 계산했어요. 해마다 평균은 −3.0~+16.0%였고, 손실로 끝난 시작 해는 7개였어요.");
    expect(t).toContain(A6_TEXT.info(10));
    expect(h.indexOf("period-range-body")).toBeGreaterThan(h.indexOf("calc-div"));
  });
});
