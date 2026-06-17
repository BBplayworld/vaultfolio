"use client";

/**
 * cloud-sync/cloud-sync-provider.tsx
 * 공개 E2EE 동기화 컨트롤러 — 항상 마운트, 양방향 자동 동기화 + 링크 진입 감지.
 *
 *  상태: none(금고 미설정) / locked(assetId 있으나 이번 세션 미무장) / armed(키 메모리 보유→자동 동기화)
 *  - 기억된 기기: 로드 시 rememberedMaster unwrap→자동 armed→폴링·자동동기화 즉시 시작.
 *  - 송신: 자산 변경 → 2.5s 디바운스 push(무음). 수신: 20s 폴링 + 포커스 → 원격 최신이면 자동 pull.
 *  - #asset= (신규) 링크 진입 → pendingConnectAssetId(연결 모달 트리거).
 *  - 금고암호는 메모리(ref)에만. remember ON이면 masterBits만 기기키로 암호화 보관.
 */

import { createContext, useContext, useEffect, useRef, useState, useCallback, type ReactNode } from "react";
import { toast } from "sonner";

import { useAssetData } from "@/contexts/asset-data-context";
import { buildExportPayload } from "@/lib/asset-storage";
import { skipAllTutorialSteps } from "@/lib/local-storage";
import { tutorialStore } from "@/stores/tutorial/tutorial-store";
import { isCloudSyncEnabled, SYNC_HASH_PARAM } from "./config";
import { deriveKeys, deriveKeysFromMaster, generateAssetId, type AssetKeys } from "./crypto";
import { pushAsset, pullAsset, fetchRemoteVersion, type PushResult, type PullResult } from "./sync-client";
import {
  getAssetId, setAssetId, getVersion, getLastSyncedAt,
  saveRememberedMaster, loadRememberedMaster, forgetRemembered, clearSyncState,
} from "./sync-state";

const AUTO_PUSH_DEBOUNCE_MS = 2500;
const POLL_INTERVAL_MS = 60000;

// 비교를 위해 payload에서 lastUpdated 타임스탬프 필드를 제외한 직렬화 문자열 반환
const getComparablePayloadString = (): string => {
  const payload = buildExportPayload();
  if (payload.assetData && typeof payload.assetData === "object") {
    const { lastUpdated, ...restAssetData } = payload.assetData as any;
    return JSON.stringify({ ...payload, assetData: restAssetData });
  }
  return JSON.stringify(payload);
};

type SyncStatus = "none" | "locked" | "armed";
interface ActionResult { ok: boolean; message?: string; link?: string }

interface CloudSyncContextValue {
  enabled: boolean;
  status: SyncStatus;
  assetId: string | null;
  syncLink: string | null;
  syncing: boolean;
  lastSyncedAt: string | null;
  pendingConnectAssetId: string | null;
  enableSync: (passphrase: string, remember: boolean) => Promise<ActionResult>;
  unlock: (passphrase: string, remember: boolean) => Promise<ActionResult>;
  connect: (assetId: string, passphrase: string, remember: boolean) => Promise<ActionResult>;
  clearPendingConnect: () => void;
  pushNow: () => Promise<PushResult>;
  pullNow: () => Promise<PullResult>;
  forget: () => void;
}

const CloudSyncContext = createContext<CloudSyncContextValue | null>(null);

export function useCloudSync(): CloudSyncContextValue {
  const ctx = useContext(CloudSyncContext);
  if (!ctx) throw new Error("useCloudSync must be used within CloudSyncProvider");
  return ctx;
}

function buildLink(assetId: string): string {
  if (typeof window === "undefined") return "";
  const isDark = document.documentElement.classList.contains("dark");
  const themeParam = isDark ? "dark" : "light";
  return `${window.location.origin}${window.location.pathname}#${SYNC_HASH_PARAM}=${assetId}&theme=${themeParam}`;
}

