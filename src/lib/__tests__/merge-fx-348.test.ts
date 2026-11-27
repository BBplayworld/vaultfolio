// #348 매입환율 있음·없음이 섞인 해외 종목 그룹 — 합친 행·종목 한 장·성적표 이름표·절세 시뮬이 헤더·증권사별 합과 같은 원가를 쓴다
// 픽스처는 실제 쓰기 경로 값으로 만든다(C162): A = 거래 기록(resolveTradeRate → computeNewPosition → `|| undefined`),
// B = 직접 입력 달러 평단(환율 칸 미입력 → 없음 / 입력 후 지움 → 0)
import { describe, it, expect } from "vitest";
import {
  computeStockMetrics, computeStockTotals, formatByDisplayCurrency, hasMixedPurchaseRate, mergeStockGroup,
} from "@/app/(main)/_components/views/detail/asset-detail-tabs";
import { profitTone } from "@/app/(main)/_components/views/detail/detail-summary-header";
import { buildStockGroupHead } from "@/lib/finance/stock-page";
import { buildGrowRows } from "@/lib/asset/grow-rows";
import { emptyStockLabels } from "@/lib/asset/stock-labels";
import { getYearEndTaxSimulation, simulateSelectedForeignSale } from "@/lib/tax-utils";
import { computeNewPosition } from "@/lib/trade/trade-utils";
import { resolveTradeRate } from "@/lib/trade/trade-form";
import type { AssetData, Stock } from "@/types/asset";

const rates = { USD: 1400, JPY: 950 };
const base = (o: Partial<Stock>): Stock => ({
  id: "x", category: "foreign", name: "애플", ticker: "AAPL", quantity: 10, averagePrice: 100, currentPrice: 120,
  currency: "USD", purchaseDate: "2026-01-01", description: "", ...o,
} as Stock);

// 거래 기록 경로로 만든 항목(앱 거래로만 만든 종목: 기준 보유 0)
function viaTrade(o: Partial<Stock>, input: number, qty: number, price: number, currentRate: number): Stock {
  const rate = resolveTradeRate({ input, currentRate, isForeign: true });
  const pos = computeNewPosition(
    { quantity: 0, avgPrice: 0, avgExchangeRate: 0, source: "manual", effectiveDate: "", lockedByManual: false },
    { type: "buy", quantity: qty, price, exchangeRate: rate, date: "2026-01-01", reflected: true, createdAt: "" },
  );
  return base({ ...o, quantity: pos.quantity, averagePrice: pos.avgPrice, purchaseExchangeRate: pos.avgExchangeRate || undefined });
}

const A = viaTrade({ id: "a", broker: "A증권" }, 1300, 10, 100, rates.USD);
const B = base({ id: "b", broker: "B증권" });                               // 칸 미입력 → 없음
const B0 = base({ id: "b0", broker: "B증권", purchaseExchangeRate: 0 });    // 입력 후 지움 → 0
const C = base({ id: "c", broker: "C증권", purchaseExchangeRate: 1350 });
const D = base({ id: "d", broker: "D증권" });
const J = (o: Partial<Stock>) => base({ ticker: "7203", name: "도요타", currency: "JPY", quantity: 100, averagePrice: 2000, currentPrice: 2500, ...o });

const data = (stocks: Stock[]) => ({ stocks, transactions: [] }) as unknown as AssetData;

/** 영향 4곳 + 헤더·증권사별 합. 상세 행 = computeStockMetrics(mergeStockGroup(items, rates)) */
function compare(items: Stock[], displayCurrency: "KRW" | "USD" = "KRW") {
  const header = computeStockTotals(items, rates, displayCurrency);
  const brokerSum = items.reduce((s, it) => s + computeStockMetrics(it, rates, 0, displayCurrency).profit, 0);
  const merged = mergeStockGroup(items, rates);
  const rowM = computeStockMetrics(merged, rates, 0, displayCurrency);
  const page = buildStockGroupHead(items, rates, displayCurrency);
  const grow = buildGrowRows(items, rates, emptyStockLabels(), Date.parse("2026-11-27T00:00:00Z"))[0];
  const tax = getYearEndTaxSimulation(data(items), 2026, rates).candidates[0];
  const fxSum = items.reduce((s, it) => s + computeStockMetrics(it, rates).currencyGain, 0);
  return { header, brokerSum, merged, row: rowM.profit, rowFx: rowM.currencyGain, fxSum, page, grow, tax };
}

/** 화면 표시 문자열 단계 대조(C150) — 행·종목 한 장 머리와 같은 포맷터·부호 */
const profitText = (v: number, rate: number, dc: "KRW" | "USD" = "KRW") => {
  const t = profitTone(v, rate);
  return `${t.sign}${formatByDisplayCurrency(Math.round(t.amount), dc, rates.USD)}`;
};
const rateText = (v: number, rate: number) => { const t = profitTone(v, rate); return `${t.sign}${t.rate.toFixed(1)}%`; };

function expectAllEqual(items: Stock[], expected: number) {
  const r = compare(items);
  expect(r.header.totalProfit).toBeCloseTo(expected, 6);
  expect(r.brokerSum).toBeCloseTo(expected, 6);
  expect(r.row).toBeCloseTo(expected, 6);
  expect(r.page.profit).toBeCloseTo(expected, 6);
  expect(r.tax.unrealizedGainKrw).toBeCloseTo(expected, 6);
  // 문자열 단계
  const headerText = profitText(r.header.totalProfit, r.header.totalProfitRate);
  expect(r.page.profitText).toBe(headerText);
  expect(r.grow.rateText).toBe(rateText(r.header.totalProfit, r.header.totalProfitRate));
  expect(r.rowFx).toBeCloseTo(r.fxSum, 6);
  return r;
}

