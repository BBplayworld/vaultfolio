import "server-only";

import { NextResponse } from "next/server";

import { getCacheStorage, GEMINI_SERVER_DAILY_LIMIT } from "@/lib/cache-storage";

/**
 * 공개 API 공통 방어 계층 (서버 전용)
 *
 * 처리 순서 — 비용이 싼 단계에서 먼저 끊어 함수 시간·Redis·외부 API 소비를 최소화한다.
 *   1) 출처 검사(cross-site 브라우저 요청 차단 — 악성 페이지가 방문자 브라우저를 동원하는 분산 호출 방지)
 *   2) 본문 크기 상한(파싱 전 Content-Length)
 *   3) L1 인스턴스 메모리 버킷(Redis 호출 전 폭주 IP 차단)
 *   — 이후 라우트가 입력 검증·캐시 히트 반환을 수행 —
 *   4) L2 Redis rate limit(캐시 미스로 외부 호출이 필요한 경우만)
 *   5) 업스트림 전역 예산(초과 시 외부 호출 생략 → 기존 "일시 오류" 응답 경로로 우아한 저하)
 *
 * sync 라우트는 이 모듈을 사용하지 않는다(동기화 로직 무변경 원칙).
 */

// ─────────────────────────────────────────────────────────
// 클라이언트 IP — Vercel이 주입하는 헤더 우선. XFF는 가장 오른쪽(가장 가까운 프록시가 덧붙인) 값만 신뢰
// ─────────────────────────────────────────────────────────

export function getClientIp(request: Request): string {
  const vercel = request.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim();
  if (vercel) return vercel;
  const real = request.headers.get("x-real-ip")?.trim();
  if (real) return real;
  const xff = request.headers.get("x-forwarded-for");
  if (xff) {
    const parts = xff.split(",").map((p) => p.trim()).filter(Boolean);
    if (parts.length > 0) return parts[parts.length - 1];
  }
  return "unknown";
}

// ─────────────────────────────────────────────────────────
// 응답 헬퍼
// ─────────────────────────────────────────────────────────

const NO_STORE = { "Cache-Control": "private, no-store" } as const;

export function badRequest(message = "잘못된 요청입니다."): NextResponse {
  return NextResponse.json({ error: message }, { status: 400, headers: NO_STORE });
}

function tooMany(retryAfterSec: number, message = "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요."): NextResponse {
  return NextResponse.json(
    { error: message },
    { status: 429, headers: { ...NO_STORE, "Retry-After": String(Math.max(1, Math.ceil(retryAfterSec))) } },
  );
}

/**
 * Vercel 엣지(CDN) 전용 캐시 헤더 — 같은 URL이면 모든 사용자에게 같은 응답인 공개 데이터에만 사용.
 * 반복 공격 트래픽을 CDN이 흡수해 함수·Redis·외부 API 호출이 0이 된다. 브라우저 캐시 정책은 바꾸지 않는다.
 */
export function cdnCacheHeaders(maxAgeSec: number, swrSec = 60): Record<string, string> {
  const age = Math.max(1, Math.floor(maxAgeSec));
  return { "Vercel-CDN-Cache-Control": `max-age=${age}, stale-while-revalidate=${Math.max(0, Math.floor(swrSec))}` };
}

/** 다음 정시(UTC=KST 동일 분 경계)까지 남은 초 — 1시간 슬롯 캐시 데이터의 CDN 수명 */
export function secondsUntilNextHour(now = Date.now()): number {
  return Math.max(1, 3600 - Math.floor((now % 3_600_000) / 1000));
}

// ─────────────────────────────────────────────────────────
// 입력 검증
// ─────────────────────────────────────────────────────────

// 티커 허용 문자 — URL·쿼리 구분자(& ? # % =)·공백·글롭(* [ ])·제어문자 차단. 기존 형식(BRK.B, BF-B, 국내 6자리, 접두 ":") 유지
const TICKER_RE = /^[A-Za-z0-9.\-:/_]{1,20}$/;

export function isValidTicker(t: string): boolean {
  return TICKER_RE.test(t);
}

/**
 * 콤마 리스트 → trim·중복 제거·형식 위반 항목 제외·max개로 절단(대소문자는 호출부 규칙 유지).
 * 형식 위반 티커는 정상 티커까지 실패시키지 않도록 요청 전체 거부 대신 제외한다.
 */
