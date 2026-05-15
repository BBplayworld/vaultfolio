"use client";
import { Stock } from "@/types/asset";

import { MAIN_PALETTE } from "@/config/theme";
import { formatCurrency, calculateHoldingDays } from "@/lib/number-utils";

// 공통 유틸 — 각 탭 파일에서 import
export function assignColors(items: { value: number }[]): string[] {
  if (items.length === 0) return [];
  const maxIdx = items.reduce((mi, it, i) => (it.value > items[mi].value ? i : mi), 0);
  let si = 0;
  return items.map((_, i) => (i === maxIdx ? MAIN_PALETTE[0] : MAIN_PALETTE[1 + (si++) % 9]));
}

export function getMultiplier(currency: string | undefined, exchangeRates: { USD: number; JPY: number }): number {
  if (currency === "USD") return exchangeRates.USD;
  if (currency === "JPY") return exchangeRates.JPY / 100;
  return 1;
}

export function formatCurrencyDisplay(value: number, currency = "KRW"): string {
  if (currency === "USD") return `$${value.toLocaleString(undefined, { maximumFractionDigits: 3 })}`;
  if (currency === "JPY") return `¥${value.toLocaleString(undefined, { maximumFractionDigits: 3 })}`;
  return formatCurrency(value);
}

export function getPurchaseRatePerUnit(
  stock: Pick<Stock, "purchaseExchangeRate" | "currency">,
  currentMultiplier: number,
): number {
  if (!stock.purchaseExchangeRate || stock.purchaseExchangeRate <= 0) return currentMultiplier;
  return stock.currency === "JPY" ? stock.purchaseExchangeRate / 100 : stock.purchaseExchangeRate;
}

// 단일 종목의 파생 계산값 (평가/원가/손익/환차/비중/보유일)
export interface StockMetrics {
  krwMul: number;
  isForeign: boolean;
  purchaseRate: number;
  currentVal: number;
  cost: number;
  profit: number;
  profitRate: number;
  pct: number;
  currencyGain: number;
  currencyGainRate: number;
  holdingDays: number;
}

// ticker+category 기준으로 Stock[] 그룹핑. ticker 없으면 id 단독 키.
export function groupStocksByTickerCategory(stocks: Stock[]): Map<string, Stock[]> {
  const map = new Map<string, Stock[]>();
  for (const s of stocks) {
    const key = s.ticker ? `${s.ticker}:${s.category}` : s.id;
    const arr = map.get(key);
    if (arr) arr.push(s);
    else map.set(key, [s]);
  }
  return map;
}

// ticker 단독 기준 그룹핑. 전체 탭에서 카테고리 무시하고 종목 단위로 합칠 때 사용.
export function groupStocksByTicker(stocks: Stock[]): Map<string, Stock[]> {
  const map = new Map<string, Stock[]>();
  for (const s of stocks) {
    const key = s.ticker ? `t:${s.ticker}` : s.id;
    const arr = map.get(key);
    if (arr) arr.push(s);
    else map.set(key, [s]);
  }
  return map;
}

// 그룹의 합산 대표 Stock 생성 (가상 객체, 저장 안 함)
export function mergeStockGroup(items: Stock[]): Stock {
  if (items.length === 1) return items[0];
  const totalQty = items.reduce((s, it) => s + it.quantity, 0);
  const weightedAvg = totalQty > 0
    ? items.reduce((s, it) => s + it.averagePrice * it.quantity, 0) / totalQty
    : items[0].averagePrice;
  const earliestDate = items.reduce((min, it) => it.purchaseDate < min ? it.purchaseDate : min, items[0].purchaseDate);
  return {
    ...items[0],
    id: `__merged__${items[0].ticker}:${items[0].category}`,
    quantity: totalQty,
    averagePrice: weightedAvg,
    purchaseDate: earliestDate,
    broker: undefined,
  };
}

export function computeStockMetrics(
  stock: Stock,
  exchangeRates: { USD: number; JPY: number },
  totalValue = 0,
): StockMetrics {
  const krwMul = getMultiplier(stock.currency, exchangeRates);
  const isForeign = stock.category === "foreign" && stock.currency !== "KRW";
  const purchaseRate = getPurchaseRatePerUnit(stock, krwMul);
  const currentVal = stock.quantity * stock.currentPrice * krwMul;
  const cost = isForeign
    ? stock.quantity * stock.averagePrice * purchaseRate
    : stock.quantity * stock.averagePrice * krwMul;
  const profit = currentVal - cost;
  const profitRate = cost > 0 ? (profit / cost) * 100 : 0;
  const pct = totalValue > 0 ? (currentVal / totalValue) * 100 : 0;
  const currencyGain = isForeign ? (krwMul - purchaseRate) * stock.quantity * stock.averagePrice : 0;
  const currencyGainRate = isForeign && purchaseRate > 0 ? ((krwMul - purchaseRate) / purchaseRate) * 100 : 0;
  const holdingDays = calculateHoldingDays(stock.purchaseDate);
  return { krwMul, isForeign, purchaseRate, currentVal, cost, profit, profitRate, pct, currencyGain, currencyGainRate, holdingDays };
}
