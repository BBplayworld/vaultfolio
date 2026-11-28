// #313(5.157) 배당 라우트 캐시 히트 — 이번 달 추정 지급을 확정(isEstimated:false)으로 바꾸지 않는다. 응답 형식·캐시 키 불변
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const getDividend = vi.fn();
const getToken = vi.fn();

vi.mock("@/lib/cache-storage", () => ({ getCacheStorage: () => ({ getDividend: (k: string) => getDividend(k), setDividend: vi.fn() }) }));
vi.mock("@/lib/finance/kis-token", () => ({ getKisAccessToken: (...a: unknown[]) => getToken(...a) }));
vi.mock("@/server/api-guard", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@/server/api-guard")>();
  return { ...mod, guardRequest: () => null, guardRateLimit: async () => null, withinUpstreamBudget: async () => true };
});

import { GET } from "../route";

const req = (qs: string) => new NextRequest(`https://example.test/api/finance/dividend${qs}`);

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-26T03:00:00Z")); // KST 11-26 12:00
  getDividend.mockReset();
  getToken.mockReset();
});
afterEach(() => vi.useRealTimers());

describe("배당 라우트 캐시 히트", () => {
  it("이번 달 이하 추정 행이 isEstimated:true를 그대로 유지한다", async () => {
    const cached = [
      { payoutDate: "2026-09-15", amountPerShare: 361, isEstimated: false, frequency: "quarterly" },
      { payoutDate: "2026-11-15", amountPerShare: 361, isEstimated: true, frequency: "quarterly" },
      { payoutDate: "2026-12-15", amountPerShare: 361, isEstimated: true, frequency: "quarterly" },
    ];
    getDividend.mockResolvedValue(cached);
    const res = await GET(req("?ticker=005930&type=domestic"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toEqual(cached);
    expect(body.data[1].isEstimated).toBe(true);
    // 캐시 키(v14)·외부 호출 0
    expect(getDividend).toHaveBeenCalledWith("005930-domestic-v14");
    expect(getToken).not.toHaveBeenCalled();
  });
});
