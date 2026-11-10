"use client";

import type { ReactNode } from "react";
import { formatCurrency, formatShortCurrency, getPriceLayout, formatPriceByMode } from "@/lib/number-utils";
import { ASSET_THEME, ASSET_THEME_SHOT, ASSET_THEME_SHOT_BIG, getProfitLossColor } from "@/config/theme";

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
  // 라벨 우측 컨트롤 (예: 주식 탭 원/달러 선택)
  headerAction?: ReactNode;
  // 인증카드(캡처 DOM)용 — 뷰포트 반응형을 데스크톱 값으로 고정(R25)
  screenshotMode?: boolean;
  // 캡처 저장 PNG 전용 — 텍스트 ×SHOT_BIG_SCALE
  shotBig?: boolean;
  // 박스 안 맨 아래 선택 슬롯(#132 상세·주식 시장과 비교 글줄). 없으면 렌더 diff 0
  footer?: ReactNode;
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
  headerAction,
  screenshotMode = false,
  shotBig = false,
  footer,
}: DetailSummaryHeaderProps) {
  const { primary, secondary } = getPriceLayout(value, formatFull, formatShort);
  const shotTok = shotBig ? ASSET_THEME_SHOT_BIG : ASSET_THEME_SHOT;
  const valueSizeCls = screenshotMode ? shotTok.summaryValue : "text-xl sm:text-2xl lg:text-3xl font-bold tabular-nums break-all leading-tight";
  const labelCls = screenshotMode ? shotTok.bodyText : "text-sm";
  // 인증카드는 배경 박스 없이 아래 비중 바·리스트 박스(래퍼 py-3.5 px-2 + 내부 px-0 = 8px)와
  // 좌우 여백을 정확히 맞춘다(R25: screenshotMode 전용 분기). 하단 패딩은 0으로 두고
  // 다음 요소와의 시각적 간격은 바깥 margin으로만 통제해 다른 구간과 동일하게 맞춘다.
  const boxCls = screenshotMode ? "rounded-lg px-2 pt-2" : `rounded-lg ${ASSET_THEME.primary.bgLight} ${ASSET_THEME.summaryBoxDark} px-4 py-4`;

  return (
    <div className={boxCls}>
      <div className="flex items-center justify-between gap-2">
        <p className={`${labelCls} text-muted-foreground font-semibold`}>{label}</p>
        {headerAction}
      </div>
      <div className="mt-1 flex flex-col gap-0.5">
        <p className={`${valueSizeCls} ${valueClass}`}>
          {primary}
        </p>
        {secondary && (
          <p className={`${labelCls} text-muted-foreground font-medium tabular-nums break-all leading-tight`}>
            {secondary}
          </p>
        )}
      </div>
      {/* 인증카드는 리스트 행(cardAmountProfitRow)의 금액~손익 간격(mt-0.5=2px)과 맞춘다 —
          기존 mt-1(4px)은 리스트보다 2배 넓어 보였다(screenshotMode 전용 분기, 다른 탭 불변) */}
      {inline && <div className={screenshotMode ? "mt-0.5" : "mt-1 dark:flex"}>{inline}</div>}
      {footer}
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
  // 인증카드(캡처 DOM)용 — 뷰포트 반응형을 데스크톱 값으로 고정(R25)
  screenshotMode?: boolean;
  // 캡처 저장 PNG 전용 — 텍스트 ×SHOT_BIG_SCALE
  shotBig?: boolean;
}

/**
 * 손익 0 표기 단일 출처(상세 화면 전용, #115) — 표시 기준(반올림)이 0이면 부호 없이 회색.
 * digits=0: 금액(원 단위 반올림), digits=1: 수익률(소수 1자리, 실투자금 수익률처럼 수익률 값 자체로 판정).
 * getProfitLossColor는 공용(theme.ts)이라 건드리지 않는다. amount/rate는 0이면 -0 방지로 0을 돌려준다.
 */
export function profitTone(value: number, rate: number = value, digits = 0) {
  const isZero = Math.round(value * 10 ** digits) === 0;
  return {
    isZero,
    sign: value >= 0 && !isZero ? "+" : "",
    colorClass: isZero ? "text-muted-foreground" : getProfitLossColor(value),
    amount: isZero ? 0 : value,
    rate: isZero ? 0 : rate,
  };
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
  screenshotMode = false,
  shotBig = false,
}: ProfitMetricProps) {
  const effectiveRate = rate ?? (cost && cost > 0 ? (profit / cost) * 100 : 0);
  // 표시 기준(반올림 원 단위)이 0이면 부호 없이 회색 — 매입가 비운 실물 '+0원' 붉은색 방지(#109). getProfitLossColor는 공용이라 건드리지 않는다
  const { isZero, sign, colorClass: color } = profitTone(profit);
  const shotTok = shotBig ? ASSET_THEME_SHOT_BIG : ASSET_THEME_SHOT;
  const amountCls = screenshotMode ? shotTok.profitAmount : "text-base lg:text-lg font-bold tabular-nums whitespace-nowrap";
  const rateCls = screenshotMode ? shotTok.profitRate : "text-sm lg:text-base font-bold tabular-nums whitespace-nowrap";
  const row = (
    <span className="inline-flex items-baseline gap-1">
      {prefix}
      <span className={`${amountCls} ${color}`}>
        {!hideAmountSign && sign}{formatShort(isZero ? 0 : Math.round(profit))}
      </span>
      <span className={`${rateCls} ${color}`}>
        ({sign}{effectiveRate.toFixed(decimals)}%)
      </span>
    </span>
  );
  if (!note) return row;
  return <span className="inline-flex flex-col gap-0.5">{row}{note}</span>;
}
