"use client";

/**
 * cloud-sync/sync-client.ts
 * Ed25519 서명 요청으로 push/pull/meta. 암호화는 crypto.ts, 직렬화/복원은 asset-storage 재사용.
 * 모든 요청은 단일 헤더 `x-sync-auth`(base64url{assetId,ts,nonce,sig})로 인증.
 */

import { buildExportPayload, applyImportedPayload, collectAssetIds, getAssetData } from "@/lib/asset-storage";
import {
  encryptPayload, decryptPayload, signMessage, sha256Hex, randomNonce, toBase64, toBase64Url,
  type AssetKeys, type EncryptedBlob,
} from "./crypto";
import { SYNC_AUTH_HEADER } from "./config";
import { getVersion, markSynced, getSyncedIds, setSyncedIds } from "./sync-state";

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
  | { status: "ok"; version: number; mergedAdditions: boolean }
  | { status: "empty" }
  | { status: "error"; message: string };

export async function pushAsset(assetId: string, keys: AssetKeys): Promise<PushResult> {
  try {
    // 기준점 갱신용으로 같은 시점의 assetData를 함께 잡는다(사이에 await가 없어 payload와 동일 원본).
    const pushedIds = collectAssetIds(getAssetData());
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
    // 방금 올린 항목들이 곧 새 기준점 — 다음 pull에서 "이건 예전에 서버와 맞춰졌던 항목"으로
    // 판정되어, 원격에서 사라졌다면 삭제로 존중된다.
    setSyncedIds(pushedIds);
    return { status: "ok", version: data.version };
  } catch {
    return { status: "error", message: "네트워크 오류가 발생했습니다." };
  }
}

/**
 * @param merge 로컬의 **아직 안 올라간 신규 항목**을 원격 데이터에 되살릴지(기본 true).
 *  `false`는 connect(다른 금고를 새로 채택) 전용 — 로컬 잔여 자산을 남의 금고에 섞으면 안 된다.
 *  기준점(syncedIds)이 없으면(구버전·첫 동기화) merge 값과 무관하게 원격이 그대로 대체한다.
 */
export async function pullAsset(assetId: string, keys: AssetKeys, { merge = true } = {}): Promise<PullResult> {
  try {
    // clearAssetData 전에 미리 읽어둔다(keepKeys로 보존되지만 순서 의존을 만들지 않는다)
    const syncedIds = merge ? getSyncedIds() : null;
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
    // 검증 실패 시 throw → 기존 데이터 보존.
    // keepLocalSnapshots: 스냅샷 없는 기기가 push했다고 해서 이 기기의 순자산 이력을 지우지 않는다.
    // syncedIds: 다른 기기가 거의 동시에 push해 이 기기가 막 추가한 자산이 pull로 사라지는 것을
    // 막되, 기준점에 있던 항목이 원격에서 사라졌으면 "원격에서 삭제됨"으로 존중한다.
    const { mergedAdditions, remoteIds } = applyImportedPayload(payload, { keepLocalSnapshots: true, syncedIds });
    markSynced(data.asset.version);
    // 기준점은 **병합 전 원격 id**로 갱신 — 병합으로 살려둔 로컬 신규분은 아직 서버에 없으므로
    // 여기 포함시키면 다음 pull이 그걸 "삭제됨"으로 오판해 방금 지켜낸 자산을 스스로 지운다.
    setSyncedIds(remoteIds);
    return { status: "ok", version: data.asset.version, mergedAdditions };
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
