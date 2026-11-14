import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";

import {
  getClientIp,
  isCrossSiteRequest,
  guardRequest,
  guardRateLimit,
  parseTickerList,
  isValidTicker,
  cleanText,
  secondsUntilNextHour,
  cdnCacheHeaders,
  reserveGeminiCalls,
  GEMINI_GLOBAL_HOURLY_LIMIT,
  exceedsDailyGlobal,
  RATIO_POOL,
  isRatioEntry,
} from "@/server/api-guard";
import { getCacheStorage } from "@/lib/cache-storage";

// 공개 API 공통 방어 계층 회귀 — 출처·크기·L1·L2·입력검증·Gemini 예약.
// 파일 모드(KV 미설정) 저장소의 메모리 카운터로 동작을 검증한다.

let ipSeq = 0;
const uniqueIp = () => `10.0.${Math.floor(++ipSeq / 250)}.${ipSeq % 250}`;

function req(url: string, headers: Record<string, string> = {}, method = "GET"): Request {
  return new Request(url, { method, headers });
}

describe("getClientIp", () => {
  it("x-vercel-forwarded-for → x-real-ip → XFF 우측 순으로 신뢰한다", () => {
    expect(getClientIp(req("http://a.test/", { "x-vercel-forwarded-for": "1.1.1.1", "x-real-ip": "2.2.2.2" }))).toBe("1.1.1.1");
    expect(getClientIp(req("http://a.test/", { "x-real-ip": "2.2.2.2", "x-forwarded-for": "9.9.9.9" }))).toBe("2.2.2.2");
    // 좌측(클라이언트가 위조 가능한) 값이 아니라 가장 가까운 프록시가 덧붙인 우측 값
    expect(getClientIp(req("http://a.test/", { "x-forwarded-for": "6.6.6.6, 3.3.3.3" }))).toBe("3.3.3.3");
    expect(getClientIp(req("http://a.test/"))).toBe("unknown");
  });
});

describe("isCrossSiteRequest", () => {
  it("Sec-Fetch-Site cross-site/same-site는 차단 대상", () => {
    expect(isCrossSiteRequest(req("http://a.test/api", { "sec-fetch-site": "cross-site" }))).toBe(true);
    expect(isCrossSiteRequest(req("http://a.test/api", { "sec-fetch-site": "same-site" }))).toBe(true);
  });
  it("same-origin·none·헤더 없음(서버·구형 브라우저)은 통과", () => {
    expect(isCrossSiteRequest(req("http://a.test/api", { "sec-fetch-site": "same-origin" }))).toBe(false);
    expect(isCrossSiteRequest(req("http://a.test/api", { "sec-fetch-site": "none" }))).toBe(false);
    expect(isCrossSiteRequest(req("http://a.test/api"))).toBe(false);
  });
  it("Origin 호스트가 요청 호스트와 다르거나 null이면 차단", () => {
    expect(isCrossSiteRequest(req("http://a.test/api", { origin: "https://evil.test", host: "a.test" }))).toBe(true);
    expect(isCrossSiteRequest(req("http://a.test/api", { origin: "null", host: "a.test" }))).toBe(true);
    expect(isCrossSiteRequest(req("http://a.test/api", { origin: "http://a.test", host: "a.test" }))).toBe(false);
  });
});

describe("guardRequest", () => {
  it("cross-site 요청은 403", () => {
    const r = guardRequest(req("http://a.test/api", { "sec-fetch-site": "cross-site" }), { route: "t-origin" });
    expect(r?.status).toBe(403);
  });
  it("본문 상한: Content-Length 없음 411, 초과 413, 이내 통과", () => {
    const policy = { route: "t-body", maxBodyBytes: 100 };
    expect(guardRequest(req("http://a.test/api", { "x-real-ip": uniqueIp() }, "POST"), policy)?.status).toBe(411);
    expect(guardRequest(req("http://a.test/api", { "content-length": "101", "x-real-ip": uniqueIp() }, "POST"), policy)?.status).toBe(413);
    expect(guardRequest(req("http://a.test/api", { "content-length": "100", "x-real-ip": uniqueIp() }, "POST"), policy)).toBeNull();
  });
  it("L1 버킷: 분당 한도 초과 시 429 + Retry-After", () => {
    const ip = uniqueIp();
    const policy = { route: "t-l1", l1PerMinute: 3 };
    for (let i = 0; i < 3; i++) expect(guardRequest(req("http://a.test/api", { "x-real-ip": ip }), policy)).toBeNull();
    const blocked = guardRequest(req("http://a.test/api", { "x-real-ip": ip }), policy);
    expect(blocked?.status).toBe(429);
    expect(blocked?.headers.get("Retry-After")).toBeTruthy();
    // 다른 IP는 영향 없음
    expect(guardRequest(req("http://a.test/api", { "x-real-ip": uniqueIp() }), policy)).toBeNull();
  });
});

