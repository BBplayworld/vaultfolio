// 종목 검색 입력의 키보드 이동 — 결과 목록 활성 칸(↑↓ 순환·Enter 선택·Esc 닫기). 주식 추가·거래 입력 공용
export type SearchKeyAction =
  | { type: "move"; index: number }
  | { type: "select"; index: number }
  | { type: "close" }
  | { type: "none" };

export function nextSearchKey(key: string, activeIndex: number, length: number): SearchKeyAction {
  if (length <= 0) return { type: "none" };
  if (key === "ArrowDown") return { type: "move", index: (activeIndex + 1) % length };
  if (key === "ArrowUp") return { type: "move", index: (activeIndex - 1 + length) % length };
  if (key === "Enter") return activeIndex >= 0 && activeIndex < length ? { type: "select", index: activeIndex } : { type: "none" };
  if (key === "Escape") return { type: "close" };
  return { type: "none" };
}
