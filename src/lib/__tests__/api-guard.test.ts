import { describe, it, expect, afterEach, vi } from "vitest";

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
  GEMINI_PER_IP_DAILY_LIMIT,
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

describe("guardRateLimit (L2)", () => {
  it("rl:{route}:{ip} 버킷으로 한도 초과 시 429", async () => {
    const r = req("http://a.test/api", { "x-real-ip": uniqueIp() });
    expect(await guardRateLimit(r, "t-l2", 2, 60)).toBeNull();
    expect(await guardRateLimit(r, "t-l2", 2, 60)).toBeNull();
    expect((await guardRateLimit(r, "t-l2", 2, 60))?.status).toBe(429);
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

describe("reserveGeminiCalls", () => {
  afterEach(() => vi.restoreAllMocks());

  it("IP 일 한도를 넘으면 429이고 IP 카운터는 롤백된다", async () => {
    const r = req("http://a.test/api", { "x-real-ip": uniqueIp() });
    const storage = getCacheStorage();
    vi.spyOn(Object.getPrototypeOf(storage), "reserveGeminiDaily").mockResolvedValue(1);
    expect(await reserveGeminiCalls(r, GEMINI_PER_IP_DAILY_LIMIT, "limit")).toBeNull();
    const denied = await reserveGeminiCalls(r, 1, "limit");
    expect(denied?.status).toBe(429);
    expect(await denied?.json()).toEqual({ error: "limit" });
  });

  it("전역 예약 실패(null) 시 429", async () => {
    const r = req("http://a.test/api", { "x-real-ip": uniqueIp() });
    const storage = getCacheStorage();
    vi.spyOn(Object.getPrototypeOf(storage), "reserveGeminiDaily").mockResolvedValue(null);
    expect((await reserveGeminiCalls(r, 1, "limit"))?.status).toBe(429);
  });

  it("하루 5회 넘게 쓴 IP는 전역 한도의 70%까지만 예약을 시도한다", async () => {
    const r = req("http://a.test/api", { "x-real-ip": uniqueIp() });
    const storage = getCacheStorage();
    const spy = vi.spyOn(Object.getPrototypeOf(storage), "reserveGeminiDaily").mockResolvedValue(1);
    for (let i = 0; i < 5; i++) await reserveGeminiCalls(r, 1, "limit");
    const lightLimit = spy.mock.calls[0][2];
    await reserveGeminiCalls(r, 1, "limit");
    const heavyLimit = spy.mock.calls[5][2];
    expect(heavyLimit).toBeLessThan(lightLimit as number);
  });
});
