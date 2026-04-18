"use client";

import React from "react";
import { Building2, TrendingUp, Bitcoin, Banknote, CreditCard, Wallet, ChevronRight, Home, MapPin, Store, TreePine, Landmark } from "lucide-react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartConfig } from "@/components/ui/chart";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAssetData } from "@/contexts/asset-data-context";
import { formatCurrency, formatShortCurrency, calculateHoldingDays } from "@/lib/number-utils";
import { ASSET_THEME, getProfitLossColor } from "@/config/theme";
import { cashTypes, loanTypes, loanTypeOrder, stockCategories, realEstateTypes } from "@/config/asset-options";
import { useIsMobile } from "@/hooks/use-mobile";

const assetDistributionChartConfig = {
  realEstate: {
    label: "부동산",
  },
  stocks: {
    label: "주식",
  },
  crypto: {
    label: "암호화폐",
  },
  cash: {
    label: "현금",
  },
  loans: {
    label: "대출",
  },
  tenantDeposit: {
    label: "임차인보증금",
  },
} as ChartConfig;

// 색상 상수는 theme.ts의 ASSET_THEME.categoryColors 에서 중앙 관리

const CATEGORY_ICON_MAP: Record<string, React.ElementType> = {
  realEstate: Building2,
  stocks: TrendingUp,
  crypto: Bitcoin,
  cash: Banknote,
  loans: CreditCard,
  tenantDeposit: Wallet,
};

// 대출 ChartConfig - loanTypes에서 자동 생성
const loanTypeChartConfig: ChartConfig = {
  balance: { label: "대출잔액" },
  ...Object.fromEntries(loanTypes.map((t) => [t.value, { label: t.shortLabel }])),
};

const MOBILE_DISTRIBUTION_TABS = [
  { value: "distribution", label: "자산 분포" },
  { value: "stockCrypto", label: "금융자산" },
  { value: "realEstate", label: "부동산" },
  { value: "loans", label: "대출" },
] as const;

// 부동산 유형별 메타 (아이콘·색상은 UI 전용)
const REAL_ESTATE_TYPE_META: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  apartment: { label: realEstateTypes.find((t) => t.value === "apartment")!.label, icon: Building2, color: ASSET_THEME.realEstateTypeColors.apartment },
  house: { label: realEstateTypes.find((t) => t.value === "house")!.label, icon: Home, color: ASSET_THEME.realEstateTypeColors.house },
  land: { label: realEstateTypes.find((t) => t.value === "land")!.label, icon: TreePine, color: ASSET_THEME.realEstateTypeColors.land },
  commercial: { label: realEstateTypes.find((t) => t.value === "commercial")!.label, icon: Store, color: ASSET_THEME.realEstateTypeColors.commercial },
  other: { label: realEstateTypes.find((t) => t.value === "other")!.label, icon: Landmark, color: ASSET_THEME.realEstateTypeColors.other },
};

