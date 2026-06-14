"use client";

import type { ReactNode } from "react";
import { formatCurrency, formatShortCurrency, getPriceLayout, formatPriceByMode } from "@/lib/number-utils";
import { ASSET_THEME, getProfitLossColor } from "@/config/theme";

interface DetailSummaryHeaderProps {
  label: string;
  value: number;
  valueClass?: string;
  // 전체 금액 포매터. 미전달 시 formatCurrency 사용 (마스킹 시 maskFn 전달)
  formatFull?: (v: number) => string;
  // 축약 금액 포매터. 미전달 시 formatShortCurrency 사용 (마스킹 시 maskFn 전달)
  formatShort?: (v: number) => string;
  // 히어로 금액 아래 보조 강조 (예: 평가손익)
  inline?: ReactNode;
}

// 상세 탭 헤더 — 5개 탭(주식/부동산/암호화폐/현금/대출) 공통.
// 세로 스택 위계: 라벨 / 히어로 전체금액 / 인라인 보조.
export function DetailSummaryHeader({
  label,
  value,
  valueClass = ASSET_THEME.text.default,
  formatFull = formatCurrency,
  formatShort = formatPriceByMode,
  inline,
}: DetailSummaryHeaderProps) {
  const { primary, secondary } = getPriceLayout(value, formatFull, formatShort);

  return (
    <div className={`rounded-lg ${ASSET_THEME.primary.bgLight} px-4 py-4`}>
      <p className="text-xs lg:text-sm text-muted-foreground font-semibold">{label}</p>
      <div className="mt-1 flex flex-col gap-0.5">
        <p className={`text-xl sm:text-2xl lg:text-3xl font-extrabold tabular-nums break-all leading-tight ${valueClass}`}>
          {primary}
        </p>
        {secondary && (
          <p className="text-xs lg:text-sm text-muted-foreground font-medium tabular-nums break-all leading-tight">
            {secondary}
          </p>
        )}
      </div>
      {inline && <div className="mt-1">{inline}</div>}
    </div>
  );
}


interface ProfitMetricProps {
  label: string;
  profit: number;
  // 수익률: rate 직접 전달 시 우선, 없으면 cost로 계산
  cost?: number;
  rate?: number;
  decimals?: number;
  formatShort?: (v: number) => string;
  hideAmountSign?: boolean;
  // 라벨 앞 슬롯 (예: 환차손익 힌트 아이콘) — 자산 조건별 노출
  prefix?: ReactNode;
  // 아래 보조 줄 슬롯 (예: 스크린샷 환차손익 포함 표기)
  note?: ReactNode;
}

// 평가손익 인라인 — 히어로 금액 아래 한 줄로 노출 (라벨·금액·수익률).
export function ProfitMetric({
  label,
  profit,
  cost,
  rate,
  decimals = 2,
  formatShort = formatPriceByMode,
  hideAmountSign = false,
  prefix,
  note,
}: ProfitMetricProps) {
  const effectiveRate = rate ?? (cost && cost > 0 ? (profit / cost) * 100 : 0);
  const sign = profit >= 0 ? "+" : "";
  const color = getProfitLossColor(profit);
  const row = (
    <span className="inline-flex items-baseline gap-1">
      {prefix}
      <span className={`text-base lg:text-lg font-bold tabular-nums whitespace-nowrap ${color}`}>
        {!hideAmountSign && sign}{formatShort(Math.round(profit))}
      </span>
      <span className={`text-xs font-semibold tabular-nums whitespace-nowrap ${color}`}>
        ({sign}{effectiveRate.toFixed(decimals)}%)
      </span>
    </span>
  );
  if (!note) return row;
  return <span className="inline-flex flex-col gap-0.5">{row}{note}</span>;
}
