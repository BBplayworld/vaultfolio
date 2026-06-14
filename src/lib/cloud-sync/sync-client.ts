"use client";

/**
 * cloud-sync/sync-client.ts
 * Ed25519 서명 요청으로 push/pull/meta. 암호화는 crypto.ts, 직렬화/복원은 asset-storage 재사용.
 * 모든 요청은 단일 헤더 `x-sync-auth`(base64url{syncId,ts,nonce,sig})로 인증.
 */

import { buildExportPayload, applyImportedPayload } from "@/lib/asset-storage";
import {
  encryptPayload, decryptPayload, signMessage, sha256Hex, randomNonce, toBase64, toBase64Url,
  type AssetKeys, type EncryptedBlob,
} from "./crypto";
import { SYNC_AUTH_HEADER } from "./config";
import { getVersion, markSynced } from "./sync-state";

export { getLastSyncedAt } from "./sync-state";

// 단일 인증 토큰 생성. canonical = [method, assetId, ...extra, ts, nonce]
async function makeAuthToken(
  method: "GET" | "PUT",
  assetId: string,
  privKey: Uint8Array,
  extra: (string | number)[] = []
): Promise<string> {
  const ts = Math.floor(Date.now() / 1000);
  const nonce = randomNonce();
  const canonical = [method, assetId, ...extra, ts, nonce].join("|");
  const sig = await signMessage(canonical, privKey);
  return toBase64Url(new TextEncoder().encode(JSON.stringify({ assetId, ts, nonce, sig })));
}

export type PushResult =
  | { status: "ok"; version: number }
  | { status: "conflict"; remoteVersion: number }
  | { status: "error"; message: string };

export type PullResult =
  | { status: "ok"; version: number }
  | { status: "empty" }
  | { status: "error"; message: string };

export async function pushAsset(assetId: string, keys: AssetKeys): Promise<PushResult> {
  try {
    const blob = await encryptPayload(buildExportPayload(), keys.encKey);
    const baseVersion = getVersion();
    const ctHash = await sha256Hex(blob.ciphertext);
    const token = await makeAuthToken("PUT", assetId, keys.privKey, [baseVersion, ctHash]);
    const res = await fetch("/api/sync", {
      method: "PUT",
      headers: { "Content-Type": "application/json", [SYNC_AUTH_HEADER]: token },
      body: JSON.stringify({ iv: blob.iv, ciphertext: blob.ciphertext, baseVersion, pubKey: toBase64(keys.pubKey) }),
    });
    if (res.status === 409) {
      const data = (await res.json()) as { asset?: { version?: number } };
      return { status: "conflict", remoteVersion: data.asset?.version ?? 0 };
    }
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return { status: "error", message: data.error || "백업에 실패했습니다." };
    }
    const data = (await res.json()) as { version: number };
    markSynced(data.version);
    return { status: "ok", version: data.version };
  } catch {
    return { status: "error", message: "네트워크 오류가 발생했습니다." };
  }
}

export async function pullAsset(assetId: string, keys: AssetKeys): Promise<PullResult> {
  try {
    const token = await makeAuthToken("GET", assetId, keys.privKey);
    const res = await fetch("/api/sync", { method: "GET", headers: { [SYNC_AUTH_HEADER]: token } });
    if (res.status === 404) return { status: "empty" };
    if (res.status === 401) return { status: "error", message: "금고 암호가 올바르지 않습니다." };
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return { status: "error", message: data.error || "불러오기에 실패했습니다." };
    }
    const data = (await res.json()) as { asset: EncryptedBlob & { version: number } };
    let payload: unknown;
    try {
      payload = await decryptPayload({ iv: data.asset.iv, ciphertext: data.asset.ciphertext }, keys.encKey);
    } catch {
      return { status: "error", message: "복호화 실패 — 금고 암호가 올바르지 않습니다." };
    }
    applyImportedPayload(payload); // 검증 실패 시 throw → 기존 데이터 보존
    markSynced(data.asset.version);
    return { status: "ok", version: data.asset.version };
  } catch {
    return { status: "error", message: "복원에 실패했습니다." };
  }
}

// 폴링용 버전 조회. 미존재/오류 → null.
export async function fetchRemoteVersion(assetId: string, keys: AssetKeys): Promise<number | null> {
  try {
    const token = await makeAuthToken("GET", assetId, keys.privKey);
    const res = await fetch("/api/sync?meta=1", { method: "GET", headers: { [SYNC_AUTH_HEADER]: token } });
    if (!res.ok) return null;
    const data = (await res.json()) as { version?: number };
    return typeof data.version === "number" ? data.version : null;
  } catch {
    return null;
  }
}
