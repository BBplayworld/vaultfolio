"use client";

import type { ReactNode } from "react";
import { formatCurrency, formatShortCurrency } from "@/lib/number-utils";
import { ASSET_THEME, getProfitLossColor } from "@/config/theme";

interface DetailSummaryHeaderProps {
  label: string;
  badge?: ReactNode;
  value: number;
  valueClass?: string;
  // 단축 포매터 (예: 마스킹용). 미전달 시 formatShortCurrency / formatCurrency 사용
  formatShort?: (v: number) => string;
  formatFull?: (v: number) => string;
  right?: ReactNode;
}

// 상세 탭 헤더 — 5개 탭(주식/부동산/암호화폐/현금/대출) 공통.
// 좌측은 라벨·총액 고정, 우측 영역은 탭마다 다르므로 ReactNode slot으로 받음.
// flex gap·whitespace-nowrap·min-w-fit 처리로 모바일 너비에서도 줄바꿈 방지.
export function DetailSummaryHeader({
  label,
  badge,
  value,
  valueClass = ASSET_THEME.important,
  formatShort = formatShortCurrency,
  formatFull = formatCurrency,
  right,
}: DetailSummaryHeaderProps) {
  return (
    <div className={`${ASSET_THEME.summaryHeader} gap-3`}>
      <div className="min-w-fit flex-1">
        <div className="flex items-center gap-1.5">
          <p className="text-xs lg:text-sm text-muted-foreground font-semibold">{label}</p>
          {badge}
        </div>
        <p className={`text-2xl lg:text-3xl font-extrabold tabular-nums whitespace-nowrap ${valueClass}`}>
          {formatShort(value)}
        </p>
        <p className="text-xs lg:text-sm text-foreground">{formatFull(value)}</p>
      </div>
      {right && <div className="text-right min-w-fit space-y-0.5">{right}</div>}
    </div>
  );
}

interface ProfitMetricProps {
  label: string;
  profit: number;
  cost: number;
  decimals?: number;
  formatShort?: (v: number) => string;
  hideAmountSign?: boolean;
}

// 평가손익 우측 영역 — 금액과 수익률을 두 줄로 분리해 좁은 폭에서도 줄바꿈 방지.
export function ProfitMetric({
  label,
  profit,
  cost,
  decimals = 2,
  formatShort = formatShortCurrency,
  hideAmountSign = false,
}: ProfitMetricProps) {
  const rate = cost > 0 ? (profit / cost) * 100 : 0;
  const sign = profit >= 0 ? "+" : "";
  const color = getProfitLossColor(profit);
  return (
    <>
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="flex flex-row items-baseline gap-1 sm:gap-1.5">
        <p className={`text-lg font-bold tabular-nums whitespace-nowrap ${color}`}>
          {!hideAmountSign && sign}{formatShort(Math.round(profit))}
        </p>
        <p className={`text-xs font-semibold tabular-nums whitespace-nowrap ${color}`}>
          ({sign}{rate.toFixed(decimals)}%)
        </p>
      </div>
    </>
  );
}
