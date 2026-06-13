/**
 * cloud-sync/config.ts
 * E2EE 클라우드 동기화 — 공용 설정·타입.
 *
 * 공개 무료 서비스: 누구나 금고 생성, syncId+링크로 기기 연결.
 * 인증은 금고암호 파생 Ed25519 서명(서버는 pubKey만 보유, 비밀 전송 0).
 * 로컬 상태는 단일 키 `secretasset_sync`(sync-state.ts). 결제 없음("추후 Plus" 명시).
 */

// 기본 노출. 운영 비상 차단만 `NEXT_PUBLIC_CLOUD_SYNC=off`.
export function isCloudSyncEnabled(): boolean {
  return process.env.NEXT_PUBLIC_CLOUD_SYNC !== "off";
}

// 서버 저장 금고(없으면 null). 자산 내용·salt·비밀 없음 — pubKey만.
export interface VaultEnvelope {
  pubKey: string;      // base64 — Ed25519 공개키(TOFU 등록)
  iv: string;          // base64 — AES-GCM nonce
  ciphertext: string;  // base64 — 암호문(+tag)
  version: number;     // 단조 증가
  updatedAt: string;   // ISO
}

// 인증 토큰 헤더 (base64url JSON { syncId, ts, nonce, sig })
export const SYNC_AUTH_HEADER = "x-sync-auth";

// 동기화 링크 해시 파라미터 (#vault=<assetId>)
export const SYNC_HASH_PARAM = "vault";

// 서명 신선도 창(초)
export const SIG_FRESHNESS_SEC = 300;
