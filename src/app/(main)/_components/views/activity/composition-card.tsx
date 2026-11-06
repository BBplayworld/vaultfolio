"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChartColumnStacked } from "lucide-react";
import { Card } from "@/components/ui/card";
import { trackScreen } from "@/lib/analytics/ga";
import { readMonthlySnapshots } from "@/lib/asset/snapshot-storage";
import { pickOnColor } from "@/config/theme";
import {
  COMPOSITION_KEYS, COMPOSITION_LABELS, compositionCellAria, compositionDisplayScale, compositionLabelVisibility, compositionScaleMode,
  computeCompositionSeries, describeCompositionCell,
  type CompositionCell, type CompositionKey, type CompositionLive, type CompositionScaleMode,
} from "@/lib/report/composition";
import { GROUP_BADGE, SECTION, SectionHeader } from "../../layout/ui/report-section";
import { BODY_ENTER } from "./change-hero";

const CAPTION = "text-sm text-muted-foreground text-pretty break-keep";

const BAR_FRAC = 0.55; // 칸(zone) 폭 대비 막대 폭
const BAR_MIN = 14;
const BAR_MAX = 72;
const BAR_MAX_FEW = 120; // 4칸 이하는 넓은 화면에서 휑하지 않게 막대를 키운다
const SEG_LABEL_MIN_PX = 18; // 막대 안 % 표기 최소 세그먼트 높이
const SEG_LABEL_MIN_BAR = 40; // 막대 안 % 상시 표기 최소 막대 폭

/**
 * 막대 + 막대 사이 같은 색 리본(면) 차트. 높이는 표시 스케일(보정 가능), 숫자·aria는 실제 비중.
 * 폭은 ResizeObserver로 측정한 px 기준(SVG는 x=px, y=% 좌표). 칸 전체가 버튼, 드래그/←→로 선택.
 */
