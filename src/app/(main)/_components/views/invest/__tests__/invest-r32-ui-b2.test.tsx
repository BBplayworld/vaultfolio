// 5.142 #278 B2 화면(SSR 마크업): 세 지수 보기 순서·머리 1줄·금지 어휘
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { InvestView } from "../invest-view";
import { ThreeView } from "../three-view";
import { buildIndexView } from "@/lib/invest/calc";
import { marketHistory as d } from "@/lib/invest/market-history";
import { A6_TEXT } from "@/lib/invest/text";

const views = { spx: buildIndexView(d, "spx"), ndx: buildIndexView(d, "ndx"), kospi: buildIndexView(d, "kospi") };
const text = (h: string) => h.replace(/<[^>]*>/g, "").replace(/&amp;/g, "&").replace(/&#x27;/g, "'");
const three = (p: Partial<React.ComponentProps<typeof ThreeView>> = {}) => renderToStaticMarkup(<ThreeView data={d} views={views} yr={null} onYear={() => {}} onPattern={() => {}} {...p} />);
const FORBID = ["상관", "예측", "전망", "신호", "전조", "경고", "앞두고", "기회", "타이밍", "유리", "불리", "추천", "결국", "오래 들고", "때문", "덕분", "로 인해", "영향으로", "여파", "함께", "확률", "비율", "하세요", "→", "손실 없이"];


describe("세 지수 보기 B2", () => {
  it("순서 B2 → A1 → A3(접힘) → A2 → A5(A2·A5 숫자는 접지 밖), 기본 펼침 A1·A2·A5", () => {
    const h = three({ mySplit: { domestic: 40, overseas: 60, other: 0 }, onMine: () => {} });
    const at = (id: string) => h.indexOf(`data-testid="${id}"`);
    expect([at("invest-mine-split"), at("three-a1"), at("three-a3"), at("three-a2"), at("three-a5")].every((v, i, a) => v > 0 && (i === 0 || v > a[i - 1]))).toBe(true);
    expect(h).toMatch(/aria-expanded="false"[^>]*data-testid="a3-button"/);
  });
  it("B2: 있을 때만, 정본 1줄(국내·해외) + 기타 있으면 ` · 기타 z%`", () => {
    expect(three()).not.toContain("invest-mine-split");
    expect(text(three({ mySplit: { domestic: 40.5, overseas: 59.5, other: 0 }, onMine: () => {} }))).toContain("내 주식 국내 40.5%·해외 59.5%");
    const o = text(three({ mySplit: { domestic: 30, overseas: 65, other: 5 }, onMine: () => {} }));
    expect(o).toContain("내 주식 국내 30%·해외 65% · 기타 5%");
  });
  it("금지 어휘 0(A2·A3·A6·B2 문장)", () => {
    const t = text(three({ mySplit: { domestic: 40, overseas: 60, other: 5 }, onMine: () => {} })) + text(renderToStaticMarkup(<InvestView variant="app" defaultIndex="spx" firstBuyYear={2018} />)).replaceAll("년 말 → ", "년 말 ");
    for (const w of FORBID) expect(t, w).not.toContain(w);
    expect(t).not.toMatch(/\d+해 중 \d+%/);
    for (const w of ["장기", "결국", "안전", "유리", "추천", "손실 없이"]) expect(A6_TEXT.body("S&P 500", 10, 56, "−3.0", "+16.0%", 7) + A6_TEXT.info(10), w).not.toContain(w);
  });
});
