import "server-only";
import { createCipheriv, createDecipheriv, createHmac, hkdfSync, randomBytes } from "crypto";

// 시장 알림 서버 저장 보호(#179) — 구독 id는 HMAC-SHA256(서버 비밀, endpoint), endpoint·keys는 AES-256-GCM 블롭.
// 서버 비밀 PUSH_STORE_KEY(base64 32바이트)는 환경 변수에만 둔다(코드·로그·저장소에 쓰지 않음).

export function getStoreKey(): Buffer | null {
  const raw = process.env.PUSH_STORE_KEY;
  if (!raw) return null;
  const key = Buffer.from(raw, "base64");
  return key.length === 32 ? key : null;
}

// 5.113: 마스터 키에서 용도별 키를 HKDF로 분리(subId용·AES용). 구 형식(마스터 직접 사용)은 이중 읽기로만 유지한다.
const INFO_SUBID = "secretasset/push/subid/v2";
const INFO_AES = "secretasset/push/aes/v2";
/** 신 형식 블롭 접두 — base64에는 ":"가 없어 구 형식과 구분된다 */
export const BLOB_V2_PREFIX = "2:";

function derive(master: Buffer, info: string): Buffer {
  return Buffer.from(hkdfSync("sha256", master, Buffer.alloc(0), info, 32));
}

/** 신 구독 id — HKDF(subid) 키로 HMAC */
export function pushSubId(endpoint: string): string {
  const key = getStoreKey();
  if (!key) throw new Error("PUSH_STORE_KEY 미설정");
  return createHmac("sha256", derive(key, INFO_SUBID)).update(endpoint).digest("hex");
}

/** 구 구독 id(마스터 키 직접 HMAC) — 이행 기간 동안 구 레코드 삭제·조회 전용 */
export function pushSubIdLegacy(endpoint: string): string {
  const key = getStoreKey();
  if (!key) throw new Error("PUSH_STORE_KEY 미설정");
  return createHmac("sha256", key).update(endpoint).digest("hex");
}

export interface SubSecret {
  endpoint: string;
  p256dh: string;
  auth: string;
}

/** "2:" + base64(iv(12) + tag(16) + 암호문) — AES 키는 HKDF 파생 */
export function sealSecret(secret: SubSecret): string {
  const key = getStoreKey();
  if (!key) throw new Error("PUSH_STORE_KEY 미설정");
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", derive(key, INFO_AES), iv, { authTagLength: 16 });
  const ct = Buffer.concat([c.update(JSON.stringify(secret), "utf8"), c.final()]);
  return BLOB_V2_PREFIX + Buffer.concat([iv, c.getAuthTag(), ct]).toString("base64");
}

/** 구 형식(접두 없음) 블롭 여부 */
export function isLegacyBlob(blob: string): boolean {
  return !blob.startsWith(BLOB_V2_PREFIX);
}

/** 복호화 실패(키 교체·변조)는 null. "2:" 접두는 파생 키, 접두 없으면 구(마스터 직접) 키 */
export function openSecret(blob: string): SubSecret | null {
  const key = getStoreKey();
  if (!key) return null;
  try {
    const v2 = !isLegacyBlob(blob);
    const buf = Buffer.from(v2 ? blob.slice(BLOB_V2_PREFIX.length) : blob, "base64");
    if (buf.length < 12 + 16 + 1) return null; // iv(12) + tag(16) + 암호문 최소 1바이트 — 짧은 블롭 거부
    const d = createDecipheriv("aes-256-gcm", v2 ? derive(key, INFO_AES) : key, buf.subarray(0, 12), { authTagLength: 16 });
    d.setAuthTag(buf.subarray(12, 28));
    const pt = Buffer.concat([d.update(buf.subarray(28)), d.final()]).toString("utf8");
    const p = JSON.parse(pt) as SubSecret;
    return p && typeof p.endpoint === "string" ? p : null;
  } catch {
    return null;
  }
}
