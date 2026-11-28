// #317(5.159) 성과 › 배당 압축 — 토글·옛 라벨 0, 결론 줄 합 = Hero, 범례 '예상'은 연간 예상 > 0일 때만, 표 머리 '합계'
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { Stock } from "@/types/asset";
import { computeDividends } from "@/lib/finance/dividend-calc";
import type { DividendPayoutResult } from "@/lib/finance/finance-service";

vi.mock("@/contexts/asset-data-context", () => ({ useAssetData: () => ({ assetData: { stocks: [], transactions: [] }, exchangeRates: { USD: 1400, JPY: 900 } }) }));
const mocked = vi.hoisted(() => ({ value: {} as unknown }));
vi.mock("../use-dividend-data", async (importOriginal) => ({ ...(await importOriginal<typeof import("../use-dividend-data")>()), useDividendData: () => mocked.value }));

import { DividendCard } from "../dividend-chart";
import { MonthlyDividendStocks } from "../monthly-dividend-stocks";
import { buildDividendGroups } from "../use-dividend-data";

const TODAY = new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);
const YEAR = TODAY.slice(0, 4);
const stock = (o: Partial<Stock>): Stock =>
  ({ id: "A", category: "domestic", name: "삼성", ticker: "005930", quantity: 100, averagePrice: 50_000, currentPrice: 60_000, currency: "KRW", purchaseDate: "2020-01-02", ...o }) as Stock;
const pay = (d: string, a: number, est = false) => ({ payoutDate: d, amountPerShare: a, isEstimated: est }) as DividendPayoutResult;

function setup(stocks: Stock[], payouts: DividendPayoutResult[]) {
  const { grouped, jpyCount } = buildDividendGroups(stocks);
  const groups = grouped.map((g) => ({ ...g, payouts, isLoading: false }));
  const calc = computeDividends(groups.flatMap((g) => g.items.map((s) => ({ stock: s, payouts }))), [], 1400, TODAY);
  mocked.value = { groups, calc, isLoading: false, loadedCount: groups.length, failedCount: 0, totalCount: groups.length, jpyCount };
  return { groups, calc, html: renderToStaticMarkup(<DividendCard />) };
}
const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
const num = (t: string) => Number(t.replace(/[^\d]/g, ""));

describe("배당 압축", () => {
  const both = [pay(`${YEAR}-01-15`, 100), pay(`${YEAR}-12-31`, 50, true)];
  it("토글·옛 문구 0, Hero '올해 배당', 결론 줄 지급+예상 = Hero", () => {
    const { calc, html } = setup([stock({})], both);
    for (const w of ["예상 포함", "지급만", "올해 예상 배당", "배당 표시 모드"]) expect(html).not.toContain(w);
    expect(text(html.match(/data-testid="dividend-hero-label"[^>]*>([^<]*)</)![1])).toBe("올해 배당");
    const c = html.match(/data-testid="dividend-conclusion"[^>]*data-paid="(\d+)" data-expected="(\d+)"/)!;
    expect(Number(c[1]) + Number(c[2])).toBe(Math.round(calc.annual.total));
    expect(html).toContain('data-testid="dividend-conclusion-next"');
    // 5.184 #377: 범례 `예상 (옅음)` → `예상`
    expect(html).toContain('data-testid="dividend-chart-legend-expected"');
    expect(html).not.toContain("(옅음)");
  });
  it("예상 0이면 범례 '예상' 0·예상 조각 0", () => {
    const { html } = setup([stock({})], [pay(`${YEAR}-01-15`, 100)]);
    expect(html).not.toContain("dividend-chart-legend-expected");
    expect(html).not.toContain("dividend-conclusion-expected");
    expect(html).not.toContain("dividend-conclusion-next");
  });
  it("InfoHint 본문 2줄(요약과 겹치는 줄 삭제)", () => {
    const { html } = setup([stock({})], both);
    expect(html).not.toContain("미지급 월은");
    expect(html).not.toContain("한 달 정도 오차");
  });
  it("표 머리 '올해 합계'(월 선택 시 '{m}월 합계'), '예상금액' 0 — 5.184 #377 '합계' → '올해 합계'", () => {
    const { groups, calc } = setup([stock({})], both);
    const all = renderToStaticMarkup(<MonthlyDividendStocks selectedMonth={undefined} groups={groups} calc={calc} />);
    expect(all).not.toContain("예상금액");
    expect(text(all.match(/data-testid="dividend-col-total"[^>]*>([^<]*)</)![1])).toBe("올해 합계");
    const m = renderToStaticMarkup(<MonthlyDividendStocks selectedMonth={1} groups={groups} calc={calc} />);
    expect(text(m.match(/data-testid="dividend-col-total"[^>]*>([^<]*)</)![1])).toBe("1월 합계");
    expect(num(text(all))).toBeGreaterThan(0);
  });
});
