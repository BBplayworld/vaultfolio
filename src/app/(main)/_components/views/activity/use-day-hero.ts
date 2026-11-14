"use client";

// 자산 변화 › 일 Hero 값 계산(4.95 #184) — 홈 Hero(useHeaderNetChange)와 같은 computeAttributionView, 시작점은 어제.
// 일 탭 전용 diff(이번 달 마지막 2건)를 대체한다. 원인 줄은 주 탭과 같은 mapWeekCauses. 저장 호출 0.
import { useMemo } from "react";
import { useAssetData } from "@/contexts/asset-data-context";
import { readDailySnapshots, readMonthlySnapshots } from "@/lib/asset/snapshot-storage";
import { readExchangeHistory } from "@/lib/finance/profit-utils";
import type { SettlementCauses } from "@/lib/report/settlement";
import { computeAttributionView, mapWeekCauses, weekStartDate, weekToday, type AttributionView } from "./week-attribution";

export const DAY_EMPTY_MESSAGE = "하루 더 쌓이면 날짜별 변화를 비교할 수 있어요."; // 홈 7일 카드(WeekTrendCard) 문구 재사용

export type DayHero =
  | { kind: "empty" }
  | { kind: "ok"; title: string; delta: number; pct: number | null; start: number; end: number; mapped: SettlementCauses };

/** today(KST YYYY-MM-DD) − 1일 */
export function dayYesterday(today: string): string {
  return new Date(Date.parse(`${today}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10);
}

/** 제목: 비교 시작이 어제면 `전일 대비`, 아니면 `M/D 기록 대비`(월 스냅샷이면 windowFrom 날짜) */
export function resolveDayHero(view: AttributionView | null, yesterday: string, endNet: number): DayHero {
  if (!view) return { kind: "empty" };
  const { attr } = view;
  const start = weekStartDate(view);
  const title = attr.fromDate === yesterday ? "전일 대비" : `${Number(start.slice(5, 7))}/${Number(start.slice(8, 10))} 기록 대비`;
  // 홈 Hero와 같은 % 식(deltaNet ÷ (끝 − deltaNet))
  const startNet = endNet - attr.deltaNet;
  return {
    kind: "ok",
    title,
    delta: attr.deltaNet,
    pct: startNet > 0 ? (attr.deltaNet / startNet) * 100 : 0,
    start: startNet,
    end: endNet,
    mapped: mapWeekCauses(view),
  };
}

export function useDayHero(enabled: boolean): DayHero {
  const { assetData, exchangeRates, snapshotVersion, getAssetSummary } = useAssetData();
  const today = weekToday();
  const summary = getAssetSummary();
  return useMemo(
    () => {
      if (!enabled) return { kind: "empty" } as DayHero;
      const yesterday = dayYesterday(today);
      const view = computeAttributionView({
        assetData, rates: exchangeRates, summary, daily: readDailySnapshots(), monthly: readMonthlySnapshots(),
        exchangeHistory: readExchangeHistory(), sinceDate: yesterday,
      });
      return resolveDayHero(view, yesterday, summary.netAsset);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [enabled, assetData, exchangeRates, snapshotVersion, today],
  );
}

/** 달력 칸 증감의 비교 대상 — 날짜(YYYY-MM-DD) 직전 기록. 이번 달로 한정하지 않아 월초 1일 칸도 전달 마지막 기록과 비교한다 */
export function prevDailyRecord<T extends { date: string }>(all: readonly T[], date: string): T | null {
  let best: T | null = null;
  for (const s of all) if (s.date < date && (!best || s.date > best.date)) best = s;
  return best;
}
