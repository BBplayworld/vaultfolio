// 투자 탭 `세 지수` 보기(5.141 #270·#271) 순수 계산. 데이터는 이미 만든 IndexView 3개만 쓴다(저장·전송 0).
// A1: 같은 해 세 지수의 오른 해/내린 해 5분류(배타, 합 = 공통 해 수). A5: 연대별 요약(기간 카드와 같은 periodResult 재사용).
import { INDEX_KEYS, INDEX_META, blsYear, classifyDelta, rateDelta, type IndexView } from "./calc";
import { spreadNegMonths } from "./pattern";
import { periodResult } from "./period";
import { MINUS, fmtPct } from "./text";
import type { IndexKey, MarketHistoryData } from "./types";

export type ThreeViews = Record<IndexKey, IndexView>;
const list = (v: ThreeViews) => INDEX_KEYS.map((k) => v[k]);

/** 공통 범위: 세 지수 모두 연간 등락이 있는 해 = 가장 늦은 `start+1` ~ 가장 이른 `last`. 겹치지 않으면 null */
export function commonRange(v: ThreeViews): { from: number; to: number; n: number } | null {
  const from = Math.max(...list(v).map((x) => x.start + 1)), to = Math.min(...list(v).map((x) => x.last));
  return from > to ? null : { from, to, n: to - from + 1 };
}

/** 그해 연간 등락(%, 소수 2자리 반올림 값) */
const retOf = (x: IndexView, y: number) => x.ret[y - x.start] as number;

export type A1Id = "allUp" | "allDown" | "usUp" | "kospiUp" | "usSplit";
/** 정본 행 순서·라벨(spec 4절) */
export const A1_ROWS: { id: A1Id; label: string }[] = [
  { id: "allUp", label: "셋 다 오른 해" },
  { id: "allDown", label: "셋 다 내린 해" },
  { id: "usUp", label: "미국 두 지수만 오른 해" },
  { id: "kospiUp", label: "코스피만 오른 해" },
  { id: "usSplit", label: "S&P 500과 나스닥100이 엇갈린 해" },
];

/** 오른 해 = ret > 0, 그 밖은 내린 해(0.0% 포함, 가이드 countRow 규칙과 같다) */
export function classifyYear(v: ThreeViews, y: number): A1Id {
  const s = retOf(v.spx, y) > 0, n = retOf(v.ndx, y) > 0, k = retOf(v.kospi, y) > 0;
  if (s !== n) return "usSplit";
  if (s && k) return "allUp";
  if (!s && !k) return "allDown";
  return s ? "usUp" : "kospiUp";
}

export interface A1Result {
  from: number;
  to: number;
  n: number;
  rows: { id: A1Id; label: string; years: number[] }[];
  /** 표시값이 0.0%인데 내린 해로 센 해(안내 문장용): 현재 2011 S&P 500 */
  zeroNotes: { year: number; label: string }[];
}
export function classifyYears(v: ThreeViews): A1Result | null {
  const r = commonRange(v);
  if (!r) return null;
  const rows = A1_ROWS.map((x) => ({ ...x, years: [] as number[] }));
  const zeroNotes: A1Result["zeroNotes"] = [];
  for (let y = r.from; y <= r.to; y++) {
    rows.find((x) => x.id === classifyYear(v, y))!.years.push(y);
    for (const k of INDEX_KEYS) {
      const x = v[k], rt = retOf(x, y);
      if (rt <= 0 && Math.abs(rt) < 0.05 && x.close[y - x.start] < x.close[y - x.start - 1]) zeroNotes.push({ year: y, label: INDEX_META[k].label });
    }
  }
  return { ...r, rows, zeroNotes };
}
/** 해가 속한 A1 행 번호(공통 범위 밖이면 -1) */
export function a1RowOf(r: A1Result | null, y: number | null): number {
  return r && y != null ? r.rows.findIndex((x) => x.years.includes(y)) : -1;
}

/** 칩 1줄: 그해 세 지수 값(격자와 같은 view.ret) */
export function sameYearRets(v: ThreeViews, y: number): { key: IndexKey; label: string; ret: number }[] {
  return INDEX_KEYS.map((k) => ({ key: k, label: INDEX_META[k].label, ret: retOf(v[k], y) }));
}

// ---- A5 연대별 요약 ----
export type DecadeMetric = "avg" | "cum" | "dd15";
export const DECADE_METRICS: { value: DecadeMetric; label: string; short: string }[] = [
  { value: "avg", label: "해마다 평균", short: "해마다 평균" },
  { value: "cum", label: "누적", short: "누적" },
  { value: "dd15", label: "−15% 이하 해", short: "−15% 이하" },
];
export interface DecadeCell {
  /** 해마다 평균(%, 반올림 전) */
  avg: number;
  /** 누적(%, 반올림 전) */
  cum: number;
  /** 연간 등락 −15% 이하인 해 수 */
  dd15: number;
  /** 자료가 연대 중간에서 시작하면 그 해(부분 연대), 아니면 null */
  from: number | null;
}
export interface DecadeRow {
  decade: number;
  /** 마지막 해가 연대 끝보다 이르면 그 해(진행 중 연대), 아니면 null */
  to: number | null;
  cells: (DecadeCell | null)[];
}
/** 행 = 첫 지수 자료 연대 ~ 마지막 해 연대. 열 = S&P 500·나스닥100·코스피. 누적·해마다 평균은 기간 카드와 같은 periodResult */
export function decadeRows(v: ThreeViews): DecadeRow[] {
  const vs = list(v), first = Math.floor(Math.min(...vs.map((x) => x.start + 1)) / 10) * 10, lastY = Math.max(...vs.map((x) => x.last));
  const rows: DecadeRow[] = [];
  for (let d = first; d <= lastY; d += 10) {
    const cells = vs.map((x): DecadeCell | null => {
      const a = Math.max(d, x.start + 1), b = Math.min(d + 9, x.last);
      if (a > b) return null;
      const r = periodResult(x, a - 1, b);
      let dd15 = 0;
      for (let y = a; y <= b; y++) if (retOf(x, y) <= -15) dd15++;
      return { avg: r.lumpCagr, cum: (r.lumpMult - 1) * 100, dd15, from: a > d ? a : null };
    });
    rows.push({ decade: d, to: lastY < d + 9 ? lastY : null, cells });
  }
  return rows;
}
/** 표 셀 글자 */
export function decadeText(c: DecadeCell | null, m: DecadeMetric): string {
  if (!c) return "—";
  if (m === "dd15") return `${c.dd15}해`;
  if (m === "avg") return fmtPct(c.avg, 1);
  const r = Math.round(c.cum);
  return (r > 0 ? "+" : r < 0 ? MINUS : "") + Math.abs(r).toLocaleString("en-US") + "%";
}
/** 셀 값 부호(색 판정용, −15% 열은 색 없음) */
export const decadeSign = (c: DecadeCell | null, m: DecadeMetric): number => (!c || m === "dd15" ? 0 : m === "avg" ? c.avg : c.cum);
export const decadeLabel = (d: number) => `${String(d).slice(2)}년대`;

