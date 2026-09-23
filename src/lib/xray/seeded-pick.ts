/**
 * 결정적(deterministic) 문자열 해시 기반 선택 — 같은 seed는 항상 같은 결과를 낸다.
 * `investor-type.ts`(문구 선택)와 `investor-avatar.tsx`(표정·배경 색 선택)가 공유하는 단일
 * 출처 — 중복 구현 금지.
 */

// 문자열 해시(djb2 계열) — 입력이 같으면 항상 같은 값이 나온다.
export function hashString(input: string): number {
  let hash = 5381;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) + hash + input.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

export function pick<T>(pool: readonly T[], seed: string): T {
  return pool[hashString(seed) % pool.length];
}
