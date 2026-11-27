// 5.171 #343 상세·주식 첫 화면 — 비중 범례 최대 4칸(상위 3 + 그 외 N종목)·비중 바 4구간·행 비중 %(모든 폭)·범례~목록 간격 16px.
// 인증카드(screenshotMode)는 maxItems 7 경로·행 % 없음·mt-10 그대로 — 아래 '인증카드 불변' 스냅샷은 origin/main f00909d 코드로 먼저 찍어 고정했다.
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { Stock } from "@/types/asset";
import { StockCategorySection, StockRowHeader } from "../stock-tab";

const COLORS = ["#111111", "#222222", "#333333", "#444444", "#555555", "#666666", "#777777", "#888888", "#999999"];
// 평가금 순(barItems 순서 = 목록 순서, #288 R1) — 데모 6종목과 비슷한 비중
const VALUES = [3130, 2100, 1380, 1200, 1100, 1090, 0, 0, 0];
const mkStock = (i: number): Stock => ({
  id: `s${i}`, category: "domestic", name: `종목${i + 1}`, ticker: `00000${i}`, quantity: 1, averagePrice: 1, currentPrice: VALUES[i] || 1, currency: "KRW", purchaseDate: "2026-01-01",
} as Stock);

function section(n: number, opts: { screenshotMode?: boolean; legendMax?: number; maxItems?: number; values?: number[] } = {}) {
  const values = opts.values ?? VALUES.slice(0, n).map((v) => v || 500);
  const stocks = values.map((_, i) => mkStock(i));
  const barItems = stocks.map((stock, i) => ({ stock, value: values[i], color: COLORS[i] }));
  const total = values.reduce((s, v) => s + v, 0);
  return renderToStaticMarkup(
    <StockCategorySection
      activeCategory="all"
      onCategoryChange={() => {}}
      filteredStocks={stocks}
      totalValue={total}
      barItems={barItems}
      barColors={COLORS.slice(0, n)}
      screenshotMode={opts.screenshotMode ?? false}
      legendMax={opts.legendMax}
      maxItems={opts.maxItems}
      renderItem={(s) => <div key={s.id} data-testid="row">{s.name}</div>}
    />,
  );
}
const count = (html: string, re: RegExp) => (html.match(re) ?? []).length;
const legendOf = (html: string) => html.slice(html.indexOf('data-testid="stock-legend"'), html.indexOf('data-testid="detail-list-box-stocks"'));
const barOf = (html: string) => html.slice(html.indexOf('class="flex h-6 w-full'), html.indexOf('data-testid="stock-legend"'));
const pcts = (html: string) => [...legendOf(html).matchAll(/>(\d+\.\d)%</g)].map((m) => Number(m[1]));
const text = (html: string) => html.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&");

