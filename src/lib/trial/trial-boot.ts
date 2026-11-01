/**
 * trial/trial-boot.ts — 체험 모드(#59) 부팅. TrialGate가 `?trial=1`일 때만 동적 import한다(정적 import 0건).
 *
 * 순서(fail-closed — 어느 단계든 실패하면 주입하지 않는다):
 *  ① 거부 판정: 메모리 설치 **전**, 원본 Storage를 읽기 전용으로(getItem·Object.keys·JSON.parse만, getAssetData 금지)
 *  ② 메모리 Storage(window.localStorage 교체) + fetch 거부 래퍼(window.fetch 교체) 설치 — 원본 복구 코드 없음(S2)
 *  ③ 검증 5종: window.localStorage===mem / 전역 식별자 localStorage===mem / 원본에 probe 없음 / Object.keys(mem) 열거 / fetch===trialFetch
 *  ④ 통과 시에만 체험 표시 + 데모 주입(메모리 대상)
 * 원본에 대한 쓰기는 probe가 원본에서 발견됐을 때의 removeItem 1건뿐이다.
 */

import { hasAnyAssets } from "@/lib/asset/asset-storage";
import { LEGACY_KEYS, STORAGE_KEYS } from "@/lib/local-storage";
import { injectDemoPayload, skipDemoTutorial, stripQueryParams } from "@/lib/preview/demo-inject";
import { markTrialActive, TRIAL_BLOCKED_MESSAGE, TRIAL_BLOCKED_PATHS, TRIAL_QUERY_KEY } from "./trial-mode";

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

const ASSET_ARRAYS = ["realEstate", "stocks", "crypto", "cash", "loans"] as const;
// 원본에서 메모리로 복사하는 키 — GA 옵트아웃·디버그 플래그만(테마는 쿠키라 해당 없음)
const COPY_KEYS = ["ga-optout", "ga-debug"] as const;
// probe 접두는 secretasset_가 아니다 → clearAssetData 대상이 아님
const PROBE_PREFIX = "__secretasset_trial_probe__";
// 복원 링크 해시(#60 hasRestoreHash와 같은 목록)
const RESTORE_HASH_KEYS = ["share", "sync", "asset", "vault"];

// ─────────────────────────────────────────────────────────
// 메모리 Storage — 키를 own enumerable 속성으로 둬 Object.keys(localStorage) 기반 정리(clearAssetData 등)가 그대로 동작
// ─────────────────────────────────────────────────────────

class MemoryStorage {
  getItem(key: string): string | null {
    return Object.prototype.hasOwnProperty.call(this, key) ? (this as unknown as Record<string, string>)[key] : null;
  }
  setItem(key: string, value: string): void {
    (this as unknown as Record<string, string>)[String(key)] = String(value);
  }
  removeItem(key: string): void {
    delete (this as unknown as Record<string, string>)[String(key)];
  }
  clear(): void {
    for (const k of Object.keys(this)) delete (this as unknown as Record<string, string>)[k];
  }
  key(index: number): string | null {
    return Object.keys(this)[index] ?? null;
  }
  get length(): number {
    return Object.keys(this).length;
  }
}

export function createMemoryStorage(): Storage {
  return new MemoryStorage() as unknown as Storage;
}

// ─────────────────────────────────────────────────────────
// ① 거부 판정(읽기 전용)
// ─────────────────────────────────────────────────────────

export type TrialRejectReason = "asset_data" | "legacy_asset_data" | "sync" | "app_lock" | "restore_hash" | "storage_error";

