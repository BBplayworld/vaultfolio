"use client";

import React, { useState } from "react";
import {
  TrendingUp, Building2, Bitcoin, Banknote, CreditCard,
  Pencil, Trash2, Calendar, Clock, MapPin,
} from "lucide-react";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useAssetData } from "@/contexts/asset-data-context";
import { formatCurrency, formatShortCurrency, calculateHoldingDays } from "@/lib/number-utils";
import { ASSET_THEME, MAIN_PALETTE, getProfitLossColor } from "@/config/theme";
import { stockCategories, realEstateTypes, cashTypes, loanTypes, loanTypeOrder } from "@/config/asset-options";
import { normalizeTicker } from "@/lib/finance-service";
import { Stock } from "@/types/asset";

const NAV_LIST = ASSET_THEME.tabList2;
const NAV_TRIGGER = ASSET_THEME.tabTrigger2;
const CAT_LIST = ASSET_THEME.tabList3;
const CAT_TRIGGER = ASSET_THEME.tabTrigger3;

// 종목 아이콘 (해외주식 로고 / 이니셜 fallback)
function StockIcon({ ticker, name, isForeign, color }: { ticker: string; name: string; isForeign: boolean, color: string }) {
  const [imgError, setImgError] = React.useState(false);
  const initial = (ticker || name).replace(/[^A-Za-z가-힣]/g, "").slice(0, 2).toUpperCase() || "";
  const showLogo = isForeign && ticker && /^[A-Z]+$/.test(ticker) && !imgError;
  return (
    <div className="rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden" style={{ backgroundColor: color }}>
      {showLogo ? (
        <img
          src={`https://img.logo.dev/ticker/${ticker}?token=pk_I3rhtineRSqYNMtDKQM1zw`}
          alt={name}
          className="size-6 rounded-full object-cover"
          onError={() => setImgError(true)}
        />
      ) : (
        <span className="size-5.5 text-[10px] font-bold text-white">{initial}</span>
      )}
    </div>
  );
}

// 최대값 → MAIN_PALETTE[0] 고정, 나머지는 [1~9] 순차 배정
function assignColors(items: { value: number }[]): string[] {
  if (items.length === 0) return [];
  const maxIdx = items.reduce((mi, it, i) => (it.value > items[mi].value ? i : mi), 0);
  let si = 0;
  return items.map((_, i) => (i === maxIdx ? MAIN_PALETTE[0] : MAIN_PALETTE[1 + (si++) % 9]));
}