export function CloudSyncProvider({ children }: { children: ReactNode }) {
  const enabled = isCloudSyncEnabled();
  const { assetData, refreshData } = useAssetData();

  const keysRef = useRef<AssetKeys | null>(null);
  const assetIdRef = useRef<string | null>(null);
  const rememberRef = useRef(true);
  const skipNextChangeRef = useRef(false);
  const lastPushedRef = useRef<string | null>(null);
  const busyRef = useRef(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoPullRef = useRef<() => void>(() => { });

  const [status, setStatus] = useState<SyncStatus>("none");
  const [assetIdState, setAssetIdState] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [pendingConnectAssetId, setPendingConnectAssetId] = useState<string | null>(null);

  // 무장 직후 공통 처리 — 상태 반영 + 동기화 자격(assetId·remember) 영속
  const arm = useCallback(async (assetId: string, keys: AssetKeys, remember: boolean) => {
    keysRef.current = keys;
    assetIdRef.current = assetId;
    rememberRef.current = remember;
    setAssetId(assetId);
    if (remember) await saveRememberedMaster(keys.masterBits);
    else forgetRemembered();
    lastPushedRef.current = getComparablePayloadString();
    setAssetIdState(assetId);
    setStatus("armed");
    setLastSyncedAt(getLastSyncedAt());
  }, []);

  // 마운트: 기억된 기기면 자동 무장, 아니면 locked/none
  useEffect(() => {
    if (!enabled) return;
    const aid = getAssetId();
    setAssetIdState(aid);
    setLastSyncedAt(getLastSyncedAt());
    let cancelled = false;
    void (async () => {
      const master = await loadRememberedMaster();
      if (cancelled) return;
      if (master && aid) {
        const keys = await deriveKeysFromMaster(master);
        if (cancelled) return;
        keysRef.current = keys;
        assetIdRef.current = aid;
        rememberRef.current = true;
        lastPushedRef.current = getComparablePayloadString();
        setStatus("armed");
      } else {
        setStatus(aid ? "locked" : "none");
      }
    })();
    return () => { cancelled = true; };
  }, [enabled]);

  // #asset= 링크 진입 감지 → 연결 모달 트리거
  useEffect(() => {
    if (!enabled) return;
    const detect = () => {
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const aid = hashParams.get(SYNC_HASH_PARAM);
      if (aid && aid !== getAssetId()) setPendingConnectAssetId(aid);
    };
    detect();
    window.addEventListener("hashchange", detect);
    return () => window.removeEventListener("hashchange", detect);
  }, [enabled]);

  const runPushAfterRestoreFix = useCallback(() => {
    // pull의 applyImportedPayload(clearAssetData)가 secretasset_sync를 지움 → 자격 재기록
    const aid = assetIdRef.current;
    if (!aid) return;
    setAssetId(aid);
    if (rememberRef.current && keysRef.current) void saveRememberedMaster(keysRef.current.masterBits);
  }, []);

  const runPush = useCallback(async (silent: boolean): Promise<PushResult> => {
    const keys = keysRef.current, aid = assetIdRef.current;
    if (!keys || !aid) return { status: "error", message: "잠금 해제가 필요합니다." };
    if (busyRef.current) return { status: "error", message: "동기화 중입니다." };
    busyRef.current = true; setSyncing(true);
    const r = await pushAsset(aid, keys);
    busyRef.current = false; setSyncing(false);
    if (r.status === "ok") {
      lastPushedRef.current = getComparablePayloadString();
      setLastSyncedAt(getLastSyncedAt());
      if (!silent) toast.success("클라우드에 백업했습니다.");
    } else if (r.status === "conflict") {
      if (!silent) toast.info("클라우드가 더 최신이라 최신 데이터를 반영합니다.");
      autoPullRef.current();
    } else if (!silent) {
      toast.error(r.message);
    }
    return r;
  }, []);

  const runPull = useCallback(async (auto: boolean): Promise<PullResult> => {
    const keys = keysRef.current, aid = assetIdRef.current;
    if (!keys || !aid) return { status: "error", message: "잠금 해제가 필요합니다." };
    if (busyRef.current) return { status: "error", message: "동기화 중입니다." };
    busyRef.current = true; setSyncing(true);
    skipNextChangeRef.current = true;
    const r = await pullAsset(aid, keys);
    busyRef.current = false; setSyncing(false);
    if (r.status === "ok") {
      runPushAfterRestoreFix();
      refreshData();
      lastPushedRef.current = getComparablePayloadString();
      setLastSyncedAt(getLastSyncedAt());
      if (auto) toast.info("다른 기기의 변경을 반영했습니다.");
    }
    return r;
  }, [refreshData, runPushAfterRestoreFix]);

  // 자산 변경 → 무장 시 디바운스 push
  useEffect(() => {
    if (!enabled || status !== "armed") return;
    if (skipNextChangeRef.current) { skipNextChangeRef.current = false; return; }
    if (getComparablePayloadString() === lastPushedRef.current) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => { void runPush(true); }, AUTO_PUSH_DEBOUNCE_MS);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [assetData, status, enabled, runPush]);

  // 원격 최신이면 자동 pull
  const autoPullIfNewer = useCallback(async () => {
    const keys = keysRef.current, aid = assetIdRef.current;
    if (!keys || !aid || busyRef.current) return;
    const remote = await fetchRemoteVersion(aid, keys);
    if (remote == null || remote <= getVersion()) return;
    await runPull(true);
  }, [runPull]);

  // 렌더링 시마다 최신 함수 직접 동기화 (useEffect 레이스 컨디션 차단)
  autoPullRef.current = () => { void autoPullIfNewer(); };

  // 무장 동안 폴링 + 포커스 (인터벌은 status 기준 1회 설정)
  useEffect(() => {
    if (!enabled || status !== "armed") return;
    const tick = () => { if (document.visibilityState === "visible") autoPullRef.current(); };
    const id = setInterval(tick, POLL_INTERVAL_MS);
    window.addEventListener("focus", tick);
    document.addEventListener("visibilitychange", tick);
    autoPullRef.current();
    return () => {
      clearInterval(id);
      window.removeEventListener("focus", tick);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [enabled, status]);

  // ── 액션 ──
  const enableSync = useCallback(async (passphrase: string, remember: boolean): Promise<ActionResult> => {
    if (!passphrase) return { ok: false, message: "금고 암호를 입력하세요." };
    const aid = generateAssetId();
    clearSyncState();            // 이전 금고 흔적 제거(버전·기억 초기화)
    setAssetId(aid);
    assetIdRef.current = aid;
    const keys = await deriveKeys(passphrase, aid);
    keysRef.current = keys;
    const r = await pushAsset(aid, keys); // 신규 금고 생성(TOFU)
    if (r.status !== "ok") return { ok: false, message: r.status === "error" ? r.message : "생성 실패" };
    await arm(aid, keys, remember);
    return { ok: true, link: buildLink(aid) };
  }, [arm]);

  const armWithPull = useCallback(async (aid: string, passphrase: string, remember: boolean): Promise<ActionResult> => {
    const keys = await deriveKeys(passphrase, aid);
    keysRef.current = keys;
    assetIdRef.current = aid;
    const r = await pullAsset(aid, keys);
    if (r.status === "error") { keysRef.current = null; return { ok: false, message: r.message }; }
    if (r.status === "empty") { keysRef.current = null; return { ok: false, message: "클라우드에 금고가 없습니다." }; }
    await arm(aid, keys, remember);
    // 외부 데이터로 연동된 기기는 튜토리얼 전체 스킵 (공유 경로 applySharedData와 동일)
    skipAllTutorialSteps();
    tutorialStore.getState().initTutorial();
    refreshData();
    return { ok: true };
  }, [arm, refreshData]);

  const unlock = useCallback((passphrase: string, remember: boolean) => {
    const aid = getAssetId();
    if (!aid) return Promise.resolve({ ok: false, message: "연결된 금고가 없습니다." });
    return armWithPull(aid, passphrase, remember);
  }, [armWithPull]);

  const connect = useCallback((aid: string, passphrase: string, remember: boolean) => {
    return armWithPull(aid, passphrase, remember);
  }, [armWithPull]);

  const clearPendingConnect = useCallback(() => {
    setPendingConnectAssetId(null);
    // 해시 제거(재트리거 방지) - 신구 해시파라미터 모두 정합
    if (typeof window !== "undefined" && (
      window.location.hash.includes(`${SYNC_HASH_PARAM}=`) ||
      window.location.hash.includes("sync=") ||
      window.location.hash.includes("vault=")
    )) {
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
    }
  }, []);

  const forget = useCallback(() => {
    keysRef.current = null;
    assetIdRef.current = null;
    clearSyncState();
    setAssetIdState(null);
    setStatus("none");
    setLastSyncedAt(null);
  }, []);

  const pushNow = useCallback(() => runPush(false), [runPush]);
  const pullNow = useCallback(() => runPull(false), [runPull]);

  return (
    <CloudSyncContext.Provider
      value={{
        enabled, status, assetId: assetIdState, syncLink: assetIdState ? buildLink(assetIdState) : null,
        syncing, lastSyncedAt, pendingConnectAssetId,
        enableSync, unlock, connect, clearPendingConnect, pushNow, pullNow, forget,
      }}
    >
      {children}
    </CloudSyncContext.Provider>
  );
}
