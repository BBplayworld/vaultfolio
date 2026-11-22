"use client";

// R4: 새 접힘 섹션 `하락 전 12개월과 크게 오른 해에 있었던 일`. 결론 3줄(템플릿+데이터) → 하락별 조건 표 → 기준선 표 → 오른 해 기준선 표 → 각주.
// 같은 시기에 있었다는 기록만 보인다. 비율 %·평가 어휘 0. 내용은 SSR에도 있다(파생값만 — 지수 수준값 없음).
import { ChevronDown } from "lucide-react";
import { useState } from "react";
import type { BaseRow, PatternData } from "@/lib/invest/pattern";
import { PATTERN_TITLE, patternNote } from "@/lib/invest/pattern";

const TH = "border-b border-border bg-card px-2 py-1.5 text-2xs font-semibold leading-snug text-muted-foreground align-bottom";
const TD = "border-b border-border px-2 py-1.5 align-top";

function BaseTable({ title, hit, rows, label }: { title: string; hit: string; rows: BaseRow[]; label: string }) {
  return (
    <div className="mt-3">
      <h4 className="text-sm font-semibold">{title}</h4>
      <div tabIndex={0} role="region" aria-label={`${label} 표, 가로로 밀어 볼 수 있어요`} className="mt-1.5 overflow-x-auto rounded-xl shadow-[inset_0_0_0_1px_var(--border)] outline-none focus-visible:ring-2 focus-visible:ring-ring/50">
        <table className="w-full min-w-[420px] border-separate border-spacing-0 text-xs tabular-nums">
          <caption className="sr-only">{label}</caption>
          <thead><tr><th scope="col" className={`${TH} text-left`}>조건</th><th scope="col" className={`${TH} text-right`}>기간</th><th scope="col" className={`${TH} text-right`}>조건이 있던 해</th><th scope="col" className={`${TH} text-right`}>{hit}</th><th scope="col" className={`${TH} text-right`}>기간 전체</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label}>
                <th scope="row" className={`${TD} text-left font-medium`}>{r.label}</th>
                <td className={`${TD} text-right text-muted-foreground`}>{r.from}~{r.to}년</td>
                <td className={`${TD} text-right`}>{r.years}년 중 {r.nCond}년</td>
                <td className={`${TD} text-right`}>{r.kHit}년</td>
                <td className={`${TD} text-right`}>{r.years}년 중 {r.baseHit}년</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function PatternSection({ pattern, last, onOpen }: { pattern: PatternData; last: number; onOpen?: () => void }) {
  const [open, setOpen] = useState(false);
  const toggle = () => { const n = !open; setOpen(n); if (n) onOpen?.(); };
  return (
    <div data-testid="invest-pattern" className="mt-4 border-t border-border/60 pt-1 xl:mt-0 xl:border-t-0">
      <button type="button" aria-expanded={open} aria-controls="invest-pattern-panel" data-testid="pattern-button" onClick={toggle} className="flex min-h-12 w-full items-center justify-between gap-2 rounded-xl text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/50 motion-safe:transition-transform active:scale-[0.99]">
        <span><b className="block text-base font-semibold text-balance break-keep">{PATTERN_TITLE}</b><small className="block text-2xs font-normal leading-snug text-muted-foreground">결과를 알 수 있는 해까지 세어 표로 모았어요</small></span>
        <ChevronDown aria-hidden className={`size-5 shrink-0 text-muted-foreground motion-safe:transition-transform motion-safe:duration-200 ${open ? "rotate-180" : ""}`} />
      </button>
      <div id="invest-pattern-panel" {...(open ? {} : { inert: true })} className={`grid motion-safe:transition-[grid-template-rows,visibility] motion-safe:duration-[240ms] motion-safe:ease-out ${open ? "visible grid-rows-[1fr]" : "invisible grid-rows-[0fr]"}`}>
        <div className="min-h-0 overflow-hidden">
          <div data-testid="pattern-conclusion" className="mt-1 flex flex-col gap-1.5 text-sm leading-relaxed text-pretty break-keep">
            {pattern.lines.map((l, i) => <p key={i} className={i === 0 ? "font-semibold" : "text-muted-foreground"}>{l}</p>)}
          </div>
          <div className="mt-3">
            <h4 className="text-sm font-semibold">크게 빠지기 전 12개월</h4>
            <div tabIndex={0} role="region" aria-label="하락별 조건 표, 가로로 밀어 볼 수 있어요" data-testid="pattern-predrop" className="mt-1.5 overflow-x-auto rounded-xl shadow-[inset_0_0_0_1px_var(--border)] outline-none focus-visible:ring-2 focus-visible:ring-ring/50">
              <table className="w-full min-w-[420px] border-separate border-spacing-0 text-xs">
                <caption className="sr-only">크게 빠진 때 직전 12개월에 있었던 조건</caption>
                <thead><tr><th scope="col" className={`${TH} sticky left-0 text-left`}>고점 해</th>{pattern.condLabels.map((c) => <th key={c} scope="col" className={`${TH} text-left`}>{c}</th>)}</tr></thead>
                <tbody>
                  {pattern.preDrop.map((r) => (
                    <tr key={r.py}>
                      <th scope="row" className={`${TD} sticky left-0 bg-card text-left font-medium`}>{r.name}<span className="block text-2xs font-normal text-muted-foreground tabular-nums">{r.py}년</span></th>
                      {r.cells.map((c, i) => <td key={i} className={`${TD} ${c.state === "none" ? "text-muted-foreground" : ""}`}>{c.text}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <BaseTable title="같은 조건이 있던 모든 해" hit="그중 고점이 된 해" rows={pattern.preDropBase} label="조건별 기준선" />
          <BaseTable title="크게 오른 해" hit="그중 20% 넘게 오른 해" rows={pattern.riseBase} label="크게 오른 해 기준선" />
          <p className="mt-2 text-2xs leading-relaxed text-muted-foreground text-pretty break-keep" data-testid="pattern-note">{patternNote(last)}</p>
        </div>
      </div>
    </div>
  );
}
