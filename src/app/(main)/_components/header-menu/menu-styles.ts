// 더보기·설정 메뉴 행 공용 스타일(#4.46 #81) — 두 화면이 같은 값을 쓴다.
export const MENU_COLUMN = "flex w-full max-w-2xl flex-col gap-5";
export const MENU_ROW =
  "w-full flex items-center gap-3 px-4 py-3.5 rounded-xl bg-card dark:shadow-xs hover:bg-accent dark:hover:bg-accent/60 transition-colors text-left disabled:opacity-50 disabled:cursor-not-allowed";
export const MENU_ROW_DESTRUCTIVE =
  "mt-2 w-full flex items-center gap-3 px-4 py-3.5 rounded-xl bg-rose-500/5 border border-rose-500/10 dark:border-0 shadow-xs hover:bg-rose-500/10 transition-colors text-left text-rose-600 dark:text-rose-400 disabled:opacity-50 disabled:cursor-not-allowed";
export const MENU_SECTION_LABEL = "mb-2 mt-1 px-1 text-sm font-semibold text-muted-foreground";
export const MENU_ICON = "size-5 shrink-0 text-muted-foreground";
export const MENU_LABEL = "font-medium break-keep";
export const MENU_DESC = "mt-0.5 text-sm text-muted-foreground text-pretty break-keep";
/** ON/OFF 배지(앱 잠금·다크 모드 공용) */
export const menuBadge = (on: boolean) =>
  `text-sm font-semibold px-2 py-0.5 rounded shrink-0 ${on ? "bg-primary/15 text-primary dark:bg-brand/15 dark:text-indigo-300" : "bg-muted text-muted-foreground"}`;
