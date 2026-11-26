// #246 홈 '내 종목 오늘' 줄 — 카드 맨 끝 1곳·문장·접근성 이름·꼬리 먼저 숨김·pending 자리 (정적 렌더)
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("@/app/(main)/_components/layout/navigation/navigation-context", () => ({
  useAssetNavigation: () => ({ navigate: () => {} }),
}));

import { NetAssetSummaryBox } from "../dashboard";
import type { MyStockPick } from "@/lib/finance/my-stock-today";
import type { MarketEntryValue } from "../../activity/market-entry-line";

const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
const cause = (key: string, label: string, amount: number) => ({ key, label, sentence: label, amount, text: `${amount > 0 ? "+" : "-"}${Math.abs(amount)}만원` });
const change = (o: Record<string, unknown> = {}) => ({
  deltaNet: -70_000, pct: -0.1, isBig: false, negligible: false, label: "전일 대비", estimated: false,
  sentence: "x", causes: [cause("stock", "주식 시세 하락", -74), cause("cash", "현금 입금", 5)], ...o,
});
const market: MarketEntryValue = {
  hasTickerStock: true, markets: ["kr"], ready: true, values: [{ m: "kr", rate: 0.8, endDate: "2026-11-18", holiday: false }],
  linkOnly: false, ytdLinkReady: false, open: true,
};
const up: MyStockPick = { name: "엔비디아", label: "11/18 종가", rateText: "+3.2%", sign: "up", rate: 3.2, more: 5 };
const down: MyStockPick = { name: "엔비디아", label: "11/18 종가", rateText: "-3.2%", sign: "down", rate: -3.2, more: 5 };
const box = (props: Record<string, unknown>) =>
  renderToStaticMarkup(<NetAssetSummaryBox netAsset={100_000_000} treemapData={[]} {...(props as object)} />);
const slotOf = (html: string) => html.match(/<div[^>]*data-testid="home-my-stock-slot"[\s\S]*$/)![0];
const btnOf = (html: string) => html.match(/<button[^>]*data-testid="home-my-stock"[\s\S]*?<\/button>/)![0];
const my = (pick: MyStockPick | null, state: "on" | "pending" | "off" = "on") => ({ state, pick, onOpen: () => {} });

describe("#246 줄 문장·자리", () => {
  it("S1: 문장 글자 그대로, 카드 맨 끝(원인 줄·패널·접기 뒤, 분포 필터 앞)", () => {
    const html = box({ change: change(), market, marketLine: "on", onMarketOpen: () => {}, myStock: my(up), visibleTabs: [{ value: "all", label: "전체" }, { value: "financial", label: "금융자산" }], onSegmentClick: () => {} });
    expect(text(btnOf(html))).toBe("엔비디아 11/18 종가 +3.2% · 외 5종목");
    expect(html.match(/data-testid="home-my-stock"/g)).toHaveLength(1);
    expect(html.indexOf("home-cause-collapse")).toBeLessThan(html.indexOf("home-my-stock-slot"));
    expect(html.indexOf("home-my-stock-slot")).toBeLessThan(html.indexOf('aria-label="자산 분포 필터"'));
    expect(html).toContain('aria-label="내 종목 보기, 엔비디아 11/18 종가 +3.2%, 외 5종목"');
    expect(html).toContain('data-state="on"');
    expect(slotOf(html)).toContain("data-screenshot-hide");
  });
  it("원인 없는 날: 카드 안 지수 줄(card) 다음", () => {
    const html = box({ change: change({ causes: [], sentence: null, estimated: true }), market, marketLine: "on", onMarketOpen: () => {}, myStock: my(up) });
    expect(html.indexOf('data-placement="card"')).toBeLessThan(html.indexOf("home-my-stock-slot"));
    expect(slotOf(html)).toContain("mt-2.5");
  });
  it("히트 40px = 버튼 상자(h-10), 글줄 20px(pt-1·pb-4), 카드 끝에 붙음(-mx-4 -mb-4), after 확장 없음", () => {
    const html = box({ change: change(), myStock: my(up) });
    const b = btnOf(html);
    expect(b).toMatch(/class="[^"]*\bh-10\b[^"]*\bpt-1\b[^"]*\bpb-4\b/);
    expect(b).not.toContain("after:");
    expect(b).toContain("rounded-b-lg");
    expect(b).toContain("focus-visible:ring-inset");
    expect(slotOf(html)).toMatch(/class="-mx-4 [^"]*mt-2\.5 -mb-4/);
    expect(html).not.toContain("transition-all");
  });
  it("S2 내린 날: 오른 날과 DOM이 손익색·data-sign·글자만 다르다", () => {
    const a = btnOf(box({ change: change(), myStock: my(up) }));
    const b = btnOf(box({ change: change(), myStock: my(down) }));
    expect(b).toContain('data-sign="down"');
    expect(a).toContain('data-sign="up"');
    const norm = (h: string) => h.replace(/data-sign="\w+"/, "").replace(/text-(rose|blue)-\d+ dark:text-(rose|blue)-\d+/g, "").replace(/[+-]3\.2%/g, "");
    expect(norm(a)).toBe(norm(b));
    expect(b).toContain("-3.2%");
    expect(b).not.toContain("−");
  });
  it("S5 N=0: 가운뎃점·외 글자 0, 쉐브론은 남는다", () => {
    const html = btnOf(box({ change: change(), myStock: my({ ...up, more: 0 }) }));
    expect(text(html)).toBe("엔비디아 11/18 종가 +3.2%");
    expect(html).not.toContain("home-my-stock-more");
    expect(html).toContain("lucide-chevron-right");
  });
  it("꼬리 먼저 숨김: 꼬리 칸 flex-row-reverse·flex-wrap·h-5·overflow-hidden, DOM 순서 쉐브론 → 외 N종목, 이름만 truncate", () => {
    const html = btnOf(box({ change: change(), myStock: my(up) }));
    expect(html).toMatch(/flex h-5 min-w-4 flex-1 flex-row-reverse flex-wrap content-start justify-end overflow-hidden/);
    expect(html.indexOf("lucide-chevron-right")).toBeLessThan(html.indexOf("home-my-stock-more"));
    expect(html.match(/truncate/g)).toHaveLength(1);
  });
  it("pending: 스켈레톤 1개(문구 없음), 같은 버튼 노드, inert·aria-hidden·누름 없음", () => {
    const html = box({ change: change(), myStock: my(null, "pending") });
    const s = slotOf(html);
    expect(s).toContain('data-state="pending"');
    expect(s).toContain("inert");
    expect(s).toContain('aria-hidden="true"');
    expect(text(btnOf(html))).toBe("");
    expect(btnOf(html)).toContain("animate-pulse");
    expect(btnOf(html)).not.toContain("aria-label");
  });
  it("off로 시작하면 DOM 0, 캡처 모드·웰컴(prop 없음)도 0", () => {
    expect(box({ change: change(), myStock: my(null, "off") })).not.toContain("home-my-stock");
    expect(box({ change: change(), myStock: my(up), screenshotMode: true })).not.toContain("home-my-stock");
    expect(box({ change: change() })).not.toContain("home-my-stock");
  });
  it("기여 금액·순위 낱말 0 (DOM·aria-label)", () => {
    const html = box({ change: change({ causes: [], sentence: null, negligible: true }), myStock: my(up) });
    const s = slotOf(html);
    expect(text(s)).not.toMatch(/원|가장|1위|급등|급락|확인하세요|지금/);
    expect(s).not.toMatch(/aria-label="[^"]*(원|가장)/);
  });
});
