// 투자 탭(#263) 순수 계산. 데이터는 인자로 받는다(이 파일은 데이터 JSON을 import하지 않는다 → 첫 화면 번들 0).
// 정의 한 벌(spec 4절): 머리·읽기 줄·목록 행·표·공개 가이드가 모두 이 파일의 값을 쓴다.
import type { EventIndex, IndexKey, MarketEvent, MarketHistoryData, MonthSeries, RateKey, Recession, UsYearRow, YearEvent } from "./types";

/** 크게 빠진 때 문턱(연말값 기준 15%) */
export const DROP_THRESHOLD = 0.15;
/** 금리 방향 문턱(%p): |Δ| < 0.25 = 거의 그대로 */
export const RATE_FLAT_PP = 0.25;

export type RateDir = "up" | "down" | "flat" | "none";

export const INDEX_META: Record<IndexKey, { label: string; rate: RateKey; currency: "달러" | "포인트"; ev: EventIndex }> = {
  spx: { label: "S&P 500", rate: "us", currency: "달러", ev: "S&P" },
  ndx: { label: "나스닥100", rate: "us", currency: "달러", ev: "나스닥" },
  kospi: { label: "코스피", rate: "kr", currency: "포인트", ev: "코스피" },
};
export const INDEX_KEYS: IndexKey[] = ["spx", "ndx", "kospi"];

/** 하락 구간 이름(spec 5절 하단). 키 = 고점 연도. 같은 이름의 사건이 있으면 `same`에 사건 id */
const EPISODE_NAMES: Record<IndexKey, Record<number, [string, string]>> = {
  spx: { 1972: ["1973~74년 하락", ""], 1999: ["닷컴 버블 붕괴", "E13"], 2007: ["글로벌 금융위기", "E20"], 2021: ["2022년 하락", ""] },
  ndx: { 1999: ["닷컴 버블 붕괴", "E13"], 2007: ["글로벌 금융위기", "E20"], 2021: ["2022년 하락", ""] },
  kospi: { 1989: ["1990~91년 하락", ""], 1994: ["외환위기", "E11"], 1999: ["닷컴 버블 붕괴", "E13"], 2007: ["글로벌 금융위기", "E20"], 2017: ["2018년 하락", ""], 2021: ["2022년 하락", ""] },
};

export const monthIndex = (s: string) => +s.slice(0, 4) * 12 + (+s.slice(5) - 1);
/** 그 달 1일의 소수 연도 위치 */
export const monthPos = (s: string) => +s.slice(0, 4) + (+s.slice(5) - 1) / 12;

export function seriesAt(s: MonthSeries, ym: string): number | null {
  const i = monthIndex(ym) - monthIndex(s.from);
  return i >= 0 && i < s.v.length ? s.v[i] : null;
}
export const rateAt = (d: MarketHistoryData, r: RateKey, ym: string) => seriesAt(d.rate[r], ym);
export const decRate = (d: MarketHistoryData, r: RateKey, y: number) => rateAt(d, r, `${y}-12`);

/** 전년 12월 말 → 그해 12월 말 순변화(%p). 한쪽이라도 없으면 null */
export function rateDelta(d: MarketHistoryData, r: RateKey, from: number, to: number): number | null {
  const a = decRate(d, r, from), b = decRate(d, r, to);
  return a == null || b == null ? null : Math.round((b - a) * 100) / 100;
}
export function classifyDelta(delta: number | null): RateDir {
  if (delta == null) return "none";
  if (Math.abs(delta) < RATE_FLAT_PP - 1e-9) return "flat";
  return delta > 0 ? "up" : "down";
}

export interface ZigzagEpisode {
  /** 고점 인덱스 */
  p: number;
  /** 바닥 인덱스 */
  t: number;
  /** 전고점 이상을 되찾은 첫 인덱스(없으면 null = 진행 중) */
  r: number | null;
}
/** 연말값 지그재그(4-3): 고점에서 문턱 넘게 내리면 하락 시작, 바닥에서 문턱 넘게 오르면 하락 끝 */
export function zigzag(v: number[], threshold = DROP_THRESHOLD): ZigzagEpisode[] {
  const eps: ZigzagEpisode[] = [];
  let hi = 0, lo = 0, inDrop = false;
  for (let i = 1; i < v.length; i++) {
    if (!inDrop) {
      if (v[i] >= v[hi]) hi = i;
      else if (v[i] <= v[hi] * (1 - threshold)) { inDrop = true; lo = i; }
    } else if (v[i] < v[lo]) lo = i;
    else if (v[i] >= v[lo] * (1 + threshold)) { eps.push({ p: hi, t: lo, r: null }); inDrop = false; hi = i; }
  }
  if (inDrop) eps.push({ p: hi, t: lo, r: null });
  for (const e of eps) {
    for (let i = e.t + 1; i < v.length; i++) if (v[i] >= v[e.p]) { e.r = i; break; }
  }
  return eps;
}

