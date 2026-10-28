/**
 * cloud-sync/config.ts
 * E2EE 클라우드 동기화 — 공용 설정·타입.
 *
 * 인증은 금고암호 파생 Ed25519 서명(서버는 pubKey만 보유, 비밀 전송 0).
 * 로컬 상태는 단일 키 `secretasset_sync`(sync-state.ts).
 */

// Vercel preview 배포 여부(next.config.mjs가 빌드 시 VERCEL_ENV를 NEXT_PUBLIC_VERCEL_ENV로 주입).
// 정확히 "preview"일 때만 true — 미설정(로컬)·production·development는 운영과 같이 취급한다.
export function isPreviewEnv(): boolean {
  return process.env.NEXT_PUBLIC_VERCEL_ENV === "preview";
}

// 기본 노출. 운영 비상 차단만 `NEXT_PUBLIC_CLOUD_SYNC=off`.
// preview는 검증 전 코드가 실제 금고에 쓰지 않도록 항상 끈다.
export function isCloudSyncEnabled(): boolean {
  return !isPreviewEnv() && process.env.NEXT_PUBLIC_CLOUD_SYNC !== "off";
}

// 서버 저장 금고(없으면 null). 자산 내용·salt·비밀 없음 — pubKey만.
export interface AssetEnvelope {
  pubKey: string;      // base64 — Ed25519 공개키(TOFU 등록)
  iv: string;          // base64 — AES-GCM nonce
  ciphertext: string;  // base64 — 암호문(+tag)
  version: number;     // 단조 증가
  updatedAt: string;   // ISO
}

// 인증 토큰 헤더 (base64url JSON { assetId, ts, nonce, sig })
export const SYNC_AUTH_HEADER = "x-sync-auth";

// 동기화 링크 해시 파라미터 (#sync=<assetId>, 구 #asset=)
export const SYNC_HASH_PARAM = "sync";

// 서명 신선도 창(초)
export const SIG_FRESHNESS_SEC = 300;
