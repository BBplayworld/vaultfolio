// #132 U2 지수 라우트 — 매개변수 화이트리스트(A22), 응답 모양, 캐시 헤더, 날짜 규칙(종목과 같은 함수)
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const fetchKospi = vi.fn();
const fetchOverseas = vi.fn();
const getToken = vi.fn();
const recordFailure = vi.fn(async () => false);
const recordSuccess = vi.fn(async () => {});
const rateLimit = vi.fn(async () => null);
const budget = vi.fn(async () => true);

vi.mock("@/lib/finance/finance-service", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@/lib/finance/finance-service")>();
  return {
    ...mod,
    fetchKospiDailySeries: (...a: unknown[]) => fetchKospi(...a),
    fetchOverseasIndexDailySeries: (...a: unknown[]) => fetchOverseas(...a),
  };
});
vi.mock("@/lib/finance/kis-token", () => ({
  getKisAccessToken: (...a: unknown[]) => getToken(...a),
  recordKisFailure: () => recordFailure(),
  recordKisSuccess: () => recordSuccess(),
}));
vi.mock("@/server/api-guard", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@/server/api-guard")>();
  return {
    ...mod,
    guardRequest: () => null,
    guardRateLimit: () => rateLimit(),
    withinUpstreamBudget: () => budget(),
  };
});

import { GET } from "../route";

const req = (qs: string) => new NextRequest(`https://example.test/api/finance/market-index${qs}`);
const kst = (iso: string) => new Date(`${iso}+09:00`).getTime();

// 2026-11-02(월) ~ 11-10(화) 코스피·S&P 500 가짜 시계열(현지 거래일)
const KOSPI = [
  { date: "2026-10-09", price: 2990 },
  { date: "2026-10-12", price: 3000 },
  { date: "2026-11-02", price: 3100 },
  { date: "2026-11-03", price: 3110 },
  { date: "2026-11-04", price: 3120 },
  { date: "2026-11-05", price: 3130 },
  { date: "2026-11-06", price: 3140 },
  { date: "2026-11-09", price: 3150 },
  { date: "2026-11-10", price: 3160 },
];
const SPX = [
  { date: "2026-10-09", price: 6500 },
  { date: "2026-11-02", price: 6600 },
  { date: "2026-11-03", price: 6610 },
  { date: "2026-11-04", price: 6620 },
  { date: "2026-11-05", price: 6630 },
  { date: "2026-11-06", price: 6640 },
  { date: "2026-11-09", price: 6650 },
];

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(kst("2026-11-10T20:00:00"));
  fetchKospi.mockReset().mockImplementation(async () => KOSPI);
  fetchOverseas.mockReset().mockImplementation(async () => SPX);
  getToken.mockReset().mockResolvedValue({ token: "t", unavailable: false });
  recordFailure.mockClear();
  recordSuccess.mockClear();
  rateLimit.mockReset().mockResolvedValue(null);
  budget.mockReset().mockResolvedValue(true);
});
afterEach(() => {
  vi.useRealTimers();
});

describe("market-index 매개변수(A22)", () => {
  it.each([
    ["?period=yearly&basis=sameBusinessDay"],
    ["?period=daily"],
    ["?basis=kstAccessDay"],
    ["?period=weekly&basis=other"],
    [""],
  ])("허용 밖 %s → 400, 외부 호출 0", async (qs) => {
    const res = await GET(req(qs));
    expect(res.status).toBe(400);
    expect(fetchKospi).not.toHaveBeenCalled();
    expect(fetchOverseas).not.toHaveBeenCalled();
  });

  it("지수 조회에는 날짜 구간·지수코드만 넘긴다(종목코드 없음), S&P 500 코드 = SPX", async () => {
    await GET(req("?period=weekly&basis=sameBusinessDay"));
    expect(fetchOverseas.mock.calls[0][0]).toBe("SPX");
    expect(fetchKospi.mock.calls[0].slice(0, 2)).toEqual(["2026-10-24", "2026-11-03"]);
  });
});

describe("market-index 응답", () => {
  it("화 20:00 sameBusinessDay 주간: 두 지수 모두 같은 날짜 규칙(미국 영업일 5일 전)", async () => {
    const res = await GET(req("?period=weekly&basis=sameBusinessDay"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      KOSPI: { refPrice: 3110, refDate: "2026-11-03" },
      SPX: { refPrice: 6610, refDate: "2026-11-03" },
    });
    expect(res.headers.get("Vercel-CDN-Cache-Control")).toMatch(/^max-age=\d+/);
  });

  it("화 20:00 일별 kstAccessDay: 국내 11/9→11/10, 미국 11/6→11/9", async () => {
    const body = await (await GET(req("?period=daily&basis=kstAccessDay"))).json();
    expect(body.KOSPI).toEqual({ refPrice: 3160, refDate: "2026-11-10", prevPrice: 3150, prevDate: "2026-11-09" });
    expect(body.SPX).toEqual({ refPrice: 6650, refDate: "2026-11-09", prevPrice: 6640, prevDate: "2026-11-06" });
  });

  it("한쪽 실패면 그 지수만 null, CDN 캐시 헤더 없음, 서킷 성공 기록", async () => {
    fetchOverseas.mockResolvedValue(null);
    const res = await GET(req("?period=daily&basis=kstAccessDay"));
    const body = await res.json();
    expect(body.SPX).toBeNull();
    expect(body.KOSPI).not.toBeNull();
    expect(res.headers.get("Vercel-CDN-Cache-Control")).toBeNull();
    expect(recordSuccess).toHaveBeenCalled();
  });

  it("두 지수 모두 실패면 서킷 실패 기록, 열리면 X-KIS-Unavailable", async () => {
    fetchKospi.mockResolvedValue(null);
    fetchOverseas.mockResolvedValue(null);
    recordFailure.mockResolvedValueOnce(true);
    const res = await GET(req("?period=daily&basis=kstAccessDay"));
    expect(await res.json()).toEqual({ KOSPI: null, SPX: null });
    expect(res.headers.get("X-KIS-Unavailable")).toBe("1");
  });

  it("토큰 서킷 open이면 외부 호출 없이 null + X-KIS-Unavailable", async () => {
    getToken.mockResolvedValue({ token: null, unavailable: true });
    const res = await GET(req("?period=monthly&basis=kstAccessDay"));
    expect(await res.json()).toEqual({ KOSPI: null, SPX: null });
    expect(res.headers.get("X-KIS-Unavailable")).toBe("1");
    expect(fetchKospi).not.toHaveBeenCalled();
  });

  it("전역 예산 초과면 외부 호출 없이 null", async () => {
    budget.mockResolvedValue(false);
    const res = await GET(req("?period=monthly&basis=kstAccessDay"));
    expect(await res.json()).toEqual({ KOSPI: null, SPX: null });
    expect(fetchKospi).not.toHaveBeenCalled();
  });

  it("L2 한도 초과면 그 응답(429)을 그대로", async () => {
    rateLimit.mockResolvedValue(new Response(null, { status: 429 }) as never);
    const res = await GET(req("?period=monthly&basis=kstAccessDay"));
    expect(res.status).toBe(429);
  });
});
