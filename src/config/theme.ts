/**
 * 자산 관리 통합 색상 테마
 * 
 * 모든 자산 관련 페이지에서 사용하는 색상을 중앙에서 관리합니다.
 * 색상을 변경하려면 이 파일의 값만 수정하면 됩니다.
 */

export const ASSET_THEME = {
  // ===== 기본 색상 =====
  background: {
    default: "bg-background",
    dark: "bg-card",
  },

  text: {
    default: "text-foreground",
    muted: "text-muted-foreground",
    white: "text-white",
  },

  // ===== 주요 테마 색상 (청록/Teal) =====
  primary: {
    // 배경
    bg: "bg-primary",
    bgLight: "bg-primary/10",
    bgMedium: "bg-primary/5",
    // 테두리
    border: "border-primary",
    borderLight: "border-primary/20",
    borderMedium: "border-primary/50",
    ring: "ring-primary/20",
    // 텍스트
    text: "text-primary",
    textLight: "text-primary/70",
    // 기타
    fill: "fill-primary",
  },

  // ===== 수익 색상 (초록/Emerald) =====
  profit: {
    light: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-emerald-600 dark:bg-emerald-400",
    border: "border-emerald-600 dark:border-emerald-400",
    // Chart용
    chartLight: "hsl(160 84% 39%)", // emerald-600
    chartDark: "hsl(158 64% 52%)",  // emerald-400
  },

  // ===== 손실 색상 (빨강/Rose) =====
  loss: {
    light: "text-rose-600 dark:text-rose-400",
    bg: "bg-rose-600 dark:bg-rose-400",
    bgLight: "bg-rose-50 dark:bg-rose-950/30",
    border: "border-rose-200 dark:border-rose-900",
    borderLight: "border-rose-600 dark:border-rose-400",
    textAlt: "text-rose-700 dark:text-rose-400",
    textLight: "text-rose-600/70 dark:text-rose-400/70",
    // Chart용
    chartLight: "hsl(350 89% 60%)", // rose-600
    chartDark: "hsl(351 95% 71%)",  // rose-400
  },

  // ===== 보증금/기타 수량 색상 (주황/Amber-Orange) =====
  secondary: {
    light: "text-amber-600 dark:text-amber-400",
    bg: "bg-amber-600 dark:bg-amber-400",
    bgVeryLight: "bg-orange-500/10",
    border: "border-orange-500",
    text: "text-orange-600 dark:text-orange-400",
    textAlt: "text-orange-500",
    // Chart용
    chartLight: "hsl(32 95% 44%)", // amber-600
    chartDark: "hsl(38 92% 50%)",  // amber-400
  },

  // ===== 차트 색상 (Teal/Cyan 기반) =====
  chart: {
    1: "var(--chart-1)", // teal 계열
    2: "var(--chart-2)", // cyan 계열
    3: "var(--chart-3)", // teal 계열
    4: "var(--chart-4)", // cyan 계열
    5: "var(--chart-5)", // teal 계열
    6: "var(--chart-6)", // cyan 계열
  },
} as const;

/**
 * 수익/손실에 따른 색상 클래스 반환
 */
export function getProfitLossColor(value: number): string {
  return value >= 0 ? ASSET_THEME.profit.light : ASSET_THEME.loss.light;
}

/**
 * 수익/손실 차트 색상 반환 (light/dark 모드 자동)
 */
export function getProfitLossChartColor(value: number, isDark: boolean = false): string {
  if (value >= 0) {
    return isDark ? ASSET_THEME.profit.chartDark : ASSET_THEME.profit.chartLight;
  } else {
    return isDark ? ASSET_THEME.loss.chartDark : ASSET_THEME.loss.chartLight;
  }
}

/**
 * CSS 클래스 조합 헬퍼
 */
export function cn(...classes: (string | undefined | false)[]): string {
  return classes.filter(Boolean).join(' ');
}
