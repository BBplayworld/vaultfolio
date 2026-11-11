/**
 * pwa/first-save-signal.ts — 첫 저장 직후 설치 안내(#78) 세션 메모리 신호.
 * 저장소(localStorage 등)는 쓰지 않는다. 새로고침하면 사라지며, 기기당 1회는 ga.ts의 기존 firstAssetSent가 보장한다.
 */

let firstSave = false;
let dismissed = false;
let shown = false;
let nudgeVisible = false;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

/** ga.ts trackAssetSave의 첫 저장 판정 분기에서만 호출 */
export function markFirstSave(): void {
  if (firstSave) return;
  firstSave = true;
  emit();
}

/** 닫기(추가하기·나중에·홈 이탈) — 이 세션 재노출 없음 */
export function dismissInstallNudge(): void {
  if (dismissed) return;
  dismissed = true;
  emit();
}

/** 안내 카드가 실제로 보이는 동안 true — TutorialOverlay가 말풍선을 양보하는 신호(동시 노출 방지) */
export function setNudgeVisible(v: boolean): void {
  if (nudgeVisible === v) return;
  nudgeVisible = v;
  emit();
}

/** 노출 GA 세션당 1회 가드: 처음 호출이면 true */
export function markNudgeShown(): boolean {
  if (shown) return false;
  shown = true;
  return true;
}

export const getFirstSave = () => firstSave;
export const getDismissed = () => dismissed;
export const getNudgeShown = () => shown;
export const getNudgeVisible = () => nudgeVisible;

export function subscribeFirstSave(l: () => void): () => void {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

/** 테스트 전용 */
export function __resetFirstSaveSignalForTest(): void {
  firstSave = false;
  dismissed = false;
  shown = false;
  nudgeVisible = false;
  listeners.clear();
}
