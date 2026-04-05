/**
 * 자산 관리 통합 색상 테마
 * 
 * 모든 자산 관련 페이지에서 사용하는 색상을 중앙에서 관리합니다.
 * 색상을 변경하려면 이 파일의 값만 수정하면 됩니다.
 */

export const ASSET_THEME = {
  // ===== 기본 색상 =====
  text: {
    default: "text-foreground",
    muted: "text-muted-foreground",
  },
  primary: {
    text: "text-primary",
    bgLight: "bg-primary/20",
    border: "border-teal-600",
  },

  value: "text-white",

  // ===== 중요 =========  
  important: "text-orange-600 dark:text-orange-400",
  // ===== 부채 및 손실 (Liability / Loss) =====
  liability: "text-rose-600 dark:text-rose-400",
  liabilityBg: "bg-rose-600",
  // ===== 수익/손실 =====
  profit: "text-rose-600 dark:text-rose-400",
  loss: "text-blue-600 dark:text-blue-400",
  // ===== 자산 분류 카테고리 색상 (hex) =====
  categoryColors: {
    realEstate: "#0d9488",
    stocks: "#2563eb",
    crypto: "#7c3aed",
    cash: "#16a34a",
    loans: "#e11d48",
    tenantDeposit: "#db2777",
  },
  // ===== 구분자 색상 =====
  delimiterColor: "var(--popover)",

  categoryBox: "rounded bg-primary/10 px-2 py-1 text-xs font-medium text-primary",
  todayBox: "text-xs text-muted-foreground bg-muted/5 px-2 py-0.5 rounded border border-white/20 shrink-0",

  // ===== 부동산 유형별 색상 =====
  realEstateTypeColors: {
    apartment: "#0d9488",
    house: "#2563eb",
    land: "#16a34a",
    commercial: "#d97706",
    other: "#7c3aed",
  },
  // ===== 자산 분포 카드 다크 테마 토큰 =====
  distributionCard: {
    bg: "bg-gradient-to-br from-zinc-900 to-zinc-950",
    border: "border-zinc-500",
    title: "text-white",
    description: "text-zinc-400",
    sectionBg: "bg-zinc-800/60",
    sectionBorder: "border-zinc-700",
    itemBg: "bg-zinc-900/50",
    itemHover: "hover:bg-zinc-800/50",
    muted: "text-zinc-400",
    separatorPill: "bg-zinc-700/80 text-zinc-200",
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