export function parseTickerList(raw: string | null, max: number): string[] {
  if (!raw) return [];
  const list = Array.from(new Set(raw.split(",").map((t) => t.trim()).filter(Boolean)));
  return list.filter(isValidTicker).slice(0, max);
}

export function isOneOf<T extends string>(value: string | null, allowed: readonly T[]): value is T {
  return value !== null && (allowed as readonly string[]).includes(value);
}

/** 문자열 정리 — 제어문자 제거 + 길이 상한. 문자열이 아니면 undefined */
export function cleanText(value: unknown, max: number): string | undefined {
  if (typeof value !== "string") return undefined;
  // eslint-disable-next-line no-control-regex
  const v = value.replace(/[\u0000-\u001f\u007f]/g, " ").trim();
  return v ? v.slice(0, max) : undefined;
}

// ─────────────────────────────────────────────────────────
// 1~3단계: 동기 사전 검사
// ─────────────────────────────────────────────────────────

export interface GuardPolicy {
  /** rate limit 키 네임스페이스 */
  route: string;
  /** POST 본문 상한(바이트). 지정 시 Content-Length 필수 */
  maxBodyBytes?: number;
  /** L1(인스턴스 메모리) 분당 허용 횟수 — L2보다 넉넉하게 */
  l1PerMinute?: number;
}

const L1_MAX_ENTRIES = 5000;
const l1Buckets = new Map<string, { count: number; resetAt: number }>();

function hitL1(key: string, limit: number): boolean {
  const now = Date.now();
  let b = l1Buckets.get(key);
  if (!b || b.resetAt <= now) {
    if (l1Buckets.size >= L1_MAX_ENTRIES) {
      // 만료 항목 정리 후에도 꽉 차면 가장 오래된 항목부터 제거(Map 삽입 순서)
      for (const [k, v] of l1Buckets) if (v.resetAt <= now) l1Buckets.delete(k);
      while (l1Buckets.size >= L1_MAX_ENTRIES) {
        const first = l1Buckets.keys().next().value;
        if (first === undefined) break;
        l1Buckets.delete(first);
      }
    }
    b = { count: 0, resetAt: now + 60_000 };
    l1Buckets.set(key, b);
  }
  b.count += 1;
  return b.count <= limit;
}

/** cross-site 브라우저 요청 여부 — Sec-Fetch-Site/Origin이 있을 때만 판정(헤더 없는 구형 브라우저·서버 호출은 통과) */
export function isCrossSiteRequest(request: Request): boolean {
  const site = request.headers.get("sec-fetch-site");
  if (site === "cross-site" || site === "same-site") return true;
  const origin = request.headers.get("origin");
  if (origin && origin !== "null") {
    const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
    try {
      if (host && new URL(origin).host !== host) return true;
    } catch {
      return true;
    }
  }
  if (origin === "null") return true;
  return false;
}

/** 출처·크기·L1 검사. 통과 시 null, 차단 시 응답 반환 */
export function guardRequest(request: Request, policy: GuardPolicy): NextResponse | null {
  if (isCrossSiteRequest(request)) {
    return NextResponse.json({ error: "허용되지 않은 요청입니다." }, { status: 403, headers: NO_STORE });
  }
  if (policy.maxBodyBytes !== undefined) {
    const len = Number(request.headers.get("content-length"));
    if (!Number.isFinite(len) || len <= 0) {
      return NextResponse.json({ error: "요청 본문 길이가 필요합니다." }, { status: 411, headers: NO_STORE });
    }
    if (len > policy.maxBodyBytes) {
      return NextResponse.json({ error: "요청 본문이 너무 큽니다." }, { status: 413, headers: NO_STORE });
    }
  }
  const ip = getClientIp(request);
  // 식별 불가 IP는 공용 버킷이라 한도를 낮춰 단일 버킷 고갈 영향을 줄인다
  const l1Limit = policy.l1PerMinute ?? 120;
  if (!hitL1(`${policy.route}:${ip}`, ip === "unknown" ? Math.ceil(l1Limit / 4) : l1Limit)) {
    return tooMany(60);
  }
  return null;
}

// ─────────────────────────────────────────────────────────
// 4단계: L2 Redis rate limit
// ─────────────────────────────────────────────────────────

