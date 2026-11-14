import "server-only";

import { NextResponse } from "next/server";

import { getCacheStorage, GEMINI_SERVER_DAILY_LIMIT } from "@/lib/cache-storage";

/**
 * 공개 API 공통 방어 계층 (서버 전용)
 *
 * 처리 순서 — 비용이 싼 단계에서 먼저 끊어 함수 시간·Redis·외부 API 소비를 최소화한다.
 *   1) 출처 검사(cross-site 브라우저 요청 차단 — 악성 페이지가 방문자 브라우저를 동원하는 분산 호출 방지)
 *   2) 본문 크기 상한(파싱 전 Content-Length)
 *   3) L1 인스턴스 메모리 버킷(폭주 IP 차단)
 *   — 이후 라우트가 입력 검증·캐시 히트 반환을 수행 —
 *   4) 라우트별 빈도 한도(guardRateLimit) — 5.113부터 L1과 같은 메모리 버킷
 *   5) 업스트림 전역 예산(초과 시 외부 호출 생략 → 기존 "일시 오류" 응답 경로로 우아한 저하)
 *
 * IP 미저장(5.113): IP는 휘발성 메모리 버킷 키로만 쓰고(수명 ≤ 1분·최대 L1_MAX_ENTRIES개, 로그·Redis·직렬화 0),
 * Redis에는 IP가 들어간 키(rl:*:ip 등)를 만들지 않는다. IP 없는 전역·금고별 한도는 Redis 카운터로 둔다.
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

const L1_SWEEP_INTERVAL_MS = 10_000;
let l1LastSweep = 0;

/** 만료된 L1 버킷 제거 — 버킷 수명 ≤ 창(1분) 보장. 호출 시점에 10초 간격으로 쓸어 낸다 */
function sweepL1(now: number): void {
  if (now - l1LastSweep < L1_SWEEP_INTERVAL_MS) return;
  l1LastSweep = now;
  for (const [k, v] of l1Buckets) if (v.resetAt <= now) l1Buckets.delete(k);
}

/** 테스트 전용 — 현재 L1 항목 수 */
export function l1SizeForTest(): number {
  return l1Buckets.size;
}

