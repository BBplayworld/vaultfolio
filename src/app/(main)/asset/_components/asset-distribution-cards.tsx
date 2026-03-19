"use client";

import { Label, Pie, PieChart } from "recharts";
import { ChevronRight } from "lucide-react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartConfig } from "@/components/ui/chart";
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
        <CardContent className="pb-0 overflow-hidden">
          {assetDistributionData.length === 0 ? (
            <div className="flex h-48 items-center justify-center text-muted-foreground">
              <p>등록된 자산이 없습니다.</p>
            </div>
          ) : (
            <div className="flex flex-col items-center w-full">
              <ChartContainer config={assetDistributionChartConfig} className="mx-auto aspect-square w-full max-w-[300px] h-auto">
                <PieChart>
                  <ChartTooltip
                    cursor={false}
                    content={
                      <ChartTooltipContent
                        hideLabel={false}
                        formatter={(value, name, item) => {
                          const dataItem = item.payload;
                          const labelName = assetDistributionChartConfig[dataItem.category as string]?.label || name;
                          const prefix = dataItem?.type === "liability" ? "-" : "";
                          return [labelName, ' :　', `${prefix}${formatCurrency(value as number)}원`];
                        }}
                      />
                    }
                  />
                  <Pie
                    data={assetDistributionData}
                    dataKey="value"
                    nameKey="category"
                    innerRadius="48%"
                    outerRadius="85%"
                    paddingAngle={2}
                    cornerRadius={4}
                  >
                    <Label
                      content={({ viewBox }) => {
                        if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                          const shortValue = formatShortCurrency(summary.netAsset);
                          const fullValue = formatCurrency(summary.netAsset);

                          return (
                            <text x={viewBox.cx} y={viewBox.cy} textAnchor="middle" dominantBaseline="middle">
                              <tspan
                                x={viewBox.cx}
                                y={(viewBox.cy ?? 0) - 12}
                                className={`text-xl font-bold tabular-nums sm:text-2xl ${ASSET_THEME.asset.strong}`}
                              >
                                {shortValue}
                              </tspan>
                              <tspan
                                x={viewBox.cx}
                                y={(viewBox.cy ?? 0) + 10}
                                className="fill-foreground text-[10px]"
                              >
                                {fullValue}
                              </tspan>
                              <tspan
                                x={viewBox.cx}
                                y={(viewBox.cy ?? 0) + 26}
                                className="fill-muted-foreground text-xs"
                              >
                                순자산
                              </tspan>
                            </text>
                          );
                        }
                      }}
                    />
                  </Pie>
                </PieChart>
              </ChartContainer>

              {/* 범례를 차트 하단으로 이동 - 테이블 형태로 변경 */}
              <div className="w-full pb-4">
                <table className="w-full border-separate border-spacing-y-1.5">
                  <tbody>
                    {/* 자산 섹션 */}
                    {assetDistributionData.some(item => item.type === "asset") && (
                      <tr className="flex flex-col sm:table-row">
                        <td className="text-xs font-semibold text-muted-foreground pr-2 align-top py-0.5">자산</td>
                        <td className="py-0.5">
                          <div className="flex flex-wrap gap-x-4 gap-y-2 sm:gap-x-6">
                            {assetDistributionData
                              .filter(item => item.type === "asset")
                              .map((item) => (
                                <div key={item.category} className="flex items-center gap-2">
                                  <span className="size-3 rounded-full flex-shrink-0" style={{ background: item.fill }} />
                                  <span className={`text-xs sm:text-sm truncate max-w-[120px] ${ASSET_THEME.primary.text}`}>{assetDistributionChartConfig[item.category]?.label || ''}</span>
                                  <span className={`text-xs font-bold tabular-nums sm:text-sm`}>
                                    {formatShortCurrency(item.value)}
                                  </span>
                                </div>
                              ))}
                          </div>
                        </td>
                      </tr>
                    )}

                    {/* 부채 섹션 */}
                    {assetDistributionData.some(item => item.type === "liability") && (
                      <tr className="flex flex-col sm:table-row">
                        <td className="text-sm font-semibold text-muted-foreground pr-3 align-top py-1">부채</td>
                        <td className="py-1">
                          <div className="flex flex-wrap gap-x-4 gap-y-2 sm:gap-x-6">
                            {assetDistributionData
                              .filter(item => item.type === "liability")
                              .map((item) => (
                                <div key={item.category} className="flex items-center gap-2">
                                  <span className="size-3 rounded-full flex-shrink-0" style={{ background: item.fill }} />
                                  <span className={`text-xs sm:text-sm truncate max-w-[120px] ${ASSET_THEME.primary.text}`}>{assetDistributionChartConfig[item.category]?.label || ''}</span>
                                  <span className={`text-xs font-bold tabular-nums sm:text-sm ${ASSET_THEME.liability.strong}`}>
                                    -{formatShortCurrency(item.value)}
                                  </span>
                                </div>
                              ))}
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
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
                  const categoryStocks = assetData.stocks.filter((s) => s.category === item.category);

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
                        <CollapsibleContent className="mt-2 space-y-2 pl-6">
                          {categoryStocks.map((stock) => {
                            const stockValue = stock.quantity * stock.currentPrice * getMultiplier(stock.currency);
                            const stockPercentage = (stockValue / item.value) * 100;
                            const profit = stockValue - (stock.quantity * stock.averagePrice * getMultiplier(stock.currency));

                            return (
                              <div key={stock.id} className="flex items-center justify-between rounded-lg bg-muted/30 p-2 text-xs">
                                <div className="flex items-center gap-2 min-w-0 flex-1">
                                  <span className={`font-medium truncate ${ASSET_THEME.primary.text}`}>{stock.name}</span>
                                  {stock.ticker && (
                                    <span className="text-muted-foreground">({stock.ticker})</span>
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
