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
  // ===== 주요 테마 색상 (Primary) =====
  primary: {
    bg: "bg-primary",
    bgLight: "bg-primary/30",
    border: "border-teal-600",
    borderLight: "border-primary/20",
    borderMedium: "border-primary/50",
    ring: "ring-primary/20",
    text: "text-primary",
    textLight: "text-primary/70",
    fill: "fill-primary",
  },
  // ===== 자산 및 수익 (Asset / Profit) =====
  asset: {
    strong: "text-orange-600 dark:text-orange-400 fill-orange-600 dark:fill-orange-400", // 강조
    weak: "text-orange-600/70 dark:text-orange-400/80", // 약함
    bgStrong: "bg-orange-600 dark:bg-orange-400",
    bgWeak: "bg-orange-50 dark:bg-orange-950/30",
    border: "border-orange-200 dark:border-orange-900",
    chart: "var(--primary)", // 파이 차트 등
  },
  // ===== 부채 및 손실 (Liability / Loss) =====
  liability: {
    strong: "text-rose-600 dark:text-rose-400", // 강조
    weak: "text-rose-600/70 dark:text-rose-400/80", // 약함
    bgStrong: "bg-rose-600 dark:bg-rose-400",
    bgWeak: "bg-rose-50 dark:bg-rose-950/30",
    border: "border-rose-200 dark:border-rose-900",
    chart: "var(--color-rose-400)", // 파이 차트 등
  },

  // ===== 부채 및 손실 (Liability / Loss) =====
  profit: "text-red-600 dark:text-red-400",
  loss: "text-blue-600 dark:text-blue-400",
  // ===== 차트 색상 (그 외) =====
  chart: {
    1: "var(--chart-1)",
    2: "var(--chart-2)",
    3: "var(--chart-3)",
    4: "var(--chart-4)",
    5: "var(--chart-5)",
    6: "var(--chart-6)",
  },
} as const;

/**
 * 수익/손실에 따른 색상 클래스 반환
 */
export function getProfitLossColor(value: number): string {
  return value >= 0 ? ASSET_THEME.profit : ASSET_THEME.loss;
}

/**
 * CSS 클래스 조합 헬퍼
 */
export function cn(...classes: (string | undefined | false)[]): string {
  return classes.filter(Boolean).join(' ');
}
