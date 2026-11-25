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

  it("5종 모두 0건이면 현행 0건 카드 5장이고 추가하기 줄은 없다", () => {
    const html = renderToStaticMarkup(<DetailHub />);
    expect(h.cards.map((c) => c.title)).toEqual(["주식", "부동산", "암호화폐", "현금", "대출"]);
    expect(html).not.toContain("hub-add-row");
  });
});

// #290(5.148) 0건 자산군은 카드 대신 맨 아래 '추가하기' 줄 — 순서 고정, 실물 제외, 칩 클릭은 같은 open-add-asset-sheet
function findByTestId(node: unknown, id: string, out: Array<{ props: Record<string, unknown> }> = []) {
  if (!node || typeof node !== "object") return out;
  if (Array.isArray(node)) { node.forEach((n) => findByTestId(n, id, out)); return out; }
  const el = node as { props?: Record<string, unknown> };
  if (el.props) {
    if (typeof el.props["data-testid"] === "string" && (el.props["data-testid"] as string).startsWith(id)) out.push(el as { props: Record<string, unknown> });
    findByTestId(el.props.children, id, out);
  }
  return out;
}

describe("상세 허브 추가하기 줄(#290)", () => {
  it("주식·현금 보유: 카드는 주식→현금 2장, 줄은 부동산·암호화폐·대출 순", () => {
    h.summary = { ...ZERO, stockCount: 2, stockValue: 100, cashCount: 1, cashValue: 5 };
    const html = renderToStaticMarkup(<DetailHub />);
    expect(h.cards.map((c) => c.title)).toEqual(["주식", "현금"]);
    const order = ["real-estate", "crypto", "loan"].map((c) => html.indexOf(`hub-add-chip-${c}`));
    expect(order.every((i) => i > 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(html).not.toContain("hub-add-chip-stock");
    expect(html).not.toContain("hub-add-chip-cash");
    expect(html).toContain("data-screenshot-hide");
    expect(html.indexOf("hub-add-row")).toBeLessThan(html.indexOf("detail-hub-tax-row"));
  });

  it("칩을 누르면 그 자산군으로 open-add-asset-sheet가 발송된다", () => {
    h.summary = { ...ZERO, stockCount: 1, stockValue: 1 };
    const tree = DetailHub();
    const chips = findByTestId(tree, "hub-add-chip-");
    expect(chips.map((c) => c.props["data-testid"])).toEqual(["hub-add-chip-real-estate", "hub-add-chip-crypto", "hub-add-chip-cash", "hub-add-chip-loan"]);
    (chips[0].props.onClick as () => void)();
    expect(events.at(-1)).toEqual({ type: "open-add-asset-sheet", detail: { category: "real-estate" } });
    (chips[3].props.onClick as () => void)();
    expect(events.at(-1)).toEqual({ type: "open-add-asset-sheet", detail: { category: "loan" } });
    expect(h.navigate).not.toHaveBeenCalled();
  });

  it("실물만 보유: 카드는 실물 1장, 줄은 5칩(실물 칩 없음)", () => {
    h.summary = { ...ZERO, physicalCount: 1, physicalValue: 10 };
    const html = renderToStaticMarkup(<DetailHub />);
    expect(h.cards.map((c) => c.title)).toEqual(["실물 자산"]);
    expect((html.match(/hub-add-chip-/g) ?? []).length).toBe(5);
    expect(html).not.toContain("hub-add-chip-physical");
  });

  it("대출만 보유(부채만 사용자): 카드는 대출, 줄은 주식·부동산·암호화폐·현금", () => {
    h.loans = [{}];
    h.summary = { ...ZERO, loanCount: 1, loanBalance: 10 };
    const html = renderToStaticMarkup(<DetailHub />);
    expect(h.cards.map((c) => c.title)).toEqual(["대출"]);
    expect(html).not.toContain("hub-add-chip-loan");
    expect((html.match(/hub-add-chip-/g) ?? []).length).toBe(4);
  });

  it("5종 모두 보유(실물 0): 줄 없음, 6종 전부여도 줄 없음", () => {
    h.loans = [{}];
    h.summary = { ...ZERO, stockCount: 1, realEstateCount: 1, cryptoCount: 1, cashCount: 1, loanCount: 1, physicalCount: 1 };
    const html = renderToStaticMarkup(<DetailHub />);
    expect(h.cards).toHaveLength(6);
    expect(html).not.toContain("hub-add-row");
  });
});
