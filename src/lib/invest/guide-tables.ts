// 가이드 2·3편(rate-hike-years·recession-years) 고유 표 계산: 연간 등락의 개수(오른 해/전체 해)만 센다. 지수 수준값·% 비율은 쓰지 않는다(R4 ⑤).
// 인상 국면 = 연준 목표(범위면 상단)를 올린 첫 결정부터, 그 뒤 처음 내리기 전의 마지막 인상까지. 국면이 걸친 해 = 첫 인상 해~마지막 인상 해의 모든 해(한 해는 한 행에만 센다).
import { buildIndexView, INDEX_META, INDEX_KEYS, recessionMonthsIn, yearIssues } from "./calc";
import { averageHoldYears, periodResult } from "./period";
import { spreadNegMonths } from "./pattern";
import type { IndexKey } from "./types";
import type { MarketHistoryData } from "./types";

export interface HikePhase { from: string; to: string }
export interface UpCell { up: number; n: number }
export interface GuideRow { label: string; cells: (UpCell | null)[]; years: number[] }

/** 1990~ 인상 국면(월 YYYY-MM). 인상 = 전월보다 목표 상단이 오른 달, 국면은 인하가 나오면 끝난다 */
export function hikePhases(d: MarketHistoryData, fromYear = 1990): HikePhase[] {
  const s = d.rate.us, [yy, mm] = s.from.split("-").map(Number), base = yy * 12 + (mm - 1);
  const ph: HikePhase[] = [];
  let cur: HikePhase | null = null;
  const ym = (mi: number) => `${Math.floor(mi / 12)}-${String((mi % 12) + 1).padStart(2, "0")}`;
  for (let i = 1; i < s.v.length; i++) {
    const mi = base + i;
    if (Math.floor(mi / 12) < fromYear) continue;
    const dv = s.v[i] - s.v[i - 1];
    if (dv > 0) { if (!cur) { cur = { from: ym(mi), to: ym(mi) }; ph.push(cur); } else cur.to = ym(mi); }
    else if (dv < 0) cur = null;
  }
  return ph;
}

const countRow = (d: MarketHistoryData, label: string, years: number[]): GuideRow => ({
  label, years,
  cells: INDEX_KEYS.map((k) => {
    const v = buildIndexView(d, k);
    let up = 0, n = 0;
    for (const y of years) { if (y < v.start + 1 || y > v.last) continue; const r = v.ret[y - v.start]; if (r == null) continue; n++; if (r > 0) up++; }
    return n ? { up, n } : null;
  }),
});

/** 2편: 인상 국면이 걸친 해 / 그 밖의 해(1990~마지막 해). 두 행의 해 수 합 = 전체 해 수 */
export function hikeYearRows(d: MarketHistoryData): { rows: GuideRow[]; phases: HikePhase[]; span: [number, number] } {
  const phases = hikePhases(d), span: [number, number] = [1990, d.last];
  const inside = new Set<number>();
  phases.forEach((p) => { for (let y = +p.from.slice(0, 4); y <= +p.to.slice(0, 4); y++) inside.add(y); });
  const all = Array.from({ length: span[1] - span[0] + 1 }, (_, i) => span[0] + i);
  return { rows: [countRow(d, "인상 국면이 걸친 해", all.filter((y) => inside.has(y))), countRow(d, "그 밖의 해", all.filter((y) => !inside.has(y)))], phases, span };
}

/** 3편: 침체 달이 있던 해 / 없던 해(1961~마지막 해, 지수마다 자료 시작이 다름) */
export function recessionYearRows(d: MarketHistoryData): { rows: GuideRow[]; spxUpInRecession: number[] } {
  const all = Array.from({ length: d.last - 1961 + 1 }, (_, i) => 1961 + i);
  const rec = all.filter((y) => recessionMonthsIn(d.rec, y) > 0);
  const rows = [countRow(d, "침체 달이 있던 해", rec), countRow(d, "침체 달이 없던 해", all.filter((y) => !rec.includes(y)))];
  const v = buildIndexView(d, "spx");
  return { rows, spxUpInRecession: rec.filter((y) => (v.ret[y - v.start] ?? 0) > 0) };
}

/** G1 `recovery-years` 고유 표: 지수 순서 후 시간순, 크게 빠진 때 전부(13번). 연도 값은 해 수만, 지수 수준값 0 */
export interface RecoveryRow { index: IndexKey; label: string; name: string; py: number; ty: number; dd: number; toBottom: number; toPrev: number | null }
export function recoveryRows(d: MarketHistoryData): RecoveryRow[] {
  return INDEX_KEYS.flatMap((k) => buildIndexView(d, k).eps.map((e) => ({
    index: k, label: INDEX_META[k].label, name: e.name, py: e.py, ty: e.ty, dd: e.dd, toBottom: e.ty - e.py, toPrev: e.ry == null ? null : e.ry - e.py,
  })));
}

