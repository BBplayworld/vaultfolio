// #371(5.181) 종목 한 장 배당 줄 둘째 줄 `세전 추정` 자리 → `투입 대비 X%(세전)` — 탭 값 일치(C150, 화면 문자열 단계)·숨김 3조건·첫 줄 불변
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { Stock, Transaction } from "@/types/asset";
import { computeDividends } from "@/lib/finance/dividend-calc";
import { computeDividendYield } from "@/lib/finance/dividend-yield";
import type { DividendPayoutResult } from "@/lib/finance/finance-service";
import type { DividendData } from "../../../activity/use-dividend-data";

const ctx = vi.hoisted(() => ({
  stocks: [] as unknown[],
  txs: [] as unknown[],
  usd: 1400,
  data: (() => ({})) as (stocks: readonly unknown[]) => unknown,
}));
vi.mock("@/contexts/asset-data-context", () => ({
  useAssetData: () => ({ assetData: { stocks: ctx.stocks, transactions: ctx.txs, cash: [], cashTransactions: [] }, exchangeRates: { USD: ctx.usd, JPY: 900 } }),
}));
vi.mock("@/hooks/use-cash-tx-tags", () => ({ useDividendTags: () => ({}) }));
vi.mock("../../../../layout/navigation/navigation-context", async (importOriginal) => {
  const mod = await importOriginal<typeof import("../../../../layout/navigation/navigation-context")>();
  return { ...mod, useAssetNavigation: () => ({ navigate: () => {}, view: { type: "home" }, back: () => {}, slideDir: null }) };
});
vi.mock("../../../activity/use-dividend-data", async (importOriginal) => {
  const mod = await importOriginal<typeof import("../../../activity/use-dividend-data")>();
  return { ...mod, useDividendData: (o: { stocks?: readonly Stock[] } = {}) => ctx.data(o.stocks ?? (ctx.stocks as Stock[])) };
});
import { StockPageDividendRow } from "../stock-page-view";
import { DividendCard } from "../../../activity/dividend-chart";
import { buildDividendGroups } from "../../../activity/use-dividend-data";

const TODAY = new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);
const YEAR = TODAY.slice(0, 4);
const stock = (o: Partial<Stock>): Stock =>
  ({ id: "A", category: "domestic", name: "삼성", ticker: "005930", quantity: 100, averagePrice: 50_000, currentPrice: 60_000, currency: "KRW", purchaseDate: "2020-01-02", ...o }) as Stock;
const pay = (d: string, a: number, est = false) => ({ payoutDate: d, amountPerShare: a, isEstimated: est }) as DividendPayoutResult;
const PAYOUTS = [pay(`${YEAR}-01-15`, 100), pay(`${YEAR}-12-31`, 50, true)];

// 훅과 같은 조립(buildDividendGroups → computeDividends) — 종목 한 장은 그 그룹 행만, 탭은 전체 행
function setup(stocks: Stock[], o: { payouts?: DividendPayoutResult[]; txs?: Transaction[]; usd?: number } = {}) {
  const payouts = o.payouts ?? PAYOUTS;
  ctx.stocks = stocks;
  ctx.txs = o.txs ?? [];
  ctx.usd = o.usd ?? 1400;
  ctx.data = (rows) => {
    const { grouped, jpyCount } = buildDividendGroups(rows as Stock[]);
    const groups = grouped.map((g) => ({ ...g, payouts, isLoading: false }));
    const calc = computeDividends(groups.flatMap((g) => g.items.map((s) => ({ stock: s, payouts }))), ctx.txs as Transaction[], ctx.usd, TODAY);
    return { groups, calc, isLoading: false, loadedCount: groups.length, failedCount: 0, totalCount: groups.length, jpyCount } satisfies DividendData;
  };
}
const row = (stocks: Stock[]) => renderToStaticMarkup(<StockPageDividendRow stocks={stocks} />);
const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
const yieldText = (html: string) => {
  const m = html.match(/<span[^>]*data-testid="stock-page-dividend-yield"[^>]*>(.*?)<\/span><\/p>/);
  return m ? text(m[1]) : null;
};
const tabText = (html: string) => html.match(/data-testid="dividend-yield-value"[^>]*>([^<]*)</)?.[1] ?? null;
const fnText = (stocks: Stock[]) => {
  const d = ctx.data(stocks) as DividendData;
  return computeDividendYield(d.groups, ctx.usd, "all", d.calc)!.text;
};

