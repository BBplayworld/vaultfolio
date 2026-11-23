"use client";

// 투자 탭 `세 지수` 보기(5.141 #270): A1 `같은 해 세 지수 오르내림` — 공통 해 40개를 5분류로 나눠 세고, 행을 펼쳐 해 칩 → 그해 세 값 1줄.
// 데이터는 이미 만든 IndexView 3개(저장·전송 0). 색·막대·점 0(값은 전경색), 눌리는 것 전부 40px 이상.
import { ChevronDown, ChevronRight } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { InlineSelector } from "../../layout/ui/inline-selector";
import { A1_ROWS, A2_BASES, DECADE_METRICS, a1RowOf, classifyYears, criterionRows, decadeLabel, decadeRows, decadeSign, decadeText, recessionAround, sameYearRets, spreadFirstMonth, type A2Basis, type DecadeMetric, type ThreeViews } from "@/lib/invest/three";
import { A2_TEXT, A3_TEXT, CALC_PAST, THREE_TEXT, fmtPct } from "@/lib/invest/text";
import { INDEX_META } from "@/lib/invest/calc";
import type { MarketHistoryData } from "@/lib/invest/types";
import type { RegionSplit } from "@/lib/xray/region-split";
import { getProfitLossColor } from "@/config/theme";
import { FoldNote } from "./fold-note";
import { NOWRAP_TAIL, NoBreak, ThreeYear } from "./nowrap";

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
                    <div data-testid="a1-selected" role="status" aria-live="polite" className="flex min-h-14 items-center rounded-xl bg-secondary px-3 py-2 text-xs max-[359px]:min-h-16">
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

const METRIC_OPTIONS = DECADE_METRICS.map((m) => ({
  value: m.value,
  // <360은 `−15% 이하`로 줄이고 접근 이름은 정식(SameYear 약칭 관행). 글자 영역이 모자라 잘리는 것을 막는다(C25)
  label: m.value === "dd15" ? <><span className="max-[360px]:sr-only">{m.label}</span><span aria-hidden className="min-[360px]:hidden">{m.short}</span></> : m.label,
  testId: `a5-metric-${m.value}`,
}));

