"use client";

// 상세·주식 펼침 이름 줄 = 종목 한 장 입구(4.83 R-A) — 줄 전체가 버튼. 둘째 줄 `1년 주가 등락 +90.6%` + 오른쪽 스파크라인(1년 종가 + 내 평단 점선) + ›.
// 1년 데이터는 펼쳤을 때만 요청한다(open && 가격 흐름 있는 종목 && 인증카드 캡처 아님). 쿼리 키 = 종목 한 장과 같은 ["price-history", ticker, "1y"].
// 행 쿼리는 retryOnMount:false — 실패한 티커는 접었다 펴도 다시 요청하지 않는다(시세 서킷 보호, C2). 종목 한 장은 `다시 시도` 버튼으로 명시 재시도.
// 1년 %는 원본 points로, 평단은 종목 한 장과 같은 buildStockGroupHead로 계산(C65). 로딩·실패에서 높이 불변(둘째 줄 고정·스파크 칸 예약).
import { ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ASSET_THEME, getProfitLossColor } from "@/config/theme";
import { usePriceHistory } from "@/hooks/use-price-history";
import { normalizeTicker } from "@/lib/finance/finance-service";
import { buildRowFlow, buildStockGroupHead, hasPriceFlow, ROW_SPARK_H, ROW_SPARK_W, signedRate } from "@/lib/finance/stock-page";
import type { Stock } from "@/types/asset";
import type { StockDisplayCurrency } from "./asset-detail-tabs";

const SPARK_SIZE = "h-8 w-[72px] min-[360px]:w-24 sm:w-[120px] lg:w-40";

function Sparkline({ geom, colorClass }: { geom: NonNullable<Extract<ReturnType<typeof buildRowFlow>, { kind: "ready" }>["geom"]>; colorClass: string }) {
  return (
    <svg
      data-testid="stock-page-entry-spark"
      aria-hidden
      viewBox={`0 0 ${ROW_SPARK_W} ${ROW_SPARK_H}`}
      preserveAspectRatio="none"
      className={`${SPARK_SIZE} shrink-0 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200`}
    >
      {geom.avgY !== null && (
        <line x1={0} x2={ROW_SPARK_W} y1={geom.avgY} y2={geom.avgY} className="stroke-foreground/40" strokeWidth={1.25} strokeDasharray="4 3" vectorEffect="non-scaling-stroke" />
      )}
      <polyline points={geom.line} fill="none" stroke="currentColor" className={colorClass} strokeWidth={1.75} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export function StockPageEntry({ stock, groupItems, displayCurrency, exchangeRates, open, screenshotMode = false, categoryLabels, marketLabel, onOpen }: {
  stock: Stock;
  groupItems: Stock[];
  displayCurrency: StockDisplayCurrency;
  exchangeRates: { USD: number; JPY: number };
  open: boolean;
  screenshotMode?: boolean;
  categoryLabels?: string[];
  marketLabel?: string;
  onOpen: () => void;
}) {
  // 종목 한 장과 같은 그룹 머리(합산 평단)·같은 티커 키
  const head = buildStockGroupHead(groupItems, exchangeRates, displayCurrency);
  const ticker = normalizeTicker(head.merged).toUpperCase();
  const flow = !!ticker && groupItems.some(hasPriceFlow);
  const q = usePriceHistory(ticker, "1y", open && flow && !screenshotMode, { retryOnMount: false });
  const avg = head.averagePrice > 0 ? head.averagePrice : null;
  const rowFlow = buildRowFlow(flow, q, avg);

  return (
    <button
      type="button"
      data-testid="stock-page-entry"
      aria-label={`${stock.name} 주가 흐름과 평단 보기`}
      onClick={onOpen}
      className={`flex min-h-14 w-full items-center gap-3 px-4 py-2.5 text-left outline-none hover:bg-muted/60 active:bg-muted/70 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/50 motion-safe:transition-[background-color] motion-safe:duration-150 ${ASSET_THEME.cardSection}`}
    >
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1">
          <span className="break-all text-sm font-semibold text-foreground">{stock.name}</span>
          {stock.ticker && (
            <span className="font-mono text-sm font-medium text-muted-foreground">
              ({stock.ticker}{marketLabel ? ` · ${marketLabel}` : ""})
            </span>
          )}
          {categoryLabels?.map((label) => (
            <Badge key={label} variant="outline" className={`${ASSET_THEME.categoryBox} py-0 text-[9px] leading-tight sm:text-[10px]`}>{label}</Badge>
          ))}
        </span>
        <span className="min-h-5 text-sm text-muted-foreground tabular-nums">
          {rowFlow.kind === "none" ? (
            <span data-testid="stock-page-entry-fallback">내 평단 보기</span>
          ) : rowFlow.kind === "fallback" ? (
            <span data-testid="stock-page-entry-fallback">주가 흐름과 내 평단 보기</span>
          ) : (
            <>
              1년 주가 등락{" "}
              {rowFlow.kind === "ready" ? (
                <span data-testid="stock-page-entry-change" className={`font-semibold ${getProfitLossColor(rowFlow.change)}`}>{signedRate(rowFlow.change)}</span>
              ) : (
                <span aria-hidden className="inline-block h-4 w-12 rounded bg-muted align-middle motion-safe:animate-pulse" />
              )}
            </>
          )}
        </span>
      </span>
      {rowFlow.kind === "ready" && rowFlow.geom ? (
        <Sparkline geom={rowFlow.geom} colorClass={getProfitLossColor(rowFlow.change)} />
      ) : rowFlow.kind === "loading" ? (
        <span aria-hidden className={`${SPARK_SIZE} shrink-0 rounded bg-muted/60 motion-safe:animate-pulse`} />
      ) : null}
      <ChevronRight aria-hidden className="size-5 shrink-0 text-muted-foreground" />
    </button>
  );
}