/** IP 단위 L2 rate limit(rl:{route}:{ip}). Redis 장애 시 통과(fail-open) — L1·플랫폼 방화벽이 1차 방어 */
export async function guardRateLimit(
  request: Request,
  route: string,
  limit: number,
  windowSec: number,
): Promise<NextResponse | null> {
  const ip = getClientIp(request);
  try {
    const count = await getCacheStorage().incrementCounter(`rl:${route}:${ip}`, 1, windowSec);
    if (count > (ip === "unknown" ? Math.ceil(limit / 4) : limit)) return tooMany(windowSec);
  } catch (e) {
    console.warn("[api-guard] rate limit 저장소 오류:", e instanceof Error ? e.message : e);
  }
  return null;
}

// ─────────────────────────────────────────────────────────
// 5단계: 업스트림 전역 예산
// ─────────────────────────────────────────────────────────

/** 업스트림별 분당 전역 예산(전 사용자 합산). 외부 API 키 정지·과금 폭주 방지 상한 */
export const UPSTREAM_BUDGET_PER_MINUTE = {
  kis: 900,
  molit: 120,
  kakao: 120,
  logo: 300,
} as const;

export type Upstream = keyof typeof UPSTREAM_BUDGET_PER_MINUTE;

/** weight만큼 예산 차감 후 한도 이내면 true. 초과 시 false → 라우트는 외부 호출 없이 기존 '일시 오류' 응답 */
export async function withinUpstreamBudget(upstream: Upstream, weight = 1): Promise<boolean> {
  const minute = Math.floor(Date.now() / 60_000);
  try {
    const used = await getCacheStorage().incrementCounter(`budget:${upstream}:${minute}`, weight, 120);
    if (used > UPSTREAM_BUDGET_PER_MINUTE[upstream]) {
      console.warn(`[api-guard] 업스트림 예산 초과: ${upstream} used=${used}`);
      return false;
    }
  } catch (e) {
    console.warn("[api-guard] 예산 저장소 오류:", e instanceof Error ? e.message : e);
  }
  return true;
}

// ─────────────────────────────────────────────────────────
// Gemini 호출 예약 (parse-screenshot·xray-classify 공용)
// ─────────────────────────────────────────────────────────

/** IP당 하루 Gemini 호출 상한 */
export const GEMINI_PER_IP_DAILY_LIMIT = 30;
/** 이미 하루 LIGHT_USER_CALLS회 넘게 쓴 IP는 전역 한도의 HEAVY_POOL_RATIO까지만 사용 — 나머지는 다른 사용자 몫으로 예약 */
const LIGHT_USER_CALLS = 5;
const HEAVY_POOL_RATIO = 0.7;

function kstDateStr(now = Date.now()): string {
  return new Date(now + 9 * 3600 * 1000).toISOString().split("T")[0];
}

function secondsUntilKstMidnight(now = Date.now()): number {
  const kstMs = now + 9 * 3600 * 1000;
  return Math.max(60, 86400 - Math.floor((kstMs % 86_400_000) / 1000));
}

/**
 * 외부 호출 전 n회분 원자 예약. 통과 시 null, 차단 시 429 응답.
 * 실패한 호출도 차감된다(비용은 이미 발생) — 실패 반복으로 한도를 우회하지 못하게 한다.
 */
export async function reserveGeminiCalls(
  request: Request,
  n: number,
  limitMessage: string,
): Promise<NextResponse | null> {
  const storage = getCacheStorage();
  const today = kstDateStr();
  const ip = getClientIp(request);
  const ttl = secondsUntilKstMidnight();

  const ipUsed = await storage.incrementCounter(`rl:gemini:${ip}:${today}`, n, ttl);
  if (ipUsed > GEMINI_PER_IP_DAILY_LIMIT) {
    await storage.incrementCounter(`rl:gemini:${ip}:${today}`, -n, ttl);
    return tooMany(ttl, limitMessage);
  }
  const heavy = ipUsed - n >= LIGHT_USER_CALLS;
  const effectiveLimit = heavy ? Math.floor(GEMINI_SERVER_DAILY_LIMIT * HEAVY_POOL_RATIO) : GEMINI_SERVER_DAILY_LIMIT;
  const reserved = await storage.reserveGeminiDaily(today, n, effectiveLimit);
  if (reserved === null) {
    await storage.incrementCounter(`rl:gemini:${ip}:${today}`, -n, ttl);
    return tooMany(ttl, limitMessage);
  }
  return null;
}
