// PIN 오답 시 재입력 허용 여부 — 1회용 전달 링크(once)만 5회까지, 간편 공유는 즉시 invalid-access
export const SHARE_PIN_MAX_ATTEMPTS = 5;

export function shouldRetryPin(once: boolean | undefined, attempts: number): boolean {
  return once === true && attempts < SHARE_PIN_MAX_ATTEMPTS;
}
