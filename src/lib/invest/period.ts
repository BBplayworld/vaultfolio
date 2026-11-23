// R4.1: 기간 수익률 카드의 계산(#263). 같은 기간·같은 총액(=1)을 ① 시작 연말에 한 번에 ② 매달 나눠 넣었을 때를 비교한다.
// 매달 넣기(대표 승인 근사): 시작 연말 다음 달부터 끝 연말까지 n년×12번 같은 금액(총액/12n), 그해 12번 모두
// (직전 연말 값 + 그해 연말 값) ÷ 2 가격으로 산 것으로 어림한다. 월 값을 만들지 않는다(보간 코드 0).
// 모든 값은 반올림 전으로 계산하고 표시 때 한 번만 반올림한다.
import type { IndexView } from "./calc";

export interface PeriodSeries {
  /** 연말마다 한 번에 넣기 평가 배수(시작 1) */
  lump: number[];
  /** 연말마다 매달 넣기 평가 배수(시작 0, 총액 = 1 대비) */
  dca: number[];
  /** 연말마다 넣은 돈(0 → 1) */
  principal: number[];
  n: number;
}

/** series: i = 0..n (시작 연말 … 끝 연말) */
export function periodSeries(v: IndexView, sy: number, ey: number): PeriodSeries {
  const c = v.close, i0 = sy - v.start, n = ey - sy;
  const lump: number[] = [], dca: number[] = [], principal: number[] = [];
  let units = 0;
  for (let t = 0; t <= n; t++) {
    lump.push(c[i0 + t] / c[i0]);
    if (t > 0) units += 1 / n / ((c[i0 + t - 1] + c[i0 + t]) / 2);
    dca.push(units * c[i0 + t]);
    principal.push(t / n);
  }
  return { lump, dca, principal, n };
}

/** 매달 넣은 돈의 돈 가중 연평균(%): 월 말 납입·월 복리 연환산, 이분법. 배수 V = 끝 평가 ÷ 총액 */
export function moneyWeightedAnnual(V: number, n: number): number {
  let a = -0.99, b = 10;
  for (let k = 0; k < 80; k++) {
    const m = (a + b) / 2;
    let s = 0;
    for (let j = 1; j <= 12 * n; j++) s += Math.pow(1 + m, n - j / 12) / (12 * n);
    if (s < V) a = m; else b = m;
  }
  return ((a + b) / 2) * 100;
}

/** 넣은 돈이 끝 연말까지 들어가 있던 기간의 평균(년): 납입 j번째(월 말)가 (12n−j)개월 → 평균 (12n−1)/2개월 ÷ 12 */
export const averageHoldYears = (n: number): number => (12 * n - 1) / 24;

/** 한 번에 넣기 배수 → 해마다 평균(%) — 기간 카드·A6가 같은 식 */
export const lumpCagrOf = (mult: number, n: number): number => (Math.pow(mult, 1 / n) - 1) * 100;

export interface PeriodResult {
  sy: number;
  ey: number;
  n: number;
  lumpMult: number;
  lumpCagr: number;
  dcaMult: number;
  dcaIrr: number;
  holdYears: number;
  series: PeriodSeries;
}
export function periodResult(v: IndexView, sy: number, ey: number): PeriodResult {
  const s = periodSeries(v, sy, ey), n = s.n;
  const lumpMult = s.lump[n], dcaMult = s.dca[n];
  return { sy, ey, n, lumpMult, lumpCagr: lumpCagrOf(lumpMult, n), dcaMult, dcaIrr: moneyWeightedAnnual(dcaMult, n), holdYears: averageHoldYears(n), series: s };
}

/** A6(5.142): 기간 길이 N년으로 모든 시작 해(지수 시작 해 ~ 마지막 해−N)의 한 번에 넣기 해마다 평균 범위와 손실로 끝난 시작 해 수.
 *  periodSeries의 한 번에 넣기 배수(= periodResult와 같은 값)만 쓴다. 시작 해가 2개 미만이면 null */
