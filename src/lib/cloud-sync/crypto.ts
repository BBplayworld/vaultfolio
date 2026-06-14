/**
 * cloud-sync/crypto.ts
 * E2EE 암복호 + Ed25519 서명 (브라우저/Node 공용 WebCrypto + @noble/ed25519).
 *
 * 키 파생(결정적):
 *   salt        = SHA-256("secretasset-salt|"+syncId)[:16]   (syncId로 자체계산, 서버 미전송)
 *   masterBits  = PBKDF2(passphrase, salt, 200k, SHA-256, 32B)
 *   encKey      = HKDF(masterBits, info="enc")   → AES-256-GCM (데이터 암복호, 기기 전용)
 *   ed25519Seed = HKDF(masterBits, info="ed25519") → Ed25519 키쌍 (privKey 기기 / pubKey 서버 등록)
 *
 * 전송: iv·ciphertext·pubKey(1회)·서명뿐. passphrase·encKey·masterBits·privKey는 절대 전송 안 함.
 */

import * as ed from "@noble/ed25519";

// @noble/ed25519 v3: async 함수는 WebCrypto SHA-512 내장 사용(클라/서버 공용) — 별도 주입 불필요.

const PBKDF2_ITERATIONS = 200_000;
const encU = new TextEncoder();
const decU = new TextDecoder();

export function toBase64(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

export function fromBase64(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

export function toBase64Url(bytes: Uint8Array): string {
  return toBase64(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// 128bit 랜덤 assetId (URL-safe)
export function generateAssetId(): string {
  return toBase64Url(crypto.getRandomValues(new Uint8Array(16)));
}

export function randomNonce(): string {
  return toBase64Url(crypto.getRandomValues(new Uint8Array(12)));
}

// assetId → 결정적 salt(16B). 모든 기기에서 동일.
async function deriveSalt(assetId: string): Promise<Uint8Array> {
  const digest = await crypto.subtle.digest("SHA-256", encU.encode("secretasset-salt|" + assetId));
  return new Uint8Array(digest).slice(0, 16);
}

export interface AssetKeys {
  encKey: CryptoKey;       // AES-GCM 데이터 암복호
  privKey: Uint8Array;     // Ed25519 개인키(기기 전용)
  pubKey: Uint8Array;      // Ed25519 공개키(서버 등록)
  masterBits: Uint8Array;  // remember 시 기기키로 wrap해 보관
}

// PBKDF2 → masterBits(32B)
export async function deriveMasterBits(passphrase: string, assetId: string): Promise<Uint8Array> {
  const salt = await deriveSalt(assetId);
  const base = await crypto.subtle.importKey("raw", encU.encode(passphrase), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: salt as BufferSource, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
    base,
    256
  );
  return new Uint8Array(bits);
}

async function hkdf(masterBits: Uint8Array, info: string, lenBytes: number): Promise<Uint8Array> {
  const hk = await crypto.subtle.importKey("raw", masterBits as BufferSource, "HKDF", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt: new Uint8Array(0) as BufferSource, info: encU.encode(info) as BufferSource },
    hk,
    lenBytes * 8
  );
  return new Uint8Array(bits);
}

// masterBits → encKey + Ed25519 키쌍 (remember 복원/최초 공용)
export async function deriveKeysFromMaster(masterBits: Uint8Array): Promise<AssetKeys> {
  const encBits = await hkdf(masterBits, "enc", 32);
  const seed = await hkdf(masterBits, "ed25519", 32);
  const encKey = await crypto.subtle.importKey("raw", encBits as BufferSource, "AES-GCM", false, ["encrypt", "decrypt"]);
  const pubKey = await ed.getPublicKeyAsync(seed);
  return { encKey, privKey: seed, pubKey, masterBits };
}

export async function deriveKeys(passphrase: string, assetId: string): Promise<AssetKeys> {
  const masterBits = await deriveMasterBits(passphrase, assetId);
  return deriveKeysFromMaster(masterBits);
}

export interface EncryptedBlob {
  iv: string;
  ciphertext: string;
}

export async function encryptPayload(payload: unknown, encKey: CryptoKey): Promise<EncryptedBlob> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv as BufferSource },
    encKey,
    encU.encode(JSON.stringify(payload)) as BufferSource
  );
  return { iv: toBase64(iv.buffer as ArrayBuffer), ciphertext: toBase64(ct) };
}

export async function decryptPayload(blob: EncryptedBlob, encKey: CryptoKey): Promise<unknown> {
  const pt = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: fromBase64(blob.iv) as BufferSource },
    encKey,
    fromBase64(blob.ciphertext) as BufferSource
  );
  return JSON.parse(decU.decode(pt));
}

export async function sha256Hex(input: string): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", encU.encode(input));
  return Array.from(new Uint8Array(d)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Ed25519 서명 → base64
export async function signMessage(message: string, privKey: Uint8Array): Promise<string> {
  const sig = await ed.signAsync(encU.encode(message), privKey);
  return toBase64(sig);
}

// 서명 검증(서버 공용). 잘못된 입력은 false.
export async function verifySignature(message: string, sigB64: string, pubKey: Uint8Array): Promise<boolean> {
  try {
    return await ed.verifyAsync(fromBase64(sigB64), encU.encode(message), pubKey);
  } catch {
    return false;
  }
}
