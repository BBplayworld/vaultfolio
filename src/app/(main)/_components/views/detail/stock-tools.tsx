"use client";

// 상세·주식 '내 주식 도구' 타일 묶음(4.83 T-A) — 요약 박스 바로 아래. 시장과 비교 / X-Ray 분석 / 내 자산 점검(#245) / 해외주식 세금.
// 내 자산 점검은 셋째 자리 고정 — 세금 타일이 철(11~12월)마다 나타났다 사라져도 자리가 바뀌지 않는다. 값은 StockTab이 만든 주식 행(buildBoardRows 1회)을 받는다.
// 옛 요약 안 시장 글줄·X-Ray 상자·세금 문장 상자를 대체한다. 타일마다 그 기능의 숫자 1개를 미리 보인다(금액·투자 판단 없음).
// useXrayClassifications(분류 수집·완료 토스트)는 이 묶음이 계속 호출한다 — 타일이 안 보여도 호출은 유지(StockInsightStrip에서 이전).
// 인증카드 캡처에는 나오지 않는다(data-screenshot-hide, StockTab은 screenshotMode 렌더 안 함). 저장 호출 0.
import { useMemo } from "react";
import { ChartNoAxesColumn, ListChecks, Microscope, Receipt } from "lucide-react";
import type { Stock } from "@/types/asset";
import type { ExchangeRates } from "@/lib/finance/finance-service";
import { pickXrayTile } from "@/lib/xray/stock-xray";
import { useXrayClassifications } from "@/lib/xray/use-xray-classifications";
import { isForeignTaxSeason, isTaxSimCandidate } from "@/lib/tax-utils";
import { useTaxViewStore } from "@/stores/tax-view-store";
import { useXrayViewStore } from "@/stores/xray-view-store";
import type { GrowTileValue } from "@/lib/asset/grow-decision";
import { track } from "@/lib/analytics/ga";
import { isPreviewEnv } from "@/lib/cloud-sync/config";
import { groupStocksByTicker, mergeStockGroup } from "./asset-detail-tabs";
import { useAssetNavigation } from "../../layout/navigation/navigation-context";
import { NewChip, useNewSpot } from "../../layout/ui/new-chip";
import { ToolTile } from "../../layout/ui/tool-tile";
import { DOT_WRAP_FIRST, DOT_WRAP_ROW, DotLead } from "../../layout/ui/dot-wrap";
import { DUE_TEXT } from "../activity/grow-due-entry";
import { aimGrowStockView } from "../activity/report-tab";
import { MarketTileValue, useMarketEntryValue } from "../activity/market-entry-line";

const LG_COLS: Record<number, string> = { 1: "lg:grid-cols-1", 2: "lg:grid-cols-2", 3: "lg:grid-cols-3", 4: "lg:grid-cols-4" };
const NUM = "font-semibold text-foreground";

/** `내 자산 점검` 타일 값 줄(#245) — 조각은 grow-decision.growTileValueOf의 parts와 글자가 같다. 줄은 가운뎃점 자리에서만 바뀌고 줄 끝에 가운뎃점이 남지 않는다 */
export function GrowTileValueLine({ value }: { value: GrowTileValue | "pending" }) {
  // 이름표를 읽기 전 — 값 줄만 비운다(타일 높이 불변)
  if (value === "pending") return <span data-testid="stock-tool-grow-value" data-kind="pending" aria-hidden className="block">{"\u00a0"}</span>;
  const piece = "whitespace-nowrap";
  return (
    <span
      data-testid="stock-tool-grow-value"
      data-kind={value.kind}
      data-due={value.due}
      data-keep={value.keep}
      data-check={value.check}
      data-count={value.count}
      className={`flex flex-wrap gap-x-1 tabular-nums ${DOT_WRAP_ROW}`}
    >
      {value.kind === "due" ? (
        <span className={`${piece} ${DOT_WRAP_FIRST}`}>주식 점검 차례 <span className={DUE_TEXT}>{value.due}종목</span></span>
      ) : value.kind === "labeled" ? (
        <>
          <span className={`${piece} ${DOT_WRAP_FIRST}`}>주식 장기 보유 <span className={NUM}>{value.keep}</span></span>
          <span className={piece}><DotLead />점검 대상 <span className={NUM}>{value.check}</span></span>
        </>
      ) : (
        <>
          <span className={`${piece} ${DOT_WRAP_FIRST}`}>장기 보유</span>
          <span className={piece}><DotLead />점검 대상 정하기 전</span>
        </>
      )}
    </span>
  );
}

// grow = 내 자산 점검 타일 값(주식 행 기준). undefined = 주식 보기에 행이 없음(타일 없음), "pending" = 이름표 읽기 전
export function StockToolTiles({ stocks, exchangeRates, grow }: { stocks: Stock[]; exchangeRates?: ExchangeRates; grow?: GrowTileValue | "pending" }) {
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

  const showGrow = grow !== undefined;
  const count = 1 + (showMarket ? 1 : 0) + (showGrow ? 1 : 0) + (showTax ? 1 : 0);
  // 격자: 모바일 2열. 홀수 개면 마지막 타일이 2칸, 4개면 2×2(360 미만은 아래 두 타일을 한 줄씩 — 반 칸에 값 줄이 들어가지 않는다)
  const last = showTax ? "tax" : showGrow ? "grow" : "xray";
  const span = (id: "market" | "xray" | "grow" | "tax") =>
    count % 2 === 1 && id === last ? "col-span-2 lg:col-span-1" : count === 4 && (id === "grow" || id === "tax") ? "max-[359px]:col-span-2" : undefined;
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
          className={span("market")}
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
        className={span("xray")}
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
      {showGrow && (
        <ToolTile
          icon={ListChecks}
          name="내 자산 점검"
          testId="stock-tool-grow"
          onClick={() => {
            if (!isPreviewEnv()) track("feature_use", { category: "stock_check_tile" });
            aimGrowStockView(); // 내 자산 점검 칸 › 주식 보기(코인 차례가 있어도 주식 보기). 종목 지정 없음
            navigate({ type: "activity", tab: "report" });
          }}
          className={span("grow")}
        >
          <GrowTileValueLine value={grow} />
        </ToolTile>
      )}
      {showTax && (
        <ToolTile
          icon={Receipt}
          name="해외주식 세금"
          testId="stock-tool-tax"
          onClick={() => {
            useTaxViewStore.getState().setInitialTab("simulator");
            navigate({ type: "tax" });
          }}
          className={span("tax")}
        >
          <span data-testid="stock-tool-tax-value">1년 합산 · 기본공제 적용</span>
        </ToolTile>
      )}
    </div>
  );
}
