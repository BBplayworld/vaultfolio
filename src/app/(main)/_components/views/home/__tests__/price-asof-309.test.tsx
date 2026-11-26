// #309 '언제 시세' 줄 — 홈 카드 맨 아래 각주·주식 요약 footnote 슬롯·조각/점 위치 (정적 렌더)
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("@/app/(main)/_components/layout/navigation/navigation-context", () => ({
  useAssetNavigation: () => ({ navigate: () => {} }),
}));

import { NetAssetSummaryBox } from "../dashboard";
import { PriceAsOfLine } from "../../price-asof-line";
import { DetailSummaryHeader } from "../../detail/detail-summary-header";

const text = (html: string) => html.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
const myStock = { state: "on" as const, pick: { name: "엔비디아", label: "11/18 종가", rateText: "+3.2%", sign: "up" as const, rate: 3.2, more: 0 }, onOpen: () => {} };

describe("PriceAsOfLine", () => {
  it("꼬리 있으면 점은 앞 조각 끝, 각 조각 nowrap, 꼬리만 진하게", () => {
    const html = renderToStaticMarkup(<PriceAsOfLine value={{ main: "주식 11/25 종가", failedText: "2종목 이전 시세" }} />);
    expect(text(html)).toBe("주식 11/25 종가 · 2종목 이전 시세");
    expect(html).toMatch(/data-testid="price-asof-main" class="whitespace-nowrap">주식 11\/25 종가 ·<\/span>/);
    expect(html).toMatch(/data-testid="price-asof-failed" class="whitespace-nowrap text-foreground">2종목 이전 시세/);
    expect(html).toContain("data-screenshot-hide");
    expect(html).toContain("text-2xs text-muted-foreground tabular-nums");
    expect(html).not.toContain("aria-live");
  });
  it("전부 실패는 꼬리만(앞 점 0), 실패 0은 꼬리 DOM 0", () => {
    const only = renderToStaticMarkup(<PriceAsOfLine value={{ main: "", failedText: "3종목 이전 시세" }} />);
    expect(text(only)).toBe("3종목 이전 시세");
    expect(only).not.toContain("price-asof-main");
    const none = renderToStaticMarkup(<PriceAsOfLine value={{ main: "주식 14시 시세", failedText: "" }} />);
    expect(text(none)).toBe("주식 14시 시세");
    expect(none).not.toContain("price-asof-failed");
  });
});

describe("홈 순자산 카드", () => {
  const box = (p: Record<string, unknown>) => renderToStaticMarkup(<NetAssetSummaryBox netAsset={100_000_000} treemapData={[]} {...(p as object)} />);
  it("카드 맨 아래(내 종목 줄 뒤), mt-2", () => {
    const html = box({ myStock, priceAsOf: { main: "주식 14시 시세", failedText: "" } });
    expect(html.match(/data-testid="price-asof"/g)).toHaveLength(1);
    expect(html.indexOf("home-my-stock-slot")).toBeLessThan(html.indexOf('data-testid="price-asof"'));
    expect(html).toMatch(/data-testid="price-asof"[^>]*class="[^"]*mt-2/);
  });
  it("값 없음·캡처 모드·웰컴(전달 안 함)은 DOM 0", () => {
    expect(box({ priceAsOf: null })).not.toContain("price-asof");
    expect(box({ priceAsOf: { main: "주식 14시 시세", failedText: "" }, screenshotMode: true })).not.toContain("price-asof");
    expect(box({})).not.toContain("price-asof");
  });
});

describe("DetailSummaryHeader footnote", () => {
  it("없으면 DOM 불변(다른 4개 탭 diff 0), 있으면 박스 안 맨 아래", () => {
    const base = renderToStaticMarkup(<DetailSummaryHeader label="총 현금성 자산" value={1000} inline={<span>x</span>} />);
    const same = renderToStaticMarkup(<DetailSummaryHeader label="총 현금성 자산" value={1000} inline={<span>x</span>} footnote={undefined} />);
    expect(same).toBe(base);
    const withNote = renderToStaticMarkup(<DetailSummaryHeader label="총 주식 평가금액" value={1000} inline={<span>x</span>} footnote={<PriceAsOfLine value={{ main: "14시 시세", failedText: "" }} className="mt-2" />} />);
    expect(withNote.indexOf("<span>x</span>")).toBeLessThan(withNote.indexOf("price-asof"));
    expect(withNote.endsWith("</p></div>")).toBe(true);
  });
});
