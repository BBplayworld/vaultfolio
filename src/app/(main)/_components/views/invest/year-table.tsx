"use client";

// 접힌 `연도별 표`(48px 버튼, 기본 접힘, 그림 값의 대체 경로). 최신 연도가 위, 연도 열·머리 고정, 세로 420px·가로 스크롤.
// 금리차 음수는 부호(−)만 쓴다(색·굵기·문구 강조 0). 표는 처음 펼칠 때 그린다(공개 가이드 SSR에 표 HTML 0).
import { ChevronDown } from "lucide-react";
import { useState } from "react";
import type { IndexView } from "@/lib/invest/calc";
import { DIR_LABEL, fmtLevel, fmtPct, fmtPctPlain, fmtSpread } from "@/lib/invest/text";
import { getProfitLossColor } from "@/config/theme";

const US_NOTE = "금리차는 그해 마지막 거래일의 10년물에서 2년물·3개월물을 뺀 값이에요. 2년물은 1976년 6월, 3개월물은 1981년 9월부터 자료가 있어요. 경기침체는 NBER 기준으로 그해에 침체였던 달 수예요.";
const KR_NOTE = "국고채는 그해 마지막 거래일 값이에요. 한국 기준금리는 2008년 3월 전에는 콜금리 목표예요. 사건은 이 지수와 관련 있는 것만 적었어요.";
export const TABLE_HINT = "그림의 값을 해마다 표로 모았어요. 가로로 밀어 볼 수 있어요";

export function YearTable({ view, onOpen }: { view: IndexView; onOpen?: () => void }) {
  const [open, setOpen] = useState(false);
  const [drawn, setDrawn] = useState(false);
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
        <span><b className="block text-base font-semibold">연도별 표</b><small className="block text-2xs font-normal leading-snug text-muted-foreground">{TABLE_HINT}</small></span>
        <ChevronDown aria-hidden className={`size-5 shrink-0 text-muted-foreground motion-safe:transition-transform motion-safe:duration-200 ${open ? "rotate-180" : ""}`} />
      </button>
      <div
        id="yearly-table-panel" {...(open ? {} : { inert: true })}
        className={`grid motion-safe:transition-[grid-template-rows,visibility] motion-safe:duration-[240ms] motion-safe:ease-out ${open ? "visible grid-rows-[1fr]" : "invisible grid-rows-[0fr]"}`}
      >
        <div className="min-h-0 overflow-hidden">
          {drawn && (
            <>
              <div tabIndex={0} role="region" aria-label={`${view.label} 연도별 표, 가로·세로로 밀어 볼 수 있어요`} data-testid="yearly-table" className="mt-2 max-h-[420px] overflow-auto rounded-xl shadow-[inset_0_0_0_1px_var(--border)] outline-none focus-visible:ring-2 focus-visible:ring-ring/50">
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
                          {r.ev.length + r.evx.length ? [...r.ev, ...r.evx].sort((x, z) => x.t - z.t).map((e) => <div key={e.id} className="mb-1 last:mb-0" data-event-id={e.id}><span className="font-medium text-foreground">{e.name}</span><div className="text-2xs leading-snug" data-testid="event-fact">{e.fact}</div></div>) : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-2 text-2xs leading-relaxed text-muted-foreground text-pretty break-keep">{us ? US_NOTE : KR_NOTE}</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
