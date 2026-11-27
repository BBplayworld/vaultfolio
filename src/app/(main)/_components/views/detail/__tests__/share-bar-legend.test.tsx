// 5.176 #360 상세 4탭 공용 비중 바·범례(ShareBarLegend) — 상위 3 + 그 외, 지금 탭 기준 %, foreground 글자, 같은 색 0
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MAIN_PALETTE } from "@/config/theme";
import { assignColors } from "../asset-detail-tabs";
import { ShareBarLegend, SHARE_BAR_REST_COLOR, type ShareBarItem } from "../share-bar-legend";

const mk = (values: number[]): ShareBarItem[] => {
  const colors = assignColors(values.map((value) => ({ value })));
  return values.map((value, i) => ({ id: `i${i}`, name: `항목${i + 1}`, value, color: colors[i] }));
};
const render = (items: ShareBarItem[], total = items.reduce((s, it) => s + it.value, 0)) =>
  renderToStaticMarkup(<ShareBarLegend scope="crypto" items={items} total={total} />);
const count = (html: string, re: RegExp) => (html.match(re) ?? []).length;
const legendOf = (html: string) => html.slice(html.indexOf('data-testid="share-legend"'));
const barOf = (html: string) => html.slice(html.indexOf('data-testid="share-bar"'), html.indexOf('data-testid="share-legend"'));
const attr = (html: string, testId: string, name: string) =>
  [...html.matchAll(new RegExp(`data-testid="${testId}"[^>]*?${name}="([^"]+)"`, "g"))].map((m) => m[1]);
const text = (html: string) => html.replace(/<[^>]+>/g, "");

describe("ShareBarLegend 줄이기 — N > 4면 상위 3 + 그 외 N개", () => {
  it.each([1, 4])("N=%i(4 이하): 모두 보이고 그 외 없음, 바 구간 = N", (n) => {
    const html = render(mk([40, 30, 20, 10].slice(0, n)));
    expect(count(legendOf(html), /data-testid="share-legend-item"/g)).toBe(n);
    expect(html).not.toContain("share-legend-rest");
    expect(count(barOf(html), /data-testid="share-bar-seg"/g)).toBe(n);
  });

  it("N=5(qa 코인 픽스처 42.9·28.6·14.3·8.6·5.7): 상위 3 + `그 외 2개 14.3%`, 바 4구간(마지막 회색)", () => {
    // BTC 1500만·ETH 1000만·XRP 500만·SOL 300만·DOGE 200만(합계 3,500만)
    const html = render(mk([15_000_000, 10_000_000, 5_000_000, 3_000_000, 2_000_000]));
    expect(attr(html, "share-legend-item", "data-pct")).toEqual(["42.9", "28.6", "14.3"]);
    expect(legendOf(html)).toContain('data-testid="share-legend-rest" data-count="2" data-pct="14.3"');
    expect(text(legendOf(html))).toContain("그 외 2개14.3%");
    const segs = attr(html, "share-bar-seg", "data-pct");
    expect(segs).toEqual(["42.9", "28.6", "14.3", "14.3"]);
    expect(barOf(html).match(/background-color:[^;"]+/g)![3]).toContain(SHARE_BAR_REST_COLOR);
  });

  it("N=12: 상위 3 + `그 외 9개`, 범례 % 합 100.0(±0.2)", () => {
    const html = render(mk([30, 20, 10, 9, 8, 7, 6, 4, 3, 1, 1, 1]));
    expect(count(legendOf(html), /data-testid="share-legend-item"/g)).toBe(3);
    expect(legendOf(html)).toContain('data-count="9"');
    expect(count(barOf(html), /data-testid="share-bar-seg"/g)).toBe(4);
    const p = [...legendOf(html).matchAll(/>(\d+\.\d)%</g)].map((m) => Number(m[1]));
    expect(p).toHaveLength(4);
    expect(Math.abs(p.reduce((s, v) => s + v, 0) - 100)).toBeLessThanOrEqual(0.2);
  });
});

describe("ShareBarLegend 기준 — 분모는 넘겨받은 지금 탭 합계", () => {
  it("현금·예금 탭(예금A 200만·예금B 200만, 합계 400만) → 50.0·50.0 (전체 1,000만 기준 20.0이 아님)", () => {
    const html = render(mk([2_000_000, 2_000_000]), 4_000_000);
    expect(attr(html, "share-legend-item", "data-pct")).toEqual(["50.0", "50.0"]);
    expect(attr(html, "share-bar-seg", "data-pct")).toEqual(["50.0", "50.0"]);
    expect(html).toContain('title="항목1: 50.0%"');
  });
  it("항목 0개 또는 합계 0이면 아무것도 그리지 않는다", () => {
    expect(render([], 0)).toBe("");
    expect(render(mk([0]), 0)).toBe("");
  });
});

describe("ShareBarLegend 글자·색·클래스 규약", () => {
  it("% 글자는 text-foreground·tabular-nums(팔레트 색 글자 0), 그 외는 muted", () => {
    const html = render(mk([5, 4, 3, 2, 1]));
    const items = legendOf(html).match(/<span class="[^"]*font-bold[^"]*">[^<]+<\/span>/g)!;
    expect(items).toHaveLength(4);
    for (const s of items.slice(0, 3)) expect(s).toMatch(/class="text-sm text-foreground font-bold tabular-nums shrink-0"/);
    expect(items[3]).toMatch(/class="text-sm text-muted-foreground font-bold tabular-nums shrink-0"/);
    // 글자에 style color가 없다(색은 점·막대만)
    expect(legendOf(html)).not.toMatch(/style="color:/);
    expect(legendOf(html)).toContain('<span class="text-sm text-muted-foreground whitespace-nowrap shrink-0">그 외 2개</span>');
  });
  it("이름은 1줄 말줄임 + title, 격자는 주식과 같은 클래스", () => {
    const html = render(mk([3, 2]));
    expect(legendOf(html)).toMatch(/^data-testid="share-legend" data-scope="crypto" class="grid grid-cols-2 sm:grid-cols-4 gap-x-4 max-\[360px\]:gap-x-2 gap-y-2 px-2"/);
    expect(html).toContain('<span class="text-sm text-foreground truncate min-w-0" title="항목1">항목1</span>');
  });
  it("바에 transition-all 0, 폭 전환은 motion-safe:transition-[width]", () => {
    const html = render(mk([5, 4, 3, 2, 1]));
    expect(barOf(html)).not.toContain("transition-all");
    expect(count(barOf(html), /motion-safe:transition-\[width\]/g)).toBe(4);
  });
  it("assignColors 순위색 — 같은 값 계좌 여러 개도 색이 겹치지 않는다(최대 항목 = MAIN_PALETTE[0])", () => {
    const html = render(mk([2_000_000, 2_000_000, 4_000_000, 2_000_000]));
    const colors = barOf(html).match(/background-color:[^;"]+/g)!;
    expect(new Set(colors).size).toBe(colors.length);
    expect(colors[2]).toContain(MAIN_PALETTE[0]);
  });
});
