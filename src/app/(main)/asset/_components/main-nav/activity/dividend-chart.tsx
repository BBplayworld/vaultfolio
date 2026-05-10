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
import { groupStocksByTickerCategory, mergeStockGroup } from "../detail/asset-detail-tabs";


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
  const json = await res.json();
  if (json.messages) {
    console.log(`[API Logs - ${ticker}]`, json.messages);
  }
  if (!res.ok) return [];
  return json.data || [];
}

interface StockDividendInfo {
  stock: Stock;
  payouts: DividendPayoutResult[];
}

type ActualEstimatedFields = {
  [K in CategoryKey as `${K}Actual`]: number;
} & {
  [K in CategoryKey as `${K}Estimated`]: number;
};

interface MonthlyTotal extends ActualEstimatedFields {
  month: string;
  total: number;
  totalActual: number;
  totalEstimated: number;
  domestic: number;
  foreign: number;
  irp: number;
  isa: number;
  pension: number;
}

function buildMonthlyTotals(items: StockDividendInfo[], usdRate: number): MonthlyTotal[] {
  const actual: Record<CategoryKey, number[]> = {
    domestic: new Array(12).fill(0),
    foreign: new Array(12).fill(0),
    irp: new Array(12).fill(0),
    isa: new Array(12).fill(0),
    pension: new Array(12).fill(0),
  };
  const estimated: Record<CategoryKey, number[]> = {
    domestic: new Array(12).fill(0),
    foreign: new Array(12).fill(0),
    irp: new Array(12).fill(0),
    isa: new Array(12).fill(0),
    pension: new Array(12).fill(0),
  };

  // 지급 여부는 payoutDate의 년-월 <= 오늘(KST) 년-월 기준 (isEstimated 플래그보다 날짜 우선)
  const nowKST = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const currentYM = `${nowKST.getUTCFullYear()}-${String(nowKST.getUTCMonth() + 1).padStart(2, "0")}`;

  for (const { stock, payouts } of items) {
    const cat = CATEGORY_KEYS.includes(stock.category as CategoryKey)
      ? (stock.category as CategoryKey)
      : null;
    if (!cat) continue;
    const rate = stock.currency === "USD" ? usdRate : 1;
    for (const p of payouts) {
      if (stock.purchaseDate && p.payoutDate < stock.purchaseDate) continue;
      const m = parseInt(p.payoutDate.split("-")[1], 10) - 1;
      if (m >= 0 && m < 12) {
        const isPaid = p.payoutDate.slice(0, 7) <= currentYM;
        const bucket = isPaid ? actual : estimated;
        bucket[cat][m] += p.amountPerShare * stock.quantity * rate;
      }
    }
  }

  return Array.from({ length: 12 }, (_, i) => {
    const da = Math.round(actual.domestic[i]);
    const fa = Math.round(actual.foreign[i]);
    const ia = Math.round(actual.irp[i]);
    const sa = Math.round(actual.isa[i]);
    const pa = Math.round(actual.pension[i]);
    const de = Math.round(estimated.domestic[i]);
    const fe = Math.round(estimated.foreign[i]);
    const ie = Math.round(estimated.irp[i]);
    const se = Math.round(estimated.isa[i]);
    const pe = Math.round(estimated.pension[i]);
    const totalActual = da + fa + ia + sa + pa;
    const totalEstimated = de + fe + ie + se + pe;
    return {
      month: `${i + 1}월`,
      total: totalActual + totalEstimated,
      totalActual,
      totalEstimated,
      domestic: da + de,
      foreign: fa + fe,
      irp: ia + ie,
      isa: sa + se,
      pension: pa + pe,
      domesticActual: da,
      foreignActual: fa,
      irpActual: ia,
      isaActual: sa,
      pensionActual: pa,
      domesticEstimated: de,
      foreignEstimated: fe,
      irpEstimated: ie,
      isaEstimated: se,
      pensionEstimated: pe,
    };
  });
}


