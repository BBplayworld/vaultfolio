"use client";

// 연환산 수익률(CAGR) 인라인 표기 — 상세 탭 카드 메타 줄 공용.
// 보유 1년 미만이면 연환산이 과장되므로 아무것도 렌더하지 않는다.

import { TrendingUp } from "lucide-react";
import { annualizeReturnRate } from "@/lib/number-utils";
import { ASSET_THEME } from "@/config/theme";
import { profitTone } from "./detail-summary-header";

export function AnnualizedReturn({ totalRatePct, sinceDate }: { totalRatePct: number; sinceDate: string }) {
  const cagr = annualizeReturnRate(totalRatePct, sinceDate);
  if (cagr === null) return null;
  // 표기값이 0.0%면 부호 없이 회색 — 같은 카드의 손익 0 회색과 맞춘다(#115 profitTone 재사용)
  const tone = profitTone(cagr, cagr, 1);
  return (
    <span data-testid="annualized-return" data-zero={tone.isZero} className="flex items-center gap-1" title="보유기간을 감안한 1년당 수익률(연환산)">
      <TrendingUp className="size-3" />
      <span className={`font-medium ${ASSET_THEME.text.default}`}>
        연 <span className={`font-semibold tabular-nums ${tone.colorClass}`}>{tone.sign}{tone.rate.toFixed(1)}%</span>
      </span>
    </span>
  );
}
