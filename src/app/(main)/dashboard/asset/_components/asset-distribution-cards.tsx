"use client";

import { useState } from "react";
import { Label, Pie, PieChart, Bar, BarChart, XAxis, YAxis, CartesianGrid, LabelList } from "recharts";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartConfig } from "@/components/ui/chart";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useAssetData } from "@/hooks/use-asset-data";
import { formatCurrency, formatShortCurrency } from "@/lib/number-utils";

const assetDistributionChartConfig = {
  value: {
    label: "자산",
  },
  realEstate: {
    label: "부동산",
    color: "var(--chart-1)",
  },
  stocks: {
    label: "주식",
    color: "var(--chart-2)",
  },
  crypto: {
    label: "암호화폐",
    color: "var(--chart-3)",
  },
  loans: {
    label: "대출",
    color: "oklch(0.577 0.245 27.325)", // destructive red
  },
  tenantDeposit: {
    label: "임차인보증금",
    color: "oklch(0.75 0.15 70)", // amber
  },
} as ChartConfig;

const stockCategoryChartConfig = {
  value: {
    label: "평가금액",
    color: "var(--chart-1)",
  },
  domestic: {
    label: "국내주식",
    color: "var(--chart-1)",
  },
  foreign: {
    label: "해외주식",
    color: "var(--chart-2)",
  },
  irp: {
    label: "IRP",
    color: "var(--chart-3)",
  },
  isa: {
    label: "ISA",
    color: "var(--chart-4)",
  },
  pension: {
    label: "연금저축",
    color: "var(--chart-5)",
  },
  unlisted: {
    label: "비상장",
    color: "var(--chart-6)",
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
  const { assetData, getAssetSummary } = useAssetData();
  const summary = getAssetSummary();

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
      const value = stocks.reduce((sum, s) => sum + s.quantity * s.currentPrice, 0);
      return {
        category: cat.category,
        label: cat.label,
        value,
        fill: `var(--color-${cat.category})`,
      };
    })
    .filter((item) => item.value > 0);

  // 대출 종류별 분류
  const loanTypeLabels: Record<string, string> = {
    credit: "신용대출",
    minus: "마이너스대출",
    "mortgage-home": "주택담보",
    "mortgage-stock": "주식담보",
    "mortgage-insurance": "보험담보",
    "mortgage-deposit": "예금담보",
    "mortgage-other": "기타담보",
  };

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
    <div className="grid grid-cols-1 gap-4 *:data-[slot=card]:shadow-xs lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>자산 분포</CardTitle>
          <CardDescription>자산 및 부채 분포 현황</CardDescription>
        </CardHeader>
        <CardContent className="pb-2">
          {assetDistributionData.length === 0 ? (
            <div className="flex h-64 items-center justify-center text-muted-foreground">
              <p>등록된 자산이 없습니다.</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4">
              <ChartContainer config={assetDistributionChartConfig} className="mx-auto aspect-square w-full max-w-[280px] sm:max-w-[300px]">
                <PieChart>
                  <ChartTooltip
                    cursor={false}
                    content={
                      <ChartTooltipContent
                        hideLabel
                        formatter={(value, name, item) => {
                          const dataItem = assetDistributionData.find(d => d.category === name);
                          const prefix = dataItem?.type === "liability" ? "-" : "";
                          return `${prefix}${formatCurrency(value as number)}원`;
                        }}
                      />
                    }
                  />
                  <Pie
                    data={assetDistributionData}
                    dataKey="value"
                    nameKey="category"
                    innerRadius={60}
                    outerRadius={90}
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
                                className="fill-foreground text-lg font-bold tabular-nums sm:text-xl"
                              >
                                {shortValue}
                              </tspan>
                              <tspan
                                x={viewBox.cx}
                                y={(viewBox.cy ?? 0) + 8}
                                className="fill-muted-foreground text-[9px] sm:text-[10px]"
                              >
                                {fullValue}
                              </tspan>
                              <tspan
                                x={viewBox.cx}
                                y={(viewBox.cy ?? 0) + 24}
                                className="fill-muted-foreground text-[11px] sm:text-xs"
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

              {/* 범례를 차트 하단으로 이동 */}
              <div className="w-full space-y-3">
                {/* 자산 섹션 */}
                {assetDistributionData.some(item => item.type === "asset") && (
                  <div>
                    <div className="mb-2 text-xs font-semibold text-muted-foreground">자산</div>
                    <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 sm:gap-x-6">
                      {assetDistributionData
                        .filter(item => item.type === "asset")
                        .map((item) => (
                          <div key={item.category} className="flex items-center gap-2">
                            <span className="size-3 rounded-full" style={{ background: item.fill }} />
                            <span className="text-xs sm:text-sm">{assetDistributionChartConfig[item.category].label}</span>
                            <span className="text-xs font-medium tabular-nums text-muted-foreground sm:text-sm">
                              {formatShortCurrency(item.value)}
                            </span>
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                {/* 부채 섹션 */}
                {assetDistributionData.some(item => item.type === "liability") && (
                  <div>
                    <div className="mb-2 text-xs font-semibold text-muted-foreground">부채</div>
                    <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 sm:gap-x-6">
                      {assetDistributionData
                        .filter(item => item.type === "liability")
                        .map((item) => (
                          <div key={item.category} className="flex items-center gap-2">
                            <span className="size-3 rounded-full" style={{ background: item.fill }} />
                            <span className="text-xs sm:text-sm">{assetDistributionChartConfig[item.category].label}</span>
                            <span className="text-xs font-medium tabular-nums text-muted-foreground sm:text-sm">
                              -{formatShortCurrency(item.value)}
                            </span>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
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
          <CardTitle>주식 카테고리별 분포</CardTitle>
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
                  <span className="text-xl font-bold tabular-nums text-primary">
                    {formatShortCurrency(summary.stockValue)}
                  </span>
                </div>
                <div className="mt-1 text-xs text-primary/70">
                  {formatCurrency(summary.stockValue)}
                </div>
              </div>

              {/* 카테고리별 분포 */}
              <div className="space-y-3">
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
                              <span className="font-medium">{item.label}</span>
                              <span className="text-xs text-muted-foreground">({categoryStocks.length}개)</span>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-xs font-semibold tabular-nums text-primary">
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
                            style={{
                              width: `${percentage}%`,
                              background: item.fill,
                            }}
                          />
                        </div>

                        {/* 종목별 상세 정보 */}
                        <CollapsibleContent className="mt-2 space-y-2 pl-6">
                          {categoryStocks.map((stock) => {
                            const stockValue = stock.quantity * stock.currentPrice;
                            const stockPercentage = (stockValue / item.value) * 100;
                            const profit = stockValue - (stock.quantity * stock.averagePrice);

                            return (
                              <div key={stock.id} className="flex items-center justify-between rounded-lg bg-muted/30 p-2 text-xs">
                                <div className="flex items-center gap-2 min-w-0 flex-1">
                                  <span className="font-medium truncate">{stock.name}</span>
                                  {stock.ticker && (
                                    <span className="text-muted-foreground">({stock.ticker})</span>
                                  )}
                                </div>
                                <div className="flex items-center gap-3 whitespace-nowrap">
                                  <span className="text-xs font-semibold tabular-nums text-muted-foreground">
                                    {stockPercentage.toFixed(1)}%
                                  </span>
                                  <span className="font-bold tabular-nums">
                                    {formatShortCurrency(stockValue)}
                                  </span>
                                  <span className={`text-xs font-medium ${profit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                                    {profit >= 0 ? '+' : ''}{formatShortCurrency(profit)}
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
          <p className="text-muted-foreground text-xs">총 {assetData.stocks.length}개 주식 보유 중</p>
        </CardFooter>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>코인 현황</CardTitle>
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
                          <span className="font-semibold truncate">{coin.name}</span>
                          <span className="text-xs text-muted-foreground whitespace-nowrap">({coin.symbol})</span>
                        </div>
                        <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                          <span>{coin.quantity.toLocaleString()} {coin.symbol}</span>
                          {coin.exchange && <span>• {coin.exchange}</span>}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className="text-lg font-bold tabular-nums">
                        {formatShortCurrency(coinValue)}
                      </span>
                      <span className={`text-xs font-medium whitespace-nowrap ${profit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                        {profit >= 0 ? '+' : ''}{formatShortCurrency(profit)} ({profit >= 0 ? '+' : ''}{profitRate.toFixed(2)}%)
                      </span>
                    </div>
                  </div>
                );
              })}
              <div className="mt-4 rounded-lg border border-primary/20 bg-primary/5 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-primary">총 암호화폐 평가금액</span>
                  <span className="text-xl font-bold tabular-nums text-primary">
                    {formatShortCurrency(summary.cryptoValue)}
                  </span>
                </div>
                <div className="mt-1 text-xs text-primary/70">
                  {formatCurrency(summary.cryptoValue)}
                </div>
              </div>
            </div>
          )}
        </CardContent>
        <CardFooter>
          <p className="text-muted-foreground text-xs">총 {assetData.crypto.length}개 암호화폐 보유 중</p>
        </CardFooter>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>대출 현황</CardTitle>
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
                return (
                  <div key={index} className="flex items-center justify-between gap-4 rounded-lg border p-4">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <span className="size-3 flex-shrink-0 rounded-full" style={{ background: loan.fill }} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold truncate">{loan.name}</span>
                          <span className="text-xs text-muted-foreground whitespace-nowrap">({loan.label})</span>
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {formatCurrency(loan.balance)}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className="text-lg font-bold tabular-nums text-rose-600 dark:text-rose-400">
                        {formatShortCurrency(loan.balance)}
                      </span>
                      <span className="text-xs font-medium text-rose-600 dark:text-rose-400 whitespace-nowrap">
                        금리 {loan.interestRate.toFixed(2)}%
                      </span>
                    </div>
                  </div>
                );
              })}
              <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-4 dark:border-rose-900 dark:bg-rose-950/30">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-rose-700 dark:text-rose-400">총 대출 잔액</span>
                  <span className="text-xl font-bold tabular-nums text-rose-600 dark:text-rose-400">
                    {formatShortCurrency(summary.loanBalance)}
                  </span>
                </div>
                <div className="mt-1 text-xs text-rose-600/70 dark:text-rose-400/70">
                  {formatCurrency(summary.loanBalance)}
                </div>
              </div>
            </div>
          )}
        </CardContent>
        <CardFooter>
          <p className="text-muted-foreground text-xs">총 {assetData.loans.length}건 대출 보유 중</p>
        </CardFooter>
      </Card>

    </div>
  );
}
