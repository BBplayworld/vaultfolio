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

  // ===== 자산 탭 요약 헤더 (총 평가금액 박스) =====
  summaryHeader: "rounded-lg bg-primary/5 px-4 py-3 flex items-center justify-between",

  // 본문 최상위 카드 — border/배경/그림자 제거, 풀블리드
  contentCard: "border-0 bg-transparent shadow-none py-0 gap-3",
  // 본문 좌우 거터 — 전 페이지 공통. 페이지 컨테이너 px-3가 TopBar 버튼 거터와 동일 라인이므로 내부 추가 패딩은 0
  contentPad: "px-0 sm:px-0",

  // ===== 자산 관리 카드 공통 스타일 =====
  // 라이트=흰 패널+그림자(그레이 캔버스 위 부상), 다크=현행(투명·그림자 없음) 보존
  cardWrapper: "rounded-lg overflow-hidden border-0 bg-transparent",
  // cardHeader: "flex flex-wrap items-center gap-1 sm:gap-2 px-3 sm:px-4 py-2.5 bg-primary/10 transition-colors hover:bg-primary/20",
  cardHeader: "flex flex-wrap items-center gap-3 sm:gap-4 py-2.5 transition-colors",
  cardActions: "flex justify-end gap-2 px-3 py-2 bg-muted/40 dark:bg-muted/10",
  // ===== 표면 계층 토큰 (라이트 강화 + dark: 현행 보존) =====
  cardSection: "bg-muted/40 dark:bg-muted/10", // 섹션 strip(name/ticker 등)
  cardSectionMeta: "bg-muted/20 dark:bg-muted/5", // 메타 strip(보유·매수일)
  cardExpandBox: "divide-y divide-border/10 dark:divide-border/50 border-t border-border/10 dark:border-t", // 확장부 래퍼: 라이트=선 없음(톤차 구분), 다크=현행 선
  subItemsWell: "bg-muted/20 dark:bg-muted/5", // 증권사별 항목 컨테이너(라이트 회색 well)
  subCard: "rounded-md overflow-hidden bg-transparent border border-border/10 dark:border-border/60", // 서브카드 외피
  dividerAccent: "border-t border-amber-400/25", // 논리 그룹·섹션 경계 강조 구분선(별점 text-amber-400 톤 통일). 중립 헤어라인과 구별해 '큰 단락' 분리에만.
  subCardHeader: "bg-muted/30 hover:bg-muted/40 dark:bg-primary/6 dark:hover:bg-primary/10", // 서브카드 헤더(라이트=중립 회색, 다크=슬레이트)
  cardActionButton: "size-7.5 sm:size-8.5",
  cardTriggerButton: "flex items-center gap-2 sm:gap-4 flex-1 min-w-0 text-left",
  cardInfoLeft: "flex-1",
  cardInfoTitle: "flex items-baseline gap-1 flex-wrap",
  cardInfoMeta: "flex items-center gap-1 mt-0.5",
  cardInfoName: "font-semibold text-sm sm:text-[15px] leading-tight",
  cardInfoRight: "text-right flex-shrink-0",
  cardAmountMain: "text-sm sm:text-[15px] font-bold tabular-nums leading-tight",
  cardAmountProfitRow: "flex flex-row items-center gap-1 mt-0.5",
  cardAmountSub: "text-sm font-bold tabular-nums",
  cardAmountRate: "text-sm font-bold tabular-nums",
  categoryBox: "rounded bg-primary/10 px-2 py-1 text-xs text-primary font-medium font-semibold",
  todayBox: "inline-flex items-center gap-0.5 rounded bg-muted/60 px-1.5 py-0.5 font-semibold tabular-nums shrink-0",
  inputHeader: "flex items-center justify-between gap-2 px-4 py-2.5 border-primary/30 bg-primary/15 dark:bg-primary/5 border-b-0",
  liabilityBadge: "flex items-center justify-between text-sm rounded-md bg-rose-500/5 border border-rose-200/30 dark:border-rose-900/30 px-2.5 py-1.5",

  // ===== 카드 상세 영역 (CollapsibleContent) =====
  cardDetailLabel: "text-sm text-muted-foreground",
  cardDetailValue: "text-sm font-semibold",
  cardDetailValueBold: "text-sm font-bold",
  cardDetailPriceKRW: "mt-0.5 text-sm text-foreground",
  cardDetailMeta: "text-sm text-muted-foreground",
  // 담보대출 섹션
  cardLoanSection: "px-4 py-2.5 space-y-1.5 bg-destructive/5 border-t border-destructive/15",
  cardLoanTitle: "text-sm font-bold text-destructive/70 flex items-center gap-1",
  cardLoanItem: "flex items-center justify-between rounded-md bg-destructive/8 border border-destructive/20 px-2.5 py-1.5 text-sm",
  cardLoanName: "text-foreground font-medium truncate text-sm",
  cardLoanRate: "text-muted-foreground bg-muted rounded px-1.5 py-0.5 text-sm font-medium",
  tabActive: "data-[state=active]:border-2 data-[state=active]:border-primary data-[state=active]:text-foreground data-[state=active]:shadow-sm data-[state=active]:font-semibold",

  // ===== 탭 공통 스타일 =====
  // 1단계: 페이지 메인 탭
  tabList1: "flex items-center gap-2 p-1.5 sm:p-2 rounded-xl bg-muted/50 border border-border w-full sm:w-fit overflow-hidden",
  tabTrigger1: "rounded-lg px-3 py-2 sm:py-2.5 text-sm sm:text-base font-medium flex items-center justify-center gap-1.5 flex-1 sm:flex-initial text-muted-foreground bg-transparent shadow-none hover:bg-muted hover:text-foreground transition-all data-[state=active]:bg-primary/15 data-[state=active]:text-primary data-[state=active]:shadow-sm data-[state=active]:font-semibold",
  // 2단계: 상세 탭 (주식/부동산/암호화폐/현금/대출) — segment control 캡슐 스타일
  tabList2: "flex items-center gap-0.5 p-1 rounded-xl bg-muted/50 border border-border w-full overflow-hidden",
  tabTrigger2: "rounded-lg px-2 py-2 sm:py-2.5 text-xs sm:text-sm font-medium flex items-center justify-center gap-1 min-w-0 flex-1 text-muted-foreground bg-transparent shadow-none hover:text-foreground transition-all data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm data-[state=active]:font-semibold",
  // 3단계: 카테고리 서브탭 (주식 국내/해외/IRP 등) — 라운드 + border-2 (예전 방식)
  tabList3: "flex items-center gap-0.5 p-1 rounded-lg border border-border bg-muted/30 overflow-hidden w-full",
  tabTrigger3: "rounded-md px-2 py-2 text-xs sm:text-[13px] font-medium min-w-0 flex-1 text-center text-muted-foreground hover:bg-muted hover:text-foreground transition-all data-[state=active]:border-2 data-[state=active]:border-primary data-[state=active]:text-foreground data-[state=active]:shadow-sm data-[state=active]:font-semibold",
  // 3단계 래핑(두 줄) 변형 — 카테고리 항목 많을 때 (부동산/현금/대출). 라운드 + border-2
  tabList3Wrap: "flex flex-wrap gap-0.5 p-1 rounded-lg border border-border bg-muted/30 w-full mb-2 h-fit",
  tabTrigger3Wrap: "rounded-md px-2 py-1 text-xs sm:text-[13px] font-medium text-center text-muted-foreground hover:bg-muted hover:text-foreground transition-all data-[state=active]:border-2 data-[state=active]:border-primary data-[state=active]:text-foreground data-[state=active]:shadow-sm data-[state=active]:font-semibold",

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
 * 인증카드(캡처 DOM) 전용 토큰 — `sm:`/`lg:` 뷰포트 반응형을 데스크톱 값으로 고정한다.
 *
 * 캡처 대상은 항상 480px 고정폭인데 `sm:`은 브라우저 뷰포트 기준이라, 반응형 클래스가
 * 남아 있으면 PC/모바일에서 같은 사용자가 다른 PNG를 얻는다(qa-full-test-plan R25).
 * `screenshotMode`인 컴포넌트만 ASSET_THEME 대신 이 값을 쓴다.
 */