// ─── 주식 탭 ──────────────────────────────────────────────────────────────────
function StockTab() {
  const { assetData, deleteStock, exchangeRates, getAssetSummary } = useAssetData();
  const summary = getAssetSummary();
  const [activeCategory, setActiveCategory] = useState("all");

  const getMultiplier = (currency?: string) => {
    if (currency === "USD") return exchangeRates.USD;
    if (currency === "JPY") return exchangeRates.JPY / 100;
    return 1;
  };

  const getPurchaseRatePerUnit = (stock: Stock): number => {
    if (!stock.purchaseExchangeRate || stock.purchaseExchangeRate <= 0) return getMultiplier(stock.currency);
    return stock.currency === "JPY" ? stock.purchaseExchangeRate / 100 : stock.purchaseExchangeRate;
  };

  const formatCurrencyDisplay = (value: number, currency = "KRW") => {
    if (currency === "USD") return `$${value.toLocaleString(undefined, { maximumFractionDigits: 3 })}`;
    if (currency === "JPY") return `¥${value.toLocaleString(undefined, { maximumFractionDigits: 3 })}`;
    return formatCurrency(value);
  };

  const getCategoryLabel = (cat: string) => stockCategories.find((c) => c.value === cat)?.label ?? cat;

  const handleDelete = (id: string) => {
    if (confirm("정말 삭제하시겠습니까?")) {
      toast.success("삭제되었습니다.");
      deleteStock(id);
    }
  };

  const getFilteredStocks = (category: string) => {
    const stocks = category === "all" ? assetData.stocks : assetData.stocks.filter((s) => s.category === category);
    return [...stocks].sort((a, b) => {
      const va = a.quantity * a.currentPrice * getMultiplier(a.currency);
      const vb = b.quantity * b.currentPrice * getMultiplier(b.currency);
      return vb - va;
    });
  };

  const allStocks = getFilteredStocks(activeCategory);
  const totalValue = allStocks.reduce((s, st) => s + st.quantity * st.currentPrice * getMultiplier(st.currency), 0);
  const totalCost = allStocks.reduce((s, st) => {
    const isForeign = st.category === "foreign" && st.currency !== "KRW";
    const rate = isForeign ? getPurchaseRatePerUnit(st) : getMultiplier(st.currency);
    return s + st.quantity * st.averagePrice * rate;
  }, 0);
  const totalProfit = totalValue - totalCost;
  const totalProfitRate = totalCost > 0 ? (totalProfit / totalCost) * 100 : 0;

  // 비중 바 데이터 (현재 탭 종목 전체 대비)
  const barValues = allStocks.map((st) => ({ value: st.quantity * st.currentPrice * getMultiplier(st.currency) }));
  const barColors = assignColors(barValues);
  const barItems = allStocks.map((st, idx) => ({
    stock: st,
    value: barValues[idx].value,
    color: barColors[idx],
  }));

  const CATEGORY_TABS = [
    { value: "all", label: "전체" },
    { value: "domestic", label: "국내" },
    { value: "foreign", label: "해외" },
    { value: "irp", label: "IRP" },
    { value: "isa", label: "ISA" },
    { value: "pension", label: "연금" },
    { value: "unlisted", label: "비상장" },
  ] as const;

  return (
    <div className="space-y-4 mt-2">
      {/* 요약 헤더 */}
      <div className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground font-semibold">총 주식 평가금액</p>
          <p className={`text-2xl font-extrabold tabular-nums ${ASSET_THEME.important}`}>{formatShortCurrency(totalValue)}</p>
          <p className="text-[11px] text-foreground">{formatCurrency(totalValue)}</p>
        </div>
        <div className="text-right space-y-1">
          <div>
            <p className="text-xs text-muted-foreground">평가손익</p>
            <p className={`text-lg font-bold tabular-nums ${getProfitLossColor(totalProfit)}`}>
              {totalProfit >= 0 ? "+" : ""}{formatShortCurrency(Math.round(totalProfit))} ({totalProfitRate >= 0 ? "+" : ""}{totalProfitRate.toFixed(2)}%)
            </p>
          </div>
          {summary.stockCurrencyGain !== 0 && (
            <div className="border-t border-border/40 pt-1">
              <p className="text-xs text-muted-foreground">환차손익</p>
              <p className={`text-sm font-semibold tabular-nums ${getProfitLossColor(summary.stockCurrencyGain)}`}>
                {summary.stockCurrencyGain >= 0 ? "+" : ""}{formatShortCurrency(Math.round(summary.stockCurrencyGain))}
              </p>
            </div>
          )}
        </div>
      </div>

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
                      <div
                        key={stock.id}
                        className="flex items-center justify-center overflow-hidden transition-all"
                        style={{ width: `${pct}%`, backgroundColor: color }}
                        title={`${stock.name}: ${pct.toFixed(1)}%`}
                      >
                        {pct > 8 && (
                          <span className="text-white text-[10px] font-bold drop-shadow select-none px-0.5 truncate">
                            {pct.toFixed(0)}%
                          </span>
                        )}
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
              // 전체 탭: 카테고리별 그룹핑
              <div className="space-y-4 mt-8">
                {CATEGORY_TABS.filter(c => c.value !== "all").map(cat => {
                  const catStocks = allStocks.filter(s => s.category === cat.value);
                  if (catStocks.length === 0) return null;
                  return (
                    <div key={cat.value}>
                      <p className="text-xs font-semibold text-muted-foreground px-1 pb-1.5">{cat.label}</p>
                      <div className="space-y-2">
                        {catStocks.map((stock) => {
                          const krwMul = getMultiplier(stock.currency);
                          const isForeign = stock.category === "foreign" && stock.currency !== "KRW";
                          const purchaseRate = getPurchaseRatePerUnit(stock);
                          const currentVal = stock.quantity * stock.currentPrice * krwMul;
                          const cost = isForeign
                            ? stock.quantity * stock.averagePrice * purchaseRate
                            : stock.quantity * stock.averagePrice * krwMul;
                          const profit = currentVal - cost;
                          const profitRate = cost > 0 ? (profit / cost) * 100 : 0;
                          const currencyGain = isForeign
                            ? (krwMul - purchaseRate) * stock.quantity * stock.averagePrice
                            : 0;
                          const currencyGainRate = isForeign && purchaseRate > 0
                            ? ((krwMul - purchaseRate) / purchaseRate) * 100
                            : 0;
                          const holdingDays = calculateHoldingDays(stock.purchaseDate);
                          const pct = totalValue > 0 ? (currentVal / totalValue) * 100 : 0;
                          const color = barColors[barItems.findIndex((b) => b.stock.id === stock.id)] ?? MAIN_PALETTE[0];
                          const linkedLoans = assetData.loans.filter((l) => l.linkedStockId === stock.id);
                          return (
                            <Collapsible key={stock.id} className="mb-3">
                              <div className="rounded-lg border bg-card overflow-hidden ">
                                <div className="flex items-center gap-6 px-3 py-2.5">
                                  <CollapsibleTrigger asChild>
                                    <button className="flex items-center gap-3 flex-1 min-w-0 text-left">
                                      <StockIcon ticker={normalizeTicker(stock)} name={stock.name} isForeign={stock.category === "foreign"} color={color} />
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                          <span className="font-semibold text-sm truncate">{stock.name}</span>
                                          {stock.ticker && <span className="text-[11px] text-muted-foreground font-mono shrink-0">{stock.ticker}</span>}
                                          <Badge variant="outline" className={`${ASSET_THEME.categoryBox} text-[10px] px-1.5 py-0`}>{getCategoryLabel(stock.category)}</Badge>
                                        </div>
                                        <div className="flex items-center gap-1.5 mt-0.5">
                                          <span className="text-xs text-foreground">{stock.quantity.toLocaleString()}주</span>
                                          <span className="text-xs text-muted-foreground">·</span>
                                          <span className="text-xs font-semibold text-primary">{pct.toFixed(1)}%</span>
                                        </div>
                                      </div>
                                      <div className="text-right flex-shrink-0">
                                        <p className={`text-sm font-bold tabular-nums ${ASSET_THEME.text.default}`}>{formatShortCurrency(currentVal)}</p>
                                        <p className={`text-xs mt-0.5 tabular-nums ${getProfitLossColor(profit)}`}>
                                          {profit >= 0 ? "+" : ""}{formatShortCurrency(Math.round(profit))}{" "}({profitRate >= 0 ? "+" : ""}{profitRate.toFixed(1)}%)
                                        </p>
                                      </div>
                                    </button>
                                  </CollapsibleTrigger>
                                  <div className="flex gap-2 flex-shrink-0">
                                    <Button size="icon" variant="outline" className="size-8" onClick={() => window.dispatchEvent(new CustomEvent("trigger-edit-stock", { detail: { id: stock.id } }))}>
                                      <Pencil className="size-4" />
                                    </Button>
                                    <Button size="icon" variant="outline" className="size-8" onClick={() => handleDelete(stock.id)}>
                                      <Trash2 className="size-4" />
                                    </Button>
                                  </div>
                                </div>
                                <div className="h-0.5 w-full bg-muted">
                                  <div className="h-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
                                </div>
                                <CollapsibleContent>
                                  <div className="border-t divide-y divide-border/50">
                                    <div className="grid grid-cols-2 px-4 py-2.5 gap-4 bg-muted/10">
                                      <div>
                                        <p className="text-xs text-muted-foreground">평균단가</p>
                                        <p className="text-sm font-medium">{formatCurrencyDisplay(stock.averagePrice, stock.currency)}</p>
                                        {isForeign && <p className="text-[11px] text-muted-foreground">₩{(stock.averagePrice * krwMul).toLocaleString("ko-KR", { maximumFractionDigits: 0 })}</p>}
                                      </div>
                                      <div>
                                        <p className="text-xs text-muted-foreground">현재가</p>
                                        <p className={`text-sm font-semibold`} style={{ color: MAIN_PALETTE[2] }}>{formatCurrencyDisplay(stock.currentPrice, stock.currency)}</p>
                                        {isForeign && <p className="text-[11px] text-muted-foreground">₩{(stock.currentPrice * krwMul).toLocaleString("ko-KR", { maximumFractionDigits: 0 })}</p>}
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
                                          <div key={loan.id} className="flex items-center justify-between text-xs rounded-md bg-muted/20 border border-border/50 px-2.5 py-1.5">
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
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="space-y-2 mt-8">
                {allStocks.map((stock, idx) => {
                  const krwMul = getMultiplier(stock.currency);
                  const isForeign = stock.category === "foreign" && stock.currency !== "KRW";
                  const purchaseRate = getPurchaseRatePerUnit(stock);
                  const currentVal = stock.quantity * stock.currentPrice * krwMul;
                  const cost = isForeign
                    ? stock.quantity * stock.averagePrice * purchaseRate
                    : stock.quantity * stock.averagePrice * krwMul;
                  const profit = currentVal - cost;
                  const profitRate = cost > 0 ? (profit / cost) * 100 : 0;
                  const currencyGain = isForeign
                    ? (krwMul - purchaseRate) * stock.quantity * stock.averagePrice
                    : 0;
                  const currencyGainRate = isForeign && purchaseRate > 0
                    ? ((krwMul - purchaseRate) / purchaseRate) * 100
                    : 0;
                  const holdingDays = calculateHoldingDays(stock.purchaseDate);
                  const pct = totalValue > 0 ? (currentVal / totalValue) * 100 : 0;
                  const color = barColors[idx] ?? MAIN_PALETTE[0];
                  const linkedLoans = assetData.loans.filter((l) => l.linkedStockId === stock.id);

                  return (
                    <Collapsible key={stock.id} className="mb-3">
                      <div className="rounded-lg border bg-card overflow-hidden">
                        <div className="flex items-center gap-6 px-3 py-2.5">
                          <CollapsibleTrigger asChild>
                            <button className="flex items-center gap-3 flex-1 min-w-0 text-left">
                              <StockIcon ticker={normalizeTicker(stock)} name={stock.name} isForeign={stock.category === "foreign"} />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="font-semibold text-sm truncate">{stock.name}</span>
                                  {stock.ticker && <span className="text-[11px] text-muted-foreground font-mono shrink-0">{stock.ticker}</span>}
                                  <Badge variant="outline" className={`${ASSET_THEME.categoryBox} text-[10px] px-1.5 py-0`}>{getCategoryLabel(stock.category)}</Badge>
                                </div>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                  <span className="text-xs text-foreground">{stock.quantity.toLocaleString()}주</span>
                                  <span className="text-xs text-muted-foreground">·</span>
                                  <span className="text-xs font-semibold text-primary">{pct.toFixed(1)}%</span>
                                </div>
                              </div>
                              <div className="text-right flex-shrink-0">
                                <p className={`text-sm font-bold tabular-nums ${ASSET_THEME.text.default}`}>{formatShortCurrency(currentVal)}</p>
                                <p className={`text-xs tabular-nums ${getProfitLossColor(profit)}`}>
                                  {profit >= 0 ? "+" : ""}{formatShortCurrency(Math.round(profit))}{" "}({profitRate >= 0 ? "+" : ""}{profitRate.toFixed(1)}%)
                                </p>
                              </div>
                            </button>
                          </CollapsibleTrigger>
                          <div className="flex gap-2 flex-shrink-0">
                            <Button size="icon" variant="outline" className="size-8" onClick={() => window.dispatchEvent(new CustomEvent("trigger-edit-stock", { detail: { id: stock.id } }))}>
                              <Pencil className="size-4" />
                            </Button>
                            <Button size="icon" variant="outline" className="size-8" onClick={() => handleDelete(stock.id)}>
                              <Trash2 className="size-4" />
                            </Button>
                          </div>
                        </div>
                        <div className="h-0.5 w-full bg-muted">
                          <div className="h-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
                        </div>
                        <CollapsibleContent>
                          <div className="border-t divide-y divide-border/50">
                            <div className="grid grid-cols-2 px-4 py-2.5 gap-4 bg-muted/10">
                              <div>
                                <p className="text-xs text-muted-foreground">평균단가</p>
                                <p className="text-sm font-medium">{formatCurrencyDisplay(stock.averagePrice, stock.currency)}</p>
                                {isForeign && <p className="text-[11px] text-muted-foreground">₩{(stock.averagePrice * krwMul).toLocaleString("ko-KR", { maximumFractionDigits: 0 })}</p>}
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">현재가</p>
                                <p className={`text-sm font-semibold`} style={{ color: MAIN_PALETTE[2] }}>{formatCurrencyDisplay(stock.currentPrice, stock.currency)}</p>
                                {isForeign && <p className="text-[11px] text-muted-foreground">₩{(stock.currentPrice * krwMul).toLocaleString("ko-KR", { maximumFractionDigits: 0 })}</p>}
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
                })}
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

// ─── 부동산 탭 ────────────────────────────────────────────────────────────────
function RealEstateTab() {
  const { assetData, deleteRealEstate, getAssetSummary } = useAssetData();
  const summary = getAssetSummary();

  const sorted = [...assetData.realEstate].sort((a, b) => b.currentValue - a.currentValue);
  const totalValue = summary.realEstateValue;

  const reBarColors = assignColors(sorted.map((item) => ({ value: item.currentValue })));

  const barItems = sorted.map((item, idx) => ({
    item,
    value: item.currentValue,
    color: reBarColors[idx],
  }));

  return (
    <div className="space-y-4 mt-2">
      <div className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground font-semibold">총 부동산 평가금액</p>
          <p className={`text-2xl font-extrabold tabular-nums ${ASSET_THEME.important}`}>{formatShortCurrency(totalValue)}</p>
          <p className="text-[11px] text-foreground">{formatCurrency(totalValue)}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">평가손익</p>
          <p className={`text-lg font-bold tabular-nums ${getProfitLossColor(summary.realEstateProfit)}`}>
            {summary.realEstateProfit >= 0 ? "+" : ""}{formatShortCurrency(summary.realEstateProfit)} ({summary.realEstateProfit >= 0 ? "+" : ""}{((summary.realEstateProfit / summary.realEstateCost) * 100).toFixed(1)}%)
          </p>
        </div>
      </div>

      {barItems.length > 0 && totalValue > 0 && (
        <div className="space-y-2">
          <div className="flex h-6 w-full rounded-full overflow-hidden gap-px">
            {barItems.map(({ item, value: v, color }) => {
              const pct = (v / totalValue) * 100;
              return (
                <div key={item.id} className="flex items-center justify-center overflow-hidden transition-all" style={{ width: `${pct}%`, backgroundColor: color }} title={`${item.name}: ${pct.toFixed(1)}%`}>
                  {pct > 8 && <span className="text-white text-[10px] font-bold drop-shadow select-none px-0.5 truncate">{pct.toFixed(0)}%</span>}
                </div>
              );
            })}
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            {barItems.map(({ item, value: v, color }) => {
              const pct = (v / totalValue) * 100;
              return (
                <div key={item.id} className="flex items-center gap-1">
                  <span className="size-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                  <span className="text-xs text-foreground">{item.name}</span>
                  <span className="text-xs font-bold text-muted-foreground">{pct.toFixed(1)}%</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {sorted.length === 0 ? (
        <div className="flex h-36 items-center justify-center rounded-lg border border-dashed">
          <p className="text-muted-foreground text-sm">등록된 부동산이 없습니다.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {sorted.map((item, idx) => {
            const profit = item.currentValue - item.purchasePrice;
            const profitRate = item.purchasePrice > 0 ? (profit / item.purchasePrice) * 100 : 0;
            const holdingDays = calculateHoldingDays(item.purchaseDate);
            const pct = totalValue > 0 ? (item.currentValue / totalValue) * 100 : 0;
            const color = reBarColors[idx] ?? MAIN_PALETTE[0];
            const linkedLoans = assetData.loans.filter((l) => l.linkedRealEstateId === item.id);
            const typeLabel = realEstateTypes.find((t) => t.value === item.type)?.label ?? item.type;

            return (
              <Collapsible key={item.id} className="mb-3">
                <div className="rounded-lg border bg-card overflow-hidden">
                  <div className="flex items-center gap-6 px-3 py-2.5">
                    <CollapsibleTrigger asChild>
                      <button className="flex items-center gap-3 flex-1 min-w-0 text-left">
                        <div className="size-7 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: color }}>
                          <Building2 className="size-4 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-semibold text-sm truncate">{item.name}</span>
                            <Badge variant="outline" className={`${ASSET_THEME.categoryBox} text-[10px] px-1.5 py-0`}>{typeLabel}</Badge>
                          </div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-xs text-foreground">{formatShortCurrency(item.purchasePrice)} 매입</span><span className="text-xs text-muted-foreground">{`${holdingDays.toLocaleString()}일 보유`}</span>
                            <span className="text-xs text-muted-foreground">·</span>
                            <span className="text-xs font-semibold text-primary">{pct.toFixed(1)}%</span>
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className={`text-sm font-bold tabular-nums ${ASSET_THEME.text.default}`}>{formatShortCurrency(item.currentValue)}</p>
                          <p className={`text-xs tabular-nums ${getProfitLossColor(profit)}`}>
                            {profit >= 0 ? "+" : ""}{formatShortCurrency(profit)}{" "}({profitRate >= 0 ? "+" : ""}{profitRate.toFixed(1)}%)
                          </p>
                        </div>
                      </button>
                    </CollapsibleTrigger>
                    <div className="flex gap-2 flex-shrink-0">
                      <Button size="icon" variant="outline" className="size-8" onClick={() => window.dispatchEvent(new CustomEvent("trigger-edit-real-estate", { detail: { id: item.id } }))}>
                        <Pencil className="size-4" />
                      </Button>
                      <Button size="icon" variant="outline" className="size-8" onClick={() => { if (confirm("정말 삭제하시겠습니까?")) { deleteRealEstate(item.id); toast.success("삭제되었습니다."); } }}>
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="h-0.5 w-full bg-muted">
                    <div className="h-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
                  </div>
                  <CollapsibleContent>
                    <div className="border-t divide-y divide-border/50">
                      <div className="grid grid-cols-3 px-4 py-2.5 gap-2 bg-muted/10">
                        <div className="rounded-md bg-muted/30 px-2 py-2 text-center">
                          <p className="text-[11px] text-muted-foreground mb-0.5">매입가</p>
                          <p className="text-xs font-medium tabular-nums">{formatShortCurrency(item.purchasePrice)}</p>
                        </div>
                        <div className="rounded-md bg-muted/30 px-2 py-2 text-center">
                          <p className="text-[11px] text-muted-foreground mb-0.5">실거래가</p>
                          <p className={`text-xs font-bold tabular-nums`} style={{ color: MAIN_PALETTE[2] }}>{formatShortCurrency(item.currentValue)}</p>
                        </div>
                        <div className="rounded-md bg-muted/30 px-2 py-2 text-center">
                          <p className="text-[11px] text-muted-foreground mb-0.5">평가손익</p>
                          <p className={`text-xs font-bold tabular-nums ${getProfitLossColor(profit)}`}>{profit >= 0 ? "+" : ""}{formatShortCurrency(profit)}</p>
                        </div>
                      </div>
                      {item.address && (
                        <div className="flex items-center gap-1.5 px-4 py-2 text-xs text-muted-foreground bg-muted/5">
                          <MapPin className="size-3 flex-shrink-0" />
                          <span className="truncate">{item.address}</span>
                        </div>
                      )}
                      {(item.tenantDeposit ?? 0) > 0 && (
                        <div className="flex items-center justify-between px-4 py-2 text-xs bg-muted/10">
                          <span className="text-muted-foreground">임차인보증금</span>
                          <span className={`font-semibold ${ASSET_THEME.liability}`}>{formatShortCurrency(item.tenantDeposit!)}</span>
                        </div>
                      )}
                      {linkedLoans.length > 0 && (
                        <div className="px-4 py-2.5 space-y-1.5">
                          <p className="text-[11px] font-semibold text-muted-foreground">주택담보대출</p>
                          {linkedLoans.map((loan) => (
                            <div key={loan.id} className={ASSET_THEME.liabilityBadge}>
                              <div className="flex items-center gap-1.5 min-w-0">
                                <CreditCard className="size-3 text-muted-foreground flex-shrink-0" />
                                <span className="text-muted-foreground truncate">{loan.name}</span>
                              </div>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                <span className={`font-semibold tabular-nums ${ASSET_THEME.liability}`}>-{formatShortCurrency(loan.balance)}</span>
                                <span className="text-muted-foreground">{loan.interestRate}%</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </CollapsibleContent>
                </div>
              </Collapsible>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── 암호화폐 탭 ──────────────────────────────────────────────────────────────
function CryptoTab() {
  const { assetData, deleteCrypto, getAssetSummary } = useAssetData();
  const summary = getAssetSummary();

  const handleDelete = (id: string) => {
    if (confirm("정말 삭제하시겠습니까?")) {
      deleteCrypto(id);
      toast.success("삭제되었습니다.");
    }
  };

  const sorted = [...assetData.crypto]
    .map((coin) => {
      const value = coin.quantity * coin.currentPrice;
      const cost = coin.quantity * coin.averagePrice;
      const profit = value - cost;
      const profitRate = cost > 0 ? (profit / cost) * 100 : 0;
      return { coin, value, cost, profit, profitRate };
    })
    .filter((d) => d.value > 0)
    .sort((a, b) => b.value - a.value);

  const totalValue = summary.cryptoValue;
  const totalProfit = summary.cryptoProfit;
  const totalCost = summary.cryptoCost;

  const cryptoColors = assignColors(sorted.map((d) => ({ value: d.value })));
  const barItems = sorted.map(({ coin, value }, idx) => ({ coin, value, color: cryptoColors[idx] }));

  return (
    <div className="space-y-4 mt-2">
      <div className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground font-semibold">총 암호화폐 평가금액</p>
          <p className={`text-2xl font-extrabold tabular-nums ${ASSET_THEME.important}`}>{formatShortCurrency(totalValue)}</p>
          <p className="text-[11px] text-foreground">{formatCurrency(totalValue)}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">평가손익</p>
          <p className={`text-lg font-bold tabular-nums ${getProfitLossColor(totalProfit)}`}>
            {totalProfit >= 0 ? "+" : ""}{formatShortCurrency(Math.round(totalProfit))} ({totalProfit >= 0 ? "+" : ""}{((totalProfit / totalCost) * 100).toFixed(2)}%)
          </p>
        </div>
      </div>

      {barItems.length > 0 && totalValue > 0 && (
        <div className="space-y-2">
          <div className="flex h-6 w-full rounded-full overflow-hidden gap-px">
            {barItems.map(({ coin, value: v, color }) => {
              const pct = (v / totalValue) * 100;
              return (
                <div key={coin.id} className="flex items-center justify-center overflow-hidden transition-all" style={{ width: `${pct}%`, backgroundColor: color }} title={`${coin.name}: ${pct.toFixed(1)}%`}>
                  {pct > 8 && <span className="text-white text-[10px] font-bold drop-shadow select-none px-0.5 truncate">{pct.toFixed(0)}%</span>}
                </div>
              );
            })}
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            {barItems.map(({ coin, value: v, color }) => {
              const pct = (v / totalValue) * 100;
              return (
                <div key={coin.id} className="flex items-center gap-1">
                  <span className="size-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                  <span className="text-xs text-foreground">{coin.name}</span>
                  <span className="text-xs font-bold text-muted-foreground">{pct.toFixed(1)}%</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {sorted.length === 0 ? (
        <div className="flex h-36 items-center justify-center rounded-lg border border-dashed">
          <p className="text-muted-foreground text-sm">등록된 암호화폐가 없습니다.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {sorted.map(({ coin, value, profit, profitRate }, idx) => {
            const pct = totalValue > 0 ? (value / totalValue) * 100 : 0;
            const color = cryptoColors[idx] ?? MAIN_PALETTE[0];
            const holdingDays = calculateHoldingDays(coin.purchaseDate);
            return (
              <Collapsible key={coin.id} className="mb-3">
                <div className="rounded-lg border bg-card overflow-hidden">
                  <div className="flex items-center gap-6 px-3 py-2.5">
                    <CollapsibleTrigger asChild>
                      <button className="flex items-center gap-3 flex-1 min-w-0 text-left">
                        <div className="size-7 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: color }}>
                          <span className="text-[10px] font-bold text-white">{(coin.symbol || coin.name).replace(/[^A-Za-z]/g, "").slice(0, 2).toUpperCase() || "?"}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-semibold text-sm truncate">{coin.name}</span>
                            {coin.symbol && <span className="text-[11px] text-muted-foreground font-mono shrink-0">{coin.symbol}</span>}
                          </div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-xs text-foreground">{coin.quantity.toLocaleString()}개</span>
                            <span className="text-xs text-muted-foreground">·</span>
                            <span className="text-xs font-semibold text-primary">{pct.toFixed(1)}%</span>
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className={`text-sm font-bold tabular-nums ${ASSET_THEME.text.default}`}>{formatShortCurrency(value)}</p>
                          <p className={`text-xs tabular-nums ${getProfitLossColor(profit)}`}>{profit >= 0 ? "+" : ""}{formatShortCurrency(Math.round(profit))}{" "}({profitRate >= 0 ? "+" : ""}{profitRate.toFixed(1)}%)</p>
                        </div>
                      </button>
                    </CollapsibleTrigger>
                    <div className="flex gap-2 flex-shrink-0">
                      <Button size="icon" variant="outline" className="size-8" onClick={() => window.dispatchEvent(new CustomEvent("trigger-edit-crypto", { detail: { id: coin.id } }))}>
                        <Pencil className="size-4" />
                      </Button>
                      <Button size="icon" variant="outline" className="size-8" onClick={() => handleDelete(coin.id)}>
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="h-0.5 w-full bg-muted">
                    <div className="h-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
                  </div>
                  <CollapsibleContent>
                    <div className="border-t divide-y divide-border/50">
                      <div className="grid grid-cols-2 px-4 py-2.5 gap-4 bg-muted/10">
                        <div><p className="text-xs text-muted-foreground">평균단가</p><p className="text-sm font-medium">{formatCurrency(coin.averagePrice)}</p></div>
                        <div><p className="text-xs text-muted-foreground">현재가</p><p className={`text-sm font-semibold`} style={{ color: MAIN_PALETTE[2] }}>{formatCurrency(coin.currentPrice)}</p></div>
                      </div>
                      <div className="px-4 py-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground bg-muted/5">
                        <span className="flex items-center gap-1"><Clock className="size-3" /><span className="font-medium text-foreground">{holdingDays.toLocaleString()}일 보유</span></span>
                        <span className="flex items-center gap-1"><Calendar className="size-3" /><span className="font-medium text-foreground">{coin.purchaseDate} 매수</span></span>
                        {coin.description && <span className="w-full text-primary truncate"># {coin.description}</span>}
                      </div>
                    </div>
                  </CollapsibleContent>
                </div>
              </Collapsible>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── 현금 탭 ──────────────────────────────────────────────────────────────────
const CASH_TYPE_COLORS: Record<string, string> = {
  deposit: MAIN_PALETTE[0],
  savings: MAIN_PALETTE[4],
  bank: MAIN_PALETTE[5],
  cma: MAIN_PALETTE[6],
  cash: MAIN_PALETTE[3],
};

function CashTab() {
  const { assetData, deleteCash, getAssetSummary, exchangeRates } = useAssetData();
  const summary = getAssetSummary();

  const getMultiplier = (currency?: string) => {
    if (currency === "USD") return exchangeRates.USD;
    if (currency === "JPY") return exchangeRates.JPY / 100;
    return 1;
  };

  const totalValue = summary.cashValue;

  const cashTypeData = cashTypes
    .map(({ value: type, label }) => {
      const items = assetData.cash.filter((c) => c.type === type);
      const value = items.reduce((sum, c) => sum + c.balance * getMultiplier(c.currency), 0);
      return { type, label, value };
    })
    .filter((d) => d.value > 0);

  const sorted = [...assetData.cash]
    .map((item) => ({ item, value: item.balance * getMultiplier(item.currency) }))
    .filter((d) => d.value > 0)
    .sort((a, b) => b.value - a.value);

  const handleDelete = (id: string) => {
    if (confirm("정말 삭제하시겠습니까?")) { deleteCash(id); toast.success("삭제되었습니다."); }
  };

  const formatCurrencyDisplay = (value: number, currency = "KRW") => {
    if (currency === "USD") return `$${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
    if (currency === "JPY") return `¥${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
    return formatCurrency(value);
  };

  return (
    <div className="space-y-4 mt-2">
      <div className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground font-semibold">총 현금성 자산</p>
          <p className={`text-2xl font-extrabold tabular-nums ${ASSET_THEME.important}`}>{formatShortCurrency(totalValue)}</p>
          <p className="text-[11px] text-foreground">{formatCurrency(totalValue)}</p>
        </div>
        <div className="text-right space-y-1">
          {cashTypeData.map((d) => (
            <div key={d.type} className="text-xs">
              <span className="text-muted-foreground">{d.label} </span>
              <span className={`font-bold ${ASSET_THEME.text.default}`}>{formatShortCurrency(d.value)}</span>
            </div>
          ))}
        </div>
      </div>

      {cashTypeData.length > 0 && totalValue > 0 && (
        <div className="space-y-2">
          <div className="flex h-6 w-full rounded-full overflow-hidden gap-px">
            {cashTypeData.map(({ type, label, value: v }) => {
              const pct = (v / totalValue) * 100;
              const color = CASH_TYPE_COLORS[type] ?? MAIN_PALETTE[8];
              return (
                <div key={type} className="flex items-center justify-center overflow-hidden transition-all" style={{ width: `${pct}%`, backgroundColor: color }} title={`${label}: ${pct.toFixed(1)}%`}>
                  {pct > 8 && <span className="text-white text-[10px] font-bold drop-shadow select-none px-0.5 truncate">{pct.toFixed(0)}%</span>}
                </div>
              );
            })}
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            {cashTypeData.map(({ type, label, value: v }) => {
              const pct = (v / totalValue) * 100;
              const color = CASH_TYPE_COLORS[type] ?? MAIN_PALETTE[8];
              return (
                <div key={type} className="flex items-center gap-1">
                  <span className="size-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                  <span className="text-xs text-foreground">{label}</span>
                  <span className="text-xs font-bold text-muted-foreground">{pct.toFixed(1)}%</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {sorted.length === 0 ? (
        <div className="flex h-36 items-center justify-center rounded-lg border border-dashed">
          <p className="text-muted-foreground text-sm">등록된 현금성 자산이 없습니다.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {sorted.map(({ item, value }, idx) => {
            const pct = totalValue > 0 ? (value / totalValue) * 100 : 0;
            const color = CASH_TYPE_COLORS[item.type] ?? MAIN_PALETTE[idx % 5];
            const typeLabel = cashTypes.find((t) => t.value === item.type)?.label ?? item.type;
            const linkedLoans = assetData.loans.filter((l) => l.linkedCashId === item.id);
            return (
              <Collapsible key={item.id} className="mb-3">
                <div className="rounded-lg border bg-card overflow-hidden">
                  <div className="flex items-center gap-6 px-3 py-2.5">
                    <CollapsibleTrigger asChild>
                      <button className="flex items-center gap-3 flex-1 min-w-0 text-left">
                        <div className="size-7 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: color }}>
                          <Banknote className="size-4 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-semibold text-sm truncate">{item.name}</span>
                            <Badge variant="outline" className={`${ASSET_THEME.categoryBox} text-[10px] px-1.5 py-0`}>{typeLabel}</Badge>
                            {item.institution && <span className="text-xs text-muted-foreground shrink-0">({item.institution})</span>}
                          </div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-xs font-semibold text-primary">{pct.toFixed(1)}%</span>
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className={`text-sm font-bold tabular-nums ${ASSET_THEME.text.default}`}>{formatShortCurrency(value)}</p>
                          {item.currency !== "KRW" && <p className="text-xs text-muted-foreground">{formatCurrencyDisplay(item.balance, item.currency)}</p>}
                        </div>
                      </button>
                    </CollapsibleTrigger>
                    <div className="flex gap-2 flex-shrink-0">
                      <Button size="icon" variant="outline" className="size-8" onClick={() => window.dispatchEvent(new CustomEvent("trigger-edit-cash", { detail: { id: item.id } }))}>
                        <Pencil className="size-4" />
                      </Button>
                      <Button size="icon" variant="outline" className="size-8" onClick={() => handleDelete(item.id)}>
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="h-0.5 w-full bg-muted">
                    <div className="h-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
                  </div>
                  <CollapsibleContent>
                    <div className="border-t divide-y divide-border/50">
                      {linkedLoans.length > 0 && (
                        <div className="px-4 py-2.5 space-y-1.5 bg-muted/10">
                          <p className="text-[11px] font-semibold text-muted-foreground">예금담보대출</p>
                          {linkedLoans.map((loan) => (
                            <div key={loan.id} className={ASSET_THEME.liabilityBadge}>
                              <div className="flex items-center gap-1.5 min-w-0">
                                <CreditCard className="size-3 text-muted-foreground flex-shrink-0" />
                                <span className="text-muted-foreground truncate">{loan.name}</span>
                              </div>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                <span className={`font-semibold tabular-nums ${ASSET_THEME.liability}`}>-{formatShortCurrency(loan.balance)}</span>
                                <span className="text-muted-foreground">{loan.interestRate}%</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      {item.description && <div className="px-4 py-2 text-xs text-primary bg-muted/5"># {item.description}</div>}
                    </div>
                  </CollapsibleContent>
                </div>
              </Collapsible>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── 대출 탭 ──────────────────────────────────────────────────────────────────
const LOAN_TYPE_COLORS: Record<string, string> = {
  "credit": MAIN_PALETTE[1],
  "minus": MAIN_PALETTE[2],
  "mortgage-home": MAIN_PALETTE[0],
  "mortgage-stock": MAIN_PALETTE[9],
  "mortgage-insurance": MAIN_PALETTE[3],
  "mortgage-deposit": MAIN_PALETTE[4],
  "mortgage-other": MAIN_PALETTE[8],
};

function LoanTab() {
  const { assetData, deleteLoan, getAssetSummary } = useAssetData();
  const summary = getAssetSummary();
  const totalBalance = summary.loanBalance;

  const loanTypeBarItems = loanTypes
    .map(({ value: type, shortLabel: label }) => {
      const total = assetData.loans.filter((l) => l.type === type).reduce((s, l) => s + l.balance, 0);
      return { type, label, value: total, color: LOAN_TYPE_COLORS[type] ?? MAIN_PALETTE[8] };
    })
    .filter((d) => d.value > 0);

  const sorted = [...assetData.loans]
    .filter((l) => l.balance > 0)
    .sort((a, b) => {
      const typeOrder = loanTypeOrder.indexOf(a.type) - loanTypeOrder.indexOf(b.type);
      return typeOrder !== 0 ? typeOrder : b.balance - a.balance;
    });

  const formatDaysToYMD = (days: number): string => {
    const years = Math.floor(days / 365);
    const months = Math.floor((days % 365) / 30);
    const d = days - years * 365 - months * 30;
    const parts = [];
    if (years > 0) parts.push(`${years}년`);
    if (months > 0) parts.push(`${months}개월`);
    if (d > 0 || parts.length === 0) parts.push(`${d}일`);
    return parts.join(" ");
  };

  const handleDelete = (id: string) => {
    if (confirm("정말 삭제하시겠습니까?")) { deleteLoan(id); toast.success("삭제되었습니다."); }
  };

  return (
    <div className="space-y-4 mt-2">
      <div className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground font-semibold">총 대출 잔액</p>
          <p className={`text-2xl font-extrabold tabular-nums ${ASSET_THEME.liability}`}>{formatShortCurrency(totalBalance)}</p>
          <p className="text-[11px] text-foreground">{formatCurrency(totalBalance)}</p>
        </div>
        <div className="text-right space-y-1">
          {loanTypeBarItems.map((d) => (
            <div key={d.type} className="text-xs">
              <span className="text-muted-foreground">{d.label} </span>
              <span className={`font-bold ${ASSET_THEME.text.default}`}>{formatShortCurrency(d.value)}</span>
            </div>
          ))}
        </div>
      </div>

      {loanTypeBarItems.length > 0 && totalBalance > 0 && (
        <div className="space-y-2">
          <div className="flex h-6 w-full rounded-full overflow-hidden gap-px">
            {loanTypeBarItems.map(({ type, label, value: v, color }) => {
              const pct = (v / totalBalance) * 100;
              return (
                <div key={type} className="flex items-center justify-center overflow-hidden transition-all" style={{ width: `${pct}%`, backgroundColor: color }} title={`${label}: ${pct.toFixed(1)}%`}>
                  {pct > 8 && <span className="text-white text-[10px] font-bold drop-shadow select-none px-0.5 truncate">{pct.toFixed(0)}%</span>}
                </div>
              );
            })}
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            {loanTypeBarItems.map(({ type, label, value: v, color }) => {
              const pct = (v / totalBalance) * 100;
              return (
                <div key={type} className="flex items-center gap-1">
                  <span className="size-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                  <span className="text-xs text-foreground">{label}</span>
                  <span className="text-xs font-bold text-muted-foreground">{pct.toFixed(1)}%</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {sorted.length === 0 ? (
        <div className="flex h-36 items-center justify-center rounded-lg border border-dashed">
          <p className="text-muted-foreground text-sm">등록된 대출이 없습니다.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {sorted.map((loan, idx) => {
            const pct = totalBalance > 0 ? (loan.balance / totalBalance) * 100 : 0;
            const color = LOAN_TYPE_COLORS[loan.type] ?? MAIN_PALETTE[idx % 5];
            const typeLabel = loanTypes.find((t) => t.value === loan.type)?.label ?? loan.type;
            const daysElapsed = calculateHoldingDays(loan.startDate);
            const daysRemaining = loan.endDate ? calculateHoldingDays(loan.endDate) : null;
            const linkedRealEstate = loan.linkedRealEstateId ? assetData.realEstate.find((re) => re.id === loan.linkedRealEstateId) : null;
            const linkedStock = loan.linkedStockId ? assetData.stocks.find((s) => s.id === loan.linkedStockId) : null;
            const linkedCash = loan.linkedCashId ? assetData.cash.find((c) => c.id === loan.linkedCashId) : null;
            return (
              <Collapsible key={loan.id} className="mb-3">
                <div className="rounded-lg border bg-card overflow-hidden">
                  <div className="flex items-center gap-6 px-3 py-2.5">
                    <CollapsibleTrigger asChild>
                      <button className="flex items-center gap-3 flex-1 min-w-0 text-left">
                        <div className="size-7 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: color }}>
                          <CreditCard className="size-4 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-semibold text-sm truncate">{loan.name}</span>
                            <Badge variant="outline" className={`${ASSET_THEME.categoryBox} text-[10px] px-1.5 py-0`}>{typeLabel}</Badge>
                            {loan.institution && <span className="text-xs text-muted-foreground shrink-0">({loan.institution})</span>}
                          </div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-xs text-muted-foreground">금리 {loan.interestRate}%</span>
                            <span className="text-xs text-muted-foreground">·</span>
                            <span className="text-xs font-semibold text-primary">{pct.toFixed(1)}%</span>
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className={`text-sm font-bold tabular-nums ${ASSET_THEME.liability}`}>-{formatShortCurrency(loan.balance)}</p>
                        </div>
                      </button>
                    </CollapsibleTrigger>
                    <div className="flex gap-2 flex-shrink-0">
                      <Button size="icon" variant="outline" className="size-8" onClick={() => window.dispatchEvent(new CustomEvent("trigger-edit-loan", { detail: { id: loan.id } }))}>
                        <Pencil className="size-4" />
                      </Button>
                      <Button size="icon" variant="outline" className="size-8" onClick={() => handleDelete(loan.id)}>
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="h-0.5 w-full bg-muted">
                    <div className="h-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
                  </div>
                  <CollapsibleContent>
                    <div className="border-t divide-y divide-border/50">
                      <div className="grid grid-cols-2 px-4 py-2.5 gap-4 bg-muted/10">
                        <div>
                          <p className="text-xs text-muted-foreground">대출일</p>
                          <p className="text-sm font-medium">{loan.startDate}</p>
                          <p className="text-[11px] text-muted-foreground">{formatDaysToYMD(daysElapsed)} 경과</p>
                        </div>
                        {loan.endDate && (
                          <div>
                            <p className="text-xs text-muted-foreground">만기일</p>
                            <p className={`text-sm font-semibold ${ASSET_THEME.primary.text}`}>{loan.endDate}</p>
                            {daysRemaining !== null && <p className="text-[11px] text-muted-foreground">{formatDaysToYMD(daysRemaining)} 남음</p>}
                          </div>
                        )}
                      </div>
                      {linkedRealEstate && (
                        <div className="flex items-center gap-2 px-4 py-2 text-xs bg-primary/5">
                          <MapPin className="size-3 text-primary flex-shrink-0" />
                          <span className="text-muted-foreground">연계 부동산</span>
                          <span className="font-medium text-primary truncate">{linkedRealEstate.name}</span>
                        </div>
                      )}
                      {linkedStock && (
                        <div className="flex items-center gap-2 px-4 py-2 text-xs bg-primary/5">
                          <TrendingUp className="size-3 text-primary flex-shrink-0" />
                          <span className="text-muted-foreground">연계 주식</span>
                          <span className="font-medium text-primary truncate">{linkedStock.name}</span>
                          {linkedStock.ticker && <span className="text-muted-foreground">({linkedStock.ticker})</span>}
                        </div>
                      )}
                      {linkedCash && (
                        <div className="flex items-center gap-2 px-4 py-2 text-xs bg-primary/5">
                          <Banknote className="size-3 text-primary flex-shrink-0" />
                          <span className="text-muted-foreground">연계 예금</span>
                          <span className="font-medium text-primary truncate">{linkedCash.name}</span>
                        </div>
                      )}
                      {loan.description && <div className="px-4 py-2 text-xs text-primary bg-muted/5"># {loan.description}</div>}
                    </div>
                  </CollapsibleContent>
                </div>
              </Collapsible>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── 메인 탭 컴포넌트 ─────────────────────────────────────────────────────────
const DETAIL_TABS = [
  { value: "stocks", label: "주식", icon: TrendingUp },
  { value: "real-estate", label: "부동산", icon: Building2 },
  { value: "crypto", label: "암호화폐", icon: Bitcoin },
  { value: "cash", label: "현금", icon: Banknote },
  { value: "loans", label: "대출", icon: CreditCard },
] as const;

export function AssetDetailTabs() {
  const [activeTab, setActiveTab] = useState("stocks");

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab}>
      <TabsList className={NAV_LIST}>
        {DETAIL_TABS.map(({ value, label, icon: Icon }) => (
          <TabsTrigger key={value} value={value} className={NAV_TRIGGER}>
            <Icon className="size-3 shrink-0" />
            {label}
          </TabsTrigger>
        ))}
      </TabsList>

      <TabsContent value="stocks" forceMount className="data-[state=inactive]:hidden">
        <StockTab />
      </TabsContent>
      <TabsContent value="real-estate" forceMount className="data-[state=inactive]:hidden">
        <RealEstateTab />
      </TabsContent>
      <TabsContent value="crypto" forceMount className="data-[state=inactive]:hidden">
        <CryptoTab />
      </TabsContent>
      <TabsContent value="cash" forceMount className="data-[state=inactive]:hidden">
        <CashTab />
      </TabsContent>
      <TabsContent value="loans" forceMount className="data-[state=inactive]:hidden">
        <LoanTab />
      </TabsContent>
    </Tabs>
  );
}
