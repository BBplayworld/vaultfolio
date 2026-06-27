"use client";

/**
 * cloud-sync/device-key.ts
 * 관리자 토큰을 localStorage에 평문 저장하지 않기 위한 기기 종속 암호화.
 *
 * 기법: WebCrypto **비추출(non-extractable) AES-GCM 키**를 IndexedDB에 보관.
 *  - 키 원문은 JS로 읽어낼 수 없고(encrypt/decrypt 호출만 가능), localStorage엔 암호문만 남는다.
 *  - IndexedDB는 clearAssetData(localStorage 한정)에 지워지지 않아 기기 키가 보존된다.
 *  - 한계: 동일 출처 XSS는 decrypt를 호출할 수 있음(완전 방어 아님). 평문 저장 대비 위험을 크게 낮추는 표준 패턴.
 */

import { toBase64, fromBase64 } from "./crypto";

const DB_NAME = "secretasset_kv";
const STORE = "keys";
const KEY_ID = "sync_device_key";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function idbGet(db: IDBDatabase, key: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function idbPut(db: IDBDatabase, key: string, value: unknown): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function getDeviceKey(): Promise<CryptoKey> {
  const db = await openDb();
  const existing = (await idbGet(db, KEY_ID)) as CryptoKey | undefined;
  if (existing) return existing;
  // 비추출 키 생성 → IndexedDB에 구조화 복제로 저장(원문 추출 불가)
  const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
  await idbPut(db, KEY_ID, key);
  return key;
}

export interface WrappedSecret {
  iv: string;
  ciphertext: string;
}

export async function wrapSecret(plain: string): Promise<WrappedSecret> {
  const key = await getDeviceKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv as BufferSource },
    key,
    new TextEncoder().encode(plain) as BufferSource
  );
  return { iv: toBase64(iv.buffer as ArrayBuffer), ciphertext: toBase64(ct) };
}

export async function unwrapSecret(blob: WrappedSecret): Promise<string> {
  const key = await getDeviceKey();
  const pt = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: fromBase64(blob.iv) as BufferSource },
    key,
    fromBase64(blob.ciphertext) as BufferSource
  );
  return new TextDecoder().decode(pt);
}
