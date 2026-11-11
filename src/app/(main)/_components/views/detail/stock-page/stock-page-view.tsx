"use client";

// 종목 한 장(#157) — 한 종목의 가격 흐름 + 합산 평단선 + 매수 점. 나만 보는 화면(캡처·공유 대상 아님).
// 머리 값은 상세·주식 행과 같은 계산(buildStockGroupHead), 새 숫자는 차트 구간 등락 하나뿐이다.
import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ASSET_THEME, getProfitLossColor } from "@/config/theme";
import { stockCategories } from "@/config/asset-options";
import { useAssetData } from "@/contexts/asset-data-context";
import { usePriceHistory } from "@/hooks/use-price-history";
import { normalizeTicker } from "@/lib/finance/finance-service";
import type { PriceRange } from "@/lib/finance/price-history";
import {
  buildStockGroupHead,
  computePriceChange,
  hasPriceFlow,
  pickBuyTransactions,
  placeBuyDots,
} from "@/lib/finance/stock-page";
import { STORAGE_KEYS } from "@/lib/local-storage";
import { useStockPageStore } from "@/stores/stock-page-store";
import { useTradeViewStore } from "@/stores/trade-view-store";
import { InlineSelector } from "../../../layout/ui/inline-selector";
import { SECTION } from "../../../layout/ui/report-section";
import { toHash, useAssetNavigation } from "../../../layout/navigation/navigation-context";
import { BODY_ENTER } from "../../activity/change-hero";
import { formatPrice } from "../trades/stock-trades-view";
import { fmtDot, PriceChart } from "./price-chart";

const RANGE_OPTIONS: { value: PriceRange; label: string; testId: string }[] = [
  { value: "1y", label: "1년", testId: "stock-page-range-1y" },
  { value: "5y", label: "5년", testId: "stock-page-range-5y" },
];
const RANGE_LABEL: Record<PriceRange, string> = { "1y": "1년", "5y": "5년" };
const BOX_H = "h-48 min-[375px]:h-52 lg:h-72";
const STOCKS_VIEW = { type: "detail", tab: "stocks" } as const;

const signedRate = (v: number) => `${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(1)}%`;

export function StockPageView() {
  const { assetData } = useAssetData();
  const target = useStockPageStore((s) => s.target);
  const { navigate } = useAssetNavigation();

  const groupStocks = useMemo(
    () => (target ? assetData.stocks.filter((s) => target.groupStockIds.includes(s.id)) : []),
    [assetData.stocks, target],
  );
  const missing = !target || groupStocks.length === 0;

  // 새로고침·직접 URL·그룹 종목 삭제 — 상세·주식으로(주소를 바꿔 뒤로가기가 이 화면으로 되돌아오지 않게)
  useEffect(() => {
    if (!missing) return;
    window.history.replaceState(null, "", toHash(STOCKS_VIEW));
    navigate(STOCKS_VIEW);
  }, [missing, navigate]);

  if (missing) return null;
  return <StockPageBody target={target} />;
}

