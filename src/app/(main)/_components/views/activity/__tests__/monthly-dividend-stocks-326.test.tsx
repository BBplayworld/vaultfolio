// #326(5.163)·#332(5.165) 배당 월별 종목 표 — 640px 미만(sm 미만) 행 2단: DOM 한 벌 + `max-sm:`(폭 < 40rem) 배치만(640 이상 클래스 불변), ARIA 표 역할, testId, 정보 삭제 0
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { Stock } from "@/types/asset";
import { computeDividends } from "@/lib/finance/dividend-calc";
import type { DividendPayoutResult } from "@/lib/finance/finance-service";

vi.mock("@/contexts/asset-data-context", () => ({ useAssetData: () => ({ assetData: { stocks: [], transactions: [] }, exchangeRates: { USD: 1400, JPY: 900 } }) }));

import { MonthlyDividendStocks } from "../monthly-dividend-stocks";
import { buildDividendGroups } from "../use-dividend-data";

const TODAY = new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);
const YEAR = TODAY.slice(0, 4);
const stock = (o: Partial<Stock>): Stock =>
  ({ id: "A", category: "domestic", name: "TIGER 미국S&P500", ticker: "360750", quantity: 105, averagePrice: 50_000, currentPrice: 60_000, currency: "KRW", purchaseDate: "2024-09-03", ...o }) as Stock;
const pay = (m: number, a: number, o: Partial<DividendPayoutResult> = {}) => ({ payoutDate: `${YEAR}-${String(m).padStart(2, "0")}-01`, amountPerShare: a, frequency: "quarterly", ...o }) as DividendPayoutResult;

function render(stocks: Stock[], payouts: DividendPayoutResult[], selectedMonth?: number) {
  const { grouped } = buildDividendGroups(stocks);
  const groups = grouped.map((g) => ({ ...g, payouts, isLoading: false }));
  const calc = computeDividends(groups.flatMap((g) => g.items.map((s) => ({ stock: s, payouts }))), [], 1400, TODAY);
  return renderToStaticMarkup(<MonthlyDividendStocks selectedMonth={selectedMonth} groups={groups} calc={calc} />);
}
const count = (html: string, re: RegExp) => (html.match(re) ?? []).length;
const classOf = (html: string, testid: string) => html.match(new RegExp(`data-testid="${testid}"[^>]*class="([^"]*)"`))?.[1] ?? html.match(new RegExp(`class="([^"]*)"[^>]*data-testid="${testid}"`))![1];
/** 640 미만 전용 클래스를 걷어 낸 값 = 640 이상에서 실제로 적용되는 클래스(기본 5열 값은 sm:가 덮는다) */
const wide = (cls: string) => cls.split(/\s+/).filter((c) => !c.startsWith("max-sm:")).join(" ");

const GRID = "grid grid-cols-[minmax(0,1fr)_3.25rem_3.5rem_3.5rem_3.5rem] sm:grid-cols-[minmax(0,1fr)_11.5rem_4.75rem_5.5rem_5.5rem] lg:grid-cols-[1fr_16rem_6rem_7rem_7rem] gap-x-1 sm:gap-x-2 lg:gap-x-3 px-2 sm:px-3";

