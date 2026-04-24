"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useAssetData } from "@/contexts/asset-data-context";
import { formatCurrency, formatShortCurrency } from "@/lib/number-utils";
import { normalizeTicker } from "@/lib/finance-service";
import { ASSET_THEME, MAIN_PALETTE, getProfitLossColor } from "@/config/theme";
import type { ProfitRefResponse } from "@/app/api/finance/profit/route";

const DOMESTIC_CATEGORIES = new Set(["domestic", "irp", "isa", "pension"]);

const CATEGORY_GROUPS = [
  { key: "domestic", label: "국내주식", color: MAIN_PALETTE[3] },
  { key: "foreign", label: "해외주식", color: MAIN_PALETTE[5] },
  { key: "irp", label: "IRP", color: MAIN_PALETTE[6] },
  { key: "isa", label: "ISA", color: MAIN_PALETTE[4] },
  { key: "pension", label: "연금저축", color: MAIN_PALETTE[7] },
] as const;

type ProfitPeriod = "daily" | "weekly" | "monthly" | "yearly";

const PERIOD_LABELS: Record<ProfitPeriod, string> = {
  daily: "일별",
  weekly: "주간",
  monthly: "월간",
  yearly: "연간",
};

const TAB_LIST = ASSET_THEME.tabList1;
const TAB_TRIGGER = ASSET_THEME.tabTrigger1;

// localStorage 캐시 유효 날짜 계산 (KST 기준)
// daily: 당일 자정까지 / weekly·monthly·yearly: 다음 월요일 자정까지
function getProfitCacheKey(tickers: string, period: ProfitPeriod): string {
  const nowKST = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const todayStr = nowKST.toISOString().split("T")[0];
  // 주간은 이번 주 월요일 기준으로 묶음
  if (period === "weekly") {
    const day = nowKST.getUTCDay(); // 0=일
    const monday = new Date(nowKST);
    monday.setUTCDate(nowKST.getUTCDate() - (day === 0 ? 6 : day - 1));
    const weekStr = monday.toISOString().split("T")[0];
    return `profit:${period}:${weekStr}:${tickers}`;
  }
  if (period === "monthly") {
    const monthStr = todayStr.slice(0, 7); // YYYY-MM
    return `profit:${period}:${monthStr}:${tickers}`;
  }
  if (period === "yearly") {
    const yearStr = todayStr.slice(0, 4); // YYYY
    return `profit:${period}:${yearStr}:${tickers}`;
  }
  return `profit:${period}:${todayStr}:${tickers}`;
}

function lsGet(key: string): ProfitRefResponse | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as ProfitRefResponse) : null;
  } catch {
    return null;
  }
}

function lsSet(key: string, data: ProfitRefResponse): void {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch {
    // localStorage 용량 초과 등 무시
  }
}

async function fetchProfitRef(tickers: string, period: ProfitPeriod): Promise<ProfitRefResponse> {
  const cacheKey = getProfitCacheKey(tickers, period);
  const cached = lsGet(cacheKey);
  if (cached) return cached;

  const res = await fetch(`/api/finance/profit?tickers=${tickers}&period=${period}`);
  if (!res.ok) return {};
  const data: ProfitRefResponse = await res.json();
  lsSet(cacheKey, data);
  return data;
}

function formatRate(rate: number): string {
  const sign = rate >= 0 ? "+" : "";
  return `${sign}${rate.toFixed(2)}%`;
}

