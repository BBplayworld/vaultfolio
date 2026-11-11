"use client";

// 성과 허브 `자산 변화` 카드 안 행 3개(4.83 H-A) — 최근 7일 / 월별 기록 / 시장과 비교. KpiCard rows 슬롯에 들어가 카드 머리(월 결산) 클릭과 형제다.
// 값은 도착 화면과 같은 함수: 행 1 = 주 탭 Hero(useWeekHero), 행 2 = buildMonthlyLog recordedCount, 행 3 = 시장 타일/비교 페이지 1주 지수(useMarketEntryValue).
import { ChevronRight } from "lucide-react";
import { getProfitLossColor } from "@/config/theme";
import { track } from "@/lib/analytics/ga";
import { useAssetNavigation } from "../../layout/navigation/navigation-context";
import { NewChip, useNewSpot } from "../../layout/ui/new-chip";
import type { NewSpot } from "@/config/new-spots";
import { MarketIndexValues, useMarketEntryValue } from "./market-entry-line";
import { formatWeekDelta, useWeekHero } from "./use-week-hero";

const ROW = "-mx-1 flex min-h-11 w-full items-center gap-2 rounded-md px-1 py-2 text-left outline-none hover:bg-accent/50 active:bg-accent/70 focus-visible:ring-2 focus-visible:ring-ring/50 transition-[background-color] duration-150 ease-out";
const VALUE = "ml-auto min-w-0 text-right text-sm text-muted-foreground tabular-nums break-keep";

export function HubChangeRows({ monthlyCount }: { monthlyCount: number | null }) {
  const { navigate } = useAssetNavigation();
  const { hero, delta } = useWeekHero();
  const market = useMarketEntryValue("weekly");
  const showMonthly = monthlyCount !== null;
  const showMarket = market.hasTickerStock && market.open;

  // 한 화면 1개 — 보이는 행만 후보(우선순위 최근 7일 > 월별 기록 > 시장과 비교)
  const visible: NewSpot[] = ["hub-week", ...(showMonthly ? ["hub-monthly" as const] : []), ...(showMarket ? ["hub-market" as const] : [])];
  const newSpot = useNewSpot(visible);

  const weekValue = delta !== null
    ? <span data-testid="hub-row-week-value" data-value={Math.round(delta)} className={`font-semibold ${getProfitLossColor(delta)}`}>{formatWeekDelta(delta)}</span>
    : <span data-testid="hub-row-week-value">{hero.kind === "empty" ? "기록 쌓는 중" : "기록 부족"}</span>;

  return (
    <div data-testid="hub-change-rows" data-screenshot-hide className="divide-y divide-border border-t border-border dark:divide-border/40 dark:border-border/40">
      <button
        type="button"
        data-testid="hub-row-week"
        onClick={() => {
          track("feature_use", { category: "change_week_all" }); // 홈 팁·새 소식 진입과 같은 1건(4.79)
          navigate({ type: "activity", tab: "change", init: { scope: "all", period: "week" } });
        }}
        className={ROW}
      >
        <span data-testid="hub-row-week-name" className="text-sm font-medium text-foreground whitespace-nowrap">
          {hero.title}
          {newSpot === "hub-week" && <NewChip spot="hub-week" />}
        </span>
        <span className={VALUE}>{weekValue}</span>
        <ChevronRight aria-hidden className="size-4 shrink-0 text-muted-foreground" />
      </button>

      {showMonthly && (
        <button
          type="button"
          data-testid="hub-row-monthly"
          onClick={() => navigate({ type: "activity", tab: "change", init: { scope: "all", period: "month", source: "menu", focus: "monthly-log" } })}
          className={ROW}
        >
          <span className="text-sm font-medium text-foreground whitespace-nowrap">
            월별 기록
            {newSpot === "hub-monthly" && <NewChip spot="hub-monthly" />}
          </span>
          <span data-testid="hub-row-monthly-value" data-value={monthlyCount} className={VALUE}>{monthlyCount}개월</span>
          <ChevronRight aria-hidden className="size-4 shrink-0 text-muted-foreground" />
        </button>
      )}

      {showMarket && (
        <button
          type="button"
          data-testid="hub-row-market"
          onClick={() => navigate({ type: "activity", tab: "change-market" })}
          className={ROW}
        >
          <span className="text-sm font-medium text-foreground whitespace-nowrap">
            시장과 비교
            {newSpot === "hub-market" && <NewChip spot="hub-market" />}
          </span>
          <span data-testid="hub-row-market-value" className={VALUE}>
            {!market.ready
              ? <span aria-hidden className="inline-block h-4 w-16 rounded bg-muted align-middle motion-safe:animate-pulse" />
              : market.values.length === 0
                ? "지수와 나란히 보기"
                : <>1주 <MarketIndexValues values={market.values} restBelowSm /></>}
          </span>
          <ChevronRight aria-hidden className="size-4 shrink-0 text-muted-foreground" />
        </button>
      )}
    </div>
  );
}
