// 외화 노출(성적표 분산·비중 카드) 순수 계산(#72). 자산 구성 변화 카드는 #4.44에서 제거(키·라벨·금지어는 4.45 재사용을 위해 유지).

import type { FxExposure } from "./asset-report";
import { formatShortCurrency } from "@/lib/number-utils";

export type CompositionKey = "realEstate" | "stocks" | "crypto" | "cash";
/** 표시 순서(동률 비교·범례·색 배정 순서) */
export const COMPOSITION_KEYS: CompositionKey[] = ["realEstate", "stocks", "crypto", "cash"];
export const COMPOSITION_LABELS: Record<CompositionKey, string> = {
  realEstate: "부동산", stocks: "주식", crypto: "암호화폐", cash: "현금성",
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
