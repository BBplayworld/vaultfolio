"use client";

import { useQueries } from "@tanstack/react-query";
import {
  Bar, BarChart, XAxis, YAxis, CartesianGrid, ResponsiveContainer, LabelList,
} from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAssetData } from "@/contexts/asset-data-context";
import { formatShortCurrency, formatCurrency } from "@/lib/number-utils";
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartConfig } from "@/components/ui/chart";
import { ASSET_THEME } from "@/config/theme";
import { normalizeTicker } from "@/lib/finance-service";
import type { DividendPayoutResult, DividendFrequency } from "@/lib/finance-service";
import type { Stock } from "@/types/asset";

const FREQUENCY_LABEL: Record<DividendFrequency, string> = {
  annual: "연간",
  semiannual: "반기",
  quarterly: "분기",
  monthly: "월배당",
};

const CATEGORY_LABEL: Record<string, string> = {
  domestic: "국내주식",
  foreign: "해외주식",
  isa: "ISA",
  irp: "IRP",
  pension: "연금저축",
};

const DOMESTIC_CATEGORIES = new Set(["domestic", "irp", "isa", "pension"]);

const chartConfig = {
  dividend: {
    label: "배당금",
    color: ASSET_THEME.categoryColors.realEstate,
  },
} as ChartConfig;

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
  month: string; // "1월" ~ "12월"
  total: number;
}

function buildMonthlyTotals(items: StockDividendInfo[], usdRate: number): MonthlyTotal[] {
  const totals = new Array(12).fill(0);
  for (const { stock, payouts } of items) {
    const rate = stock.currency === "USD" ? usdRate : 1;
    for (const p of payouts) {
      const m = parseInt(p.payoutDate.split("-")[1], 10) - 1;
      if (m >= 0 && m < 12) {
        totals[m] += p.amountPerShare * stock.quantity * rate;
      }
    }
  }
  return totals.map((total, i) => ({ month: `${i + 1}월`, total: Math.round(total) }));
}

function buildCategoryItems(
  items: StockDividendInfo[],
  usdRate: number
): Record<string, { stock: Stock; annualTotal: number; annualForeign: number; perShareForeign: number; perShareKRW: number; currency: string; payoutMonths: number[]; frequency?: DividendFrequency }[]> {
  const result: Record<string, { stock: Stock; annualTotal: number; annualForeign: number; perShareForeign: number; perShareKRW: number; currency: string; payoutMonths: number[]; frequency?: DividendFrequency }[]> = {};
  for (const { stock, payouts } of items) {
    if (payouts.length === 0) continue;
    const currency = payouts[0].currency || (stock.currency === "USD" ? "USD" : "KRW");
    const rate = currency === "USD" ? usdRate : 1;
    const annualTotal = Math.round(
      payouts.reduce((sum, p) => sum + p.amountPerShare * stock.quantity * rate, 0)
    );
    const annualForeign = currency === "USD"
      ? Math.round(payouts.reduce((sum, p) => sum + (p.amountForeign ?? p.amountPerShare) * stock.quantity, 0) * 100) / 100
      : 0;
    // 1회 지급 기준 주당 금액
    const perShareForeign = currency === "USD" ? (payouts[0].amountForeign ?? payouts[0].amountPerShare) : 0;
    const perShareKRW = Math.round(payouts[0].amountPerShare * rate);
    const payoutMonths = [...new Set(
      payouts.map((p) => parseInt(p.payoutDate.split("-")[1], 10)).filter(Boolean)
    )].sort((a, b) => a - b);
    const frequency = payouts[0].frequency;

    if (!result[stock.category]) result[stock.category] = [];
    result[stock.category].push({ stock, annualTotal, annualForeign, perShareForeign, perShareKRW, currency, payoutMonths, frequency });
  }
  return result;
}

