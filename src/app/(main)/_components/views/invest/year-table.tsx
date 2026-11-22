"use client";

// 접힌 `연도별 표`(48px 버튼, 기본 접힘, 그림 값의 대체 경로). 최신 연도가 위, 연도 열·머리 고정, 세로 420px·가로 스크롤.
// 금리차 음수는 부호(−)만 쓴다(색·굵기·문구 강조 0). 표는 처음 펼칠 때 그린다(공개 가이드 SSR에 표 HTML 0).
import { ChevronDown } from "lucide-react";
import { useState } from "react";
import type { IndexView } from "@/lib/invest/calc";
import { DIR_LABEL, GLOSS, fmtLevel, fmtPct, fmtPctPlain, fmtSpread } from "@/lib/invest/text";
import { ChevronRight } from "lucide-react";
import { NOWRAP_PCT, NoBreak, EventName } from "./nowrap";
import { getProfitLossColor } from "@/config/theme";

const US_NOTE = "금리차는 그해 마지막 거래일의 10년물에서 2년물·3개월물을 뺀 값이에요. 2년물은 1976년 6월, 3개월물은 1981년 9월부터 자료가 있어요. 경기침체는 NBER 기준으로 그해에 침체였던 달 수예요.";
const KR_NOTE = "국고채는 그해 마지막 거래일 값이에요. 한국 기준금리는 2008년 3월 전에는 콜금리 목표예요.";
export const YEAR_NOTE = "사건은 해마다 연준 원문으로 확인한 일을 시간순으로 적었어요. 1996·2006년은 찾지 못해 비워 뒀어요.";
export const TABLE_HINT = "그림의 값을 해마다 표로 모았어요. 가로로 밀어 볼 수 있어요";