export const ASSET_THEME_SHOT = {
  cardHeader: "flex flex-wrap items-center gap-4 py-2 transition-colors",
  cardTriggerButton: "flex items-center gap-4 flex-1 min-w-0 text-left",
  cardInfoName: "font-semibold text-[15px] leading-tight",
  cardAmountMain: "text-[15px] font-bold tabular-nums leading-tight",
  icon: "size-7",
  iconInitial: "text-[10px]",
  badge: "text-[11px] px-1 py-0 ml-1 leading-tight",
  summaryValue: "text-xl font-bold tabular-nums break-all leading-tight",
  profitAmount: "text-lg font-bold tabular-nums whitespace-nowrap",
  profitRate: "text-base font-bold tabular-nums whitespace-nowrap",
  legendGrid: "grid grid-cols-2 gap-x-4 gap-y-2 px-2",
  legendText: "text-sm",
} as const;

/**
 * 수익/손실에 따른 색상 클래스 반환
 */
export function getProfitLossColor(value: number): string {
  return value >= 0 ? ASSET_THEME.profit : ASSET_THEME.loss;
}

/**
 * z-index 레이어 스케일 — 겹침 순서의 단일 출처(single source of truth)
 *
 * 규칙: 새 오버레이는 반드시 이 표의 값을 쓰고, 임의의 z-* 를 만들지 않는다.
 * 같은 층에 두 요소를 두면 DOM 순서에 따라 가려지므로 **동률 배치 금지**.
 *
 * - hint 가 nav 보다 위: 하단 네비·스크롤 버튼 위에서도 설명 팝오버가 보여야 한다.
 * - modalHint 가 modal 보다 위: 다이얼로그 안에서 연 InfoHint 가 가려지면 안 된다.
 *   (Popover 는 Portal 로 body 에 붙어 모달의 stacking context 밖에 놓인다)
 */