export function DividendCard() {
  const { assetData, exchangeRates } = useAssetData();
  const usdRate = exchangeRates.USD;

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
      };
    }),
  });

  const isLoading = queries.some((q) => q.isLoading);

  const dividendItems: StockDividendInfo[] = stocksWithTicker.map((stock, i) => ({
    stock,
    payouts: Array.isArray(queries[i]?.data) ? (queries[i].data as DividendPayoutResult[]) : [],
  }));

  const monthlyTotals = buildMonthlyTotals(dividendItems, usdRate);
  const annualTotal = monthlyTotals.reduce((sum, m) => sum + m.total, 0);
  const categoryItems = buildCategoryItems(dividendItems, usdRate);
  const categoryOrder = ["domestic", "foreign", "isa", "irp", "pension"];
  const activeCategories = categoryOrder.filter((c) => categoryItems[c]?.length);

  return (
    <div className="grid grid-cols-1 gap-4 *:data-[slot=card]:shadow-xs">
      <Card>
        <CardHeader>
          <div className="space-y-1.5">
            <CardTitle>배당 차트</CardTitle>
            <CardDescription>
              보유 주식 기준 올해 예상 배당금
              {annualTotal > 0 && (
                <span className={`ml-2 font-semibold ${ASSET_THEME.important}`}>
                  연간 {formatShortCurrency(annualTotal)}
                </span>
              )}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {isLoading && (
            <p className="text-xs text-muted-foreground text-center py-4">배당 정보 조회 중...</p>
          )}

          {/* ── 상단: 12개월 배당금 총합 차트 ── */}
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
                  <BarChart data={monthlyTotals} margin={{ top: 24, right: 10, bottom: 5, left: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="month" {...commonAxisProps} />
                    <YAxis
                      {...commonAxisProps}
                      tickFormatter={(v) => formatShortCurrency(v)}
                      width={55}
                    />
                    <ChartTooltip
                      content={
                        <ChartTooltipContent
                          formatter={(value) => formatShortCurrency(value as number)}
                        />
                      }
                    />
                    <Bar
                      dataKey="total"
                      fill={ASSET_THEME.categoryColors.realEstate}
                      radius={[3, 3, 0, 0]}
                    >
                      <LabelList
                        dataKey="total"
                        position="top"
                        offset={8}
                        formatter={(v: number) => (v > 0 ? formatShortCurrency(v) : "")}
                        style={{ fill: "#ffffff", fontSize: 11, fontWeight: 600 }}
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </ChartContainer>
            )
          )}

          {/* ── 하단: 카테고리별 종목 목록 ── */}
          {!isLoading && activeCategories.length > 0 && (
            <div className="space-y-4">
              {activeCategories.map((cat) => {
                const rows = categoryItems[cat];
                const catTotal = rows.reduce((s, r) => s + r.annualTotal, 0);
                return (
                  <div key={cat} className="space-y-2">
                    {/* 섹션 헤더 */}
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold">{CATEGORY_LABEL[cat]}</span>
                      <span className={`text-xs font-semibold ${ASSET_THEME.important}`}>
                        연간 {formatShortCurrency(catTotal)}
                      </span>
                    </div>
                    {/* 종목 행 */}
                    <div className="rounded-lg border overflow-hidden divide-y">
                      {/* 헤더 */}
                      <div className="grid grid-cols-[1fr_7rem_4.5rem_5.5rem_5.5rem] gap-x-3 px-3 py-2 bg-muted/50 text-[10px] font-medium text-muted-foreground">
                        <span>종목명</span>
                        <span className="text-right">배당월</span>
                        <span className="text-right">주당</span>
                        <span className="text-right">수량</span>
                        <span className="text-right">연간예상</span>
                      </div>
                      {rows.map(({ stock, annualTotal: total, annualForeign, perShareForeign, perShareKRW, currency, payoutMonths, frequency }) => {
                        const ticker = normalizeTicker(stock);
                        const isDomestic = DOMESTIC_CATEGORIES.has(stock.category);
                        return (
                          <div
                            key={stock.id}
                            className="grid grid-cols-[1fr_7rem_4.5rem_5.5rem_5.5rem] gap-x-3 px-3 py-2.5 items-center hover:bg-muted/30 transition-colors"
                          >
                            <div className="min-w-0">
                              <div className="flex items-center gap-1">
                                <p className="text-xs font-semibold truncate">{stock.name || ticker}</p>
                                {frequency && (
                                  <Badge variant="secondary" className="text-[9px] px-1 py-0 h-4 shrink-0">
                                    {FREQUENCY_LABEL[frequency]}
                                  </Badge>
                                )}
                              </div>
                              <p className="text-[10px] text-muted-foreground">{ticker}</p>
                            </div>
                            <div className="flex flex-wrap gap-0.5 justify-end max-w-[7rem]">
                              {payoutMonths.map((m) => (
                                <Badge
                                  key={m}
                                  variant="outline"
                                  className="text-[9px] px-1 py-0 h-4"
                                >
                                  {m}월
                                </Badge>
                              ))}
                            </div>
                            <div className="text-right">
                              {!isDomestic && currency === "USD" ? (
                                <>
                                  <p className="text-xs tabular-nums text-muted-foreground">${perShareForeign.toFixed(4)}</p>
                                  <p className="text-[10px] tabular-nums text-muted-foreground/60">{perShareKRW.toLocaleString()}원</p>
                                </>
                              ) : (
                                <p className="text-xs tabular-nums text-muted-foreground">{perShareKRW.toLocaleString()}원</p>
                              )}
                            </div>
                            <div className="text-right">
                              <p className="text-xs tabular-nums text-primary">{stock.quantity.toLocaleString()}주</p>
                            </div>
                            <div className="text-right">
                              {!isDomestic && currency === "USD" && (
                                <p className="text-[10px] tabular-nums text-muted-foreground/60">${(annualForeign).toFixed(2)}</p>
                              )}
                              <p className={`text-xs font-bold tabular-nums ${ASSET_THEME.text.default}`}>
                                {formatCurrency(total)}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
