"use client";

// 지난 접속 이후 브리핑 — 마지막 스냅샷 저장일(previousVisitDate) 이후의 순자산 변화를
// 원인분해(computeAttributionSince) 재사용으로 1~2문장 요약. 당일 재접속·첫 접속은 미표시.

import { useMemo } from "react";
import { History } from "lucide-react";
import { useAssetData } from "@/contexts/asset-data-context";
import { formatPriceByMode } from "@/lib/number-utils";
import { getProfitLossColor } from "@/config/theme";
import { computeAttributionSince } from "@/lib/report/asset-report";
import { readExchangeHistory } from "@/lib/profit-utils";
import { readDailySnapshots, readMonthlySnapshots } from "@/lib/snapshot-storage";

// 비교 시작일 표기: YYYY-MM-DD → M/D, YYYY-MM → M월
function fmtFromDate(d: string): string {
  const parts = d.split("-");
  if (parts.length >= 3) return `${parseInt(parts[1])}/${parseInt(parts[2])}`;
  return `${parseInt(parts[1])}월`;
}

export function LastVisitBriefing() {
  const { assetData, exchangeRates, snapshotVersion, previousVisitDate } = useAssetData();
  const todayStr = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().split("T")[0];

  const attribution = useMemo(() => {
    // 첫 접속(기록 없음)·당일 재접속은 브리핑 없음
    if (!previousVisitDate || previousVisitDate >= todayStr) return null;
    return computeAttributionSince(
      readDailySnapshots(),
      readMonthlySnapshots(),
      readExchangeHistory(),
      previousVisitDate,
      assetData,
      exchangeRates,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previousVisitDate, todayStr, assetData, exchangeRates, snapshotVersion]);

  if (!attribution) return null;

  const topCause = attribution.topCauses.length > 0 ? attribution.topCauses[0] : null;

  return (
    <div className="rounded-xl border border-border/10 bg-card dark:border-0 shadow-xs p-4 space-y-1.5 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-300">
      <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <History className="size-4 text-primary shrink-0" />
        지난 접속({fmtFromDate(attribution.fromDate)}) 이후
        {attribution.estimated && (
          <span className="rounded bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground">예측</span>
        )}
      </p>
      <p className="text-sm sm:text-[15px] text-foreground text-pretty">
        순자산{" "}
        <span className={`font-bold tabular-nums ${getProfitLossColor(attribution.deltaNet)}`}>
          {attribution.deltaNet >= 0 ? "+" : ""}{formatPriceByMode(attribution.deltaNet)}
        </span>
        {topCause && <span className="text-muted-foreground"> · {topCause.sentence}</span>}
      </p>
    </div>
  );
}
