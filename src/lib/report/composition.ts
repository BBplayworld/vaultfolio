// 자산 구성 변화(연 탭 카드)·외화 노출(성적표 분산·비중 카드) 순수 계산 — 저장 데이터를 읽기만 한다(#72).
// 금액은 화면에 내보내지 않고 비중(%)·%p만 문장으로 만든다.

import type { MonthlyAssetSnapshot } from "@/types/asset";
import type { FxExposure } from "./asset-report";
import { pruneMonthlySnapshots, shiftMonth } from "./settlement";
import { MAIN_PALETTE } from "@/config/theme";
import { formatShortCurrency } from "@/lib/number-utils";

export type CompositionKey = "realEstate" | "stocks" | "crypto" | "cash";
/** 표시 순서(동률 비교·범례·색 배정 순서) */
export const COMPOSITION_KEYS: CompositionKey[] = ["realEstate", "stocks", "crypto", "cash"];
export const COMPOSITION_LABELS: Record<CompositionKey, string> = {
  realEstate: "부동산", stocks: "주식", crypto: "암호화폐", cash: "현금성",
};

/** 이번 달 실시간 자산군 값(getAssetSummary의 *Value) */
export interface CompositionLive { realEstateValue: number; stockValue: number; cryptoValue: number; cashValue: number }

export interface CompositionCell {
  month: string;
  /** 칸 아래 라벨: "7월" · 1월 "26.1" · 마지막 "이번 달" */
  label: string;
  isCurrent: boolean;
  /** 실제 기록일(YYYY-MM-DD), 없으면 undefined */
  date?: string;
  /** 구성 기록 없음(스냅샷 없음·breakdown 없음·총자산 0) */
  empty: boolean;
  /** 반올림 전 비중(%) — empty면 null */
  ratios: Record<CompositionKey, number> | null;
}

export interface CompositionSeries {
  /** hidden: 이번 달 총자산 0 / single: 이번 달만 / bars: 2칸 이상 */
  state: "hidden" | "single" | "bars";
  cells: CompositionCell[];
  /** 값 있는 칸 수(이번 달 포함) */
  filled: number;
  sentence: string | null;
  /** 범례·색을 받는 자산군(어느 칸에든 값이 있는 것, 표시 순서) */
  legendKeys: CompositionKey[];
  /** 자산군별 색 — 이번 달(마지막 칸) 기준 1회 배정, 모든 칸 공통 */
  colors: Record<CompositionKey, string>;
}

/** 새로 쓰는 문자열 금지어(spec 6장) */
export const COMPOSITION_FORBIDDEN_WORDS = [
  "쏠림", "과도", "집중", "편중", "위험", "리스크", "안전", "좋아요", "나빠요", "개선", "악화", "높다", "낮다", "적정",
  "늘리세요", "줄이세요", "조정", "리밸런싱", "분산하세요", "환헤지", "헤지", "추천", "권장",
];

const nonNeg = (n: unknown): number => (typeof n === "number" && Number.isFinite(n) && n > 0 ? n : 0);

function toRatios(values: Record<CompositionKey, number>): Record<CompositionKey, number> | null {
  const v = {
    realEstate: nonNeg(values.realEstate), stocks: nonNeg(values.stocks), crypto: nonNeg(values.crypto), cash: nonNeg(values.cash),
  };
  const total = v.realEstate + v.stocks + v.crypto + v.cash;
  if (total <= 0) return null;
  return {
    realEstate: (v.realEstate / total) * 100, stocks: (v.stocks / total) * 100,
    crypto: (v.crypto / total) * 100, cash: (v.cash / total) * 100,
  };
}

function monthLabel(month: string, isCurrent: boolean): string {
  if (isCurrent) return "이번 달";
  const [y, m] = month.split("-").map(Number);
  return m === 1 ? `${String(y).slice(2)}.1` : `${m}월`;
}

/** 사실 문장·선택 줄에서 쓰는 월 표기: 같은 해 "10월", 지난해 "25년 12월" */
function monthText(month: string, currentMonth: string): string {
  const [y, m] = month.split("-").map(Number);
  return month.slice(0, 4) === currentMonth.slice(0, 4) ? `${m}월` : `${String(y).slice(2)}년 ${m}월`;
}

/** 홈 금융자산 바와 같은 규칙: 최대 비율 = MAIN_PALETTE[0], 나머지는 [3]부터 차례로 */
function assignCompositionColors(keys: CompositionKey[], live: Record<CompositionKey, number>): Record<CompositionKey, string> {
  const colors = {} as Record<CompositionKey, string>;
  let maxKey = keys[0];
  for (const k of keys) if (live[k] > live[maxKey]) maxKey = k;
  let si = 0;
  for (const k of COMPOSITION_KEYS) colors[k] = MAIN_PALETTE[0];
  for (const k of keys) colors[k] = k === maxKey ? MAIN_PALETTE[0] : MAIN_PALETTE[3 + (si++) % 7];
  return colors;
}

