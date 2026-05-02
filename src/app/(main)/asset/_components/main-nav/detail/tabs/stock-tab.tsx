"use client";

import React from "react";
import { Pencil, Trash2, Calendar, Clock, CreditCard, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useState, useMemo, useEffect } from "react";
import { useAssetData } from "@/contexts/asset-data-context";
import { formatCurrency, formatShortCurrency, formatHoldingPeriod } from "@/lib/number-utils";
import { ASSET_THEME, MAIN_PALETTE, getProfitLossColor } from "@/config/theme";
import { stockCategories } from "@/config/asset-options";
import { normalizeTicker } from "@/lib/finance-service";
import { Stock, Loan } from "@/types/asset";
import { assignColors, getMultiplier, formatCurrencyDisplay, getPurchaseRatePerUnit, computeStockMetrics } from "../asset-detail-tabs";
import { fetchProfitRef } from "@/lib/profit-utils";
import { DOMESTIC_STOCK_DOMAIN_MAP } from "@/app/api/parse-screenshot/ticker-map";

const CAT_LIST = ASSET_THEME.tabList3;
const CAT_TRIGGER = ASSET_THEME.tabTrigger3;

const ETF_DOMAIN: Record<string, string> = {
  TIGER: "www.tigeretf.com",
  KODEX: "www.samsungfund.com",
  ACE: "www.aceetf.co.kr",
  KINDEX: "www.aceetf.co.kr",
  HANARO: "www.hanaroetf.com",
  SOL: "www.shinhansec.com",
  RISE: "www.kbam.co.kr",
  KBSTAR: "www.kbam.co.kr",
  ARIRANG: "www.hanwhafund.co.kr",
  BIG: "www.hanwhafund.co.kr",
  PLUS: "www.hanwhafund.co.kr",
  KOSEF: "www.wooriasset.co.kr",
  TIMEFOLIO: "www.timefolio.co.kr",
};

function getEtfDomain(name: string): string | null {
  const upper = name.toUpperCase();
  for (const [brand, domain] of Object.entries(ETF_DOMAIN)) {
    if (upper.startsWith(brand + " ") || upper === brand) return domain;
  }
  return null;
}

export const CATEGORY_TABS = [
  { value: "all", label: "전체" },
  { value: "domestic", label: "국내" },
  { value: "foreign", label: "해외" },
  { value: "irp", label: "IRP" },
  { value: "isa", label: "ISA" },
  { value: "pension", label: "연금" },
  { value: "unlisted", label: "비상장" },
] as const;

function StockIcon({ ticker, name, isForeign, color }: { ticker: string; name: string; isForeign: boolean; color: string }) {
  const [imgError, setImgError] = React.useState(false);
  const initial = (ticker || name).replace(/[^A-Za-z가-힣]/g, "").slice(0, 2).toUpperCase() || "";

  const foreignLogoSrc = isForeign && ticker && /^[A-Z]+$/.test(ticker) ? `/api/logo?ticker=${ticker}` : null;
  const etfDomain = !isForeign ? getEtfDomain(name) : null;
  const stockDomain = !isForeign && !etfDomain ? (DOMESTIC_STOCK_DOMAIN_MAP[ticker] ?? null) : null;

  const logoSrc = foreignLogoSrc
    ?? (etfDomain ? `/api/logo?domain=${encodeURIComponent(etfDomain)}` : null)
    ?? (stockDomain ? `/api/logo?domain=${encodeURIComponent(stockDomain)}` : null);

  const showLogo = !!logoSrc && !imgError;
  const showInitial = !logoSrc;

  return (
    <div className="size-6 sm:size-7 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden" style={{ backgroundColor: color }}>
      {showLogo ? (
        <img src={logoSrc} alt={name} className="size-6 sm:size-7 rounded-full object-cover" onError={() => setImgError(true)} />
      ) : showInitial ? (
        <span className="text-[9px] sm:text-[10px] font-bold text-white">{initial}</span>
      ) : null}
    </div>
  );
}

const LS_KEY = "stock-tab-collapsible-used";

