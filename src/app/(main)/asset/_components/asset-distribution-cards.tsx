"use client";

import { Building2, TrendingUp, Bitcoin, Banknote, CreditCard, Wallet, ChevronRight } from "lucide-react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartConfig } from "@/components/ui/chart";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useAssetData } from "@/contexts/asset-data-context";
import { formatCurrency, formatShortCurrency } from "@/lib/number-utils";
import { ASSET_THEME, getProfitLossColor } from "@/config/theme";

const assetDistributionChartConfig = {
  realEstate: {
    label: "부동산",
    color: ASSET_THEME.asset.chart,
  },
  stocks: {
    label: "주식",
    color: ASSET_THEME.asset.chart,
  },
  crypto: {
    label: "암호화폐",
    color: ASSET_THEME.asset.chart,
  },
  cash: {
    label: "현금",
    color: ASSET_THEME.asset.chart,
  },
  loans: {
    label: "대출",
    color: ASSET_THEME.liability.chart,
  },
  tenantDeposit: {
    label: "임차인보증금",
    color: ASSET_THEME.liability.chart,
  },
} as ChartConfig;

const CATEGORY_COLORS: Record<string, string> = {
  realEstate: "#0d9488",   // teal-600
  stocks: "#2563eb",   // blue-600
  crypto: "#7c3aed",   // violet-600
  cash: "#16a34a",   // green-600
  loans: "#e11d48",   // rose-600
  tenantDeposit: "#db2777", // pink-600
};

const CATEGORY_ICON_MAP: Record<string, React.ElementType> = {
  realEstate: Building2,
  stocks: TrendingUp,
  crypto: Bitcoin,
  cash: Banknote,
  loans: CreditCard,
  tenantDeposit: Wallet,
};

const loanTypeChartConfig = {
  balance: {
    label: "대출잔액",
    color: "var(--chart-1)",
  },
  credit: {
    label: "신용대출",
    color: "hsl(var(--chart-1))",
  },
  minus: {
    label: "마이너스대출",
    color: "hsl(var(--chart-2))",
  },
  "mortgage-home": {
    label: "주택담보",
    color: "hsl(var(--chart-3))",
  },
  "mortgage-stock": {
    label: "주식담보",
    color: "hsl(var(--chart-4))",
  },
  "mortgage-insurance": {
    label: "보험담보",
    color: "hsl(var(--chart-5))",
  },
  "mortgage-deposit": {
    label: "예금담보",
    color: "hsl(var(--chart-6))",
  },
  "mortgage-other": {
    label: "기타담보",
    color: "hsl(var(--chart-1))",
  },
} as ChartConfig;