describe("#348 섞인 매입환율 합산", () => {
  it("픽스처: 거래 기록 경로 A의 저장 환율 = 1,300", () => {
    expect(A.purchaseExchangeRate).toBe(1300);
    expect(A.quantity).toBe(10);
  });

  it("USD 섞임(없음): 행 = 종목 한 장 = 이름표 = 절세 = 헤더 = 증권사별 합 = 660,000, 환차 100,000, 절세 '추정'", () => {
    const r = expectAllEqual([A, B], 660_000);
    expect(r.rowFx).toBeCloseTo(100_000, 6);
    expect(r.merged.purchaseExchangeRate).toBeCloseTo(1350, 9);
    expect(r.tax.estimated).toBe(true);
    expect(hasMixedPurchaseRate([A, B])).toBe(true);
    expect(r.page.profitText).toBe("+660,000원");
  });

  it("USD 섞임(0 환율): 같은 값", () => {
    const r = expectAllEqual([A, B0], 660_000);
    expect(r.tax.estimated).toBe(true);
    expect(hasMixedPurchaseRate([A, B0])).toBe(true);
  });

  it("선택 매도 시뮬도 섞인 그룹은 추정·같은 원가", () => {
    const r = simulateSelectedForeignSale(data([A, B]), [{ stockId: "t:AAPL", quantity: 20 }], 2026, rates);
    expect(r.combinedGainKrw).toBeCloseTo(660_000, 6);
    expect(r.estimated).toBe(true);
  });

  it("JPY 섞임: 1,050,000 (합친 환율 925/100엔)", () => {
    const items = [J({ id: "ja", broker: "A", purchaseExchangeRate: 900 }), J({ id: "jb", broker: "B" })];
    const r = expectAllEqual(items, 1_050_000);
    expect(r.merged.purchaseExchangeRate).toBeCloseTo(925, 9);
    expect(r.tax.estimated).toBe(true);
  });

  it("통제: 전부 있음 — rates 유무와 무관하게 기존 값, 절세 추정 아님", () => {
    const items = [A, C];
    expect(mergeStockGroup(items, rates)).toEqual(mergeStockGroup(items));
    const r = expectAllEqual(items, 710_000);
    expect(r.tax.estimated).toBe(false);
    expect(hasMixedPurchaseRate(items)).toBe(false);
  });

  it("통제: 전부 없음 — 기존 값, 절세 추정", () => {
    const items = [B, D];
    expect(mergeStockGroup(items, rates)).toEqual(mergeStockGroup(items));
    const r = expectAllEqual(items, 560_000);
    expect(r.tax.estimated).toBe(true);
    expect(hasMixedPurchaseRate(items)).toBe(false);
  });

  it("통제: 국내 — 분기 없음", () => {
    const kr = (id: string, broker: string, rate?: number) => base({ id, broker, category: "domestic", ticker: "005930", currency: "KRW", averagePrice: 70000, currentPrice: 80000, purchaseExchangeRate: rate });
    const items = [kr("k1", "A", 1300), kr("k2", "B")];
    expect(mergeStockGroup(items, rates)).toEqual(mergeStockGroup(items));
    expect(hasMixedPurchaseRate(items)).toBe(false);
    expect(computeStockMetrics(mergeStockGroup(items, rates), rates).profit).toBe(computeStockTotals(items, rates).totalProfit);
  });

  it("통제: 단일 항목 — 같은 객체", () => {
    expect(mergeStockGroup([B], rates)).toBe(B);
    expect(hasMixedPurchaseRate([B])).toBe(false);
  });

  it("달러 보기: 섞여도 헤더 = 행 = 종목 한 장(지금 환율 원가), 문자열 같음", () => {
    const r = compare([A, B], "USD");
    expect(r.row).toBeCloseTo(r.header.totalProfit, 6);
    expect(r.row).toBeCloseTo(r.brokerSum, 6);
    expect(r.page.profitText).toBe(profitText(r.header.totalProfit, r.header.totalProfitRate, "USD"));
    // 달러 보기 값은 rates 유무와 무관(기존 값 그대로)
    expect(computeStockMetrics(mergeStockGroup([A, B], rates), rates, 0, "USD").profit)
      .toBeCloseTo(computeStockMetrics(mergeStockGroup([A, B]), rates, 0, "USD").profit, 6);
  });

  it("0주 항목: 원가에 영향 없음, 판정에서도 제외", () => {
    const Z = base({ id: "z", broker: "Z증권", quantity: 0 });
    expectAllEqual([A, B, Z], 660_000);
    // 환율 있는 항목 + 환율 없는 0주 항목 → 섞임 아님(지금 환율이 섞이지 않음)
    expect(hasMixedPurchaseRate([A, C, Z])).toBe(false);
    expect(mergeStockGroup([A, C, Z], rates)).toEqual(mergeStockGroup([A, C, Z]));
  });

  it("합계 0주 그룹: 기존 값(items[0] 환율) 유지, 섞임 아님", () => {
    const items = [base({ id: "a0", broker: "A", quantity: 0, purchaseExchangeRate: 1300 }), base({ id: "b0z", broker: "B", quantity: 0 })];
    const m = mergeStockGroup(items, rates);
    expect(m.purchaseExchangeRate).toBe(1300);
    expect(m).toEqual(mergeStockGroup(items));
    expect(hasMixedPurchaseRate(items)).toBe(false);
    expect(computeStockMetrics(m, rates).profit).toBe(0);
  });
});
