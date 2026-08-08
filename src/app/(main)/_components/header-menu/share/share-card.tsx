"use client";

import React from "react";
import { formatShortCurrency } from "@/lib/number-utils";
import { computeStockMetrics } from "@/app/(main)/_components/views/detail/asset-detail-tabs";
import {
  useFilteredStockData,
  StockSummaryHeader,
  StockCategorySection,
  StockCard,
} from "@/app/(main)/_components/views/detail/tabs/stock-tab";
import { useAssetData } from "@/contexts/asset-data-context";
import { APP_CONFIG } from "@/config/app";

// 인증카드 축약 상수 — 비중 바·종목 리스트 모두 상위 N개만 노출하고 나머지는 "기타"/"외 N종목"으로 집계
const SHOT_MAX = 5;

export interface ShareCardProps {
  hideAmounts: boolean;
  cardRef: React.RefObject<HTMLDivElement>;
}

export function ShareCard({ hideAmounts, cardRef }: ShareCardProps) {
  const { assetData, exchangeRates } = useAssetData();
  // 주식 탭과 동일한 단일 출처 — 전체 카테고리 기준. 내부에서 tickerList를 정렬해
  // 캐시 키를 공유하므로 주식 탭과 중복 fetch가 생기지 않는다.
  const {
    groupedStocks,
    groupKeyOf,
    mergedStocks,
    totalValue,
    totalProfit,
    totalProfitRate,
    barItems,
    barColors,
    summary,
    marketMap,
  } = useFilteredStockData("all");

  // 금액류만 마스킹 — 비중%·수익률%는 항상 노출
  const mask = hideAmounts ? (_: number) => "••••" : formatShortCurrency;

  const now = new Date().toLocaleDateString("ko-KR", {
    year: "numeric", month: "2-digit", day: "2-digit",
  });
  const siteHost = APP_CONFIG.siteUrl.replace(/^https?:\/\//, "");

  return (
    <div ref={cardRef} className="p-3 rounded-2xl bg-background dark:bg-card">

      {/* 요약 헤더 — 주식 탭과 동일 컴포넌트(총 주식 평가금액 + 평가손익) */}
      <StockSummaryHeader
        totalValue={totalValue}
        totalProfit={totalProfit}
        totalProfitRate={totalProfitRate}
        currencyGain={summary.stockCurrencyGain}
        maskFn={mask}
        screenshotMode
      />

      {/* 비중 바(상위 5 + 기타) + 종목 리스트(상위 5 + 외 N종목) — 주식 탭과 동일 컴포넌트.
          배경색 없이 카드 전체 배경과 통일하고, 패딩은 간격 계산(헤더 mt-3.5 등)을 위해 유지한다.
          헤더는 하단 패딩 0이라 여기 마진(14px) + 이 박스의 상단 패딩(p-3.5=14px)을 더해야
          범례~리스트 간격(mt-7=28px)과 실제 노출 여백이 같아진다. */}
      <div className="mt-3.5 rounded-lg p-3.5">
        <StockCategorySection
          activeCategory="all"
          onCategoryChange={() => { /* 인증카드는 카테고리 고정 */ }}
          filteredStocks={mergedStocks}
          totalValue={totalValue}
          barItems={barItems}
          barColors={barColors}
          screenshotMode
          maxItems={SHOT_MAX}
          maskFn={mask}
          exchangeRates={exchangeRates}
          renderItem={(stock, _isFirst, color) => {
            const groupKey = groupKeyOf(stock);
            const groupItems = groupedStocks.get(groupKey) ?? [stock];
            const m = computeStockMetrics(stock, exchangeRates, totalValue);
            const linkedLoans = groupItems.flatMap((s) => assetData.loans.filter((l) => l.linkedStockId === s.id));
            return (
              <StockCard
                key={groupKey}
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
                linkedLoans={linkedLoans}
                onDelete={() => { /* 인증카드는 읽기 전용 */ }}
                categoryLabels={[]}
                groupItems={groupItems}
                exchangeRates={exchangeRates}
                totalValue={totalValue}
                marketMap={marketMap}
                screenshotMode
                maskFn={mask}
              />
            );
          }}
        />
      </div>

      {/* 푸터 — 브랜드명 + 도메인 + 날짜. 좌우 여백은 위 헤더·비중 바·리스트와 동일(18px),
          하단 패딩(pb-2)도 헤더의 상단 패딩(pt-2)과 맞춰 카드 최상단~"총 주식 평가금액"과
          "시크릿에셋"~카드 최하단 간격이 같아지게 한다.
          리스트~푸터 실제 노출 간격 = 마진(mt-1.5=6px) + 마지막 행 자체 하단 패딩(cardHeader py-2=8px)
          + 비중바·리스트 래퍼 하단 패딩(p-3.5=14px) = 28px로, 범례~리스트(순수 mt-7=28px)와 동일하다. */}
      <div className="mt-1.5 flex items-center justify-between px-[18px] pb-2">
        <div className="flex items-baseline gap-1.5">
          <span className="text-xs text-foreground font-semibold">{APP_CONFIG.name}</span>
          <span className="text-sm text-muted-foreground">{siteHost}</span>
        </div>
        <span className="text-sm text-muted-foreground">{now}</span>
      </div>
    </div>
  );
}