/** 4-7: NBER 고점 다음 달 1일 ~ 저점 월 말일을 소수 연도 [시작, 끝)로 */
export const recessionSpan = (r: Recession): [number, number] => [monthPos(r.s), monthPos(r.e) + 1 / 12];
/** 그해 안에 든 침체 월 수 */
export function recessionMonthsIn(recs: Recession[], year: number): number {
  let n = 0;
  for (const x of recs) for (let m = monthIndex(x.s); m <= monthIndex(x.e); m++) if (Math.floor(m / 12) === year) n++;
  return n;
}
const monthLabel = (s: string) => `${+s.slice(0, 4)}년 ${+s.slice(5)}월`;
/** `2008년 1월~2009년 6월` / 같은 해면 `2001년 4월~11월` */
export const recessionLabel = (r: Recession) => (r.s.slice(0, 4) === r.e.slice(0, 4) ? `${monthLabel(r.s)}~${+r.e.slice(5)}월` : `${monthLabel(r.s)}~${monthLabel(r.e)}`);

export interface Episode {
  py: number;
  ty: number;
  /** 전고점 이상을 되찾은 연도, 진행 중이면 null */
  ry: number | null;
  pc: number;
  tc: number;
  /** 낙폭 %(소수 2자리, 음수) */
  dd: number;
  name: string;
  /** 하락 이름과 같은 사건 id(없으면 "") */
  same: string;
  ongoing: boolean;
  /** 고점·바닥 연말 기준금리, 방향 */
  rf: number | null;
  rt: number | null;
  rd: number | null;
  dir: RateDir;
  /** 하락 창(고점 다음 해 1월 ~ 바닥 해 12월) 안 사건 id */
  evl: string[];
  /** 겹치는 NBER 구간 문구(미국 지수만, 코스피는 null) */
  recs: string[] | null;
}
export interface EventPoint extends MarketEvent {
  /** 소수 연도 위치(그 달의 가운데) */
  t: number;
  y: number;
}
export interface YearRow {
  y: number;
  close: number;
  ret: number | null;
  rate: number | null;
  dir: RateDir;
  /** 그해 경제 이슈(yearIssues, 시간순, 한국 행은 코스피만) */
  issues: YearEvent[];
  /** 미국 지수 전용 */
  y10: number | null;
  s2: number | null;
  s3: number | null;
  rec: number | null;
  /** 코스피 전용 */
  k3: number | null;
  k10: number | null;
}
export interface RateBase {
  n: number;
  up: number;
  down: number;
  flat: number;
}
export interface IndexView {
  key: IndexKey;
  label: string;
  currency: "달러" | "포인트";
  rate: RateKey;
  start: number;
  last: number;
  years: number[];
  close: number[];
  ret: (number | null)[];
  yrDir: Record<number, { d: number | null; k: RateDir }>;
  eps: Episode[];
  base: RateBase;
  ev: EventPoint[];
  /** 해별 경제 이슈(1990~) — 읽기 줄·격자·표·오른 해 펼침 공통 */
  issues: Record<number, YearEvent[]>;
  /** 데이터 끝 이후 진행 중인 해의 이슈(2026) */
  wip: YearEvent | null;
  tbl: YearRow[];
}

