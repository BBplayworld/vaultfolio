// 외화 노출(성적표 분산·비중 카드) 순수 계산(#72) + 월 탭 자산 구성 변화 계산(#83, 4.51).

import type { FxExposure } from "./asset-report";
import { formatShortCurrency } from "@/lib/number-utils";
import { formatSettlementPoint, type SettlementWindow } from "./settlement";
import type { SnapshotBreakdown } from "@/types/asset";

export type CompositionKey = "realEstate" | "physical" | "stocks" | "crypto" | "cash";
/** 표시 순서(동률 비교·범례·색 배정 순서) */
export const COMPOSITION_KEYS: CompositionKey[] = ["realEstate", "physical", "stocks", "crypto", "cash"];
export const COMPOSITION_LABELS: Record<CompositionKey, string> = {
  realEstate: "부동산", physical: "실물", stocks: "주식", crypto: "암호화폐", cash: "현금성",
};

/** 새로 쓰는 문자열 금지어(spec 6장) */
export const COMPOSITION_FORBIDDEN_WORDS = [
  "쏠림", "과도", "집중", "편중", "위험", "리스크", "안전", "좋아요", "나빠요", "개선", "악화", "높다", "낮다", "적정",
  "늘리세요", "줄이세요", "조정", "리밸런싱", "분산하세요", "환헤지", "헤지", "추천", "권장",
];

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

// ── 월 탭 자산 구성 변화(#83) ───────────────────────────────────

/** 비교에 쓰는 breakdown의 자산군 값만 (스냅샷 breakdown·buildLiveAttributionCurr의 live.breakdown 모두 만족) */
// physical은 과거 스냅샷에 필드가 없을 수 있어(optional) 0으로 읽는다
export type CompositionBreakdown = Pick<SnapshotBreakdown, Exclude<CompositionKey, "physical">> & { physical?: number };
const valueOf = (b: CompositionBreakdown, k: CompositionKey): number => b[k] ?? 0;

export interface MonthCompositionItem {
  key: CompositionKey;
  label: string;
  /** 실제 비중(0~100, 반올림 전) */
  startRatio: number;
  endRatio: number;
  /** 반올림 정수 비중 */
  startPct: number;
  endPct: number;
  /** round(끝) − round(시작) */
  delta: number;
  /** 행 표시용: "62%" / "<1%" / "0%" */
  startText: string;
  endText: string;
  /** 행 표시용: "+4%p" / "−4%p" / "변화 없음" */
  deltaText: string;
}

export interface MonthComposition {
  startLabel: string;
  endLabel: string;
  sentence: string;
  items: MonthCompositionItem[];
}

const MINUS = "\u2212"; // U+2212
const pctText = (ratio: number, pct: number) => (ratio > 0 && pct === 0 ? "<1%" : `${pct}%`);
export const formatDeltaPp = (d: number) => (d === 0 ? "변화 없음" : `${d > 0 ? "+" : MINUS}${Math.abs(d)}%p`);

const sumOf = (b: CompositionBreakdown) => COMPOSITION_KEYS.reduce((s, k) => s + Math.max(valueOf(b, k), 0), 0);

/**
 * 결산 구간 시작→끝 자산군 비중. 비교 구간은 resolveSettlementWindow의 w 그대로:
 * 시작 = w.start.breakdown, 끝 = w.end.breakdown(없으면 이번 달 → liveBreakdown, Hero·원인과 같은 출처).
 * 첫 달·breakdown 없음·합 0·두 시점 모두 자산군 1개면 null(블록 숨김).
 */
export function computeMonthComposition(w: SettlementWindow, liveBreakdown?: CompositionBreakdown | null): MonthComposition | null {
  if (w.kind === "first_month" || !w.start) return null;
  const sb = w.start.breakdown;
  const eb = w.end ? w.end.breakdown : liveBreakdown;
  if (!sb || !eb) return null;
  const sTotal = sumOf(sb), eTotal = sumOf(eb);
  if (sTotal <= 0 || eTotal <= 0) return null;
  const sCount = COMPOSITION_KEYS.filter((k) => valueOf(sb, k) > 0).length;
  const eCount = COMPOSITION_KEYS.filter((k) => valueOf(eb, k) > 0).length;
  if (sCount <= 1 && eCount <= 1) return null;

  const items: MonthCompositionItem[] = [];
  for (const key of COMPOSITION_KEYS) {
    const sv = Math.max(valueOf(sb, key), 0), ev = Math.max(valueOf(eb, key), 0);
    if (sv <= 0 && ev <= 0) continue;
    const startRatio = (sv / sTotal) * 100, endRatio = (ev / eTotal) * 100;
    const startPct = Math.round(startRatio), endPct = Math.round(endRatio);
    const delta = endPct - startPct;
    items.push({
      key, label: COMPOSITION_LABELS[key], startRatio, endRatio, startPct, endPct, delta,
      startText: pctText(startRatio, startPct), endText: pctText(endRatio, endPct), deltaText: formatDeltaPp(delta),
    });
  }
  const movers = items.filter((i) => i.delta !== 0)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta)) // 동률은 COMPOSITION_KEYS 순서 유지(안정 정렬)
    .slice(0, 2);
  const sentence = movers.length === 0
    ? "이 구간 동안 구성이 거의 같아요"
    : `이 구간 동안 ${movers.map((i) => `${i.label} ${formatDeltaPp(i.delta)}`).join(", ")}`;
  return {
    startLabel: formatSettlementPoint(w.startDate, w.startLegacy ? w.start.month : undefined),
    endLabel: w.end ? formatSettlementPoint(w.endDate, w.endLegacy ? w.end.month : undefined) : "지금",
    sentence, items,
  };
}

/** 구성 막대 표시용 폭(%) — 0보다 큰 항목은 최소 minPct를 보장하고 나머지를 비례 축소(합 100). 0 이하는 0. 숫자(%) 표기는 실제 값 그대로 쓴다 */
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
