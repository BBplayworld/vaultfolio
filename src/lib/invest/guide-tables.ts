// 가이드 2·3편(rate-hike-years·recession-years) 고유 표 계산: 연간 등락의 개수(오른 해/전체 해)만 센다. 지수 수준값·% 비율은 쓰지 않는다(R4 ⑤).
// 인상 국면 = 연준 목표(범위면 상단)를 올린 첫 결정부터, 그 뒤 처음 내리기 전의 마지막 인상까지. 국면이 걸친 해 = 첫 인상 해~마지막 인상 해의 모든 해(한 해는 한 행에만 센다).
import { buildIndexView, INDEX_KEYS, recessionMonthsIn } from "./calc";
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
