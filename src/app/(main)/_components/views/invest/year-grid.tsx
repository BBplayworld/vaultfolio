"use client";

// R4.1: 연도별 수익률 격자 — 연대(열) × 끝자리(행) 색 농도 격자. 셀 = ±N.N(%) + 손익색 알파. 해를 누르거나 끌면 읽기 줄.
// 셀 높이 40, 가로는 카드 가장자리까지 펼쳐 390 약 49px, 320 S&P 7열은 39.4px(CEO 승인 예외: 320·7열 year-cell만, 39 미만이면 FAIL).
// 알파 = 0.10 + 0.50×min(|등락|/40, 1), 글자 foreground(대비 ≥4.5), 부호 글자로도 방향이 구분된다.
import { useRef, useState, type KeyboardEvent } from "react";
import type { IndexView } from "@/lib/invest/calc";
import { MINUS, READOUT_HINT, fmtLevel, fmtPct, readoutOf } from "@/lib/invest/text";
import { getProfitLossColor } from "@/config/theme";

const f1 = (v: number) => { const r = Math.round(v * 10) / 10; return r > 0 ? `+${r.toFixed(1)}` : r < 0 ? `${MINUS}${Math.abs(r).toFixed(1)}` : "0.0"; };
export const gridAlpha = (retPct: number) => 0.1 + 0.5 * Math.min(Math.abs(retPct) / 40, 1);

export function YearGrid({ view, period, showLevels, question }: { view: IndexView; period: { sy: number; ey: number }; showLevels: boolean; question?: string }) {
  const [sel, setSel] = useState<number | null>(null);
  const first = view.start + 1, last = view.last;
  const decs: number[] = [];
  for (let t = Math.floor(first / 10) * 10; t <= Math.floor(last / 10) * 10; t += 10) decs.push(t);
  const ref = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const cellAt = (x: number, y: number) => (document.elementFromPoint(x, y) as HTMLElement | null)?.closest<HTMLElement>("[data-y]");
  const pick = (x: number, y: number) => { const c = cellAt(x, y); if (c) { const Y = +c.dataset.y!; if (Y !== sel) setSel(Y); } };
  const move = (e: KeyboardEvent, Y: number) => {
    const d = e.key === "ArrowLeft" ? -10 : e.key === "ArrowRight" ? 10 : e.key === "ArrowUp" ? -1 : e.key === "ArrowDown" ? 1 : 0;
    if (!d) return;
    const to = Y + d;
    if (to < first || to > last) return;
    e.preventDefault();
    setSel(to);
    ref.current?.querySelector<HTMLElement>(`[data-y="${to}"]`)?.focus();
  };
  const ro = sel != null ? readoutOf(view, sel) : null;
  const cap = `해마다 연말 기준 등락(%) · 가격 지수(배당 제외) · ${view.currency === "달러" ? "미국 달러 기준" : "포인트 기준"}`;
  return (
    <section data-testid="yearly-grid" className="rounded-2xl bg-card p-4 shadow-sm dark:shadow-none">
      {question && <p data-testid="q-grid" className="mb-2 text-xs text-muted-foreground text-balance break-keep">{question}</p>}
      <h3 data-testid="yearly-grid-title" className="text-base font-bold">{view.label} 연도별 수익률</h3>
      <p className="mt-1 text-2xs leading-snug text-muted-foreground text-pretty break-keep">{cap}</p>
      <div
        ref={ref} role="grid" aria-label={`${view.label} 연도별 수익률, 열은 연대·행은 끝자리`} data-testid="year-grid"
        style={{ gridTemplateColumns: `12px repeat(${decs.length}, minmax(0, 1fr))`, touchAction: "pan-y" }}
        className="-mx-4 mt-3 grid [--gl:37_99_235] [--gp:225_29_72] dark:[--gl:96_165_250] dark:[--gp:251_113_133]"
        onPointerDown={(e) => { dragging.current = true; pick(e.clientX, e.clientY); }}
        onPointerMove={(e) => { if (dragging.current) pick(e.clientX, e.clientY); }}
        onPointerUp={() => { dragging.current = false; }} onPointerCancel={() => { dragging.current = false; }} onPointerLeave={() => { dragging.current = false; }}
      >
        <div className="h-7" />
        {decs.map((t) => <div key={t} role="columnheader" className="flex h-7 items-center justify-center text-2xs font-semibold tabular-nums text-muted-foreground">{t}</div>)}
        {Array.from({ length: 10 }, (_, k) => (
          <FragmentRow key={k} k={k} decs={decs} first={first} last={last} view={view} period={period} sel={sel} onKey={move} onSel={setSel} />
        ))}
      </div>
      <div className="mt-2.5 flex items-center gap-2 text-2xs text-muted-foreground">
        <span aria-hidden className="flex h-2.5 shrink-0 overflow-hidden rounded-sm [--gl:37_99_235] [--gp:225_29_72] dark:[--gl:96_165_250] dark:[--gp:251_113_133]">
          {[-40, -20, -5].map((v) => <i key={v} className="block h-full w-3" style={{ background: `rgb(var(--gl) / ${gridAlpha(v)})` }} />)}
          <i className="block h-full w-3 bg-secondary" />
          {[5, 20, 40].map((v) => <i key={v} className="block h-full w-3" style={{ background: `rgb(var(--gp) / ${gridAlpha(v)})` }} />)}
        </span>
        <span className="text-balance break-keep">−40% 이하 ~ +40% 이상, 진할수록 많이 움직인 해</span>
      </div>
      <div className="mt-1.5 flex items-center gap-2 text-2xs text-muted-foreground"><i aria-hidden className="inline-block h-[3px] w-4 rounded-sm bg-brand" /><span data-testid="yearly-legend-period">아래 기간 수익률에서 고른 기간</span></div>
      <div data-testid="invest-readout-grid" aria-live="polite" className="mt-2 min-h-[3.25rem] text-sm">
        {ro && showLevels ? (
          <div className="flex flex-wrap items-center gap-x-1.5">
            <span>{ro.year}년 말 <b className="font-bold tabular-nums">{ro.level}</b></span><span>·</span>
            <b className={`font-bold tabular-nums ${ro.ret == null ? "" : getProfitLossColor(ro.ret)}`}>{ro.ret == null ? "—" : fmtPct(ro.ret)}</b><span>·</span>
            <span className="text-muted-foreground">{ro.dir}</span>{ro.recession && <><span>·</span><span className="text-muted-foreground">경기침체</span></>}
            {ro.events && <div className="basis-full pt-0.5 text-xs leading-snug break-keep" data-testid="readout-events"><span className="text-muted-foreground">사건</span> {ro.events}</div>}
          </div>
        ) : <p className="flex h-7 items-center text-xs text-muted-foreground">{READOUT_HINT}</p>}
      </div>
    </section>
  );
}

