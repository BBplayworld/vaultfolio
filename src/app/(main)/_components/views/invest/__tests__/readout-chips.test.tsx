// D-11·D-12: 읽기 줄 구분점 묶음, 출처 문장 공백
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { buildIndexView } from "@/lib/invest/calc";
import { marketHistory } from "@/lib/invest/market-history";
import { readoutOf, sourceLines } from "@/lib/invest/text";
import { ReadoutChips } from "../nowrap";

describe("읽기 줄 칩(D-11)", () => {
  it("구분점은 뒤 칩 안에 nowrap으로 붙고 단독 span이 없다", () => {
    const v = buildIndexView(marketHistory, "spx");
    const html = renderToStaticMarkup(<ReadoutChips ro={readoutOf(v, 2008)} />);
    expect(html).not.toMatch(/<span>·<\/span>/);
    expect((html.match(/whitespace-nowrap/g) || []).length).toBeGreaterThanOrEqual(3);
    expect(html).toContain("· ");
    expect(html).toContain("경기침체");
  });
});

describe("출처 문장(D-12)", () => {
  it("`있어요(위키` 붙여쓰기 없음", () => {
    const rev = { spx: marketHistory.idx.spx.rev, ndx: marketHistory.idx.ndx.rev, kospi: marketHistory.idx.kospi.rev };
    for (const k of ["spx", "ndx", "kospi"] as const) {
      expect(sourceLines(buildIndexView(marketHistory, k), rev).join("\n")).not.toContain("있어요(위키");
    }
    expect(sourceLines(buildIndexView(marketHistory, "ndx"), rev).join("\n")).toContain("있어요 (위키 값 사용)");
  });
});
