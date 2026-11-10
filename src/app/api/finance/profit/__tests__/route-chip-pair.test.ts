// #132 U7 profit 라우트 chipPair — daily·kstAccessDay·장 종료 후·쌍이 다를 때만, 실제 종가일 = 요청일만, 실패는 필드만 생략
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const domHist = vi.fn();
const ovsHist = vi.fn();
const getToken = vi.fn();
const rateLimit = vi.fn(async () => null);
const budget = vi.fn(async () => true);
// 서버 캐시(메모리) — ticker|date → price, ticker|req → actual
const prices = new Map<string, number>();
const reqMap = new Map<string, string>();

vi.mock("@/lib/cache-storage", () => ({
  getCacheStorage: () => ({
    getRefDateForRequest: async (t: string, d: string) => reqMap.get(`${t}|${d}`) ?? null,
    getRefPrice: async (t: string, d: string) => prices.get(`${t}|${d}`) ?? null,
    setRefPrice: async (t: string, d: string, p: number) => { prices.set(`${t}|${d}`, p); },
    setRefDateForRequest: async (t: string, d: string, a: string) => { reqMap.set(`${t}|${d}`, a); },
    getStock: async () => null,
  }),
}));
vi.mock("@/lib/finance/finance-service", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@/lib/finance/finance-service")>();
  return {
    ...mod,
    fetchDomesticHistoricalPrice: (...a: unknown[]) => domHist(...a),
    fetchOverseasHistoricalPrice: (...a: unknown[]) => ovsHist(...a),
  };
});
vi.mock("@/lib/finance/kis-token", () => ({
  getKisAccessToken: (...a: unknown[]) => getToken(...a),
  recordKisFailure: async () => false,
  recordKisSuccess: async () => {},
}));
vi.mock("@/server/api-guard", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@/server/api-guard")>();
  return { ...mod, guardRequest: () => null, guardRateLimit: () => rateLimit(), withinUpstreamBudget: () => budget() };
});

import { GET } from "../route";

const req = (qs: string) => new NextRequest(`https://example.test/api/finance/profit${qs}`);
// 국내 가짜 종가(한글날 10/9 휴장 → KIS는 직전 거래일로 롤백)
const KR_CLOSE: Record<string, number> = { "2026-10-06": 68000, "2026-10-07": 68600, "2026-10-08": 70000 };
const rollbackKr = (d: string) => (d === "2026-10-09" ? "2026-10-08" : d);
const seed = (t: string, req: string, actual: string, p: number) => { reqMap.set(`${t}|${req}`, actual); prices.set(`${t}|${actual}`, p); };

beforeEach(() => {
  prices.clear();
  reqMap.clear();
  domHist.mockReset().mockImplementation(async (_t: string, d: string) => {
    const a = rollbackKr(d);
    return KR_CLOSE[a] ? { date: a, price: KR_CLOSE[a] } : null;
  });
  ovsHist.mockReset().mockResolvedValue(null);
  getToken.mockReset().mockResolvedValue({ token: "t", unavailable: false });
  rateLimit.mockReset().mockResolvedValue(null);
  budget.mockReset().mockResolvedValue(true);
  vi.useFakeTimers({ toFake: ["Date"] });
});
afterEach(() => { vi.useRealTimers(); });

describe("profit route chipPair", () => {
  it("한글날 17:00 국내: 기존 필드 그대로 + chipPair 10/7→10/8(KIS 2회)", async () => {
    vi.setSystemTime(new Date("2026-10-09T17:00:00+09:00"));
    const res = await GET(req("?tickers=005930&period=daily&basis=kstAccessDay"));
    const body = await res.json();
    expect(body["005930"]).toMatchObject({ refDate: "2026-10-09", refPrice: 70000 });
    expect(body["005930"].chipPair).toEqual({ closeDate: "2026-10-08", closePrice: 70000, baseDate: "2026-10-07", basePrice: 68600 });
    // 칩 보강용 요청일은 10/7·10/8 두 날짜(10/8은 기존 큐가 이미 받아 캐시 hit일 수 있음)
    expect(domHist.mock.calls.map((c) => c[1])).toContain("2026-10-07");
  });

  it("평일 정상 시각(세션 쌍 = 응답 쌍): chipPair 없음, KIS 추가 호출 0", async () => {
    vi.setSystemTime(new Date("2026-10-08T17:00:00+09:00"));
    seed("005930", "2026-10-08", "2026-10-08", 70000);
    seed("005930", "2026-10-07", "2026-10-07", 68600);
    const res = await GET(req("?tickers=005930&period=daily&basis=kstAccessDay"));
    const body = await res.json();
    expect(body["005930"]).toEqual({ refPrice: 70000, refDate: "2026-10-08", prevPrice: 68600, prevDate: "2026-10-07" });
    expect(domHist).not.toHaveBeenCalled();
    expect(res.headers.get("Vercel-CDN-Cache-Control")).toMatch(/max-age/);
  });

  it("캐시 hit 경로에서도 보강, KIS가 롤백 종가(실제일 ≠ 요청일)만 주면 필드 생략·CDN 캐시 안 함", async () => {
    vi.setSystemTime(new Date("2026-10-09T17:00:00+09:00"));
    // 일별 응답 필드는 전부 캐시 hit
    seed("005930", "2026-10-09", "2026-10-08", 70000);
    seed("005930", "2026-10-08", "2026-10-08", 70000);
    const first = await (await GET(req("?tickers=005930&period=daily&basis=kstAccessDay"))).json();
    expect(first["005930"].chipPair).toBeDefined();

    prices.clear();
    reqMap.clear();
    seed("005930", "2026-10-09", "2026-10-08", 70000);
    seed("005930", "2026-10-08", "2026-10-08", 70000);
    domHist.mockImplementation(async (_t: string, d: string) => (d === "2026-10-07" ? { date: "2026-10-06", price: 68000 } : null));
    const res = await GET(req("?tickers=005930&period=daily&basis=kstAccessDay"));
    const body = await res.json();
    expect(body["005930"].chipPair).toBeUndefined();
    expect(body["005930"]).toMatchObject({ refDate: "2026-10-09", refPrice: 70000 });
    expect(res.headers.get("Vercel-CDN-Cache-Control")).toBeNull();
  });

  it("예산 초과·토큰 없음이면 KIS 호출 없이 필드만 생략", async () => {
    vi.setSystemTime(new Date("2026-10-09T17:00:00+09:00"));
    seed("005930", "2026-10-09", "2026-10-08", 70000);
    seed("005930", "2026-10-08", "2026-10-08", 70000);
    budget.mockResolvedValue(false);
    const body = await (await GET(req("?tickers=005930&period=daily&basis=kstAccessDay"))).json();
    expect(body["005930"].chipPair).toBeUndefined();
    expect(domHist).not.toHaveBeenCalled();
    budget.mockResolvedValue(true);
    getToken.mockResolvedValue({ token: null, unavailable: false });
    const body2 = await (await GET(req("?tickers=005930&period=daily&basis=kstAccessDay"))).json();
    expect(body2["005930"].chipPair).toBeUndefined();
  });

  it("sameBusinessDay·weekly 요청에는 붙이지 않는다", async () => {
    vi.setSystemTime(new Date("2026-10-09T17:00:00+09:00"));
    for (const qs of ["?tickers=005930&period=daily&basis=sameBusinessDay", "?tickers=005930&period=weekly&basis=kstAccessDay"]) {
      domHist.mockClear();
      const body = await (await GET(req(qs))).json();
      expect(body["005930"]?.chipPair).toBeUndefined();
    }
  });
});