function FragmentRow({ k, decs, first, last, view, period, sel, onKey, onSel }: {
  k: number; decs: number[]; first: number; last: number; view: IndexView; period: { sy: number; ey: number }; sel: number | null;
  onKey: (e: KeyboardEvent, Y: number) => void; onSel: (y: number) => void;
}) {
  const tabbable = sel ?? last;
  return (
    <>
      <div role="rowheader" className="flex h-10 items-center justify-center text-2xs tabular-nums text-muted-foreground">{k}</div>
      {decs.map((t) => {
        const Y = t + k;
        if (Y < first || Y > last) return <div key={t} aria-hidden className="h-10" />;
        const r = view.ret[Y - view.start] as number, near0 = Math.abs(r) < 0.05, inP = Y > period.sy && Y <= period.ey, on = sel === Y;
        const shadow = [on ? "inset 0 0 0 2px var(--foreground)" : "", inP ? "inset 0 -3px 0 var(--brand)" : "", "inset -1px -1px 0 var(--card)"].filter(Boolean).join(",");
        return (
          <button
            key={t} type="button" role="gridcell" data-testid="year-cell" data-y={Y} data-ret={r} tabIndex={Y === tabbable ? 0 : -1}
            aria-label={`${Y}년 ${fmtPct(r)}${on ? ", 선택됨" : ""}`}
            onClick={() => onSel(Y)} onKeyDown={(e) => onKey(e, Y)}
            style={{ background: near0 ? "var(--secondary)" : `rgb(var(${r > 0 ? "--gp" : "--gl"}) / ${gridAlpha(r).toFixed(3)})`, boxShadow: shadow }}
            className="h-10 min-w-0 text-2xs font-semibold tabular-nums text-foreground outline-none motion-safe:transition-[box-shadow,transform] motion-safe:duration-100 active:scale-[0.96] focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-inset"
          >{f1(r)}</button>
        );
      })}
    </>
  );
}