function CompositionChart({ cells, colors, activeMonth, labelShown, mode, onSelect }: {
  cells: CompositionCell[]; colors: Record<CompositionKey, string>; activeMonth: string;
  labelShown: boolean[]; mode: CompositionScaleMode; onSelect: (month: string) => void;
}) {
  const chartRef = useRef<HTMLDivElement>(null);
  const btnRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [size, setSize] = useState({ w: 319, h: 176 });
  useEffect(() => {
    const el = chartRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([e]) => {
      const { width, height } = e.contentRect;
      if (width > 0 && height > 0) setSize({ w: width, h: height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const n = cells.length;
  const zone = size.w / n;
  const barW = Math.min(n <= 4 ? BAR_MAX_FEW : BAR_MAX, Math.max(BAR_MIN, zone * BAR_FRAC));
  const left = (i: number) => zone * i + (zone - barW) / 2;
  const activeIdx = Math.max(0, cells.findIndex((c) => c.month === activeMonth));
  const showAllPct = barW >= SEG_LABEL_MIN_BAR;

  // 칸별 [하단%, 상단%] 구간(아래부터 쌓음)
  const stacks = cells.map((c) => {
    if (!c.ratios) return null;
    const d = compositionDisplayScale(c.ratios, mode);
    let acc = 0;
    const seg = {} as Record<CompositionKey, { lo: number; hi: number; display: number }>;
    for (const k of COMPOSITION_KEYS) { seg[k] = { lo: acc, hi: acc + d[k], display: d[k] }; acc += d[k]; }
    return seg;
  });

  const pick = (idx: number) => {
    const i = Math.min(n - 1, Math.max(0, idx));
    onSelect(cells[i].month);
    return i;
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    pick(Math.floor(((e.clientX - rect.left) / rect.width) * n));
  };
  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    const i = pick(activeIdx + (e.key === "ArrowRight" ? 1 : -1));
    btnRefs.current[i]?.focus();
  };
  const y = (pct: number) => 100 - pct;

  return (
    <div
      data-testid="composition-chart"
      role="group"
      aria-label="월별 자산 구성"
      className="relative touch-pan-y select-none"
      onPointerMove={onPointerMove}
      onKeyDown={onKeyDown}
    >
      <div ref={chartRef} className="relative h-44 sm:h-52 border-b border-border/60">
        <span
          aria-hidden="true"
          className="absolute inset-y-0 rounded-xl bg-muted/40 dark:bg-muted/30 transition-[left] duration-150 motion-reduce:transition-none"
          style={{ left: zone * activeIdx, width: zone }}
        />
        <svg data-testid="composition-ribbons" aria-hidden="true" className="absolute inset-0 size-full" viewBox={`0 0 ${size.w} 100`} preserveAspectRatio="none">
          {COMPOSITION_KEYS.map((k) => stacks.slice(0, -1).map((a, i) => {
            const b = stacks[i + 1];
            if (!a || !b) return null;
            const ax = left(i) + barW;
            const bx = left(i + 1);
            const mx = (ax + bx) / 2;
            if (a[k].hi - a[k].lo <= 0 && b[k].hi - b[k].lo <= 0) return null;
            const touchesActive = i === activeIdx || i + 1 === activeIdx;
            return (
              <path
                key={`${k}-${i}`}
                d={`M${ax},${y(a[k].hi)} C${mx},${y(a[k].hi)} ${mx},${y(b[k].hi)} ${bx},${y(b[k].hi)} L${bx},${y(b[k].lo)} C${mx},${y(b[k].lo)} ${mx},${y(a[k].lo)} ${ax},${y(a[k].lo)} Z`}
                fill={colors[k]}
                className={`transition-opacity duration-150 motion-reduce:transition-none ${touchesActive ? "opacity-30 dark:opacity-[0.38]" : "opacity-[0.16] dark:opacity-[0.24]"}`}
              />
            );
          }))}
        </svg>
        {cells.map((c, i) => {
          const st = stacks[i];
          const isActive = i === activeIdx;
          return (
            <div
              key={c.month}
              className={`absolute inset-y-0 transition-opacity duration-150 motion-reduce:transition-none ${st ? "" : "opacity-40"}`}
              style={{ left: left(i), width: barW }}
            >
              <div
                className="flex h-full flex-col-reverse motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-300 motion-safe:fill-mode-backwards"
                style={{ animationDelay: `${Math.min(i, 13) * 25}ms` }}
              >
                {!st && <span className="h-full w-full rounded-[4px] border border-dashed border-muted-foreground" />}
                {st && COMPOSITION_KEYS.map((k) => st[k].display > 0 && (
                  <span
                    key={k}
                    data-testid={`composition-seg-${c.month}-${k}`}
                    data-ratio={c.ratios![k].toFixed(1)}
                    data-display={st[k].display.toFixed(1)}
                    className="relative flex items-center justify-center overflow-hidden rounded-[4px] border-t-2 border-card transition-[height] duration-300 first:border-t-0 motion-reduce:transition-none"
                    style={{ height: `${st[k].display}%` }}
                  >
                    <span aria-hidden="true" className={`absolute inset-0 transition-opacity duration-150 motion-reduce:transition-none ${isActive ? "opacity-100" : "opacity-70"}`} style={{ backgroundColor: colors[k] }} />
                    {showAllPct && (st[k].display / 100) * size.h >= SEG_LABEL_MIN_PX && (
                      <span aria-hidden="true" className="relative text-xs font-semibold tabular-nums" style={{ color: pickOnColor(colors[k]) }}>
                        {c.ratios![k].toFixed(0)}%
                      </span>
                    )}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      <div className="absolute inset-0 grid" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}>
        {cells.map((cell, idx) => {
          const isActive = idx === activeIdx;
          return (
            <button
              key={cell.month}
              ref={(el) => { btnRefs.current[idx] = el; }}
              type="button"
              data-testid={`composition-col-${cell.month}`}
              aria-label={compositionCellAria(cell)}
              aria-pressed={isActive}
              tabIndex={isActive ? 0 : -1}
              onClick={() => onSelect(cell.month)}
              onFocus={() => onSelect(cell.month)}
              className="flex min-w-0 flex-col items-center justify-end rounded-xl pb-1 outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span aria-hidden="true" className={`whitespace-nowrap text-[11px] leading-none tabular-nums ${isActive ? "font-semibold text-foreground" : "text-muted-foreground"}`}>
                {labelShown[idx] ? cell.label : "\u00a0"}
              </span>
            </button>
          );
        })}
      </div>
      <div aria-hidden="true" className="h-6" />
    </div>
  );
}

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
  const scaleMode = compositionScaleMode(cells);

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
          <CompositionChart
            cells={cells} colors={series.colors} activeMonth={active.month} labelShown={labelShown}
            mode={scaleMode} onSelect={setSelected}
          />
          {scaleMode === "corrected" && (
            <p data-testid="composition-scale-caption" className="text-xs text-muted-foreground text-pretty break-keep">
              막대 높이는 변화를 보기 쉽게 보정했어요. 실제 비중은 숫자로 확인해 주세요
            </p>
          )}
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