describe("범례 최대 4칸 — 일반 화면(legendMax=4)", () => {
  it("6종목: 상위 3 + `그 외 3종목`, 비중 바 4구간(마지막 회색)", () => {
    const html = section(6, { legendMax: 4 });
    expect(count(legendOf(html), /data-testid="stock-legend-item"/g)).toBe(3);
    expect(count(legendOf(html), /data-testid="stock-legend-rest"/g)).toBe(1);
    expect(legendOf(html)).toContain('data-testid="stock-legend-rest" data-count="3"');
    expect(text(legendOf(html))).toContain("그 외 3종목");
    const segs = barOf(html).match(/background-color:[^;"]+/g)!;
    expect(segs).toHaveLength(4);
    expect(segs[3]).toContain("#9ca3af");
    // 상위 3 = 목록 위 3행(같은 순서), 목록은 줄이지 않는다
    expect(text(legendOf(html).replace(/^[^>]*>/, ""))).toMatch(/^종목1.*종목2.*종목3.*그 외/);
    expect(count(html, /data-testid="row"/g)).toBe(6);
  });
  it("범례 % 합 = 100.0(±0.2), `그 외` = 나머지 종목 비중 합(기존 계산 그대로)", () => {
    const html = section(6, { legendMax: 4 });
    const p = pcts(html);
    expect(p).toHaveLength(4);
    expect(Math.abs(p.reduce((s, v) => s + v, 0) - 100)).toBeLessThanOrEqual(0.2);
    const total = VALUES.slice(0, 6).reduce((s, v) => s + v, 0);
    expect(p[3]).toBe(Number(((VALUES[3] + VALUES[4] + VALUES[5]) / total * 100).toFixed(1)));
    expect(p[0]).toBe(Number((VALUES[0] / total * 100).toFixed(1)));
  });
  it("5종목: 상위 3 + `그 외 2종목`", () => {
    const html = section(5, { legendMax: 4 });
    expect(count(legendOf(html), /data-testid="stock-legend-item"/g)).toBe(3);
    expect(legendOf(html)).toContain('data-count="2"');
    expect(barOf(html).match(/background-color:/g)).toHaveLength(4);
  });
  it.each([1, 2, 3, 4])("%i종목(4 이하): 전부 보이고 `그 외` 없음, 바 구간 = 종목 수", (n) => {
    const html = section(n, { legendMax: 4 });
    expect(count(legendOf(html), /data-testid="stock-legend-item"/g)).toBe(n);
    expect(html).not.toContain("stock-legend-rest");
    expect(barOf(html).match(/background-color:/g)).toHaveLength(n);
  });
  it("범례·`그 외`는 누를 수 없다(button·role·tabIndex 0)", () => {
    const l = legendOf(section(6, { legendMax: 4 }));
    expect(l).not.toMatch(/<button|role=|tabindex|onClick/i);
  });
  it("범례~목록 간격 — 일반 화면 mt-4(16px), 인증카드 mt-10(40px)", () => {
    expect(section(6, { legendMax: 4 })).toMatch(/data-testid="detail-list-box-stocks" class="space-y-2 mt-4 /);
    expect(section(9, { screenshotMode: true, maxItems: 7 })).toContain('data-testid="detail-list-box-stocks" class="space-y-2 mt-10 "');
  });
});

describe("인증카드 불변 — maxItems 7 경로, legendMax는 무시, 새 testId 0", () => {
  it("9종목 인증카드: 상위 7 + 그 외 2, legendMax를 넘겨도 마크업 같음, 범례 testId 없음", () => {
    const shot = section(9, { screenshotMode: true, maxItems: 7, values: [9, 8, 7, 6, 5, 4, 3, 2, 1] });
    expect(section(9, { screenshotMode: true, maxItems: 7, legendMax: 4, values: [9, 8, 7, 6, 5, 4, 3, 2, 1] })).toBe(shot);
    expect(shot).not.toMatch(/stock-legend/);
    expect(text(shot)).toContain("그 외 2종목");
    expect(shot).toMatchSnapshot();
  });
  it("인증카드 행 머리(금액 표시·숨김, 결정 있음·없음) — 행 % 없음, main과 같은 마크업", () => {
    const st = { ...mkStock(0), quantity: 1234 } as Stock;
    const base = { stock: st, color: "#5b6fbf", pct: 31.3, currentVal: 98_720_000, profit: 12_340_000, profitRate: 14.3 };
    for (const [maskFn, decision] of [[undefined, undefined], [(_: number) => "••••", undefined], [(v: number) => `${v}원`, "due"]] as const) {
      const html = renderToStaticMarkup(<StockRowHeader {...base} maskFn={maskFn} screenshotMode decision={decision} />);
      expect(html).not.toContain("stock-row-share");
      expect(html).not.toContain("31.3%");
      expect(html).toMatchSnapshot();
    }
  });
});

describe("행 비중 % — 모든 폭(모바일 숨김 해제), `수량 · 비중 · 점검 차례` 조각", () => {
  const st = { ...mkStock(0), quantity: 65 } as Stock;
  const row = (decision?: "keep" | "check" | "due", todayChip?: { rate: number; label: string }) =>
    renderToStaticMarkup(<StockRowHeader stock={st} color="#000" pct={31.25} currentVal={1} profit={1} profitRate={1} decision={decision} todayChip={todayChip} />);
  const metaOf = (html: string) => /<div class="flex items-center gap-1 mt-0\.5 flex-wrap[^"]*">([\s\S]*?)<\/div><\/div>/.exec(html)!;
  it("조각 1개(nowrap·tabular-nums·DotLead), max-sm:hidden 없음, 글자 `65주 · 31.3%`", () => {
    const html = row();
    const share = /<span data-testid="stock-row-share" class="([^"]*)">(.*?%)<\/span>/.exec(html)!;
    expect(share[1]).toBe("whitespace-nowrap text-sm font-semibold text-primary tabular-nums");
    expect(share[2]).toMatch(/^<span aria-hidden="true" class="-ml-1 inline-block w-3[^"]*"> · <\/span>31\.3%$/);
    expect(html).not.toContain("max-sm:hidden\">·");
    expect(metaOf(html)[1]).not.toMatch(/max-sm:hidden"[^>]*>[\d.]+%/);
    expect(text(metaOf(html)[1]).replace(/\s+/g, " ").trim()).toBe("65주 · 31.3%");
  });
  it("줄은 dot-wrap(줄 머리·끝 가운뎃점 0) — 결정 없어도 DOT_WRAP_ROW, 수량 조각 nowrap + ml-2", () => {
    const meta = metaOf(row());
    expect(meta[0]).toContain("-ml-2 [clip-path:inset(-2px_-100vw_-2px_0.5rem)]");
    expect(meta[1]).toMatch(/^<span class="text-sm text-foreground tabular-nums whitespace-nowrap ml-2">65주<\/span>/);
    // 조각 끝 글자가 가운뎃점이 아니다(점은 뒤 조각 머리에만)
    expect(meta[1]).not.toMatch(/·\s*<\/span>(?!\d)/);
  });
  it("순서 — 수량 → 비중 → 점검 차례 → 오늘 등락(PC)", () => {
    const html = row("due", { rate: 1.2, label: "오늘" });
    const at = ["65주", "stock-row-share", "stock-row-decision", "오늘"].map((k) => html.indexOf(k));
    expect(at.every((v) => v >= 0)).toBe(true);
    expect([...at].sort((a, b) => a - b)).toEqual(at);
    expect(text(metaOf(html)[1])).toContain("65주 · 31.3% · 점검 차례");
  });
});