export function ProfitCard({ isActive = true }: { isActive?: boolean }) {
  const { assetData, exchangeRates } = useAssetData();
  const usdRate = exchangeRates.USD;
  const [period, setPeriod] = useState<ProfitPeriod>("daily");

  const stocksWithPrice = assetData.stocks.filter(
    (s) => s.ticker && s.category !== "unlisted" && s.currentPrice && s.currentPrice > 0
  );

  const tickerList = stocksWithPrice
    .map((s) => normalizeTicker(s))
    .filter(Boolean)
    .join(",");

  const { data: refData, isLoading } = useQuery({
    queryKey: ["profit", period, tickerList],
    queryFn: () => fetchProfitRef(tickerList, period),
    staleTime: 5 * 60 * 1000,
    enabled: isActive && stocksWithPrice.length > 0,
  });

  if (stocksWithPrice.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>수익 차트</CardTitle>
          <CardDescription>보유 주식의 기간별 수익</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex h-48 items-center justify-center rounded-lg border border-dashed">
            <p className="text-muted-foreground text-sm">현재가가 등록된 주식이 없습니다.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // 종목별 수익 계산
  const stockProfits = stocksWithPrice.map((stock) => {
    const ticker = normalizeTicker(stock);
    const ref = refData?.[ticker];
    const currentPrice = stock.currentPrice ?? 0;
    const rate = (stock.currency === "USD" && !DOMESTIC_CATEGORIES.has(stock.category)) ? usdRate : 1;

    if (!ref) {
      return { stock, ticker, profitAmount: 0, profitRate: null as number | null, currentValue: currentPrice * stock.quantity * rate, hasRef: false };
    }

    const currentValue = currentPrice * stock.quantity * rate;
    const refValue = ref.refPrice * stock.quantity * rate;
    const profitAmount = currentValue - refValue;
    const profitRate = refValue > 0 ? (profitAmount / refValue) * 100 : 0;


    return { stock, ticker, profitAmount, profitRate, currentValue, hasRef: true, refDate: ref.refDate };
  });

  const totalCurrentValue = stockProfits.reduce((s, r) => s + r.currentValue, 0);
  const totalProfit = stockProfits.filter((r) => r.hasRef).reduce((s, r) => s + r.profitAmount, 0);
  const totalRefValue = totalCurrentValue - totalProfit;
  const totalRate = totalRefValue > 0 ? (totalProfit / totalRefValue) * 100 : 0;

  const krRefDate = stockProfits.find((r) => r.hasRef && DOMESTIC_CATEGORIES.has(r.stock.category))?.refDate;
  const usRefDate = stockProfits.find((r) => r.hasRef && r.stock.category === "foreign")?.refDate;

  const grouped = CATEGORY_GROUPS.map(({ key, label, color }) => {
    const items = stockProfits.filter((r) => r.stock.category === key);
    const catProfit = items.filter((r) => r.hasRef).reduce((s, r) => s + r.profitAmount, 0);
    const catRef = items.filter((r) => r.hasRef).reduce((s, r) => s + (r.currentValue - r.profitAmount), 0);
    const catRate = catRef > 0 ? (catProfit / catRef) * 100 : null;
    return { key, label, color, items, catProfit, catRate };
  }).filter(({ items }) => items.length > 0);

  const TrendIcon = totalProfit > 0 ? TrendingUp : totalProfit < 0 ? TrendingDown : Minus;

  return (
    <div className="grid grid-cols-1 gap-4 *:data-[slot=card]:shadow-xs">
      <Card>
        <CardHeader>
          <div className="space-y-1.5">
            <CardTitle>수익 차트</CardTitle>
            <CardDescription>보유 주식의 기간별 수익</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Tabs value={period} onValueChange={(v) => setPeriod(v as ProfitPeriod)}>
            <TabsList className={TAB_LIST}>
              {(Object.keys(PERIOD_LABELS) as ProfitPeriod[]).map((p) => (
                <TabsTrigger key={p} value={p} className={TAB_TRIGGER}>
                  {PERIOD_LABELS[p]}
                </TabsTrigger>
              ))}
            </TabsList>

            {(Object.keys(PERIOD_LABELS) as ProfitPeriod[]).map((p) => (
              <TabsContent key={p} value={p} forceMount className="data-[state=inactive]:hidden mt-4 space-y-4">
                {isLoading ? (
                  <div className="space-y-3">
                    <div className="rounded-lg border bg-muted/20 px-4 py-3 space-y-2 animate-pulse">
                      <div className="h-4 w-24 rounded bg-muted" />
                      <div className="h-6 w-36 rounded bg-muted" />
                    </div>
                    {stocksWithPrice.slice(0, 5).map((stock) => (
                      <div key={stock.id} className="rounded-lg border overflow-hidden">
                        <div className="flex items-center justify-between px-4 py-2.5">
                          <div className="flex items-center gap-2">
                            <span className="inline-block w-2 h-2 rounded-full bg-muted" />
                            <div className="h-3 w-16 rounded bg-muted animate-pulse" />
                          </div>
                          <div className="h-3 w-20 rounded bg-muted animate-pulse" />
                        </div>
                        <div className="divide-y">
                          {[stock].map((s) => (
                            <div key={s.id} className="grid grid-cols-[1fr_6rem] gap-x-2 px-4 py-2.5 items-center">
                              <div className="space-y-1">
                                <div className="h-3 w-24 rounded bg-muted animate-pulse" />
                                <div className="h-2.5 w-12 rounded bg-muted animate-pulse" />
                              </div>
                              <div className="h-3 w-16 rounded bg-muted animate-pulse ml-auto" />
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                    <p className="text-xs text-muted-foreground text-center py-1">
                      {PERIOD_LABELS[p]} 기준가 조회 중 ({stocksWithPrice.length}개 종목)...
                    </p>
                  </div>
                ) : (
                  <>
                    {/* 전체 요약 */}
                    <div className="rounded-lg border bg-muted/20 px-4 py-3 space-y-2">
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-2">
                          <TrendIcon className={`size-5 ${getProfitLossColor(totalProfit)}`} />
                          <div>
                            <p className="text-xs text-foreground">{PERIOD_LABELS[p]} 수익</p>
                            <p className={`text-base font-bold tabular-nums ${getProfitLossColor(totalProfit)}`}>
                              {totalProfit >= 0 ? "+" : ""}{formatShortCurrency(totalProfit)}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-muted-foreground">수익률</p>
                          <p className={`text-base font-bold tabular-nums ${getProfitLossColor(totalRate)}`}>
                            {formatRate(totalRate)}
                          </p>
                        </div>
                      </div>
                      {(krRefDate || usRefDate) && (
                        <div className="pt-1.5 border-t border-border/50 text-[10px] text-muted-foreground space-y-0.5">
                          {krRefDate && <p>국내 기준: {krRefDate} 종가</p>}
                          {usRefDate && <p>해외 기준: {usRefDate} 종가 (KST 06:00 마감)</p>}
                        </div>
                      )}
                    </div>

                    {/* 종목별 목록 */}
                    <div className="space-y-3">
                      {grouped.map(({ key, label, color, items, catProfit, catRate }) => (
                        <div key={key} className="rounded-lg border overflow-hidden">
                          <div className="flex items-center justify-between px-4 py-1.5 border" style={{ borderColor: MAIN_PALETTE[0] }}>
                            <div className="flex items-center gap-2">
                              <span className="inline-block w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
                              <span className="text-[12px] font-semibold text-muted-foreground">{label}</span>
                            </div>
                            {catRate !== null && (
                              <div className="flex items-center gap-5">
                                <span className={`text-[13px] tabular-nums ${getProfitLossColor(catProfit)}`}>
                                  {catProfit >= 0 ? "+" : ""}{formatShortCurrency(catProfit)} ({formatRate(catRate)})
                                </span>
                              </div>
                            )}
                          </div>
                          <div className="divide-y">
                            {items.map(({ stock, ticker, profitAmount, profitRate, hasRef }) => (
                              <div
                                key={stock.id}
                                className="grid grid-cols-[1fr_6rem] gap-x-2 px-4 py-2.5 items-center hover:bg-muted/30 transition-colors"
                              >
                                <div className="min-w-0">
                                  <p className="text-xs font-semibold truncate">{stock.name || ticker}</p>
                                  <p className="text-[10px] text-muted-foreground">{ticker}</p>
                                </div>
                                <div className="text-right">
                                  {hasRef ? (
                                    <p className={`text-xs tabular-nums font-medium ${getProfitLossColor(profitAmount)}`}>
                                      {profitAmount >= 0 ? "+" : ""}{formatShortCurrency(profitAmount)} ({profitRate !== null ? formatRate(profitRate) : "--"})
                                    </p>
                                  ) : (
                                    <Badge variant="outline" className="text-[9px] px-1 py-0 h-4">기준가 없음</Badge>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
