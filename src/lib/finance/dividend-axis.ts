/**
 * finance/dividend-axis.ts — 배당 차트 Y축 눈금·막대 값 라벨 판정(순수 함수, #4.85).
 * 눈금은 1·2·5×10^n 둥근 간격이라 격자 간격과 표기가 항상 일치하고, 라벨은 겹치면 큰 값부터 남긴다.
 */

/** 0부터 max까지 약 targetCount칸의 둥근 눈금(마지막 눈금 ≥ max). max ≤ 0이면 [0] */
export function niceAxisTicks(max: number, targetCount = 4): number[] {
  if (!(max > 0)) return [0];
  const raw = max / targetCount;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map((m) => m * pow).find((s) => s >= raw) ?? 10 * pow;
  const ticks: number[] = [];
  for (let v = 0; v < max + step; v += step) {
    ticks.push(Math.round(v));
    if (v >= max) break;
  }
  return ticks;
}

/** 눈금 표기 — 만원 이상은 소수 1자리까지 정확히(1.5만원), 그 미만은 콤마 원. 눈금이 둥글어 반올림 오차가 없다 */
export function formatAxisWon(value: number): string {
  if (value === 0) return "0원";
  const abs = Math.abs(value);
  const fmt = (n: number) => String(Math.round(n * 10) / 10).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  if (abs >= 100000000) return `${fmt(abs / 100000000)}억원`;
  if (abs >= 10000) return `${fmt(abs / 10000)}만원`;
  return `${Math.round(abs).toLocaleString("en-US")}원`;
}

/**
 * 막대 위 값 라벨 중 겹치지 않는 것만 남긴다(큰 값 우선). slotWidth: 막대 한 칸 폭, labels: 각 칸의 표기 문자열("" 은 없음).
 * 가로 겹침만 보는 보수적 판정 — 이웃 라벨이 다른 높이여도 읽기 쉬운 쪽을 택한다.
 */
export function pickVisibleLabels(values: number[], labels: string[], slotWidth: number, charWidth = 7, gap = 4): Set<number> {
  const order = values.map((v, i) => i).filter((i) => labels[i]).sort((a, b) => values[b] - values[a] || a - b);
  const kept: Array<{ i: number; w: number }> = [];
  for (const i of order) {
    const w = labels[i].length * charWidth;
    const overlap = kept.some((k) => Math.abs(k.i - i) * slotWidth < (k.w + w) / 2 + gap);
    if (!overlap) kept.push({ i, w });
  }
  return new Set(kept.map((k) => k.i));
}
