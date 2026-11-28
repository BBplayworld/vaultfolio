// #377(5.184) 표 `최근 1주당` = 서버가 예상 금액으로 쓰는 최신 실지급(수용 기준 3). 체험 데모 6종목형 목 KIS → 실제 GET → latestPerSharePayout
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { latestPerSharePayout } from "@/lib/finance/dividend-calc";

type Raw = { payoutDate: string; amountPerShare: number; amountForeign?: number; currency?: string };
const kis: Record<string, Raw[]> = {};

vi.mock("@/lib/cache-storage", () => ({ getCacheStorage: () => ({ getDividend: async () => null, setDividend: async () => {} }) }));
vi.mock("@/lib/finance/kis-token", () => ({ getKisAccessToken: async () => ({ token: "t" }) }));
vi.mock("@/server/api-guard", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@/server/api-guard")>();
  return { ...mod, guardRequest: () => null, guardRateLimit: async () => null, withinUpstreamBudget: async () => true };
});
vi.mock("@/lib/finance/finance-service", () => ({
  fetchDividendDomestic: async (t: string, f: string) => (kis[`${t}:${f.slice(0, 4)}`] ?? []).map((r) => ({ ...r, currency: "KRW" })),
  fetchDividendOverseas: async (t: string, _e: string, f: string) => kis[`${t}:${f.slice(0, 4)}`] ?? [],
}));

process.env.KIS_APP_KEY = "k";
process.env.KIS_APP_SECRET = "s";

const TODAY = "2026-11-28";
const q = (y: number, ms: number[], amt: number, d = "15", usd = false): Raw[] =>
  ms.map((m) => ({ payoutDate: `${y}-${String(m).padStart(2, "0")}-${d}`, amountPerShare: amt, ...(usd ? { amountForeign: amt, currency: "USD" } : {}) }));

type Out = { payoutDate: string; amountPerShare: number; amountForeign?: number; isEstimated?: boolean };
async function call(ticker: string, type: "domestic" | "foreign"): Promise<Out[]> {
  const { GET } = await import("../route");
  const p = GET(new NextRequest(`https://example.test/api/finance/dividend?ticker=${ticker}&type=${type}`));
  await vi.runAllTimersAsync();
  return (await (await p).json()).data;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-28T03:00:00Z")); // KST 11-28 12:00
});
afterEach(() => vi.useRealTimers());

// qa-facts 목(체험 데모 6종목형)
const DEMO: Array<[string, "domestic" | "foreign", Raw[], Raw[], number]> = [
  ["005930", "domestic", [{ payoutDate: "2026-04-17", amountPerShare: 566 }, ...q(2026, [5, 8, 11], 370, "20")], [{ payoutDate: "2025-04-18", amountPerShare: 365 }, ...q(2025, [5, 8, 11], 361, "20")], 370],
  ["000660", "domestic", [...q(2026, [1, 4], 375, "20"), ...q(2026, [10], 500, "20")], q(2025, [1, 4, 7, 10], 300, "20"), 500],
  ["AAPL", "foreign", q(2026, [2, 5, 8, 11], 0.26, "10", true), q(2025, [2, 5, 8, 11], 0.25, "10", true), 0.26],
  ["NVDA", "foreign", q(2026, [3, 6, 9], 0.01, "11", true), q(2025, [3, 6, 9, 12], 0.01, "11", true), 0.01],
  ["360750", "domestic", q(2026, [1, 2, 3, 4, 5, 6, 8, 10, 11], 50, "03"), q(2025, r(1, 12), 45, "03"), 50],
  ["069500", "domestic", q(2026, [4, 7], 120, "30"), q(2025, [1, 4, 7, 10], 110, "30"), 120],
];
function r(a: number, b: number) {
  return Array.from({ length: b - a + 1 }, (_, i) => a + i);
}

describe("최근 1주당 = 서버 추정 기준 회차", () => {
  it.each(DEMO)("%s: 최근 1주당이 기대값이고, 예상 회차가 있으면 그 주당과 같다", async (ticker, type, cur, prev, want) => {
    kis[`${ticker}:2026`] = cur;
    kis[`${ticker}:2025`] = prev;
    const data = await call(ticker, type);
    const p = latestPerSharePayout(data, TODAY)!;
    expect(p.amountPerShare).toBe(want);
    expect(p.isEstimated).toBeFalsy();
    for (const e of data.filter((d) => d.isEstimated)) {
      expect(e.amountPerShare).toBe(p.amountPerShare);
      expect(e.amountForeign).toBe(p.amountForeign);
    }
  });
  it("삼성전자형: 4월 특별 566원이 아니라 11월 확정 370원", async () => {
    kis["005930:2026"] = DEMO[0][2];
    kis["005930:2025"] = DEMO[0][3];
    const data = await call("005930", "domestic");
    expect(latestPerSharePayout(data, TODAY)!.payoutDate).toBe("2026-11-20");
  });
});

describe("latestPerSharePayout 규칙", () => {
  const p = (d: string, a: number, isEstimated?: boolean) => ({ payoutDate: d, amountPerShare: a, ...(isEstimated ? { isEstimated } : {}) });
  it("지난 달 추정은 후보에서 뺀다(오래된 캐시)", () => {
    expect(latestPerSharePayout([p("2026-05-15", 100), p("2026-10-15", 999, true), p("2026-12-15", 100, true)], TODAY)!.amountPerShare).toBe(100);
  });
  it("확정 회차 중 이번 달 이하의 가장 늦은 1건. 미래 확정 회차는 확정 후보가 아니다", () => {
    expect(latestPerSharePayout([p("2026-03-15", 90), p("2026-11-02", 110), p("2026-12-20", 130)], TODAY)!.amountPerShare).toBe(110);
  });
  it("같은 날 두 행이면 나중 행(서버 정렬과 같음)", () => {
    expect(latestPerSharePayout([p("2026-11-02", 110), p("2026-11-02", 120)], TODAY)!.amountPerShare).toBe(120);
  });
  it("확정 회차가 없으면 가장 이른 예상 1건, 이번 달 추정은 남긴다", () => {
    expect(latestPerSharePayout([p("2026-12-15", 70, true), p("2026-11-15", 60, true)], TODAY)!.amountPerShare).toBe(60);
  });
  it("후보가 없으면 null", () => {
    expect(latestPerSharePayout([p("2026-09-15", 70, true)], TODAY)).toBeNull();
    expect(latestPerSharePayout([], TODAY)).toBeNull();
  });
});