/** 지수 하나의 화면 값 전부. asof(연도)를 주면 그 해 말에서 데이터를 자른 모의(진행 중 하락 검증용) */
export function buildIndexView(d: MarketHistoryData, key: IndexKey, asof?: number): IndexView {
  const M = INDEX_META[key], S = d.idx[key], last = asof ?? d.last, r = M.rate;
  const cut = last - S.start + 1;
  const close = S.close.slice(0, cut), years = close.map((_, i) => S.start + i);
  const ret = close.map((x, i) => (i === 0 ? null : Math.round((x / close[i - 1] - 1) * 10000) / 100));
  const yrDir: IndexView["yrDir"] = {};
  for (const y of years) { const delta = rateDelta(d, r, y - 1, y); yrDir[y] = { d: delta, k: classifyDelta(delta) }; }
  const base: RateBase = { n: 0, up: 0, down: 0, flat: 0 };
  // 기준선은 머리(`{첫 해+1}년 이후`)와 같은 해들만 센다 — 지수의 첫 연말값 해는 연간 등락이 없어 제외(나스닥 1985 제외, #263 N-2)
  for (const y of years.slice(1)) { const k = yrDir[y].k; if (k !== "none") { base.n++; base[k]++; } }
  const ev: EventPoint[] = d.events
    .filter((e) => e.idx.includes(M.ev))
    .map((e) => ({ ...e, t: +e.pm.slice(0, 4) + (+e.pm.slice(5) - 0.5) / 12, y: +e.pm.slice(0, 4) }))
    .filter((e) => e.y <= last);
  // 해별 경제 이슈: 한국 행은 코스피에서만, 같은 해 안 시간순(월→id)
  const issues: Record<number, YearEvent[]> = {};
  for (const e of d.eventsYear) {
    if (e.wip || e.y > last || (e.region === "한국" && key !== "kospi")) continue;
    (issues[e.y] ||= []).push(e);
  }
  for (const y of Object.keys(issues)) issues[+y].sort((a, b) => a.m - b.m || a.id.localeCompare(b.id));
  const eps: Episode[] = zigzag(close).map((z) => {
    const py = years[z.p], ty = years[z.t], nm = EPISODE_NAMES[key][py];
    const delta = rateDelta(d, r, py, ty);
    const t0 = py + 1, t1 = ty + 1;
    return {
      py, ty, ry: z.r == null ? null : years[z.r], pc: close[z.p], tc: close[z.t],
      dd: +((close[z.t] / close[z.p] - 1) * 100).toFixed(2),
      name: nm ? nm[0] : `${ty}년 하락`, same: nm ? nm[1] : "", ongoing: z.r == null,
      rf: decRate(d, r, py), rt: decRate(d, r, ty), rd: delta, dir: classifyDelta(delta),
      evl: ev.filter((q) => q.t >= t0 && q.t < t1).map((q) => q.id),
      recs: r === "us" ? d.rec.filter((x) => monthIndex(x.e) >= t0 * 12 && monthIndex(x.s) < t1 * 12).map(recessionLabel) : null,
    };
  });
  const usRow = (y: number): UsYearRow | undefined => d.usYear.find((q) => q.y === y);
  const tbl: YearRow[] = years.slice().reverse().map((y) => {
    const i = y - S.start, u = usRow(y), kr = d.krYear.find((q) => q.y === y);
    return {
      y, close: close[i], ret: ret[i], rate: decRate(d, r, y), dir: yrDir[y].k, issues: issues[y] ?? [],
      y10: r === "us" ? u?.y10 ?? null : null, s2: r === "us" ? u?.s2 ?? null : null, s3: r === "us" ? u?.s3 ?? null : null,
      rec: r === "us" ? recessionMonthsIn(d.rec, y) : null,
      k3: r === "kr" ? kr?.k3 ?? null : null, k10: r === "kr" ? kr?.k10 ?? null : null,
    };
  });
  return { key, label: M.label, currency: M.currency, rate: r, start: S.start, last, years, close, ret, yrDir, eps, base, ev, issues, wip: d.eventsYear.find((e) => e.wip) ?? null, tbl };
}

/** 머리 2줄째 집계(하락 구간의 금리 방향 건수) */
export function episodeDirCounts(eps: Episode[]): Record<RateDir, number> {
  const c: Record<RateDir, number> = { up: 0, down: 0, flat: 0, none: 0 };
  eps.forEach((e) => c[e.dir]++);
  return c;
}

/** 하락 구간 안(고점 다음 해 ~ 바닥 해)의 연도면 그 하락의 인덱스, 아니면 -1 */
/** 그해 경제 이슈 단일 출처: 읽기 줄·격자·연도별 표·오른 해 펼침이 모두 이 함수를 쓴다 */
export const yearIssues = (v: IndexView, y: number): YearEvent[] => v.issues[y] ?? [];

export const episodeIndexOfYear = (eps: Episode[], y: number) => eps.findIndex((e) => y > e.py && y <= e.ty);

/** 월 금리 계단 최대값 기준 오른쪽 축 상한(겹쳐 보기 켜기 전·후 같은 스케일) */
export function rateAxisMax(d: MarketHistoryData, r: RateKey): number {
  const mx = Math.max(...d.rate[r].v, ...d.ovl[r].v);
  return Math.ceil(mx / 2) * 2;
}

/** 3-3 기본 지수: 국내 주식 평가액 > 해외면 코스피, 아니면 S&P 500. 값은 기기 안에서만 쓰고 저장·전송하지 않는다 */
export function pickDefaultIndex(holding: { domestic: number; overseas: number } | null): IndexKey {
  if (!holding) return "spx";
  return holding.domestic > holding.overseas ? "kospi" : "spx";
}

