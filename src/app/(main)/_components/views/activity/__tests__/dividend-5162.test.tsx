// #323(5.162) 배당 문구·숫자 마감 — 화면별 문자열 일치(C150)·확정 문구·월 행 합
import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import type { Stock } from "@/types/asset";
import { computeDividends } from "@/lib/finance/dividend-calc";
import type { DividendPayoutResult } from "@/lib/finance/finance-service";

vi.mock("@/contexts/asset-data-context", () => ({ useAssetData: () => ({ assetData: { stocks: [], transactions: [] }, exchangeRates: { USD: 1400, JPY: 900 } }) }));
const mocked = vi.hoisted(() => ({ value: {} as unknown }));
vi.mock("../use-dividend-data", async (importOriginal) => ({ ...(await importOriginal<typeof import("../use-dividend-data")>()), useDividendData: () => mocked.value }));

import { DividendCard, buildMonthlyTotals } from "../dividend-chart";
import { useDividendAnnualTotals } from "../performance-hub";
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

describe("5.162 예상 단일 정본 — 화면별 일치", () => {
  // 지급 10.4 + 12월 예상 10.4: 합계 반올림 − 지급 반올림이면 예상 11, 정본이면 10
  const rows = [pay(`${YEAR}-01-01`, 0.104), pay(`${YEAR}-12-31`, 0.104, true)];
  it("결론 줄 예상 = 12월 월 행 예상 = 허브 annualEstimated, 지급 + 예상 = Hero", () => {
    const { calc, html } = setup([stock({})], rows);
    const c = html.match(/data-testid="dividend-conclusion"[^>]*data-paid="(\d+)" data-expected="(\d+)"/)!;
    const month = buildMonthlyTotals(calc)[11];
    let hub: ReturnType<typeof useDividendAnnualTotals> | undefined;
    function Probe() { hub = useDividendAnnualTotals(); return null; }
    renderToStaticMarkup(<Probe />);
    expect(c[2]).toBe(String(month.totalEstimated));
    expect(c[2]).toBe(String(hub!.annualEstimated));
    expect(c[1]).toBe(String(hub!.annualActual));
    expect(Number(c[1]) + Number(c[2])).toBe(hub!.annualTotal);
    const heroText = text(html.match(/data-testid="dividend-hero-value"[^>]*>([^<]*)</)?.[1] ?? "");
    if (heroText) expect(heroText.replace(/\D/g, "")).toBe(String(hub!.annualTotal));
  });
  it("월 행 total = totalActual + totalEstimated", () => {
    const { calc } = setup([stock({})], rows);
    for (const r of buildMonthlyTotals(calc)) expect(r.total).toBe(r.totalActual + r.totalEstimated);
  });
});

describe("5.162 확정 문구", () => {
  it("머리·InfoHint 확정 문구, 옛 문구 0", () => {
    const { html } = setup([stock({})], [pay(`${YEAR}-01-15`, 100)]);
    expect(html).toContain("지급일에 보유한 수량 기준 · 세전 추정");
    // InfoHint 본문은 닫힌 상태에서 렌더되지 않아 소스 문자열로 확인
    const src = readFileSync(resolve(__dirname, "../dividend-chart.tsx"), "utf8");
    expect(src).toContain("거래 기록이 있으면 지급일에 갖고 있던 수량, 없으면 지금 수량으로 계산해요. 판 종목은 빠져요. 액면분할한 종목은 분할 전 배당이 실제와 다를 수 있어요.");
    expect(html).not.toContain("지금 보유 종목 기준");
  });
  it("빈 상태 둘째 줄", () => {
    const { html } = setup([stock({})], []);
    expect(html).toContain("보유 종목에서 올해 받을 배당이 없어요");
    expect(html).not.toContain("지금 보유 종목 기준");
  });
});