describe("guardRateLimit (메모리 버킷, Redis 미사용)", () => {
  it("한도 초과 시 429 — Redis 카운터를 건드리지 않는다", async () => {
    const spy = vi.spyOn(Object.getPrototypeOf(getCacheStorage()), "incrementCounter");
    const calls = spy.mock.calls.length;
    const r = req("http://a.test/api", { "x-real-ip": uniqueIp() });
    expect(await guardRateLimit(r, "t-l2", 2, 60)).toBeNull();
    expect(await guardRateLimit(r, "t-l2", 2, 60)).toBeNull();
    expect((await guardRateLimit(r, "t-l2", 2, 60))?.status).toBe(429);
    expect(spy.mock.calls.length).toBe(calls);
    spy.mockRestore();
  });
  it("창이 1분보다 긴 라우트는 분당 환산(최소 3회)으로 적용", async () => {
    const r = req("http://a.test/api", { "x-real-ip": uniqueIp() });
    for (let i = 0; i < 3; i++) expect(await guardRateLimit(r, "t-long", 5, 600)).toBeNull();
    expect((await guardRateLimit(r, "t-long", 5, 600))?.status).toBe(429);
  });
  it("라우트 버킷이 서로 독립(피드백 스팸이 다른 라우트를 막지 않음)", async () => {
    const r = req("http://a.test/api", { "x-real-ip": uniqueIp() });
    expect(await guardRateLimit(r, "t-a", 1, 60)).toBeNull();
    expect((await guardRateLimit(r, "t-a", 1, 60))?.status).toBe(429);
    expect(await guardRateLimit(r, "t-b", 1, 60)).toBeNull();
  });
});

describe("입력 검증", () => {
  it("티커 형식: 쿼리 구분자·글롭·공백 차단, 기존 형식 허용", () => {
    for (const ok of ["AAPL", "BRK.B", "BF-B", "005930", "Q500VK", "brk.b"]) expect(isValidTicker(ok)).toBe(true);
    for (const bad of ["AAPL&X=1", "A*", "A?", "A#", "A B", "A%20", "", "X".repeat(21)]) expect(isValidTicker(bad)).toBe(false);
  });
  it("parseTickerList: 중복 제거·형식 위반 제외·max 절단", () => {
    expect(parseTickerList("AAPL, AAPL,TSLA&x=1,MSFT,NVDA", 3)).toEqual(["AAPL", "MSFT", "NVDA"]);
    expect(parseTickerList(null, 3)).toEqual([]);
    expect(parseTickerList("*,?", 3)).toEqual([]);
  });
  it("cleanText: 제어문자 제거·길이 상한·비문자열 undefined", () => {
    expect(cleanText("a\nb\u0000c", 10)).toBe("a b c");
    expect(cleanText("x".repeat(50), 40)).toHaveLength(40);
    expect(cleanText(123, 10)).toBeUndefined();
    expect(cleanText("   ", 10)).toBeUndefined();
  });
});

describe("CDN 캐시 헤더", () => {
  it("Vercel CDN 전용 헤더만 설정(브라우저 Cache-Control 미변경)", () => {
    const h = cdnCacheHeaders(120, 30);
    expect(h["Vercel-CDN-Cache-Control"]).toBe("max-age=120, stale-while-revalidate=30");
    expect(h["Cache-Control"]).toBeUndefined();
  });
  it("secondsUntilNextHour는 1~3600 범위", () => {
    expect(secondsUntilNextHour(Date.UTC(2026, 0, 1, 3, 0, 0))).toBe(3600);
    expect(secondsUntilNextHour(Date.UTC(2026, 0, 1, 3, 59, 59))).toBe(1);
  });
});

