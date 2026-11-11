// 도넛·비중 바 표시 폭(각도)의 최소 비중 보장 — 공용 유틸(#148, 4.77).
// 원칙: 표시 폭(각도)만 보장하고 숫자(%·금액·라벨)는 호출부가 실제 값을 그대로 쓴다. 0 이하 항목은 0(그리지 않음).
// 항목(양수 기준) 5개 이하일 때만 적용 — 6개 이상은 순수 비례(현행 유지). 라벨 표시 기준(DONUT_LABEL_MIN_PCT)은 실제 % 기준을 유지한다.

/** 최소 비중 보장 대상 최대 항목 수 — 이보다 많으면 비례 그대로 */
export const MIN_SHARE_MAX_ITEMS = 5;
/** 막대 기본 최소 폭(%) — 구성 막대(4.70)와 같은 값 */
export const MIN_BAR_PCT = 7;
/** 도넛 기본 최소 비중(%) = 18° */
export const MIN_DONUT_PCT = 5;

/** 표시용 폭(%) — 0보다 큰 항목은 최소 minPct를 보장하고 나머지를 비례 축소(합 100). 0 이하는 0. 숫자(%) 표기는 실제 값 그대로 쓴다 */
export function displayBarWidths(ratios: number[], minPct = 7): number[] {
  const pos = ratios.map((r) => (r > 0 ? r : 0));
  const idx = pos.map((r, i) => (r > 0 ? i : -1)).filter((i) => i >= 0);
  const out = pos.map(() => 0);
  if (idx.length === 0) return out;
  if (idx.length * minPct >= 100) { idx.forEach((i) => { out[i] = 100 / idx.length; }); return out; }
  const pinned = new Set<number>();
  for (let guard = 0; guard <= idx.length; guard++) {
    const free = idx.filter((i) => !pinned.has(i));
    const room = 100 - pinned.size * minPct;
    const sum = free.reduce((s, i) => s + pos[i], 0);
    const next = free.filter((i) => (pos[i] / sum) * room < minPct);
    if (next.length === 0) { free.forEach((i) => { out[i] = (pos[i] / sum) * room; }); break; }
    next.forEach((i) => pinned.add(i));
  }
  pinned.forEach((i) => { out[i] = minPct; });
  return out;
}

/**
 * 표시용 폭(%) 배열. 양수 항목이 maxItems(5) 이하면 최소 minPct를 보장하고(합 100), 그보다 많으면 순수 비례.
 * total을 주면(항목 합이 전체보다 작은 막대) 합계에 해당하는 비율만큼만 채운다 — 비어 있던 오른쪽 여백을 유지한다.
 */
export function displayShareWidths(values: number[], opts: { minPct?: number; maxItems?: number; total?: number } = {}): number[] {
  const { minPct = MIN_BAR_PCT, maxItems = MIN_SHARE_MAX_ITEMS, total } = opts;
  const pos = values.map((v) => (v > 0 ? v : 0));
  const sum = pos.reduce((a, b) => a + b, 0);
  if (sum <= 0) return pos.map(() => 0);
  const count = pos.filter((v) => v > 0).length;
  const base = count <= maxItems ? displayBarWidths(pos, minPct) : pos.map((v) => (v / sum) * 100);
  const fill = total && total > sum ? sum / total : 1;
  return base.map((w) => w * fill);
}
