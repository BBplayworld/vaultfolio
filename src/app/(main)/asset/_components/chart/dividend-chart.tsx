"use client";

import { useState } from "react";
import { useQueries } from "@tanstack/react-query";
import {
  Bar, BarChart, XAxis, YAxis, CartesianGrid, ResponsiveContainer, LabelList, Cell,
} from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAssetData } from "@/contexts/asset-data-context";
import { formatShortCurrency } from "@/lib/number-utils";
import { ChartContainer, ChartTooltip, ChartConfig } from "@/components/ui/chart";
import { ASSET_THEME, MAIN_PALETTE } from "@/config/theme";
import { normalizeTicker } from "@/lib/finance-service";
import type { DividendPayoutResult } from "@/lib/finance-service";
import type { Stock } from "@/types/asset";
import { MonthlyDividendStocks } from "./monthly-dividend-stocks";

const DOMESTIC_CATEGORIES = new Set(["domestic", "irp", "isa", "pension"]);

const CATEGORY_KEYS = ["domestic", "foreign", "irp", "isa", "pension"] as const;
type CategoryKey = typeof CATEGORY_KEYS[number];

const CATEGORY_COLORS: Record<CategoryKey, string> = {
  domestic: MAIN_PALETTE[3],
  foreign: MAIN_PALETTE[5],
  irp: MAIN_PALETTE[6],
  isa: MAIN_PALETTE[4],
  pension: MAIN_PALETTE[7],
};

const CATEGORY_LABELS: Record<CategoryKey, string> = {
  domestic: "국내주식",
  foreign: "해외주식",
  irp: "IRP",
  isa: "ISA",
  pension: "연금저축",
};

const chartConfig = Object.fromEntries(
  CATEGORY_KEYS.map((k) => [k, { label: CATEGORY_LABELS[k], color: CATEGORY_COLORS[k] }])
) as ChartConfig;

const commonAxisProps = {
  tick: { fill: "hsl(var(--muted-foreground))", fontSize: 11 },
  tickLine: false,
  axisLine: false,
};

async function fetchDividend(ticker: string, type: string, excd: string): Promise<DividendPayoutResult[]> {
  const params = new URLSearchParams({ ticker, type, excd });
  const res = await fetch(`/api/finance/dividend?${params}`);
  if (!res.ok) return [];
  return res.json();
}

interface StockDividendInfo {
  stock: Stock;
  payouts: DividendPayoutResult[];
}

interface MonthlyTotal {
  month: string;
  total: number;
  domestic: number;
  foreign: number;
  irp: number;
  isa: number;
  pension: number;
}

function buildMonthlyTotals(items: StockDividendInfo[], usdRate: number): MonthlyTotal[] {
  const totals: Record<CategoryKey, number[]> = {
    domestic: new Array(12).fill(0),
    foreign: new Array(12).fill(0),
    irp: new Array(12).fill(0),
    isa: new Array(12).fill(0),
    pension: new Array(12).fill(0),
  };

  for (const { stock, payouts } of items) {
    const cat = CATEGORY_KEYS.includes(stock.category as CategoryKey)
      ? (stock.category as CategoryKey)
      : null;
    if (!cat) continue;
    const rate = stock.currency === "USD" ? usdRate : 1;
    for (const p of payouts) {
      const m = parseInt(p.payoutDate.split("-")[1], 10) - 1;
      if (m >= 0 && m < 12) {
        totals[cat][m] += p.amountPerShare * stock.quantity * rate;
      }
    }
  }

  return Array.from({ length: 12 }, (_, i) => {
    const domestic = Math.round(totals.domestic[i]);
    const foreign = Math.round(totals.foreign[i]);
    const irp = Math.round(totals.irp[i]);
    const isa = Math.round(totals.isa[i]);
    const pension = Math.round(totals.pension[i]);
    return {
      month: `${i + 1}월`,
      total: domestic + foreign + irp + isa + pension,
      domestic, foreign, irp, isa, pension,
    };
  });
}


