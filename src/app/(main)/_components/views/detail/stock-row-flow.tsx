"use client";

// 상세·주식 펼침 이름 줄 = 종목 한 장 입구(4.83 R-A) — 줄 전체가 버튼. 위줄 [이름 + ›] + 둘째 줄 `1년 주가 등락 +90.6%`,
// 아래에 전폭 밴드 80px(4.84): 1년 종가 선 + 가격 눈금 2~3줄 + 현재가 태그 + 내 평단 점선. 밴드는 aria-hidden(값은 버튼 aria-label에).
// 1년 데이터는 펼쳤을 때만 요청한다(open && 가격 흐름 있는 종목 && 인증카드 캡처 아님). 쿼리 키 = 종목 한 장과 같은 ["price-history", ticker, "1y"].
// 행 쿼리는 retryOnMount:false — 실패한 티커는 접었다 펴도 다시 요청하지 않는다(시세 서킷 보호, C2). 종목 한 장은 `다시 시도` 버튼으로 명시 재시도.
// 1년 %는 원본 points로, 평단은 종목 한 장과 같은 buildStockGroupHead로 계산(C65). 로딩·실패에서 높이 불변(밴드 80px 슬롯 예약).
import { useId } from "react";
import { ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ASSET_THEME, getProfitLossColor } from "@/config/theme";
import { useBoxSize } from "@/hooks/use-box-size";
import { usePriceHistory } from "@/hooks/use-price-history";
import { normalizeTicker } from "@/lib/finance/finance-service";
import type { PricePoint } from "@/lib/finance/price-history";
import { axisGutter, buildPriceAxis, buildRowFlow, buildStockGroupHead, downsample, hasPriceFlow, ROW_SPARK_POINTS, signedRate } from "@/lib/finance/stock-page";
import type { Stock } from "@/types/asset";
import { formatCurrencyDisplay, type StockDisplayCurrency } from "./asset-detail-tabs";
import { PriceAxisLayer } from "./price-axis-layer";

const BAND_H = "h-20"; // 80px — 로딩·성공·실패 모두 같은 높이(4.83 D1)
const BAND_M = { top: 8, bottom: 8, left: 2 };

// 밴드 SVG — 측정된 폭·높이(px)로 그린다(찌그러짐 없는 픽셀 좌표). 테스트가 w·h를 직접 넣을 수 있게 분리
export function RowBandChart({ points, avg, currentPrice, currency, colorClass, w, h }: {
  points: PricePoint[];
  avg: number | null;
  currentPrice: number;
  currency: string;
  colorClass: string;
  w: number;
  h: number;
}) {
  const gid = useId().replace(/:/g, "");
  const tagText = currentPrice > 0 ? formatCurrencyDisplay(currentPrice, currency) : undefined;
  const gutter = tagText ? axisGutter(tagText) : 12;
  const plotW = Math.max(1, w - BAND_M.left - gutter);
  const plotH = Math.max(1, h - BAND_M.top - BAND_M.bottom);
  // 눈금·도메인은 원본 points + 현재가 — 선만 40점으로 줄인다
  const axis = buildPriceAxis({ points, avg, price: currentPrice, currency, top: BAND_M.top, plotH });
  const drawn = downsample(points, ROW_SPARK_POINTS);
  const xOf = (i: number) => BAND_M.left + (i / (drawn.length - 1)) * plotW;
  const line = drawn.map((p, i) => `${i === 0 ? "M" : "L"}${xOf(i).toFixed(1)},${axis.yOf(p.c).toFixed(1)}`).join("");
  const area = `${line}L${xOf(drawn.length - 1).toFixed(1)},${BAND_M.top + plotH}L${xOf(0).toFixed(1)},${BAND_M.top + plotH}Z`;
  const avgShown = axis.avgY !== null && axis.clamped === "none"; // 범위 밖 평단은 점선·라벨 생략(4.83 규칙)
  return (
    <svg data-testid="stock-page-entry-spark" width={w} height={h} viewBox={`0 0 ${w} ${h}`} className={`block max-w-full ${colorClass}`}>
      <defs>
        <linearGradient id={`g${gid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity={0.12} />
          <stop offset="100%" stopColor="currentColor" stopOpacity={0} />
        </linearGradient>
      </defs>
      <PriceAxisLayer layer="grid" axis={axis} x0={BAND_M.left} plotW={plotW} h={h} />
      <path d={area} fill={`url(#g${gid})`} />
      <path d={line} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinejoin="round" strokeLinecap="round" />
      {avgShown && axis.avgY !== null && (
        <line x1={BAND_M.left} x2={BAND_M.left + plotW} y1={axis.avgY} y2={axis.avgY} className="stroke-foreground/40" strokeWidth={1.25} strokeDasharray="4 3" />
      )}
      <PriceAxisLayer
        layer="labels"
        axis={axis}
        x0={BAND_M.left}
        plotW={plotW}
        h={h}
        tagText={tagText}
        tagValue={currentPrice}
        colorClass={colorClass}
        avgGutterLabel={avgShown}
      />
    </svg>
  );
}

function RowBand({ points, avg, currentPrice, currency, colorClass }: { points: PricePoint[]; avg: number | null; currentPrice: number; currency: string; colorClass: string }) {
  const { ref, size } = useBoxSize({ w: 0, h: 0 });
  return (
    <div ref={ref} data-testid="stock-row-band" data-state="ready" aria-hidden className={`${BAND_H} basis-full motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200`}>
      {size.w > 0 && <RowBandChart points={points} avg={avg} currentPrice={currentPrice} currency={currency} colorClass={colorClass} w={size.w} h={size.h} />}
    </div>
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
  const rowFlow = buildRowFlow(flow, q);
  // 현재가 = 아래 `현재가` 칸(StockDetailGrid)과 같은 값·같은 formatter — 문자열이 같아야 한다(C65)
  const currentPrice = stock.currentPrice;
  const currency = stock.currency || "KRW";
  const priceText = currentPrice > 0 ? formatCurrencyDisplay(currentPrice, currency) : "";
  const ariaLabel =
    rowFlow.kind === "ready"
      ? `${stock.name} 주가 흐름과 평단 보기, 1년 등락 ${signedRate(rowFlow.change)}${priceText ? `, 현재가 ${priceText}` : ""}`
      : `${stock.name} 주가 흐름과 평단 보기`;

  return (
    <button
      type="button"
      data-testid="stock-page-entry"
      aria-label={ariaLabel}
      onClick={onOpen}
      className={`flex min-h-14 w-full flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2.5 text-left outline-none hover:bg-muted/60 active:bg-muted/70 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/50 motion-safe:transition-[background-color] motion-safe:duration-150 ${ASSET_THEME.cardSection}`}
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
        <span className="min-h-5 text-sm text-muted-foreground tabular-nums whitespace-nowrap">
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
      <ChevronRight aria-hidden className="size-5 shrink-0 text-muted-foreground" />
      {rowFlow.kind === "ready" ? (
        <RowBand points={rowFlow.points} avg={avg} currentPrice={currentPrice} currency={currency} colorClass={getProfitLossColor(rowFlow.change)} />
      ) : rowFlow.kind === "loading" ? (
        <span data-testid="stock-row-band" data-state="loading" aria-hidden className={`${BAND_H} basis-full rounded bg-muted/60 motion-safe:animate-pulse`} />
      ) : rowFlow.kind === "fallback" ? (
        <span data-testid="stock-page-entry-spark-slot" aria-hidden className={`${BAND_H} basis-full`} />
      ) : null}
    </button>
  );
}
