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
import { formatCurrency, formatShortCurrency, calculateHoldingDays } from "@/lib/number-utils";
import { ASSET_THEME, MAIN_PALETTE, getProfitLossColor } from "@/config/theme";
import { stockCategories } from "@/config/asset-options";
import { normalizeTicker } from "@/lib/finance-service";
import { Stock, Loan } from "@/types/asset";
import { assignColors, getMultiplier, formatCurrencyDisplay, getPurchaseRatePerUnit } from "../asset-detail-tabs";
import { fetchProfitRef } from "@/lib/profit-utils";

const CAT_LIST = ASSET_THEME.tabList3;
const CAT_TRIGGER = ASSET_THEME.tabTrigger3;

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
  const showLogo = isForeign && ticker && /^[A-Z]+$/.test(ticker) && !imgError;
  return (
    <div className="size-6 sm:size-7 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden" style={{ backgroundColor: color }}>
      {showLogo ? (
        <img
          src={`https://img.logo.dev/ticker/${ticker}?token=pk_I3rhtineRSqYNMtDKQM1zw`}
          alt={name}
          className="size-6 sm:size-7 rounded-full object-cover"
          onError={() => setImgError(true)}
        />
      ) : (
        <span className="text-[9px] sm:text-[10px] font-bold text-white">{initial}</span>
      )}
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
      <div className="flex flex-wrap gap-x-5 gap-y-1.5 px-2">
        {items.map(({ stock, value: v, color }) => {
          const pct = (v / total) * 100;
          return (
            <div key={stock.id} className="flex items-center gap-1">
              <span className="size-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
              <span className="text-xs text-foreground">{stock.name}</span>
              <span className="text-xs font-bold text-muted-foreground">{pct.toFixed(1)}%</span>
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

  return { filteredStocks, totalValue, totalCost, totalProfit, totalProfitRate, barItems, barColors, summary, mul, dailyProfit, dailyProfitRate };
}

// 종목 단일 로우 (인증샷용 — 편집/삭제 버튼 없음)
export function StockRowItem({ stock, color, pct, currentVal, profit, profitRate, maskFn, screenshotMode = false }: StockRowData & { maskFn?: (v: number) => string; screenshotMode?: boolean }) {
  const fmt = maskFn ?? formatShortCurrency;
  const initial = (stock.ticker || stock.name).replace(/[^A-Za-z가-힣]/g, "").slice(0, 2).toUpperCase();
  return (
    <div className={`flex items-center gap-3 py-2 ${ASSET_THEME.primary.bgLight} px-2 rounded-md`}>
      <div className="size-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: color }}>
        <span className="text-[10px] font-bold text-white">{initial}</span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className={`font-semibold truncate ${screenshotMode ? "text-[12px]" : "text-sm"}`}>{stock.name}</span>
          {stock.ticker && <span className="text-[11px] text-muted-foreground font-mono shrink-0">{stock.ticker}</span>}
        </div>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className="text-xs text-foreground">{stock.quantity.toLocaleString()}주</span>
          <span className="text-xs text-muted-foreground">·</span>
          <span className="text-xs font-semibold text-primary">{pct.toFixed(1)}%</span>
        </div>
      </div>
      <div className="text-right flex-shrink-0">
        <p className={`font-bold tabular-nums ${ASSET_THEME.text.default} ${screenshotMode ? "text-[12px]" : "text-sm"}`}>{fmt(currentVal)}</p>
        <p className={`text-[11px] mt-0.5 tabular-nums ${getProfitLossColor(profit)}`}>
          {profit >= 0 ? "+" : ""}{fmt(Math.round(profit))}{" "}({profitRate >= 0 ? "+" : ""}{profitRate.toFixed(1)}%)
        </p>
      </div>
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
  return (
    <div className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 flex items-center justify-between">
      <div>
        <p className="text-xs text-muted-foreground font-semibold">총 주식 평가금액</p>
        <p className={`text-2xl font-extrabold tabular-nums ${ASSET_THEME.important}`}>{fmt(totalValue)}</p>
        {!screenshotMode && <p className="text-[11px] text-foreground">{formatCurrency(totalValue)}</p>}
      </div>
      <div className="text-right space-y-1">
        <div>
          <p className="text-xs text-muted-foreground">평가손익</p>
          <p className={`${screenshotMode ? "text-[13px]" : "text-lg"} font-bold tabular-nums ${getProfitLossColor(totalProfit)}`}>
            {totalProfit >= 0 ? "+" : ""}{fmt(Math.round(totalProfit))} ({totalProfitRate >= 0 ? "+" : ""}{totalProfitRate.toFixed(2)}%)
          </p>
          {currencyGain !== undefined && currencyGain !== 0 && (
            <p className={`text-[11px] tabular-nums ${getProfitLossColor(currencyGain)}`}>
              <span className="text-muted-foreground">환차손익</span> {currencyGain >= 0 ? "+" : ""}{fmt(Math.round(currencyGain))} 포함
            </p>
          )}
        </div>
        {dailyProfit != null && dailyProfitRate != null && (
          <div className="border-t border-border/40">
            <p className="text-xs text-muted-foreground">전일 대비</p>
            <p className={`${screenshotMode ? "text-[13px]" : "text-sm"} font-semibold tabular-nums ${getProfitLossColor(dailyProfit)}`}>
              {dailyProfit >= 0 ? "+" : ""}{fmt(Math.round(dailyProfit))} ({dailyProfitRate >= 0 ? "+" : ""}{dailyProfitRate.toFixed(2)}%)
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
  holdingDays: number;
  linkedLoans: Loan[];
  onDelete: (id: string) => void;
  getCategoryLabel: (cat: string) => string;
  defaultOpen?: boolean;
  onFirstInteract?: () => void;
  isFirstVisit?: boolean;
}

function StockCard({ stock, color, pct, currentVal, profit, profitRate, isForeign, krwMul, currencyGain, currencyGainRate, holdingDays, linkedLoans, onDelete, getCategoryLabel, defaultOpen = false, onFirstInteract, isFirstVisit = false }: StockCardProps) {
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
              <StockIcon ticker={normalizeTicker(stock)} name={stock.name} isForeign={stock.category === "foreign"} color={color} />
              <div className={ASSET_THEME.cardInfoLeft}>
                <div className={ASSET_THEME.cardInfoTitle}>
                  <span className={ASSET_THEME.cardInfoName}>{stock.name}</span>
                  {stock.ticker && <span className="text-[10px] text-muted-foreground font-mono shrink-0">{stock.ticker}</span>}
                  <Badge variant="outline" className={`${ASSET_THEME.categoryBox} text-[9px] px-1 py-0 leading-tight`}>{getCategoryLabel(stock.category)}</Badge>
                </div>
                <div className={ASSET_THEME.cardInfoMeta}>
                  <span className="text-[11px] text-foreground">{stock.quantity.toLocaleString()}주</span>
                  <span className="text-[11px] text-muted-foreground">·</span>
                  <span className="text-[11px] font-semibold text-primary">{pct.toFixed(1)}%</span>
                </div>
              </div>
              <div className={ASSET_THEME.cardInfoRight}>
                <p className={`${ASSET_THEME.cardAmountMain} ${ASSET_THEME.text.default}`}>{formatShortCurrency(currentVal)}</p>
                <div className={ASSET_THEME.cardAmountProfitRow}>
                  <p className={`${ASSET_THEME.cardAmountSub} ${getProfitLossColor(profit)}`}>{profit >= 0 ? "+" : ""}{formatShortCurrency(Math.round(profit))}</p>
                  <p className={`${ASSET_THEME.cardAmountRate} ${getProfitLossColor(profit)}`}>({profitRate >= 0 ? "+" : ""}{profitRate.toFixed(1)}%)</p>
                </div>
              </div>
              <ChevronDown className={`size-3.5 sm:size-4 text-muted-foreground flex-shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
            </button>
          </CollapsibleTrigger>
          <div className={ASSET_THEME.cardActions}>
            <Button size="icon" variant="outline" className={ASSET_THEME.cardActionButton} onClick={() => window.dispatchEvent(new CustomEvent("trigger-edit-stock", { detail: { id: stock.id } }))}>
              <Pencil className="size-3" />
            </Button>
            <Button size="icon" variant="outline" className={ASSET_THEME.cardActionButton} onClick={() => onDelete(stock.id)}>
              <Trash2 className="size-3" />
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
                <p className="text-xs text-muted-foreground">매입가</p>
                <p className="text-sm font-medium">{formatCurrencyDisplay(stock.averagePrice, stock.currency)}</p>
                {isForeign && <p className="text-[11px] text-muted-foreground">₩{(stock.averagePrice * krwMul).toLocaleString("ko-KR", { maximumFractionDigits: 0 })}</p>}
              </div>
              <div>
                <p className="text-xs text-muted-foreground">총 매입금액</p>
                <p className="text-sm font-medium">{formatCurrencyDisplay(stock.averagePrice * stock.quantity, stock.currency)}</p>
                {isForeign && <p className="text-[11px] text-muted-foreground">₩{(stock.averagePrice * stock.quantity * krwMul).toLocaleString("ko-KR", { maximumFractionDigits: 0 })}</p>}
              </div>
              <div>
                <p className="text-xs text-muted-foreground">현재가</p>
                <p className="text-sm font-semibold" style={{ color: MAIN_PALETTE[5] }}>{formatCurrencyDisplay(stock.currentPrice, stock.currency)}</p>
                {isForeign && <p className="text-[11px] text-muted-foreground">₩{(stock.currentPrice * krwMul).toLocaleString("ko-KR", { maximumFractionDigits: 0 })}</p>}
              </div>
              <div>
                <p className="text-xs text-muted-foreground">총 평가금액</p>
                <p className="text-sm font-semibold" style={{ color: MAIN_PALETTE[5] }}>{formatCurrencyDisplay(stock.currentPrice * stock.quantity, stock.currency)}</p>
                {isForeign && <p className="text-[11px] text-muted-foreground">₩{(stock.currentPrice * stock.quantity * krwMul).toLocaleString("ko-KR", { maximumFractionDigits: 0 })}</p>}
              </div>
            </div>
            {isForeign && (
              <div className="grid grid-cols-2 px-4 py-2.5 gap-4 bg-muted/5">
                <div>
                  <p className="text-xs text-muted-foreground">환차손익</p>
                  <p className={`text-sm font-semibold ${getProfitLossColor(currencyGain)}`}>
                    {formatCurrencyDisplay(Math.round(currencyGain))}
                    <span className="text-xs ml-1">({currencyGainRate >= 0 ? "+" : ""}{currencyGainRate.toFixed(2)}%)</span>
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">매입환율</p>
                  <p className="text-xs text-foreground">
                    {stock.purchaseExchangeRate && stock.purchaseExchangeRate > 0
                      ? stock.currency === "JPY" ? `¥100 = ₩${stock.purchaseExchangeRate.toLocaleString()}` : `$1 = ₩${stock.purchaseExchangeRate.toLocaleString()}`
                      : "미입력 (현재환율)"}
                  </p>
                </div>
              </div>
            )}
            {linkedLoans.length > 0 && (
              <div className="px-4 py-2.5 space-y-1.5 bg-muted/10">
                <p className="text-[11px] font-semibold text-muted-foreground">주식담보대출</p>
                {linkedLoans.map((loan) => (
                  <div key={loan.id} className={ASSET_THEME.liabilityBadge}>
                    <div className="flex items-center gap-1.5 min-w-0">
                      <CreditCard className="size-3 text-muted-foreground flex-shrink-0" />
                      <span className="text-muted-foreground truncate">{loan.name}</span>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className={`font-semibold tabular-nums ${ASSET_THEME.liability}`}>-{formatCurrency(loan.balance)}</span>
                      <span className="text-muted-foreground">{loan.interestRate}%</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="px-4 py-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground bg-muted/5">
              <span className="flex items-center gap-1"><Clock className="size-3" /><span className="font-medium text-foreground">{holdingDays.toLocaleString()}일 보유</span></span>
              <span className="flex items-center gap-1"><Calendar className="size-3" /><span className="font-medium text-foreground">{stock.purchaseDate} 매수</span></span>
              {stock.description && <span className="w-full text-primary truncate"># {stock.description}</span>}
            </div>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
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

  const { filteredStocks: allStocks, totalValue, totalProfit, totalProfitRate, barItems, barColors, summary, mul, dailyProfit, dailyProfitRate } =
    useFilteredStockData(activeCategory);

  const getCategoryLabel = (cat: string) => stockCategories.find((c) => c.value === cat)?.label ?? cat;

  const handleDelete = (id: string) => {
    if (confirm("정말 삭제하시겠습니까?")) {
      toast.success("삭제되었습니다.");
      deleteStock(id);
    }
  };

  const renderStockCard = (stock: Stock, isFirst = false) => {
    const colorIdx = barItems.findIndex((b) => b.stock.id === stock.id);
    const color = colorIdx >= 0 ? barColors[colorIdx] : MAIN_PALETTE[0];
    const krwMul = mul(stock.currency);
    const isForeign = stock.category === "foreign" && stock.currency !== "KRW";
    const purchaseRate = getPurchaseRatePerUnit(stock, mul(stock.currency));
    const currentVal = stock.quantity * stock.currentPrice * krwMul;
    const cost = isForeign ? stock.quantity * stock.averagePrice * purchaseRate : stock.quantity * stock.averagePrice * krwMul;
    const profit = currentVal - cost;
    const profitRate = cost > 0 ? (profit / cost) * 100 : 0;
    const currencyGain = isForeign ? (krwMul - purchaseRate) * stock.quantity * stock.averagePrice : 0;
    const currencyGainRate = isForeign && purchaseRate > 0 ? ((krwMul - purchaseRate) / purchaseRate) * 100 : 0;
    const holdingDays = calculateHoldingDays(stock.purchaseDate);
    const pct = totalValue > 0 ? (currentVal / totalValue) * 100 : 0;
    const linkedLoans = assetData.loans.filter((l) => l.linkedStockId === stock.id);
    return (
      <StockCard
        key={stock.id}
        stock={stock}
        color={color}
        pct={pct}
        currentVal={currentVal}
        profit={profit}
        profitRate={profitRate}
        isForeign={isForeign}
        krwMul={krwMul}
        currencyGain={currencyGain}
        currencyGainRate={currencyGainRate}
        holdingDays={holdingDays}
        linkedLoans={linkedLoans}
        onDelete={handleDelete}
        getCategoryLabel={getCategoryLabel}
        defaultOpen={isFirst && !hasInteracted}
        onFirstInteract={isFirst && !hasInteracted ? handleFirstInteract : undefined}
        isFirstVisit={isFirst && !hasInteracted}
      />
    );
  };

  return (
    <div className="space-y-4 mt-2">
      {/* 요약 헤더 */}
      <StockSummaryHeader
        totalValue={totalValue}
        totalProfit={totalProfit}
        totalProfitRate={totalProfitRate}
        currencyGain={summary.stockCurrencyGain}
        dailyProfit={dailyProfit}
        dailyProfitRate={dailyProfitRate}
      />

      {/* 카테고리 서브탭 */}
      <Tabs value={activeCategory} onValueChange={setActiveCategory}>
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
                        {pct > 5 && <span className="text-white text-[10px] font-bold drop-shadow select-none px-0.5 truncate">{pct.toFixed(1)}%</span>}
                      </div>
                    );
                  })}
                </div>
                <div className="flex flex-wrap gap-x-5 gap-y-1.5 px-2">
                  {barItems.map(({ stock, value: v, color }) => {
                    const pct = (v / totalValue) * 100;
                    return (
                      <div key={stock.id} className="flex items-center gap-1">
                        <span className="size-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                        <span className="text-xs text-foreground">{stock.name}</span>
                        <span className="text-xs font-bold text-muted-foreground">{pct.toFixed(1)}%</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 종목 리스트 */}
            {allStocks.length === 0 ? (
              <div className="flex h-36 items-center justify-center rounded-lg border border-dashed">
                <p className="text-muted-foreground text-sm">등록된 주식이 없습니다.</p>
              </div>
            ) : value === "all" ? (
              <div className="space-y-4 mt-8">
                {CATEGORY_TABS.filter((c) => c.value !== "all").map((cat) => {
                  const catStocks = allStocks.filter((s) => s.category === cat.value);
                  if (catStocks.length === 0) return null;
                  return (
                    <div key={cat.value}>
                      <p className="text-xs font-semibold text-muted-foreground px-1 pb-1.5">{cat.label}</p>
                      <div className="space-y-2">{catStocks.map((s, i) => renderStockCard(s, i === 0 && allStocks[0]?.id === s.id))}</div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="space-y-2 mt-8">{allStocks.map((s, i) => renderStockCard(s, i === 0))}</div>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
