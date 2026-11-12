// 4.85 상세 허브 0건 카드 — 눌렀을 때 그 자산군 추가 시트 이벤트, 보조 줄 '추가하기'. 보유 카드는 기존대로 탭 이동
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const h = vi.hoisted(() => ({
  summary: {} as Record<string, number>,
  cards: [] as Array<{ title: string; onClick: () => void; secondary: unknown }>,
  navigate: vi.fn(),
  loans: [] as unknown[],
}));
vi.mock("@/contexts/asset-data-context", () => ({
  useAssetData: () => ({ assetData: { loans: h.loans, realEstate: [], stocks: [], cash: [] }, getAssetSummary: () => h.summary }),
}));
vi.mock("../../../layout/navigation/navigation-context", () => ({
  useAssetNavigation: () => ({ navigate: h.navigate }),
}));
vi.mock("../../../layout/ui/hub-share-button", () => ({ HubShareButton: () => null }));
vi.mock("../../../layout/ui/kpi-card", () => ({
  KpiCard: (p: { title: string; onClick: () => void; secondary: unknown }) => { h.cards.push(p); return null; },
}));

import { DetailHub } from "../detail-hub";

const ZERO = {
  stockValue: 0, stockCount: 0, stockProfit: 0, stockCost: 0,
  realEstateValue: 0, realEstateCount: 0, realEstateProfit: 0, realEstateCost: 0,
  cryptoValue: 0, cryptoCount: 0, cryptoProfit: 0, cryptoCost: 0,
  cashValue: 0, cashCount: 0, loanBalance: 0, loanCount: 0,
  physicalValue: 0, physicalCount: 0, physicalProfit: 0, physicalCost: 0,
};
const events: Array<{ type: string; detail: unknown }> = [];

beforeEach(() => {
  h.cards = []; h.navigate.mockClear(); h.loans = []; events.length = 0;
  h.summary = { ...ZERO };
  (globalThis as unknown as { window: unknown }).window = {
    dispatchEvent: (e: CustomEvent) => { events.push({ type: e.type, detail: e.detail }); return true; },
  };
});
afterEach(() => { delete (globalThis as { window?: unknown }).window; });

describe("상세 허브 0건 카드", () => {
  it("0건 카드를 누르면 그 자산군으로 open-add-asset-sheet가 발송되고 탭 이동은 없다", () => {
    renderToStaticMarkup(<DetailHub />);
    const byTitle = Object.fromEntries(h.cards.map((c) => [c.title, c]));
    const expected: Record<string, string> = { 주식: "stock", 부동산: "real-estate", 암호화폐: "crypto", 현금: "cash", 대출: "loan" };
    for (const [title, category] of Object.entries(expected)) {
      byTitle[title].onClick();
      expect(events.at(-1)).toEqual({ type: "open-add-asset-sheet", detail: { category } });
    }
    expect(events).toHaveLength(5);
    expect(h.navigate).not.toHaveBeenCalled();
    expect(h.cards.some((c) => c.title === "실물 자산")).toBe(false); // 실물 0건은 숨김 유지
  });

  it("0건 보조 줄은 '0건' 대신 '추가하기'", () => {
    renderToStaticMarkup(<DetailHub />);
    for (const c of h.cards) expect(renderToStaticMarkup(<>{c.secondary}</>)).toContain("추가하기");
  });

  it("보유 카드는 기존대로 상세 탭으로 이동하고 시트를 열지 않는다", () => {
    h.summary = { ...ZERO, stockCount: 2, stockValue: 100, cashCount: 1, cashValue: 5 };
    renderToStaticMarkup(<DetailHub />);
    const byTitle = Object.fromEntries(h.cards.map((c) => [c.title, c]));
    byTitle["주식"].onClick();
    byTitle["현금"].onClick();
    expect(h.navigate).toHaveBeenNthCalledWith(1, { type: "detail", tab: "stocks" });
    expect(h.navigate).toHaveBeenNthCalledWith(2, { type: "detail", tab: "cash" });
    expect(events).toHaveLength(0);
    expect(renderToStaticMarkup(<>{byTitle["현금"].secondary}</>)).toContain("1건");
  });
});