// 인증샷에서 재사용하는 공유 타입
export interface StockRowData {
  stock: Stock;
  color: string;
  pct: number;
  currentVal: number;
  profit: number;
  profitRate: number;
}

// 주식 비중 바 + 범례
export function StockBarChart({ items, total }: {
  items: { stock: Stock; value: number; color: string }[];
  total: number;
}) {
  if (items.length === 0 || total <= 0) return null;
  return (
    <div className="space-y-2">
      <div className="flex h-6 w-full rounded-full overflow-hidden gap-px">
        {items.map(({ stock, value: v, color }) => {
          const pct = (v / total) * 100;
          return (
            <div key={stock.id} className="flex items-center justify-center overflow-hidden transition-all" style={{ width: `${pct}%`, backgroundColor: color }} title={`${stock.name}: ${pct.toFixed(1)}%`}>
              {pct > 5 && <span className="text-white text-[10px] font-bold drop-shadow select-none px-0.5 truncate">{pct.toFixed(1)}%</span>}
            </div>
          );
        })}
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-2 px-2">
        {items.map(({ stock, value: v, color }) => {
          const pct = (v / total) * 100;
          return (
            <div key={stock.id} className="flex items-center gap-1">
              <span className="size-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
              <span className="text-xs text-foreground truncate">{stock.name}</span>
              <span className="text-xs font-bold text-muted-foreground shrink-0">{pct.toFixed(1)}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
const DOMESTIC_CATEGORIES = new Set(["domestic", "irp", "isa", "pension"]);


/**
 * 선택된 카테고리의 주식 데이터 계산 훅.
 * ShareCard, StockTab 등에서 공통 사용.
 */
export function useFilteredStockData(activeCategory: string) {
  const { assetData, exchangeRates, getAssetSummary } = useAssetData();
  const summary = getAssetSummary();

  const mul = (currency?: string) => getMultiplier(currency, exchangeRates);

  const stocksWithTicker = assetData.stocks.filter(
    (s) => s.ticker && s.category !== "unlisted" && s.currentPrice > 0,
  );
  const tickerList = stocksWithTicker.map((s) => normalizeTicker(s)).filter(Boolean).join(",");

  const { data: refData } = useQuery({
    queryKey: ["profit", "daily", tickerList],
    queryFn: () => fetchProfitRef(tickerList, "daily"),
    staleTime: 5 * 60 * 1000,
    enabled: tickerList.length > 0,
  });

  const filteredStocks = useMemo(() => {
    const base =
      activeCategory === "all"
        ? assetData.stocks
        : assetData.stocks.filter((s) => s.category === activeCategory);
    return [...base].sort(
      (a, b) =>
        b.quantity * b.currentPrice * mul(b.currency) -
        a.quantity * a.currentPrice * mul(a.currency),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assetData.stocks, activeCategory, exchangeRates]);

  const totalValue = filteredStocks.reduce(
    (s, st) => s + st.quantity * st.currentPrice * mul(st.currency),
    0,
  );
  const totalCost = filteredStocks.reduce((s, st) => {
    const isForeign = st.category === "foreign" && st.currency !== "KRW";
    const rate = getPurchaseRatePerUnit(st, mul(st.currency));
    return s + (isForeign ? st.quantity * st.averagePrice * rate : st.quantity * st.averagePrice * mul(st.currency));
  }, 0);
  const totalProfit = totalValue - totalCost;
  const totalProfitRate = totalCost > 0 ? (totalProfit / totalCost) * 100 : 0;

  const barValues = filteredStocks.map((st) => ({ value: st.quantity * st.currentPrice * mul(st.currency) }));
  const barColors = assignColors(barValues);
  const barItems = filteredStocks.map((st, idx) => ({
    stock: st,
    value: barValues[idx].value,
    color: barColors[idx],
  }));

  // 일별 수익 계산 (profit-chart의 daily 로직과 동일)
  const { dailyProfit, dailyProfitRate } = useMemo(() => {
    if (!refData) return { dailyProfit: null, dailyProfitRate: null };
    let profitSum = 0;
    let refSum = 0;
    let hasAny = false;
    for (const st of filteredStocks) {
      if (!st.ticker || st.category === "unlisted" || !st.currentPrice) continue;
      const ticker = normalizeTicker(st);
      const ref = refData[ticker];
      if (!ref) continue;
      const rate = (st.currency === "USD" && !DOMESTIC_CATEGORIES.has(st.category))
        ? exchangeRates.USD : 1;
      const currentValue = st.currentPrice * st.quantity * rate;
      const refValue = ref.refPrice * st.quantity * rate;
      profitSum += currentValue - refValue;
      refSum += refValue;
      hasAny = true;
    }
    if (!hasAny) return { dailyProfit: null, dailyProfitRate: null };
    return {
      dailyProfit: profitSum,
      dailyProfitRate: refSum > 0 ? (profitSum / refSum) * 100 : 0,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refData, filteredStocks, exchangeRates]);

  return { filteredStocks, totalValue, totalCost, totalProfit, totalProfitRate, barItems, barColors, summary, mul, exchangeRates, dailyProfit, dailyProfitRate };
}

// 아이콘 + 이름/수량/비중 + 금액/손익 공통 헤더
export function StockRowHeader({ stock, color, pct, currentVal, profit, profitRate, categoryLabel, maskFn, screenshotMode = false }: StockRowData & {
  categoryLabel?: string;
  maskFn?: (v: number) => string;
  screenshotMode?: boolean;
}) {
  const fmt = maskFn ?? formatShortCurrency;
  const hideAmounts = !!maskFn && maskFn !== formatShortCurrency;
  const isForeign = stock.category === "foreign" && stock.currency !== "KRW";
  return (
    <>
      <StockIcon ticker={normalizeTicker(stock)} name={stock.name} isForeign={isForeign} color={color} />
      <div className={ASSET_THEME.cardInfoLeft}>
        <div className={ASSET_THEME.cardInfoTitle}>
          <span className={`${ASSET_THEME.cardInfoName}}`}>{stock.name}</span>
          {stock.ticker && <span className="text-xs text-muted-foreground font-mono shrink-0">{stock.ticker}</span>}
          {categoryLabel && <Badge variant="outline" className={`${ASSET_THEME.categoryBox} text-[9px] sm:text-[10px] px-1 py-0 leading-tight`}>{categoryLabel}</Badge>}
        </div>
        <div className={ASSET_THEME.cardInfoMeta}>
          <span className="text-sm text-foreground">{stock.quantity.toLocaleString()}주</span>
          <span className="text-sm text-muted-foreground">·</span>
          <span className="text-sm font-semibold text-primary">{pct.toFixed(1)}%</span>
        </div>
      </div>
      <div className={ASSET_THEME.cardInfoRight}>
        <p className={`${ASSET_THEME.cardAmountMain} ${ASSET_THEME.text.default}}`}>{fmt(currentVal)}</p>
        <div className={ASSET_THEME.cardAmountProfitRow}>
          <p className={`${ASSET_THEME.cardAmountSub} ${getProfitLossColor(profit)}`}>
            {!hideAmounts && (profit >= 0 ? "+" : "")}{fmt(Math.round(profit))}
          </p>
          <p className={`${ASSET_THEME.cardAmountRate} ${getProfitLossColor(profit)}`}>({profitRate >= 0 ? "+" : ""}{profitRate.toFixed(1)}%)</p>
        </div>
      </div>
    </>
  );
}

// 종목 단일 로우 (인증샷용 — 편집/삭제 버튼 없음)
export function StockRowItem({ stock, color, pct, currentVal, profit, profitRate, maskFn, screenshotMode = false }: StockRowData & { maskFn?: (v: number) => string; screenshotMode?: boolean }) {
  return (
    <div className={`flex items-center gap-3 py-2 ${ASSET_THEME.primary.bgLight} px-2 rounded-md`}>
      <StockRowHeader stock={stock} color={color} pct={pct} currentVal={currentVal} profit={profit} profitRate={profitRate} maskFn={maskFn} screenshotMode={screenshotMode} />
    </div>
  );
}

// 주식 요약 헤더
export function StockSummaryHeader({ totalValue, totalProfit, totalProfitRate, currencyGain, dailyProfit, dailyProfitRate, maskFn, screenshotMode = false }: {
  totalValue: number;
  totalProfit: number;
  totalProfitRate: number;
  currencyGain?: number;
  dailyProfit?: number | null;
  dailyProfitRate?: number | null;
  maskFn?: (v: number) => string;
  screenshotMode?: boolean;
}) {
  const fmt = maskFn ?? formatShortCurrency;
  const hideAmounts = !!maskFn && maskFn !== formatShortCurrency;
  return (
    <div className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 flex items-center justify-between">
      <div>
        <p className="text-xs text-muted-foreground font-semibold">총 주식 평가금액</p>
        <p className={`text-2xl font-extrabold tabular-nums ${ASSET_THEME.important}`}>{fmt(totalValue)}</p>
        <p className="text-sm text-foreground">{formatCurrency(totalValue)}</p>
      </div>
      <div className="text-right space-y-1">
        <div>
          <p className="text-xs text-muted-foreground">평가손익</p>
          <p className={`text-lg font-bold tabular-nums ${getProfitLossColor(totalProfit)}`}>
            {!hideAmounts && (totalProfit >= 0 ? "+" : "")}{fmt(Math.round(totalProfit))} ({totalProfitRate >= 0 ? "+" : ""}{totalProfitRate.toFixed(2)}%)
          </p>
          {currencyGain !== undefined && currencyGain !== 0 && (
            <p className={`text-xs tabular-nums ${getProfitLossColor(currencyGain)}`}>
              <span className="text-muted-foreground">환차손익</span> {!hideAmounts && (currencyGain >= 0 ? "+" : "")}{fmt(Math.round(currencyGain))} 포함
            </p>
          )}
        </div>
        {dailyProfit != null && dailyProfitRate != null && (
          <div className="border-t border-border/40">
            <p className="text-xs text-muted-foreground">전일 대비</p>
            <p className={`text-sm font-semibold tabular-nums ${getProfitLossColor(dailyProfit)}`}>
              {!hideAmounts && (dailyProfit >= 0 ? "+" : "")}{fmt(Math.round(dailyProfit))} ({dailyProfitRate >= 0 ? "+" : ""}{dailyProfitRate.toFixed(2)}%)
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

interface StockCardProps {
  stock: Stock;
  color: string;
  pct: number;
  currentVal: number;
  profit: number;
  profitRate: number;
  isForeign: boolean;
  krwMul: number;
  currencyGain: number;
  currencyGainRate: number;
  linkedLoans: Loan[];
  onDelete: (id: string) => void;
  getCategoryLabel: (cat: string) => string;
  defaultOpen?: boolean;
  onFirstInteract?: () => void;
  isFirstVisit?: boolean;
}

function StockCard({ stock, color, pct, currentVal, profit, profitRate, isForeign, krwMul, currencyGain, currencyGainRate, linkedLoans, onDelete, getCategoryLabel, defaultOpen = false, onFirstInteract, isFirstVisit = false }: StockCardProps) {
  const [open, setOpen] = useState(defaultOpen);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    onFirstInteract?.();
  };

  return (
    <Collapsible open={open} onOpenChange={handleOpenChange} className="mb-3">
      <div className="rounded-lg border bg-card overflow-hidden">
        <div className={ASSET_THEME.cardHeader}>
          <CollapsibleTrigger asChild>
            <button className={ASSET_THEME.cardTriggerButton}>
              <StockRowHeader stock={stock} color={color} pct={pct} currentVal={currentVal} profit={profit} profitRate={profitRate} categoryLabel={getCategoryLabel(stock.category)} />
              <ChevronDown className={`size-3.5 sm:size-4 text-muted-foreground flex-shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
            </button>
          </CollapsibleTrigger>
          <div className={ASSET_THEME.cardActions}>
            <Button size="icon" variant="outline" className={ASSET_THEME.cardActionButton} onClick={() => window.dispatchEvent(new CustomEvent("trigger-edit-stock", { detail: { id: stock.id } }))}>
              <Pencil className="size-3.5" />
            </Button>
            <Button size="icon" variant="outline" className={ASSET_THEME.cardActionButton} onClick={() => onDelete(stock.id)}>
              <Trash2 className="size-3.5" />
            </Button>
          </div>
        </div>
        <div className="h-0.5 w-full bg-muted">
          <div className={`h-full transition-all${isFirstVisit ? " animate-pulse" : ""}`} style={{ width: `${pct}%`, backgroundColor: color }} />
        </div>
        {!open && (
          <div className="h-1.5 bg-gradient-to-b from-muted/30 to-muted/5" />
        )}
        <CollapsibleContent>
          <div className="border-t divide-y divide-border/50">
            <div className="grid grid-cols-2 sm:grid-cols-4 px-4 py-2.5 gap-4 bg-muted/10">
              <div>
                <p className={ASSET_THEME.cardDetailLabel}>매입가</p>
                <p className={ASSET_THEME.cardDetailValue}>{formatCurrencyDisplay(stock.averagePrice, stock.currency)}</p>
                {isForeign && <p className={ASSET_THEME.cardDetailPriceKRW}>₩{(stock.averagePrice * krwMul).toLocaleString("ko-KR", { maximumFractionDigits: 0 })}</p>}
              </div>
              <div>
                <p className={ASSET_THEME.cardDetailLabel}>총 매입금액</p>
                <p className={ASSET_THEME.cardDetailValue}>{formatCurrencyDisplay(stock.averagePrice * stock.quantity, stock.currency)}</p>
                {isForeign && <p className={ASSET_THEME.cardDetailPriceKRW}>₩{(stock.averagePrice * stock.quantity * krwMul).toLocaleString("ko-KR", { maximumFractionDigits: 0 })}</p>}
              </div>
              <div>
                <p className={ASSET_THEME.cardDetailLabel}>현재가</p>
                <p className={ASSET_THEME.cardDetailValueBold} style={{ color: MAIN_PALETTE[10] }}>{formatCurrencyDisplay(stock.currentPrice, stock.currency)}</p>
                {isForeign && <p className={ASSET_THEME.cardDetailPriceKRW} style={{ color: MAIN_PALETTE[10] }}>₩{(stock.currentPrice * krwMul).toLocaleString("ko-KR", { maximumFractionDigits: 0 })}</p>}
              </div>
              <div>
                <p className={ASSET_THEME.cardDetailLabel}>총 평가금액</p>
                <p className={ASSET_THEME.cardDetailValueBold} style={{ color: MAIN_PALETTE[10] }}>{formatCurrencyDisplay(stock.currentPrice * stock.quantity, stock.currency)}</p>
                {isForeign && <p className={ASSET_THEME.cardDetailPriceKRW} style={{ color: MAIN_PALETTE[10] }}>₩{(stock.currentPrice * stock.quantity * krwMul).toLocaleString("ko-KR", { maximumFractionDigits: 0 })}</p>}
              </div>
            </div>
            {isForeign && (
              <div className="grid grid-cols-2 px-4 py-2.5 gap-4 bg-muted/5">
                <div>
                  <p className={ASSET_THEME.cardDetailLabel}>환차손익</p>
                  <p className={`${ASSET_THEME.cardDetailValueBold} ${getProfitLossColor(currencyGain)}`}>
                    {formatCurrencyDisplay(Math.round(currencyGain))}
                    <span className="text-xs ml-1">({currencyGainRate >= 0 ? "+" : ""}{currencyGainRate.toFixed(2)}%)</span>
                  </p>
                </div>
                <div>
                  <p className={ASSET_THEME.cardDetailLabel}>매입환율</p>
                  <p className={ASSET_THEME.cardDetailValue}>
                    {stock.purchaseExchangeRate && stock.purchaseExchangeRate > 0
                      ? stock.currency === "JPY" ? `¥100 = ₩${stock.purchaseExchangeRate.toLocaleString()}` : `$1 = ₩${stock.purchaseExchangeRate.toLocaleString()}`
                      : "미입력 (현재환율)"}
                  </p>
                </div>
              </div>
            )}
            {linkedLoans.length > 0 && (
              <div className={ASSET_THEME.cardLoanSection}>
                <p className={ASSET_THEME.cardLoanTitle}><CreditCard className="size-3" />주식담보대출</p>
                {linkedLoans.map((loan) => (
                  <div key={loan.id} className={ASSET_THEME.cardLoanItem}>
                    <span className={ASSET_THEME.cardLoanName}>{loan.name}</span>
                    <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                      <span className={`font-bold tabular-nums ${ASSET_THEME.liability}`}>-{formatCurrency(loan.balance)}</span>
                      <span className={ASSET_THEME.cardLoanRate}>{loan.interestRate}%</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="px-4 py-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground bg-muted/5">
              <span className="flex items-center gap-1"><Clock className="size-3" /><span className={`font-medium ${ASSET_THEME.text.default}`}>{formatHoldingPeriod(stock.purchaseDate)} 보유</span></span>
              <span className="flex items-center gap-1"><Calendar className="size-3" /><span className={`font-medium ${ASSET_THEME.text.default}`}>{stock.purchaseDate} 매수</span></span>
              {stock.description && <span className="w-full text-primary truncate"># {stock.description}</span>}
            </div>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

// 카테고리 탭 + 비중바 + 종목 목록 — 주식 상세/인증샷 공통 영역
export interface StockCategorySectionProps {
  activeCategory: string;
  onCategoryChange: (cat: string) => void;
  filteredStocks: Stock[];
  totalValue: number;
  barItems: { stock: Stock; value: number; color: string }[];
  barColors: string[];
  emptyMessage?: string;
  screenshotMode: boolean;
  renderItem: (stock: Stock, isFirstOverall: boolean, color: string) => React.ReactNode;
}

export function StockCategorySection({
  activeCategory,
  onCategoryChange,
  filteredStocks,
  totalValue,
  barItems,
  barColors,
  emptyMessage = "등록된 주식이 없습니다.",
  screenshotMode = false,
  renderItem,
}: StockCategorySectionProps) {
  const colorOf = (stock: Stock) => {
    const idx = barItems.findIndex((b) => b.stock.id === stock.id);
    return idx >= 0 ? barColors[idx] : MAIN_PALETTE[0];
  };

  return (
    <Tabs value={activeCategory} onValueChange={onCategoryChange}>
      <TabsList className={CAT_LIST}>
        {CATEGORY_TABS.map(({ value, label }) => (
          <TabsTrigger key={value} value={value} className={CAT_TRIGGER}>{label}</TabsTrigger>
        ))}
      </TabsList>

      {CATEGORY_TABS.map(({ value }) => (
        <TabsContent key={value} value={value} className="mt-4 space-y-3">
          {/* 비중 바 */}
          {barItems.length > 0 && totalValue > 0 && (
            <div className="space-y-2">
              <div className="flex h-6 w-full rounded-full overflow-hidden gap-px">
                {barItems.map(({ stock, value: v, color }) => {
                  const pct = (v / totalValue) * 100;
                  return (
                    <div key={stock.id} className="flex items-center justify-center overflow-hidden transition-all" style={{ width: `${pct}%`, backgroundColor: color }} title={`${stock.name}: ${pct.toFixed(1)}%`}>
                      {pct > 5 && <span className="text-white text-[11px] font-bold drop-shadow select-none px-0.5 truncate">{pct.toFixed(1)}%</span>}
                    </div>
                  );
                })}
              </div>
              <div className={`grid ${screenshotMode ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-4"} gap-x-4 gap-y-2 px-2`}>
                {barItems.map(({ stock, value: v, color }) => {
                  const pct = (v / totalValue) * 100;
                  return (
                    <div key={stock.id} className="flex items-center gap-1">
                      <span className="size-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                      <span className="text-xs sm:text-sm text-foreground truncate">{stock.name}</span>
                      <span className="text-xs sm:text-sm font-bold shrink-0" style={{ color: color }}>{pct.toFixed(1)}%</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 종목 리스트 */}
          {filteredStocks.length === 0 ? (
            <div className="flex h-36 items-center justify-center rounded-lg border border-dashed">
              <p className="text-muted-foreground text-sm">{emptyMessage}</p>
            </div>
          ) : activeCategory === "all" ? (
            <div className="space-y-4 mt-8">
              {CATEGORY_TABS.filter((c) => c.value !== "all").map((cat) => {
                const catStocks = filteredStocks.filter((s) => s.category === cat.value);
                if (catStocks.length === 0) return null;
                return (
                  <div key={cat.value}>
                    <p className="text-xs font-semibold text-muted-foreground px-1 pb-1.5">{cat.label}</p>
                    <div className="space-y-2">
                      {catStocks.map((s) => renderItem(s, filteredStocks[0]?.id === s.id, colorOf(s)))}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="space-y-2 mt-8">
              {filteredStocks.map((s, i) => renderItem(s, i === 0, colorOf(s)))}
            </div>
          )}
        </TabsContent>
      ))}
    </Tabs>
  );
}

export function StockTab() {
  const { assetData, deleteStock, saveData } = useAssetData();
  const [activeCategory, setActiveCategory] = useState("all");
  const [hasInteracted, setHasInteracted] = useState(() => {
    try { return !!localStorage.getItem(LS_KEY); } catch { return true; }
  });

  // 비해외주식의 currency/purchaseExchangeRate 정리 (1회성 마이그레이션)
  useEffect(() => {
    const dirty = assetData.stocks.filter(
      (s) => s.category !== "foreign" && (s.currency !== "KRW" || s.purchaseExchangeRate != null)
    );
    if (dirty.length === 0) return;
    const fixed = assetData.stocks.map((s) => {
      if (s.category === "foreign") return s;
      const next = { ...s, currency: "KRW" as const };
      delete next.purchaseExchangeRate;
      return next;
    });
    saveData({ ...assetData, stocks: fixed });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFirstInteract = () => {
    if (hasInteracted) return;
    setHasInteracted(true);
    try { localStorage.setItem(LS_KEY, "1"); } catch { /* ignore */ }
  };

  const { filteredStocks: allStocks, totalValue, totalProfit, totalProfitRate, barItems, barColors, summary, exchangeRates, dailyProfit, dailyProfitRate } =
    useFilteredStockData(activeCategory);

  const getCategoryLabel = (cat: string) => stockCategories.find((c) => c.value === cat)?.label ?? cat;

  const handleDelete = (id: string) => {
    if (confirm("정말 삭제하시겠습니까?")) {
      toast.success("삭제되었습니다.");
      deleteStock(id);
    }
  };

  return (
    <div className="space-y-4 mt-2">
      {/* 요약 헤더 */}
      <StockSummaryHeader
        totalValue={totalValue}
        totalProfit={totalProfit}
        totalProfitRate={totalProfitRate}
        currencyGain={activeCategory === "foreign" || activeCategory === "all" ? summary.stockCurrencyGain : 0}
        dailyProfit={dailyProfit}
        dailyProfitRate={dailyProfitRate}
      />

      {/* 카테고리 + 비중바 + 종목 목록 (인증샷과 공통) */}
      <StockCategorySection
        activeCategory={activeCategory}
        onCategoryChange={setActiveCategory}
        filteredStocks={allStocks}
        totalValue={totalValue}
        barItems={barItems}
        barColors={barColors}
        screenshotMode={false}
        renderItem={(stock, isFirst, color) => {
          const m = computeStockMetrics(stock, exchangeRates, totalValue);
          const linkedLoans = assetData.loans.filter((l) => l.linkedStockId === stock.id);
          return (
            <StockCard
              key={stock.id}
              stock={stock}
              color={color}
              pct={m.pct}
              currentVal={m.currentVal}
              profit={m.profit}
              profitRate={m.profitRate}
              isForeign={m.isForeign}
              krwMul={m.krwMul}
              currencyGain={m.currencyGain}
              currencyGainRate={m.currencyGainRate}
              linkedLoans={linkedLoans}
              onDelete={handleDelete}
              getCategoryLabel={getCategoryLabel}
              defaultOpen={isFirst && !hasInteracted}
              onFirstInteract={isFirst && !hasInteracted ? handleFirstInteract : undefined}
              isFirstVisit={isFirst && !hasInteracted}
            />
          );
        }}
      />
    </div>
  );
}
