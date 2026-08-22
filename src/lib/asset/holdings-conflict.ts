// 보유현황 스크린샷 재등록 시 중복 병합(merge)/전체 교체(reset) 공용 로직.
// crypto-screenshot-import.tsx가 최초 구현한 patterns(symbol:exchange 키 비교)을
// stock/cash/loan도 재사용하도록 일반화(S-4.30).

export type ConflictMode = "merge" | "reset";

export const keyOfStock = (s: { ticker?: string; category: string }): string =>
  `${s.ticker || ""}:${s.category}`;

export const keyOfCrypto = (c: { symbol: string; exchange?: string }): string =>
  `${c.symbol}:${c.exchange || ""}`;

export const keyOfCash = (c: { name: string; institution?: string }): string =>
  `${c.name}:${c.institution || ""}`;

export const keyOfLoan = (l: { name: string; institution?: string; type: string }): string =>
  `${l.name}:${l.institution || ""}:${l.type}`;

/** 기존 보유와 겹치는(같은 키) 신규 항목 개수 */
export function countConflicts<T>(existing: T[], incoming: T[], keyOf: (x: T) => string): number {
  const existingKeys = new Set(existing.map(keyOf));
  return incoming.filter((i) => existingKeys.has(keyOf(i))).length;
}

/**
 * 등록 시 유지할 기존 항목 목록.
 * mode="reset": 기존 전부 삭제(빈 배열). mode="merge": 이번에 가져온 키와 겹치지 않는 기존 항목만 유지
 * (겹치는 항목은 새 값으로 교체되므로 여기서 제외 — 호출부가 [...kept, ...selected]로 합친다).
 */
export function resolveKept<T>(
  existing: T[],
  importedKeys: Set<string>,
  mode: ConflictMode,
  keyOf: (x: T) => string
): T[] {
  if (mode === "reset") return [];
  return existing.filter((e) => !importedKeys.has(keyOf(e)));
}