export function StockPageBody({ target }: { target: NonNullable<ReturnType<typeof useStockPageStore.getState>["target"]> }) {
  const { assetData, exchangeRates } = useAssetData();
  const { navigate } = useAssetNavigation();
  const setTradeTarget = useTradeViewStore((s) => s.setTarget);
  const setTradesFromStockPage = useStockPageStore((s) => s.setTradesFromStockPage);

  const groupStocks = useMemo(
    () => assetData.stocks.filter((s) => target.groupStockIds.includes(s.id)),
    [assetData.stocks, target],
  );
  const head = useMemo(
    () => buildStockGroupHead(groupStocks, exchangeRates, target.displayCurrency),
    [groupStocks, exchangeRates, target.displayCurrency],
  );

  const ticker = normalizeTicker(head.merged).toUpperCase();
  const flow = !!ticker && groupStocks.some(hasPriceFlow);
  const currency = head.merged.currency || "KRW";

  const [range, setRange] = useState<PriceRange>("1y");
  const [visited5y, setVisited5y] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const q1 = usePriceHistory(ticker, "1y", flow);
  const q5 = usePriceHistory(ticker, "5y", flow && visited5y);
  const q = range === "1y" ? q1 : q5;

  const changeRange = useCallback((next: PriceRange) => {
    if (next === "5y") setVisited5y(true);
    setRange(next);
    setSelected(null);
  }, []);

  const data = q.data;
  const points = useMemo(() => data?.points ?? [], [data]);
  const state: "loading" | "ready" | "error" | "empty" = !flow
    ? "empty"
    : q.isError
      ? "error"
      : !data
        ? "loading"
        : points.length === 0
          ? "empty"
          : "ready";

  const buys = useMemo(() => pickBuyTransactions(assetData.transactions ?? [], target.groupStockIds), [assetData.transactions, target.groupStockIds]);
  const { dots, outsideCount } = useMemo(
    () => (data ? placeBuyDots(points, buys, data.from ?? "0000-01-01", data.interval) : { dots: [], outsideCount: 0 }),
    [data, points, buys],
  );
  const change = useMemo(() => computePriceChange(points), [points]);
  const changeColor = change === null ? "" : getProfitLossColor(change);
  const avg = head.averagePrice > 0 ? head.averagePrice : null;

  const markets = useMemo<Record<string, string>>(() => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEYS.stockMarkets) ?? "{}") as Record<string, string>;
    } catch {
      return {};
    }
  }, []);
  const marketLabel = ticker ? markets[ticker] : undefined;
  const categoryLabels = Array.from(new Set(groupStocks.map((s) => s.category))).map(
    (c) => stockCategories.find((x) => x.value === c)?.label ?? c,
  );

  const tradeCount = useMemo(() => {
    const ids = new Set(target.groupStockIds);
    return (assetData.transactions ?? []).filter((tx) => ids.has(tx.stockId)).length;
  }, [assetData.transactions, target.groupStockIds]);

  const openTrades = () => {
    setTradeTarget({
      groupStockIds: target.groupStockIds,
      name: target.name,
      ticker: target.ticker,
      category: target.category,
      initialStockId: null,
    });
    setTradesFromStockPage(true);
    navigate({ type: "detail", tab: "stocks-trades" });
  };

  const selectedDot = selected === null ? null : dots.find((d) => d.index === selected) ?? null;
  const rangeLabel = RANGE_LABEL[range];
  const longName = head.merged.name.length > 40 ? head.merged.name : undefined;
  const basis = [
    `${range === "1y" ? "일별" : "주별"} 종가 기준이에요.`,
    "액면분할 등을 반영한 가격이에요. 점은 기록한 매수 날짜에 찍혀요.",
    currency === "USD" ? "달러 가격 기준이에요." : "",
    data?.listedFrom ? "상장 이후 기간만 있어요." : "",
  ].filter(Boolean).join(" ");
  const chartAria = `${rangeLabel} 주가 흐름${change !== null ? `, 등락 ${signedRate(change)}` : ""}${avg ? `, 내 평단 ${formatPrice(avg, currency)}` : ""}`;

  return (
    <div data-testid="stock-page" className="flex flex-col gap-5 min-w-0 break-keep">
      {/* 머리 — 제목 역할. 평가·내 수익은 상세·주식 행과 같은 계산 */}
      <section data-testid="stock-page-head" className={`${SECTION} ${BODY_ENTER} flex flex-col !gap-1`} style={{ animationFillMode: "backwards" }}>
        <h2 className="text-base font-semibold break-keep [overflow-wrap:anywhere] line-clamp-2" title={longName}>{head.merged.name}</h2>
        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[11px] text-muted-foreground">
          {ticker && <span className="font-mono">({head.merged.ticker}{marketLabel ? ` · ${marketLabel}` : ""})</span>}
          {categoryLabels.map((l) => (
            <Badge key={l} variant="outline" className={`${ASSET_THEME.categoryBox} text-[9px] sm:text-[10px] py-0 leading-tight`}>{l}</Badge>
          ))}
        </div>
        <p data-testid="stock-page-value" className="mt-1 text-2xl font-bold tabular-nums leading-tight text-foreground">{head.valueText}</p>
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="text-sm text-muted-foreground">내 수익</span>
          <span data-testid="stock-page-profit" className={`text-base font-semibold tabular-nums ${head.colorClass}`}>
            {head.profitText} {head.rateText}
          </span>
          <span data-testid="stock-page-quantity" className="ml-auto text-sm text-muted-foreground tabular-nums">총 {head.quantity.toLocaleString()}주</span>
        </div>
      </section>

      <section
        data-testid="stock-page-chart-card"
        className={`${SECTION} ${BODY_ENTER} !space-y-0 flex flex-col gap-3`}
        style={{ animationDelay: "40ms", animationFillMode: "backwards" }}
      >
        {state !== "empty" ? (
          <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 min-h-10">
            <div className="flex items-baseline gap-2">
              <span className="text-sm font-semibold">{rangeLabel} 주가 등락</span>
              {state === "loading" && <span className="inline-block h-4 w-12 rounded bg-muted motion-safe:animate-pulse" />}
              {state === "ready" && change !== null && (
                <span data-testid="stock-page-change" className={`text-sm font-semibold tabular-nums ${changeColor}`}>{signedRate(change)}</span>
              )}
            </div>
            <div data-testid="stock-page-range">
              <InlineSelector value={range} onChange={changeRange} options={RANGE_OPTIONS} size="sm" ariaLabel="기간 선택" />
            </div>
          </div>
        ) : null}

        <div
          data-testid="stock-page-chart"
          data-state={state}
          aria-busy={state === "loading"}
          className={`relative w-full ${BOX_H} ${state === "ready" ? "" : "rounded-lg bg-muted/40"} overflow-hidden`}
        >
          {state === "ready" && data && (
            <PriceChart
              points={points}
              dots={dots}
              avg={avg}
              currency={data.currency}
              interval={data.interval}
              colorClass={changeColor}
              selectedIndex={selected}
              onSelect={setSelected}
              ariaLabel={chartAria}
            />
          )}
          {state === "loading" && (
            <div className="flex h-full flex-col justify-evenly px-4 motion-safe:animate-pulse" aria-hidden>
              <span className="h-px bg-muted-foreground/20" />
              <span className="h-px bg-muted-foreground/20" />
              <span className="h-px bg-muted-foreground/20" />
            </div>
          )}
          {state === "error" && (
            <div data-testid="stock-page-error" className="flex h-full flex-col items-center justify-center gap-2">
              <p className="text-sm text-muted-foreground">가격 흐름을 불러오지 못했어요</p>
              <Button size="sm" variant="secondary" className="min-h-10" onClick={() => void q.refetch()}>다시 시도</Button>
            </div>
          )}
          {state === "empty" && (
            <div data-testid="stock-page-no-price" className="flex h-full items-center justify-center">
              <p className="text-sm text-muted-foreground">가격 흐름이 없는 종목이에요</p>
            </div>
          )}
        </div>

        {/* 상태 줄 — 선택한 점 > 거래 0건 > 창 밖. 차트 아래에 두어 차트가 움직이지 않게 */}
        {state !== "empty" && (
          <div aria-live="polite" className="min-h-10 text-[13px] flex flex-col justify-center motion-safe:animate-in motion-safe:fade-in motion-safe:duration-150" key={selectedDot ? selectedDot.index : "idle"}>
            {state !== "ready" ? null : selectedDot ? (
              <div data-testid="stock-page-buy-detail" className="flex flex-col gap-0.5 tabular-nums">
                {selectedDot.buys.slice(0, 3).map((b) => (
                  <p key={b.id}>{fmtDot(b.date)} 매수 {b.quantity.toLocaleString()}주 · {formatPrice(b.price, b.currency)}</p>
                ))}
                {selectedDot.buys.length > 3 && <p className="text-muted-foreground">외 {selectedDot.buys.length - 3}건</p>}
              </div>
            ) : buys.length === 0 ? (
              <p data-testid="stock-page-no-trades" className="text-xs text-muted-foreground">매수를 기록하면 산 날이 점으로 표시돼요</p>
            ) : outsideCount > 0 ? (
              range === "1y" ? (
                <button
                  type="button"
                  data-testid="stock-page-outside"
                  data-clickable="true"
                  onClick={() => changeRange("5y")}
                  className="min-h-10 w-full text-left text-sm"
                >
                  1년보다 전 매수 {outsideCount}건 · <span className="font-medium text-brand dark:text-indigo-300">5년에서 보기</span>
                </button>
              ) : (
                <p data-testid="stock-page-outside" data-clickable="false" className="text-sm text-muted-foreground">5년보다 전 매수 {outsideCount}건</p>
              )
            ) : dots.length > 0 ? (
              <p data-testid="stock-page-dot-hint" className="text-xs text-muted-foreground">점을 누르면 매수 기록을 볼 수 있어요</p>
            ) : null}
          </div>
        )}

        {state !== "empty" && (
          <p data-testid="stock-page-basis" className="text-[11px] text-muted-foreground text-pretty">{basis}</p>
        )}

        <div className="border-t border-border/40 -mx-4 px-4">
          <button
            type="button"
            data-testid="stock-page-trades-link"
            onClick={openTrades}
            className="flex min-h-12 w-full items-center justify-between text-sm font-medium active:bg-muted/40 transition-[background-color]"
          >
            <span>거래내역 {tradeCount.toLocaleString()}건</span>
            <ChevronRight className="size-4 text-muted-foreground" />
          </button>
        </div>
      </section>
    </div>
  );
}
