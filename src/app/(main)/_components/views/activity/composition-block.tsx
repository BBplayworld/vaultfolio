"use client";

// 월 탭 "자산 구성 변화" 블록(#83, 4.51) — 결산 구간 시작→끝 자산군 비중(총자산 기준). 계산은 computeMonthComposition.
// 금액·버튼(InfoHint 제외)·리본·범례 없음. 숨김이면 null.

import { useEffect, useRef } from "react";
import { ChartColumnStacked } from "lucide-react";
import { MAIN_PALETTE, pickOnColor } from "@/config/theme";
import { trackScreen } from "@/lib/analytics/ga";
import {
  COMPOSITION_LABELS, computeMonthComposition, displayBarWidths, type CompositionBreakdown, type CompositionKey, type MonthCompositionItem,
} from "@/lib/report/composition";
import type { SettlementWindow } from "@/lib/report/settlement";
import { InfoHint } from "../../layout/ui/info-hint";
import { SECTION, SectionHeader } from "../../layout/ui/report-section";
import { BODY_ENTER } from "./change-hero";

// change-hero의 CAUSE_BADGE와 같은 값(해당 파일 무변경 조건으로 비공개 상수를 복제하지 않고 값만 맞춘다)
const BADGE = "shrink-0 rounded bg-muted px-1.5 py-0.5 text-xs font-semibold text-muted-foreground";
export const COMPOSITION_HINT = "홈 도넛은 부채도 함께 나눠 보여줘서 같은 항목도 %가 다를 수 있어요. 이 블록은 부동산·주식·암호화폐·현금성의 합을 100%로 봐요.";
// 실물이 비중에 들어 있을 때만 쓰는 문구(실물 0건은 위 COMPOSITION_HINT 그대로)
export const COMPOSITION_HINT_PHYSICAL = "홈 도넛은 부채도 함께 나눠 보여줘서 같은 항목도 %가 다를 수 있어요. 이 블록은 부동산·실물·주식·암호화폐·현금성의 합을 100%로 봐요.";
/** 자산군 고정 색 — 같은 자산군은 두 시점·모든 달에서 같은 색(실물 = 홈 도넛 실물 [8]) */
export const COMPOSITION_COLORS: Record<CompositionKey, string> = {
  realEstate: MAIN_PALETTE[0], physical: MAIN_PALETTE[8], stocks: MAIN_PALETTE[4], crypto: MAIN_PALETTE[3], cash: MAIN_PALETTE[5],
};
const ENTER = "motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-left-2 motion-safe:duration-300";

function ariaRow(i: MonthCompositionItem): string {
  if (i.delta === 0) return `${i.label} ${i.startPct}%에서 ${i.endPct}%, 변화 없음`;
  return `${i.label} ${i.startPct}%에서 ${i.endPct}%, ${Math.abs(i.delta)}%포인트 ${i.delta > 0 ? "증가" : "감소"}`;
}

function Bar({ side, items, delay }: { side: "start" | "end"; items: MonthCompositionItem[]; delay: number }) {
  // 안내용 막대: 표시 폭만 최소 비중 보장(숫자는 실제 값)
  const widths = displayBarWidths(items.map((it) => (side === "start" ? it.startRatio : it.endRatio)));
  return (
    <div
      data-testid={`composition-bar-${side}`}
      className={`flex h-8 w-full overflow-hidden rounded-lg sm:h-10 origin-left ${ENTER} [animation-fill-mode:backwards]`}
      style={{ animationDelay: `${delay}ms` }}
    >
      {items.map((it, idx) => {
        const ratio = side === "start" ? it.startRatio : it.endRatio;
        const pct = side === "start" ? it.startPct : it.endPct;
        if (ratio <= 0) return null;
        const width = widths[idx];
        const color = COMPOSITION_COLORS[it.key];
        return (
          <div
            key={it.key}
            data-testid={`composition-seg-${side}-${it.key}`}
            data-ratio={ratio}
            className={`flex items-center justify-center overflow-hidden whitespace-nowrap text-xs font-semibold tabular-nums motion-safe:transition-[width] motion-safe:duration-300 ${idx > 0 ? "shadow-[-2px_0_0_0_var(--card)]" : ""}`}
            style={{ width: `${width}%`, backgroundColor: color, color: pickOnColor(color) }}
          >
            {width >= 11 ? `${pct}%` : null}
          </div>
        );
      })}
    </div>
  );
}