export function DividendCard({ isActive = true }: { isActive?: boolean }) {
  const { assetData, exchangeRates } = useAssetData();
  const usdRate = exchangeRates.USD;
  const [selectedMonth, setSelectedMonth] = useState<number | undefined>(undefined);

  const stocksWithTicker = (() => {
    const base = assetData.stocks.filter((s) => s.ticker && s.category !== "unlisted");
    const grouped = groupStocksByTickerCategory(base);
    return Array.from(grouped.values()).map(mergeStockGroup);
  })();

  const queries = useQueries({
    queries: stocksWithTicker.map((stock) => {
      const ticker = normalizeTicker(stock);
      const type = DOMESTIC_CATEGORIES.has(stock.category) ? "domestic" : "foreign";
      const excd = "NAS";
      return {
        queryKey: ["dividend", "v11", ticker, type],
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
              <CardTitle>배당</CardTitle>
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
              보유 주식 기준 올해 배당금
              {annualTotal > 0 && (
                <span className={`ml-2 font-semibold ${ASSET_THEME.important}`}>
                  {selectedMonthTotal !== undefined
                    ? `월 ${formatShortCurrency(selectedMonthTotal)}`
                    : `연간 ${formatShortCurrency(annualTotal)}`}
                </span>
              )}
              <ul className="text-muted-foreground text-xs mt-1 space-y-0.5 list-disc list-inside">
                <li>미지급 월은 예상치이며, 기업 결정에 따라 변동될 수 있습니다.</li>
                <li>해외 주식은 현지 기준일과 국내 입금일 차이로 한 달 정도 오차가 발생할 수 있습니다. (예: 3월 기준 배당 → 4월 실제 입금)</li>
                <li><span className="font-semibold text-foreground">매수일</span> 이전 지급분은 계산에서 제외됩니다.</li>
              </ul>
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
              <ChartContainer config={chartConfig} className="h-[200px] w-[calc(100%+1rem)] -ml-4 sm:ml-0 sm:w-full">
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
                        const monthData = payload[0]?.payload as MonthlyTotal;
                        const month = monthData?.month;
                        const totalActual = monthData?.totalActual ?? 0;
                        const totalEstimated = monthData?.totalEstimated ?? 0;
                        const total = totalActual + totalEstimated;

                        // 카테고리별 실제/예상 합산
                        const catRows = CATEGORY_KEYS
                          .map((cat) => {
                            const a = (monthData?.[`${cat}Actual` as keyof MonthlyTotal] as number) ?? 0;
                            const e = (monthData?.[`${cat}Estimated` as keyof MonthlyTotal] as number) ?? 0;
                            return { cat, actual: a, estimated: e, total: a + e };
                          })
                          .filter((r) => r.total > 0);

                        return (
                          <div className="rounded-lg border bg-background px-3 py-2 shadow-md text-xs space-y-1 min-w-[140px]">
                            <p className="font-semibold text-foreground">{month}</p>
                            {catRows.map(({ cat, actual, estimated }) => (
                              <div key={cat} className="space-y-0.5">
                                {actual > 0 && (
                                  <div className="flex items-center justify-between gap-3">
                                    <span className="flex items-center gap-1 text-muted-foreground">
                                      <span className="inline-block w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: CATEGORY_COLORS[cat] }} />
                                      {CATEGORY_LABELS[cat]}
                                    </span>
                                    <span className="font-medium tabular-nums">{formatShortCurrency(actual)}</span>
                                  </div>
                                )}
                                {estimated > 0 && (
                                  <div className="flex items-center justify-between gap-3">
                                    <span className="flex items-center gap-1 text-muted-foreground/60">
                                      <span className="inline-block w-2 h-2 rounded-full shrink-0 opacity-40" style={{ backgroundColor: CATEGORY_COLORS[cat] }} />
                                      {CATEGORY_LABELS[cat]} (예상)
                                    </span>
                                    <span className="tabular-nums text-muted-foreground">{formatShortCurrency(estimated)}</span>
                                  </div>
                                )}
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
                    {/* 실제 지급 Bar — 역순 선언으로 domestic이 맨 위에 쌓임 */}
                    {[...CATEGORY_KEYS].reverse().map((cat) => (
                      <Bar
                        key={`${cat}-actual`}
                        dataKey={`${cat}Actual`}
                        stackId="a"
                        name={CATEGORY_LABELS[cat]}
                        fill={CATEGORY_COLORS[cat]}
                        radius={[0, 0, 0, 0]}
                      >
                        {monthlyTotals.map((_, monthIdx) => (
                          <Cell
                            key={`cell-actual-${monthIdx}`}
                            opacity={selectedMonth === undefined ? 1 : monthIdx + 1 === selectedMonth ? 1 : 0.3}
                          />
                        ))}
                      </Bar>
                    ))}
                    {/* 예상 지급 Bar — 역순, LabelList는 마지막(domestic-estimated, 맨 위)에 부착 */}
                    {[...CATEGORY_KEYS].reverse().map((cat, idx) => {
                      const isLast = idx === CATEGORY_KEYS.length - 1;
                      return (
                        <Bar
                          key={`${cat}-estimated`}
                          dataKey={`${cat}Estimated`}
                          stackId="a"
                          name={`${CATEGORY_LABELS[cat]} (예상)`}
                          fill={CATEGORY_COLORS[cat]}
                          fillOpacity={0.35}
                          radius={isLast ? [3, 3, 0, 0] : [0, 0, 0, 0]}
                        >
                          {monthlyTotals.map((_, monthIdx) => (
                            <Cell
                              key={`cell-estimated-${monthIdx}`}
                              opacity={selectedMonth === undefined ? 1 : monthIdx + 1 === selectedMonth ? 1 : 0.3}
                            />
                          ))}
                          {isLast && (
                            <LabelList
                              dataKey="total"
                              position="top"
                              offset={8}
                              formatter={(v: number) => (v > 0 ? formatShortCurrency(v) : "")}
                              style={{ fill: "#ffffff", fontSize: 11, fontWeight: 600 }}
                            />
                          )}
                        </Bar>
                      );
                    })}
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
