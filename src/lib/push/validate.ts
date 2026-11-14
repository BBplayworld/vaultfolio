import type { PushCond } from "./types";
import { PUSH_MAX_TOPICS, PUSH_TOPIC_IDS } from "./catalog";

// 구독 요청 본문 검증(#179) — 순수 함수. 카탈로그 ID·cond 2값·허용 푸시 호스트만 통과.

const ALLOWED_HOSTS = [
  /^fcm\.googleapis\.com$/,
  /^updates\.push\.services\.mozilla\.com$/,
  /(^|\.)push\.services\.mozilla\.com$/,
  /(^|\.)push\.apple\.com$/,
  /(^|\.)notify\.windows\.com$/,
];
const B64URL = /^[A-Za-z0-9_-]+={0,2}$/;

export function isAllowedPushEndpoint(endpoint: unknown): endpoint is string {
  if (typeof endpoint !== "string" || endpoint.length > 600) return false;
  try {
    const u = new URL(endpoint);
    return u.protocol === "https:" && ALLOWED_HOSTS.some((re) => re.test(u.hostname));
  } catch {
    return false;
  }
}

export interface SubscribeBody {
  endpoint: string;
  p256dh: string;
  auth: string;
  topics: string[];
  cond: PushCond;
}

export function parseSubscribeBody(raw: unknown): SubscribeBody | null {
  if (!raw || typeof raw !== "object") return null;
  const b = raw as Record<string, unknown>;
  if (!isAllowedPushEndpoint(b.endpoint)) return null;
  if (typeof b.p256dh !== "string" || b.p256dh.length < 20 || b.p256dh.length > 200 || !B64URL.test(b.p256dh)) return null;
  if (typeof b.auth !== "string" || b.auth.length < 8 || b.auth.length > 100 || !B64URL.test(b.auth)) return null;
  // 설치된 앱(standalone)에서만 구독 — 클라이언트 게이트가 주 방어, 서버는 플래그 없으면 거부(위조는 막지 못함)
  if (b.standalone !== true) return null;
  if (b.cond !== "daily" && b.cond !== "pm2") return null;
  if (!Array.isArray(b.topics) || b.topics.length < 1 || b.topics.length > PUSH_MAX_TOPICS) return null;
  if (!b.topics.every((t) => typeof t === "string" && PUSH_TOPIC_IDS.includes(t))) return null;
  if (new Set(b.topics).size !== b.topics.length) return null;
  return { endpoint: b.endpoint, p256dh: b.p256dh, auth: b.auth, topics: b.topics as string[], cond: b.cond };
}

export function parseEndpointBody(raw: unknown): string | null {
  if (!raw || typeof raw !== "object") return null;
  const e = (raw as Record<string, unknown>).endpoint;
  return isAllowedPushEndpoint(e) ? e : null;
}
