"use client";

import React, { useMemo } from "react";
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, LabelList } from "recharts";
import { formatShortCurrency } from "@/lib/number-utils";
import { MAIN_PALETTE } from "@/config/theme";
import { getPurchaseRatePerUnit } from "@/app/(main)/asset/_components/main-nav/detail/asset-detail-tabs";
import { CATEGORY_TABS, StockBarChart, StockRowItem, StockSummaryHeader, useFilteredStockData } from "@/app/(main)/asset/_components/main-nav/detail/tabs/stock-tab";
import { AssetDonutChart } from "@/app/(main)/asset/_components/main-nav/home/dashboard";
import { useAssetTreemapData } from "@/app/(main)/asset/_components/main-nav/home/dashboard";
import { DailyAssetSnapshot } from "@/types/asset";
import { STORAGE_KEYS } from "@/lib/asset-storage";
import { SectionVisibility } from "./share-screenshot-dialog";
import { APP_CONFIG } from "@/config/app";

export interface ShareCardProps {
  hideAmounts: boolean;
  activeCategory: string;
  onCategoryChange: (cat: string) => void;
  sections: SectionVisibility;
  cardRef: React.RefObject<HTMLDivElement>;
}

export function ShareCard({ hideAmounts, activeCategory, onCategoryChange, sections, cardRef }: ShareCardProps) {
  // 공통 훅 사용 — 중복 로직 없음
  const { treemapData, summary } = useAssetTreemapData();
  const { filteredStocks, totalValue: filteredTotal, totalProfit: filteredProfit, totalProfitRate: filteredProfitRate, barItems: stockBarItems, barColors: stockBarColors, mul } =
    useFilteredStockData(activeCategory);

  const maskFn = hideAmounts ? (_: number) => "••••" : formatShortCurrency;

  // 일별 스냅샷 — 당월 데이터
  const dailySnapshots = useMemo((): DailyAssetSnapshot[] => {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.dailySnapshots);
      if (!raw) return [];
      const all: DailyAssetSnapshot[] = JSON.parse(raw);
      return [...all].sort((a, b) => a.date.localeCompare(b.date));
    } catch { return []; }
  }, []);

  const now = new Date().toLocaleString("ko-KR", {
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });

  return (
    <div ref={cardRef} className="space-y-3 p-4 rounded-2xl bg-card border border-border">

      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center ml-1 gap-2">
          <span className="text-sm font-bold text-primary">{APP_CONFIG.name}</span>
        </div>
        <span className="text-[11px] text-muted-foreground">{now}</span>
      </div>

      {/* 섹션1: 자산 분포 도넛 */}
      {sections.donut && treemapData.length > 0 && (
        <div className="rounded-lg border border-border bg-card px-4 py-1">
          <div className="inline-block px-1 mb-1 rounded-md bg-secondary text-secondary-foreground text-[10px] font-bold">
            자산 분포 차트
          </div>
          <AssetDonutChart items={treemapData} netAsset={summary.netAsset} screenshotMode={true} maskFn={maskFn} />
        </div>
      )}

      {/* 섹션2: 일별 순자산 미니 차트 */}
      {sections.chart && dailySnapshots.length > 1 && (
        <div className="rounded-lg border border-border bg-card px-4 py-1">
          <div className="inline-block px-1 py-1 mb-2 rounded-md bg-secondary text-secondary-foreground text-[10px] font-bold">
            순자산 추이 차트
          </div>
          <div style={{ height: 120 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dailySnapshots} margin={{ top: 20, right: 24, bottom: 0, left: 24 }}>
                <defs>
                  <linearGradient id="shareNetAssetGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={MAIN_PALETTE[0]} stopOpacity={0.4} />
                    <stop offset="95%" stopColor={MAIN_PALETTE[0]} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 9, fill: "var(--muted-foreground)" }}
                  tickFormatter={(d: string) => d.slice(5)}
                  axisLine={false}
                  tickLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  width={0}
                  domain={["auto", "auto"]}
                  axisLine={false}
                  tickLine={false}
                  tick={false}
                />
                <Area
                  type="monotone"
                  dataKey="netAsset"
                  stroke={MAIN_PALETTE[0]}
                  strokeWidth={2}
                  fill="url(#shareNetAssetGrad)"
                  dot={{ r: 3, fill: MAIN_PALETTE[0], strokeWidth: 0 }}
                  isAnimationActive={false}
                >
                  <LabelList
                    dataKey="netAsset"
                    position="top"
                    offset={10}
                    formatter={(value: number) => formatShortCurrency(value)}
                    style={{ fontSize: 9, fill: "var(--foreground)", fontWeight: 600 }}
                  />
                </Area>
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* 섹션3: 주식 요약 헤더 */}
      {sections.stockHeader && (
        <div className="rounded-lg border border-border bg-card px-4 py-2 space-y-3">
          <div className="inline-block px-2.5 py-1 rounded-md bg-secondary text-secondary-foreground text-[10px] font-bold">
            주식 현황 요약
          </div>
          <StockSummaryHeader
            totalValue={filteredTotal}
            totalProfit={filteredProfit}
            totalProfitRate={filteredProfitRate}
            currencyGain={summary.stockCurrencyGain}
            maskFn={maskFn}
            screenshotMode={true}
          />
        </div>
      )}

      {/* 섹션4: 카테고리 탭 + 비중바 + 종목 목록 통합 */}
      {sections.stockList && (
        <div className="rounded-lg border border-border bg-card px-4 py-2 space-y-3">
          <div className="inline-block px-2.5 py-1 rounded-md bg-secondary text-secondary-foreground text-[10px] font-bold">
            보유 종목 목록
          </div>
          {/* 카테고리 탭 */}
          <div className="flex p-1 rounded-lg border border-border bg-muted/30 w-full flex-wrap gap-1 justify-center">
            {CATEGORY_TABS.map((tab) => (
              <button
                key={tab.value}
                onClick={() => onCategoryChange(tab.value)}
                className={`rounded-md px-3.5 py-1 text-[11px] font-medium transition-all ${activeCategory === tab.value
                  ? "bg-background border border-border text-foreground font-semibold shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {filteredStocks.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">해당 카테고리에 보유 종목이 없습니다.</p>
          ) : (
            <>
              {/* 비중 바 */}
              <StockBarChart items={stockBarItems} total={filteredTotal} />

              {/* 종목별 손익 요약 헤더 */}
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-muted-foreground">보유 종목</span>
                <span className={`font-bold tabular-nums ${filteredProfit >= 0 ? "text-rose-500 dark:text-rose-400" : "text-blue-500 dark:text-blue-400"}`}>
                  {filteredProfit >= 0 ? "+" : ""}{maskFn(Math.round(filteredProfit))}
                  {" "}({filteredProfitRate >= 0 ? "+" : ""}{filteredProfitRate.toFixed(2)}%)
                </span>
              </div>

              {/* 종목 로우 */}
              {activeCategory === "all" ? (
                <div className="space-y-4 pt-1">
                  {CATEGORY_TABS.filter((c) => c.value !== "all").map((cat) => {
                    const catStocks = filteredStocks.filter((s) => s.category === cat.value);
                    if (catStocks.length === 0) return null;
                    return (
                      <div key={cat.value}>
                        <p className="text-xs font-semibold text-muted-foreground px-1 pb-1.5">{cat.label}</p>
                        <div className="space-y-1">
                          {catStocks.map((stock) => {
                            const idx = filteredStocks.findIndex((s) => s.id === stock.id);
                            const krwMul = mul(stock.currency);
                            const isForeign = stock.category === "foreign" && stock.currency !== "KRW";
                            const purchaseRate = getPurchaseRatePerUnit(stock, krwMul);
                            const currentVal = stock.quantity * stock.currentPrice * krwMul;
                            const cost = isForeign
                              ? stock.quantity * stock.averagePrice * purchaseRate
                              : stock.quantity * stock.averagePrice * krwMul;
                            const profit = currentVal - cost;
                            const profitRate = cost > 0 ? (profit / cost) * 100 : 0;
                            const pct = filteredTotal > 0 ? (currentVal / filteredTotal) * 100 : 0;
                            return (
                              <StockRowItem
                                key={stock.id}
                                stock={stock}
                                color={stockBarColors[idx] ?? MAIN_PALETTE[0]}
                                pct={pct}
                                currentVal={currentVal}
                                profit={profit}
                                profitRate={profitRate}
                                maskFn={maskFn}
                                screenshotMode={true}
                              />
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="space-y-1">
                  {filteredStocks.map((stock, idx) => {
                    const krwMul = mul(stock.currency);
                    const isForeign = stock.category === "foreign" && stock.currency !== "KRW";
                    const purchaseRate = getPurchaseRatePerUnit(stock, krwMul);
                    const currentVal = stock.quantity * stock.currentPrice * krwMul;
                    const cost = isForeign
                      ? stock.quantity * stock.averagePrice * purchaseRate
                      : stock.quantity * stock.averagePrice * krwMul;
                    const profit = currentVal - cost;
                    const profitRate = cost > 0 ? (profit / cost) * 100 : 0;
                    const pct = filteredTotal > 0 ? (currentVal / filteredTotal) * 100 : 0;
                    return (
                      <StockRowItem
                        key={stock.id}
                        stock={stock}
                        color={stockBarColors[idx] ?? MAIN_PALETTE[0]}
                        pct={pct}
                        currentVal={currentVal}
                        profit={profit}
                        profitRate={profitRate}
                        maskFn={maskFn}
                        screenshotMode={true}
                      />
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* 워터마크 */}
      <p className="text-right text-[10px] text-muted-foreground">© SecretAsset</p>
    </div>
  );
}
