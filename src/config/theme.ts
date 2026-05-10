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
    bgLight: "bg-primary/10",
    border: "border-indigo-600",
  },

  // ===== 중요 =========
  important: "text-orange-600 dark:text-orange-400",
  importantHex: "#ff8904",
  // ===== 부채 및 손실 (Liability / Loss) =====
  liability: "text-rose-600 dark:text-rose-400",
  liabilityBg: "bg-rose-600",
  // ===== 수익/손실 =====
  profit: "text-rose-600 dark:text-rose-400",
  loss: "text-blue-600 dark:text-blue-400",

  // ===== 자산 관리 카드 공통 스타일 =====
  cardHeader: "flex flex-wrap items-center gap-1 sm:gap-2 px-1.5 sm:px-3 py-2.5 bg-primary/10 transition-colors hover:bg-primary/20",
  cardActions: "flex flex-row gap-1 sm:gap-2 flex-shrink-0 ml-auto",
  cardActionButton: "size-7.5 sm:size-8.5",
  cardTriggerButton: "flex items-center gap-2 sm:gap-4 flex-1 min-w-0 text-left",
  cardInfoLeft: "flex-1",
  cardInfoTitle: "flex items-baseline gap-1 flex-wrap",
  cardInfoMeta: "flex items-center gap-1 mt-0.5",
  cardInfoName: "font-semibold text-sm sm:text-[15px] leading-tight",
  cardInfoRight: "text-right flex-shrink-0",
  cardAmountMain: "text-sm sm:text-[15px] font-bold tabular-nums leading-tight",
  cardAmountProfitRow: "flex flex-row items-center gap-1 mt-0.5",
  cardAmountSub: "text-xs tabular-nums",
  cardAmountRate: "text-xs tabular-nums",
  categoryBox: "rounded bg-primary/10 px-2 py-1 text-xs text-primary font-medium font-semibold",
  todayBox: "text-xs text-muted-foreground px-2 py-0.5 rounded border border-primary bg-primary/5 shrink-0",
  inputHeader: "flex items-center justify-between gap-2 px-4 py-2.5 border-primary/30 bg-primary/15 dark:bg-primary/5 border-b-0",
  liabilityBadge: "flex items-center justify-between text-xs rounded-md bg-rose-500/5 border border-rose-200/30 dark:border-rose-900/30 px-2.5 py-1.5",

  // ===== 카드 상세 영역 (CollapsibleContent) =====
  cardDetailLabel: "text-xs text-muted-foreground",
  cardDetailValue: "text-sm font-medium",
  cardDetailValueBold: "text-sm font-semibold",
  cardDetailPriceKRW: "text-xs sm:text-sm text-foreground",
  cardDetailMeta: "text-xs sm:text-sm text-muted-foreground",
  // 담보대출 섹션
  cardLoanSection: "px-4 py-2.5 space-y-1.5 bg-destructive/5 border-t border-destructive/15",
  cardLoanTitle: "text-xs font-bold text-destructive/70 flex items-center gap-1",
  cardLoanItem: "flex items-center justify-between rounded-md bg-destructive/8 border border-destructive/20 px-2.5 py-1.5 text-xs",
  cardLoanName: "text-foreground font-medium truncate text-sm",
  cardLoanRate: "text-muted-foreground bg-muted rounded px-1 py-0.5 text-xs",
  tabActive: "data-[state=active]:border-2 data-[state=active]:border-primary data-[state=active]:text-foreground data-[state=active]:shadow-sm data-[state=active]:font-semibold",

  // ===== 탭 공통 스타일 =====
  // 1단계: 페이지 메인 탭
  tabList1: "flex items-center gap-2 p-2 py-3 sm:py-5 rounded-xl bg-muted/50 border border-border w-fit overflow-hidden",
  tabTrigger1: "rounded-lg px-3 py-3 sm:py-4 text-sm font-medium flex items-center gap-1.5 text-muted-foreground bg-transparent shadow-none hover:bg-muted hover:text-foreground transition-all data-[state=active]:border-2 data-[state=active]:border-primary data-[state=active]:text-foreground data-[state=active]:shadow-sm data-[state=active]:font-semibold",
  // 2단계: 상세 탭 (주식/부동산/암호화폐/현금/대출)
  tabList2: "flex items-center gap-1 p-1 py-3 sm:py-5 rounded-xl bg-muted/50 border border-border w-full overflow-hidden",
  tabTrigger2: "rounded-lg px-2 py-3 sm:py-4 text-sm font-medium flex items-center justify-center gap-1 min-w-0 flex-1 text-muted-foreground bg-transparent shadow-none hover:bg-muted hover:text-foreground transition-all data-[state=active]:border-2 data-[state=active]:border-primary data-[state=active]:text-foreground data-[state=active]:shadow-sm data-[state=active]:font-semibold",
  // 3단계: 카테고리 서브탭 (주식 국내/해외/IRP 등)
  tabList3: "flex items-center gap-1 p-1 rounded-lg border border-border bg-muted/30 overflow-hidden w-full",
  tabTrigger3: "rounded-md px-2 py-3 text-sm font-medium min-w-0 flex-1 text-center text-muted-foreground hover:bg-muted hover:text-foreground transition-all data-[state=active]:border data-[state=active]:border-2 data-[state=active]:border-primary data-[state=active]:text-foreground data-[state=active]:shadow-sm data-[state=active]:font-semibold",
  // 3단계 래핑(두 줄) 변형 — 카테고리 항목 많을 때 (부동산/현금/대출)
  tabList3Wrap: "flex flex-wrap gap-1 p-1 rounded-lg border border-border bg-muted/30 w-full mb-2 h-fit",
  tabTrigger3Wrap: "rounded-md px-2 py-1 text-sm font-medium text-center text-muted-foreground hover:bg-muted hover:text-foreground transition-all data-[state=active]:border data-[state=active]:border-2 data-[state=active]:border-primary data-[state=active]:text-foreground data-[state=active]:shadow-sm data-[state=active]:font-semibold",

  // ===== 자산 분포 카드 테마 토큰 =====
  distributionCard: {
    bg: "bg-primary/15 dark:bg-primary/5",
    border: "border-zinc-500 dark:border-zinc-500",
    title: "text-zinc-900 dark:text-white",
    description: "text-zinc-500 dark:text-zinc-400",
    sectionBg: "bg-zinc-200/60 dark:bg-zinc-800/60",
    sectionBorder: "border-zinc-300 dark:border-zinc-700",
    itemBg: "bg-zinc-100/50 dark:bg-zinc-900/50",
    itemHover: "hover:bg-zinc-200/50 dark:hover:bg-zinc-800/50",
    muted: "text-zinc-500 dark:text-zinc-400",
    separatorPill: "bg-zinc-200/80 text-zinc-700 dark:bg-zinc-700/80 dark:text-zinc-200",
  },
} as const;

