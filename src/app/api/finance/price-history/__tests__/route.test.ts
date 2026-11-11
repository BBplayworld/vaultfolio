// #157 가격 이력 라우트 — 매개변수 화이트리스트, 응답·캐시 헤더, 예산 초과 시 외부 호출 0
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const fetchHistory = vi.fn();
const getToken = vi.fn();
const recordFailure = vi.fn(async () => false);
const recordSuccess = vi.fn(async () => {});
const rateLimit = vi.fn(async () => null);
const budget = vi.fn(async () => true);

vi.mock("@/lib/finance/price-history", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@/lib/finance/price-history")>();
  return { ...mod, fetchPriceHistory: (...a: unknown[]) => fetchHistory(...a) };
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

const req = (qs: string) => new NextRequest(`https://example.test/api/finance/price-history${qs}`);
const OK = { ticker: "005930", range: "1y", currency: "KRW", interval: "D", points: [{ d: "2026-11-10", c: 70000 }] };

beforeEach(() => {
  fetchHistory.mockReset().mockResolvedValue(OK);
  getToken.mockReset().mockResolvedValue({ token: "t", unavailable: false });
  recordFailure.mockClear();
  recordSuccess.mockClear();
  rateLimit.mockReset().mockResolvedValue(null);
  budget.mockReset().mockResolvedValue(true);
});

describe("price-history 매개변수", () => {
  it.each([["?ticker=005930&range=2y"], ["?ticker=005930"], ["?range=1y"], ["?ticker=%3Cx%3E&range=1y"], [""]])(
    "허용 밖 %s → 400, 외부 호출 0",
    async (qs) => {
      const res = await GET(req(qs));
      expect(res.status).toBe(400);
      expect(fetchHistory).not.toHaveBeenCalled();
    },
  );

  it("허용 외 쿼리 키(수량·평단)는 읽지 않고 넘기지 않는다", async () => {
    await GET(req("?ticker=005930&range=1y&quantity=10&avg=70000&date=2026-01-01"));
    expect(Object.keys(fetchHistory.mock.calls[0][0]).sort()).toEqual(
      ["accessToken", "appKey", "appSecret", "market", "range", "ticker", "todayStr"].sort(),
    );
  });

  it("국내·해외 판별, 둘 다 아니면 빈 points(KIS 호출 0)", async () => {
    await GET(req("?ticker=005930&range=1y"));
    expect(fetchHistory.mock.calls[0][0].market).toBe("kr");
    await GET(req("?ticker=aapl&range=5y"));
    expect(fetchHistory.mock.calls[1][0]).toMatchObject({ market: "us", ticker: "AAPL", range: "5y" });
    fetchHistory.mockClear();
    const res = await GET(req("?ticker=BTC:KRW&range=1y"));
    expect(res.status).toBe(200); // ':' 포함 티커(코인 등)는 시장 판별 불가 → 빈 points
    expect((await res.json()).points).toEqual([]);
    expect(fetchHistory).not.toHaveBeenCalled();
  });
});

describe("price-history 응답", () => {
  it("성공 → CDN 캐시 헤더", async () => {
    const res = await GET(req("?ticker=005930&range=1y"));
    expect(res.status).toBe(200);
    expect(res.headers.get("Vercel-CDN-Cache-Control")).toMatch(/max-age=21600/);
    expect(await res.json()).toEqual(OK);
    expect(recordSuccess).toHaveBeenCalled();
  });

  it("빈 points → no-store", async () => {
    fetchHistory.mockResolvedValue({ ...OK, points: [] });
    const res = await GET(req("?ticker=005930&range=1y"));
    expect(res.headers.get("Vercel-CDN-Cache-Control")).toBeNull();
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });

  it("조회 실패 → 503 no-store, 서킷 실패 기록", async () => {
    fetchHistory.mockResolvedValue(null);
    const res = await GET(req("?ticker=005930&range=1y"));
    expect(res.status).toBe(503);
    expect(res.headers.get("Vercel-CDN-Cache-Control")).toBeNull();
    expect(recordFailure).toHaveBeenCalled();
  });

  it("R3 마스터에 없는 티커의 조회 실패는 서킷에 반영하지 않는다(마스터 티커는 반영)", async () => {
    fetchHistory.mockResolvedValue(null);
    const bad = await GET(req("?ticker=ZZZZQ&range=1y"));
    expect(bad.status).toBe(503);
    expect(recordFailure).not.toHaveBeenCalled();
    await GET(req("?ticker=005930&range=1y"));
    expect(recordFailure).toHaveBeenCalledTimes(1);
  });

  it("R3 빈 시세(해외 모든 거래소 정상 빈 응답) → 200·points []·no-store, 서킷은 성공 기록", async () => {
    fetchHistory.mockResolvedValue({ ...OK, ticker: "AAPL", currency: "USD", points: [] });
    const res = await GET(req("?ticker=AAPL&range=1y"));
    expect(res.status).toBe(200);
    expect((await res.json()).points).toEqual([]);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(recordFailure).not.toHaveBeenCalled();
  });

  it("예산 초과 → 503, 토큰·KIS 호출 0", async () => {
    budget.mockResolvedValue(false);
    const res = await GET(req("?ticker=005930&range=1y"));
    expect(res.status).toBe(503);
    expect(getToken).not.toHaveBeenCalled();
    expect(fetchHistory).not.toHaveBeenCalled();
  });

  it("토큰 없음 → 503, KIS 호출 0", async () => {
    getToken.mockResolvedValue({ token: null, unavailable: true });
    const res = await GET(req("?ticker=005930&range=1y"));
    expect(res.status).toBe(503);
    expect(fetchHistory).not.toHaveBeenCalled();
  });
});
