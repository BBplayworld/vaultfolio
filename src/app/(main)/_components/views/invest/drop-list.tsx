"use client";

// 크게 빠진 때 목록(행 56px) + 행 펼침(낙폭·3칸·확대 그림·침체 1줄·같은 시기 사건 ≤2건과 사실 1줄). 표본 전수(R7): N건 전부를 행으로 보인다.
import { ChevronRight } from "lucide-react";
import type { Episode, EventPoint, IndexView, RateDir } from "@/lib/invest/calc";
import { DIR_VERB, DIR_LABEL, LIST_NOTE_2, LIST_SUB, EMPTY_LIST, fmtPct, fmtRate, listNote } from "@/lib/invest/text";
import type { MarketHistoryData } from "@/lib/invest/types";
import { C } from "./chart-style";
import { ZoomChart } from "./zoom-chart";

/** 금리 방향 표식: 올라감 = 면, 내려감 = 빗금, 거의 그대로 = 짧은 선(색이 아니라 모양으로 구분) */
export function DirMark({ dir }: { dir: RateDir }) {
  if (dir === "up") return <i aria-hidden className="inline-block h-2.5 w-3.5 shrink-0 rounded-[3px]" style={{ background: C.ink2 }} />;
  if (dir === "down") return <i aria-hidden className="inline-block h-2.5 w-3.5 shrink-0 rounded-[3px]" style={{ background: `repeating-linear-gradient(135deg, ${C.ink2} 0 2px, transparent 2px 5px)`, outline: `1px solid ${C.ink3}`, outlineOffset: -1 }} />;
  if (dir === "flat") return <i aria-hidden className="inline-block w-2.5 shrink-0 align-middle" style={{ borderTop: `2px solid ${C.ink2}`, borderRadius: 1 }} />;
  return null;
}

