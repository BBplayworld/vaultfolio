import "server-only";
import webpush from "web-push";
import { getStoreKey } from "./crypto";
import type { PushPayload, PushSubRecord } from "./types";

// web-push 서버 전용 래퍼(#179) — RFC 8291 암호화·VAPID 서명은 라이브러리에 맡긴다.
// 이 파일은 src/app/api/push/** 와 src/lib/push/cron-run.ts에서만 import한다(클라이언트 번들 유입 금지).
// 비밀값·endpoint·키는 로그에 쓰지 않는다(상태 코드만).

export function isPushConfigured(): boolean {
  return Boolean(getStoreKey() && process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY && process.env.VAPID_SUBJECT);
}

let vapidReady = false;
function ensureVapid(): boolean {
  if (vapidReady) return true;
  if (!isPushConfigured()) return false;
  try {
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT as string,
      process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY as string,
      process.env.VAPID_PRIVATE_KEY as string,
    );
    vapidReady = true;
  } catch {
    return false; // 키 형식 오류 — 발송 불가
  }
  return true;
}

export type SendResult = "ok" | "gone" | "fail";

export async function sendPush(sub: PushSubRecord, payload: PushPayload): Promise<SendResult> {
  if (!ensureVapid()) return "fail";
  try {
    await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      JSON.stringify(payload),
      { TTL: 3 * 3600, urgency: "normal" },
    );
    return "ok";
  } catch (e) {
    const status = (e as { statusCode?: number }).statusCode;
    if (status === 404 || status === 410) return "gone";
    console.warn(`[push] 발송 실패 status=${status ?? "n/a"}`);
    return "fail";
  }
}
