"use client";

// 상세·주식 '내 주식 도구' 타일 묶음(4.83 T-A) — 요약 박스 바로 아래. 시장과 비교 / X-Ray 분석 / 해외주식 세금.
// 옛 요약 안 시장 글줄·X-Ray 상자·세금 문장 상자를 대체한다. 타일마다 그 기능의 숫자 1개를 미리 보인다(금액·투자 판단 없음).
// useXrayClassifications(분류 수집·완료 토스트)는 이 묶음이 계속 호출한다 — 타일이 안 보여도 호출은 유지(StockInsightStrip에서 이전).
// 인증카드 캡처에는 나오지 않는다(data-screenshot-hide, StockTab은 screenshotMode 렌더 안 함). 저장 호출 0.
import { useMemo } from "react";
import { ChartNoAxesColumn, Microscope, Receipt } from "lucide-react";
import type { Stock } from "@/types/asset";
import type { ExchangeRates } from "@/lib/finance/finance-service";
import { pickXrayTile } from "@/lib/xray/stock-xray";
import { useXrayClassifications } from "@/lib/xray/use-xray-classifications";
import { isForeignTaxSeason, isTaxSimCandidate } from "@/lib/tax-utils";
import { useTaxViewStore } from "@/stores/tax-view-store";
import { useXrayViewStore } from "@/stores/xray-view-store";
import { groupStocksByTicker, mergeStockGroup } from "./asset-detail-tabs";
import { useAssetNavigation } from "../../layout/navigation/navigation-context";
import { NewChip, useNewSpot } from "../../layout/ui/new-chip";
import { ToolTile } from "../../layout/ui/tool-tile";
import { MarketTileValue, useMarketEntryValue } from "../activity/market-entry-line";

const LG_COLS: Record<number, string> = { 1: "lg:grid-cols-1", 2: "lg:grid-cols-2", 3: "lg:grid-cols-3" };

export function StockToolTiles({ stocks, exchangeRates }: { stocks: Stock[]; exchangeRates?: ExchangeRates }) {
  const { navigate } = useAssetNavigation();
  // 주식 목록이 바뀌면 분류 미수집 ticker만 모아 백그라운드 fetch(공용 훅, 완료 토스트 포함) — 주식 0건이면 [] 전달(no-op)
  const { tick, progress } = useXrayClassifications(stocks);
  const market = useMarketEntryValue("weekly");

  // 증권사별 분리 항목을 ticker 단위로 병합 — X-Ray 페이지와 같은 병합이라 같은 비중 값
  const xray = useMemo(() => {
    const merged = Array.from(groupStocksByTicker(stocks).values()).map((g) => mergeStockGroup(g));
    // 분류 수집 중에는 비분류 축의 중간 값이 보이지 않게 폴백 문구(spec 8절)
    return progress ? null : pickXrayTile(merged, exchangeRates);
    // tick 의존성으로 localStorage 분류 갱신 반영
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stocks, exchangeRates, tick, progress]);

  const showMarket = market.hasTickerStock && market.open;
  const showTax = isForeignTaxSeason() && stocks.some(isTaxSimCandidate);
  const newSpot = useNewSpot(showMarket ? ["stock-market"] : []);

  if (stocks.length === 0) return null;

  const count = 1 + (showMarket ? 1 : 0) + (showTax ? 1 : 0);
  return (
    <div
      data-testid="stock-tools"
      role="group"
      aria-label="내 주식 도구"
      data-screenshot-hide
      className={`grid grid-cols-2 gap-2 ${LG_COLS[count]}`}
    >
      {showMarket && (
        <ToolTile
          icon={ChartNoAxesColumn}
          name="시장과 비교"
          testId="stock-market-entry"
          onClick={() => navigate({ type: "activity", tab: "change-market" })}
          className={count === 1 ? "col-span-2 lg:col-span-1" : undefined}
          chip={newSpot === "stock-market" ? <NewChip spot="stock-market" /> : undefined}
        >
          <MarketTileValue market={market} label="1주" testId="stock-tool-market-value" />
        </ToolTile>
      )}
      <ToolTile
        icon={Microscope}
        name="X-Ray 분석"
        testId="stock-tool-xray"
        onClick={() => {
          if (xray) useXrayViewStore.getState().setInitialAxis(xray.axis); // 타일 값의 축으로 열린다(1회 소비)
          navigate({ type: "detail", tab: "stocks-xray" });
        }}
        className={count === 1 ? "col-span-2 lg:col-span-1" : undefined}
      >
        <span data-testid="stock-tool-xray-value" className="flex w-full min-w-0">
          {xray ? (
            <>
              <span className="truncate">{xray.itemLabel}</span>
              <span className="ml-1 shrink-0 font-semibold tabular-nums text-foreground">{xray.pct}%</span>
            </>
          ) : "분야·지역 비중 보기"}
        </span>
      </ToolTile>
      {showTax && (
        <ToolTile
          icon={Receipt}
          name="해외주식 세금"
          testId="stock-tool-tax"
          onClick={() => {
            useTaxViewStore.getState().setInitialTab("simulator");
            navigate({ type: "tax" });
          }}
          className={count === 3 ? "col-span-2 lg:col-span-1" : undefined}
        >
          <span data-testid="stock-tool-tax-value">1년 합산 · 기본공제 적용</span>
        </ToolTile>
      )}
    </div>
  );
}
