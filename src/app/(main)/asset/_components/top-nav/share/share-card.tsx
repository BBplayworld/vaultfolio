"use client";

import React, { useMemo } from "react";
import { useTheme } from "next-themes";
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, LabelList } from "recharts";
import { formatShortCurrency } from "@/lib/number-utils";
import { MAIN_PALETTE } from "@/config/theme";
import { computeStockMetrics } from "@/app/(main)/asset/_components/main-nav/detail/asset-detail-tabs";
import { StockCategorySection, StockRowItem, StockSummaryHeader, useFilteredStockData } from "@/app/(main)/asset/_components/main-nav/detail/tabs/stock-tab";
import { AssetDonutChart } from "@/app/(main)/asset/_components/main-nav/home/dashboard";
import { useAssetTreemapData } from "@/app/(main)/asset/_components/main-nav/home/dashboard";
import { DailyAssetSnapshot } from "@/types/asset";
import { STORAGE_KEYS } from "@/lib/asset-storage";
import { SectionVisibility, SECTION_OPTIONS } from "./share-menu";
import { APP_CONFIG } from "@/config/app";

const sectionLabel = (key: keyof SectionVisibility) =>
  SECTION_OPTIONS.find((o) => o.key === key)?.label ?? key;

export interface ShareCardProps {
  hideAmounts: boolean;
  activeCategory: string;
  onCategoryChange: (cat: string) => void;
  sections: SectionVisibility;
  cardRef: React.RefObject<HTMLDivElement>;
}

