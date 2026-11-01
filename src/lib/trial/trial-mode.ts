/**
 * trial/trial-mode.ts — 체험 모드(#59) 판정. 소형·정적 모듈(의존 0)이라 어디서 import해도 운영 번들 영향이 작다.
 * 값은 체험 게이트(trial-boot)가 메모리 Storage·fetch 래퍼 설치와 검증 5종을 모두 통과한 뒤에만 true로 바꾼다.
 * 체험 페이지는 새로고침·이동으로만 끝나므로 false로 되돌리는 경로는 두지 않는다(원본 복구 코드 없음, S2).
 */

let trialActive = false;

/** 현재 탭이 체험(예시 금고, 메모리 저장) 중인지 */
export function isTrialMode(): boolean {
  return trialActive;
}

/** 게이트 전용 — 검증 통과 직후 1회 호출 */
export function markTrialActive(): void {
  trialActive = true;
}

/** 체험 진입 쿼리(`/?trial=1`) */
export const TRIAL_QUERY_KEY = "trial";
export const TRIAL_ENTRY_URL = "/?trial=1";

/** 체험 종료 → 실제 웰컴 복귀 표식(sessionStorage). 복귀한 웰컴이 읽고 지운다 */
export const TRIAL_EXIT_KEY = "trial_exit";

/** 체험 중 거부하는 같은 출처 API(외부 전송) — 경로 자체 또는 그 하위 */
export const TRIAL_BLOCKED_PATHS = ["/api/parse-screenshot", "/api/share", "/api/sync", "/api/feedback"] as const;

/** 거부 API 합성 응답의 error 문구 — 호출처가 그대로 토스트로 띄운다 */
export const TRIAL_BLOCKED_MESSAGE = "체험 중에는 사용할 수 없어요";

/** 테스트 전용 — 모듈 상태 초기화 */
export function __resetTrialModeForTest(): void {
  trialActive = false;
}
