"use client";

/**
 * cloud-sync/cloud-sync-provider.tsx
 * 공개 E2EE 동기화 컨트롤러 — 항상 마운트, 양방향 자동 동기화 + 링크 진입 감지.
 *
 *  상태: none(금고 미설정) / locked(assetId 있으나 이번 세션 미무장) / armed(키 메모리 보유→자동 동기화)
 *  - 기억된 기기: 로드 시 rememberedMaster unwrap→자동 armed→폴링·자동동기화 즉시 시작.
 *  - 송신: 자산·프로필(닉네임) 변경 → 2.5s 디바운스 push(무음). 수신: 30s 폴링 + 포커스 → 원격 최신이면 자동 pull.
 *  - #sync= (신규, 구 #asset=) 링크 진입 → pendingConnectAssetId(연결 모달 트리거).
 *  - 금고암호는 메모리(ref)에만. remember ON이면 masterBits만 기기키로 암호화 보관.
 */

import { createContext, useContext, useEffect, useRef, useState, useCallback, type ReactNode } from "react";
import { toast } from "sonner";

import { useAssetData, ASSET_USER_EDIT_EVENT } from "@/contexts/asset-data-context";
import { isPwaLocked, PWA_UNLOCKED_EVENT } from "@/lib/pwa/app-lock";
import { NICKNAME_EVENT } from "@/hooks/use-nickname";
import { buildExportPayload, getAssetData } from "@/lib/asset-storage";
import { skipAllTutorialSteps } from "@/lib/local-storage";
import { isInAppGateActive } from "@/lib/pwa/detect-browser";
import { isBackgroundWorkBlocked } from "@/lib/pwa/background-gate";
import { tutorialStore } from "@/stores/tutorial/tutorial-store";
import { isCloudSyncEnabled, SYNC_HASH_PARAM } from "./config";
import { deriveKeys, deriveKeysFromMaster, generateAssetId, type AssetKeys } from "./crypto";
import { pushAsset, pullAsset, fetchRemoteVersion, type PushResult, type PullResult } from "./sync-client";
import {
  getAssetId, setAssetId, getVersion, getLastSyncedAt,
  saveRememberedMaster, loadRememberedMaster, forgetRemembered, clearSyncState,
} from "./sync-state";

const AUTO_PUSH_DEBOUNCE_MS = 2500;
// 사용자 편집 직후 자동 pull을 보류하는 상한 — 디바운스 push가 끝날 시간만 확보한다.
const USER_EDIT_PULL_HOLD_MS = AUTO_PUSH_DEBOUNCE_MS * 4;
const POLL_INTERVAL_MS = 60000;

