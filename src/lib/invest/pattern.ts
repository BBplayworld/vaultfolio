// R4: 크게 오른 해 목록·펼침, '하락 전 12개월과 크게 오른 해에 있었던 일' 섹션의 계산(#263).
// 모두 데이터에서 계산한다(결론 문장 숫자 하드코딩 0). 결과 정의는 O2만 쓴다: 그해 말이 '크게 빠진 때'의 고점이 된 해.
// 분모는 결과를 알 수 있는 {last−1}년까지. 비율 %는 만들지 않는다('N년 중 k년'만). 해석·인과 문장 0.
import { classifyDelta, decRate, INDEX_META, monthIndex, rateDelta, yearIssues, type IndexView, type RateDir } from "./calc";
import type { IndexKey, MarketHistoryData, YearEvent } from "./types";

/** 크게 오른 해 기준: 연간 등락(반올림 전) > +20% */
export const RISE_THRESHOLD = 0.2;
const EPS = 1e-9;

type Cond = (y: number) => boolean | null;

const spreadNegMonths = (d: MarketHistoryData, y: number, which: "a" | "b"): number[] | null => {
  const base = monthIndex(d.spread.from);
  let any = false;
  const neg: number[] = [];
  for (let m = 1; m <= 12; m++) {
    const v = d.spread[which][monthIndex(`${y}-${String(m).padStart(2, "0")}`) - base];
    if (v == null) continue;
    any = true;
    if (v < 0) neg.push(m);
  }
  return any ? neg : null;
};
/** 월 목록 → `1~5월`(연속) / `1·2·3·5월` */
export function monthsLabel(ms: number[]): string {
  const run = ms.every((m, i) => i === 0 || m === ms[i - 1] + 1);
  return run && ms.length > 1 ? `${ms[0]}~${ms[ms.length - 1]}월` : `${ms.join("·")}월`;
}
const usY10 = (d: MarketHistoryData, y: number) => d.usYear.find((r) => r.y === y)?.y10 ?? null;
const krK10 = (d: MarketHistoryData, y: number) => d.krYear.find((r) => r.y === y)?.k10 ?? null;
const d10 = (get: (y: number) => number | null, y: number) => { const a = get(y - 1), b = get(y); return a == null || b == null ? null : b - a; };

export interface PatternCell {
  state: "yes" | "no" | "none";
  /** 표에 쓰는 글자: `●`·`● 4개월(1~5월)`·`–`·`–(내려감)`·`자료 없음` */
  text: string;
}
export interface PreDropRow { name: string; py: number; cells: PatternCell[] }
export interface BaseRow { label: string; from: number; to: number; years: number; nCond: number; kHit: number; baseHit: number }
export interface RiseYear {
  y: number;
  ret: number;
  dir: RateDir;
  prevDir: RateDir;
  rateFrom: number | null;
  rateTo: number | null;
  /** 10년물 그해 말·전년 말 대비(%p) — 미국 지수는 연준 10년물, 코스피는 국고채 10년 */
  y10: number | null;
  d10: number | null;
  /** 미국 지수: 그해 침체가 끝난 달(없으면 null) */
  recessionEndMonth: number | null;
  dropPeak: string | null;
  events: YearEvent[];
}
export interface PatternData {
  key: IndexKey;
  who: "연준" | "한국";
  condLabels: string[];
  preDrop: PreDropRow[];
  preDropBase: BaseRow[];
  riseBase: BaseRow[];
  rise: RiseYear[];
  lines: [string, string, string];
}

