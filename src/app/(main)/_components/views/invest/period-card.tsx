"use client";

// R4.1: 기간 수익률 카드(③ 통합) — 같은 기간·같은 총액(=1)을 한 번에 vs 매달 나눠 넣었을 때. 기간 알약·시작/끝·결과 2줄·어림 1줄+ⓘ·그림.
// 계산은 lib/invest/period(연말값 평균 가격, 보간 0). 입력은 메모리에만(저장 0). 평가·유불리 문구 0.
import { ChevronDown, Info } from "lucide-react";
import Link from "next/link";
import { useId, useMemo, useRef, useState } from "react";
import type { IndexView } from "@/lib/invest/calc";
import { APPROX_DEF, APPROX_LINE, HOLD_LINE, IRR_SENTENCE, PERIOD_FOOT_1, dcaSentence, fixPeriod, lumpSentence, periodPresets, periodResult, periodText, rollingRange } from "@/lib/invest/period";
import { A6_TEXT, B1_OPTION, CALC_DIV, CALC_FOOT, CALC_PAST, MINUS, RATIO_LINK_LABEL, a6Bounds, fmtPct } from "@/lib/invest/text";
import { getProfitLossColor } from "@/config/theme";
import { C, HALO, SVG_TEXT } from "./chart-style";
import { NOWRAP_TAIL, NoBreak } from "./nowrap";
import { useElementWidth } from "./use-width";

const SELECT_CLS = "h-10 min-w-0 flex-1 appearance-none rounded-xl bg-secondary pl-9 pr-6 text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring/50";
const stepAx = (M: number) => [0.5, 1, 2, 5, 10, 20, 50, 100, 200].find((s) => M / s <= 4) ?? 200;
const f0 = (v: number) => { const r = Math.round(v); return r > 0 ? `+${r}` : r < 0 ? `${MINUS}${Math.abs(r)}` : "0"; };

