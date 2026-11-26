// #317(5.159) 종목 한 장 배당 줄 — 상태별 렌더, 값 = 배당 표 그 종목 행 합계, 엔화는 요청 0, GA title
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { Stock } from "@/types/asset";
import { computeDividends, dividendStockKey } from "@/lib/finance/dividend-calc";
import type { DividendPayoutResult } from "@/lib/finance/finance-service";
import { featureTitleOf } from "@/lib/analytics/ga";
import { buildDividendGroups } from "../../../activity/use-dividend-data";

vi.mock("../../../../layout/navigation/navigation-context", async (importOriginal) => {
  const mod = await importOriginal<typeof import("../../../../layout/navigation/navigation-context")>();
  return { ...mod, useAssetNavigation: () => ({ navigate: () => {}, view: { type: "home" }, back: () => {}, slideDir: null }) };
});
const mocked = vi.hoisted(() => ({ value: {} as unknown }));
vi.mock("../../../activity/use-dividend-data", async (importOriginal) => {
  const mod = await importOriginal<typeof import("../../../activity/use-dividend-data")>();
  return { ...mod, useDividendData: () => mocked.value };
});
import { StockPageDividendRow } from "../stock-page-view";

const TODAY = new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);
const YEAR = TODAY.slice(0, 4);
const stock = (o: Partial<Stock>): Stock =>
  ({ id: "A", category: "domestic", name: "삼성", ticker: "005930", quantity: 100, averagePrice: 50_000, currentPrice: 60_000, currency: "KRW", purchaseDate: "2020-01-02", ...o }) as Stock;
const pay = (d: string, a: number, est = false) => ({ payoutDate: d, amountPerShare: a, isEstimated: est }) as DividendPayoutResult;

function setup(stocks: Stock[], payouts: DividendPayoutResult[], o: { loading?: boolean; failed?: number } = {}) {
  const { grouped, jpyCount } = buildDividendGroups(stocks);
  const groups = grouped.map((g) => ({ ...g, payouts, isLoading: !!o.loading }));
  const calc = computeDividends(groups.flatMap((g) => g.items.map((s) => ({ stock: s, payouts }))), [], 1400, TODAY);
  mocked.value = { groups, calc, isLoading: !!o.loading, loadedCount: 0, failedCount: o.failed ?? 0, totalCount: groups.length, jpyCount };
  return { calc, html: renderToStaticMarkup(<StockPageDividendRow stocks={stocks} />) };
}
const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
const val = (html: string, id: string) => Number(html.match(new RegExp(`data-testid="${id}"[^>]*data-value="(\\d+)"`))?.[1] ?? NaN);

// 올해 1월(지급 확정)·말일 뒤 12월(예상) — 오늘이 12월 31일이어도 예상이 남도록 다음 해가 아니라 같은 해 12/31 사용
const PAYOUTS = [pay(`${YEAR}-01-15`, 100), pay(`${YEAR}-12-31`, 50, true)];

describe("종목 한 장 배당 줄", () => {
  it("배당 있음 — 지급+예상이 배당 표 행 합계와 같고 '올해 배당'으로 시작, 세전 추정 1곳", () => {
    const { calc, html } = setup([stock({})], PAYOUTS);
    const row = calc.byStock.get(dividendStockKey(stock({})))!;
    expect(val(html, "stock-page-dividend-paid") + val(html, "stock-page-dividend-expected")).toBe(Math.round(row.paid + row.expected));
    expect(html).toContain('data-state="ready"');
    expect(text(html)).toMatch(/^올해 배당 지급 .+ 예상 .+ 다음 지급 \d+월 · 세전 추정/);
    expect(html.match(/세전 추정/g)).toHaveLength(1);
  });
  it("여러 계좌·카테고리 그룹 — 값 = 행들 합계", () => {
    const a = stock({ id: "A" });
    const b = stock({ id: "B", category: "isa", quantity: 30 });
    const { calc, html } = setup([a, b], PAYOUTS);
    const sum = Array.from(calc.byStock.values()).reduce((n, r) => n + r.paid + r.expected, 0);
    expect(val(html, "stock-page-dividend-paid") + val(html, "stock-page-dividend-expected")).toBe(Math.round(sum));
  });
  it("지급만이면 예상 조각 없음, 예상만이면 '올해 배당 예상'", () => {
    const paidOnly = setup([stock({})], [pay(`${YEAR}-01-15`, 100)]).html;
    expect(text(paidOnly)).toMatch(/^올해 배당 지급 .+ 세전 추정/);
    expect(paidOnly).not.toContain("stock-page-dividend-expected");
    expect(paidOnly).not.toContain("stock-page-dividend-next");
    const expOnly = setup([stock({})], [pay(`${YEAR}-12-31`, 50, true)]).html;
    expect(text(expOnly)).toMatch(/^올해 배당 예상 .+ 다음 지급 \d+월/);
    expect(expOnly).not.toContain("stock-page-dividend-paid");
  });
  it("조회 중·무배당은 줄 0", () => {
    expect(setup([stock({})], PAYOUTS, { loading: true }).html).toBe("");
    expect(setup([stock({})], []).html).toBe("");
  });
  it("실패는 안내만(금액·화살표·버튼 0)", () => {
    const { html } = setup([stock({})], PAYOUTS, { failed: 1 });
    expect(html).toContain('data-state="failed"');
    expect(text(html)).toBe("배당을 불러오지 못했어요");
    expect(html).not.toContain("<button");
    expect(html).not.toContain("<svg");
  });
  it("엔화만 — 조회 대상 0(요청 0)이고 안내만", () => {
    const jpy = stock({ currency: "JPY", ticker: "7203", category: "foreign" });
    expect(buildDividendGroups([jpy]).grouped).toHaveLength(0);
    const { html } = setup([jpy], PAYOUTS);
    expect(html).toContain('data-state="jpy"');
    expect(text(html)).toBe("배당 조회 안 됨 · 엔화 종목");
    expect(html).not.toContain("<button");
  });
  it("대상 아님(티커 없음·비상장·상장폐지)은 줄 0", () => {
    expect(setup([stock({ ticker: "" })], PAYOUTS).html).toBe("");
    expect(setup([stock({ category: "unlisted" })], PAYOUTS).html).toBe("");
    expect(setup([stock({ inactiveStatus: "delisted" })], PAYOUTS).html).toBe("");
  });
  it("GA title — 종목·금액 미전송", () => {
    expect(featureTitleOf("feature_use", { category: "stock_dividend" }, "detail:stocks-item")).toBe("상세·주식·종목·배당");
  });
});
