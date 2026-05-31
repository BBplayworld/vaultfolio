"use client";

import React, { useMemo } from "react";
import { formatShortCurrency } from "@/lib/number-utils";
import { Card, CardContent } from "@/components/ui/card";
import { computeStockMetrics, mergeStockGroup, assignColors, getMultiplier } from "@/app/(main)/asset/_components/views/detail/asset-detail-tabs";
import { StockCard, StockCategorySection, StockSummaryHeader, useFilteredStockData } from "@/app/(main)/asset/_components/views/detail/tabs/stock-tab";
import { AssetDonutChart } from "@/app/(main)/asset/_components/views/home/dashboard";
import { useAssetTreemapData } from "@/app/(main)/asset/_components/views/home/dashboard";
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
  // 공통 훅 사용 — 중복 로직 없음
  const { treemapData, summary } = useAssetTreemapData();
  const { groupedStocks, totalValue: filteredTotal, totalProfit: filteredProfit, totalProfitRate: filteredProfitRate, exchangeRates, dailyProfit, dailyProfitRate } =
    useFilteredStockData(activeCategory);

  const { mergedStocks, mergedBarItems, mergedBarColors } = useMemo(() => {
    const merged = Array.from(groupedStocks.values()).map(mergeStockGroup);
    const barValues = merged.map(st => ({ value: st.quantity * st.currentPrice * getMultiplier(st.currency, exchangeRates) }));
    const barColors = assignColors(barValues);
    const barItems = merged.map((st, idx) => ({ stock: st, value: barValues[idx].value, color: barColors[idx] }));
    return { mergedStocks: merged, mergedBarItems: barItems, mergedBarColors: barColors };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupedStocks, exchangeRates]);

  const maskFn = hideAmounts ? (_: number) => "••••" : formatShortCurrency;

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
        <div className="rounded-lg bg-card py-2 space-y-3">
          <AssetDonutChart items={treemapData} netAsset={summary.netAsset} screenshotMode={true} maskFn={maskFn} />
        </div>
      )}

      {/* 주식 (종합 + 상세 통합) — stock-tab 본체와 동일 외피 */}
      {sections.stock && (
        <Card>
          <CardContent className="space-y-4 pt-4">
            <StockSummaryHeader
              totalValue={filteredTotal}
              totalProfit={filteredProfit}
              totalProfitRate={filteredProfitRate}
              currencyGain={activeCategory === "foreign" || activeCategory === "all" ? summary.stockCurrencyGain : 0}
              dailyProfit={dailyProfit}
              dailyProfitRate={dailyProfitRate}
              maskFn={maskFn}
              screenshotMode
            />
            <StockCategorySection
              activeCategory={activeCategory}
              onCategoryChange={onCategoryChange}
              filteredStocks={mergedStocks}
              totalValue={filteredTotal}
              barItems={mergedBarItems}
              barColors={mergedBarColors}
              emptyMessage="해당 카테고리에 보유 종목이 없습니다."
              screenshotMode
              renderItem={(stock, _isFirst, color) => {
                const m = computeStockMetrics(stock, exchangeRates, filteredTotal);
                return (
                  <StockCard
                    key={stock.id}
                    stock={stock}
                    color={color}
                    pct={m.pct}
                    currentVal={m.currentVal}
                    profit={m.profit}
                    profitRate={m.profitRate}
                    isForeign={m.isForeign}
                    krwMul={m.krwMul}
                    currencyGain={m.currencyGain}
                    currencyGainRate={m.currencyGainRate}
                    linkedLoans={[]}
                    onDelete={() => { }}
                    categoryLabels={[]}
                    screenshotMode
                    maskFn={maskFn}
                  />
                );
              }}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