function PeriodChart({ view, sy, ey, width: W, cy, onPick }: { view: IndexView; sy: number; ey: number; width: number; cy: number | null; onPick: (y: number) => void }) {
  const r = periodResult(view, sy, ey), S = r.series, n = r.n;
  const M = Math.max(...S.lump, ...S.dca, 1) * 1.08, H1 = 92, T1 = 46, yy = (v: number) => T1 + H1 - (v / M) * H1;
  const st = stepAx(M), ticks: number[] = []; for (let v = 0; v <= M; v += st) ticks.push(v);
  const tl = (v: number) => (v === 0 ? "0" : `${Math.round(v * 10) / 10}배`);
  const G = Math.max(...ticks.map((v) => tl(v).length)) * 6.4 + 8, PW = W - G, bw = PW / (n + 1), X = (i: number) => bw * (i + 0.5);
  const rets: number[] = []; for (let Y = sy + 1; Y <= ey; Y++) rets.push(view.ret[Y - view.start] as number);
  const showLbl = bw >= 20, mp = Math.max(0, ...rets), mn = Math.max(0, ...rets.map((x) => -x)), pad = showLbl ? 14 : 3, T2 = T1 + H1 + 40, H2 = 92;
  // N-4: 값 라벨 폭(≈`+24` 20px·`−12.3` 더 넓음)이 이웃 라벨과 4px 안으로 붙으면 뒤쪽 라벨은 생략
  const lblOn = new Set<number>(); { let lastX = -99; rets.forEach((x, k) => { const w = f0(x).length * 7.2 + 2, cx = X(k + 1); if (cx - w / 2 >= lastX + 4) { lblOn.add(k + 1); lastX = cx + w / 2; } }); }
  const sc = (H2 - 2 * pad) / (mp + mn || 1), z = T2 + pad + mp * sc;
  const xs = [sy]; for (let Y = sy + 1; Y <= ey; Y++) if ((Y - sy) % (bw >= 34 ? 1 : bw >= 17 ? 2 : bw >= 7 ? 5 : 10) === 0) xs.push(Y);
  if (xs[xs.length - 1] !== ey) xs.push(ey);
  // 연도 글자(≈26px)가 겹치지 않게 폭 기준으로 솎는다: 첫 라벨은 왼쪽 정렬(0~26px), 다음은 중심이 직전 라벨 오른쪽 끝 + 16px 이상(R-5)
  const keep: number[] = [];
  for (const Y of xs) {
    const x = X(Y - sy), right = keep.length ? (keep.length === 1 && X(keep[0] - sy) < 16 ? 26 : X(keep[keep.length - 1] - sy) + 13) : -99;
    if (x - 13 >= right + 3) keep.push(Y);
    else if (Y === ey && keep.length > 1) { keep.pop(); if (x - 13 >= (keep.length === 1 && X(keep[0] - sy) < 16 ? 26 : X(keep[keep.length - 1] - sy) + 13) + 3) keep.push(Y); }
  }
  xs.length = 0; xs.push(...keep);
  const TH = T2 + H2 + 18;
  const pts = (A: number[]) => A.map((v, i) => `${X(i).toFixed(1)},${yy(v).toFixed(1)}`).join(" ");
  const ex = X(n), yl = yy(S.lump[n]), yd = yy(S.dca[n]);
  // 끝 라벨(R-1): 선과 겹칠 수 없게 그림 위 전용 줄에 둔다(마커 모양으로 선과 연결). 끝점 마커는 그대로 선 끝에 있다
  const lw = (t: string) => [...t].reduce((q, ch) => q + (/[0-9.]/.test(ch) ? 7 : ch === " " ? 3.5 : 12.5), 0);
  const tl1 = `한 번에 ${S.lump[n].toFixed(2)}배`, tl2 = `매달 ${S.dca[n].toFixed(2)}배`;
  const x2 = 18 + lw(tl1) + 16;
  const alt = `${sy}년 말부터 ${ey}년 말까지 같은 총액을 한 번에 넣은 경우 ${r.lumpMult.toFixed(2)}배, 매달 나눠 넣은 경우 ${r.dcaMult.toFixed(2)}배. 값은 위 결과와 같아요`;
  return (
    <svg viewBox={`0 0 ${W} ${TH}`} width={W} height={TH} role="img" aria-label={alt} data-testid="period-chart" style={{ display: "block", touchAction: "pan-y", userSelect: "none", fontVariantNumeric: "tabular-nums" }}>
      <text className={SVG_TEXT} fontSize={12} x={0} y={11}>넣을 총액 = 1배 · 평가액과 넣은 돈</text>
      {ticks.map((v) => <g key={v}><line x1={0} x2={PW} y1={yy(v)} y2={yy(v)} stroke={C.fg} strokeOpacity={v === 1 ? 0.3 : 0.1} strokeDasharray={v === 1 ? "3 3" : undefined} /><text className={SVG_TEXT} fontSize={12} x={W} y={yy(v) + 4} textAnchor="end">{tl(v)}</text></g>)}
      {!ticks.includes(1) && <line x1={0} x2={PW} y1={yy(1)} y2={yy(1)} stroke={C.fg} strokeOpacity={0.3} strokeDasharray="3 3" />}
      {cy != null && cy >= sy && cy <= ey && <line x1={X(cy - sy)} x2={X(cy - sy)} y1={T1 - 4} y2={T2 + H2} stroke={C.brand} strokeWidth={1.5} strokeOpacity={0.7} />}
      <polyline points={pts(S.principal)} fill="none" stroke={C.brand} strokeOpacity={0.45} strokeWidth={1.25} data-testid="principal-steps" />
      <g data-testid="line-lump">
        <polyline fill="none" stroke={C.ink2} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" points={pts(S.lump)} />
        {bw >= 14 && S.lump.map((v, i) => <circle key={i} cx={X(i)} cy={yy(v)} r={2.6} fill={C.card} stroke={C.ink2} strokeWidth={1.5} />)}
      </g>
      <g data-testid="line-dca">
        <polyline fill="none" stroke={C.brand} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" points={pts(S.dca)} />
        {bw >= 14 && S.dca.map((v, i) => <rect key={i} x={X(i) - 2.6} y={yy(v) - 2.6} width={5.2} height={5.2} transform={`rotate(45 ${X(i)} ${yy(v)})`} fill={C.card} stroke={C.brand} strokeWidth={1.5} />)}
      </g>
      <circle cx={ex} cy={yl} r={3.6} fill={C.ink2} stroke={C.card} strokeWidth={2} />
      <circle cx={ex} cy={yd} r={3.6} fill={C.brand} stroke={C.card} strokeWidth={2} />
      <g>
        <circle cx={6} cy={27} r={3.6} fill={C.card} stroke={C.ink2} strokeWidth={2} />
        <text data-testid="end-lump" className="fill-foreground" x={16} y={31} fontSize={12} fontWeight={600}>{tl1}</text>
        <rect x={x2 - 4} y={24} width={7} height={7} transform={`rotate(45 ${x2} 27.5)`} fill={C.card} stroke={C.brand} strokeWidth={2} />
        <text data-testid="end-dca" className="fill-foreground" x={x2 + 10} y={31} fontSize={12} fontWeight={600}>{tl2}</text>
      </g>
      <text className={SVG_TEXT} fontSize={12} x={0} y={T2 - 10}>연간 등락(%)</text>
      <line x1={0} x2={PW} y1={z} y2={z} stroke={C.fg} strokeOpacity={0.32} />
      {rets.map((x, k) => {
        const i = k + 1, h = Math.abs(x) * sc, w = Math.min(bw * 0.62, 20);
        return (
          <g key={i}>
            <rect data-testid="period-bar" data-y={sy + i} x={X(i) - w / 2} y={x >= 0 ? z - h : z} width={w} height={Math.max(h, 1)} rx={Math.min(2, w / 4)} className={x >= 0 ? "fill-rose-600 dark:fill-rose-400" : "fill-blue-600 dark:fill-blue-400"} />
            {showLbl && lblOn.has(i) && <text className="fill-foreground" style={HALO} x={X(i)} y={x >= 0 ? z - h - 4 : z + h + 12} textAnchor="middle" fontSize={12} fontWeight={600}>{f0(x)}</text>}
          </g>
        );
      })}
      {xs.map((Y) => { const x = X(Y - sy); return <text key={Y} className={SVG_TEXT} fontSize={12} x={x < 16 ? 0 : x} y={TH - 3} textAnchor={x < 16 ? "start" : "middle"}>{Y}</text>; })}
      <rect x={0} y={0} width={PW} height={TH} fill="transparent" data-testid="period-hit" onPointerDown={(e) => { const rc = e.currentTarget.ownerSVGElement!.getBoundingClientRect(); const px = ((e.clientX - rc.left) / rc.width) * W; onPick(sy + Math.max(0, Math.min(n, Math.floor(px / bw)))); }} />
    </svg>
  );
}

