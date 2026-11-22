"use client";

// R4: 크게 오른 해 목록(행 48px, 전수)과 행 펼침. 연간 등락 > +20%(반올림 전). 해석·인과 문장 0, 비율 % 0.
import { ChevronRight } from "lucide-react";
import { useState } from "react";
import type { IndexView } from "@/lib/invest/calc";
import type { PatternData, RiseYear } from "@/lib/invest/pattern";
import { RISE_NOTE, RISE_SUB } from "@/lib/invest/pattern";
import { DIR_LABEL, fmtPct, fmtRate } from "@/lib/invest/text";
import { DirMark } from "./drop-list";
import { NOWRAP_PCT, NoBreak, EventName } from "./nowrap";

const pp = (v: number) => (v > 0 ? "+" : v < 0 ? "−" : "") + Math.abs(v).toFixed(2) + "%p";

export function RiseDetail({ view, r }: { view: IndexView; r: RiseYear }) {
  const us = view.rate === "us";
  return (
    <div data-testid="rise-detail" data-year={r.y} className="px-3 pb-3.5 pt-1 text-xs leading-relaxed text-pretty break-keep motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200">
      <div className="flex flex-wrap items-baseline gap-x-2.5">
        <div className="text-2xl font-bold leading-tight tabular-nums text-rose-600 dark:text-rose-400">{fmtPct(r.ret)}</div>
        <div className="text-muted-foreground tabular-nums">{r.y}년 말까지 한 해</div>
      </div>
      <ul className="mt-2.5 flex flex-col gap-1.5">
        <li data-testid="rise-rate">{r.rateFrom != null && r.rateTo != null ? <>그해 금리 {fmtRate(r.rateFrom)}에서 {fmtRate(r.rateTo)}로 · {DIR_LABEL[r.dir]}</> : "그해 금리 자료가 없어요"}</li>
        <li>{r.prevDir === "none" ? "전년 금리 자료가 없어요" : `전년 금리 ${DIR_LABEL[r.prevDir]}`}</li>
        {r.y10 != null && <li>{us ? "10년물" : "국고채 10년"} 그해 말 {fmtRate(r.y10)}{r.d10 != null && <> · 전년 말보다 {pp(r.d10)}</>}</li>}
        {us && <li data-testid="rise-recession">{r.recessionEndMonth != null ? `이 해 ${r.recessionEndMonth}월에 미국 경기침체가 끝났어요(NBER)` : "이 해에 미국 경기침체는 없었어요(NBER)"}</li>}
        {r.dropPeak && <li data-testid="rise-peak">{`이 해 말이 '${r.dropPeak}'의 고점이었어요.`}</li>}
      </ul>
      <div data-testid="rise-events" className="mt-2.5 flex items-start gap-1.5">
        <i aria-hidden className="mt-1.5 inline-block size-2 shrink-0 rounded-full bg-foreground" />
        <div className="min-w-0">
          {r.events.length === 0 ? <span className="text-muted-foreground">이 해에 적어 둔 사건은 없어요</span> : (
            <>
              <span className="text-muted-foreground">같은 시기 사건</span>
              {r.events.map((q) => (
                <div key={q.id} className="mt-1" data-event-id={q.id}>
                  <span className="font-semibold"><EventName name={q.name} /></span> <span className="text-muted-foreground">{q.date} · <NoBreak text={q.cat} /></span>
                  <div className="text-muted-foreground break-keep text-pretty" data-testid="event-fact"><NoBreak text={q.fact} phrases={[]} tails={NOWRAP_PCT} /></div>
                </div>
              ))}
            </>
          )}
        </div>
      </div>
      <p className="mt-2 text-2xs text-muted-foreground">{RISE_NOTE}</p>
    </div>
  );
}

export function RiseList({
  view, pattern, selYear, onSelect, inlineDetail, limit, onMore,
}: {
  view: IndexView;
  pattern: PatternData;
  selYear: number | null;
  onSelect: (y: number | null) => void;
  inlineDetail: boolean;
  /** 모바일 소목록: 최신 {limit}행만 먼저, `나머지 N개 더 보기`로 전수(R7) */
  limit?: number;
  onMore?: () => void;
}) {
  const [all, setAll] = useState(false);
  const rows = [...pattern.rise].reverse();
  const shown = limit && !all ? rows.slice(0, limit) : rows;
  return (
    <div data-testid="rise-list">
      <p className="mt-2 text-2xs leading-snug text-muted-foreground text-pretty break-keep">{RISE_SUB}</p>
      <div className="-mx-3 mt-1 xl:mx-0">
        {shown.map((r) => {
          const open = selYear === r.y, recEnd = r.recessionEndMonth != null;
          return (
            <div key={r.y} data-testid="rise-row" className={`rounded-xl transition-colors duration-150 ${open ? "bg-secondary" : ""}`}>
              <button type="button" aria-expanded={open} onClick={() => onSelect(inlineDetail && open ? null : r.y)} className="flex min-h-12 w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/50 motion-safe:transition-transform active:scale-[0.99]">
                <span className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <span className="text-base font-semibold tabular-nums">{r.y}년</span>
                  <span className="text-sm font-semibold tabular-nums text-rose-600 dark:text-rose-400">{fmtPct(r.ret)}</span>
                  {recEnd && <span className="rounded-md bg-secondary px-1.5 text-2xs font-semibold text-muted-foreground" data-testid="rise-tag">침체 끝난 해</span>}
                </span>
                <span className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap text-xs text-muted-foreground"><DirMark dir={r.dir} />금리 {DIR_LABEL[r.dir]}<ChevronRight aria-hidden className={`size-4 transition-transform duration-200 ${open ? "rotate-90" : ""}`} /></span>
              </button>
              {open && inlineDetail && <RiseDetail view={view} r={r} />}
            </div>
          );
        })}
      </div>
      {limit && !all && rows.length > limit && (
        <button type="button" data-testid="rise-more" onClick={() => { setAll(true); onMore?.(); }} className="mt-1 inline-flex min-h-10 w-full items-center justify-center rounded-xl bg-secondary text-sm font-semibold text-muted-foreground outline-none transition-transform focus-visible:ring-2 focus-visible:ring-ring/50 active:scale-[0.98]">나머지 {rows.length - limit}개 더 보기</button>
      )}
    </div>
  );
}
