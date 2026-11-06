"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChartColumnStacked } from "lucide-react";
import { Card } from "@/components/ui/card";
import { trackScreen } from "@/lib/analytics/ga";
import { readMonthlySnapshots } from "@/lib/asset/snapshot-storage";
import {
  COMPOSITION_KEYS, COMPOSITION_LABELS, compositionCellAria, compositionLabelVisibility, computeCompositionSeries, describeCompositionCell,
  type CompositionLive,
} from "@/lib/report/composition";
import { GROUP_BADGE, SECTION, SectionHeader } from "../../layout/ui/report-section";
import { BODY_ENTER } from "./change-hero";

const CAPTION = "text-sm text-muted-foreground text-pretty break-keep";

/**
 * 연 탭 "자산 구성 변화" 카드(#72) — 월 스냅샷 breakdown의 자산군 비중(총자산 기준)을 최대 13칸 100% 막대로 보여준다.
 * 저장 데이터를 읽기만 하며 금액은 표시하지 않는다.
 */
export function CompositionCard({ snapshotVersion, live, currentMonth }: {
  snapshotVersion: number; live: CompositionLive; currentMonth: string;
}) {
  const { realEstateValue, stockValue, cryptoValue, cashValue } = live;
  const series = useMemo(
    () => computeCompositionSeries(
      snapshotVersion >= 0 ? readMonthlySnapshots() : [],
      { realEstateValue, stockValue, cryptoValue, cashValue },
      currentMonth,
    ),
    [snapshotVersion, realEstateValue, stockValue, cryptoValue, cashValue, currentMonth],
  );
  const [selected, setSelected] = useState<string | null>(null); // null = 마지막 칸(이번 달)
  const cardRef = useRef<HTMLDivElement>(null);
  const isBars = series.state === "bars";

  // 카드가 50% 이상 처음 보이면 화면 page_view 1회(같은 화면 중복은 trackScreen이 막는다)
  useEffect(() => {
    const el = cardRef.current;
    if (!isBars || !el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        trackScreen("activity:change:composition");
        io.disconnect();
      }
    }, { threshold: 0.5 });
    io.observe(el);
    return () => io.disconnect();
  }, [isBars]);

  if (series.state === "hidden") return null;
  const cells = series.cells;
  const labelShown = compositionLabelVisibility(cells.length);
  const active = cells.find((c) => c.month === selected) ?? cells[cells.length - 1];

  return (
    <Card ref={cardRef} data-testid="composition-card" className={`${SECTION} ${BODY_ENTER} py-4 gap-3`}>
      <SectionHeader
        icon={ChartColumnStacked}
        title="자산 구성 변화"
        badge={<span className={`${GROUP_BADGE} shrink-0`}>총자산 기준</span>}
      />
      {series.state === "single" ? (
        <p className={CAPTION}>다음 달 기록부터 구성 변화가 보여요</p>
      ) : (
        <>
          <p data-testid="composition-sentence" className="text-sm font-medium text-foreground text-pretty break-keep">{series.sentence}</p>
          <div className="flex justify-between gap-1" role="group" aria-label="월별 자산 구성">
            {cells.map((cell, idx) => {
              const isActive = cell.month === active.month;
              return (
                <button
                  key={cell.month}
                  type="button"
                  aria-label={compositionCellAria(cell)}
                  aria-pressed={isActive}
                  onClick={() => setSelected(cell.month)}
                  onMouseEnter={() => setSelected(cell.month)}
                  onFocus={() => setSelected(cell.month)}
                  className="group flex min-h-10 min-w-0 max-w-9 flex-1 flex-col items-center gap-1 outline-none"
                >
                  <span
                    className={`flex h-20 w-full flex-col-reverse gap-px overflow-hidden rounded-md transition-opacity duration-150 group-focus-visible:ring-2 group-focus-visible:ring-ring ${
                      cell.empty ? "border border-dashed border-muted-foreground/40" : ""
                    } ${isActive ? "opacity-100" : "opacity-60"}`}
                  >
                    {cell.ratios && COMPOSITION_KEYS.map((k) => cell.ratios![k] > 0 && (
                      <span key={k} style={{ height: `${cell.ratios![k]}%`, backgroundColor: series.colors[k] }} />
                    ))}
                  </span>
                  <span aria-hidden="true" className={`whitespace-nowrap text-[10px] leading-none tabular-nums ${isActive ? "font-semibold text-foreground" : "text-muted-foreground"}`}>
                    {labelShown[idx] ? cell.label : "\u00a0"}
                  </span>
                </button>
              );
            })}
          </div>
          <p data-testid="composition-selected" aria-live="polite" className="text-sm text-muted-foreground text-pretty break-keep tabular-nums">
            {describeCompositionCell(active)}
          </p>
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            {series.legendKeys.map((k) => (
              <span key={k} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="size-2 rounded-full" style={{ backgroundColor: series.colors[k] }} />
                {COMPOSITION_LABELS[k]}
              </span>
            ))}
          </div>
          {series.filled === 2 && <p className="text-xs text-muted-foreground">기록이 쌓이면 최대 13개월까지 보여요</p>}
        </>
      )}
    </Card>
  );
}
