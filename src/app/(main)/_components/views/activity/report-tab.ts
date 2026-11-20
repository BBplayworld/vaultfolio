/**
 * 자산 성적표·불리기 화면(#239 6차) 세그먼트 탭 기억 — 세션(페이지 수명) 메모리만. 새로고침하면 기본 탭(내 자산 점검).
 * 허브 카드는 한 입구라 기본 탭으로 연다(resetReportTab). 저장 키 없음.
 */
export type ReportTab = "grow" | "grade";

let lastTab: ReportTab = "grow";
export const getReportTab = (): ReportTab => lastTab;
export const setReportTab = (t: ReportTab): void => { lastTab = t; };
export const resetReportTab = (): void => { lastTab = "grow"; lastGrowView = null; growOpenKey = null; };

// 내 자산 점검 칸의 종류 줄(#242) — 화면 안에서 고른 보기(주식 / 코인 / 부동산·실물)를 종목 페이지·수정 창에 다녀와도 기억한다.
// 허브로 새로 들어오면(resetReportTab) 비워 규칙(차례가 있는 첫 종류)대로 다시 정한다. 저장 키 없음
type GrowViewMemo = "stock" | "crypto" | "own";
let lastGrowView: GrowViewMemo | null = null;
export const getGrowView = (): GrowViewMemo | null => lastGrowView;
export const setGrowView = (v: GrowViewMemo): void => { lastGrowView = v; };

// 점검 한 장 외부 열기(#245, 5.130) — 상세·주식 차례 행·종목 한 장 머리의 진입이 '주식 보기에서 이 종목 한 장을 연 채로' 도착하게 하는 1회용 대상(이름표 키).
// 블록이 마운트 때 읽고 비운다. 해시·저장소에 싣지 않아 새로고침하면 보통 목록이다. 허브·홈 팁(resetReportTab)은 대상을 비운다
let growOpenKey: string | null = null;
export const peekGrowOpenKey = (): string | null => growOpenKey;
export const clearGrowOpenKey = (): void => { growOpenKey = null; };
/** 내 자산 점검 칸 › 주식 보기로 겨눈다 — labelKey가 있으면 그 종목 한 장을 연 채로(진입), 없으면 목록만(타일) */
export function aimGrowStockView(labelKey: string | null = null): void {
  resetReportTab();
  lastGrowView = "stock";
  growOpenKey = labelKey;
}
