// 5.141 R3-1 UI: A4 머리 1줄·용어 패널 (#272)
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { InvestView } from "../invest-view";
import { TERMS, PANEL_TERM_IDS } from "@/lib/invest/text";

const app = (props: Partial<React.ComponentProps<typeof InvestView>> = {}) => renderToStaticMarkup(<InvestView variant="app" {...props} />);
const text = (h: string) => h.replace(/<[^>]*>/g, "").replace(/&amp;/g, "&").replace(/&#x27;/g, "'");

describe("#272 A4·용어", () => {
  it("A4 1줄: 정본 문장(S&P 500) + <360 숨김 클래스", () => {
    const h = app({ defaultIndex: "spx" });
    expect(h).toContain('data-testid="invest-drop-recovery"');
    expect(h).toContain("max-[359px]:hidden");
    expect(text(h)).toContain("가장 깊었던 때 1973~74년 하락 −41.9% · 고점에서 전고점까지 가장 길었던 때 닷컴 버블 붕괴 14년");
  });
  it("A4 같은 하락이면 합친 문장(나스닥100), 괄호 0", () => {
    const t = text(app({ defaultIndex: "ndx" }));
    expect(t).toContain("가장 깊고 고점에서 전고점까지 가장 길었던 때 닷컴 버블 붕괴 −73.5% · 15년");
  });
  it("진행 중 모의(asof=2022): 꼬리 `진행 중 n번 제외`", () => {
    expect(text(app({ defaultIndex: "spx", asof: 2022 }))).toMatch(/진행 중 \d+번 제외/);
  });
  it("출처 버튼 라벨·용어 7개·출처 줄", () => {
    const h = app();
    expect(text(h)).toContain("용어·출처 · CC BY-SA 4.0");
    expect(h.match(/data-testid="invest-terms"[^]*?<\/dl>/)![0].match(/<dt /g)).toHaveLength(7);
    for (const id of PANEL_TERM_IDS) expect(text(h)).toContain(TERMS[id].def);
    expect(h).toContain('data-testid="invest-source"');
  });
  it("지수 ⓘ 문장은 TERMS 조합(앱에서는 마운트 뒤 렌더라 소스 대조)", async () => {
    const { INDEX_INFO } = await import("@/lib/invest/text");
    expect(INDEX_INFO).toBe(`${TERMS.priceIndex.def} ${TERMS.yearEnd.def}`);
  });
});