function buildSentence(prev: CompositionCell, last: CompositionCell, currentMonth: string): string {
  const label = monthText(prev.month, currentMonth);
  const diffs = COMPOSITION_KEYS
    .map((k) => ({ k, d: Math.round(last.ratios![k] - prev.ratios![k]) }))
    .filter((x) => Math.abs(x.d) >= 1)
    .sort((a, b) => Math.abs(b.d) - Math.abs(a.d)) // 안정 정렬 → 동률은 표시 순서
    .slice(0, 2);
  if (diffs.length === 0) return `지난 기록(${label}) 대비 모든 자산군 변화가 1%p 미만이에요`;
  return `지난 기록(${label}) 대비 ${diffs.map(({ k, d }) => `${COMPOSITION_LABELS[k]} ${d > 0 ? "+" : "-"}${Math.abs(d)}%p`).join(", ")}`;
}

/**
 * 칸 아래 월 라벨 표시 규칙 — 칸이 많으면 좁은 칸에서 라벨이 겹치므로 간격 표시한다.
 * 8칸 이하는 전부, 9칸 이상은 마지막(이번 달)부터 한 칸씩 건너뛰어 표시(최악 320px·13칸에서 중심 간격 37px > 라벨 반폭 합 28px).
 * 숨긴 칸의 이름은 칸 aria-label이 유지한다.
 */
export function compositionLabelVisibility(count: number): boolean[] {
  const step = count <= 8 ? 1 : 2;
  return Array.from({ length: count }, (_, i) => (count - 1 - i) % step === 0);
}

/** 선택한 칸 아래 1줄 — 금액 없이 비중만 */
export function describeCompositionCell(cell: CompositionCell): string {
  if (cell.empty || !cell.ratios) return "이 달은 구성 기록이 없어요";
  const head = cell.isCurrent
    ? "이번 달"
    : cell.date
      ? `${Number(cell.date.slice(5, 7))}월 ${Number(cell.date.slice(8, 10))}일 기록`
      : `${Number(cell.month.slice(5, 7))}월`;
  const parts = COMPOSITION_KEYS.filter((k) => cell.ratios![k] > 0).map((k) => `${COMPOSITION_LABELS[k]} ${cell.ratios![k].toFixed(0)}%`);
  return [head, ...parts].join(" · ");
}

/** 칸 aria-label — "10월: 부동산 62%, 주식 25%" / "9월: 구성 기록 없음" */
export function compositionCellAria(cell: CompositionCell): string {
  const name = cell.isCurrent ? "이번 달" : `${Number(cell.month.slice(5, 7))}월`;
  if (cell.empty || !cell.ratios) return `${name}: 구성 기록 없음`;
  return `${name}: ${COMPOSITION_KEYS.filter((k) => cell.ratios![k] > 0).map((k) => `${COMPOSITION_LABELS[k]} ${cell.ratios![k].toFixed(0)}%`).join(", ")}`;
}

export function computeCompositionSeries(
  monthly: MonthlyAssetSnapshot[],
  live: CompositionLive,
  currentMonth: string,
): CompositionSeries {
  const liveValues: Record<CompositionKey, number> = {
    realEstate: nonNeg(live.realEstateValue), stocks: nonNeg(live.stockValue), crypto: nonNeg(live.cryptoValue), cash: nonNeg(live.cashValue),
  };
  const liveRatios = toRatios(liveValues);
  const empty: CompositionSeries = {
    state: "hidden", cells: [], filled: 0, sentence: null, legendKeys: [], colors: assignCompositionColors([], liveValues),
  };
  if (!liveRatios) return empty;

  // 이번 달 스냅샷은 버리고 실시간 값으로 대신한다
  const past = new Map(
    pruneMonthlySnapshots(monthly, currentMonth).filter((s) => s.month < currentMonth).map((s) => [s.month, s] as const),
  );
  const pastRatios = (month: string) => {
    const b = past.get(month)?.breakdown;
    return b ? toRatios({ realEstate: b.realEstate, stocks: b.stocks, crypto: b.crypto, cash: b.cash }) : null;
  };

  // 축 = 가장 이른 "구성 있는 달"부터 이번 달까지
  const start = [...past.keys()].sort().find((m) => pastRatios(m) !== null);
  const months: string[] = [];
  if (start) for (let m = start; m < currentMonth; m = shiftMonth(m, 1)) months.push(m);
  months.push(currentMonth);

  const cells: CompositionCell[] = months.map((month) => {
    const isCurrent = month === currentMonth;
    const ratios = isCurrent ? liveRatios : pastRatios(month);
    return {
      month, label: monthLabel(month, isCurrent), isCurrent, date: isCurrent ? undefined : past.get(month)?.date,
      empty: !ratios, ratios,
    };
  });
  const filledCells = cells.filter((c) => !c.empty);
  const legendKeys = COMPOSITION_KEYS.filter((k) => filledCells.some((c) => c.ratios![k] > 0));
  const colors = assignCompositionColors(legendKeys, liveValues);

  if (filledCells.length < 2) {
    return { state: "single", cells: [cells[cells.length - 1]], filled: 1, sentence: null, legendKeys, colors };
  }
  const last = filledCells[filledCells.length - 1];
  const prev = filledCells[filledCells.length - 2];
  return { state: "bars", cells, filled: filledCells.length, sentence: buildSentence(prev, last, currentMonth), legendKeys, colors };
}