// Redis에 쓰는 모든 키를 수집 — IP가 들어간 키가 0인지 단언한다
function recordKeys() {
  const keys: string[] = [];
  const proto = Object.getPrototypeOf(getCacheStorage());
  const orig = proto.incrementCounter;
  const spy = vi.spyOn(proto, "incrementCounter").mockImplementation(function (this: unknown, key: string, by: number, ttl: number) {
    keys.push(key);
    return orig.call(this, key, by, ttl);
  });
  return { keys, spy };
}
const hourKeyNow = () => `rl:gemini:global:${new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 13).replace(/\D/g, "")}`;
const todayKst = () => new Date(Date.now() + 9 * 3600_000).toISOString().split("T")[0];
async function resetCounter(key: string) {
  const storage = getCacheStorage();
  const used = await storage.incrementCounter(key, 0, 3600);
  if (used !== 0) await storage.incrementCounter(key, -used, 3600);
}

describe("reserveGeminiCalls (IP 없는 한도)", () => {
  afterEach(() => vi.restoreAllMocks());
  beforeEach(async () => { await resetCounter(hourKeyNow()); });

  it("시간당 전역 상한 초과 시 429이고 카운터는 롤백된다", async () => {
    const r = req("http://a.test/api", { "x-real-ip": uniqueIp() });
    const storage = getCacheStorage();
    vi.spyOn(Object.getPrototypeOf(storage), "reserveGeminiDaily").mockResolvedValue(1);
    expect(await reserveGeminiCalls(r, GEMINI_GLOBAL_HOURLY_LIMIT, "limit")).toBeNull();
    const denied = await reserveGeminiCalls(r, 1, "limit");
    expect(denied?.status).toBe(429);
    expect(await denied?.json()).toEqual({ error: "limit" });
    // 롤백 확인: 직전 실패분이 남지 않아 상한 그대로(150) 기록
    expect(await storage.incrementCounter(hourKeyNow(), 0, 3600)).toBe(GEMINI_GLOBAL_HOURLY_LIMIT);
  });

  it("다른 IP도 같은 전역 카운터를 공유한다(IP로 구분하지 않음)", async () => {
    const storage = getCacheStorage();
    vi.spyOn(Object.getPrototypeOf(storage), "reserveGeminiDaily").mockResolvedValue(1);
    await reserveGeminiCalls(req("http://a.test/api", { "x-real-ip": uniqueIp() }), 100, "limit");
    await reserveGeminiCalls(req("http://a.test/api", { "x-real-ip": uniqueIp() }), 50, "limit");
    expect((await reserveGeminiCalls(req("http://a.test/api", { "x-real-ip": uniqueIp() }), 1, "limit"))?.status).toBe(429);
  });

  it("일 전역 예약 실패(null) 시 429이고 시간당 카운터가 되돌려진다", async () => {
    const storage = getCacheStorage();
    vi.spyOn(Object.getPrototypeOf(storage), "reserveGeminiDaily").mockResolvedValue(null);
    expect((await reserveGeminiCalls(req("http://a.test/api"), 1, "limit"))?.status).toBe(429);
    expect(await storage.incrementCounter(hourKeyNow(), 0, 3600)).toBe(0);
  });

  it("일 전역 한도는 1500 그대로 전달(HEAVY 차등 없음)", async () => {
    const storage = getCacheStorage();
    const spy = vi.spyOn(Object.getPrototypeOf(storage), "reserveGeminiDaily").mockResolvedValue(1);
    for (let i = 0; i < 7; i++) await reserveGeminiCalls(req("http://a.test/api", { "x-real-ip": "9.9.9.9" }), 1, "limit");
    expect(new Set(spy.mock.calls.map((c) => c[2]))).toEqual(new Set([1500]));
  });

  it("Redis 키 패턴: IP가 들어간 키 0 — rl:gemini:global:{시} 와 일 전역만", async () => {
    const ip = "203.0.113.77";
    const { keys } = recordKeys();
    const storage = getCacheStorage();
    vi.spyOn(Object.getPrototypeOf(storage), "reserveGeminiDaily").mockResolvedValue(1);
    const r = req("http://a.test/api", { "x-real-ip": ip, "x-forwarded-for": ip });
    await guardRateLimit(r, "t-keys", 5, 60);
    await reserveGeminiCalls(r, 1, "limit");
    await exceedsDailyGlobal("t-keys", 10);
    expect(keys.length).toBeGreaterThan(0);
    for (const k of keys) {
      expect(k).not.toContain(ip);
      expect(k).toMatch(/^rl:(gemini:global:\d{10}|gemini-ratio:\d{4}-\d{2}-\d{2}|t-keys:global:\d{4}-\d{2}-\d{2})$/);
    }
  });
});