/** A5 연대별 요약: 행 = 연대, 열 = 세 지수, 값은 지표 칸 하나(해마다 평균·누적·−15% 이하 해). 누적·평균은 기간 카드와 같은 계산(periodResult) */
export function ThreeA5({ views, onMetric }: { views: ThreeViews; onMetric?: () => void }) {
  const [metric, setMetric] = useState<DecadeMetric>("avg");
  const rows = decadeRows(views);
  const name = DECADE_METRICS.find((m) => m.value === metric)!.label;
  return (
    <section data-testid="three-a5" className={CARD}>
      <p className="mb-2 text-xs text-muted-foreground text-balance break-keep">{THREE_TEXT.qA5}</p>
      <h3 className="text-base font-bold">{THREE_TEXT.titleA5}</h3>
      <div className="mt-2">
        <InlineSelector fullWidth tight value={metric} onChange={(m) => { if (m !== metric) { setMetric(m); onMetric?.(); } }} options={METRIC_OPTIONS} ariaLabel="연대별 지표 선택" />
      </div>
      <table data-testid="a5-table" className="mt-1 w-full border-separate border-spacing-0 text-sm tabular-nums">
        <caption className="sr-only">연대별 {name}</caption>
        <thead>
          <tr>
            {THREE_TEXT.a5Head.map((h, i) => <th key={h} scope="col" className={`h-10 text-xs font-semibold text-muted-foreground break-keep ${i ? "text-right" : "w-[3.75rem] text-left"}`}>{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.decade}>
              <th scope="row" data-testid={`a5-decade-${r.decade}`} className="h-10 border-t border-border py-1 text-left align-middle font-semibold">
                {decadeLabel(r.decade)}
                {r.to != null && <small className="block text-xs font-normal text-muted-foreground">~{r.to}</small>}
              </th>
              {r.cells.map((c, i) => (
                <td key={i} data-testid={`a5-cell-${r.decade}-${i}`} className="h-10 border-t border-border py-1 text-right align-middle">
                  <span className={`font-medium ${!c ? "text-muted-foreground" : metric === "dd15" ? "" : getProfitLossColor(decadeSign(c, metric))}`}>{decadeText(c, metric)}</span>
                  {c?.from != null && <small className="block text-xs text-muted-foreground">{c.from}~</small>}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <p data-testid="a5-def" className="mt-2 text-xs leading-relaxed text-muted-foreground text-pretty break-keep">
        {THREE_TEXT.a5Def} <NoBreak text={CALC_PAST} phrases={[]} tails={NOWRAP_TAIL} />
      </p>
    </section>
  );
}

const A2_OPTIONS = A2_BASES.map((b) => ({ value: b.value, label: b.label, testId: `a2-basis-${b.value}` }));
const A_INDEX_KEYS = ["spx", "ndx", "kospi"] as const;

/** A2 지표로 나눠 본 오른 해(5.142 #275): 기준 1개(금리·물가·실업률·금리차) × 열 3지수, 셀 `{n}해 중 {k}해`. 값은 전경색(손익색 0).
 *  기준 전환 때 칩 줄 위치는 그대로이고 그 아래 표 높이만 바뀐다(min-height 예약 0) */
export function ThreeA2({ data, views, go = 0, onBasis, onPattern }: { data: MarketHistoryData; views: ThreeViews; go?: number; onBasis?: () => void; onPattern: () => void }) {
  const [basis, setBasis] = useState<A2Basis>("rate");
  const rootRef = useRef<HTMLElement>(null);
  const res = useMemo(() => criterionRows(data, views, basis), [data, views, basis]);
  // PatternSection의 `세 지수를 같은 기준으로 본 표 ›`로 들어오면 기준은 금리, 이 카드가 화면 위로 온다
  useEffect(() => {
    if (go <= 0) return;
    setBasis("rate");
    const t = setTimeout(() => rootRef.current?.scrollIntoView({ block: "start" }), 0);
    return () => clearTimeout(t);
  }, [go]);
  const labels = A_INDEX_KEYS.map((k) => INDEX_META[k].label);
  const COLS = "grid grid-cols-3 md:grid-cols-[minmax(0,1fr)_repeat(3,7.5rem)]";
  return (
    <section ref={rootRef} data-testid="three-a2" className={`${CARD} scroll-mt-14`}>
      <p className="mb-2 text-xs text-muted-foreground text-balance break-keep">{A2_TEXT.q}</p>
      <h3 className="text-base font-bold">{A2_TEXT.title}</h3>
      <p data-testid="a2-summary" className="mt-1 text-xs leading-snug text-muted-foreground text-pretty break-keep">{A2_TEXT.summary}</p>
      <div className="mt-2 xl:max-w-[400px]">
        <InlineSelector fullWidth tight value={basis} onChange={(b) => { if (b !== basis) { setBasis(b); onBasis?.(); } }} options={A2_OPTIONS} ariaLabel={A2_TEXT.basisLabel} />
      </div>
      <div key={basis} role="table" aria-label={A2_TEXT.title} data-testid="a2-table" className="mt-1 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-150">
        <div role="row" data-testid="a2-head" className={`${COLS} items-end pt-2`}>
          <span className="hidden text-xs font-semibold md:block">{A2_TEXT.head[0]}</span>
          {A2_TEXT.head.slice(1).map((h) => <span key={h} role="columnheader" className="text-right text-xs font-semibold break-keep">{h}</span>)}
        </div>
        <p className="text-right text-xs text-muted-foreground">{A2_TEXT.sub}</p>
        {res.rows.map((r, j) => (
          <div key={r.id} role="row" data-testid={`a2-row-${j}`} className={`${COLS} items-center gap-y-0.5 border-t border-border/60 py-2 md:min-h-11`}>
            <span role="rowheader" className="col-span-3 text-sm font-medium text-pretty break-keep md:col-span-1">{r.label}</span>
            {r.cells.map((c, i) => (
              <span key={i} role="cell" data-testid={`a2-cell-${j}-${A_INDEX_KEYS[i]}`} aria-label={c ? A2_TEXT.cell(c.n, c.k) : A2_TEXT.empty} className="text-right tabular-nums">
                {c ? (
                  <>
                    <span className="block text-xs text-muted-foreground md:inline md:text-sm md:text-foreground">{c.n}해 중</span>{" "}
                    <span className="block text-base font-bold md:inline md:text-sm">{c.k}해</span>
                  </>
                ) : <span className="text-muted-foreground">{A2_TEXT.empty}</span>}
              </span>
            ))}
          </div>
        ))}
      </div>
      <p data-testid="a2-range" className="mt-1 border-t border-border/60 pt-2 text-xs leading-snug text-muted-foreground text-pretty break-keep tabular-nums">
        {labels.map((l, i) => <span key={l}>{i > 0 && <>{" "}<span aria-hidden>·</span>{" "}</>}<span className="whitespace-nowrap">{res.ranges[i] ? `${l} ${res.ranges[i]!.from}~${res.ranges[i]!.to}년` : `${l} —`}</span></span>)}
      </p>
      <FoldNote label={A2_TEXT.defLabel} testId="a2-info">
        <p data-testid="a2-def" className="mt-1 text-xs leading-relaxed text-muted-foreground text-pretty break-keep">{A2_TEXT.def(basis, { rateFrom: data.rate.us.from, spreadFrom: spreadFirstMonth(data) })}</p>
      </FoldNote>
      <button type="button" data-testid="a2-link-pattern" onClick={onPattern} className="inline-flex min-h-10 items-center rounded-sm text-sm font-semibold text-primary outline-none focus-visible:ring-2 focus-visible:ring-ring/50 motion-safe:transition-transform motion-safe:active:scale-[0.98]">{A2_TEXT.linkPattern} <span aria-hidden className="ml-1">›</span></button>
    </section>
  );
}

const A3_OPTIONS = (["spx", "ndx"] as const).map((k) => ({ value: k, label: INDEX_META[k].label, testId: `a3-index-${k}` }));

/** A3 경기침체 앞뒤 연말 등락(5.142 #276): 기본 접힘. NBER 9구간 × 전해·시작 해·끝난 다음 해, S&P 500·나스닥100(카드 안 로컬 상태·저장 0) */
export function ThreeA3({ data, views, onOpen }: { data: MarketHistoryData; views: ThreeViews; onOpen?: () => void }) {
  const [open, setOpen] = useState(false);
  const [ix, setIx] = useState<"spx" | "ndx">("spx");
  const id = useId();
  const rows = useMemo(() => recessionAround(views[ix], data.rec), [views, ix, data.rec]);
  const COLS = "grid grid-cols-3 md:grid-cols-[minmax(0,1fr)_repeat(3,7.5rem)]";
  return (
    <section data-testid="three-a3" className={CARD}>
      <button type="button" aria-expanded={open} aria-controls={id} data-testid="a3-button" onClick={() => { const o = !open; setOpen(o); if (o) onOpen?.(); }} className="flex min-h-11 w-full items-center justify-between gap-2 rounded-xl text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/50 motion-safe:transition-transform motion-safe:active:scale-[0.99]">
        <span className="min-w-0"><span className="mb-1 block text-xs text-muted-foreground text-balance break-keep">{A3_TEXT.q}</span><span className="block text-base font-bold">{A3_TEXT.title}</span></span>
        <ChevronDown aria-hidden className={`size-4 shrink-0 text-muted-foreground motion-safe:transition-transform motion-safe:duration-200 ${open ? "rotate-180" : ""}`} />
      </button>
      <div id={id} {...(open ? {} : { inert: true })} className={`grid motion-safe:transition-[grid-template-rows,visibility] motion-safe:duration-200 ${open ? "visible grid-rows-[1fr]" : "invisible grid-rows-[0fr]"}`}>
        <div className="min-h-0 overflow-hidden">
          <div className="pt-2">
            <p className="mb-1.5 text-xs text-muted-foreground text-pretty break-keep">{A3_TEXT.pick}</p>
            <InlineSelector fullWidth tight value={ix} onChange={setIx} options={A3_OPTIONS} ariaLabel={A3_TEXT.pickLabel} />
            <div role="table" aria-label={A3_TEXT.title} data-testid="a3-table" className="mt-1">
              <div role="row" data-testid="a3-head" className={`${COLS} items-end pt-2`}>
                <span className="hidden text-xs font-semibold md:block">{A3_TEXT.head[0]}</span>
                {A3_TEXT.head.slice(1).map((h) => <span key={h} role="columnheader" className="min-h-10 text-right text-xs font-semibold break-keep">{h}</span>)}
              </div>
              {rows.map((r, j) => (
                <div key={r.label} role="row" data-testid={`a3-row-${j}`} className={`${COLS} items-start gap-y-0.5 border-t border-border/60 py-2 md:min-h-11`}>
                  <span role="rowheader" className="col-span-3 text-sm font-medium text-pretty break-keep md:col-span-1">{r.label}</span>
                  {r.cells.map((c, i) => (
                    <span key={i} role="cell" aria-label={c.ret == null ? `${A3_TEXT.head[i + 1]} —` : `${A3_TEXT.head[i + 1]} ${fmtPct(c.ret, 1)} ${c.year}년`} className="min-h-9 text-right tabular-nums">
                      {c.ret == null ? <span className="text-muted-foreground">—</span> : (
                        <>
                          <span className={`block text-sm font-bold md:inline ${getProfitLossColor(c.ret)}`}>{fmtPct(c.ret, 1)}</span>{" "}
                          <small className="block text-xs text-muted-foreground md:ml-1 md:inline">{c.year}년</small>
                        </>
                      )}
                    </span>
                  ))}
                </div>
              ))}
            </div>
            <p data-testid="a3-def" className="mt-2 text-xs leading-relaxed text-muted-foreground text-pretty break-keep">{A3_TEXT.def}</p>
          </div>
        </div>
      </div>
    </section>
  );
}

/** B2 한 줄(5.142 #278): 내 주식 국내·해외(주식 X-Ray 지역 축과 같은 값) → 누르면 X-Ray 지역 축. 비교 문장·손익색 0 */
export function ThreeMine({ split, onOpen }: { split: RegionSplit; onOpen: () => void }) {
  const seg = [`국내 ${split.domestic}%`, `해외 ${split.overseas}%`, ...(split.other > 0 ? [`기타 ${split.other}%`] : [])];
  return (
    <button
      type="button" data-testid="invest-mine-split" onClick={onOpen} aria-label={`내 주식 ${seg.join(" ")}, 주식 X-Ray 지역 보기`}
      className="flex min-h-11 w-full items-center justify-between gap-2 rounded-xl bg-card px-4 py-1 text-left text-sm font-medium shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50 motion-safe:transition-transform motion-safe:active:scale-[0.98] dark:shadow-none xl:col-span-2 xl:row-start-1"
    >
      <span className="break-keep tabular-nums">내 주식{" "}{seg.map((t, i) => <span key={t}>{i > 0 && <span aria-hidden>{i === 1 ? "·" : " · "}</span>}<b className="whitespace-nowrap font-semibold">{t}</b></span>)}</span>
      <ChevronRight aria-hidden className="size-4 shrink-0 text-muted-foreground" />
    </button>
  );
}

/** 세 지수 보기 본문(모바일 세로 gap-3, 1280은 두 열: A1 좌·A5 우, 아래 A2·A3 전폭). 순서: B2 → A1 → A3(접힘) → A2(펼침) → A5(펼침). 보유 상태 첫 화면(접지 844)에 A2·A5 숫자가 들어오지 않게 하는 순서 조정(5.141 게이트: 간격이 아니라 순서) */
export function ThreeView({ data, views, yr, onYear, onMetric, mySplit, onMine, a2Go, onBasis, onPattern, onRecession }: { data: MarketHistoryData; views: ThreeViews; yr: number | null; onYear: (y: number | null) => void; onMetric?: () => void; mySplit?: RegionSplit | null; onMine?: () => void; a2Go?: number; onBasis?: () => void; onPattern: () => void; onRecession?: () => void }) {
  // 1280(두 열)에서는 A1 좌·A5 우를 같은 줄에 두고(5.141 배치 유지) 나머지는 DOM 순서대로 전폭으로 쌓는다
  const R = mySplit && onMine ? 1 : 0;
  const rowA = R ? "xl:row-start-2" : "xl:row-start-1", rowB = R ? "xl:row-start-3" : "xl:row-start-2", rowC = R ? "xl:row-start-4" : "xl:row-start-3";
  return (
    <div data-testid="invest-three" className="flex min-w-0 flex-col gap-3 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-150 xl:grid xl:grid-cols-[400px_minmax(0,1fr)] xl:items-start xl:gap-4">
      {mySplit && onMine && <ThreeMine split={mySplit} onOpen={onMine} />}
      <div className={`min-w-0 xl:col-start-1 ${rowA}`}><ThreeA1 views={views} yr={yr} onYear={onYear} /></div>
      <div className={`min-w-0 xl:col-span-2 ${rowB}`}><ThreeA3 data={data} views={views} onOpen={onRecession} /></div>
      <div className={`min-w-0 xl:col-span-2 ${rowC}`}><ThreeA2 data={data} views={views} go={a2Go} onBasis={onBasis} onPattern={onPattern} /></div>
      <div className={`min-w-0 xl:col-start-2 ${rowA}`}><ThreeA5 views={views} onMetric={onMetric} /></div>
    </div>
  );
}