/** 막대 표시용 최소 높이(%) — 실제 비중이 아니라 시각 보정값 */
export const COMPOSITION_MIN_DISPLAY_PCT = 7;

/**
 * 막대 표시용 보정 스케일 — 0%보다 크지만 min% 미만인 자산군을 min%로 올리고,
 * 나머지 자산군을 비례 축소해 합을 100으로 유지한다. 화면 높이에만 쓰며 문구·aria·라벨은 실제 비중을 쓴다.
 */
export function compositionDisplayRatios(
  ratios: Record<CompositionKey, number>,
  min: number = COMPOSITION_MIN_DISPLAY_PCT,
): Record<CompositionKey, number> {
  const out = { ...ratios };
  const small = COMPOSITION_KEYS.filter((k) => ratios[k] > 0 && ratios[k] < min);
  if (small.length === 0) return out;
  const big = COMPOSITION_KEYS.filter((k) => ratios[k] >= min);
  const bigSum = big.reduce((sum, k) => sum + ratios[k], 0);
  if (bigSum <= 0) return out;
  const rem = 100 - min * small.length;
  for (const k of small) out[k] = min;
  for (const k of big) out[k] = (ratios[k] * rem) / bigSum;
  return out;
}

/** 보정 모드 판정 기준(%) — 값 있는 칸에 이보다 작은 비중이 있으면 corrected */
export const COMPOSITION_CORRECTION_THRESHOLD_PCT = 10;
export type CompositionScaleMode = "linear" | "corrected";

/** 차트 전체 1회 모드 결정: 0 < 비중 < 10%인 자산군이 어느 칸에든 있으면 corrected, 아니면 linear(칸마다 바꾸지 않는다) */
export function compositionScaleMode(cells: CompositionCell[]): CompositionScaleMode {
  const small = cells.some((c) => c.ratios && COMPOSITION_KEYS.some((k) => c.ratios![k] > 0 && c.ratios![k] < COMPOSITION_CORRECTION_THRESHOLD_PCT));
  return small ? "corrected" : "linear";
}

/**
 * 막대 높이용 표시 스케일 — linear면 실제 비중 그대로, corrected면 √비중 정규화 후 최소 7% 바닥.
 * 높이 전용이며 숫자·문구·aria는 항상 실제 비중을 쓴다.
 */
export function compositionDisplayScale(
  ratios: Record<CompositionKey, number>,
  mode: CompositionScaleMode,
): Record<CompositionKey, number> {
  if (mode === "linear") return { ...ratios };
  const w = {} as Record<CompositionKey, number>;
  let sum = 0;
  for (const k of COMPOSITION_KEYS) { w[k] = Math.sqrt(Math.max(0, ratios[k])); sum += w[k]; }
  if (sum <= 0) return { ...ratios };
  const d = {} as Record<CompositionKey, number>;
  for (const k of COMPOSITION_KEYS) d[k] = (w[k] / sum) * 100;
  return compositionDisplayRatios(d, COMPOSITION_MIN_DISPLAY_PCT);
}

// ── 외화 노출 ───────────────────────────────────────────────

export interface FxExposureLines {
  /** 예: "외화 자산 비중 34% (달러 30% · 엔 4%)" */
  ratioLine: string;
  /** 예: "환율이 1% 움직이면 순자산이 약 ±1,234만원 움직여요" — 0원이면 null */
  impactLine: string | null;
  caption: string;
}

/** computeFxExposure 결과를 재사용해 표시 문구만 만든다(재계산 없음). 외화 0·총자산 ≤ 0이면 null */
export function buildFxExposureLines(exposures: FxExposure[], totalValue: number): FxExposureLines | null {
  if (exposures.length === 0 || totalValue <= 0) return null;
  const sum = exposures.reduce((s, e) => s + e.ratio, 0);
  const total = sum < 0.5 ? "1% 미만" : `${sum.toFixed(0)}%`;
  const names = { USD: "달러", JPY: "엔" } as const;
  const parts = exposures.length === 1
    ? names[exposures[0].currency]
    : exposures.map((e) => `${names[e.currency]} ${e.ratio.toFixed(0)}%`).join(" · ");
  const x = Math.round(exposures.reduce((s, e) => s + e.exposureKrw, 0) * 0.01);
  return {
    ratioLine: `외화 자산 비중 ${total} (${parts})`,
    impactLine: x > 0 ? `환율이 1% 움직이면 순자산이 약 ±${formatShortCurrency(x)} 움직여요` : null,
    caption: "주식·현금 중 달러·엔 자산, 총자산 기준",
  };
}