/** A6(5.142) 본문: 현재 기간 길이로 모든 시작 해를 계산한 범위(접힘 안). 버튼은 `period-honest` 줄 끝에 인라인으로 붙어 높이를 더하지 않는다 */
function PeriodRangeBody({ view, n, r, open, id }: { view: IndexView; n: number; r: NonNullable<ReturnType<typeof rollingRange>>; open: boolean; id: string }) {
  const b = a6Bounds(r.min, r.max);
  return (
    <div id={id} data-testid="period-range" {...(open ? {} : { inert: true })} className={`grid motion-safe:transition-[grid-template-rows,visibility] motion-safe:duration-200 ${open ? "visible grid-rows-[1fr]" : "invisible grid-rows-[0fr]"}`}>
      <div className="min-h-0 overflow-hidden">
        <div className="mt-1 rounded-xl bg-secondary px-3 py-2 text-xs leading-relaxed text-pretty break-keep">
          <p data-testid="period-range-body" className="tabular-nums">{A6_TEXT.body(view.label, n, r.n, b.min, b.max, r.loss)}</p>
          <p className="mt-1.5 text-muted-foreground"><NoBreak text={CALC_PAST} phrases={[]} tails={NOWRAP_TAIL} /></p>
          <p data-testid="period-range-info" className="mt-1.5 text-muted-foreground">{A6_TEXT.info(n)}</p>
        </div>
      </div>
    </div>
  );
}

