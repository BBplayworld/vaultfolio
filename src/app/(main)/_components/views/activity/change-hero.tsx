"use client";

// 자산 변화 Hero(#32 r2) — 일·주·월·연·주식 5개 본문이 같은 4단 구조(이름 → 증감 → 시작→끝 → 기간 선택)로 그린다.
// 타이포는 홈 Hero(dashboard.tsx 순자산 헤더)와 같다. views/activity 로컬 전용(카탈로그 미등록).

import { createContext, useContext, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { formatPriceByMode } from "@/lib/number-utils";
import { getProfitLossColor } from "@/config/theme";
import type { SettlementWindow } from "@/lib/report/settlement";
import { SECTION } from "../../layout/ui/report-section";

// 본문 진입 — Hero 숫자는 자리 고정(fade만), Hero 아래 본문만 살짝 올라온다
export const BODY_ENTER = "motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1 motion-safe:duration-300";

const signed = (v: number) => `${v >= 0 ? "+" : ""}${formatPriceByMode(v)}`;

// 월 증감 단일 계산 — 허브 자산 변화 카드와 결산 Hero가 같은 함수를 쓴다(지표 대조표 #5)
export function settlementDelta(w: SettlementWindow, liveNet: number): { prevValue: number; currValue: number; delta: number; pct: number | null } {
  const prevValue = w.start?.netAsset ?? 0;
  const currValue = w.end ? w.end.netAsset : liveNet;
  const delta = currValue - prevValue;
  const pct = w.start && prevValue !== 0 ? (delta / Math.abs(prevValue)) * 100 : null;
  return { prevValue, currValue, delta, pct };
}

// 결산 이름 — "10월 결산"(진행 중·첫 달은 "11월"), 올해가 아니면 "25년 10월 결산"
export function settlementName(month: string, today: string, settled: boolean): string {
  const prefix = month.slice(0, 4) === today.slice(0, 4) ? "" : `${month.slice(2, 4)}년 `;
  return `${prefix}${Number(month.slice(5, 7))}월${settled ? " 결산" : ""}`;
}

export interface ChangeHeroProps {
  title?: ReactNode;         // 없으면 이름 줄 생략(빈 상태)
  titleTestId?: string;
  range?: ReactNode;         // 이름 옆 구간 "9/28 → 10/28"
  badge?: ReactNode;         // 이름 줄 배지(진행 중)
  actions?: ReactNode;       // 이름 줄 오른쪽 끝(월 화살표)
  delta?: number | null;     // null이면 증감 줄 대신 message
  pct?: number | null;
  start?: number;
  end?: number;
  loading?: ReactNode;       // 증감 자리 스켈레톤 + 문구
  message?: ReactNode;       // 오류·빈·첫 달·기록 부족
  aside?: ReactNode;         // 시작→끝 줄 오른쪽(일부 이전 값 배지)
  note?: ReactNode;          // Hero 아래 보조 문구(간격 안내)
  contentKey?: string;       // 바뀌면 숫자 영역만 fade-in(위치 고정)
  period?: ReactNode;        // 기간 선택 — ChangeHeroFrame 밖에서 단독으로 쓸 때만
}

// Hero 틀 — 자산 변화 화면이 1회 렌더한다. 본문(일·주·월·연·주식)의 ChangeHero 내용은 슬롯으로 포털되고
// 기간 선택은 틀 맨 아래에 고정돼 본문 전환에도 다시 마운트되지 않는다(썸이 칸 사이를 미끄러짐)
const HeroSlotContext = createContext<HTMLDivElement | null | undefined>(undefined);

export function ChangeHeroFrame({ period, children }: { period: ReactNode; children: ReactNode }) {
  const [slot, setSlot] = useState<HTMLDivElement | null>(null);
  return (
    <HeroSlotContext.Provider value={slot}>
      <section data-testid="change-hero" className={SECTION}>
        <div>
          <div ref={setSlot} />
          <div className="mt-4">{period}</div>
        </div>
      </section>
      {children}
    </HeroSlotContext.Provider>
  );
}

export function ChangeHero({ title, titleTestId, range, badge, actions, delta = null, pct = null, start, end, loading, message, aside, note, contentKey, period }: ChangeHeroProps) {
  const slot = useContext(HeroSlotContext);
  const content = (
    <>
        {(title || actions) && <div className="flex min-h-10 items-center gap-2">
          <p className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span data-testid={titleTestId ?? "change-hero-title"} className="text-sm font-semibold text-foreground">{title}</span>
            {range && <span className="text-sm text-muted-foreground tabular-nums">{range}</span>}
          </p>
          {badge}
          {actions && <div className="ml-auto sm:ml-2 flex shrink-0 items-center gap-1">{actions}</div>}
        </div>}

        <div key={contentKey} aria-live="polite" className="motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200">
          {loading ? (
            <div data-testid="change-hero-loading" className="mt-1">
              <div className="h-8 w-44 rounded-md bg-muted motion-safe:animate-pulse" />
              <p className="mt-1 text-sm text-muted-foreground">{loading}</p>
            </div>
          ) : delta === null ? (
            message && <div className="mt-1 text-sm text-muted-foreground text-pretty">{message}</div>
          ) : (
            <>
              <div className="mt-1 flex flex-wrap items-baseline gap-x-2">
                <p
                  data-testid="change-hero-delta"
                  data-value={Math.round(delta)}
                  className={`text-2xl sm:text-3xl font-bold tabular-nums leading-tight ${getProfitLossColor(delta)}`}
                >
                  {signed(delta)}
                </p>
                {pct !== null && (
                  <span className={`text-base font-bold tabular-nums ${getProfitLossColor(delta)}`}>
                    {pct >= 0 ? "+" : ""}{pct.toFixed(1)}%
                  </span>
                )}
              </div>
              {start !== undefined && end !== undefined && (
                <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                  <p className="text-sm text-muted-foreground tabular-nums">
                    <span data-testid="change-hero-start" data-value={Math.round(start)}>{formatPriceByMode(start)}</span>
                    {" → "}
                    <span data-testid="change-hero-end" data-value={Math.round(end)}>{formatPriceByMode(end)}</span>
                  </p>
                  {aside}
                </div>
              )}
            </>
          )}
          {note && <p className="mt-1 text-sm text-muted-foreground text-pretty">{note}</p>}
        </div>
    </>
  );
  // 틀 안이면 슬롯으로 포털(슬롯 준비 전 첫 렌더는 비움), 틀 밖이면 단독 섹션
  if (slot !== undefined) return slot ? createPortal(content, slot) : null;
  return (
    <section data-testid="change-hero" className={SECTION}>
      <div>
        {content}
        {period && <div className="mt-4">{period}</div>}
      </div>
    </section>
  );
}
