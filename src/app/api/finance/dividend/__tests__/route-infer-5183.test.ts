// #376(5.183) 배당 라우트 추정 — 실제 GET을 KIS 응답 목으로 돌려 추정 행을 고정한다(오늘 = 2026-11-28 KST)
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

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

const q = (y: number, ms: number[], amt: number, d = "15", usd = false): Raw[] =>
  ms.map((m) => ({ payoutDate: `${y}-${String(m).padStart(2, "0")}-${d}`, amountPerShare: amt, ...(usd ? { amountForeign: amt, currency: "USD" } : {}) }));

type Out = { payoutDate: string; amountPerShare: number; isEstimated?: boolean; frequency: string };
async function call(ticker: string, type: "domestic" | "foreign"): Promise<Out[]> {
  const { GET } = await import("../route");
  const p = GET(new NextRequest(`https://example.test/api/finance/dividend?ticker=${ticker}&type=${type}`));
  await vi.runAllTimersAsync(); // 연도 사이 500ms 대기
  return (await (await p).json()).data;
}
const estimates = (d: Out[]) => d.filter((p) => p.isEstimated).map((p) => p.payoutDate);

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-28T03:00:00Z")); // KST 11-28 12:00
});
afterEach(() => vi.useRealTimers());

describe("A. 지난 달 추정을 만들지 않는다", () => {
  it("분기 1·4·10월만 조회(7월 기록 누락, SK하이닉스형) → 7월 추정 0", async () => {
    kis["000660:2026"] = [...q(2026, [1, 4], 375, "20"), ...q(2026, [10], 500, "20")];
    kis["000660:2025"] = q(2025, [1, 4, 7, 10], 300, "20");
    const d = await call("000660", "domestic");
    expect(estimates(d)).toEqual([]);
    expect(d.every((p) => p.frequency === "quarterly")).toBe(true);
  });
  it("월배당 ETF 7·9월 누락(TIGER형) → 12월만 추정, 금액은 최신 지급액", async () => {
    kis["360750:2026"] = q(2026, [1, 2, 3, 4, 5, 6, 8, 10, 11], 50, "03");
    kis["360750:2025"] = q(2025, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], 45, "03");
    const d = await call("360750", "domestic");
    expect(estimates(d)).toEqual(["2026-12-15"]);
    expect(d.find((p) => p.isEstimated)?.amountPerShare).toBe(50);
    expect(d.every((p) => p.frequency === "monthly")).toBe(true);
  });
  it("이번 달 회차가 아직 없으면 이번 달 추정은 남긴다", async () => {
    kis["CUR:2026"] = q(2026, [2, 5, 8], 100);
    kis["CUR:2025"] = q(2025, [2, 5, 8, 11], 90);
    const d = await call("CUR", "domestic");
    expect(estimates(d)).toEqual(["2026-11-15"]);
  });
});