function EpisodeDetail({ data, view, ep, index, width }: { data: MarketHistoryData; view: IndexView; ep: Episode; index: number; width: number }) {
  const inner = view.eps.filter((q) => q !== ep && ep.ry != null && q.py > ep.ty && q.py < ep.ry);
  const notes = [
    inner.length ? `전고점을 되찾는 동안 '${inner[0].name}' 하락이 한 번 더 있었어요.` : "",
    ep.dir === "none" && view.rate === "kr" ? "한국은행 금리는 1999년 5월부터 자료가 있어요(2008년 3월 전은 콜금리 목표)." : "",
    ep.dir === "none" && view.rate === "us" ? "연준 기준금리 목표는 1982년 9월부터 자료가 있어요." : "",
  ].filter(Boolean).join(" ");
  const evs: EventPoint[] = ep.evl
    .map((id) => view.ev.find((q) => q.id === id))
    .filter((q): q is EventPoint => !!q)
    .sort((a, b) => (a.id === ep.same ? 1 : 0) - (b.id === ep.same ? 1 : 0) || a.t - b.t)
    .slice(0, 2);
  return (
    <div data-testid="episode-detail" data-ep={index} className="px-3 pb-3.5 pt-1 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200">
      <div className="flex flex-wrap items-baseline gap-x-2.5">
        <div data-testid="detail-dd" className="text-2xl font-bold leading-tight tabular-nums text-blue-600 dark:text-blue-400">{fmtPct(ep.dd)}</div>
        <div className="text-xs text-muted-foreground tabular-nums">고점 {ep.py}년 말 · 바닥 {ep.ty}년 말{ep.ongoing ? " · 진행 중" : ""}</div>
      </div>
      <div className="mt-2.5 grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.25fr)] gap-2.5">
        <div><div className="text-2xs leading-snug text-muted-foreground break-keep">고점에서 바닥까지</div><div className="mt-0.5 text-sm font-semibold tabular-nums">{ep.ty - ep.py}년</div></div>
        <div><div className="text-2xs leading-snug text-muted-foreground break-keep">고점에서 전고점까지</div><div className="mt-0.5 text-sm font-semibold tabular-nums">{ep.ry ? `${ep.ry - ep.py}년` : "아직이에요"}</div></div>
        <div>
          <div className="text-2xs leading-snug text-muted-foreground break-keep">그 사이 금리</div>
          {ep.dir === "none" ? <div className="mt-0.5 text-sm text-muted-foreground">자료가 없어요</div> : (
            <div className="mt-0.5 text-sm font-semibold"><span className="inline-flex items-center gap-1.5"><DirMark dir={ep.dir} />{DIR_VERB[ep.dir as Exclude<RateDir, "none">]}</span><span className="block text-xs font-normal text-muted-foreground tabular-nums">{fmtRate(ep.rf as number)}에서 {fmtRate(ep.rt as number)}로</span></div>
          )}
        </div>
      </div>
      <div className="-ml-0.5 mt-3"><ZoomChart data={data} view={view} ep={ep} width={width} /></div>
      {notes && <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground text-pretty break-keep">{notes}</p>}
      {ep.recs != null && (
        <div data-testid="detail-recession" className="mt-2.5 flex items-start gap-1.5 text-xs leading-relaxed text-pretty break-keep">
          <i aria-hidden className="mt-1 inline-block h-2.5 w-3 shrink-0 rounded-[2px]" style={{ background: "color-mix(in oklab, var(--foreground) 13%, transparent)", borderTop: `2px solid ${C.ink2}` }} />
          <span>{ep.recs.length ? ep.recs.map((t) => `미국 경기침체 ${t}(NBER)`).join(", ") : "이 기간에 미국 경기침체는 없었어요(NBER)"}</span>
        </div>
      )}
      {evs.length > 0 && (
        <div data-testid="detail-events" className="mt-2.5 flex items-start gap-1.5 text-xs leading-relaxed text-pretty break-keep">
          <i aria-hidden className="mt-1.5 inline-block size-2 shrink-0 rounded-full bg-foreground" />
          <div className="min-w-0">
            <span className="text-muted-foreground">같은 시기 사건</span>
            {evs.map((q) => (
              <div key={q.id} className="mt-1" data-event-id={q.id}>
                <span className="font-semibold">{q.name}</span> <span className="text-muted-foreground">{q.date} · {q.cat}</span>
                <div className="text-muted-foreground" data-testid="event-fact">{q.fact}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export { EpisodeDetail };

export function DropList({
  data, view, sel, yr, onSelect, inlineDetail, width, bare = false,
}: {
  data: MarketHistoryData;
  view: IndexView;
  sel: number | null;
  yr: number | null;
  onSelect: (k: number | null) => void;
  inlineDetail: boolean;
  width: number;
  /** 세그먼트(크게 빠진 때 | 크게 오른 해)가 제목을 대신할 때 제목 줄 없이 보조문만 */
  bare?: boolean;
}) {
  const dmax = Math.max(...view.eps.map((e) => -e.dd), 0) > 60 ? 80 : 60, dstep = 20;
  const ticks: number[] = []; for (let t = dstep; t <= dmax; t += dstep) ticks.push(t);
  return (
    <div data-testid="invest-list">
      <div className={bare ? "" : "border-t border-border/60 pt-4 -mx-3 px-3 xl:mx-0 xl:border-t-0 xl:px-0 xl:pt-1"}>
        {!bare && <h3 className="text-base font-bold">크게 빠진 때</h3>}
        <p className={`${bare ? "mt-2" : "mt-0.5"} text-2xs leading-snug text-muted-foreground text-pretty break-keep`}>{LIST_SUB}</p>
      </div>
      {view.eps.length === 0 ? (
        <p data-testid="drop-empty" className="mt-3 text-sm text-muted-foreground">{EMPTY_LIST}</p>
      ) : (
        <>
          <div aria-hidden className="relative mx-3 mt-2.5 h-3.5">
            {ticks.map((t) => <span key={t} className="absolute top-0 whitespace-nowrap text-2xs text-muted-foreground tabular-nums" style={{ left: `${(t / dmax) * 100}%`, transform: `translateX(${t === dmax ? "-100%" : "-50%"})` }}>{fmtPct(-t, 0)}</span>)}
          </div>
          <div className="-mx-3 mt-0.5 xl:mx-0">
            {view.eps.map((e, k) => {
              const open = sel === k, hl = yr != null && yr > e.py && yr <= e.ty;
              return (
                <div key={k} data-testid="drop-row" className={`rounded-xl transition-colors duration-150 ${open ? "bg-secondary" : ""}`}>
                  <button
                    type="button" data-k={k} aria-expanded={open} onClick={() => onSelect(inlineDetail && sel === k ? null : k)}
                    className={`relative block min-h-14 w-full rounded-xl px-3 py-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/50 motion-safe:transition-transform active:scale-[0.99] ${hl ? "ring-2 ring-brand ring-inset" : ""}`}
                  >
                    <div className="flex min-h-[22px] items-center justify-between gap-2">
                      <span className="min-w-0 text-base font-semibold break-keep">{e.name}{e.ongoing && <span className="ml-1.5 rounded-md border border-dashed px-1.5 text-2xs font-semibold text-muted-foreground" style={{ borderColor: C.ink2 }}>진행 중</span>}</span>
                      <span className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap text-xs text-muted-foreground"><DirMark dir={e.dir} />{DIR_LABEL[e.dir]}<ChevronRight aria-hidden className={`size-4 transition-transform duration-200 ${open ? "rotate-90" : ""}`} /></span>
                    </div>
                    <div className="mt-2 flex items-center">
                      <div className={`relative h-2 flex-1 rounded ${open ? "bg-card" : "bg-secondary"}`}>
                        {ticks.map((t) => <i key={t} aria-hidden className="absolute -bottom-0.5 -top-0.5 w-px" style={{ left: `${(t / dmax) * 100}%`, background: C.ink3 }} />)}
                        <i className="absolute inset-y-0 left-0 rounded bg-blue-600 dark:bg-blue-400" style={{ width: `${(-e.dd / dmax) * 100}%` }} />
                      </div>
                    </div>
                  </button>
                  {open && inlineDetail && <EpisodeDetail data={data} view={view} ep={e} index={k} width={width} />}
                </div>
              );
            })}
          </div>
        </>
      )}
      <p className="mt-2 text-2xs leading-relaxed text-muted-foreground text-pretty break-keep">{listNote(view)}</p>
      <p className="mt-1 text-2xs leading-relaxed text-muted-foreground text-pretty break-keep">{LIST_NOTE_2}</p>
    </div>
  );
}