describe("배당 종목 표 640px 미만 2단(#326·#332)", () => {
  const krw = render([stock({})], [pay(1, 361), pay(12, 361, { isEstimated: true })]);
  const usdPays = [pay(1, 0.5, { amountForeign: 0.5, currency: "USD", isEstimated: true }), pay(12, 0.5, { amountForeign: 0.5, currency: "USD", isEstimated: true })];
  const usd = render([stock({ id: "U", category: "foreign", currency: "USD", name: "Schwab US Dividend Equity ETF", ticker: "SCHD" })], usdPays);

  it("ARIA: 그룹마다 table 1개, 머리글 columnheader 5개, 행마다 cell 5개(전 폭 같은 DOM·순서)", () => {
    expect(count(krw, /role="table"/g)).toBe(1);
    expect(krw).toContain('aria-label="국내주식 배당 종목"');
    expect(krw).toMatch(/data-testid="dividend-table" data-category="domestic"/);
    expect(count(krw, /role="columnheader"/g)).toBe(5);
    expect(count(krw, /role="row"/g)).toBe(2);
    expect(count(krw, /role="cell"/g)).toBe(5);
    const heads = [...krw.matchAll(/role="columnheader"[^>]*>([^<]*)</g)].map((m) => m[1]);
    // 5.184 #377: `주당`/`지급금액`/`합계` → `최근 1주당`/`지급`/`올해 합계`
    expect(heads).toEqual(["종목명", "배당월", "최근 1주당", "지급", "올해 합계"]);
    // 셀 순서: 이름 → 배당월 → 주당 → 지급 → 합계
    const order = ["dividend-stock-name", "dividend-stock-months", "dividend-stock-pershare", "dividend-cell-paid", "dividend-cell-total"].map((id) => krw.indexOf(`data-testid="${id}"`));
    expect(order.every((v, i) => v > 0 && (i === 0 || v > order[i - 1]))).toBe(true);
  });

  it("testId: 기존 7개 유지 + 신규 8개", () => {
    for (const id of ["dividend-stock-row", "dividend-stock-name", "dividend-stock-meta", "dividend-paid-amount", "dividend-est-amount", "dividend-col-paid", "dividend-col-total",
      "dividend-table", "dividend-col-months", "dividend-col-pershare", "dividend-stock-purchase", "dividend-stock-months", "dividend-stock-pershare", "dividend-cell-paid", "dividend-cell-total"]) {
      expect(krw, id).toContain(`data-testid="${id}"`);
    }
  });

  it("640 이상 불변: 640 미만 전용 클래스를 걷어 내면 main(9c13292)의 클래스와 같다", () => {
    expect(wide(classOf(krw, "dividend-stock-row"))).toBe(`${GRID} py-2.5 items-center`);
    expect(wide(krw.match(/role="row" class="([^"]*)"/)![1])).toBe(`${GRID} py-2 bg-muted/50 text-xs whitespace-nowrap text-muted-foreground border-b`);
    expect(wide(classOf(krw, "dividend-stock-name"))).toBe("text-sm font-semibold truncate");
    expect(wide(classOf(krw, "dividend-stock-purchase"))).toBe("text-xs text-muted-foreground mt-1");
    expect(wide(classOf(krw, "dividend-stock-months"))).toBe("flex flex-wrap gap-1 sm:gap-1.5 justify-end");
    expect(wide(classOf(krw, "dividend-stock-pershare"))).toBe("text-right");
    expect(wide(classOf(krw, "dividend-cell-paid"))).toBe("text-right whitespace-nowrap");
    expect(wide(classOf(krw, "dividend-cell-total"))).toBe("text-right whitespace-nowrap");
    expect(wide(classOf(krw, "dividend-col-months"))).toBe("text-right");
    expect(wide(classOf(krw, "dividend-col-pershare"))).toBe("text-right");
    // 2단 전용이 아닌 반응형 접두를 새로 쓴 곳은 자리 채움 1곳(sm:hidden)뿐
    expect(count(krw + usd, /(^|[ "])sm:hidden/g)).toBe(1);
    expect(krw + usd).not.toContain("min-[360px]:");
  });

  it("640 미만: 행·머리글 3열 그리드, 이름·칩 전폭, 배당월 머리글은 sr-only(display:none 아님)", () => {
    for (const id of ["dividend-stock-row"]) expect(classOf(krw, id)).toContain("max-sm:grid-cols-[minmax(0,1fr)_5rem_5.5rem]");
    expect(krw.match(/role="row" class="([^"]*)"/)![1]).toContain("max-sm:grid-cols-[minmax(0,1fr)_5rem_5.5rem]");
    expect(classOf(krw, "dividend-stock-months")).toContain("max-sm:col-span-3");
    expect(classOf(krw, "dividend-stock-months")).toContain("max-sm:justify-start");
    expect(classOf(krw, "dividend-stock-name")).toContain("max-sm:line-clamp-2");
    expect(classOf(krw, "dividend-col-months")).toContain("max-sm:sr-only");
    expect(classOf(krw, "dividend-col-months")).not.toMatch(/(^| )(max-sm:)?hidden( |$)/);
    expect(classOf(krw, "dividend-stock-purchase")).toContain("max-sm:whitespace-nowrap");
    expect(classOf(krw, "dividend-stock-pershare")).toContain("max-sm:whitespace-nowrap");
  });

  it("정보 삭제 0: 이름·주기 배지·매수 날짜(형식 그대로)·칩·주당·보유·지급·합계", () => {
    const t = krw.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
    for (const w of ["TIGER 미국S&amp;P500", "분기", "매수 2024-09-03", "1월", "12월 예상", "361원", "지금 105주", "37,905원", "75,810원"]) expect(t, w).toContain(w);
  });

  it("USD 행: 외화 지급이 0이면 지급 칸에 자리 채움 1줄(aria-hidden, 640 이상 숨김), 지급이 있으면 없음", () => {
    expect(count(usd, /<p aria-hidden="true" class="text-xs sm:hidden">/g)).toBe(1);
    expect(count(krw, /sm:hidden/g)).toBe(0);
    const paid = render([stock({ id: "U", category: "foreign", currency: "USD", ticker: "SCHD" })], [pay(1, 0.5, { amountForeign: 0.5, currency: "USD" })]);
    expect(count(paid, /sm:hidden/g)).toBe(0);
  });

  it("경계: 2단 전용 접두는 `max-sm:`(폭 < 640)만 쓴다 — 359 임의 값 접두 0, 360은 종목명 머리 sr-only 1곳만(5.184 #377 수용 기준 11)", () => {
    expect(krw + usd).not.toMatch(/max-\[359px\]:/);
    expect(count(krw, /max-\[360px\]:/g)).toBe(1);
    expect(krw).toMatch(/role="columnheader" class="[^"]*max-\[360px\]:sr-only"[^>]*>종목명</);
    expect(count(krw, /max-sm:/g)).toBeGreaterThan(20);
  });

  it("월 선택 머리글 `N월 지급`·`N월 합계` 유지", () => {
    const m = render([stock({})], [pay(1, 361)], 1);
    expect(m).toMatch(/data-testid="dividend-col-paid"[^>]*>1월 지급</);
    expect(m).toMatch(/data-testid="dividend-col-total"[^>]*>1월 합계</);
  });
});
