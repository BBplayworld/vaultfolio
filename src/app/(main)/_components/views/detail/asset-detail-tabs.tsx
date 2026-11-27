"use client";
import { Stock, Crypto } from "@/types/asset";

import { MAIN_PALETTE } from "@/config/theme";
import { formatCurrency, formatPriceByMode, calculateHoldingDays } from "@/lib/number-utils";

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

// 주식 탭 원/달러 표시 화폐
export type StockDisplayCurrency = "KRW" | "USD";

// 이미 KRW로 환산된 금액을 선택 화폐 기준으로 포맷 (평가금액·손익·환차손익 등)
export function formatByDisplayCurrency(
  krwValue: number,
  displayCurrency: StockDisplayCurrency,
  usdRate: number,
  mode: "full" | "short" = "short",
): string {
  if (displayCurrency === "KRW") return mode === "full" ? formatCurrency(krwValue) : formatPriceByMode(krwValue);
  const usd = usdRate > 0 ? krwValue / usdRate : 0;
  return `$${usd.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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

const hasPurchaseRate = (it: Stock): boolean => !!it.purchaseExchangeRate && it.purchaseExchangeRate > 0;

/** 해외(USD·JPY) 그룹에 매입환율 있음·없음(0 포함)이 섞였는가 — 펼침 '일부 미입력' 표시와 합친 환율 계산의 공용 판정(#348) */
// 0주 항목은 원가에 영향이 없어 판정에서 뺀다(전부 0주면 false)
export function hasMixedPurchaseRate(items: Stock[]): boolean {
  if (items.length < 2) return false;
  const cur = items[0].currency;
  if (cur !== "USD" && cur !== "JPY") return false;
  const held = items.filter((it) => it.quantity > 0);
  return held.some(hasPurchaseRate) && !held.every(hasPurchaseRate);
}

// 그룹의 합산 대표 Stock 생성 (가상 객체, 저장 안 함)
// rates를 넘기면 매입환율 있음·없음이 섞인 해외 그룹에서 합친 매입환율 = 항목 원가 합 ÷ 원통화 원가 합(미입력 항목은 지금 환율)
// → 합친 원가·환차가 증권사별 항목 합(헤더 computeStockTotals)과 같아진다(#348). rates가 없거나 섞이지 않으면 기존 값 그대로
export function mergeStockGroup(items: Stock[], rates?: { USD: number; JPY: number }): Stock {
  if (items.length === 1) return items[0];
  const totalQty = items.reduce((s, it) => s + it.quantity, 0);
  const weightedAvg = totalQty > 0
    ? items.reduce((s, it) => s + it.averagePrice * it.quantity, 0) / totalQty
    : items[0].averagePrice;
  const earliestDate = items.reduce((min, it) => it.purchaseDate < min ? it.purchaseDate : min, items[0].purchaseDate);
  // 매입환율: 매입원금(수량×평단) 가중 평균 — 첫 항목 값으로 고정되던 버그 수정
  // 유효 환율(>0) 항목만 가중 → 총 원화 매입원가가 보존됨. 모두 미입력이면 기존 fallback 유지
  const rateItems = items.filter((it) => it.purchaseExchangeRate && it.purchaseExchangeRate > 0);
  const rateWeight = rateItems.reduce((s, it) => s + it.averagePrice * it.quantity, 0);
  const purchaseExchangeRate = rateWeight > 0
    ? rateItems.reduce((s, it) => s + it.purchaseExchangeRate! * it.averagePrice * it.quantity, 0) / rateWeight
    : items[0].purchaseExchangeRate;
  const mixedRate = rates ? mixedPurchaseRate(items, rates) : undefined;
  return {
    ...items[0],
    id: `__merged__${items[0].ticker}:${items[0].category}`,
    quantity: totalQty,
    averagePrice: weightedAvg,
    purchaseDate: earliestDate,
    purchaseExchangeRate: mixedRate ?? purchaseExchangeRate,
    broker: undefined,
  };
}

/** 섞인 해외 그룹의 합친 매입환율(저장 단위 — 엔화 100엔당). 섞이지 않았거나 원통화 원가 합이 0이면 undefined */
function mixedPurchaseRate(items: Stock[], rates: { USD: number; JPY: number }): number | undefined {
  if (!hasMixedPurchaseRate(items)) return undefined;
  const current = items[0].currency === "JPY" ? rates.JPY : rates.USD;
  if (!(current > 0)) return undefined;
  const weight = items.reduce((s, it) => s + it.averagePrice * it.quantity, 0);
  if (!(weight > 0)) return undefined; // 합계 0주 — 기존 값 유지
  return items.reduce((s, it) => s + (hasPurchaseRate(it) ? it.purchaseExchangeRate! : current) * it.averagePrice * it.quantity, 0) / weight;
}

// symbol 기준으로 Crypto[] 그룹핑. symbol 없으면 id 단독 키.
export function groupCryptoBySymbol(cryptos: Crypto[]): Map<string, Crypto[]> {
  const map = new Map<string, Crypto[]>();
  for (const c of cryptos) {
    const key = c.symbol || c.id;
    const arr = map.get(key);
    if (arr) arr.push(c);
    else map.set(key, [c]);
  }
  return map;
}

// 그룹의 합산 대표 Crypto 생성 (가상 객체, 저장 안 함)
export function mergeCryptoGroup(items: Crypto[]): Crypto {
  if (items.length === 1) return items[0];
  const totalQty = items.reduce((s, it) => s + it.quantity, 0);
  const weightedAvg = totalQty > 0
    ? items.reduce((s, it) => s + it.averagePrice * it.quantity, 0) / totalQty
    : items[0].averagePrice;
  const earliestDate = items.reduce((min, it) => it.purchaseDate < min ? it.purchaseDate : min, items[0].purchaseDate);
  return {
    ...items[0],
    id: `__merged__${items[0].symbol}`,
    quantity: totalQty,
    averagePrice: weightedAvg,
    purchaseDate: earliestDate,
    exchange: undefined,
  };
}

/**
 * 주식 합계(평가·매입원가) — 상세 › 주식 헤더와 내 자산 불리기 결론 카드의 공용 계산(#239 5.125).
 * 상장폐지 종목은 빼고(getAssetSummary와 같은 정책), 원가는 computeStockMetrics와 같은 식(해외는 매입환율, USD 모드는 지금 환율).
 */
export function computeStockTotals(
  stocks: Stock[],
  exchangeRates: { USD: number; JPY: number },
  displayCurrency: StockDisplayCurrency = "KRW",
): { totalValue: number; totalCost: number; totalProfit: number; totalProfitRate: number } {
  let totalValue = 0;
  let totalCost = 0;
  for (const st of stocks) {
    if (st.inactiveStatus === "delisted") continue;
    const m = computeStockMetrics(st, exchangeRates, 0, displayCurrency);
    totalValue += m.currentVal;
    totalCost += m.cost;
  }
  const totalProfit = totalValue - totalCost;
  return { totalValue, totalCost, totalProfit, totalProfitRate: totalCost > 0 ? (totalProfit / totalCost) * 100 : 0 };
}

export function computeStockMetrics(
  stock: Stock,
  exchangeRates: { USD: number; JPY: number },
  totalValue = 0,
  displayCurrency: StockDisplayCurrency = "KRW",
): StockMetrics {
  const krwMul = getMultiplier(stock.currency, exchangeRates);
  const isForeign = stock.category === "foreign" && stock.currency !== "KRW";
  const purchaseRate = getPurchaseRatePerUnit(stock, krwMul);
  const currentVal = stock.quantity * stock.currentPrice * krwMul;
  // USD 모드: 매입환율 대신 항상 현재환율로 원가 계산 → 환차익 소거
  const costRate = displayCurrency === "USD" ? krwMul : (isForeign ? purchaseRate : krwMul);
  const cost = stock.quantity * stock.averagePrice * costRate;
  const profit = currentVal - cost;
  const profitRate = cost > 0 ? (profit / cost) * 100 : 0;
  const pct = totalValue > 0 ? (currentVal / totalValue) * 100 : 0;
  const currencyGain = displayCurrency === "USD" ? 0 : (isForeign ? (krwMul - purchaseRate) * stock.quantity * stock.averagePrice : 0);
  const currencyGainRate = displayCurrency === "USD" ? 0 : (isForeign && purchaseRate > 0 ? ((krwMul - purchaseRate) / purchaseRate) * 100 : 0);
  const holdingDays = calculateHoldingDays(stock.purchaseDate);
  return { krwMul, isForeign, purchaseRate, currentVal, cost, profit, profitRate, pct, currencyGain, currencyGainRate, holdingDays };
}
