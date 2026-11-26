// 홈 Hero 증감·원인 행 표시 글자(5.153 #304) — 한 카드에 합계와 내역이 같이 보이므로 표시 문자열 단계에서 합을 맞춘다.
// 정본 = Hero 값 T = sign(Δ)·floor(|Δ|/1만)(formatShortCurrency와 같은 버림). 원인 행은 만원 정수로 최대 나머지 배분해 합 = T.
// 엔진(fmtManwon·AttributionDisplayItem.text)은 AI·결산·home-today가 쓰므로 건드리지 않고, 홈 렌더링만 이 함수를 쓴다.
import { formatShortCurrency } from "@/lib/number-utils";

const MANWON = 10000;
const MINUS = "−"; // 음수 부호 − (Hero·행 공통)

/** 부호 + formatShortCurrency(|v|) — 양수 `+`, 음수 `−`(U+2212) */
export function formatSignedShort(v: number): string {
  return `${v >= 0 ? "+" : MINUS}${formatShortCurrency(Math.abs(v))}`;
}

/** Hero 증감 글자 — `▲ +2만원` / `▼ −2만원` */
export function formatHeroDelta(delta: number): string {
  return `${delta >= 0 ? "▲ " : "▼ "}${formatSignedShort(delta)}`;
}

/** Hero 퍼센트 글자(#309) — 부호는 반올림한 표시값 기준: `+1.2%` / `−1.2%`(U+2212) / `0.0%`(부호 없음, `−0.0%` 금지) */
export function formatHeroPct(pct: number): string {
  const t = Math.abs(pct).toFixed(1);
  if (Number(t) === 0) return `${t}%`;
  return `${pct < 0 ? "\u2212" : "+"}${t}%`;
}

/** Hero 정본 만원 정수(0 방향 버림) */
export function heroManwon(delta: number): number {
  return Math.sign(delta) * Math.floor(Math.abs(delta) / MANWON);
}

/**
 * 원 단위 금액들을 만원 정수로 최대 나머지 배분해 합 = total(만원).
 * 제약: 0만원 금지·원래 부호 반전 금지. ±1 조정은 나머지 순서, 제약에 걸리면 같은 방향 조정이 가능한 행 중 절댓값 최대 행으로 넘긴다.
 */
export function allocateManwon(amounts: number[], total: number): number[] {
  const n = amounts.length;
  if (n === 0) return [];
  const x = amounts.map((a) => a / MANWON);
  // 바닥값에서 시작. 양수인데 0이 되는 행(1만 미만)은 1로 올려 0만원을 막는다
  const v = x.map((xi, i) => {
    const f = Math.floor(xi);
    return f === 0 && amounts[i] > 0 ? 1 : f;
  });
  const frac = x.map((xi) => xi - Math.floor(xi));
  let d = total - v.reduce((s, t) => s + t, 0);
  if (d === 0) return v;
  const step = d > 0 ? 1 : -1;
  // +1은 나머지 큰 순, −1은 나머지 작은 순. 같으면 절댓값 큰 행, 그다음 원래 순서
  const order = amounts.map((_, i) => i).sort((a, b) =>
    (step > 0 ? frac[b] - frac[a] : frac[a] - frac[b]) || Math.abs(amounts[b]) - Math.abs(amounts[a]) || a - b,
  );
  const ok = (i: number) => {
    const next = v[i] + step;
    return next !== 0 && (amounts[i] === 0 || Math.sign(next) === Math.sign(amounts[i]));
  };
  const byAbs = amounts.map((_, i) => i).sort((a, b) => Math.abs(amounts[b]) - Math.abs(amounts[a]) || a - b);
  for (let k = 0; d !== 0; k++) {
    const want = order[k % n];
    const i = ok(want) ? want : byAbs.find(ok) ?? byAbs[0]; // 마지막 대안은 이론상 도달 불가(엔진이 합 ≈ Δ 보장)
    v[i] += step;
    d -= step;
  }
  return v;
}

/** 홈 원인 행 글자 — 행 순서 그대로, 합 = Hero(만원). 원인 1개면 Hero와 같은 글자 */
export function heroCauseTexts(amounts: number[], delta: number): string[] {
  return allocateManwon(amounts, heroManwon(delta)).map((m) => formatSignedShort(m * MANWON));
}
