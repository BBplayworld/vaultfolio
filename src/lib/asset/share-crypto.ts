/**
 * share-crypto.ts
 * 공유 토큰 v73A 암복호 — WebCrypto AES-256-GCM + PBKDF2(PIN, URL키‖salt).
 *
 * 토큰: "v73A" + base64url(salt16 ‖ nonce12 ‖ ciphertext+tag16), AAD = "v73A"
 * 순서: LZString 압축(바이트) → 암호화 (압축 후 암호화해야 크기가 유지됨)
 * URL 키: CSPRNG 128비트 hex 32자 — 링크 `#share=share:{서버키}_{URL키}`의 localKey 자리. 서버에는 가지 않는다.
 * 한계: 링크가 통째로 유출되면 PIN 4자리만 남는다(PBKDF2는 비용만 올림). PIN은 링크와 다른 경로로 전하는 2요소.
 */
import LZString from "lz-string";
import { PBKDF2_ITERATIONS, fromBase64, toBase64Url } from "@/lib/cloud-sync/crypto";

export const SHARE_V73_PREFIX = "v73A";
const SALT_LEN = 16;
const NONCE_LEN = 12;
const URL_KEY_RE = /^[0-9a-f]{32}$/;
const encU = new TextEncoder();
const AAD = encU.encode(SHARE_V73_PREFIX);

const toHex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
const fromHex = (h: string) => Uint8Array.from(h.match(/../g) ?? [], (x) => parseInt(x, 16));
const fromBase64Url = (s: string) => fromBase64(s.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (s.length % 4)) % 4));

/** URL 키(localKey) 생성 — CSPRNG 128비트, hex 32자 */
export function generateShareUrlKey(): string {
  return toHex(crypto.getRandomValues(new Uint8Array(16)));
}

async function deriveShareKey(pin: string, urlKey: string, salt: Uint8Array): Promise<CryptoKey> {
  const kSalt = new Uint8Array(16 + SALT_LEN);
  kSalt.set(fromHex(urlKey), 0);
  kSalt.set(salt, 16);
  const base = await crypto.subtle.importKey("raw", encU.encode(pin), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: kSalt as BufferSource, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

/** 평문(OK| 제외 dsv) → v73A 토큰 */
export async function encryptShare(plain: string, pin: string, urlKey: string): Promise<string> {
  if (!URL_KEY_RE.test(urlKey)) throw new Error("invalid url key");
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LEN));
  const nonce = crypto.getRandomValues(new Uint8Array(NONCE_LEN));
  const key = await deriveShareKey(pin, urlKey, salt);
  const ct = new Uint8Array(await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: nonce as BufferSource, additionalData: AAD as BufferSource },
    key,
    LZString.compressToUint8Array(plain) as BufferSource,
  ));
  const out = new Uint8Array(SALT_LEN + NONCE_LEN + ct.length);
  out.set(salt, 0);
  out.set(nonce, SALT_LEN);
  out.set(ct, SALT_LEN + NONCE_LEN);
  return SHARE_V73_PREFIX + toBase64Url(out);
}

/** v73A 토큰 → 평문. 오답 PIN·키 손상·변조는 모두 null */
export async function decryptShare(token: string, pin: string, urlKey: string): Promise<string | null> {
  try {
    if (!token.startsWith(SHARE_V73_PREFIX) || !URL_KEY_RE.test(urlKey)) return null;
    const raw = fromBase64Url(token.substring(SHARE_V73_PREFIX.length));
    if (raw.length < SALT_LEN + NONCE_LEN + 16) return null;
    const key = await deriveShareKey(pin, urlKey, raw.slice(0, SALT_LEN));
    const pt = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: raw.slice(SALT_LEN, SALT_LEN + NONCE_LEN) as BufferSource, additionalData: AAD as BufferSource },
      key,
      raw.slice(SALT_LEN + NONCE_LEN) as BufferSource,
    );
    return LZString.decompressFromUint8Array(new Uint8Array(pt)) ?? null;
  } catch {
    return null;
  }
}

