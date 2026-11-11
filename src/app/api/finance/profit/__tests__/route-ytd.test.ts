// #150 profit 라우트 ytd — period 화이트리스트, 미국만 수정주가(adj 키·MODP=1), 국내·타 기간은 기존 그대로
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const domHist = vi.fn();
const ovsHist = vi.fn();
// 키 = `${adj?"adj:":""}ticker|date`
const prices = new Map<string, number>();
const reqMap = new Map<string, string>();
const setCalls: { t: string; d: string; period: string; adj: boolean }[] = [];

vi.mock("@/lib/cache-storage", () => ({
  getCacheStorage: () => ({
    getRefDateForRequest: async (t: string, d: string, p: string) => reqMap.get(`${t}|${p}|${d}`) ?? null,
    getRefPrice: async (t: string, d: string, adj?: boolean) => prices.get(`${adj ? "adj:" : ""}${t}|${d}`) ?? null,
    setRefPrice: async (t: string, d: string, p: number, period: string, adj?: boolean) => {
      setCalls.push({ t, d, period, adj: !!adj });
      prices.set(`${adj ? "adj:" : ""}${t}|${d}`, p);
    },
    setRefDateForRequest: async (t: string, d: string, a: string, p: string) => { reqMap.set(`${t}|${p}|${d}`, a); },
    getStock: async () => null,
  }),
}));
vi.mock("@/lib/finance/finance-service", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@/lib/finance/finance-service")>();
  return { ...mod, fetchDomesticHistoricalPrice: (...a: unknown[]) => domHist(...a), fetchOverseasHistoricalPrice: (...a: unknown[]) => ovsHist(...a) };
});
vi.mock("@/lib/finance/kis-token", () => ({
  getKisAccessToken: async () => ({ token: "t", unavailable: false }),
  recordKisFailure: async () => false,
  recordKisSuccess: async () => {},
}));
vi.mock("@/server/api-guard", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@/server/api-guard")>();
  return { ...mod, guardRequest: () => null, guardRateLimit: async () => null, withinUpstreamBudget: async () => true };
});

import { GET } from "../route";

const req = (qs: string) => new NextRequest(`https://example.test/api/finance/profit${qs}`);

beforeEach(() => {
  prices.clear(); reqMap.clear(); setCalls.length = 0;
  domHist.mockReset().mockResolvedValue({ date: "2025-12-30", price: 53000 });
  ovsHist.mockReset().mockResolvedValue({ date: "2025-12-31", price: 190 });
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-11T12:00:00+09:00"));
});
afterEach(() => { vi.useRealTimers(); });

describe("profit 라우트 ytd", () => {
  it("허용 밖 period는 400, ytd는 허용", async () => {
    expect((await GET(req("?tickers=AAPL&period=year"))).status).toBe(400);
    expect((await GET(req("?tickers=AAPL&period=ytd"))).status).toBe(200);
  });

  it("미국: 요청일 (Y-1)-12-31로 수정주가(adjusted=true) 조회, adj 키로 저장. 국내: 기존 호출·원 키 저장", async () => {
    const body = await (await GET(req("?tickers=AAPL,005930&period=ytd&basis=sameBusinessDay"))).json();
    expect(body.AAPL).toEqual({ refPrice: 190, refDate: "2025-12-31" });
    expect(body["005930"]).toEqual({ refPrice: 53000, refDate: "2025-12-30" });
    expect(ovsHist.mock.calls[0][1]).toBe("2025-12-31");
    expect(ovsHist.mock.calls[0][6]).toBe(true);
    expect(domHist.mock.calls[0]).toHaveLength(5);
    expect(setCalls).toContainEqual({ t: "AAPL", d: "2025-12-31", period: "ytd", adj: true });
    expect(setCalls).toContainEqual({ t: "005930", d: "2025-12-30", period: "ytd", adj: false });
  });

  it("캐시 충돌 방지: weekly가 저장한 미수정 12/31 값은 ytd가 읽지 않고, ytd는 adj 값을 재사용", async () => {
    prices.set("AAPL|2025-12-31", 999); // 미수정 값(다른 기간 저장분)
    reqMap.set("AAPL|ytd|2025-12-31", "2025-12-31");
    await GET(req("?tickers=AAPL&period=ytd&basis=sameBusinessDay"));
    expect(ovsHist).toHaveBeenCalledTimes(1); // adj 키가 비어 KIS 재조회
    ovsHist.mockClear();
    const body = await (await GET(req("?tickers=AAPL&period=ytd&basis=sameBusinessDay"))).json();
    expect(ovsHist).not.toHaveBeenCalled();
    expect(body.AAPL.refPrice).toBe(190);
  });

  it("다른 기간(weekly)은 미수정(adjusted=false)·원 키 그대로", async () => {
    await GET(req("?tickers=AAPL&period=weekly&basis=sameBusinessDay"));
    expect(ovsHist.mock.calls[0][6]).toBe(false);
    expect(setCalls[0].adj).toBe(false);
  });
});
