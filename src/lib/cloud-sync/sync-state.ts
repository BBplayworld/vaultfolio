"use client";

/**
 * cloud-sync/sync-state.ts
 * 동기화 로컬 상태 — **단일 키** `secretasset_sync`(객체).
 *   { assetId, version, lastSyncedAt, rememberedKey? }
 *   - assetId: 금고 주소(비밀 아님) → 평문.
 *   - version/lastSyncedAt: 충돌 판정·표시.
 *   - rememberedKey: "이 기기 기억" ON 시 masterBits를 기기 비추출 키로 wrap한 암호문(평문 저장 금지).
 *
 * salt·privKey·pubKey는 저장하지 않는다(assetId·금고암호로 그때그때 파생).
 * pull(clearAssetData)이 이 키를 지우므로 복원 후 재기록(sync-client.pullAsset).
 */

import { wrapSecret, unwrapSecret, type WrappedSecret } from "./device-key";
import { toBase64, fromBase64 } from "./crypto";
import { STORAGE_KEYS } from "../local-storage";

export const SYNC_STATE_KEY = STORAGE_KEYS.syncState;

interface SyncState {
  assetId?: string;
  version?: number;
  lastSyncedAt?: string;
  rememberedKey?: WrappedSecret;
  // 마지막으로 서버와 맞춰진 항목 id 집합 — pull 병합의 **기준점**.
  // 로컬에만 있는 항목이 "아직 안 올린 신규 추가"인지 "원격에서 삭제된 것"인지 구분하는 유일한
  // 단서다(삭제가 tombstone 없이 배열 제거라 부재 자체로는 두 경우를 구분할 수 없다).
  syncedIds?: string[];
}

function read(): SyncState {
  try {
    const raw = localStorage.getItem(SYNC_STATE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as SyncState;
  } catch {
    return {};
  }
}

function patch(p: Partial<SyncState>): void {
  try {
    localStorage.setItem(SYNC_STATE_KEY, JSON.stringify({ ...read(), ...p }));
  } catch {
    /* 무시 */
  }
}

export function getAssetId(): string | null {
  return read().assetId ?? null;
}

export function setAssetId(assetId: string): void {
  patch({ assetId });
}

export function getVersion(): number {
  return read().version ?? 0;
}

export function markSynced(version: number): void {
  patch({ version, lastSyncedAt: new Date().toISOString() });
}

export function getLastSyncedAt(): string | null {
  return read().lastSyncedAt ?? null;
}

// 기준점이 없으면(구버전·첫 동기화) null — 호출측은 병합을 끄고 원격 그대로 쓴다(안전 폴백).
export function getSyncedIds(): Set<string> | null {
  const ids = read().syncedIds;
  return Array.isArray(ids) ? new Set(ids) : null;
}

export function setSyncedIds(ids: string[]): void {
  patch({ syncedIds: ids });
}

export function hasRemembered(): boolean {
  return !!read().rememberedKey;
}

// masterBits(바이트) → 기기키로 암호화 보관
export async function saveRememberedMaster(masterBits: Uint8Array): Promise<void> {
  const rememberedKey = await wrapSecret(toBase64(masterBits));
  patch({ rememberedKey });
}

export async function loadRememberedMaster(): Promise<Uint8Array | null> {
  const enc = read().rememberedKey;
  if (!enc) return null;
  try {
    return fromBase64(await unwrapSecret(enc));
  } catch {
    return null;
  }
}

export function forgetRemembered(): void {
  // rememberedKey만 떨군다 — syncedIds(병합 기준점)까지 지우면 병합이 안전 폴백으로 꺼져
  // 다음 동기화 전까지 신규 추가분 보호가 사라진다.
  const { assetId, version, lastSyncedAt, syncedIds } = read();
  try {
    localStorage.setItem(SYNC_STATE_KEY, JSON.stringify({ assetId, version, lastSyncedAt, syncedIds }));
  } catch {
    /* 무시 */
  }
}

export function clearSyncState(): void {
  try {
    localStorage.removeItem(SYNC_STATE_KEY);
  } catch {
    /* 무시 */
  }
}
