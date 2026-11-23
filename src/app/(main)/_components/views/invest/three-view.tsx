"use client";

// 투자 탭 `세 지수` 보기(5.141 #270): A1 `같은 해 세 지수 오르내림` — 공통 해 40개를 5분류로 나눠 세고, 행을 펼쳐 해 칩 → 그해 세 값 1줄.
// 데이터는 이미 만든 IndexView 3개(저장·전송 0). 색·막대·점 0(값은 전경색), 눌리는 것 전부 40px 이상.
import { ChevronRight } from "lucide-react";
import { useId, useRef, useState } from "react";
import { A1_ROWS, a1RowOf, classifyYears, sameYearRets, type ThreeViews } from "@/lib/invest/three";
import { THREE_TEXT } from "@/lib/invest/text";
import { FoldNote } from "./fold-note";
import { NoBreak, ThreeYear } from "./nowrap";

const CARD = "rounded-2xl bg-card p-4 pb-3 shadow-sm dark:shadow-none";
/** 어구가 줄 중간에서 끊기지 않게(S&P 500과·나스닥100이) */
const ROW_PHRASES = ["S&P 500과", "나스닥100이"];

function Chips({ years, label, yr, onYear }: { years: number[]; label: string; yr: number | null; onYear: (y: number | null) => void }) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const focusIdx = Math.max(0, years.indexOf(yr ?? -1));
  const onKeyDown = (e: React.KeyboardEvent) => {
    const i = refs.current.findIndex((b) => b === document.activeElement);
    if (i < 0) return;
    const next = e.key === "ArrowRight" ? Math.min(years.length - 1, i + 1) : e.key === "ArrowLeft" ? Math.max(0, i - 1) : e.key === "Home" ? 0 : e.key === "End" ? years.length - 1 : -1;
    if (next < 0) return;
    e.preventDefault();
    refs.current[next]?.focus();
  };
  return (
    <div role="group" aria-label={`${label} 해 선택`} onKeyDown={onKeyDown} className="mt-2 grid grid-cols-[repeat(auto-fill,minmax(3rem,1fr))] gap-x-1 gap-y-2">
      {years.map((y, i) => {
        const on = y === yr;
        return (
          <button
            key={y} ref={(el) => { refs.current[i] = el; }} type="button" aria-pressed={on} aria-label={`${y}년`} tabIndex={i === focusIdx ? 0 : -1} data-testid={`a1-chip-${y}`}
            onClick={() => onYear(on ? null : y)}
            className={`relative h-8 rounded-full text-sm tabular-nums outline-none after:absolute after:-inset-y-1 after:inset-x-0 focus-visible:ring-2 focus-visible:ring-ring/50 motion-safe:transition-[color,background-color,scale] motion-safe:duration-150 motion-safe:active:scale-[0.96] ${on ? "bg-foreground font-semibold text-background" : "bg-secondary text-foreground"}`}
          >
            {y}
          </button>
        );
      })}
    </div>
  );
}

export function ThreeA1({ views, yr, onYear }: { views: ThreeViews; yr: number | null; onYear: (y: number | null) => void }) {
  const a1 = classifyYears(views);
  const [open, setOpen] = useState<number>(() => a1RowOf(a1, yr));
  const uid = useId();
  if (!a1) return <section data-testid="three-a1" className={CARD}><p data-testid="a1-empty" className="flex min-h-20 items-center justify-center text-sm text-muted-foreground">{THREE_TEXT.empty}</p></section>;
  const inRow = (k: number) => yr != null && a1.rows[k].years.includes(yr);
  return (
    <section data-testid="three-a1" className={CARD}>
      <p className="mb-2 text-xs text-muted-foreground text-balance break-keep">{THREE_TEXT.qA1}</p>
      <h3 className="text-base font-bold">{THREE_TEXT.titleA1}</h3>
      <p data-testid="a1-summary" className="mt-1 text-xs leading-snug text-muted-foreground text-pretty break-keep tabular-nums">{THREE_TEXT.summary(a1.from, a1.to, a1.n)}</p>
      <div className="mt-2">
        {a1.rows.map((r, k) => {
          const isOpen = open === k, id = `${uid}-r${k}`;
          return (
            <div key={r.id} className={k ? "border-t border-border/60" : ""}>
              <button
                type="button" aria-expanded={isOpen} aria-controls={id} data-testid={`a1-row-${k}`} onClick={() => setOpen(isOpen ? -1 : k)}
                className="grid min-h-11 w-full grid-cols-[minmax(0,1fr)_auto_1rem] items-center gap-2 rounded-xl px-2 py-2 text-left text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50 motion-safe:transition-transform motion-safe:active:scale-[0.99]"
              >
                <span className="font-medium text-pretty break-keep"><NoBreak text={r.label} phrases={ROW_PHRASES} /></span>
                <span className="font-bold tabular-nums">{THREE_TEXT.rowValue(r.years.length)}</span>
                <ChevronRight aria-hidden className={`size-4 text-muted-foreground motion-safe:transition-transform motion-safe:duration-200 ${isOpen ? "rotate-90" : ""}`} />
              </button>
              <div id={id} {...(isOpen ? {} : { inert: true })} className={`grid motion-safe:transition-[grid-template-rows,visibility] motion-safe:duration-200 ${isOpen ? "visible grid-rows-[1fr]" : "invisible grid-rows-[0fr]"}`}>
                <div className="min-h-0 overflow-hidden">
                  <div className="px-2 pb-2">
                    {/* 칩을 눌러도 아래가 밀리지 않게 슬롯 높이를 예약한다 */}
                    <div data-testid="a1-selected" role="status" aria-live="polite" className="flex min-h-12 items-center rounded-xl bg-secondary px-3 py-2 text-xs max-[359px]:min-h-16">
                      {inRow(k) ? <ThreeYear year={yr as number} items={sameYearRets(views, yr as number)} /> : <span className="text-muted-foreground">{THREE_TEXT.slotHint}</span>}
                    </div>
                    <Chips years={r.years} label={r.label} yr={yr} onYear={onYear} />
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <FoldNote label={THREE_TEXT.infoLabel} testId="a1-info">
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground text-pretty break-keep">{THREE_TEXT.info}</p>
        {a1.zeroNotes.map((z) => <p key={`${z.year}-${z.label}`} className="mt-1 text-xs leading-relaxed text-muted-foreground text-pretty break-keep">{THREE_TEXT.zeroNote(z.year, z.label)}</p>)}
      </FoldNote>
    </section>
  );
}

/** 세 지수 보기 본문(모바일 세로 gap-3, 1280은 두 열). A5(연대별 요약)는 #271에서 이 안에 들어온다 */
export function ThreeView({ views, yr, onYear }: { views: ThreeViews; yr: number | null; onYear: (y: number | null) => void; onMetric?: () => void }) {
  return (
    <div data-testid="invest-three" className="flex min-w-0 flex-col gap-3 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-150 xl:grid xl:grid-cols-[400px_minmax(0,1fr)] xl:items-start xl:gap-4">
      <ThreeA1 views={views} yr={yr} onYear={onYear} />
    </div>
  );
}
