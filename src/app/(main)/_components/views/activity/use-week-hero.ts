"use client";

// 자산 변화 › 주 Hero 값 단일 계산 훅(4.83) — 주 탭(WeekList)과 성과 허브 `최근 7일` 행이 같은 함수·같은 입력으로 같은 값을 만든다(C65).
// 계산 = 홈 Hero와 같은 computeAttributionView + resolveWeekHero. 저장 호출 0.
import { useMemo } from "react";
import { useAssetData } from "@/contexts/asset-data-context";
import { readDailySnapshots, readMonthlySnapshots } from "@/lib/asset/snapshot-storage";
import { readExchangeHistory } from "@/lib/finance/profit-utils";
import { signed } from "./change-hero";
import { computeAttributionView, resolveWeekHero, weekSinceDate, weekToday, type AttributionView, type WeekHero } from "./week-attribution";

export interface WeekHeroValue {
  today: string;
  view: AttributionView | null;
  hero: WeekHero;
  decomposed: AttributionView | null; // 원인 분해가 가능한 Hero(recent·since)일 때만
  delta: number | null; // Hero 증감(원)
  end: number; // 홈 Hero와 같은 끝(실시간 순자산)
}

// Hero(ChangeHero)·허브 행이 같은 문자열로 그린다 — change-hero의 signed 그대로(부호 + formatPriceByMode)
export const formatWeekDelta = signed;

export function useWeekHero(): WeekHeroValue {
  const { assetData, exchangeRates, snapshotVersion, getAssetSummary } = useAssetData();
  const today = weekToday();
  const summary = getAssetSummary();
  const view = useMemo(
    () => computeAttributionView({
      assetData,
      rates: exchangeRates,
      summary,
      daily: readDailySnapshots(),
      monthly: readMonthlySnapshots(),
      exchangeHistory: readExchangeHistory(),
      sinceDate: weekSinceDate(today),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [assetData, exchangeRates, snapshotVersion, today],
  );
  const hero = resolveWeekHero(view, today);
  const decomposed = view && (hero.kind === "recent" || hero.kind === "since") ? view : null;
  return { today, view, hero, decomposed, delta: decomposed ? decomposed.attr.deltaNet : null, end: summary.netAsset };
}