// ---- 5.142 A2 지표로 나눠 본 오른 해(#275) ----
// 기준 4종의 분류는 `하락 전 12개월`(PatternSection)과 같은 함수(classifyDelta·rateDelta·blsYear·spreadNegMonths)를 쓴다.
// 오른 해 = 연간 등락 > 0(A1과 같음). 한 행은 배타이고 행 n의 합 = 그 지수에서 기준 자료와 연간 등락이 모두 있는 해 수.
export type A2Basis = "rate" | "cpi" | "unemp" | "spread";
export const A2_BASES: { value: A2Basis; label: string }[] = [
  { value: "rate", label: "금리" },
  { value: "cpi", label: "물가" },
  { value: "unemp", label: "실업률" },
  { value: "spread", label: "금리차" },
];
/** 기준별 행(순서 고정) */
export const A2_ROWS: Record<A2Basis, { id: string; label: string }[]> = {
  rate: [{ id: "up", label: "금리 올라간 해" }, { id: "down", label: "금리 내려간 해" }, { id: "flat", label: "금리 거의 그대로인 해" }],
  cpi: [{ id: "hi", label: "물가 4% 이상 오른 해" }, { id: "lo", label: "그 밖의 해" }],
  unemp: [{ id: "up", label: "실업률 오른 해" }, { id: "lo", label: "그 밖의 해" }],
  spread: [{ id: "neg", label: "금리차 마이너스인 달이 있던 해" }, { id: "none", label: "없던 해" }],
};
/** 물가 4% 이상 기준(전년 대비 %, 저장값 소수 1자리) */
export const A2_CPI_HI = 4.0;
/** 해 y가 속한 행 id(기준 자료가 없으면 null) */
export function a2Class(d: MarketHistoryData, basis: A2Basis, y: number): string | null {
  if (basis === "rate") { const k = classifyDelta(rateDelta(d, "us", y - 1, y)); return k === "none" ? null : k; }
  if (basis === "cpi") { const c = blsYear(d, y).cpi; return c == null ? null : c >= A2_CPI_HI ? "hi" : "lo"; }
  if (basis === "unemp") { const a = blsYear(d, y - 1).un, b = blsYear(d, y).un; return a == null || b == null ? null : b > a ? "up" : "lo"; }
  const m = spreadNegMonths(d, y, "a");
  return m == null ? null : m.length > 0 ? "neg" : "none";
}
/** 금리차(10년−2년) 월평균 자료가 처음 있는 달(YYYY-MM). 정의 줄의 `{1976년 6월}부터`가 데이터에서 나온다 */
export function spreadFirstMonth(d: MarketHistoryData): string {
  const i = d.spread.a.findIndex((v) => v != null), [y, m] = d.spread.from.split("-").map(Number), t = y * 12 + (m - 1) + Math.max(i, 0);
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, "0")}`;
}
export interface A2Cell { n: number; k: number }
export interface A2Result {
  rows: { id: string; label: string; cells: (A2Cell | null)[] }[];
  /** 지수별 센 해의 범위(없으면 null) */
  ranges: ({ from: number; to: number } | null)[];
  /** 지수별 센 해 수(행 n의 합) */
  totals: number[];
}
export function criterionRows(d: MarketHistoryData, v: ThreeViews, basis: A2Basis): A2Result {
  const defs = A2_ROWS[basis], vs = list(v);
  const counts = defs.map(() => vs.map(() => ({ n: 0, k: 0 })));
  const ranges: A2Result["ranges"] = vs.map(() => null);
  vs.forEach((x, i) => {
    for (let y = x.start + 1; y <= x.last; y++) {
      const r = x.ret[y - x.start];
      if (r == null) continue;
      const id = a2Class(d, basis, y);
      if (id == null) continue;
      const c = counts[defs.findIndex((q) => q.id === id)][i];
      c.n++; if (r > 0) c.k++;
      const g = ranges[i]; ranges[i] = g ? { from: g.from, to: y } : { from: y, to: y };
    }
  });
  return {
    rows: defs.map((q, j) => ({ ...q, cells: vs.map((_, i) => (counts[j][i].n ? counts[j][i] : null)) })),
    ranges,
    totals: vs.map((_, i) => defs.reduce((a, _q, j) => a + counts[j][i].n, 0)),
  };
}
