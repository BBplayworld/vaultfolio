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