export function DividendCard({ isActive = true }: { isActive?: boolean }) {
  const { assetData, exchangeRates } = useAssetData();
  const usdRate = exchangeRates.USD;
  const [selectedMonth, setSelectedMonth] = useState<number | undefined>(undefined);

  const stocksWithTicker = assetData.stocks.filter((s) => s.ticker && s.category !== "unlisted");

  const queries = useQueries({
    queries: stocksWithTicker.map((stock) => {
      const ticker = normalizeTicker(stock);
      const type = DOMESTIC_CATEGORIES.has(stock.category) ? "domestic" : "foreign";
      const excd = "NAS";
      return {
        queryKey: ["dividend", ticker, type],
        queryFn: () => fetchDividend(ticker, type, excd),
        staleTime: 30 * 24 * 60 * 60 * 1000,
        retry: false,
        enabled: isActive,
      };
    }),
  });

  const isLoading = queries.some((q) => q.isLoading);
  const loadedCount = queries.filter((q) => !q.isLoading).length;
  const totalCount = queries.length;

  const dividendItems: StockDividendInfo[] = stocksWithTicker.map((stock, i) => ({
    stock,
    payouts: Array.isArray(queries[i]?.data) ? (queries[i].data as DividendPayoutResult[]) : [],
  }));

  const monthlyTotals = buildMonthlyTotals(dividendItems, usdRate);
  const annualTotal = monthlyTotals.reduce((sum, m) => sum + m.total, 0);
  const selectedMonthTotal = selectedMonth !== undefined ? (monthlyTotals[selectedMonth - 1]?.total ?? 0) : undefined;

  return (
    <div className="grid grid-cols-1 gap-4 *:data-[slot=card]:shadow-xs">
      <Card>
        <CardHeader>
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <CardTitle>배당 차트</CardTitle>
              {selectedMonth !== undefined && (
                <Badge
                  variant="outline"
                  className="cursor-pointer text-xs"
                  onClick={() => setSelectedMonth(undefined)}
                >
                  {selectedMonth}월 · 전체 보기 ×
                </Badge>
              )}
            </div>
            <CardDescription>
              보유 주식 기준 예상 배당금
              {annualTotal > 0 && (
                <span className={`ml-2 font-semibold ${ASSET_THEME.important}`}>
                  {selectedMonthTotal !== undefined
                    ? `${selectedMonth}월 ${formatShortCurrency(selectedMonthTotal)}`
                    : `연간 ${formatShortCurrency(annualTotal)}`}
                </span>
              )}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {isLoading && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
                <span>배당 정보 조회 중...</span>
                <span className="tabular-nums">{loadedCount} / {totalCount}</span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-300"
                  style={{ width: totalCount > 0 ? `${(loadedCount / totalCount) * 100}%` : "0%" }}
                />
              </div>
              <div className="space-y-1.5">
                {stocksWithTicker.slice(0, 8).map((stock, i) => {
                  const q = queries[i];
                  const done = q && !q.isLoading;
                  return (
                    <div key={stock.id} className="flex items-center justify-between px-1 py-0.5">
                      <span className="text-xs text-foreground truncate max-w-[60%]">{stock.name || stock.ticker}</span>
                      <span className={`text-[10px] ${done ? "text-primary" : "text-muted-foreground"}`}>
                        {done ? "완료" : "조회 중..."}
                      </span>
                    </div>
                  );
                })}
                {stocksWithTicker.length > 8 && (
                  <p className="text-[10px] text-muted-foreground px-1">외 {stocksWithTicker.length - 8}개 종목...</p>
                )}
              </div>
            </div>
          )}

          {!isLoading && annualTotal === 0 ? (
            <div className="flex h-48 items-center justify-center rounded-lg border border-dashed">
              <div className="text-center">
                <p className="text-muted-foreground text-sm">올해 배당 데이터가 없습니다.</p>
                <p className="text-muted-foreground text-xs mt-1">
                  보유 주식에 배당금이 없거나 KIS API가 설정되지 않았습니다.
                </p>
              </div>
            </div>
          ) : (
            !isLoading && (
              <ChartContainer config={chartConfig} className="h-[200px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={monthlyTotals}
                    margin={{ top: 24, right: 10, bottom: 5, left: 10 }}
                    onClick={(data) => {
                      if (!data?.activePayload) return;
                      const monthStr = data.activePayload[0]?.payload?.month as string;
                      const m = parseInt(monthStr, 10);
                      if (!m) return;
                      setSelectedMonth((prev) => (prev === m ? undefined : m));
                    }}
                    style={{ cursor: "pointer" }}
                  >
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="month" {...commonAxisProps} />
                    <YAxis
                      {...commonAxisProps}
                      tickFormatter={(v) => formatShortCurrency(v)}
                      width={55}
                    />
                    <ChartTooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const month = payload[0]?.payload?.month as string;
                        const total = payload.reduce((s, p) => s + ((p.value as number) || 0), 0);
                        const cats = payload.filter((p) => (p.value as number) > 0);
                        return (
                          <div className="rounded-lg border bg-background px-3 py-2 shadow-md text-xs space-y-1 min-w-[120px]">
                            <p className="font-semibold text-foreground">{month}</p>
                            {cats.map((p) => (
                              <div key={p.dataKey} className="flex items-center justify-between gap-3">
                                <span className="flex items-center gap-1 text-muted-foreground">
                                  <span className="inline-block w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
                                  {CATEGORY_LABELS[p.dataKey as CategoryKey]}
                                </span>
                                <span className="font-medium tabular-nums">{formatShortCurrency(p.value as number)}</span>
                              </div>
                            ))}
                            <div className="border-t pt-1 flex justify-between font-semibold">
                              <span>합계</span>
                              <span className="tabular-nums">{formatShortCurrency(total)}</span>
                            </div>
                          </div>
                        );
                      }}
                    />
                    {CATEGORY_KEYS.map((cat, idx) => (
                      <Bar
                        key={cat}
                        dataKey={cat}
                        stackId="a"
                        name={CATEGORY_LABELS[cat]}
                        fill={CATEGORY_COLORS[cat]}
                        radius={idx === CATEGORY_KEYS.length - 1 ? [3, 3, 0, 0] : [0, 0, 0, 0]}
                      >
                        {monthlyTotals.map((_, monthIdx) => (
                          <Cell
                            key={`cell-${monthIdx}`}
                            opacity={
                              selectedMonth === undefined
                                ? 1
                                : monthIdx + 1 === selectedMonth
                                  ? 1
                                  : 0.3
                            }
                          />
                        ))}
                        {idx === CATEGORY_KEYS.length - 1 && (
                          <LabelList
                            dataKey="total"
                            position="top"
                            offset={8}
                            formatter={(v: number) => (v > 0 ? formatShortCurrency(v) : "")}
                            style={{ fill: "#ffffff", fontSize: 11, fontWeight: 600 }}
                          />
                        )}
                      </Bar>
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </ChartContainer>
            )
          )}

          {!isLoading && annualTotal > 0 && (
            <MonthlyDividendStocks selectedMonth={selectedMonth} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
