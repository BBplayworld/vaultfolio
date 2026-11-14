// PIN 오답 시 재입력 허용 여부 — 1회용 전달 링크(once)만 5회까지, 간편 공유는 즉시 invalid-access
export const SHARE_PIN_MAX_ATTEMPTS = 5;

export function shouldRetryPin(once: boolean | undefined, attempts: number): boolean {
  return once === true && attempts < SHARE_PIN_MAX_ATTEMPTS;
}

// PIN 오답 시 처리 — 1회용: 5회까지 재입력 / 간편 공유(v72Z·v73A): 즉시 invalid-access / 구 v71P 등: 기존처럼 재입력
export function pinMismatchGoesInvalid(token: string, once: boolean | undefined, attempts: number): boolean {
  if (once === true) return !shouldRetryPin(true, attempts);
  return token.startsWith("v72Z") || token.startsWith("v73A");
}