export function AssetDistributionCards() {
  const { assetData, getAssetSummary, exchangeRates } = useAssetData();
  const summary = getAssetSummary();
  const isMobile = useIsMobile();

  const getMultiplier = (currency?: string) => {
    if (currency === "USD") return exchangeRates.USD;
    if (currency === "JPY") return exchangeRates.JPY / 100;
    return 1;
  };

  // 자산(+)과 부채(-) 모두 포함한 분포
  const assetDistributionData = [
    {
      category: "realEstate",
      value: summary.realEstateValue,
      type: "asset" as const,
    },
    {
      category: "stocks",
      value: summary.stockValue,
      type: "asset" as const,
    },
    {
      category: "crypto",
      value: summary.cryptoValue,
      type: "asset" as const,
    },
    {
      category: "cash",
      value: summary.cashValue,
      type: "asset" as const,
    },
    {
      category: "loans",
      value: summary.loanBalance,
      type: "liability" as const,
    },
    {
      category: "tenantDeposit",
      value: summary.tenantDepositTotal,
      type: "liability" as const,
    },
  ].filter((item) => item.value > 0);

  // 대출 종류 라벨 맵 - loanTypes에서 자동 생성
  const loanTypeLabels: Record<string, string> = Object.fromEntries(
    loanTypes.map((t) => [t.value, t.shortLabel])
  );

  // 주식 카테고리별 분류
  const stockCategoryData = stockCategories
    .map((cat) => {
      const stocks = assetData.stocks.filter((s) => s.category === cat.value);
      const value = stocks.reduce((sum, s) => sum + s.quantity * s.currentPrice * getMultiplier(s.currency), 0);
      return { category: cat.value, label: cat.shortLabel, value, fill: ASSET_THEME.delimiterColor };
    })
    .filter((item) => item.value > 0);

  const loanTypeData = assetData.loans
    .map((loan) => ({
      type: loan.type,
      label: loanTypeLabels[loan.type] || loan.type,
      balance: loan.balance,
      name: loan.name,
      interestRate: loan.interestRate,
      description: loan.description,
      fill: loanTypeChartConfig[loan.type]?.color || "var(--chart-1)",
    }))
    .filter((item) => item.balance > 0)
    .sort((a, b) => {
      const typeOrder = loanTypeOrder.indexOf(a.type) - loanTypeOrder.indexOf(b.type);
      if (typeOrder !== 0) return typeOrder;
      return b.balance - a.balance;
    });

  const cryptoDistributionData = assetData.crypto
    .map((coin) => {
      const coinValue = coin.quantity * coin.currentPrice;
      const coinCost = coin.quantity * coin.averagePrice;
      const profit = coinValue - coinCost;
      const profitRate = coinCost > 0 ? (profit / coinCost) * 100 : 0;
      return { coin, coinValue, coinCost, profit, profitRate };
    })
    .filter((item) => item.coinValue > 0)
    .sort((a, b) => b.coinValue - a.coinValue);

  // 암호화폐 색상은 theme.ts의 ASSET_THEME.cryptoColors 에서 중앙 관리

  const formatHoldingPeriod = (days: number): string => {
    const years = Math.floor(days / 365);
    const months = Math.floor((days % 365) / 30);
    if (years > 0 && months > 0) return `${years}년 ${months}개월`;
    if (years > 0) return `${years}년`;
    if (months > 0) return `${months}개월`;
    return `${days}일`;
  };

  // 현금 유형별 분류 - cashTypes에서 자동 생성
  const cashTypeData = cashTypes
    .map(({ value: type, label }) => {
      const items = assetData.cash.filter((c) => c.type === type);
      const value = items.reduce((sum, c) => sum + c.balance * getMultiplier(c.currency), 0);
      return { type, label, items, value };
    })
    .filter((d) => d.value > 0);

  const sortedCardKeys = [
    { key: "stockCrypto", value: summary.stockValue + summary.cryptoValue + summary.cashValue },
    { key: "realEstate", value: summary.realEstateValue },
    { key: "loans", value: summary.loanBalance },
  ].sort((a, b) => b.value - a.value);

  if (isMobile === undefined) {
    return <div className="flex flex-col w-full gap-6" />;
  }

  const distributionCard = (
    <Card className={`${ASSET_THEME.distributionCard.bg} ${ASSET_THEME.distributionCard.border} h-fit gap-2 sm:gap-4`}>
      <CardHeader className="pb-2">
        <CardTitle className={ASSET_THEME.primary.text}>자산 분포</CardTitle>
      </CardHeader>
      <CardContent className="pb-2 overflow-hidden px-3 sm:px-6">
        {assetDistributionData.length === 0 ? (
          <div className={`flex h-48 items-center justify-center ${ASSET_THEME.distributionCard.muted}`}>
            <p>등록된 자산이 없습니다.</p>
          </div>
        ) : (() => {
          const assetItems = assetDistributionData.filter(d => d.type === "asset").sort((a, b) => b.value - a.value);
          const liabilityItems = assetDistributionData.filter(d => d.type === "liability").sort((a, b) => b.value - a.value);
          const totalAsset = assetItems.reduce((s, d) => s + d.value, 0);
          const totalLiability = liabilityItems.reduce((s, d) => s + d.value, 0);
          const grossTotal = totalAsset + totalLiability;

          return (
            <div className="space-y-5 pb-2">
              {/* 순자산 요약 */}
              <div className={`flex items-center justify-between rounded-lg ${ASSET_THEME.distributionCard.sectionBg} border ${ASSET_THEME.distributionCard.sectionBorder} px-4 py-3`}>
                <div>
                  <p className={`text-xs font-semibold ${ASSET_THEME.text.muted}`}>순자산</p>
                  <p className={`text-2xl font-extrabold tabular-nums ${ASSET_THEME.important}`}>
                    {formatShortCurrency(summary.netAsset)}
                  </p>
                  <p className={`text-[11px] ${ASSET_THEME.text.default}`}>{formatCurrency(summary.netAsset)}</p>
                </div>
                <div className="text-right space-y-1.5">
                  <div className="text-xs">
                    <span className={ASSET_THEME.distributionCard.muted}>총 자산 </span>
                    <span className={`font-bold ${ASSET_THEME.text.default}`}>{formatShortCurrency(totalAsset)}</span>
                  </div>
                  <div className="text-xs">
                    <span className={ASSET_THEME.distributionCard.muted}>총 부채 </span>
                    <span className={`font-bold ${ASSET_THEME.liability}`}>{formatShortCurrency(totalLiability)}</span>
                  </div>
                </div>
              </div>

              {/* 자산 vs 부채 전체 비율 바 */}
              <div className="space-y-1.5">
                <p className={`text-xs font-semibold ${ASSET_THEME.text.muted}`}>자산 / 부채 비율</p>
                <div className="flex h-5 w-full rounded-full overflow-hidden gap-px">
                  <div
                    className="flex items-center justify-center transition-all"
                    style={{ width: `${(totalAsset / grossTotal) * 100}%`, backgroundColor: ASSET_THEME.categoryColors.realEstate }}
                    title={`자산 ${((totalAsset / grossTotal) * 100).toFixed(1)}%`}
                  >
                    <span className="text-white text-[10px] font-bold drop-shadow select-none">
                      {((totalAsset / grossTotal) * 100).toFixed(0)}%
                    </span>
                  </div>
                  {totalLiability > 0 && (
                    <div
                      className="flex items-center justify-center transition-all"
                      style={{ width: `${(totalLiability / grossTotal) * 100}%`, backgroundColor: ASSET_THEME.categoryColors.loans }}
                      title={`부채 ${((totalLiability / grossTotal) * 100).toFixed(1)}%`}
                    >
                      <span className="text-white text-[10px] font-bold drop-shadow select-none">
                        {((totalLiability / grossTotal) * 100).toFixed(0)}%
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* 자산 구성 바 */}
              {assetItems.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className={`font-semibold ${ASSET_THEME.text.muted}`}>총 자산 구성</span>
                    <span className={`font-bold tabular-nums ${ASSET_THEME.primary.text}`}>{formatShortCurrency(totalAsset)}</span>
                  </div>
                  <div className="flex h-8 w-full rounded-xl overflow-hidden gap-px">
                    {assetItems.map(item => {
                      const pct = (item.value / totalAsset) * 100;
                      return (
                        <div
                          key={item.category}
                          className="relative flex items-center justify-center overflow-hidden cursor-default hover:opacity-85 transition-opacity"
                          style={{ width: `${pct}%`, backgroundColor: ASSET_THEME.categoryColors[item.category as keyof typeof ASSET_THEME.categoryColors] ?? "#64748b" }}
                          title={`${assetDistributionChartConfig[item.category]?.label}: ${formatShortCurrency(item.value)} (${pct.toFixed(1)}%)`}
                        >
                          {pct > 10 && (
                            <span className="text-white text-[10px] font-bold drop-shadow select-none px-1 truncate">
                              {pct.toFixed(0)}%
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-1.5">
                    {assetItems.map(item => {
                      const pct = (item.value / totalAsset) * 100;
                      const Icon = CATEGORY_ICON_MAP[item.category];
                      return (
                        <div key={item.category} className="flex items-center gap-1">
                          <span className="size-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: ASSET_THEME.categoryColors[item.category as keyof typeof ASSET_THEME.categoryColors] ?? "#64748b" }} />
                          {Icon && <Icon className="size-3 text-zinc-500 flex-shrink-0" />}
                          <span className="text-xs text-zinc-600 dark:text-zinc-300">{assetDistributionChartConfig[item.category]?.label}</span>
                          <span className={`text-xs font-bold tabular-nums ${ASSET_THEME.primary.text}`}>{pct.toFixed(1)}%</span>
                          <span className={`text-xs tabular-nums ${ASSET_THEME.value}`}>(<span>{formatShortCurrency(item.value)}</span>)</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 부채 구성 바 */}
              {liabilityItems.length > 0 && totalLiability > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className={`font-semibold ${ASSET_THEME.text.muted}`}>총 부채 구성</span>
                    <span className={`font-bold tabular-nums ${ASSET_THEME.liability}`}>{formatShortCurrency(totalLiability)}</span>
                  </div>
                  <div className="flex h-8 w-full rounded-xl overflow-hidden gap-px">
                    {liabilityItems.map(item => {
                      const pct = (item.value / totalLiability) * 100;
                      return (
                        <div
                          key={item.category}
                          className="relative flex items-center justify-center overflow-hidden cursor-default hover:opacity-85 transition-opacity"
                          style={{ width: `${pct}%`, backgroundColor: ASSET_THEME.categoryColors[item.category as keyof typeof ASSET_THEME.categoryColors] ?? "#64748b" }}
                          title={`${assetDistributionChartConfig[item.category]?.label}: ${formatShortCurrency(item.value)} (${pct.toFixed(1)}%)`}
                        >
                          {pct > 10 && (
                            <span className="text-white text-[10px] font-bold drop-shadow select-none px-1 truncate">
                              {pct.toFixed(0)}%
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-1.5">
                    {liabilityItems.map(item => {
                      const pct = (item.value / totalLiability) * 100;
                      const Icon = CATEGORY_ICON_MAP[item.category];
                      return (
                        <div key={item.category} className="flex items-center gap-1">
                          <span className="size-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: ASSET_THEME.categoryColors[item.category as keyof typeof ASSET_THEME.categoryColors] ?? "#64748b" }} />
                          {Icon && <Icon className="size-3 text-zinc-500 flex-shrink-0" />}
                          <span className="text-xs text-zinc-600 dark:text-zinc-300">{assetDistributionChartConfig[item.category]?.label}</span>
                          <span className={`text-xs font-bold tabular-nums ${ASSET_THEME.liability}`}>{pct.toFixed(1)}%</span>
                          <span className={`text-xs tabular-nums ${ASSET_THEME.value}`}>({formatShortCurrency(item.value)})</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })()}
      </CardContent>
      <CardFooter>
        <p className={`${ASSET_THEME.distributionCard.muted} text-xs`}>
          마지막 업데이트: {assetData.lastUpdated && !Number.isNaN(new Date(assetData.lastUpdated).getTime()) ? new Date(assetData.lastUpdated).toLocaleString("ko-KR") : ""}
        </p>
      </CardFooter>
    </Card>
  );

  const getCardByKey = (key: string): React.ReactNode => {
    if (key === "stockCrypto") return (
      <Card key={key}>
        <CardHeader>
          <CardTitle className={ASSET_THEME.primary.text}>금융자산 현황</CardTitle>
          <CardDescription>주식, 암호화폐, 현금성 자산 현황</CardDescription>
        </CardHeader>
        <CardContent className="overflow-hidden pb-2">
          <div className="space-y-4">
            {/* 금융자산 총액 */}
            <div className="rounded-lg border border-primary/30 bg-primary/5 px-4 py-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className={`text-xs font-semibold ${ASSET_THEME.text.muted}`}>금융자산 총액</p>
                  <p className={`text-2xl font-extrabold tabular-nums ${ASSET_THEME.important}`}>
                    {formatShortCurrency(summary.stockValue + summary.cryptoValue + summary.cashValue)}
                  </p>
                  <p className="text-[11px] text-foreground">{formatCurrency(summary.stockValue + summary.cryptoValue + summary.cashValue)}</p>
                </div>
                <div className="text-right space-y-1">
                  {summary.stockValue > 0 && (
                    <div className="text-xs">
                      <span className="text-muted-foreground">주식 </span>
                      <span className={`font-bold ${ASSET_THEME.primary.text}`}>{formatShortCurrency(summary.stockValue)}</span>
                    </div>
                  )}
                  {summary.cryptoValue > 0 && (
                    <div className="text-xs">
                      <span className="text-muted-foreground">암호화폐 </span>
                      <span className={`font-bold ${ASSET_THEME.primary.text}`}>{formatShortCurrency(summary.cryptoValue)}</span>
                    </div>
                  )}
                  {summary.cashValue > 0 && (
                    <div className="text-xs">
                      <span className="text-muted-foreground">현금성 </span>
                      <span className={`font-bold ${ASSET_THEME.primary.text}`}>{formatShortCurrency(summary.cashValue)}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="h-px flex-1 bg-border" />
              <span className={`flex items-center gap-1.5 text-xs font-semibold ${ASSET_THEME.primary.text} bg-primary/10 rounded-full px-3 py-1`}>
                <TrendingUp className="size-3.5" />
                주식 분포
              </span>
              <div className="h-px flex-1 bg-border" />
            </div>

            {stockCategoryData.length === 0 ? (
              <div className="flex h-32 items-center justify-center text-muted-foreground">
                <p>등록된 주식이 없습니다.</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-semibold ${ASSET_THEME.text.muted}`}>총 주식 평가금액</span>
                    <span className={`text-xl font-bold tabular-nums ${ASSET_THEME.important}`}>
                      {formatShortCurrency(summary.stockValue)}
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-foreground">{formatCurrency(summary.stockValue)}</div>
                  {summary.stockFxProfit !== 0 && (
                    <div className="mt-2 flex items-center justify-between border-t border-primary/10 pt-2">
                      <span className={`text-xs font-semibold ${ASSET_THEME.text.muted}`}>평가손익 합계 (환차손익 포함)</span>
                      <span className={`text-sm font-bold tabular-nums ${getProfitLossColor(summary.stockFxProfit)}`}>
                        {summary.stockFxProfit >= 0 ? "+" : ""}{formatShortCurrency(Math.round(summary.stockFxProfit))}
                        {summary.stockCost > 0 && (
                          <span className="ml-1 text-xs font-medium">
                            ({summary.stockFxProfit >= 0 ? "+" : ""}{((summary.stockFxProfit / summary.stockCost) * 100).toFixed(2)}%)
                          </span>
                        )}
                      </span>
                    </div>
                  )}
                  {summary.stockCurrencyGain !== 0 && (
                    <div className="mt-1 flex items-center justify-between">
                      <span className={`text-xs ${ASSET_THEME.text.muted}`}>└ 전체 환차손익</span>
                      <span className={`text-xs font-semibold tabular-nums ${getProfitLossColor(summary.stockCurrencyGain)}`}>
                        {summary.stockCurrencyGain >= 0 ? "+" : ""}{formatShortCurrency(Math.round(summary.stockCurrencyGain))}
                        {summary.stockCost > 0 && (
                          <span className="ml-1 text-xs font-medium">
                            ({summary.stockCurrencyGain >= 0 ? "+" : ""}{((summary.stockCurrencyGain / summary.stockCost) * 100).toFixed(2)}%)
                          </span>
                        )}
                      </span>
                    </div>
                  )}
                </div>

                <div className="max-h-[500px] space-y-3 overflow-y-auto pr-2">
                  {stockCategoryData.map((item) => {
                    const percentage = (item.value / summary.stockValue) * 100;
                    const categoryStocks = assetData.stocks
                      .filter((s) => s.category === item.category)
                      .sort((a, b) => {
                        const aVal = a.quantity * a.currentPrice * getMultiplier(a.currency);
                        const bVal = b.quantity * b.currentPrice * getMultiplier(b.currency);
                        return bVal - aVal;
                      });

                    return (
                      <Collapsible key={item.category}>
                        <div className="space-y-1.5">
                          <CollapsibleTrigger className="w-full">
                            <div className="flex items-center justify-between text-sm hover:bg-muted/50 rounded-lg p-2 transition-colors">
                              <div className="flex items-center gap-2">
                                <ChevronRight className="size-4 transition-transform [[data-state=open]>&]:rotate-90" />
                                <span className="size-3 flex-shrink-0 rounded-full" style={{ background: item.fill }} />
                                <span className={`font-medium ${ASSET_THEME.primary.text}`}>{item.label}</span>
                                <span className="text-xs text-muted-foreground">({categoryStocks.length}개)</span>
                              </div>
                              <div className="flex items-center gap-3">
                                <span className="text-xs font-semibold tabular-nums text-muted-foreground">
                                  {percentage.toFixed(1)}%
                                </span>
                                <span className="text-xs font-bold tabular-nums">
                                  {formatShortCurrency(item.value)}
                                </span>
                              </div>
                            </div>
                          </CollapsibleTrigger>
                          <div className="relative h-2 overflow-hidden rounded-full bg-muted">
                            <div
                              className="absolute inset-y-0 left-0 rounded-full transition-all"
                              style={{ background: item.fill }}
                            />
                          </div>
                          <CollapsibleContent className="mt-2 space-y-2 pl-2">
                            {categoryStocks.map((stock) => {
                              const stockValue = stock.quantity * stock.currentPrice * getMultiplier(stock.currency);
                              const stockPercentage = (stockValue / item.value) * 100;
                              const isForeignWithFx = stock.category === "foreign" && stock.currency !== "KRW";
                              const purchaseRate = isForeignWithFx && stock.purchaseExchangeRate && stock.purchaseExchangeRate > 0
                                ? (stock.currency === "JPY" ? stock.purchaseExchangeRate / 100 : stock.purchaseExchangeRate)
                                : getMultiplier(stock.currency);
                              const profit = stockValue - stock.quantity * stock.averagePrice * purchaseRate;
                              const hasCurrencyGain = isForeignWithFx && stock.purchaseExchangeRate && stock.purchaseExchangeRate > 0;
                              const linkedLoans = assetData.loans.filter((l) => l.linkedStockId === stock.id);
                              return (
                                <div key={stock.id} className="rounded-lg bg-muted/30 text-xs overflow-hidden">
                                  <div className="flex items-center justify-between p-2">
                                    <div className="flex items-center gap-2 min-w-0 flex-1">
                                      <span className={`font-medium truncate max-w-[120px] sm:max-w-none ${ASSET_THEME.primary.text}`}>{stock.name}</span>
                                      {stock.ticker && (
                                        <span className="hidden sm:inline text-muted-foreground">({stock.ticker})</span>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-3 whitespace-nowrap">
                                      <span className="text-xs font-semibold tabular-nums text-muted-foreground">
                                        {stockPercentage.toFixed(1)}%
                                      </span>
                                      <span className="font-bold tabular-nums">
                                        {formatShortCurrency(stockValue)}
                                      </span>
                                      <span className={`text-xs font-medium ${getProfitLossColor(profit)}`}>
                                        ({profit >= 0 ? '+' : ''}{formatShortCurrency(profit)})
                                        {hasCurrencyGain && (
                                          <span className="text-[10px] text-muted-foreground ml-0.5">환차포함</span>
                                        )}
                                      </span>
                                    </div>
                                  </div>
                                  {linkedLoans.map((loan) => (
                                    <div key={loan.id} className="flex items-center justify-between border-t border-muted px-2 py-1.5 bg-rose-500/5">
                                      <div className="flex items-center gap-1.5 min-w-0">
                                        <CreditCard className="size-3 text-rose-400 flex-shrink-0" />
                                        <span className="text-muted-foreground truncate">{loan.name}</span>
                                        {loan.institution && (
                                          <span className="hidden sm:inline text-muted-foreground">({loan.institution})</span>
                                        )}
                                      </div>
                                      <div className="flex items-center gap-2 flex-shrink-0">
                                        <span className={`font-semibold tabular-nums ${ASSET_THEME.liability}`}>
                                          -{formatShortCurrency(loan.balance)}
                                        </span>
                                        <span className="text-muted-foreground">{loan.interestRate}%</span>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              );
                            })}
                          </CollapsibleContent>
                        </div>
                      </Collapsible>
                    );
                  })}
                </div>
              </div>
            )}

            {cryptoDistributionData.length > 0 && (
              <div className="mt-6 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="h-px flex-1 bg-border" />
                  <span className={`flex items-center gap-1.5 text-xs font-semibold ${ASSET_THEME.primary.text} bg-primary/10 rounded-full px-3 py-1`}>
                    <Bitcoin className="size-3.5" />
                    암호화폐 분포
                  </span>
                  <div className="h-px flex-1 bg-border" />
                </div>

                <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-semibold ${ASSET_THEME.text.muted}`}>총 암호화폐 평가금액</span>
                    <span className={`text-xl font-bold tabular-nums ${ASSET_THEME.important}`}>
                      {formatShortCurrency(summary.cryptoValue)}
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-foreground">{formatCurrency(summary.cryptoValue)}</div>
                  {summary.cryptoProfit !== 0 && (
                    <div className="mt-2 flex items-center justify-between border-t border-primary/10 pt-2">
                      <span className={`text-xs font-semibold ${ASSET_THEME.text.muted}`}>평가손익 합계</span>
                      <span className={`text-sm font-bold tabular-nums ${getProfitLossColor(summary.cryptoProfit)}`}>
                        {summary.cryptoProfit >= 0 ? "+" : ""}{formatShortCurrency(Math.round(summary.cryptoProfit))}
                        {summary.cryptoCost > 0 && (
                          <span className="ml-1 text-xs font-medium">
                            ({summary.cryptoProfit >= 0 ? "+" : ""}{((summary.cryptoProfit / summary.cryptoCost) * 100).toFixed(2)}%)
                          </span>
                        )}
                      </span>
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  {cryptoDistributionData.length > 0 && (
                    <Collapsible>
                      <div className="space-y-1.5">
                        <CollapsibleTrigger className="w-full">
                          <div className="flex items-center justify-between rounded-lg p-2 text-sm hover:bg-muted/50 transition-colors">
                            <div className="flex items-center gap-2">
                              <ChevronRight className="size-4 transition-transform [[data-state=open]>&]:rotate-90" />
                              <span className="size-3 flex-shrink-0 rounded-full" style={{ backgroundColor: ASSET_THEME.delimiterColor }} />
                              <span className={`font-medium ${ASSET_THEME.primary.text}`}>암호화폐</span>
                              <span className="text-xs text-muted-foreground">({cryptoDistributionData.length}개)</span>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-xs font-semibold tabular-nums text-muted-foreground">
                                100%
                              </span>
                              <span className="text-xs font-bold tabular-nums">
                                {formatShortCurrency(summary.cryptoValue)}
                              </span>
                            </div>
                          </div>
                        </CollapsibleTrigger>
                        <div className="relative h-2 overflow-hidden rounded-full bg-muted">
                          <div
                            className="absolute inset-y-0 left-0 w-full rounded-full transition-all"
                            style={{ backgroundColor: ASSET_THEME.delimiterColor }}
                          />
                        </div>
                        <CollapsibleContent className="mt-2 space-y-2 pl-2">
                          {cryptoDistributionData.map((item) => {
                            const { coin, coinValue, profit } = item;
                            const percentage = summary.cryptoValue > 0 ? (coinValue / summary.cryptoValue) * 100 : 0;
                            return (
                              <div key={coin.id} className="flex items-center justify-between rounded-lg bg-muted/30 p-2 text-xs">
                                <div className="flex items-center gap-2 min-w-0 flex-1">
                                  <span className={`font-medium truncate max-w-[120px] sm:max-w-none ${ASSET_THEME.primary.text}`}>{coin.name}</span>
                                  <span className="hidden sm:inline text-muted-foreground">({coin.symbol})</span>
                                </div>
                                <div className="flex items-center gap-3 whitespace-nowrap">
                                  <span className="text-xs font-semibold tabular-nums text-muted-foreground">
                                    {percentage.toFixed(1)}%
                                  </span>
                                  <span className="font-bold tabular-nums">
                                    {formatShortCurrency(coinValue)}
                                  </span>
                                  <span className={`text-xs font-medium ${getProfitLossColor(profit)}`}>
                                    ({profit >= 0 ? "+" : ""}{formatShortCurrency(profit)})
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </CollapsibleContent>
                      </div>
                    </Collapsible>
                  )}
                </div>
              </div>
            )}
            {cashTypeData.length > 0 && (
              <div className="mt-6 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="h-px flex-1 bg-border" />
                  <span className={`flex items-center gap-1.5 text-xs font-semibold ${ASSET_THEME.primary.text} bg-primary/10 rounded-full px-3 py-1`}>
                    <Banknote className="size-3.5" />
                    현금성 자산 분포
                  </span>
                  <div className="h-px flex-1 bg-border" />
                </div>

                <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-semibold ${ASSET_THEME.text.muted}`}>총 현금성 자산 평가금액</span>
                    <span className={`text-xl font-bold tabular-nums ${ASSET_THEME.important}`}>
                      {formatShortCurrency(summary.cashValue)}
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-foreground">
                    {formatCurrency(summary.cashValue)}
                  </div>
                </div>

                <div className="space-y-3">
                  {cashTypeData.map((typeGroup) => {
                    const percentage = summary.cashValue > 0 ? (typeGroup.value / summary.cashValue) * 100 : 0;
                    return (
                      <Collapsible key={typeGroup.type}>
                        <div className="space-y-1.5">
                          <CollapsibleTrigger className="w-full">
                            <div className="flex items-center justify-between text-sm hover:bg-muted/50 rounded-lg p-2 transition-colors">
                              <div className="flex items-center gap-2">
                                <ChevronRight className="size-4 transition-transform [[data-state=open]>&]:rotate-90" />
                                <span className="size-3 flex-shrink-0 rounded-full" style={{ background: ASSET_THEME.delimiterColor }} />
                                <span className={`font-medium ${ASSET_THEME.primary.text}`}>{typeGroup.label}</span>
                                <span className="text-xs text-muted-foreground">({typeGroup.items.length}개)</span>
                              </div>
                              <div className="flex items-center gap-3">
                                <span className="text-xs font-semibold tabular-nums text-muted-foreground">
                                  {percentage.toFixed(1)}%
                                </span>
                                <span className="text-xs font-bold tabular-nums">
                                  {formatShortCurrency(typeGroup.value)}
                                </span>
                              </div>
                            </div>
                          </CollapsibleTrigger>
                          <div className="relative h-2 overflow-hidden rounded-full bg-muted">
                            <div
                              className="absolute inset-y-0 left-0 rounded-full transition-all"
                              style={{ background: ASSET_THEME.delimiterColor }}
                            />
                          </div>
                          <CollapsibleContent className="mt-2 space-y-2 pl-2">
                            {typeGroup.items.map((cashItem) => {
                              const itemValue = cashItem.balance * getMultiplier(cashItem.currency);
                              const itemPct = typeGroup.value > 0 ? (itemValue / typeGroup.value) * 100 : 0;
                              return (
                                <div key={cashItem.id} className="rounded-lg bg-muted/30 text-xs overflow-hidden">
                                  <div className="flex items-center justify-between p-2">
                                    <div className="flex items-center gap-2 min-w-0 flex-1">
                                      <span className={`font-medium truncate max-w-[120px] sm:max-w-none ${ASSET_THEME.primary.text}`}>{cashItem.name}</span>
                                      {cashItem.institution && (
                                        <span className="hidden sm:inline text-muted-foreground">({cashItem.institution})</span>
                                      )}
                                      {cashItem.currency !== "KRW" && (
                                        <span className="text-muted-foreground">[{cashItem.currency}]</span>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-3 whitespace-nowrap">
                                      <span className="text-xs font-semibold tabular-nums text-muted-foreground">
                                        {itemPct.toFixed(1)}%
                                      </span>
                                      <span className="font-bold tabular-nums">
                                        {formatShortCurrency(itemValue)}
                                      </span>
                                    </div>
                                  </div>
                                  {assetData.loans
                                    .filter((l) => l.linkedCashId === cashItem.id)
                                    .map((loan) => (
                                      <div key={loan.id} className="flex items-center justify-between border-t border-muted px-2 py-1.5 bg-rose-500/5">
                                        <div className="flex items-center gap-1.5 min-w-0">
                                          <CreditCard className="size-3 text-rose-400 flex-shrink-0" />
                                          <span className="text-muted-foreground truncate">{loan.name}</span>
                                          {loan.institution && (
                                            <span className="hidden sm:inline text-muted-foreground">({loan.institution})</span>
                                          )}
                                        </div>
                                        <div className="flex items-center gap-2 flex-shrink-0">
                                          <span className={`font-semibold tabular-nums ${ASSET_THEME.liability}`}>
                                            -{formatShortCurrency(loan.balance)}
                                          </span>
                                          <span className="text-muted-foreground">{loan.interestRate}%</span>
                                        </div>
                                      </div>
                                    ))}
                                </div>
                              );
                            })}
                          </CollapsibleContent>
                        </div>
                      </Collapsible>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </CardContent>
        <CardFooter>
          <p className="text-muted-foreground text-xs">
            주식 <span className="font-bold text-foreground">{summary.stockCount}개</span>
            {summary.cryptoCount > 0 && (
              <> · 암호화폐 <span className="font-bold text-foreground">{summary.cryptoCount}개</span></>
            )}
            {summary.cashCount > 0 && (
              <> · 현금성 <span className="font-bold text-foreground">{summary.cashCount}개</span></>
            )}
            {" "}보유 중
          </p>
        </CardFooter>
      </Card>
    );

    if (key === "realEstate") return (
      <Card key={key}>
        <CardHeader>
          <CardTitle className={ASSET_THEME.primary.text}>부동산 자산 현황</CardTitle>
          <CardDescription>보유 부동산의 매입가 대비 현재 평가금액</CardDescription>
        </CardHeader>
        <CardContent className="pb-2">
          {assetData.realEstate.length === 0 ? (
            <div className="flex h-64 items-center justify-center text-muted-foreground">
              <p>등록된 부동산이 없습니다.</p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="mt-4 rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className={`text-sm font-semibold ${ASSET_THEME.primary.text}`}>총 부동산 평가금액</span>
                  <span className={`text-xl font-bold tabular-nums ${ASSET_THEME.important}`}>
                    {formatShortCurrency(summary.realEstateValue)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">총 매입가액</span>
                  <span className="font-medium tabular-nums text-foreground">{formatShortCurrency(summary.realEstateCost)}</span>
                </div>
                <div className="flex items-center justify-between text-xs border-t border-primary/10 pt-2">
                  <span className="text-muted-foreground">총 평가손익</span>
                  <span className={`font-bold tabular-nums ${getProfitLossColor(summary.realEstateProfit)}`}>
                    {summary.realEstateProfit >= 0 ? "+" : ""}{formatShortCurrency(summary.realEstateProfit)}
                    {summary.realEstateCost > 0 && ` (${summary.realEstateProfit >= 0 ? "+" : ""}${((summary.realEstateProfit / summary.realEstateCost) * 100).toFixed(1)}%)`}
                  </span>
                </div>
              </div>

              {assetData.realEstate.map((item) => {
                const profit = item.currentValue - item.purchasePrice;
                const profitRate = item.purchasePrice > 0 ? (profit / item.purchasePrice) * 100 : 0;
                const holdingDays = calculateHoldingDays(item.purchaseDate);
                const meta = REAL_ESTATE_TYPE_META[item.type] ?? REAL_ESTATE_TYPE_META.other;
                const TypeIcon = meta.icon;
                return (
                  <div key={item.id} className="rounded-lg border p-4 space-y-3 hover:bg-muted/20 transition-colors">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
                        <div
                          className="flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium text-white flex-shrink-0"
                          style={{ backgroundColor: meta.color }}
                        >
                          <TypeIcon className="size-3" />
                          <span>{meta.label}</span>
                        </div>
                        <span className={`font-semibold truncate ${ASSET_THEME.primary.text}`}>{item.name}</span>
                        {(item.tenantDeposit ?? 0) > 0 && (
                          <span className={`text-xs rounded-full px-2 py-0.5 whitespace-nowrap ${ASSET_THEME.liability} bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900`}>
                            보증금 {formatShortCurrency(item.tenantDeposit!)}
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground whitespace-nowrap flex-shrink-0">
                        {formatHoldingPeriod(holdingDays)} 보유
                      </span>
                    </div>

                    {item.address && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <MapPin className="size-3 flex-shrink-0" />
                        <span className="truncate">{item.address}</span>
                      </div>
                    )}

                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="rounded-md bg-muted/30 px-2 py-2">
                        <p className="text-[12px] text-muted-foreground mb-0.5">매입가</p>
                        <p className="text-s font-medium tabular-nums truncate" title={formatCurrency(item.purchasePrice)}>
                          {formatShortCurrency(item.purchasePrice)}
                        </p>
                      </div>
                      <div className="rounded-md bg-muted/30 px-2 py-2">
                        <p className="text-[12px] text-muted-foreground mb-0.5">실거래가</p>
                        <p className={`text-s font-bold tabular-nums truncate ${ASSET_THEME.primary.text}`} title={formatCurrency(item.currentValue)}>
                          {formatShortCurrency(item.currentValue)}
                        </p>
                      </div>
                      <div className="rounded-md bg-muted/30 px-2 py-2">
                        <p className="text-[12px] text-muted-foreground mb-0.5">평가손익</p>
                        <p className={`text-s font-bold tabular-nums truncate ${getProfitLossColor(profit)}`} title={formatCurrency(profit)}>
                          {profit >= 0 ? "+" : ""}{formatShortCurrency(profit)}
                        </p>
                        <p className={`text-[12px] tabular-nums ${getProfitLossColor(profit)}`}>
                          ({profit >= 0 ? "+" : ""}{profitRate.toFixed(1)}%)
                        </p>
                      </div>
                    </div>
                    {(() => {
                      const linkedLoans = assetData.loans.filter((l) => l.linkedRealEstateId === item.id);
                      if (linkedLoans.length === 0) return null;
                      return (
                        <div className="border-t pt-2 space-y-1.5">
                          <p className="text-[11px] font-semibold text-muted-foreground">주택담보대출</p>
                          {linkedLoans.map((loan) => (
                            <div key={loan.id} className="flex items-center justify-between text-xs rounded-md bg-rose-500/5 border border-rose-200/30 dark:border-rose-900/30 px-2.5 py-1.5">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <CreditCard className="size-3 text-rose-400 flex-shrink-0" />
                                <span className="text-muted-foreground truncate">{loan.name}</span>
                                {loan.institution && (
                                  <span className="hidden sm:inline text-muted-foreground">({loan.institution})</span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                <span className={`font-semibold tabular-nums ${ASSET_THEME.liability}`}>
                                  -{formatShortCurrency(loan.balance)}
                                </span>
                                <span className="text-muted-foreground">{loan.interestRate}%</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
        <CardFooter>
          <p className="text-muted-foreground text-xs">총 <span className="font-bold text-foreground">{summary.realEstateCount}개</span> 부동산 보유 중</p>
        </CardFooter>
      </Card>
    );

    return (
      <Card key={key}>
        <CardHeader>
          <CardTitle className={ASSET_THEME.primary.text}>대출 현황</CardTitle>
          <CardDescription>대출 종류별 잔액 및 금리</CardDescription>
        </CardHeader>
        <CardContent className="pb-2">
          {loanTypeData.length === 0 ? (
            <div className="flex h-64 items-center justify-center text-muted-foreground">
              <p>등록된 대출이 없습니다.</p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 dark:border-rose-900 dark:bg-rose-950/30">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-rose-700 dark:text-rose-400">총 대출 잔액</span>
                  <span className={`text-xl font-bold tabular-nums ${ASSET_THEME.liability}`}>
                    {formatShortCurrency(summary.loanBalance)}
                  </span>
                </div>
                <div className="mt-1 text-xs text-foreground">
                  {formatCurrency(summary.loanBalance)}
                </div>
              </div>
              {loanTypeData.map((loan, index) => {
                return (
                  <div key={index} className="flex items-center justify-between gap-4 rounded-lg border p-4">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className={`size-8 flex-shrink-0 rounded-full ${ASSET_THEME.liabilityBg} flex items-center justify-center`}>
                        <span className="text-xs font-bold text-white">
                          <CreditCard className="size-4" />
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className={`font-semibold text-sm truncate ${ASSET_THEME.text.default}`}>{loan.name}</span>
                          <span className="text-xs text-muted-foreground whitespace-nowrap">({loan.label})</span>
                        </div>
                        <div className={`mt-1 text-xs ${ASSET_THEME.liability}`}>
                          {formatCurrency(loan.balance)}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className={`text-xs font-bold tabular-nums ${ASSET_THEME.liability}`}>
                        {formatShortCurrency(loan.balance)}
                      </span>
                      <span className="text-xs font-medium whitespace-nowrap text-muted-foreground">
                        금리 {loan.interestRate.toFixed(2)}%
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
        <CardFooter>
          <p className="text-muted-foreground text-xs">총 <span className="font-bold text-foreground">{assetData.loans.length}건</span> 대출 보유 중</p>
        </CardFooter>
      </Card>
    );
  };

  if (isMobile) {
    return (
      <Tabs defaultValue="distribution" className="w-full">
        <TabsList className="grid w-full grid-cols-4 h-13 p-1 gap-1 mb-0.5">
          {MOBILE_DISTRIBUTION_TABS.map(({ value, label }) => (
            <TabsTrigger
              key={value}
              value={value}
              className={[
                "h-10",
                "bg-muted/60 text-muted-foreground border border-border cursor-pointer transition-all",
                "hover:bg-accent hover:text-foreground hover:border-primary/50",
                "data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:border-primary",
                ASSET_THEME.tabActive,
              ].join(" ")}
            >
              <span className="text-xs">{label}</span>
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="distribution">
          {distributionCard}
        </TabsContent>
        <TabsContent value="stockCrypto">
          {getCardByKey("stockCrypto")}
        </TabsContent>
        <TabsContent value="realEstate">
          {getCardByKey("realEstate")}
        </TabsContent>
        <TabsContent value="loans">
          {getCardByKey("loans")}
        </TabsContent>
      </Tabs>
    );
  }

  return (
    <div className="flex flex-col w-full gap-6 lg:grid lg:grid-cols-2">
      {distributionCard}
      {sortedCardKeys.map(({ key }) => (
        <React.Fragment key={key}>{getCardByKey(key)}</React.Fragment>
      ))}
    </div>
  );
}