export function AssetDistributionCards() {
  const { assetData, getAssetSummary, exchangeRates } = useAssetData();
  const summary = getAssetSummary();

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
      fill: "var(--color-realEstate)",
      type: "asset" as const,
    },
    {
      category: "stocks",
      value: summary.stockValue,
      fill: "var(--color-stocks)",
      type: "asset" as const,
    },
    {
      category: "crypto",
      value: summary.cryptoValue,
      fill: "var(--color-crypto)",
      type: "asset" as const,
    },
    {
      category: "cash",
      value: summary.cashValue,
      fill: "var(--color-cash)",
      type: "asset" as const,
    },
    {
      category: "loans",
      value: summary.loanBalance,
      fill: "var(--color-loans)",
      type: "liability" as const,
    },
    {
      category: "tenantDeposit",
      value: summary.tenantDepositTotal,
      fill: "var(--color-tenantDeposit)",
      type: "liability" as const,
    },
  ].filter((item) => item.value > 0);

  const loanTypeLabels: Record<string, string> = {
    credit: "신용대출",
    minus: "마이너스대출",
    "mortgage-home": "주택담보",
    "mortgage-stock": "주식담보",
    "mortgage-insurance": "보험담보",
    "mortgage-deposit": "예금담보",
    "mortgage-other": "기타담보",
    other: "기타",
  };

  // 주식 카테고리별 분류
  const stockCategoryData = [
    { category: "domestic", label: "국내주식" },
    { category: "foreign", label: "해외주식" },
    { category: "irp", label: "IRP" },
    { category: "isa", label: "ISA" },
    { category: "pension", label: "연금저축" },
    { category: "unlisted", label: "비상장" },
  ]
    .map((cat) => {
      const stocks = assetData.stocks.filter((s) => s.category === cat.category);
      const value = stocks.reduce((sum, s) => sum + s.quantity * s.currentPrice * getMultiplier(s.currency), 0);
      return {
        category: cat.category,
        label: cat.label,
        value,
        fill: `var(--color-${cat.category})`,
      };
    })
    .filter((item) => item.value > 0);

  const loanTypeData = assetData.loans
    .map((loan) => ({
      type: loan.type,
      label: loanTypeLabels[loan.type] || loan.type,
      balance: loan.balance,
      name: loan.name,
      interestRate: loan.interestRate,
      fill: loanTypeChartConfig[loan.type]?.color || "var(--chart-1)",
    }))
    .filter((item) => item.balance > 0);

  return (
    <div className="flex flex-col w-full gap-4 lg:grid lg:grid-cols-2">
      <Card className="bg-primary/20 lg:bg-primary/10 border-primary/20 lg:border-border h-fit">
        <CardHeader className="pb-2">
          <CardTitle className={`${ASSET_THEME.primary.text}`}>자산 분포</CardTitle>
          <CardDescription>자산 및 부채 분포 현황</CardDescription>
        </CardHeader>
        <CardContent className="pb-2 overflow-hidden">
          {assetDistributionData.length === 0 ? (
            <div className="flex h-48 items-center justify-center text-muted-foreground">
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
                <div className="flex items-center justify-between rounded-lg bg-primary/5 border border-primary/20 px-4 py-3">
                  <div>
                    <p className="text-xs text-muted-foreground mb-0.5">순자산</p>
                    <p className={`text-2xl font-extrabold tabular-nums ${ASSET_THEME.asset.strong}`}>
                      {formatShortCurrency(summary.netAsset)}
                    </p>
                    <p className="text-[11px] text-muted-foreground">{formatCurrency(summary.netAsset)}</p>
                  </div>
                  <div className="text-right space-y-1.5">
                    <div className="text-xs">
                      <span className="text-muted-foreground">총 자산 </span>
                      <span className={`font-bold ${ASSET_THEME.asset.strong}`}>{formatShortCurrency(totalAsset)}</span>
                    </div>
                    <div className="text-xs">
                      <span className="text-muted-foreground">총 부채 </span>
                      <span className={`font-bold ${ASSET_THEME.liability.strong}`}>-{formatShortCurrency(totalLiability)}</span>
                    </div>
                  </div>
                </div>

                {/* 자산 vs 부채 전체 비율 바 */}
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold text-muted-foreground">자산 / 부채 비율</p>
                  <div className="flex h-5 w-full rounded-full overflow-hidden gap-px">
                    <div
                      className="flex items-center justify-center transition-all"
                      style={{ width: `${(totalAsset / grossTotal) * 100}%`, backgroundColor: "#0d9488" }}
                      title={`자산 ${((totalAsset / grossTotal) * 100).toFixed(1)}%`}
                    >
                      <span className="text-white text-[10px] font-bold drop-shadow select-none">
                        {((totalAsset / grossTotal) * 100).toFixed(0)}%
                      </span>
                    </div>
                    {totalLiability > 0 && (
                      <div
                        className="flex items-center justify-center transition-all"
                        style={{ width: `${(totalLiability / grossTotal) * 100}%`, backgroundColor: "#e11d48" }}
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
                      <span className="font-semibold text-muted-foreground">자산 구성</span>
                      <span className={`font-bold tabular-nums ${ASSET_THEME.asset.strong}`}>{formatShortCurrency(totalAsset)}</span>
                    </div>
                    <div className="flex h-10 w-full rounded-xl overflow-hidden gap-px">
                      {assetItems.map(item => {
                        const pct = (item.value / totalAsset) * 100;
                        return (
                          <div
                            key={item.category}
                            className="relative flex items-center justify-center overflow-hidden cursor-default hover:opacity-85 transition-opacity"
                            style={{ width: `${pct}%`, backgroundColor: CATEGORY_COLORS[item.category] }}
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
                            <span className="size-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: CATEGORY_COLORS[item.category] }} />
                            {Icon && <Icon className="size-3 text-muted-foreground flex-shrink-0" />}
                            <span className="text-xs text-muted-foreground">{assetDistributionChartConfig[item.category]?.label}</span>
                            <span className={`text-xs font-bold tabular-nums ${ASSET_THEME.asset.strong}`}>{pct.toFixed(1)}%</span>
                            <span className="text-xs text-foreground tabular-nums">({formatShortCurrency(item.value)})</span>
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
                      <span className="font-semibold text-muted-foreground">부채 구성</span>
                      <span className={`font-bold tabular-nums ${ASSET_THEME.liability.strong}`}>-{formatShortCurrency(totalLiability)}</span>
                    </div>
                    <div className="flex h-10 w-full rounded-xl overflow-hidden gap-px">
                      {liabilityItems.map(item => {
                        const pct = (item.value / totalLiability) * 100;
                        return (
                          <div
                            key={item.category}
                            className="relative flex items-center justify-center overflow-hidden cursor-default hover:opacity-85 transition-opacity"
                            style={{ width: `${pct}%`, backgroundColor: CATEGORY_COLORS[item.category] }}
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
                            <span className="size-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: CATEGORY_COLORS[item.category] }} />
                            {Icon && <Icon className="size-3 text-muted-foreground flex-shrink-0" />}
                            <span className="text-xs text-muted-foreground">{assetDistributionChartConfig[item.category]?.label}</span>
                            <span className={`text-xs font-bold tabular-nums ${ASSET_THEME.liability.strong}`}>{pct.toFixed(1)}%</span>
                            <span className="text-xs text-foreground tabular-nums">({formatShortCurrency(item.value)})</span>
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
          <p className="text-muted-foreground text-xs">
            마지막 업데이트: {new Date(assetData.lastUpdated).toLocaleString("ko-KR")}
          </p>
        </CardFooter>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className={`${ASSET_THEME.primary.text}`}>주식 카테고리별 분포</CardTitle>
          <CardDescription>주식 자산의 카테고리별 평가금액</CardDescription>
        </CardHeader>
        <CardContent className="overflow-hidden pb-2">
          {stockCategoryData.length === 0 ? (
            <div className="flex h-64 items-center justify-center text-muted-foreground">
              <p>등록된 주식이 없습니다.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* 총 주식 평가금액 */}
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-primary">총 주식 평가금액</span>
                  <span className={`text-xl font-bold tabular-nums ${ASSET_THEME.asset.strong}`}>
                    {formatShortCurrency(summary.stockValue)}
                  </span>
                </div>
                <div className="mt-1 text-xs text-foreground">
                  {formatCurrency(summary.stockValue)}
                </div>
              </div>

              {/* 카테고리별 분포 */}
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
                              <span className={`text-xs font-bold tabular-nums`}>
                                {formatShortCurrency(item.value)}
                              </span>
                            </div>
                          </div>
                        </CollapsibleTrigger>
                        <div className="relative h-2 overflow-hidden rounded-full bg-muted">
                          <div
                            className="absolute inset-y-0 left-0 rounded-full transition-all"
                            style={{
                              width: `${percentage}%`,
                              background: item.fill,
                            }}
                          />
                        </div>

                        {/* 종목별 상세 정보 */}
                        <CollapsibleContent className="mt-2 space-y-2 pl-2">
                          {categoryStocks.map((stock) => {
                            const stockValue = stock.quantity * stock.currentPrice * getMultiplier(stock.currency);
                            const stockPercentage = (stockValue / item.value) * 100;
                            const profit = stockValue - (stock.quantity * stock.averagePrice * getMultiplier(stock.currency));

                            return (
                              <div key={stock.id} className="flex items-center justify-between rounded-lg bg-muted/30 p-2 text-xs">
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
                                  <span className={`font-bold tabular-nums`}>
                                    {formatShortCurrency(stockValue)}
                                  </span>
                                  <span className={`text-xs font-medium ${getProfitLossColor(profit)}`}>
                                    ({profit >= 0 ? '+' : ''}{formatShortCurrency(profit)})
                                  </span>
                                </div>
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
        </CardContent>
        <CardFooter>
          <p className="text-muted-foreground text-xs">총 <span className={`font-bold text-foreground`}>{summary.stockCount}개</span> 주식 보유 중</p>
        </CardFooter>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className={`${ASSET_THEME.primary.text}`}>코인 현황</CardTitle>
          <CardDescription>보유 중인 암호화폐 목록</CardDescription>
        </CardHeader>
        <CardContent className="pb-2">
          {assetData.crypto.length === 0 ? (
            <div className="flex h-64 items-center justify-center text-muted-foreground">
              <p>등록된 암호화폐가 없습니다.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {assetData.crypto.map((coin) => {
                const coinValue = coin.quantity * coin.currentPrice;
                const coinCost = coin.quantity * coin.averagePrice;
                const profit = coinValue - coinCost;
                const profitRate = (profit / coinCost) * 100;

                return (
                  <div key={coin.id} className="flex items-center justify-between gap-4 rounded-lg border p-4">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <span className="size-3 flex-shrink-0 rounded-full bg-chart-3" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className={`font-semibold truncate ${ASSET_THEME.primary.text}`}>{coin.name}</span>
                          <span className="text-xs text-muted-foreground whitespace-nowrap">({coin.symbol})</span>
                        </div>
                        <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                          <span>{coin.quantity} {coin.symbol}</span>
                          {coin.exchange && <span>• {coin.exchange}</span>}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className={`text-lg font-bold tabular-nums`}>
                        {formatShortCurrency(coinValue)}
                      </span>
                      <span className={`text-xs font-medium whitespace-nowrap ${getProfitLossColor(profit)}`}>
                        {profit >= 0 ? '+' : ''}{formatShortCurrency(profit)} ({profit >= 0 ? '+' : ''}{profitRate.toFixed(2)}%)
                      </span>
                    </div>
                  </div>
                );
              })}
              <div className="mt-4 rounded-lg border border-primary/20 bg-primary/5 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-primary">총 암호화폐 평가금액</span>
                  <span className={`text-xl font-bold tabular-nums ${ASSET_THEME.asset.strong}`}>
                    {formatShortCurrency(summary.cryptoValue)}
                  </span>
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {formatCurrency(summary.cryptoValue)}
                </div>
              </div>
            </div>
          )}
        </CardContent>
        <CardFooter>
          <p className="text-muted-foreground text-xs">총 <span className={`font-bold text-foreground`}>{summary.cryptoCount}개</span> 암호화폐 보유 중</p>
        </CardFooter>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className={`${ASSET_THEME.primary.text}`}>대출 현황</CardTitle>
          <CardDescription>대출 종류별 잔액 및 금리</CardDescription>
        </CardHeader>
        <CardContent className="pb-2">
          {loanTypeData.length === 0 ? (
            <div className="flex h-64 items-center justify-center text-muted-foreground">
              <p>등록된 대출이 없습니다.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {loanTypeData.map((loan, index) => {
                // 대출 유형별 아이콘 색상
                const loanIconMap: Record<string, string> = {
                  'credit': 'bg-rose-500',
                  'minus': 'bg-rose-600',
                  'mortgage-home': 'bg-rose-700',
                  'mortgage-stock': 'bg-rose-600',
                  'mortgage-insurance': 'bg-rose-500',
                  'mortgage-deposit': 'bg-rose-600',
                  'mortgage-other': 'bg-rose-400',
                  'other': 'bg-rose-500',
                };
                const loanIcon = loanIconMap[loan.type] || 'bg-rose-500';

                return (
                  <div key={index} className="flex items-center justify-between gap-4 rounded-lg border p-4">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className={`size-8 flex-shrink-0 rounded-full ${loanIcon} flex items-center justify-center`}>
                        <span className="text-xs font-bold text-white">₩</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className={`font-semibold truncate ${ASSET_THEME.primary.text}`}>{loan.name}</span>
                          <span className="text-xs text-muted-foreground whitespace-nowrap">({loan.label})</span>
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {formatCurrency(loan.balance)}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className={`text-lg font-bold tabular-nums ${ASSET_THEME.liability.weak}`}>
                        {formatShortCurrency(loan.balance)}
                      </span>
                      <span className={`text-xs font-medium whitespace-nowrap text-muted-foreground`}>
                        금리 {loan.interestRate.toFixed(2)}%
                      </span>
                    </div>
                  </div>
                );
              })}
              <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-4 dark:border-rose-900 dark:bg-rose-950/30">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-rose-700 dark:text-rose-400">총 대출 잔액</span>
                  <span className={`text-xl font-bold tabular-nums ${ASSET_THEME.liability.strong}`}>
                    {formatShortCurrency(summary.loanBalance)}
                  </span>
                </div>
                <div className="mt-1 text-xs text-foreground">
                  {formatCurrency(summary.loanBalance)}
                </div>
              </div>
            </div>
          )}
        </CardContent>
        <CardFooter>
          <p className="text-muted-foreground text-xs">총 <span className={`font-bold text-foreground`}>{assetData.loans.length}건</span> 대출 보유 중</p>
        </CardFooter>
      </Card>

    </div>
  );
}
