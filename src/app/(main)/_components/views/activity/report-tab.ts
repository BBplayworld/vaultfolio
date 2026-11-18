/**
 * 자산 성적표·불리기 화면(#239 6차) 세그먼트 탭 기억 — 세션(페이지 수명) 메모리만. 새로고침하면 기본 탭(종목 점검).
 * 허브 카드는 한 입구라 기본 탭으로 연다(resetReportTab). 저장 키 없음.
 */
export type ReportTab = "grow" | "grade";

let lastTab: ReportTab = "grow";
export const getReportTab = (): ReportTab => lastTab;
export const setReportTab = (t: ReportTab): void => { lastTab = t; };
export const resetReportTab = (): void => { lastTab = "grow"; };
