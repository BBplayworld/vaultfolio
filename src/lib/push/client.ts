// 시장 알림 클라이언트(#179) — 권한·구독·서버 저장·해제. 서버로 보내는 값은 endpoint·keys·알림 종류 ID·cond뿐.
// web-push 라이브러리는 import하지 않는다(서버 전용, 번들 증가 0).
import type { PushCond } from "./types";
import { clearPushPrefs, readPushPrefs, writePushPrefs } from "./prefs";

export const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

export type PushEnvState = "unsupported" | "needs-install" | "ready";

/** 설치된 앱 실행 여부 — display-mode standalone 또는 iOS navigator.standalone */
export function isStandaloneApp(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia?.("(display-mode: standalone)").matches === true || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

/** 동기 판정 — 지원 안 함 / iOS 미설치·인앱(설치 흐름 필요) / 사용 가능 */
export function detectPushEnv(): PushEnvState {
  if (typeof window === "undefined") return "unsupported";
  // 설치된 앱(standalone)에서만 켤 수 있다 — 브라우저 탭(안드로이드·PC 포함)·인앱은 설치 안내
  if (!isStandaloneApp()) return "needs-install";
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return "unsupported";
  return "ready";
}

function urlBase64ToUint8Array(b64: string): Uint8Array<ArrayBuffer> {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

async function getRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return null;
  try {
    return await Promise.race([
      navigator.serviceWorker.ready,
      new Promise<null>((r) => setTimeout(() => r(null), 5000)),
    ]);
  } catch {
    return null;
  }
}

export async function getPushSubscription(): Promise<PushSubscription | null> {
  const reg = await getRegistration();
  return reg ? reg.pushManager.getSubscription() : null;
}

/** 화면 상태 = 로컬 on + 권한 granted + 실제 구독 존재가 모두 참일 때만 ON */
export async function readPushState(): Promise<"on" | "off" | "denied"> {
  if (typeof Notification !== "undefined" && Notification.permission === "denied") return "denied";
  const prefs = readPushPrefs();
  if (!prefs.on || Notification.permission !== "granted") return "off";
  return (await getPushSubscription()) ? "on" : "off";
}

async function postJson(method: "POST" | "DELETE", url: string, body: unknown): Promise<Response | null> {
  try {
    return await fetch(url, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  } catch {
    return null;
  }
}

function toBody(sub: PushSubscription, topics: string[], cond: PushCond) {
  const j = sub.toJSON();
  return { endpoint: sub.endpoint, p256dh: j.keys?.p256dh ?? "", auth: j.keys?.auth ?? "", topics, cond, standalone: isStandaloneApp() };
}

export type EnableResult = "ok" | "denied" | "error";

/** [알림 켜기] — 첫 await가 권한 요청(제스처 유지). 실패 시 새로 만든 구독은 되돌린다 */
export async function enablePush(topics: string[], cond: PushCond): Promise<EnableResult> {
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return permission === "denied" ? "denied" : "error";
  const reg = await getRegistration();
  if (!reg || !VAPID_PUBLIC_KEY) return "error";
  let created = false;
  try {
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) });
      created = true;
    }
    const res = await postJson("POST", "/api/push/subscribe", toBody(sub, topics, cond));
    if (!res?.ok) {
      if (created) await sub.unsubscribe().catch(() => false);
      return "error";
    }
    writePushPrefs({ v: 3, on: true, topics, cond });
    return "ok";
  } catch {
    return "error";
  }
}

/** 알림 종류 저장 — 서버 1회. 구독이 없으면 실패 */
export async function updatePushTargets(topics: string[], cond: PushCond): Promise<boolean> {
  const sub = await getPushSubscription();
  if (!sub) return false;
  const res = await postJson("POST", "/api/push/subscribe", toBody(sub, topics, cond));
  if (!res?.ok) return false;
  writePushPrefs({ v: 3, on: true, topics, cond });
  return true;
}

/**
 * 구독 해제 — 서버 삭제 후 기기 구독 해제(서버 실패해도 기기·로컬은 해제, 서버 고아는 발송 시 410·TTL 90일로 정리).
 * keepPrefs=true면 선택한 종류는 보존(끄기), false면 로컬 설정 키 삭제(모든 데이터 삭제).
 */
export async function unsubscribePush(keepPrefs: boolean): Promise<void> {
  try {
    const sub = await getPushSubscription();
    if (sub) {
      await postJson("DELETE", "/api/push/subscribe", { endpoint: sub.endpoint });
      await sub.unsubscribe().catch(() => false);
    }
  } catch {
    /* 무시 — 아래에서 로컬 정리 */
  }
  if (keepPrefs) writePushPrefs({ ...readPushPrefs(), on: false });
  else clearPushPrefs();
}

export type TestResult = "ok" | "cooldown" | "error";

/** 테스트 알림(preview 전용) — 서버에 저장된 내 구독 1건에만 고정 샘플 발송 */
export async function sendTestPush(): Promise<TestResult> {
  const sub = await getPushSubscription();
  if (!sub) return "error";
  const res = await postJson("POST", "/api/push/test", { endpoint: sub.endpoint });
  if (res?.ok) return "ok";
  return res?.status === 429 ? "cooldown" : "error";
}

/**
 * 앱 로드 시 구독 보정 — 실제 기기 구독 유무로 판단한다(로컬 prefs는 보조).
 * 로컬 on + 구독 없음 → 재구독·서버 갱신(만료·교체 보정), 로컬 on + 구독 있음 → 서버 갱신,
 * 로컬 off인데 구독이 남은 고아 → 서버 삭제·기기 구독 해제.
 */
export async function reconcilePush(): Promise<void> {
  if (detectPushEnv() !== "ready" || !VAPID_PUBLIC_KEY || Notification.permission !== "granted") return;
  const prefs = readPushPrefs();
  const reg = await getRegistration();
  if (!reg) return;
  try {
    const existing = await reg.pushManager.getSubscription();
    if (!prefs.on) {
      if (existing) await unsubscribePush(true);
      return;
    }
    const sub =
      existing ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) }));
    await postJson("POST", "/api/push/subscribe", toBody(sub, prefs.topics, prefs.cond));
  } catch {
    /* 다음 로드에서 재시도 */
  }
}