export function PeriodCard({ view, period, onChange, question, ratioLink, mine, onRange }: { view: IndexView; period: { sy: number; ey: number }; onChange: (p: { sy: number; ey: number }) => void; question?: string; /** T1: 있으면 `/ratio` 링크 1줄을 보이고 누를 때 호출(GA) */ ratioLink?: () => void; /** B1(5.142): 시작 연도 선택지 `내 첫 매입 해 {Y}년` — 고르면 시작 = Y−1, 끝 = 마지막 해(기존 fixPeriod). 이 지수 범위 밖이면 숨김 */ mine?: { year: number; onUse: () => void }; /** A6 첫 펼침(GA) */ onRange?: () => void }) {
  const { sy, ey } = fixPeriod(view, period.sy, period.ey);
  const r = periodResult(view, sy, ey), t = periodText(r);
  const [info, setInfo] = useState(false);
  const [rangeOpen, setRangeOpen] = useState(false);
  const rangeId = useId();
  const range = useMemo(() => rollingRange(view, ey - sy), [view, ey, sy]);
  const [cy, setCy] = useState<number | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const w = useElementWidth(boxRef);
  const set = (a: number, b: number) => { setCy(null); onChange(fixPeriod(view, a, b)); };
  const presets = periodPresets(view);
  const sOpts = view.years.filter((y) => y < view.last), eOpts = view.years.filter((y) => y > sy);
  const rowCls = "rounded-xl";
  const mineOk = mine != null && mine.year - 1 >= view.start && mine.year - 1 < view.last;
  const cyRet = cy != null && cy > sy ? (view.ret[cy - view.start] as number) : null;
  return (
    <section data-testid="invest-sec3" className="rounded-2xl bg-card p-4 shadow-sm dark:shadow-none">
      {question && <p data-testid="q-period" className="mb-2 text-xs text-muted-foreground text-balance break-keep">{question}</p>}
      <div className="mb-3 flex flex-wrap items-baseline gap-x-2"><h3 data-testid="invest-sec3-title" className="text-base font-bold">{view.label} 기간 수익률</h3><small className="text-xs text-muted-foreground">그해 말에 넣었다면</small></div>
      <div role="group" aria-label="기간 길이" data-testid="period-presets" className="flex gap-1.5">
        {presets.map((p) => { const on = ey === view.last && sy === view.last - p.years; return (
          <button key={p.key} type="button" aria-pressed={on} onClick={() => set(view.last - p.years, view.last)} className={`h-10 flex-1 rounded-xl text-sm font-semibold outline-none transition-[background-color,color,transform] duration-150 focus-visible:ring-2 focus-visible:ring-ring/50 active:scale-[0.96] ${on ? "bg-brand/15 text-brand dark:text-indigo-300" : "bg-secondary text-muted-foreground"}`}>{p.label}</button>
        ); })}
      </div>
      <div className="mt-2.5 flex gap-2">
        {([["start", "시작", sy, sOpts], ["end", "끝", ey, eOpts]] as const).map(([k, l, v, opts]) => (
          <label key={k} className="relative flex min-w-0 flex-1 items-center">
            <span className="pointer-events-none absolute left-2.5 z-10 text-xs text-muted-foreground">{l}</span>
            <select aria-label={`${l} 연도 말`} data-testid={`period-${k}`} value={v} className={SELECT_CLS} onChange={(e) => { if (e.target.value === "mine") { if (mine) { mine.onUse(); set(mine.year - 1, view.last); } return; } set(k === "start" ? +e.target.value : sy, k === "end" ? +e.target.value : ey); }}>
              {k === "start" && mineOk && <option value="mine">{B1_OPTION(mine!.year)}</option>}
              {opts.map((y) => <option key={y} value={y}>{y}년 말</option>)}
            </select>
            <span aria-hidden className="pointer-events-none absolute right-2 text-muted-foreground">⌄</span>
          </label>
        ))}
      </div>
      <div data-testid="calc-result" aria-live="polite" className="mt-3.5 rounded-2xl bg-secondary p-4">
        <p data-testid="same-total" className="mb-2 text-xs text-muted-foreground md:hidden">같은 총액, {sy}년 말 → {ey}년 말</p>
        <div data-testid="calc-lump" role="group" aria-label={lumpSentence(view, r)} className={rowCls}>
          <div className="flex items-start gap-1.5 text-sm text-pretty break-keep"><svg width="14" height="14" aria-hidden className="mt-0.5 shrink-0"><circle cx="7" cy="7" r="4.5" fill="var(--card)" stroke={C.ink2} strokeWidth="2" /></svg><span className="md:hidden">한 번에 넣었다면</span><span className="hidden md:inline">{lumpSentence(view, r)}</span></div>
          <div className="my-1 flex flex-wrap items-baseline gap-x-2 gap-y-0.5"><span data-testid="calc-mult-lump" className="text-2xl font-bold tabular-nums">{t.lumpMult}</span><span data-testid="calc-total-lump" className={`text-base font-semibold tabular-nums ${getProfitLossColor(r.lumpMult - 1)}`}>{t.lumpTotal}</span><span className="text-xs text-muted-foreground">해마다 평균 <b data-testid="calc-cagr-lump" className={`font-semibold tabular-nums ${getProfitLossColor(r.lumpCagr)}`}>{t.lumpCagr}</b></span></div>
</div>
        <div aria-hidden className="my-3 h-px bg-border" />
        <div data-testid="calc-dca" role="group" aria-label={dcaSentence(view, r)} className={rowCls}>
          <div className="flex items-start gap-1.5 text-sm text-pretty break-keep"><svg width="14" height="14" aria-hidden className="mt-0.5 shrink-0"><rect x="3" y="3" width="8" height="8" transform="rotate(45 7 7)" fill="var(--card)" stroke={C.brand} strokeWidth="2" /></svg><span className="md:hidden">매달 나눠 넣었다면({12 * r.n}번)</span><span className="hidden md:inline">{dcaSentence(view, r)}</span></div>
          <div className="my-1 flex items-baseline gap-2"><span data-testid="calc-mult-dca" className="text-2xl font-bold tabular-nums">{t.dcaMult}</span><span data-testid="calc-total-dca" className={`text-base font-semibold tabular-nums ${getProfitLossColor(r.dcaMult - 1)}`}>{t.dcaTotal}</span></div>
          <div data-testid="calc-hold-dca" className="text-xs text-muted-foreground break-keep"><NoBreak text={HOLD_LINE(t.hold)} phrases={[]} tails={NOWRAP_TAIL} /></div>
        </div>
      </div>
      <p data-testid="calc-past" className="mt-2 text-xs leading-snug text-muted-foreground text-pretty break-keep"><NoBreak text={CALC_PAST} phrases={[]} tails={NOWRAP_TAIL} />
        {/* T1(5.141): 별도 줄이 아니라 이 단락 끝에 잇는다(높이 증가 최소). 히트영역 40px은 after로 확보(레이아웃 높이 0) */}
        {ratioLink && (
          <>{" "}<Link href="/ratio" data-testid="invest-ratio-link" onClick={ratioLink} className="relative ml-1 inline-block whitespace-nowrap rounded-sm font-semibold text-primary outline-none after:absolute after:inset-x-0 after:-inset-y-3 after:content-[''] focus-visible:ring-2 focus-visible:ring-ring/50">{RATIO_LINK_LABEL} <span aria-hidden>›</span></Link></>
        )}
      </p>
      <p data-testid="period-honest" className="mt-2 text-xs leading-snug text-muted-foreground text-pretty break-keep">
        {APPROX_LINE}
        {/* ⓘ는 끝 어절 바로 뒤(40px 히트, 줄 높이는 음수 마진으로 유지) */}
        <button type="button" aria-expanded={info} aria-controls="period-honest-def" aria-label="어림 방식 보기" data-testid="honest-info" onClick={() => setInfo((o) => !o)} className="-my-3.5 ml-0.5 inline-flex size-10 items-center justify-center rounded-full align-middle text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/50"><Info aria-hidden className="size-4" /></button>
        {/* A6(5.142): 같은 줄 끝에 이어 붙인다(높이 +0). 히트영역 40px은 after로 확보 */}
        {range && (
          <button type="button" aria-expanded={rangeOpen} aria-controls={rangeId} data-testid="period-range-button" onClick={() => { const o = !rangeOpen; setRangeOpen(o); if (o) onRange?.(); }} className="relative ml-1 whitespace-nowrap rounded-sm align-baseline text-xs font-medium text-foreground/80 outline-none after:absolute after:inset-x-0 after:-inset-y-3 after:content-[''] focus-visible:ring-2 focus-visible:ring-ring/50">
            <ChevronDown aria-hidden className={`mr-0.5 inline size-3.5 align-[-3px] motion-safe:transition-transform motion-safe:duration-200 ${rangeOpen ? "rotate-180" : ""}`} />{A6_TEXT.button}
          </button>
        )}
      </p>
      <div id="period-honest-def" {...(info ? {} : { inert: true })} className={`grid motion-safe:transition-[grid-template-rows,visibility] motion-safe:duration-200 ${info ? "visible grid-rows-[1fr]" : "invisible grid-rows-[0fr]"}`}>
        <div className="min-h-0 overflow-hidden">
          <p data-testid="honest-def" className="text-xs leading-relaxed text-muted-foreground text-pretty break-keep">{APPROX_DEF}</p>
          <p data-testid="honest-irr" className="mt-1.5 text-xs leading-relaxed text-muted-foreground text-pretty break-keep"><NoBreak text={IRR_SENTENCE(t.irr)} phrases={[]} tails={NOWRAP_TAIL} /></p>
          <p data-testid="period-foot" className="mt-1.5 text-xs leading-relaxed text-muted-foreground text-pretty break-keep">{PERIOD_FOOT_1}</p>
          <p data-testid="calc-div" className="mt-1 text-xs leading-relaxed text-muted-foreground">{CALC_DIV}</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground text-pretty break-keep" data-testid="calc-foot"><NoBreak text={CALC_FOOT} /></p>
        </div>
      </div>
      {range && <PeriodRangeBody view={view} n={ey - sy} r={range} open={rangeOpen} id={rangeId} />}
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1"><svg width="14" height="12" aria-hidden><line x1="0" x2="14" y1="6" y2="6" stroke={C.ink2} strokeWidth="2" /><circle cx="7" cy="6" r="2.6" fill="var(--card)" stroke={C.ink2} strokeWidth="1.5" /></svg>한 번에 넣기</span>
        <span className="inline-flex items-center gap-1"><svg width="14" height="12" aria-hidden><line x1="0" x2="14" y1="6" y2="6" stroke={C.brand} strokeWidth="2" /><rect x="4.4" y="3.4" width="5.2" height="5.2" transform="rotate(45 7 6)" fill="var(--card)" stroke={C.brand} strokeWidth="1.5" /></svg>매달 나눠 넣기</span>
        <span className="inline-flex items-center gap-1"><svg width="16" height="12" aria-hidden><path d="M0 10 L4 10 L4 6 L9 6 L9 2 L16 2" fill="none" stroke={C.brand} strokeOpacity=".45" strokeWidth="1.25" /></svg>나눠 넣은 돈(매달 같은 금액)</span>
      </div>
      <div data-testid="period-readout" aria-live="polite" className="mt-1.5 min-h-7 text-sm">
        {cy != null ? (
          <div className="flex flex-wrap items-center gap-x-1.5"><b className="font-bold">{cy}년 말</b>{cyRet != null && <><span>·</span><span>그해 <b className={`font-bold tabular-nums ${getProfitLossColor(cyRet)}`}>{fmtPct(cyRet)}</b></span></>}<span>·</span><span className="tabular-nums">한 번에 {r.series.lump[cy - sy].toFixed(2)}배</span><span>·</span><span className="tabular-nums">매달 {r.series.dca[cy - sy].toFixed(2)}배</span></div>
        ) : <p className="flex h-7 items-center text-xs text-muted-foreground">해를 누르면 그해 말 두 방식의 평가액이 나와요</p>}
      </div>
      <div ref={boxRef} className="mt-1 min-w-0">{w > 0 ? <PeriodChart view={view} sy={sy} ey={ey} width={w} cy={cy} onPick={setCy} /> : <div className="h-[288px] rounded-xl bg-secondary" aria-hidden />}</div>
      <div className="mt-2.5 flex flex-wrap gap-1.5">
        <span className="inline-flex h-6 items-center rounded-full bg-secondary px-2.5 text-xs font-semibold">{view.currency === "달러" ? "달러 기준" : "포인트 기준"}</span>
        <span className="inline-flex h-6 items-center rounded-full bg-secondary px-2.5 text-xs font-semibold">지수 값만(배당 빼고)</span>
      </div>
    </section>
  );
}
