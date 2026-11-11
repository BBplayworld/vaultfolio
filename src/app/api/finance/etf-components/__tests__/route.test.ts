// #152 ETF 구성종목 라우트 — 입력 검증·정규화·캐시 헤더(성공만 CDN)
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const fetchComp = vi.fn();
const getToken = vi.fn();
const budget = vi.fn(async () => true);

vi.mock("@/lib/finance/finance-service", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@/lib/finance/finance-service")>();
  return { ...mod, fetchEtfComponents: (...a: unknown[]) => fetchComp(...a) };
});
vi.mock("@/lib/finance/kis-token", () => ({
  getKisAccessToken: (...a: unknown[]) => getToken(...a),
  recordKisFailure: async () => false,
  recordKisSuccess: async () => {},
}));
vi.mock("@/server/api-guard", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@/server/api-guard")>();
  return { ...mod, guardRequest: () => null, guardRateLimit: async () => null, withinUpstreamBudget: () => budget() };
});

import { GET } from "../route";

const req = (qs: string) => new NextRequest(`https://example.test/api/finance/etf-components${qs}`);
const row = (c: string, n: string, w: string) => ({ stck_shrn_iscd: c, hts_kor_isnm: n, etf_cnfg_issu_rlim: w });

beforeEach(() => {
  fetchComp.mockReset();
  getToken.mockReset().mockResolvedValue({ token: "t", unavailable: false });
  budget.mockReset().mockResolvedValue(true);
});

describe("GET /api/finance/etf-components", () => {
  it("코드 누락·형식 위반·비ETF 코드는 400, KIS 호출 0", async () => {
    for (const qs of ["", "?code=", "?code=12345", "?code=AAPL", "?code=069500,122630", "?code=005930"]) {
      const res = await GET(req(qs));
      expect(res.status).toBe(400);
    }
    expect(fetchComp).not.toHaveBeenCalled();
  });

  it("정상 응답은 정규화하고 CDN 캐시 헤더를 붙인다", async () => {
    fetchComp.mockResolvedValue({
      output1: { etf_cnfg_issu_cnt: "2" },
      output2: [row("005930", "삼성전자", "30.5"), row("000660", "SK하이닉스", "69.5")],
    });
    const res = await GET(req("?code=069500"));
    expect(res.status).toBe(200);
    expect(res.headers.get("Vercel-CDN-Cache-Control")).toMatch(/max-age=\d+/);
    const body = await res.json();
    expect(body).toMatchObject({ code: "069500", count: 2, rows: 2, weightSum: 100, complete: true });
    expect(body.components[0]).toEqual({ code: "005930", name: "삼성전자", weight: 30.5 });
  });

  it("구성 수와 행 수가 다르면(부분) 캐시하지 않는다", async () => {
    fetchComp.mockResolvedValue({ output1: { etf_cnfg_issu_cnt: "5" }, output2: [row("005930", "삼성전자", "30")] });
    const res = await GET(req("?code=069500"));
    expect(res.status).toBe(200);
    expect(res.headers.get("Vercel-CDN-Cache-Control")).toBeNull();
    expect((await res.json()).complete).toBe(false);
  });

  it("KIS 실패·빈 응답은 502, 토큰 없음·예산 초과는 503, 모두 캐시 헤더 없음", async () => {
    fetchComp.mockResolvedValue(null);
    let res = await GET(req("?code=069500"));
    expect(res.status).toBe(502);
    expect(res.headers.get("Vercel-CDN-Cache-Control")).toBeNull();
    fetchComp.mockResolvedValue({ output1: {}, output2: [] });
    expect((await GET(req("?code=069500"))).status).toBe(502);
    getToken.mockResolvedValue({ token: null, unavailable: true });
    res = await GET(req("?code=069500"));
    expect(res.status).toBe(503);
    getToken.mockResolvedValue({ token: "t", unavailable: false });
    budget.mockResolvedValue(false);
    res = await GET(req("?code=069500"));
    expect(res.status).toBe(503);
    expect(res.headers.get("Vercel-CDN-Cache-Control")).toBeNull();
  });
});
