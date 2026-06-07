"use client";

import { Microscope, ChevronRight } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Stock } from "@/types/asset";
import { ExchangeRates } from "@/lib/finance-service";
import { pickHighlights } from "@/lib/xray/stock-xray";
import { fetchAndStoreClassifications } from "@/lib/xray/fetch-classifications";
import { groupStocksByTicker, mergeStockGroup } from "../asset-detail-tabs";
import { useAssetNavigation } from "../../../layout/navigation/navigation-context";

interface StockInsightStripProps {
  stocks: Stock[];
  exchangeRates?: ExchangeRates;
}

/**
 * 자산 카드 하단 인사이트 스트립 (Pattern 3)
 * - 한 줄 요약: 가장 집중된 1~2개 축
 * - 클릭 → 주식 X-Ray 페이지 이동
 * - 인증샷(ShareCard) DOM에는 포함되지 않음 — 자동 제외됨
 * - data-screenshot-hide: 향후 전체 화면 캡처 시 제외를 위한 마커 (현 구현에선 무영향)
 */
export function StockInsightStrip({ stocks, exchangeRates }: StockInsightStripProps) {
  const { navigate } = useAssetNavigation();
  const [tick, setTick] = useState(0);

  // 주식 목록이 바뀌면 분류 미수집 ticker만 모아 백그라운드 fetch
  useEffect(() => {
    let mounted = true;
    fetchAndStoreClassifications(stocks).then(() => {
      if (mounted) setTick((v) => v + 1);
    });
    return () => {
      mounted = false;
    };
  }, [stocks]);

  // 증권사별 분리 항목을 ticker 단위로 병합 (집계 시 1회만 카운트)
  const mergedStocks = useMemo(() => {
    const grouped = groupStocksByTicker(stocks);
    return Array.from(grouped.values()).map((g) => mergeStockGroup(g));
  }, [stocks]);

  const highlights = useMemo(
    () => pickHighlights(mergedStocks, exchangeRates),
    // tick 의존성으로 localStorage 갱신 반영
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mergedStocks, exchangeRates, tick],
  );

  // 분석할 종목이 없거나 분포가 모두 미분류면 노출 생략
  if (stocks.length === 0 || highlights.length === 0) return null;

  const summary = highlights.map((h) => h.label).join(" · ");

  return (
    <button
      type="button"
      data-screenshot-hide
      onClick={() => navigate({ type: "detail", tab: "stocks-xray" })}
      className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors text-left"
      aria-label="주식 X-Ray 인사이트 보기"
    >
      <Microscope className="size-4 shrink-0 text-primary" />
      <div className="flex flex-col flex-1 min-w-0">
        <span className="text-[10px] font-semibold text-muted-foreground tracking-wide">
          🔬 X-RAY 인사이트
        </span>
        <span className="text-xs sm:text-sm font-medium truncate">{summary}</span>
      </div>
      <span className="text-[11px] text-muted-foreground shrink-0">분석</span>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
    </button>
  );
}