describe("투입 대비 X%(세전) — 탭 값 일치(C150)", () => {
  const FIX: [string, Stock[]][] = [
    ["KRW 1그룹", [stock({})]],
    ["USD 1그룹", [stock({ id: "U", ticker: "SCHD", category: "foreign", currency: "USD", averagePrice: 25, quantity: 40 })]],
    ["국내+ISA 2그룹", [stock({ id: "A" }), stock({ id: "B", category: "isa", quantity: 30 })]],
  ];
  for (const [name, stocks] of FIX) {
    it(`${name}: ① 줄 글자 = 함수 .text ② 그 종목만 가진 포트폴리오의 탭 글자 = ①`, () => {
      setup(stocks);
      const html = row(stocks);
      expect(html).toContain('data-yield="shown"');
      const t = fnText(stocks);
      expect(yieldText(html)).toBe(`· 투입 대비 ${t}(세전)`);
      expect(tabText(renderToStaticMarkup(<DividendCard />))).toBe(t);
    });
  }
  it("③ 다종목 포트폴리오: 탭 groups를 그 키로 거른 값 = 종목 한 장", () => {
    const a = stock({ id: "A" });
    const other = stock({ id: "X", ticker: "000660", name: "하이닉스", averagePrice: 1_000, quantity: 1_000 });
    setup([a, other]);
    const all = ctx.data([a, other]) as DividendData;
    const only = all.groups.filter((g) => g.key === "005930:domestic");
    expect(yieldText(row([a]))).toBe(`· 투입 대비 ${computeDividendYield(only, 1400, "all", all.calc)!.text}(세전)`);
    // 탭(포트폴리오) 값은 범위가 달라 다르다 — 라벨만 같다
    expect(tabText(renderToStaticMarkup(<DividendCard />))).not.toBe(computeDividendYield(only, 1400, "all", all.calc)!.text);
  });
  it("USD는 환율 1300·1450에서 같은 글자, 해외 캡션 0", () => {
    const u = [stock({ id: "U", ticker: "SCHD", category: "foreign", currency: "USD", averagePrice: 25, quantity: 40 })];
    setup(u, { usd: 1300 });
    const a = row(u);
    setup(u, { usd: 1450 });
    expect(yieldText(row(u))).toBe(yieldText(a));
    expect(a).not.toContain("현재 환율");
  });
  it("극소값은 `투입 대비 0.1% 미만(세전)`", () => {
    const s = [stock({ averagePrice: 100_000_000 })];
    setup(s);
    expect(yieldText(row(s))).toBe("· 투입 대비 0.1% 미만(세전)");
  });
});

describe("숨김 3조건 — main 그대로 `세전 추정`", () => {
  const MAIN_FIRST = /^올해 배당 지급 .+ 예상 .+ 다음 지급 \d+월 · 세전 추정$/;
  it("① 올해 매수(첫 지급 뒤 매수일)", () => {
    const s = [stock({ purchaseDate: `${YEAR}-02-01` })];
    setup(s, { payouts: [pay(`${YEAR}-01-15`, 100), pay(`${YEAR}-03-15`, 100), pay(`${YEAR}-12-31`, 50, true)] });
    const html = row(s);
    expect(html).toContain('data-yield="hidden"');
    expect(html).not.toContain("stock-page-dividend-yield");
    expect(text(html)).toMatch(MAIN_FIRST);
  });
  it("① 지급 뒤 반영 매수가 지금 수량의 10% 초과면 숨김, 이내면 표시(재판정 5.181)", () => {
    // 기존 픽스처(지급일 100 → 지금 110, 차이 9.1%)는 완화 뒤 표시 대상이라 숨김 픽스처를 130(23%)으로 바꿨다
    const buy = (q: number) => ({ id: "t1", stockId: "A", ticker: "005930", stockName: "삼성", type: "buy", quantity: q, price: 50_000, currency: "KRW", date: `${YEAR}-02-01`, reflected: true, createdAt: `${YEAR}-02-01T00:00:00Z` }) as Transaction;
    const big = [stock({ quantity: 130, positionSource: "computed" })];
    setup(big, { txs: [buy(30)] });
    expect(row(big)).toContain('data-yield="hidden"');
    const small = [stock({ quantity: 105, positionSource: "computed" })];
    setup(small, { txs: [buy(5)] });
    const html = row(small);
    expect(html).toContain('data-yield="shown"');
    // 값은 탭과 같은 함수·같은 포맷(C150) — 그 종목만 가진 포트폴리오의 탭 글자와 같다
    expect(yieldText(html)).toBe(`· 투입 대비 ${fnText(small)}(세전)`);
    expect(tabText(renderToStaticMarkup(<DividendCard />))).toBe(fnText(small));
  });
  it("② 원본 행 평단 0, ③ 수량 0", () => {
    const s = [stock({ id: "A" }), stock({ id: "B", broker: "나", averagePrice: 0 })];
    setup(s);
    expect(text(row(s))).toMatch(MAIN_FIRST);
    const z = [stock({ quantity: 0 })];
    setup(z);
    expect(row(z)).not.toContain("stock-page-dividend-yield");
  });
  it("지급만 + 숨김: 둘째 줄은 main 그대로 `세전 추정` 1조각", () => {
    const s = [stock({ purchaseDate: `${YEAR}-01-10` })];
    setup(s, { payouts: [pay(`${YEAR}-01-15`, 100), pay(`${YEAR}-01-05`, 100)] });
    const html = row(s);
    expect(html).toContain('data-yield="hidden"');
    expect(text(html)).toMatch(/^올해 배당 지급 .+ 세전 추정$/);
  });
});

describe("첫 줄은 main과 같다", () => {
  it("표시·숨김 모두 첫 줄 마크업이 같다(세전 흡수 0, 덩이 분할 0)", () => {
    const shown = [stock({})];
    setup(shown);
    const a = row(shown).match(/<p[^>]*>.*?<\/p>/)![0];
    // 금액이 같은 숨김(② 평단 0·수량 0 행이 섞임)
    const hidden = [stock({}), stock({ id: "B", broker: "나", averagePrice: 0, quantity: 0 })];
    setup(hidden);
    expect(row(hidden)).toContain('data-yield="hidden"');
    expect(row(hidden).match(/<p[^>]*>.*?<\/p>/)![0]).toBe(a);
    expect(text(a)).toMatch(/^올해 배당 지급 .+ · 예상 .+$/);
  });
});
