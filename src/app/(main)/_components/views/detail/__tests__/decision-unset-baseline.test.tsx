// #245(5.130) 미정 기기 기준 스냅샷 — 코드 변경 전(분기 시점 = origin/issue-5.126 424c6b8) 마크업을 먼저 고정한다(AC-6).
// 이름표가 0개인 기기의 상세·주식(행·펼침)·종목 한 장 머리는 이 릴리스에서 diff 0, 달라지는 것은 '내 주식 도구' 타일 묶음뿐이다.
// 그래서 타일 묶음(stock-tools)은 따로 떼어 고정한다 — 구현 뒤 바뀌는 스냅샷은 그 1개여야 한다.
// jsdom 없음(정적 렌더): effect가 돌지 않아 이름표 저장소는 읽기 전 상태다. 읽은 뒤(이름표 0개·전부 정하지 않음) 동치는 구현 커밋의 테스트가 본다.
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { Stock } from "@/types/asset";

const NOW = new Date("2026-11-19T03:00:00Z");

const stock = (o: Partial<Stock>): Stock => ({
  id: "s", category: "domestic", name: "삼성전자", ticker: "005930", quantity: 65,
  averagePrice: 70000, currentPrice: 80000, currency: "KRW", purchaseDate: "2025-03-04", ...o,
} as Stock);

const UNSET_STOCKS: Stock[] = [
  stock({ id: "s1" }),
  stock({ id: "s2", name: "SK하이닉스", ticker: "000660", quantity: 12, averagePrice: 150000, currentPrice: 190000 }),
  stock({ id: "s3", category: "foreign", name: "Apple", ticker: "AAPL", quantity: 30, averagePrice: 180, currentPrice: 150, currency: "USD", purchaseExchangeRate: 1300 }),
  // 같은 티커가 증권사 둘로 나뉜 묶음(증권사별 하위 항목)
  stock({ id: "s4", name: "TIGER 미국S&P500", ticker: "360750", quantity: 100, averagePrice: 15000, currentPrice: 20000, broker: "키움증권" } as Partial<Stock>),
  stock({ id: "s5", name: "TIGER 미국S&P500", ticker: "360750", quantity: 5, averagePrice: 16000, currentPrice: 20000, broker: "토스증권" } as Partial<Stock>),
  // 티커 없는 종목·상장폐지 — 이름표를 달 수 없는 행
  stock({ id: "s6", category: "unlisted", name: "비상장 스타트업", ticker: "", quantity: 10, averagePrice: 5000, currentPrice: 5000 }),
  stock({ id: "s7", name: "폐지전자", ticker: "999990", quantity: 3, averagePrice: 1000, currentPrice: 0, inactiveStatus: "delisted" } as Partial<Stock>),
];

const state: { stocks: Stock[] } = { stocks: UNSET_STOCKS };
const RATES = { USD: 1400, JPY: 900 };
vi.mock("@/contexts/asset-data-context", () => ({
  useAssetData: () => ({
    assetData: { stocks: state.stocks, transactions: [], loans: [], crypto: [], realEstate: [], physicalAssets: [], cryptoTransactions: [] },
    exchangeRates: RATES,
    getAssetSummary: () => ({ stockCurrencyGain: 0, totalValue: 1 }),
    dataResetVersion: 0,
    deleteStock: () => {}, deleteStocks: () => {}, saveData: () => {},
  }),
}));
vi.mock("@tanstack/react-query", () => ({
  useQuery: () => ({ data: undefined, isError: false }),
  useQueryClient: () => ({}),
}));
vi.mock("../../../layout/navigation/navigation-context", async (importOriginal) => {
  const mod = await importOriginal<typeof import("../../../layout/navigation/navigation-context")>();
  return { ...mod, useAssetNavigation: () => ({ navigate: () => {}, view: { type: "detail", tab: "stocks" }, back: () => {}, slideDir: null }) };
});
vi.mock("@/hooks/use-price-history", () => ({ usePriceHistory: () => ({ data: undefined, isError: false, refetch: () => {} }) }));
vi.mock("@/lib/xray/use-xray-classifications", () => ({ useXrayClassifications: () => ({ tick: 0, progress: null }) }));
vi.mock("../../activity/market-entry-line", () => ({
  useMarketEntryValue: () => ({ hasTickerStock: true, open: true }),
  MarketTileValue: () => <span data-testid="stock-tool-market-value">1주</span>,
}));

