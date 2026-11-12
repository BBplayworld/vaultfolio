import "server-only";
import { createCipheriv, createDecipheriv, createHmac, randomBytes } from "crypto";

// 시장 알림 서버 저장 보호(#179) — 구독 id는 HMAC-SHA256(서버 비밀, endpoint), endpoint·keys는 AES-256-GCM 블롭.
// 서버 비밀 PUSH_STORE_KEY(base64 32바이트)는 환경 변수에만 둔다(코드·로그·저장소에 쓰지 않음).

export function getStoreKey(): Buffer | null {
  const raw = process.env.PUSH_STORE_KEY;
  if (!raw) return null;
  const key = Buffer.from(raw, "base64");
  return key.length === 32 ? key : null;
}

export function pushSubId(endpoint: string): string {
  const key = getStoreKey();
  if (!key) throw new Error("PUSH_STORE_KEY 미설정");
  return createHmac("sha256", key).update(endpoint).digest("hex");
}

export interface SubSecret {
  endpoint: string;
  p256dh: string;
  auth: string;
}

/** iv(12) + tag(16) + 암호문 → base64 */
export function sealSecret(secret: SubSecret): string {
  const key = getStoreKey();
  if (!key) throw new Error("PUSH_STORE_KEY 미설정");
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([c.update(JSON.stringify(secret), "utf8"), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), ct]).toString("base64");
}

/** 복호화 실패(키 교체·변조)는 null */
export function openSecret(blob: string): SubSecret | null {
  const key = getStoreKey();
  if (!key) return null;
  try {
    const buf = Buffer.from(blob, "base64");
    const d = createDecipheriv("aes-256-gcm", key, buf.subarray(0, 12));
    d.setAuthTag(buf.subarray(12, 28));
    const pt = Buffer.concat([d.update(buf.subarray(28)), d.final()]).toString("utf8");
    const p = JSON.parse(pt) as SubSecret;
    return p && typeof p.endpoint === "string" ? p : null;
  } catch {
    return null;
  }
}