export function rollingRange(v: IndexView, N: number): { n: number; min: number; max: number; loss: number } | null {
  if (N < 1) return null;
  const n = v.last - N - v.start + 1;
  if (n < 2) return null;
  let min = Infinity, max = -Infinity, loss = 0;
  for (let s = v.start; s <= v.last - N; s++) {
    const m = periodSeries(v, s, s + N).lump[N], c = lumpCagrOf(m, N);
    if (c < min) min = c;
    if (c > max) max = c;
    if (m < 1) loss++;
  }
  return { n, min, max, loss };
}

/** 기간 알약: 5·10·20년·전체(지수 데이터가 모자라면 뺀다). 끝 = 마지막 연도 */
export function periodPresets(v: IndexView): { key: string; label: string; years: number }[] {
  const all = v.last - v.start;
  return ([[5, "5년"], [10, "10년"], [20, "20년"], [all, "전체"]] as const)
    .filter(([y], i, a) => y <= all && (i === a.length - 1 ? true : y < all))
    .map(([years, label]) => ({ key: label, label, years }));
}
/** 시작·끝 보정: 끝은 시작+1 이상·마지막 해 이하, 시작이 끝 이상이면 끝을 올린다 */
export function fixPeriod(v: IndexView, sy: number, ey: number): { sy: number; ey: number } {
  const s = Math.max(v.start, Math.min(sy, v.last - 1));
  return { sy: s, ey: Math.max(s + 1, Math.min(ey, v.last)) };
}
export const defaultPeriod = (v: IndexView) => fixPeriod(v, v.last - 10, v.last);

// ---- 표시 문장(R4.1 정본, 해요체·과거형·가정형) ----
const sgn = (x: number, d: number) => (x > 0 ? "+" : x < 0 ? "−" : "") + Math.abs(x).toFixed(d) + "%";
export const lumpSentence = (v: IndexView, r: PeriodResult) => `${r.sy}년 말에 총액을 한 번에 넣었다면, ${r.ey}년 말 ${v.label} 지수 기준 넣은 돈의`;
export const dcaSentence = (v: IndexView, r: PeriodResult) => `같은 총액을 ${r.sy}년 말부터 ${r.n}년 동안 매달 나눠 넣었다면(${12 * r.n}번), ${r.ey}년 말 ${v.label} 지수 기준 넣은 돈의`;
export function periodText(r: PeriodResult) {
  return {
    lumpMult: r.lumpMult.toFixed(2) + "배", lumpTotal: sgn((r.lumpMult - 1) * 100, 0), lumpCagr: sgn(r.lumpCagr, 2), lumpVerb: r.lumpCagr < 0 ? "내린" : "오른",
    dcaMult: r.dcaMult.toFixed(2) + "배", dcaTotal: sgn((r.dcaMult - 1) * 100, 0), hold: r.holdYears.toFixed(1),
    irr: sgn(r.dcaIrr, 2),
  };
}
export const HOLD_LINE = (hold: string) => `넣은 돈이 들어가 있던 기간은 평균 ${hold}년이에요`;
export const APPROX_LINE = "월 지수 값 대신 연말 값의 평균으로 매달 산 것으로 어림했어요";
export const APPROX_DEF = "그해 12번을 모두 ‘직전 연말 값과 그해 연말 값의 평균’ 가격으로 샀다고 봤어요. 실제 월별 값이 아니라서 한 해 안에서 오르내린 모양은 반영되지 않아요. 총액과 기간은 한 번에 넣기와 같아요.";
export const IRR_SENTENCE = (irr: string) => `넣은 시점을 반영해 해마다 평균으로 바꾸면 ${irr}예요. 늦게 넣은 돈일수록 짧게 들어가 있어 한 번에 넣기의 해마다 평균과 같은 뜻이 아니에요.`;
export const PERIOD_FOOT_1 = "총액과 기간은 같고 넣는 방식만 달라요. 두 방식의 평가액은 같은 높이 눈금에 그렸어요.";