import { StockCard, StockTab } from "../tabs/stock-tab";
import { StockPageBody } from "../stock-page/stock-page-view";
import { computeStockMetrics } from "../asset-detail-tabs";

/** data-testid가 id인 첫 요소의 마크업(여는 태그~짝이 맞는 닫는 태그). 없으면 "" */
function cutByTestId(html: string, id: string): string {
  const at = html.indexOf(`data-testid="${id}"`);
  if (at < 0) return "";
  const start = html.lastIndexOf("<", at);
  const tag = /^<([a-z0-9]+)/i.exec(html.slice(start))![1].toLowerCase();
  const re = /<(\/?)([a-z0-9]+)(?=[\s>/])[^>]*>/gi;
  re.lastIndex = start;
  let depth = 0;
  for (let m = re.exec(html); m; m = re.exec(html)) {
    if (m[2].toLowerCase() !== tag) continue;
    if (m[1]) depth--;
    else if (!m[0].endsWith("/>")) depth++;
    if (depth === 0) return html.slice(start, re.lastIndex);
  }
  return html.slice(start);
}

beforeAll(() => { vi.useFakeTimers(); vi.setSystemTime(NOW); });
afterAll(() => { vi.useRealTimers(); });

describe("#245 미정 기기 기준 마크업(코드 변경 전 고정)", () => {
  it("상세·주식 — 타일 묶음을 뺀 전체(요약·카테고리 줄·비중 막대·종목 행)", () => {
    state.stocks = UNSET_STOCKS;
    const html = renderToStaticMarkup(<StockTab />);
    const tools = cutByTestId(html, "stock-tools");
    expect(tools).not.toBe("");
    expect(html.replace(tools, "<!--stock-tools-->")).toMatchSnapshot();
  });

  it("상세·주식 — 내 주식 도구 타일 묶음(이 릴리스에서 바뀌는 유일한 곳)", () => {
    state.stocks = UNSET_STOCKS;
    expect(cutByTestId(renderToStaticMarkup(<StockTab />), "stock-tools")).toMatchSnapshot();
  });

  it("상세·주식 — 펼친 종목 행(이름 줄 입구·상세 표·거래 줄)", () => {
    state.stocks = UNSET_STOCKS;
    const s = UNSET_STOCKS[0];
    const m = computeStockMetrics(s, RATES, 10_000_000, "KRW");
    const html = renderToStaticMarkup(
      <StockCard
        stock={s} color="#5b6fbf" pct={m.pct} currentVal={m.currentVal} profit={m.profit} profitRate={m.profitRate}
        isForeign={m.isForeign} krwMul={m.krwMul} currencyGain={m.currencyGain} currencyGainRate={m.currencyGainRate}
        linkedLoans={[]} onDelete={() => {}} categoryLabels={["국내"]} defaultOpen groupItems={[s]} exchangeRates={RATES} totalValue={10_000_000}
        todayChip={{ rate: 1.2, label: "오늘" }}
      />,
    );
    expect(html).toContain('data-testid="stock-page-entry"');
    expect(html).toMatchSnapshot();
  });

  it("종목 한 장 — 머리(이름·평가금액·내 수익)", () => {
    state.stocks = UNSET_STOCKS;
    const s = UNSET_STOCKS[0];
    const html = renderToStaticMarkup(
      <StockPageBody target={{ groupStockIds: [s.id], name: s.name, ticker: s.ticker ?? "", category: s.category, displayCurrency: "KRW", origin: "stocks" }} />,
    );
    expect(cutByTestId(html, "stock-page-head")).toMatchSnapshot();
  });
});
