import { describe, it, expect, vi, beforeEach } from "vitest";

const { kr, us } = vi.hoisted(() => ({ kr: vi.fn(), us: vi.fn() }));
vi.mock("@/lib/finance/finance-service", () => ({
  fetchKospiDailySeries: vi.fn(),
  fetchOverseasIndexDailySeries: vi.fn(),
  fetchKrStockDailyCloses: kr,
  fetchOverseasDailyCloses: us,
}));
vi.mock("@/lib/cache-storage", () => ({ getCacheStorage: () => ({}) }));
import { fetchPushRates } from "../quotes";
import { PUSH_CATALOG } from "../catalog";

const krTopic = PUSH_CATALOG.find((t) => t.source.kind === "kr-stock")!;
const usTopic = PUSH_CATALOG.find((t) => t.source.kind === "us-stock")!;
const ctx = (market: "kr" | "us", marketDate: string) => ({
  market, marketDate, todayStr: "2026-11-12", accessToken: "t", appKey: "k", appSecret: "s",
});
const rows = (d0: string, d1: string) => [{ date: d0, price: 100 }, { date: d1, price: 102 }];

describe("종목·ETF stale 제외(일별 종가 행 날짜 검증)", () => {
  beforeEach(() => { kr.mockReset(); us.mockReset(); });

  it("국내: 마지막 행이 오늘이면 포함", async () => {
    kr.mockResolvedValue(rows("2026-11-11", "2026-11-12"));
    expect((await fetchPushRates([krTopic], ctx("kr", "2026-11-12")))[krTopic.id]).toBeCloseTo(2);
  });
  it("국내: 임시 휴장(마지막 행이 전 거래일) → 제외", async () => {
    kr.mockResolvedValue(rows("2026-11-10", "2026-11-11"));
    expect(await fetchPushRates([krTopic], ctx("kr", "2026-11-12"))).toEqual({});
  });
  it("미국: 직전 미국 거래일이면 포함, 아니면 제외", async () => {
    us.mockResolvedValue(rows("2026-11-10", "2026-11-11"));
    expect((await fetchPushRates([usTopic], ctx("us", "2026-11-11")))[usTopic.id]).toBeCloseTo(2);
    expect(await fetchPushRates([usTopic], ctx("us", "2026-11-12"))).toEqual({});
  });
  it("조회 실패(null) → 제외", async () => {
    kr.mockResolvedValue(null);
    expect(await fetchPushRates([krTopic], ctx("kr", "2026-11-12"))).toEqual({});
  });
});