describe("exceedsDailyGlobal", () => {
  it("한도 초과 시 true, 키는 rl:{name}:global:{날짜}", async () => {
    const { keys } = recordKeys();
    const name = `t-glob-${Date.now()}`;
    expect(await exceedsDailyGlobal(name, 2)).toBe(false);
    expect(await exceedsDailyGlobal(name, 2)).toBe(false);
    expect(await exceedsDailyGlobal(name, 2)).toBe(true);
    expect(keys[0]).toBe(`rl:${name}:global:${todayKst()}`);
    vi.restoreAllMocks();
  });
});

describe("reserveGeminiCalls — /ratio 입구 풀", () => {
  afterEach(() => vi.restoreAllMocks());
  const MSG = "마감";
  beforeEach(async () => {
    await resetCounter(`rl:gemini-ratio:${todayKst()}`);
    await resetCounter(hourKeyNow());
  });

  it("isRatioEntry: entry 표시 또는 Referer 경로 /ratio(슬래시·쿼리 허용), /ratio-x·파싱 실패는 false", () => {
    expect(isRatioEntry(req("http://a.test/api"), "ratio")).toBe(true);
    expect(isRatioEntry(req("http://a.test/api", { referer: "https://x.test/ratio?utm_source=a" }))).toBe(true);
    expect(isRatioEntry(req("http://a.test/api", { referer: "https://x.test/ratio/" }))).toBe(true);
    expect(isRatioEntry(req("http://a.test/api", { referer: "https://x.test/ratio-x" }))).toBe(false);
    expect(isRatioEntry(req("http://a.test/api", { referer: "not a url" }))).toBe(false);
    expect(isRatioEntry(req("http://a.test/api"), "other")).toBe(false);
  });

  it("입구 전역 60회 초과의 61번째는 429이고 시간당 카운터가 되돌려진다", async () => {
    const storage = getCacheStorage();
    vi.spyOn(Object.getPrototypeOf(storage), "reserveGeminiDaily").mockResolvedValue(1);
    for (let i = 0; i < RATIO_POOL.dailyLimit; i++) {
      expect(await reserveGeminiCalls(req("http://a.test/api"), 1, MSG, RATIO_POOL)).toBeNull();
    }
    const denied = await reserveGeminiCalls(req("http://a.test/api"), 1, MSG, RATIO_POOL);
    expect(denied?.status).toBe(429);
    expect(await denied?.json()).toEqual({ error: MSG });
    expect(await storage.incrementCounter(hourKeyNow(), 0, 3600)).toBe(RATIO_POOL.dailyLimit);
  });

  it("일 전역 예약 실패 시 입구 카운터까지 되돌려진다", async () => {
    const storage = getCacheStorage();
    const spy = vi.spyOn(Object.getPrototypeOf(storage), "reserveGeminiDaily").mockResolvedValue(null);
    for (let i = 0; i < RATIO_POOL.dailyLimit + 2; i++) {
      expect((await reserveGeminiCalls(req("http://a.test/api"), 1, MSG, RATIO_POOL))?.status).toBe(429);
    }
    spy.mockResolvedValue(1);
    expect(await reserveGeminiCalls(req("http://a.test/api"), 1, MSG, RATIO_POOL)).toBeNull();
  });
});

describe("라우트 L1 한도 — Gemini 라우트 분당 5회", () => {
  it("parse-screenshot·xray-classify 라우트 정책이 l1PerMinute: 5", async () => {
    const { readFileSync } = await import("fs");
    for (const f of ["src/app/api/parse-screenshot/route.ts", "src/app/api/xray-classify/route.ts"]) {
      expect(readFileSync(f, "utf8")).toMatch(/l1PerMinute: 5 \}/);
    }
  });
});