export function CompositionBlock({ w, liveBreakdown }: { w: SettlementWindow; liveBreakdown?: CompositionBreakdown | null }) {
  const c = computeMonthComposition(w, liveBreakdown);
  const ref = useRef<HTMLElement>(null);
  const shown = !!c;
  // 화면에 들어오면 GA 화면 키 1회(월 이동 재마운트는 trackScreen이 같은 키를 걸러냄). 숨김이면 보내지 않는다
  useEffect(() => {
    const el = ref.current;
    if (!shown || !el) return;
    if (typeof IntersectionObserver === "undefined") { trackScreen("activity:change:composition"); return; }
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) { trackScreen("activity:change:composition"); io.disconnect(); }
    });
    io.observe(el);
    return () => io.disconnect();
  }, [shown]);
  if (!c) return null;

  return (
    <section
      ref={ref}
      data-testid="composition-block"
      aria-labelledby="composition-title"
      className={`${SECTION} ${BODY_ENTER}`}
    >
      <SectionHeader
        icon={ChartColumnStacked}
        title="자산 구성 변화"
        titleTestId="composition-title"
        badge={
          <>
            <span data-testid="composition-badge" className={BADGE}>총자산 기준</span>
            <span data-screenshot-hide data-testid="composition-hint"><InfoHint summary={c.items.some((i) => i.key === "physical") ? COMPOSITION_HINT_PHYSICAL : COMPOSITION_HINT} /></span>
          </>
        }
      />
      <p data-testid="composition-sentence" className="text-sm font-medium text-pretty break-keep">{c.sentence}</p>
      <div data-testid="composition-compare" aria-hidden="true" className="space-y-1.5">
        <div data-testid="composition-label-start" className="text-xs text-muted-foreground tabular-nums whitespace-nowrap">{c.startLabel}</div>
        <Bar side="start" items={c.items} delay={0} />
        <Bar side="end" items={c.items} delay={60} />
        <div data-testid="composition-label-end" className="text-xs font-semibold text-foreground tabular-nums whitespace-nowrap">{c.endLabel}</div>
      </div>
      <span data-testid="composition-sr-range" className="sr-only">{c.startLabel}부터 {c.endLabel}까지 비교</span>
      <ul data-testid="composition-rows" className="pt-1 sm:grid sm:grid-cols-2 sm:gap-x-8">
        {c.items.map((it, i) => (
          <li
            key={it.key}
            data-testid={`composition-row-${it.key}`}
            aria-label={ariaRow(it)}
            className={`grid grid-cols-[auto_1fr_auto_auto] items-center gap-x-2 py-1.5 text-sm ${ENTER} [animation-fill-mode:backwards]`}
            style={{ animationDelay: `${i * 25}ms` }}
          >
            <span aria-hidden className="size-2 rounded-full" style={{ backgroundColor: COMPOSITION_COLORS[it.key] }} />
            <span aria-hidden className="text-muted-foreground break-keep">{COMPOSITION_LABELS[it.key]}</span>
            <span aria-hidden className="tabular-nums text-foreground whitespace-nowrap">{it.startText} → {it.endText}</span>
            <span
              aria-hidden
              data-testid={`composition-delta-${it.key}`}
              className={`min-w-14 text-right tabular-nums whitespace-nowrap ${it.delta === 0 ? "font-normal text-muted-foreground" : "font-semibold text-foreground"}`}
            >
              {it.deltaText}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
