/**
 * 앱 잠금(PIN) 상태 — 순수 모듈.
 *
 * UI(`pwa-lock-screen.tsx`)가 아니라 여기 두는 이유: `asset-data-context`·`cloud-sync-provider`가
 * 잠금 판정을 필요로 하는데, 잠금화면 컴포넌트는 `useAssetData`를 쓰므로 순환 import가 된다.
 */

const AUTH_ENABLED_KEY = "secretasset_pwa_auth_enabled";
const AUTH_PIN_HASH_KEY = "secretasset_pwa_auth_pin_hash";
const SESSION_AUTH_KEY = "secretasset_pwa_authenticated";

/** 잠금 해제 직후 발행되는 이벤트 — CloudSyncProvider가 즉시 pull 트리거 */
export const PWA_UNLOCKED_EVENT = "secretasset:pwa-unlocked";

/** SHA-256 해시 생성 (브라우저 WebCrypto) */
async function sha256(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** 인증 활성화 여부 */
export function isPwaAuthEnabled(): boolean {
  try { return localStorage.getItem(AUTH_ENABLED_KEY) === "true"; } catch { return false; }
}

/**
 * 앱잠금 상태(인증 활성화 + 세션 미인증) 여부 — **잠금 판정 단일 소스**.
 * standalone 여부를 보지 않는다(잠금화면도 웹·PWA 모두에서 뜬다). 별도 판정 함수를 만들면
 * 잠금화면은 떠 있는데 백그라운드 동작은 계속 도는 불일치가 생긴다(과거 `checkIsLocked` 사례).
 */
export function isPwaLocked(): boolean {
  try {
    return isPwaAuthEnabled() && sessionStorage.getItem(SESSION_AUTH_KEY) !== "true";
  } catch { return false; }
}

/**
 * 세션 인증 기록 — 이 시점부터 `isPwaLocked()`가 false가 되어 백그라운드 동작 가드가 풀린다.
 * **이벤트 발행(`emitPwaUnlocked`)과 분리돼 있다** — 로컬 로드를 먼저 끝낸 뒤 원격 pull을
 * 트리거해야 둘이 서로를 덮어쓰지 않기 때문(잠금화면의 해제 순서 참조).
 */
export function markPwaAuthenticated(): void {
  try { sessionStorage.setItem(SESSION_AUTH_KEY, "true"); } catch { /* 무시 */ }
}

/** 잠금 해제 알림 — CloudSyncProvider가 즉시 pull 트리거 */
export function emitPwaUnlocked(): void {
  window.dispatchEvent(new Event(PWA_UNLOCKED_EVENT));
}

/**
 * 인증 PIN 해시 저장(= 앱잠금 켜기).
 * **현재 세션을 인증됨으로 함께 표시한다** — 방금 잠금을 설정한 세션은 정의상 인증된 세션이다.
 * 빠뜨리면 설정 직후 `isPwaLocked()`가 true로 굳는데 잠금화면은 마운트 시에만 판정하므로 뜨지 않고,
 * 그 세션의 자동 push·pull·시세·스냅샷이 전부 무증상 정지한다(사용자 편집 유실).
 */
export async function setPwaAuthPin(pin: string): Promise<void> {
  const hash = await sha256(pin);
  localStorage.setItem(AUTH_PIN_HASH_KEY, hash);
  localStorage.setItem(AUTH_ENABLED_KEY, "true");
  markPwaAuthenticated();
}

/** 인증 비활성화 */
export function disablePwaAuth(): void {
  localStorage.removeItem(AUTH_ENABLED_KEY);
  localStorage.removeItem(AUTH_PIN_HASH_KEY);
}

/** 저장된 PIN 해시 검증 */
export async function verifyPwaAuthPin(pin: string): Promise<boolean> {
  const storedHash = localStorage.getItem(AUTH_PIN_HASH_KEY);
  if (!storedHash) return false;
  const inputHash = await sha256(pin);
  return inputHash === storedHash;
}