export function YearTable({ view, onOpen }: { view: IndexView; onOpen?: () => void }) {
  const [open, setOpen] = useState(false);
  const [drawn, setDrawn] = useState(false);
  const [rowsShown, setRowsShown] = useState(10);
  const [rowOpen, setRowOpen] = useState<number | null>(null);
  const us = view.rate === "us";
  const heads = us
    ? ["연도", "연말 지수", "연간 등락", "기준금리 연말", "금리 방향", "10년물 연말", "장단기 금리차 10년−2년(%p)", "장단기 금리차 10년−3개월(%p)", "경기침체", "사건"]
    : ["연도", "연말 지수", "연간 등락", "기준금리 연말", "금리 방향", "국고채 3년 연말", "국고채 10년 연말", "사건"];
  const toggle = () => { const next = !open; setOpen(next); if (next) { setDrawn(true); onOpen?.(); } };
  return (
    <div data-testid="invest-table" className="mt-4 border-t border-border/60 px-0 pt-1 xl:mt-0 xl:border-t-0">
      <button
        type="button" id="yearly-table-button" aria-expanded={open} aria-controls="yearly-table-panel" onClick={toggle}
        className="flex min-h-12 w-full items-center justify-between gap-2 rounded-xl text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/50 motion-safe:transition-transform active:scale-[0.99]"
      >
        <span><b className="block text-base font-semibold">연도별 표</b><small className="block text-2xs font-normal leading-snug text-muted-foreground"><span className="md:hidden">해를 누르면 나머지 값이 나와요</span><span className="hidden md:inline">{TABLE_HINT}</span></small></span>
        <ChevronDown aria-hidden className={`size-5 shrink-0 text-muted-foreground motion-safe:transition-transform motion-safe:duration-200 ${open ? "rotate-180" : ""}`} />
      </button>
      <div
        id="yearly-table-panel" {...(open ? {} : { inert: true })}
        className={`grid motion-safe:transition-[grid-template-rows,visibility] motion-safe:duration-[240ms] motion-safe:ease-out ${open ? "visible grid-rows-[1fr]" : "invisible grid-rows-[0fr]"}`}
      >
        <div className="min-h-0 overflow-hidden">
          {drawn && (
            <>
              {/* 모바일(<768): 4칸 + 행 펼침(가로 스크롤 0), 최신 10년 + 이전 해 10개 더 보기 */}
              <div data-testid="yearly-list" className="mt-2 md:hidden">
                {view.wip && (
                  <div data-testid="year-wip" className="mb-1 rounded-xl bg-secondary px-3 py-2 text-xs break-keep">
                    <div className="font-semibold tabular-nums">{view.wip.y}년 · 진행 중</div>
                    <div className="mt-1"><span className="font-medium"><EventName name={view.wip.name} /></span> <span className="text-muted-foreground">{view.wip.date} · <NoBreak text={view.wip.cat} /></span><div className="text-2xs text-muted-foreground text-pretty" data-testid="event-fact">{view.wip.fact}</div></div>
                    <div className="mt-1 text-2xs text-muted-foreground">지수 값은 {view.last}년 말까지라 {view.wip.y}년 등락은 없어요.</div>
                  </div>
                )}
                {view.tbl.slice(0, rowsShown).map((r) => {
                  const open = rowOpen === r.y;
                  return (
                    <div key={r.y} className={`rounded-xl ${open ? "bg-secondary" : ""}`}>
                      <button type="button" aria-expanded={open} onClick={() => setRowOpen(open ? null : r.y)} className="grid min-h-10 w-full grid-cols-[3rem_1fr_4.5rem_auto_1rem] items-center gap-1.5 rounded-xl px-2 text-left text-xs tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-ring/50">
                        <span className="font-semibold">{r.y}</span><span className="text-right">{fmtLevel(r.close)}</span>
                        <span className={`text-right ${r.ret == null ? "" : getProfitLossColor(r.ret)}`}>{r.ret == null ? "—" : fmtPct(r.ret, 1)}</span>
                        <span className="whitespace-nowrap text-muted-foreground">{r.dir === "none" ? "—" : DIR_LABEL[r.dir]}</span>
                        <ChevronRight aria-hidden className={`size-4 text-muted-foreground transition-transform duration-200 ${open ? "rotate-90" : ""}`} />
                      </button>
                      {open && (
                        <dl className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1 px-3 pb-3 pt-1 text-xs" data-testid="yearly-row-detail">
                          <dt className="text-muted-foreground">기준금리 연말</dt><dd className="text-right tabular-nums">{fmtPctPlain(r.rate)}</dd>
                          {us ? (
                            <>
                              <dt className="text-muted-foreground">10년물 연말</dt><dd className="text-right tabular-nums">{fmtPctPlain(r.y10)}</dd>
                              <dt className="text-muted-foreground">금리차 10년−2년(%p)</dt><dd className="text-right tabular-nums">{fmtSpread(r.s2)}</dd>
                              <dt className="text-muted-foreground">금리차 10년−3개월(%p)</dt><dd className="text-right tabular-nums">{fmtSpread(r.s3)}</dd>
                              <dt className="text-muted-foreground">경기침체</dt><dd className="text-right tabular-nums">{r.rec ? `${r.rec}개월` : "—"}</dd>
                            </>
                          ) : (
                            <>
                              <dt className="text-muted-foreground">국고채 3년 연말</dt><dd className="text-right tabular-nums">{fmtPctPlain(r.k3)}</dd>
                              <dt className="text-muted-foreground">국고채 10년 연말</dt><dd className="text-right tabular-nums">{fmtPctPlain(r.k10)}</dd>
                            </>
                          )}
                          <dt className="col-span-2 text-muted-foreground">사건</dt>
                          <dd className="col-span-2 break-keep">{r.issues.length ? r.issues.map((e) => <div key={e.id} className="mb-1 last:mb-0"><span className="font-medium"><EventName name={e.name} /></span> <span className="text-muted-foreground">{e.date} · <NoBreak text={e.cat} /></span><div className="text-2xs text-muted-foreground break-keep text-pretty" data-testid="event-fact"><NoBreak text={e.fact} phrases={[]} tails={NOWRAP_PCT} /></div></div>) : "—"}</dd>
                        </dl>
                      )}
                    </div>
                  );
                })}
                {rowsShown < view.tbl.length && <button type="button" data-testid="yearly-more" onClick={() => setRowsShown((n) => n + 10)} className="mt-1 inline-flex min-h-10 w-full items-center justify-center rounded-xl bg-secondary text-sm font-semibold text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/50">이전 해 10개 더 보기</button>}
              </div>
              <div tabIndex={0} role="region" aria-label={`${view.label} 연도별 표, 가로·세로로 밀어 볼 수 있어요`} data-testid="yearly-table" className="mt-2 hidden max-h-[420px] overflow-auto rounded-xl shadow-[inset_0_0_0_1px_var(--border)] outline-none focus-visible:ring-2 focus-visible:ring-ring/50 md:block">
                <table className="w-full whitespace-nowrap border-separate border-spacing-0 text-xs tabular-nums">
                  <caption className="sr-only">{view.label} 연도별 값</caption>
                  <thead>
                    <tr>
                      {heads.map((h, i) => (
                        <th key={h} scope="col" className={`sticky top-0 border-b border-border bg-card px-2.5 py-1.5 align-bottom text-2xs font-semibold leading-snug text-muted-foreground ${i === 0 ? "left-0 z-30 text-left" : i === heads.length - 1 ? "z-20 text-left" : "z-20 text-right"}`}>{h.includes("금리차") ? <>장단기 금리차<br />{h.slice(8)}</> : h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {view.wip && (
                      <tr data-testid="year-wip-row">
                        <td colSpan={heads.length} className="border-b border-border bg-secondary px-2.5 py-2 text-left whitespace-normal break-keep">
                          <span className="font-semibold">{view.wip.y}년 · 진행 중</span>{" "}<span className="font-medium"><EventName name={view.wip.name} /></span> <span className="text-muted-foreground">{view.wip.date} · <NoBreak text={view.wip.cat} /></span>
                          <div className="text-2xs text-muted-foreground" data-testid="event-fact">{view.wip.fact}</div>
                          <div className="text-2xs text-muted-foreground">지수 값은 {view.last}년 말까지라 {view.wip.y}년 등락은 없어요.</div>
                        </td>
                      </tr>
                    )}
                    {view.tbl.map((r) => (
                      <tr key={r.y}>
                        <th scope="row" className="sticky left-0 z-10 border-b border-border bg-card px-2.5 py-1.5 text-left font-semibold">{r.y}</th>
                        <td className="border-b border-border bg-card px-2.5 py-1.5 text-right">{fmtLevel(r.close)}</td>
                        <td className={`border-b border-border bg-card px-2.5 py-1.5 text-right ${r.ret == null ? "" : getProfitLossColor(r.ret)}`}>{r.ret == null ? "—" : fmtPct(r.ret, 2)}</td>
                        <td className="border-b border-border bg-card px-2.5 py-1.5 text-right">{fmtPctPlain(r.rate)}</td>
                        <td className="border-b border-border bg-card px-2.5 py-1.5 text-right">{r.dir === "none" ? "—" : DIR_LABEL[r.dir]}</td>
                        {us ? (
                          <>
                            <td className="border-b border-border bg-card px-2.5 py-1.5 text-right">{fmtPctPlain(r.y10)}</td>
                            <td className="border-b border-border bg-card px-2.5 py-1.5 text-right">{fmtSpread(r.s2)}</td>
                            <td className="border-b border-border bg-card px-2.5 py-1.5 text-right">{fmtSpread(r.s3)}</td>
                            <td className="border-b border-border bg-card px-2.5 py-1.5 text-right">{r.rec ? `${r.rec}개월` : "—"}</td>
                          </>
                        ) : (
                          <>
                            <td className="border-b border-border bg-card px-2.5 py-1.5 text-right">{fmtPctPlain(r.k3)}</td>
                            <td className="border-b border-border bg-card px-2.5 py-1.5 text-right">{fmtPctPlain(r.k10)}</td>
                          </>
                        )}
                        <td className="min-w-[220px] whitespace-normal border-b border-border bg-card px-2.5 py-1.5 text-left text-muted-foreground">
                          {r.issues.length ? r.issues.map((e) => <div key={e.id} className="mb-1 last:mb-0" data-event-id={e.id}><span className="font-medium text-foreground"><EventName name={e.name} /></span><div className="text-2xs leading-snug break-keep text-pretty" data-testid="event-fact"><NoBreak text={e.fact} phrases={[]} tails={NOWRAP_PCT} /></div></div>) : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-2 hidden text-2xs leading-relaxed text-muted-foreground text-pretty break-keep md:block">{us ? US_NOTE : KR_NOTE} {YEAR_NOTE}</p>
              <dl data-testid="invest-gloss" className="mt-3 rounded-xl bg-secondary p-3 text-2xs leading-relaxed text-pretty break-keep">
                {GLOSS.map((g) => <div key={g.term} className="mb-1.5 last:mb-0"><dt className="inline font-semibold">{g.term}</dt> <dd className="inline text-muted-foreground">{g.text}</dd></div>)}
              </dl>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
