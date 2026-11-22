// 투자 탭 차트 기하(순수 함수). SVG는 자체로 그리고(recharts 미사용), 좌표 계산만 여기서 한다.

/** 로그 축 눈금: 1·2·5 단위 사다리가 maxN을 넘으면 1·3 단위로 */
export function logTicks(min: number, max: number, maxN: number): { lo: number; hi: number; tk: number[] } {
  const ladders = [[1, 2, 5], [1, 3]];
  let out = { lo: min, hi: max, tk: [min, max] };
  for (const lad of ladders) {
    const t: number[] = [];
    for (let e = -1; e <= 7; e++) lad.forEach((m) => t.push(m * Math.pow(10, e)));
    const lo = Math.max(...t.filter((x) => x <= min)), hi = Math.min(...t.filter((x) => x >= max));
    const tk = t.filter((x) => x >= lo && x <= hi);
    out = { lo, hi, tk };
    if (tk.length <= maxN) return out;
  }
  return out;
}

export interface DotInput {
  id: string;
  x: number;
  /** 크게 빠진 때와 연결된 사건 */
  linked: boolean;
}
export interface MergedDot {
  x: number;
  /** 연결된 사건이 하나라도 있으면 큰 점 */
  linked: boolean;
  ids: string[];
}
/** C1: x 순서로 놓고 바로 앞 표시 점과의 간격이 minGap 미만이면 하나로 합친다. 표시 점 사이 간격은 항상 ≥ minGap */
export function mergeEventDots(dots: DotInput[], minGap = 6): MergedDot[] {
  const out: MergedDot[] = [];
  for (const d of [...dots].sort((a, b) => a.x - b.x)) {
    const prev = out[out.length - 1];
    if (prev && d.x - prev.x < minGap) {
      prev.ids.push(d.id);
      prev.linked = prev.linked || d.linked;
    } else out.push({ x: d.x, linked: d.linked, ids: [d.id] });
  }
  return out;
}

/** 침체 띠 최소 폭(월 폭이 이보다 좁으면 이 폭으로 그림) */
export const MIN_BAND_WIDTH = 2.6;
export function bandRect(x0: number, x1: number): { x: number; w: number } {
  if (x1 - x0 >= MIN_BAND_WIDTH) return { x: x0, w: x1 - x0 };
  const c = (x0 + x1) / 2;
  return { x: c - MIN_BAND_WIDTH / 2, w: MIN_BAND_WIDTH };
}

/** 월 계단 경로: 값이 없는 달은 건너뛴다. closeTo가 있으면 그 y로 닫는 면의 시작점을 만든다 */
export function stepPath(
  rateAt: (year: number, month: number) => number | null,
  X: (t: number) => number,
  Y: (v: number) => number,
  t0: number,
  t1: number,
  closeTo: number | null,
): string {
  let q = "", started = false, prevV: number | null = null;
  for (let mi = Math.floor(t0 * 12 + 1e-6); mi < Math.ceil(t1 * 12 - 1e-6); mi++) {
    const Yr = Math.floor(mi / 12), m = (mi % 12) + 1, v = rateAt(Yr, m);
    if (v == null) continue;
    const xa = X(Math.max(t0, mi / 12)), xb = X(Math.min(t1, (mi + 1) / 12));
    if (!started) {
      q += `M${xa.toFixed(1)},${closeTo != null ? closeTo : Y(v).toFixed(1)}${closeTo != null ? `L${xa.toFixed(1)},${Y(v).toFixed(1)}` : ""}`;
      started = true;
    } else if (v !== prevV) q += `V${Y(v).toFixed(1)}`;
    q += `H${xb.toFixed(1)}`;
    prevV = v;
  }
  return q;
}