export function buildPattern(d: MarketHistoryData, view: IndexView): PatternData {
  const key = view.key, us = view.rate === "us", R = view.rate;
  const who = us ? "연준" : "한국";
  const first = view.start + 1, last = view.last;
  const ret = (y: number) => view.close[y - view.start] / view.close[y - 1 - view.start] - 1;
  const dirOf = (y: number): RateDir => classifyDelta(rateDelta(d, R, y - 1, y));
  const nberStart = new Set(d.rec.map((r) => +r.s.slice(0, 4)));
  const nberEnd = new Map(d.rec.map((r) => [+r.e.slice(0, 4), +r.e.slice(5)]));
  const peaks = new Set(view.eps.map((e) => e.py));

  const pre: { label: string; f: Cond; cell: (y: number) => PatternCell }[] = [];
  const yn = (v: boolean | null, yes = "●", no = "–"): PatternCell => (v == null ? { state: "none", text: "자료 없음" } : v ? { state: "yes", text: yes } : { state: "no", text: no });
  const fedUp: Cond = (y) => (dirOf(y) === "none" ? null : dirOf(y) === "up");
  pre.push({ label: "금리 올라감", f: fedUp, cell: (y) => { const v = fedUp(y); const dr = dirOf(y); return v == null ? yn(v) : v ? yn(v) : { state: "no", text: `–(${dr === "down" ? "내려감" : "그대로"})` }; } });
  if (us) {
    for (const [lab, w] of [["10년−2년 금리차 마이너스인 달", "a"], ["10년−3개월 금리차 마이너스인 달", "b"]] as const) {
      const f: Cond = (y) => { const m = spreadNegMonths(d, y, w); return m == null ? null : m.length > 0; };
      pre.push({ label: lab, f, cell: (y) => { const m = spreadNegMonths(d, y, w); return m == null ? yn(null) : m.length ? { state: "yes", text: `● ${m.length}개월(${monthsLabel(m)})` } : yn(false); } });
    }
    const f: Cond = (y) => nberStart.has(y);
    pre.push({ label: "경기침체 시작", f, cell: (y) => yn(f(y)) });
    const g: Cond = (y) => { const v = d10((q) => usY10(d, q), y); return v == null ? null : v >= 1 - EPS; };
    pre.push({ label: "10년물 1%p 넘게 오름", f: g, cell: (y) => yn(g(y)) });
  } else {
    const g: Cond = (y) => { const v = d10((q) => krK10(d, q), y); return v == null ? null : v >= 1 - EPS; };
    pre.push({ label: "국고채 10년 1%p 넘게 오름", f: g, cell: (y) => yn(g(y)) });
  }
  const preDrop: PreDropRow[] = view.eps.map((e) => ({ name: e.name, py: e.py, cells: pre.map((c) => c.cell(e.py)) }));
  const preDropBase: BaseRow[] = pre.map((c) => {
    const ys: number[] = [];
    for (let y = first; y <= last - 1; y++) if (c.f(y) != null) ys.push(y);
    const cy = ys.filter((y) => c.f(y));
    return { label: c.label, from: ys[0], to: ys[ys.length - 1], years: ys.length, nCond: cy.length, kHit: cy.filter((y) => peaks.has(y)).length, baseHit: ys.filter((y) => peaks.has(y)).length };
  });

  const rs: { label: string; f: Cond }[] = [
    { label: "금리 내려감", f: (y) => (dirOf(y) === "none" ? null : dirOf(y) === "down") },
    { label: "금리 올라감", f: (y) => (dirOf(y) === "none" ? null : dirOf(y) === "up") },
  ];
  if (us) {
    rs.push({ label: "금리 거의 그대로", f: (y) => (dirOf(y) === "none" ? null : dirOf(y) === "flat") });
    rs.push({ label: "경기침체가 끝난 해", f: (y) => nberEnd.has(y) });
    rs.push({ label: "10년물 1%p 넘게 내림", f: (y) => { const v = d10((q) => usY10(d, q), y); return v == null ? null : v <= -1 + EPS; } });
  } else rs.push({ label: "국고채 10년 1%p 넘게 내림", f: (y) => { const v = d10((q) => krK10(d, q), y); return v == null ? null : v <= -1 + EPS; } });
  const isRise = (y: number) => ret(y) > RISE_THRESHOLD;
  const riseBase: BaseRow[] = rs.map((c) => {
    const ys: number[] = [];
    for (let y = first; y <= last; y++) if (c.f(y) != null) ys.push(y);
    const cy = ys.filter((y) => c.f(y));
    return { label: c.label, from: ys[0], to: ys[ys.length - 1], years: ys.length, nCond: cy.length, kHit: cy.filter(isRise).length, baseHit: ys.filter(isRise).length };
  });

  const rise: RiseYear[] = [];
  for (let y = first; y <= last; y++) {
    if (!isRise(y)) continue;
    const peak = view.eps.find((e) => e.py === y);
    rise.push({
      y, ret: ret(y) * 100, dir: dirOf(y), prevDir: y - 1 >= first ? dirOf(y - 1) : "none",
      rateFrom: decRate(d, R, y - 1), rateTo: decRate(d, R, y),
      y10: us ? usY10(d, y) : krK10(d, y), d10: us ? d10((q) => usY10(d, q), y) : d10((q) => krK10(d, q), y),
      recessionEndMonth: us ? nberEnd.get(y) ?? null : null,
      dropPeak: peak ? peak.name : null,
      events: yearIssues(view, y),
    });
  }

  // 결론 3줄(템플릿 + 데이터). 가장 많이 맞은 조건을 고르지 않고 금리 축으로 고정한다
  const A = preDropBase[0], down = riseBase[0], up = riseBase[1];
  const nDrops = preDrop.filter((r) => r.cells[0].state !== "none").length;
  const kDrops = preDrop.filter((r) => r.cells[0].state === "yes").length;
  const lines: [string, string, string] = [
    `크게 빠지기 전 12개월에 ${who} 금리가 올라간 때는 자료가 있는 ${nDrops}번 중 ${kDrops}번이었어요.`,
    `${A.from}~${last - 1}년에 ${who} 금리가 올라간 해는 ${A.nCond}년이었고, 그중 그해 말이 고점이 된 해는 ${A.kHit}년이었어요(전체 ${A.years}년 중 ${A.baseHit}년).`,
    `${who} 금리가 내려간 해 ${down.nCond}년 중 20% 넘게 오른 해는 ${down.kHit}년, 올라간 해 ${up.nCond}년 중에는 ${up.kHit}년이었어요(${down.from}~${last}년).`,
  ];
  return { key, who, condLabels: pre.map((c) => c.label), preDrop, preDropBase, riseBase, rise, lines };
}

export const PATTERN_TITLE = "하락 전 12개월과 크게 오른 해에 있었던 일";
export const patternNote = (last: number) => `같은 시기에 있었다는 기록이고, 무엇이 원인인지는 말하지 않아요. 결과를 알 수 있는 ${last - 1}년까지만 셌어요. 금리차는 월평균이 0보다 낮은 달이 1개 이상이면 셌어요(연준 H.15).`;
export const RISE_NOTE = "사건은 1차 원문으로 확인한 것만 적어요.";
export const RISE_SUB = "크게 빠진 때는 여러 해를 재고, 오른 해는 한 해만 재요";
export const INDEX_LABEL = (k: IndexKey) => INDEX_META[k].label;