function hitL1(key: string, limit: number, windowMs = 60_000): boolean {
  const now = Date.now();
  sweepL1(now);
  let b = l1Buckets.get(key);
  if (b && b.resetAt <= now) {
    l1Buckets.delete(key);
    b = undefined;
  }
  if (!b) {
    // 만료 항목은 위에서 쓸어 냈으므로 꽉 차면 가장 오래된 항목부터 제거(Map 삽입 순서)
    while (l1Buckets.size >= L1_MAX_ENTRIES) {
      const first = l1Buckets.keys().next().value;
      if (first === undefined) break;
      l1Buckets.delete(first);
    }
    b = { count: 0, resetAt: now + windowMs };
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

/** L1(인스턴스 메모리) 한도만 검사 — 출처·본문 검사 없음(sync처럼 서명 인증 라우트용). 통과 시 null */
export function guardL1Only(request: Request, route: string, l1PerMinute: number): NextResponse | null {
  const ip = getClientIp(request);
  if (!hitL1(`${route}:${ip}`, ip === "unknown" ? Math.ceil(l1PerMinute / 4) : l1PerMinute)) return tooMany(60);
  return null;
}

// ─────────────────────────────────────────────────────────
// 4단계: L2 Redis rate limit
// ─────────────────────────────────────────────────────────

/**
 * 라우트별 빈도 한도 — IP를 Redis에 쓰지 않고 L1 메모리 버킷(창 ≤ 1분)으로 판정한다.
 * 창이 1분보다 긴 라우트(feedback·push)는 분당 환산 한도(최소 3회)로 낮춰 적용한다. 인스턴스별 한도라 전역 보장은 아니다.
 * 비용이 큰 라우트의 전역 방어는 업스트림 예산·Gemini 전역 한도·share 일 전역 상한이 맡는다.
 */
export async function guardRateLimit(
  request: Request,
  route: string,
  limit: number,
  windowSec: number,
): Promise<NextResponse | null> {
  const perMinute = windowSec <= 60 ? limit : Math.max(3, Math.ceil((limit * 60) / windowSec));
  const ip = getClientIp(request);
  if (!hitL1(`rl-mem:${route}:${ip}`, ip === "unknown" ? Math.ceil(perMinute / 4) : perMinute)) return tooMany(Math.min(windowSec, 60));
  return null;
}

/** sync: 금고 id(가명 식별자)별 분당 쓰기 한도 — 정상 기기는 디바운스 push라 분당 1~2회 */
export const SYNC_PUT_PER_VAULT_PER_MINUTE = 20;
/** sync: 하루 전역 신규 금고 등록 상한(KST) */
export const SYNC_NEW_VAULT_DAILY_LIMIT = 1000;
/** share: 하루 전역 공유 저장 상한(KST) */
export const SHARE_POST_DAILY_LIMIT = 5000;

/** IP 없는 전역 일 상한 — 키 `rl:{name}:global:{KST 날짜}`. 초과하면 true. Redis 장애 시 통과(false) */
export async function exceedsDailyGlobal(name: string, limit: number): Promise<boolean> {
  try {
    const used = await getCacheStorage().incrementCounter(`rl:${name}:global:${kstDateStr()}`, 1, secondsUntilKstMidnight());
    return used > limit;
  } catch (e) {
    console.warn("[api-guard] 전역 한도 저장소 오류:", e instanceof Error ? e.message : e);
    return false;
  }
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

/** IP 없는 시간당 전역 Gemini 상한 — 한 공격자가 일 전역 한도를 다 써도 정지가 그 시간대로 한정되게 한다 */
export const GEMINI_GLOBAL_HOURLY_LIMIT = 150;

function kstDateStr(now = Date.now()): string {
  return new Date(now + 9 * 3600 * 1000).toISOString().split("T")[0];
}

function secondsUntilKstMidnight(now = Date.now()): number {
  const kstMs = now + 9 * 3600 * 1000;
  return Math.max(60, 86400 - Math.floor((kstMs % 86_400_000) / 1000));
}

/** 비중 미리보기(/ratio) 입구 전용 풀 한도 — 앱 사용자 몫(전역 1500 중 1440)을 보호 */
export const RATIO_POOL = { name: "ratio", dailyLimit: 60 } as const;

export interface GeminiPool {
  name: "ratio";
  dailyLimit: number;
}

/** 입구 판정: entry 표시가 "ratio"이거나 Referer 경로가 /ratio(말미 슬래시 허용). 파싱 실패는 false */
export function isRatioEntry(request: Request, entry?: unknown): boolean {
  if (entry === "ratio") return true;
  const referer = request.headers.get("referer");
  if (!referer) return false;
  try {
    return new URL(referer).pathname.replace(/\/$/, "") === "/ratio";
  } catch {
    return false;
  }
}

/**
 * 외부 호출 전 n회분 원자 예약. 통과 시 null, 차단 시 429 응답.
 * 실패한 호출도 차감된다(비용은 이미 발생) — 실패 반복으로 한도를 우회하지 못하게 한다.
 * 1인당 30회는 기기(localStorage, use-gemini-usage) 기준이다. 서버는 IP 없는 한도만 쓴다.
 * 순서: 시간당 전역 → (pool) 입구 전역 → 일 전역. 실패하면 앞 단계를 전부 -n으로 되돌린다.
 */
export async function reserveGeminiCalls(
  request: Request,
  n: number,
  limitMessage: string,
  pool?: GeminiPool,
): Promise<NextResponse | null> {
  void request; // IP를 읽지 않는다(5.113)
  const storage = getCacheStorage();
  const now = Date.now();
  const today = kstDateStr(now);
  const ttl = secondsUntilKstMidnight(now);

  const hourKey = `rl:gemini:global:${new Date(now + 9 * 3600 * 1000).toISOString().slice(0, 13).replace(/\D/g, "")}`;
  const poolKey = pool ? `rl:gemini-${pool.name}:${today}` : "";
  const done: { key: string; ttl: number }[] = [];
  const rollback = async () => {
    for (const d of done) await storage.incrementCounter(d.key, -n, d.ttl);
  };

  const hourUsed = await storage.incrementCounter(hourKey, n, 3600 + 60);
  done.push({ key: hourKey, ttl: 3660 });
  if (hourUsed > GEMINI_GLOBAL_HOURLY_LIMIT) {
    await rollback();
    return tooMany(secondsUntilNextHour(now), limitMessage);
  }
  if (pool) {
    const poolUsed = await storage.incrementCounter(poolKey, n, ttl);
    done.push({ key: poolKey, ttl });
    if (poolUsed > pool.dailyLimit) {
      await rollback();
      return tooMany(ttl, limitMessage);
    }
  }
  const reserved = await storage.reserveGeminiDaily(today, n, GEMINI_SERVER_DAILY_LIMIT);
  if (reserved === null) {
    await rollback();
    return tooMany(ttl, limitMessage);
  }
  return null;
}
