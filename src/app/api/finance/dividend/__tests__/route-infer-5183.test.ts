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

describe("B. 빈도는 연간 지급 건수 우선, 올해 횟수를 채우면 추정 없음", () => {
  it("불규칙 분기 4·5·8·11월(삼성전자형) → 분기, 추정 0(올해 4건 = 연 4회)", async () => {
    kis["005930:2026"] = [{ payoutDate: "2026-04-17", amountPerShare: 566 }, ...q(2026, [5, 8, 11], 370, "20")];
    kis["005930:2025"] = [{ payoutDate: "2025-04-18", amountPerShare: 365 }, ...q(2025, [5, 8, 11], 361, "20")];
    const d = await call("005930", "domestic");
    expect(d.every((p) => p.frequency === "quarterly")).toBe(true);
    expect(estimates(d)).toEqual([]);
  });
  it("불규칙 분기 진행 중(4·5·8월까지) → 분기, 지난 달 추정 0·남은 1회만 추정", async () => {
    vi.setSystemTime(new Date("2026-09-10T03:00:00Z"));
    kis["IRR:2026"] = [...q(2026, [4], 566, "17"), ...q(2026, [5, 8], 370, "20")];
    kis["IRR:2025"] = q(2025, [4, 5, 8, 11], 361, "20");
    const d = await call("IRR", "domestic");
    expect(d.every((p) => p.frequency === "quarterly")).toBe(true);
    expect(estimates(d)).toEqual(["2026-10-15"]);
  });
  it("정상 분기 2·5·8·11월(Apple형) → 분기, 추정 0", async () => {
    kis["AAPL:2026"] = q(2026, [2, 5, 8, 11], 0.26, "10", true);
    kis["AAPL:2025"] = q(2025, [2, 5, 8, 11], 0.25, "10", true);
    const d = await call("AAPL", "foreign");
    expect(d.every((p) => p.frequency === "quarterly")).toBe(true);
    expect(estimates(d)).toEqual([]);
  });
  it("정상 분기 3·6·9월까지(NVIDIA형) → 12월 미래분만 추정", async () => {
    kis["NVDA:2026"] = q(2026, [3, 6, 9], 0.01, "11", true);
    kis["NVDA:2025"] = q(2025, [3, 6, 9, 12], 0.01, "11", true);
    const d = await call("NVDA", "foreign");
    expect(d.every((p) => p.frequency === "quarterly")).toBe(true);
    expect(estimates(d)).toEqual(["2026-12-15"]);
  });
  it("분기 4·7월만 조회(KODEX형) → 분기, 1·10월 지난 달 추정 0", async () => {
    kis["069500:2026"] = q(2026, [4, 7], 120, "30");
    kis["069500:2025"] = q(2025, [1, 4, 7, 10], 110, "30");
    const d = await call("069500", "domestic");
    expect(d.every((p) => p.frequency === "quarterly")).toBe(true);
    expect(estimates(d)).toEqual([]);
  });
  it("월배당(1~11월 지급) → 월배당, 12월만 추정", async () => {
    kis["MON:2026"] = q(2026, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], 40, "05");
    kis["MON:2025"] = q(2025, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], 38, "05");
    const d = await call("MON", "domestic");
    expect(d.every((p) => p.frequency === "monthly")).toBe(true);
    expect(estimates(d)).toEqual(["2026-12-15"]);
  });
  it("반기 4월만 지급(10월 미조회) → 반기, 10월 지난 달 추정 0", async () => {
    kis["SEMI:2026"] = q(2026, [4], 200);
    kis["SEMI:2025"] = q(2025, [4, 10], 180);
    const d = await call("SEMI", "domestic");
    expect(d.every((p) => p.frequency === "semiannual")).toBe(true);
    expect(estimates(d)).toEqual([]);
  });
  it("반기 6월 지급, 12월 남음 → 반기, 12월 추정", async () => {
    kis["SEMI2:2026"] = q(2026, [6], 200);
    kis["SEMI2:2025"] = q(2025, [6, 12], 180);
    const d = await call("SEMI2", "domestic");
    expect(d.every((p) => p.frequency === "semiannual")).toBe(true);
    expect(estimates(d)).toEqual(["2026-12-15"]);
  });
  it("연 1회(4월) → 연간, 추정 0", async () => {
    kis["ANN:2026"] = q(2026, [4], 1000);
    kis["ANN:2025"] = q(2025, [4], 900);
    const d = await call("ANN", "domestic");
    expect(d.every((p) => p.frequency === "annual")).toBe(true);
    expect(estimates(d)).toEqual([]);
  });
  it("올해 실지급 완료(반기 2·3월 2건, 간격 1) → 반기, 추정 0", async () => {
    vi.setSystemTime(new Date("2026-05-10T03:00:00Z"));
    kis["DONE:2026"] = q(2026, [2, 3], 150);
    kis["DONE:2025"] = q(2025, [3, 9], 140);
    const d = await call("DONE", "domestic");
    expect(d.every((p) => p.frequency === "semiannual")).toBe(true);
    expect(estimates(d)).toEqual([]);
  });
});