/** 원본 저장소·해시로 체험 거부 사유 판정. null이면 진입 가능 */
export function trialRejectReason(original: Pick<Storage, "getItem">, hash: string): TrialRejectReason | null {
  try {
    const params = new URLSearchParams(hash.replace(/^#/, ""));
    if (RESTORE_HASH_KEYS.some((k) => params.has(k))) return "restore_hash";

    const raw = original.getItem(STORAGE_KEYS.assetData);
    if (raw !== null) {
      let parsed: unknown;
      try { parsed = JSON.parse(raw); } catch { return "asset_data"; }
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return "asset_data";
      const obj = parsed as Record<string, unknown>;
      const normalized: Record<string, unknown[]> = {};
      for (const k of ASSET_ARRAYS) {
        const v = obj[k];
        if (v === undefined) normalized[k] = [];
        else if (Array.isArray(v)) normalized[k] = v;
        else return "asset_data";
      }
      if (hasAnyAssets(normalized as Parameters<typeof hasAnyAssets>[0])) return "asset_data";
    }
    if (original.getItem(LEGACY_KEYS.assetData) !== null) return "legacy_asset_data";
    if (original.getItem(STORAGE_KEYS.syncState) !== null) return "sync";
    if (Object.keys(original).some((k) => k.startsWith("secretasset_pwa_auth"))) return "app_lock";
    return null;
  } catch {
    return "storage_error";
  }
}

// ─────────────────────────────────────────────────────────
// fetch 거부 래퍼
// ─────────────────────────────────────────────────────────

/** 체험 중 거부 대상인지 — 같은 출처 + 거부 경로(또는 하위). URL 해석 실패는 거부(fail-closed) */
export function isTrialBlockedRequest(input: unknown, base: string): boolean {
  try {
    let raw: string;
    if (typeof input === "string") raw = input;
    else if (input instanceof URL) raw = input.href;
    else if (input && typeof (input as { url?: unknown }).url === "string") raw = (input as { url: string }).url;
    else return true;
    const u = new URL(raw, base);
    if (u.origin !== new URL(base).origin) return false;
    return TRIAL_BLOCKED_PATHS.some((p) => u.pathname === p || u.pathname.startsWith(p + "/"));
  } catch {
    return true;
  }
}

/** 네트워크 없이 돌려주는 합성 403 — 호출처가 `!res.ok`이면 data.error를 토스트로 띄운다 */
export function trialBlockedResponse(): Response {
  return new Response(JSON.stringify({ error: TRIAL_BLOCKED_MESSAGE }), {
    status: 403,
    headers: { "Content-Type": "application/json" },
  });
}

export function createTrialFetch(original: typeof fetch, base: () => string): typeof fetch {
  return ((input: RequestInfo | URL, init?: RequestInit) => {
    if (isTrialBlockedRequest(input, base())) return Promise.resolve(trialBlockedResponse());
    return original(input, init);
  }) as typeof fetch;
}

// ─────────────────────────────────────────────────────────
// ②③④ 설치·검증·주입
// ─────────────────────────────────────────────────────────

export type TrialBootResult =
  | "trial"     // 체험 진입 완료
  | "rejected"  // ① 거부 — 아무것도 설치하지 않음(일반 화면 그대로 가능)
  | "failed";   // 설치를 시도한 뒤 실패 — 전역이 일부 바뀌었을 수 있어 호출측이 새로고침해야 한다

export interface TrialBootDeps {
  win: Window & typeof globalThis;
  /** 설치 전에 잡아 둔 원본 Storage */
  original: Storage;
  hash: string;
  /** 메모리 대상 데모 주입 */
  inject: () => Promise<void>;
}

function verify(win: Window & typeof globalThis, mem: Storage, original: Storage, trialFetch: typeof fetch): boolean {
  // ① window.localStorage ② 전역 식별자 ⑤ fetch 래퍼 — 먼저 확인해 ② 실패 시 원본에 probe를 쓰지 않는다
  if (win.localStorage !== mem) return false;
  if (typeof localStorage === "undefined" || localStorage !== mem) return false;
  if (win.fetch !== trialFetch || globalThis.fetch !== trialFetch) return false;
  const probe = PROBE_PREFIX + Math.random().toString(36).slice(2);
  let ok = false;
  try {
    localStorage.setItem(probe, "1"); // 앱 코드와 같은 경로(전역 식별자)
    const leaked = original.getItem(probe) !== null; // ③
    const enumerated = Object.keys(mem).includes(probe); // ④
    ok = !leaked && enumerated;
  } catch {
    ok = false;
  } finally {
    try { mem.removeItem(probe); } catch { /* 무시 */ }
    try { if (original.getItem(probe) !== null) original.removeItem(probe); } catch { /* 무시 */ }
  }
  return ok;
}

export async function bootTrial({ win, original, hash, inject }: TrialBootDeps): Promise<TrialBootResult> {
  if (trialRejectReason(original, hash)) return "rejected";

  const mem = createMemoryStorage();
  try {
    for (const k of COPY_KEYS) {
      const v = original.getItem(k);
      if (v !== null) mem.setItem(k, v);
    }
  } catch {
    return "rejected";
  }

  let trialFetch: typeof fetch;
  try {
    const originalFetch = win.fetch.bind(win);
    trialFetch = createTrialFetch(originalFetch, () => win.location.href);
    Object.defineProperty(win, "localStorage", { configurable: true, enumerable: true, get: () => mem });
    win.fetch = trialFetch;
  } catch {
    return "failed";
  }

  if (!verify(win, mem, original, trialFetch)) return "failed";

  markTrialActive();
  try {
    await inject();
  } catch {
    return "failed";
  }
  return "trial";
}

/** 브라우저 진입점(TrialGate 전용) — 결과와 무관하게 ?trial 쿼리는 제거한다 */
export async function runTrialBoot(): Promise<TrialBootResult> {
  let result: TrialBootResult = "rejected";
  try {
    const original = window.localStorage; // 설치 전 원본 참조
    result = await bootTrial({
      win: window,
      original,
      hash: window.location.hash,
      inject: async () => {
        // 체험은 닉네임을 비운다 — Hero가 "데모 순자산"이 아니라 기본 "순자산"(예시 표기는 배너 1곳, ui-review R2)
        await injectDemoPayload({ nickname: "" });
        skipDemoTutorial();
      },
    });
  } catch {
    result = "failed";
  }
  try { stripQueryParams([TRIAL_QUERY_KEY]); } catch { /* 무시 */ }
  return result;
}