/** G3 `kospi-by-year` 고유 표: 연간 등락 −15% 이하인 해(코스피) + 같은 해 이슈. 규칙은 투자 탭 A5와 같은 `ret ≤ −15` */
export interface KospiYearRow { y: number; ret: number; issues: string[] }
export function kospiDropYears(d: MarketHistoryData): { rows: KospiYearRow[]; n: number; up: number; from: number; worst: KospiYearRow } {
  const v = buildIndexView(d, "kospi");
  const all = v.years.filter((y) => v.ret[y - v.start] != null);
  const rows = all.filter((y) => (v.ret[y - v.start] as number) <= -15).map((y) => ({ y, ret: v.ret[y - v.start] as number, issues: yearIssues(v, y).map((e) => e.name) }));
  return { rows, n: all.length, up: all.filter((y) => (v.ret[y - v.start] as number) > 0).length, from: all[0], worst: rows.reduce((b, r) => (r.ret < b.ret ? r : b), rows[0]) };
}

/** G2 `monthly-buying` 표(5.142 #279): S&P 500·나스닥100, 시작 = 마지막 해 −5k(k=1~5)년 말 → 마지막 해 말. 값은 기간 카드와 같은 periodResult(소수 2자리) */
export const MONTHLY_INDEXES: IndexKey[] = ["spx", "ndx"];
export const MONTHLY_STEPS = [5, 4, 3, 2, 1] as const;
export interface MonthlyBuyingRow { index: IndexKey; label: string; start: number; years: number; lump: string; dca: string }
export function monthlyBuyingRows(d: MarketHistoryData): { rows: MonthlyBuyingRow[]; starts: number[]; last: number; holds: string[] } {
  const rows: MonthlyBuyingRow[] = [];
  for (const k of MONTHLY_INDEXES) {
    const v = buildIndexView(d, k);
    for (const m of MONTHLY_STEPS) {
      const sy = v.last - 5 * m;
      if (sy < v.start) continue;
      const r = periodResult(v, sy, v.last);
      rows.push({ index: k, label: INDEX_META[k].label, start: sy, years: 5 * m, lump: r.lumpMult.toFixed(2), dca: r.dcaMult.toFixed(2) });
    }
  }
  const last = d.last;
  return { rows, starts: MONTHLY_STEPS.map((m) => last - 5 * m), last, holds: [5, 10, 15, 20, 25].map((n) => averageHoldYears(n).toFixed(1)) };
}

/** G4 `yield-spread-years`(5.143 #282): 금리차(10년−2년) 월평균이 0 미만인 달이 있던 해 / 없던 해 × S&P 500 그해·다음 해 오른 해 수.
 *  있고 없음은 투자 탭 A2 금리차 행·PatternSection과 같은 `spreadNegMonths(d,y,"a")`, 오른 해는 A1 규칙(`ret > 0`)이다. 다음 해 열은 마지막 해 행이 `—`(자료 없음)이라 센 해에서 빠진다 */
export interface SpreadYearRow { y: number; months: number[]; ret: number | null; next: number | null }
export interface SpreadCount { n: number; up: number; nNext: number; upNext: number }
export function spreadYearRows(d: MarketHistoryData): { from: number; last: number; has: SpreadCount; none: SpreadCount; years: SpreadYearRow[] } {
  const v = buildIndexView(d, "spx");
  const retOf = (y: number): number | null => (y > v.start && y <= v.last ? v.ret[y - v.start] ?? null : null);
  const first = Math.min(...Array.from({ length: d.last - 1900 + 1 }, (_, i) => 1900 + i).filter((y) => spreadNegMonths(d, y, "a") != null));
  const has: SpreadCount = { n: 0, up: 0, nNext: 0, upNext: 0 }, none: SpreadCount = { n: 0, up: 0, nNext: 0, upNext: 0 };
  const years: SpreadYearRow[] = [];
  for (let y = first; y <= d.last; y++) {
    const m = spreadNegMonths(d, y, "a");
    if (m == null) continue;
    const c = m.length ? has : none, r = retOf(y), nx = retOf(y + 1);
    if (r != null) { c.n++; if (r > 0) c.up++; }
    if (nx != null) { c.nNext++; if (nx > 0) c.upNext++; }
    if (m.length) years.push({ y, months: m, ret: r, next: nx });
  }
  return { from: first, last: d.last, has, none, years };
}
