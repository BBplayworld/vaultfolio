// #348 펼침 '매입환율' 칸 — 매입환율 있음·없음이 섞인 합친 행은 지금 환율이 섞인 숫자 대신 '일부 미입력 (현재환율)'
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { Stock } from "@/types/asset";

const RATES = { USD: 1400, JPY: 950 };
vi.mock("@/contexts/asset-data-context", () => ({
  useAssetData: () => ({
    assetData: { stocks: [], transactions: [], loans: [], crypto: [], realEstate: [], physicalAssets: [], cryptoTransactions: [] },
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

import { StockCard } from "../tabs/stock-tab";
import { computeStockMetrics, mergeStockGroup } from "../asset-detail-tabs";

const stock = (o: Partial<Stock>): Stock => ({
  id: "s", category: "foreign", name: "애플", ticker: "AAPL", quantity: 10, averagePrice: 100, currentPrice: 120,
  currency: "USD", purchaseDate: "2026-01-01", ...o,
} as Stock);

/** 펼친 합친 행 — 상세 › 주식과 같이 mergeStockGroup(items, rates) + computeStockMetrics */
function card(items: Stock[]): string {
  const s = mergeStockGroup(items, RATES);
  const m = computeStockMetrics(s, RATES, 10_000_000);
  return renderToStaticMarkup(
    <StockCard
      stock={s} color="#5b6fbf" pct={m.pct} currentVal={m.currentVal} profit={m.profit} profitRate={m.profitRate}
      isForeign={m.isForeign} krwMul={m.krwMul} currencyGain={m.currencyGain} currencyGainRate={m.currencyGainRate}
      linkedLoans={[]} onDelete={() => {}} categoryLabels={["해외"]} defaultOpen groupItems={items} exchangeRates={RATES} totalValue={10_000_000}
    />,
  );
}

describe("#348 펼침 매입환율 칸", () => {
  it("섞임(USD): '일부 미입력 (현재환율)', 합친 환율 숫자 1,350은 보이지 않음", () => {
    const html = card([stock({ id: "a", broker: "A", purchaseExchangeRate: 1300 }), stock({ id: "b", broker: "B" })]);
    expect(html).toContain("일부 미입력 (현재환율)");
    expect(html).not.toContain("$1=₩1,350");
  });

  it("섞임(JPY, 0 환율): '일부 미입력 (현재환율)'", () => {
    const j = (o: Partial<Stock>) => stock({ ticker: "7203", currency: "JPY", quantity: 100, averagePrice: 2000, currentPrice: 2500, ...o });
    const html = card([j({ id: "ja", broker: "A", purchaseExchangeRate: 900 }), j({ id: "jb", broker: "B", purchaseExchangeRate: 0 })]);
    expect(html).toContain("일부 미입력 (현재환율)");
    expect(html).not.toContain("¥100=₩925");
  });

  it("통제: 전부 있음은 가중 평균 숫자, 전부 없음은 기존 '미입력 (현재환율)'", () => {
    const both = card([stock({ id: "a", broker: "A", purchaseExchangeRate: 1300 }), stock({ id: "c", broker: "C", purchaseExchangeRate: 1350 })]);
    expect(both).toContain("$1=₩1,325");
    expect(both).not.toContain("일부 미입력");
    const none = card([stock({ id: "b", broker: "B" }), stock({ id: "d", broker: "D" })]);
    expect(none).toContain("미입력 (현재환율)");
    expect(none).not.toContain("일부 미입력");
  });
});
