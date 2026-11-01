// 비중 미리보기(/ratio) → 앱(/) 인계 저장소. 모듈 메모리만 사용한다(저장 키 없음, 새로고침 시 소멸).
// 같은 루트 레이아웃의 클라이언트 이동에서만 모듈 상태가 유지된다.
import type { ParsedStock } from "@/lib/asset/screenshot-stock-map";

/** 인계 만료(ms): 10분 */
export const HANDOFF_TTL_MS = 10 * 60 * 1000;

let pending: ParsedStock[] | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;

function clearTimer() {
  if (timer !== null) {
    clearTimeout(timer);
    timer = null;
  }
}

/** 인계 데이터 설정. 재설정 시 이전 타이머를 교체하고, 만료되면 참조를 실제로 지운다 */
export function setHandoff(raw: ParsedStock[]): void {
  clearTimer();
  pending = raw;
  timer = setTimeout(() => {
    pending = null;
    timer = null;
  }, HANDOFF_TTL_MS);
}

/** 소비하지 않고 존재 여부·내용 확인 */
export function peekHandoff(): ParsedStock[] | null {
  return pending;
}

/** 1회 소비: 값을 반환하고 즉시 비운다 */
export function takeHandoff(): ParsedStock[] | null {
  const v = pending;
  pending = null;
  clearTimer();
  return v;
}

/** 인계 호스트가 확인 창을 열 수 있는 조건 (모두 만족해야 함). activeStep(튜토리얼)은 조건이 아니다 */
export interface HandoffGate {
  isDataLoaded: boolean;
  pwaLocked: boolean;
  isSharePending: boolean;
  wizardIsOpen: boolean;
  isTrialMode: boolean;
}

export function canOpenHandoff(s: HandoffGate): boolean {
  return s.isDataLoaded && !s.pwaLocked && !s.isSharePending && !s.wizardIsOpen && !s.isTrialMode;
}
