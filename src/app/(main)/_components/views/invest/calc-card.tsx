"use client";

// ③ 그해 말에 넣었다면 — 금액 입력 없이 배수·% 만. 반올림 전 값으로 계산해 표시 때 한 번만 반올림한다(lib/invest/calc).
// 기본 시작 = 데이터 마지막 연도 − 10(고정 규칙), 끝 = 마지막 연도. 입력은 메모리에만 두고 저장하지 않는다.
import { useRef, useState } from "react";
import { InlineSelector } from "../../layout/ui/inline-selector";
import { calcInvest, clampCalcRange, defaultCalcStart, type CalcMethod, type IndexView } from "@/lib/invest/calc";
import { CALC_DIV, CALC_FOOT, calcText } from "@/lib/invest/text";
import { getProfitLossColor } from "@/config/theme";

const METHODS = [{ value: "lump", label: "한 번에" }, { value: "yearly", label: "해마다" }] as const;
const SELECT_CLS = "h-10 min-w-0 flex-1 appearance-none rounded-xl bg-secondary pl-3 pr-8 text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring/50";

export function CalcCard({ view, onFirstChange }: { view: IndexView; onFirstChange?: () => void }) {
  const [method, setMethod] = useState<CalcMethod>("lump");
  const init = clampCalcRange(view, defaultCalcStart(view.last), view.last);
  const [range, setRange] = useState(init);
  const fired = useRef(false);
  const touch = () => { if (!fired.current) { fired.current = true; onFirstChange?.(); } };
  const { sy, ey } = clampCalcRange(view, range.sy, range.ey);
  const r = calcInvest(view, sy, ey, method);
  const t = calcText(view, sy, ey, method, r);
  const years = view.years;
  return (
    <section data-testid="invest-sec3" className="rounded-2xl bg-card p-4 shadow-sm dark:shadow-none">
      <div className="mb-3 flex items-baseline gap-2"><h3 className="text-base font-bold">그해 말에 넣었다면</h3><small className="text-2xs text-muted-foreground">금액은 입력하지 않아요</small></div>
      <InlineSelector fullWidth value={method} onChange={(v) => { setMethod(v); touch(); }} options={METHODS} ariaLabel="넣는 방식" />
      <div className="mt-2.5 flex gap-2">
        {([["start", "시작", sy, years.filter((y) => y < ey)], ["end", "끝", ey, years.filter((y) => y > sy)]] as const).map(([k, l, v, opts]) => (
          <label key={k} className="relative flex min-w-0 flex-1 items-center">
            <span className="pointer-events-none absolute left-3 z-10 text-2xs text-muted-foreground">{l}</span>
            <select
              aria-label={`${l} 연도`} data-testid={`calc-${k}`} value={v} className={`${SELECT_CLS} pl-10`}
              onChange={(e) => { const n = +e.target.value; setRange(k === "start" ? { sy: n, ey } : { sy, ey: n }); touch(); }}
            >
              {opts.map((y) => <option key={y} value={y}>{y}년 말</option>)}
            </select>
            <span aria-hidden className="pointer-events-none absolute right-3 text-muted-foreground">⌄</span>
          </label>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        <span className="inline-flex h-6 items-center rounded-full bg-secondary px-2.5 text-xs font-semibold">{view.currency === "달러" ? "달러 기준" : "포인트 기준"}</span>
        <span className="inline-flex h-6 items-center rounded-full bg-secondary px-2.5 text-xs font-semibold">지수 값만(배당 빼고)</span>
      </div>
      <div data-testid="calc-result" aria-live="polite" className="mt-3.5 rounded-2xl bg-secondary p-4">
        <div className="text-sm text-pretty break-keep">{t.sentence}</div>
        <div className="my-1 flex items-baseline gap-2">
          <span data-testid="calc-mult" className="text-2xl font-bold tabular-nums">{t.mult}</span>
          <span className={`text-sm font-semibold tabular-nums ${getProfitLossColor(r.mult - 1)}`}>{t.total}</span>
        </div>
        <div className="text-xs text-muted-foreground">
          {t.sub.kind === "cagr"
            ? <>해마다 평균 <b data-testid="calc-cagr" className={`font-semibold tabular-nums ${t.sub.neg ? "text-blue-600 dark:text-blue-400" : "text-rose-600 dark:text-rose-400"}`}>{t.sub.pct}</b> {t.sub.verb} 셈이에요</>
            : <>가장 낮았던 해 말은 {t.sub.year}년 말, <b className={`font-semibold tabular-nums ${t.sub.neg ? "text-blue-600 dark:text-blue-400" : "text-rose-600 dark:text-rose-400"}`}>{t.sub.pct}</b>였어요</>}
        </div>
      </div>
      <p className="mt-3 text-2xs leading-relaxed text-muted-foreground">{CALC_DIV}</p>
      <p className="mt-1 text-2xs leading-relaxed text-muted-foreground text-pretty break-keep" data-testid="calc-foot">{CALC_FOOT}</p>
    </section>
  );
}