/**
 * 수익/손실에 따른 색상 클래스 반환
 */
export function getProfitLossColor(value: number): string {
  return value >= 0 ? ASSET_THEME.profit : ASSET_THEME.loss;
}

/**
 * 공통 차트 팔레트 — 서로 뚜렷이 구분되는 10색
 * [0] 최대 비율 고정용, [1] 부채 대출 고정, [2] 부채 임차보증금 고정
 * [3~9] 나머지 자산 항목 순차 배정
 */
export const MAIN_PALETTE = [
  "#5b6fbf", // [0] 인디고  ← 최대 비율 고정
  "#c0625a", // [1] 빨강    ← 부채(대출) 고정
  "#c8854a", // [2] 주황    ← 부채(임차보증금) 고정
  "#d6b72eff", // [3] 황금
  "#3a9e6e", // [4] 초록
  "#2a9db5", // [5] 청록
  "#8860a8", // [6] 보라
  "#c45e8a", // [7] 분홍
  "#7a6236", // [8] 황토
  "#4a7ab5", // [9] 하늘파랑
  "#00BCD4", // [10] 쨍한 청록
  "#4e5763ff", // [11] 버튼
] as const;

/**
 * CSS 클래스 조합 헬퍼
 */
export function cn(...classes: (string | undefined | false)[]): string {
  return classes.filter(Boolean).join(' ');
}