export function ShareCard({ hideAmounts, activeCategory, onCategoryChange, sections, cardRef }: ShareCardProps) {
  const { resolvedTheme } = useTheme();
  // 공통 훅 사용 — 중복 로직 없음
  const { treemapData, summary } = useAssetTreemapData();
  const { filteredStocks, totalValue: filteredTotal, totalProfit: filteredProfit, totalProfitRate: filteredProfitRate, barItems: stockBarItems, barColors: stockBarColors, exchangeRates, dailyProfit, dailyProfitRate } =
    useFilteredStockData(activeCategory);

  const maskFn = hideAmounts ? (_: number) => "••••" : formatShortCurrency;

  // 일별 스냅샷 — 당월 데이터
  const dailySnapshots = useMemo((): DailyAssetSnapshot[] => {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.dailySnapshots);
      if (!raw) return [];
      const all: DailyAssetSnapshot[] = JSON.parse(raw);
      return [...all]
        .filter(s => { const d = new Date(s.date).getDay(); return d !== 0 && d !== 6; })
        .sort((a, b) => a.date.localeCompare(b.date));
    } catch { return []; }
  }, []);

  const now = new Date().toLocaleString("ko-KR", {
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });

  return (
    <div ref={cardRef} className="space-y-3 p-3 rounded-2xl bg-card border border-border">

      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center ml-1 gap-2">
          <span className="text-sm font-bold text-primary">{APP_CONFIG.name}</span>
        </div>
        <span className="text-[11px] text-muted-foreground">{now}</span>
      </div>

      {/* 섹션1: 자산 분포 도넛 */}
      {sections.donut && treemapData.length > 0 && (
        <div className="rounded-lg bg-card px-3 py-1">
          <div className="inline-block px-1 mb-1 rounded-md bg-secondary text-secondary-foreground text-[10px] font-bold">
            {sectionLabel("donut")}
          </div>
          <AssetDonutChart items={treemapData} netAsset={summary.netAsset} screenshotMode={true} maskFn={maskFn} />
        </div>
      )}

      {/* 섹션2: 일별 순자산 미니 차트 */}
      {sections.chart && dailySnapshots.length > 0 && (
        <div className="rounded-lg bg-card px-3 py-1">
          <div className="inline-block px-1 py-1 mb-2 rounded-md bg-secondary text-secondary-foreground text-[10px] font-bold">
            {sectionLabel("chart")}
          </div>
          <div style={{ height: 160 }}>
            <ResponsiveContainer width="100%" height="100%">
              {(() => {
                const chartData = dailySnapshots.slice(-5);
                return (
                  <AreaChart data={chartData} margin={{ top: 46, right: 28, bottom: 0, left: 28 }}>
                    <defs>
                      <linearGradient id="shareNetAssetGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={MAIN_PALETTE[0]} stopOpacity={0.4} />
                        <stop offset="95%" stopColor={MAIN_PALETTE[0]} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                      tickFormatter={(d: string) => { const dow = ["일","월","화","수","목","금","토"][new Date(d).getDay()]; return `${d.slice(5)} (${dow})`; }}
                      axisLine={false}
                      tickLine={false}
                      interval={0}
                    />
                    <YAxis width={0} domain={["auto", "auto"]} axisLine={false} tickLine={false} tick={false} />
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
                        content={({ x, y, value, index }) => {
                          if (value == null || x == null || y == null || index == null) return null;
                          const cur = Number(value);
                          const prev = index > 0 ? chartData[index - 1].netAsset : null;
                          const diff = prev != null ? cur - prev : null;
                          const isAbove = index % 2 === 0;
                          const baseY = Number(y);
                          const cx = Number(x);
                          const diffColor = diff == null ? "var(--muted-foreground)" : diff > 0 ? "#e11d48" : diff < 0 ? "#3b82f6" : "var(--muted-foreground)";
                          const diffColorDark = diff == null ? "var(--muted-foreground)" : diff > 0 ? "#fb7185" : diff < 0 ? "#60a5fa" : "var(--muted-foreground)";
                          const fillDiff = resolvedTheme === "dark" ? diffColorDark : diffColor;
                          return (
                            <g>
                              {isAbove ? (
                                <>
                                  <text x={cx} y={baseY - 22} textAnchor="middle" fontSize={12} fontWeight={700} fill="var(--foreground)">{formatShortCurrency(cur)}</text>
                                  {diff != null && <text x={cx} y={baseY - 7} textAnchor="middle" fontSize={11} fontWeight={600} fill={fillDiff}>{diff >= 0 ? "+" : ""}{formatShortCurrency(diff)}</text>}
                                </>
                              ) : (
                                <>
                                  <text x={cx} y={baseY - 22} textAnchor="middle" fontSize={12} fontWeight={700} fill="var(--foreground)">{formatShortCurrency(cur)}</text>
                                  {diff != null && <text x={cx} y={baseY - 7} textAnchor="middle" fontSize={11} fontWeight={600} fill={fillDiff}>{diff >= 0 ? "+" : ""}{formatShortCurrency(diff)}</text>}
                                </>
                              )}
                            </g>
                          );
                        }}
                      />
                    </Area>
                  </AreaChart>
                );
              })()}
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* 섹션3: 주식 요약 헤더 */}
      {sections.stockHeader && (
        <div className="rounded-lg bg-card px-3 py-2 space-y-3">
          <div className="inline-block px-2.5 py-1 rounded-md bg-secondary text-secondary-foreground text-[10px] font-bold">
            {sectionLabel("stockHeader")}
          </div>
          <StockSummaryHeader
            totalValue={filteredTotal}
            totalProfit={filteredProfit}
            totalProfitRate={filteredProfitRate}
            currencyGain={activeCategory === "foreign" || activeCategory === "all" ? summary.stockCurrencyGain : 0}
            dailyProfit={dailyProfit}
            dailyProfitRate={dailyProfitRate}
            maskFn={maskFn}
            screenshotMode={true}
          />
        </div>
      )}

      {/* 섹션4: 카테고리 탭 + 비중바 + 종목 목록 통합 */}
      {sections.stockList && (
        <div className="rounded-lg bg-card px-3 py-2 space-y-3">
          <div className="inline-block px-2.5 py-1 rounded-md bg-secondary text-secondary-foreground text-[10px] font-bold">
            {sectionLabel("stockList")}
          </div>
          <StockCategorySection
            activeCategory={activeCategory}
            onCategoryChange={onCategoryChange}
            filteredStocks={filteredStocks}
            totalValue={filteredTotal}
            barItems={stockBarItems}
            barColors={stockBarColors}
            emptyMessage="해당 카테고리에 보유 종목이 없습니다."
            screenshotMode={true}
            renderItem={(stock, _isFirst, color) => {
              const m = computeStockMetrics(stock, exchangeRates, filteredTotal);
              return (
                <StockRowItem
                  key={stock.id}
                  stock={stock}
                  color={color}
                  pct={m.pct}
                  currentVal={m.currentVal}
                  profit={m.profit}
                  profitRate={m.profitRate}
                  maskFn={maskFn}
                  screenshotMode={true}
                />
              );
            }}
          />
        </div>
      )}

      {/* 워터마크 */}
      <p className="text-right text-[10px] text-muted-foreground">© SecretAsset</p>
    </div>
  );
}