export const Z_LAYER = {
  base: 10,        // 카드 내 오버레이(로딩 가림막 등)
  raised: 20,      // 리사이저·겹침 컨트롤
  floating: 40,    // FAB, PWA 연결 프롬프트
  nav: 50,         // 하단 네비, 스크롤 투 톱
  hint: 60,        // InfoHint·Tooltip (nav 위)
  modal: 10001,    // Dialog·Sheet 오버레이
  modalContent: 10002,
  modalHint: 10003, // 모달 내부에서 열리는 InfoHint
  gate: 10100,     // 인앱 브라우저 게이트
  lock: 10200,     // 앱 잠금 화면
} as const;

/** Tailwind 임의값 클래스로 변환 (예: Z_LAYER.hint → "z-[60]") */
export function zClass(layer: keyof typeof Z_LAYER): string {
  return `z-[${Z_LAYER[layer]}]`;
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
 * 공유 카드용 안전 팔레트 — 의미색과 충돌하는 [1] 빨강(부채/이익)·[2] 주황(임차보증금, 순자산
 * important와 유사)을 제외한다. [0] 인디고는 §1.3 "최대 비율 고정" 규칙 그대로 1위에 배정.
 */
export const SHARE_SAFE_PALETTE = [0, 5, 4, 6, 9, 7, 3, 8, 10].map((i) => MAIN_PALETTE[i]);

/**
 * CSS 클래스 조합 헬퍼
 */
export function cn(...classes: (string | undefined | false)[]): string {
  return classes.filter(Boolean).join(' ');
}