// 변경 감지기 — "사용자의 자산·닉네임 수정·추가"만 push 트리거로 본다.
// 매 접속마다 saveSnapshots/syncTodayStockPrices가 재계산하는 "진행 중 구간·API 파생값"은
// 비교에서 제외해 오늘자 시세·스냅샷 재계산이 version 갱신(핑퐁)을 유발하지 않게 한다.
// (실제 push payload인 buildExportPayload는 그대로 두므로 데이터 자체는 온전히 동기화됨)
//
// 단, 이 비교는 "자동 갱신인지" 판별용일 뿐이다. 사용자가 폼에서 직접 저장한 편집
// (ASSET_USER_EDIT_EVENT)은 바뀐 필드가 여기서 제외된 파생값뿐이어도 반드시 push한다 —
// 부동산 실거래가 재조회처럼 marketEstimate*만 바뀌는 저장이 통째로 누락되던 문제 방지.
const getComparablePayloadString = (): string => {
  const payload = buildExportPayload();
  // KST 기준 오늘/이번달/올해 (saveSnapshots와 동일 산출)
  const kst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const todayStr = kst.toISOString().split("T")[0];
  const currentMonth = todayStr.substring(0, 7);
  const currentYear = parseInt(todayStr.substring(0, 4), 10);
  // 어제자도 제외 대상 — saveSnapshots가 일요일에 토요일 스냅샷을 생성하고 등급도 토요일 항목에
  // 기록하며, 앱을 켜둔 채 자정을 넘기면 어제자가 갑자기 비교에 편입돼 파생 변경만으로 push된다.
  const yesterday = new Date(kst.getTime() - 24 * 60 * 60 * 1000);
  const yesterdayStr = yesterday.toISOString().split("T")[0];

  const normalized: Record<string, unknown> = { ...payload };

  if (payload.assetData && typeof payload.assetData === "object") {
    const { lastUpdated, stocks, crypto, yearlyNetAssets, realEstate, ...restAssetData } = payload.assetData as any;
    normalized.assetData = {
      ...restAssetData,
      // 부동산 실거래 추정치는 접속마다 재조회되는 파생값 → 트리거에서 제외 (미제외 시 자동 push 핑퐁, R14).
      // regionCode·legalDong·complexName도 최초 로드 시 주소 해석 API가 자동으로 채우는 파생값이라 함께 제외한다
      // (사용자가 직접 입력한 경우는 ASSET_USER_EDIT_EVENT가 커버하므로 동기화가 끊기지 않는다).
      realEstate: Array.isArray(realEstate)
        ? realEstate.map((r: any) => {
          const {
            marketEstimate, marketEstimateDate, marketEstimateSource,
            marketEstimateComplexName, marketEstimateLegalDong, marketEstimateFloor,
            marketEstimateArea, marketEstimateGrade, marketEstimateSampleCount,
            regionCode, legalDong, complexName,
            ...rest
          } = r ?? {};
          return rest;
        })
        : realEstate,
      // 코인도 접속마다 업비트 시세로 갱신되므로 baseDate(슬롯 도장)·currentPrice를 트리거에서 제외.
      // 미제외 시 자산 미변경에도 매시간 자동 push 핑퐁 발생 (R14, 주식과 동일한 이유)
      crypto: Array.isArray(crypto)
        ? crypto.map((c: any) => {
          const { baseDate, currentPrice, ...rest } = c ?? {};
          return rest;
        })
        : crypto,
      // API 동기화 종목(ticker 有·비상장 아님)의 접속마다 재계산되는 파생 필드를 트리거에서 제외.
      // - baseDate(시세 슬롯 도장)·name(API 이름)·inactiveCheckedAt: 항상 갱신되므로 halted 포함 모든 API 종목에서 제외.
      // - 활성 종목은 currentPrice·inactiveStatus·inactiveReason(현재가·비활성 파생)도 제외.
      // - halted(거래정지)는 currentPrice(마지막 보존 가격)·inactiveStatus(정지 상태)를 유지 — 상태 변화는 의미 있는 변경.
      // - 무티커·비상장 종목은 전부 사용자 입력값이라 그대로 비교.
      stocks: Array.isArray(stocks)
        ? stocks.map((s: any) => {
          if (!s?.ticker || s.category === "unlisted") return s;
          const { baseDate, name, inactiveCheckedAt, ...rest } = s;
          if (s.inactiveStatus === "halted") return rest;
          const { currentPrice, inactiveStatus, inactiveReason, ...rest2 } = rest;
          return rest2;
        })
        : stocks,
      // 올해 순자산은 접속마다 saveSnapshots가 덮어쓰는 auto값 → 트리거 제외 (과거 연도·수동 입력 유지)
      yearlyNetAssets: Array.isArray(yearlyNetAssets)
        ? yearlyNetAssets.filter((y: any) => y?.year !== currentYear)
        : yearlyNetAssets,
    };
  }

  if (payload.snapshots && typeof payload.snapshots === "object") {
    const snap = payload.snapshots as { daily?: unknown[]; monthly?: unknown[] };
    normalized.snapshots = {
      // 장기 아카이브(dailyArchive)는 월 전환 시 1회만 변해 정당한 push 트리거 — 그대로 비교에 포함
      ...(payload.snapshots as Record<string, unknown>),
      // 오늘·어제 일별과 이번달 월별은 접속마다 재계산 → 제외. 그 이전 항목은 유지(확정 시 1회 동기화)
      daily: Array.isArray(snap.daily)
        ? snap.daily.filter((d: any) => d?.date !== todayStr && d?.date !== yesterdayStr)
        : snap.daily,
      monthly: Array.isArray(snap.monthly) ? snap.monthly.filter((m: any) => m?.month !== currentMonth) : snap.monthly,
    };
  }

  return JSON.stringify(normalized);
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
  showConnectDialog: boolean;
  setShowConnectDialog: (show: boolean) => void;
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
  const { assetData, initAndSync } = useAssetData();

  const keysRef = useRef<AssetKeys | null>(null);
  const assetIdRef = useRef<string | null>(null);
  const rememberRef = useRef(true);
  const skipNextChangeRef = useRef(false);
  const lastPushedRef = useRef<string | null>(null);
  const busyRef = useRef(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 사용자 명시 편집 대기 플래그 — push 성공 시에만 해제(실패·중단 시 다음 tick에 재시도)
  const userEditRef = useRef(false);
  // 마지막 사용자 편집 시각 — pull 보류의 **시간 상한**용. userEditRef만으로 보류하면
  // push 실패 시 플래그가 안 풀려 타 기기 변경이 영영 들어오지 않는다.
  const userEditAtRef = useRef(0);
  const autoPullRef = useRef<(opts?: { force?: boolean }) => Promise<PullResult | null>>(async () => null);

  const [status, setStatus] = useState<SyncStatus>("none");
  const [assetIdState, setAssetIdState] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [pendingConnectAssetId, setPendingConnectAssetId] = useState<string | null>(null);
  const [showConnectDialog, setShowConnectDialog] = useState(false);
  // 프로필(닉네임) 변경은 assetData state를 바꾸지 않으므로 별도 tick으로 push 트리거
  const [changeTick, setChangeTick] = useState(0);

  // 닉네임 변경 이벤트 → tick 증가 → 자동 push 효과 재실행
  useEffect(() => {
    const bump = () => setChangeTick(t => t + 1);
    window.addEventListener(NICKNAME_EVENT, bump);
    return () => window.removeEventListener(NICKNAME_EVENT, bump);
  }, []);

  // 사용자 명시 편집(자산 CRUD) → 파생값 비교 우회 플래그 + tick 증가
  useEffect(() => {
    const mark = () => { userEditRef.current = true; userEditAtRef.current = Date.now(); setChangeTick(t => t + 1); };
    window.addEventListener(ASSET_USER_EDIT_EVENT, mark);
    return () => window.removeEventListener(ASSET_USER_EDIT_EVENT, mark);
  }, []);

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

  // 마운트: 기억된 기기면 자동 무장, 아니면 locked/none.
  // 원격이 로컬보다 최신이면 pull을 먼저 마친 뒤에만 armed로 전환한다 — armed가 되는 순간
  // 자동 push 디바운스 effect도 함께 무장되므로, pull 없이 먼저 armed가 되면 오래된 로컬(stale)
  // 데이터를 baseline으로 그대로 push해 서버의 최신 데이터를 덮어쓸 수 있었다(오랜만에 켠 기기가
  // 최신 데이터를 지우는 P0 회귀, 2026-08 — PC·PWA로 최신화된 계정을 오래된 모바일 브라우저로
  // 열면 그 즉시 stale push가 나갈 수 있었다). autoPullRef는 render 본문에서 매번 최신 함수로
  // 동기화되므로(아래) 선언 순서와 무관하게 이 시점에도 이미 사용 가능하다.
  useEffect(() => {
    if (!enabled) return;
    const aid = getAssetId();
    setAssetIdState(aid);
    setLastSyncedAt(getLastSyncedAt());
    let cancelled = false;
    void (async () => {
      const master = await loadRememberedMaster();
      if (cancelled) return;
      // 인앱 게이트 활성 시 armed 진입 차단 → 자동 pull/폴링/push(status==="armed" 의존) 전면 정지.
      // assetId/lastSyncedAt은 위에서 이미 세팅되어 syncLink 생성은 유지됨.
      if (master && aid && !isInAppGateActive()) {
        const keys = await deriveKeysFromMaster(master);
        if (cancelled) return;
        keysRef.current = keys;
        assetIdRef.current = aid;
        rememberRef.current = true;
        // force:true로 편집-보류 가드를 우회 — 아직 armed 전이라 사용자 편집이 있을 수 없다.
        await autoPullRef.current({ force: true });
        if (cancelled) return;
        lastPushedRef.current = getComparablePayloadString();
        setStatus("armed");
      } else {
        setStatus(aid ? "locked" : "none");
      }
    })();
    return () => { cancelled = true; };
  }, [enabled]);

  // #sync= 링크 진입 감지 → 연결 모달 트리거 (구 #asset= 호환)
  useEffect(() => {
    if (!enabled) return;
    const detect = () => {
      // 게이트(인앱 브라우저·앱 잠금) 뒤에서 연결 모달이 열리지 않게 차단.
      // 잠금화면(z=10200)보다 아래(z=10002)라 보이지 않는 채로 열리면 Radix focus trap이
      // 잠금화면 입력의 포커스를 강탈한다. 해제 시 아래 리스너가 다시 감지한다.
      if (isBackgroundWorkBlocked()) return;
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const aid = hashParams.get(SYNC_HASH_PARAM) ?? hashParams.get("asset");
      if (aid && aid !== getAssetId()) {
        setPendingConnectAssetId(aid);
        setShowConnectDialog(true);
      }
      // 해시 제거는 연결 모달이 닫힐 때 clearPendingConnect에서 수행.
      // (다이얼로그가 열리는 틱에 Next 패치 replaceState를 호출하면 Radix가 즉시 닫히는 버그 → 제거 시점 분리)
    };
    detect();
    window.addEventListener("hashchange", detect);
    window.addEventListener(PWA_UNLOCKED_EVENT, detect);
    return () => {
      window.removeEventListener("hashchange", detect);
      window.removeEventListener(PWA_UNLOCKED_EVENT, detect);
    };
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
      userEditRef.current = false;
      setLastSyncedAt(getLastSyncedAt());
      // lastBackupAt은 건드리지 않는다 — "데이터 백업(파일 내보내기)"만의 사실이다.
      // 자동 push가 이 값을 갱신하면 사용자가 백업한 적 없는 날도 "마지막 백업: 오늘"로 보인다.
      // 넛지 오탐은 shouldShowBackupNudge가 syncArmed로 이미 차단하므로 여기서 기록할 필요가 없다.
      if (!silent) toast.success("클라우드에 백업했습니다.");
    } else if (r.status === "conflict") {
      if (!silent) toast.info("클라우드가 더 최신이라 최신 데이터를 반영합니다.");
      // conflict는 push 성공이 아니라 userEditAt이 남아 있다 → force로 편집 보류 가드를 넘긴다.
      // 넘기지 않으면 push→conflict→pull차단이 반복되며 영구히 수렴하지 않는다.
      // await + 실패 시 짧은 재시도 — fire-and-forget이면 실패(네트워크 등)가 다음 60초 폴링까지
      // 방치돼, 그 사이 로컬이 여전히 stale인 채로 남을 수 있었다(2026-08 P0 보강).
      const recovered = await autoPullRef.current({ force: true });
      if (!recovered || recovered.status !== "ok") {
        setTimeout(() => { void autoPullRef.current({ force: true }); }, 3000);
      }
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
      void initAndSync(getAssetData());
      lastPushedRef.current = getComparablePayloadString();
      // pull이 로컬을 덮어썼으므로 대기 중이던 사용자 편집도 더는 존재하지 않는다(즉시 되-push 방지)
      userEditRef.current = false;
      setLastSyncedAt(getLastSyncedAt());
      if (auto) toast.info("다른 기기의 변경을 반영했습니다.");
    } else {
      // 실패(empty·error)면 skip 예약을 되돌린다 — 남겨두면 다음 비-사용자편집 변경 1회를
      // 삼켜버린다(닉네임 변경은 changeTick만 올리고 userEditRef는 안 올려 그대로 걸린다)
      skipNextChangeRef.current = false;
    }
    return r;
  }, [initAndSync, runPushAfterRestoreFix]);

  // 자산·프로필(닉네임) 변경 → 무장 시 디바운스 push
  useEffect(() => {
    if (!enabled || status !== "armed") return;
    if (isPwaLocked()) return; // 앱잠금 화면 뒤에서 자동 push 금지(pull 가드와 대칭)
    // 사용자 명시 편집은 pull 직후 skip에도, 파생값 비교에도 걸리지 않고 반드시 push한다
    if (skipNextChangeRef.current && !userEditRef.current) { skipNextChangeRef.current = false; return; }
    if (!userEditRef.current && getComparablePayloadString() === lastPushedRef.current) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => { void runPush(true); }, AUTO_PUSH_DEBOUNCE_MS);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [assetData, changeTick, status, enabled, runPush]);

  // 원격 최신이면 자동 pull. force=true는 409 충돌 화해 전용 —
  // 그 경로는 서버가 push를 거부한 상태라 pull 말고는 수렴할 방법이 없다.
  const autoPullIfNewer = useCallback(async ({ force = false } = {}): Promise<PullResult | null> => {
    const keys = keysRef.current, aid = assetIdRef.current;
    if (!keys || !aid || busyRef.current) return null;
    if (isPwaLocked()) return null; // 앱잠금 해제 전에는 pull 금지(clearAssetData가 잠금 인증 삭제·잠금화면 우회 방지)
    // 디바운스 대기 중인 사용자 편집이 있으면 pull을 보류한다 — pull은 로컬을 통째로 덮어쓰면서
    // userEditRef까지 지우므로, 방금 한 편집이 push되지도 복구되지도 않고 소실된다.
    // **시간 상한 필수**: push가 실패하면(오프라인·busy·conflict) 플래그가 안 풀리는데,
    // 무기한 보류하면 타 기기 변경이 영영 들어오지 않는다. 디바운스 완료에 필요한 시간만 보호한다.
    if (!force && Date.now() - userEditAtRef.current < USER_EDIT_PULL_HOLD_MS) return null;
    const remote = await fetchRemoteVersion(aid, keys);
    if (remote == null || remote <= getVersion()) return null;
    return await runPull(true);
  }, [runPull]);

  // 렌더링 시마다 최신 함수 직접 동기화 (useEffect 레이스 컨디션 차단) — Promise<PullResult|null> 반환:
  // 마운트 effect·409 충돌 복구가 pull 완료(성공 여부)를 await할 수 있어야 한다(2026-08 P0).
  autoPullRef.current = (opts) => autoPullIfNewer(opts);

  // 무장 동안 폴링 + 포커스 (인터벌은 status 기준 1회 설정)
  useEffect(() => {
    if (!enabled || status !== "armed") return;
    const tick = () => { if (document.visibilityState === "visible") void autoPullRef.current(); };
    const onUnlocked = () => void autoPullRef.current(); // 앱잠금 해제 직후 즉시 pull
    const id = setInterval(tick, POLL_INTERVAL_MS);
    window.addEventListener("focus", tick);
    document.addEventListener("visibilitychange", tick);
    window.addEventListener(PWA_UNLOCKED_EVENT, onUnlocked);
    void autoPullRef.current();
    return () => {
      clearInterval(id);
      window.removeEventListener("focus", tick);
      document.removeEventListener("visibilitychange", tick);
      window.removeEventListener(PWA_UNLOCKED_EVENT, onUnlocked);
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
    void initAndSync(getAssetData());
    return { ok: true };
  }, [arm, initAndSync]);

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
    setShowConnectDialog(false);
    // 해시 제거(재트리거 방지) - 신구 해시파라미터 모두 정합
    if (typeof window !== "undefined" && (
      window.location.hash.includes(`${SYNC_HASH_PARAM}=`) ||
      window.location.hash.includes("asset=") ||
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
        showConnectDialog, setShowConnectDialog,
        enableSync, unlock, connect, clearPendingConnect, pushNow, pullNow, forget,
      }}
    >
      {children}
    </CloudSyncContext.Provider>
  );
}
