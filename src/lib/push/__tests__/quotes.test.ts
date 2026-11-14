import { describe, it, expect, vi, beforeEach } from "vitest";

const { kospi, overseas, fxSeries } = vi.hoisted(() => ({ kospi: vi.fn(), overseas: vi.fn(), fxSeries: vi.fn() }));
vi.mock("@/lib/finance/finance-service", () => ({
  fetchKospiDailySeries: kospi,
  fetchOverseasIndexDailySeries: overseas,
  fetchFxKrwDailySeries: fxSeries,
}));
import { changeFromSeries, estimateKisCalls, fetchKrQuotes, fetchUsQuotes } from "../quotes";

const ctx = { accessToken: "t", appKey: "k", appSecret: "s" };
const rows = (last: string, a = 100, b = 101) => [
  { date: "2026-11-20", price: a },
  { date: last, price: b },
];

beforeEach(() => {
  vi.resetAllMocks();
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

describe("changeFromSeries — 날짜 검증", () => {
  it("마지막 행 날짜 = 기대일이면 등락·종가", () => {
    const c = changeFromSeries(rows("2026-11-23"), "2026-11-23");
    expect(c?.rate).toBeCloseTo(1, 5);
    expect(c?.price).toBe(101);
  });
  it("날짜 불일치(stale)·행 부족·null은 null", () => {
    expect(changeFromSeries(rows("2026-11-23"), "2026-11-24")).toBeNull();
    expect(changeFromSeries([{ date: "2026-11-23", price: 1 }], "2026-11-23")).toBeNull();
    expect(changeFromSeries(null, "2026-11-23")).toBeNull();
  });
});

describe("구간 조회", () => {
  it("미국 구간 — 둘 다 통과", async () => {
    overseas.mockResolvedValue(rows("2026-11-23"));
    const seg = await fetchUsQuotes("2026-11-23", ctx);
    expect(seg.quotes.map((q) => q.label)).toEqual(["S&P 500", "나스닥"]);
    expect(seg.status).toEqual({ spx: "ok", comp: "ok" });
  });
  it("국내 구간 — 환율 날짜 불일치면 환율만 빠진다(stale), 조회 실패는 fail", async () => {
    kospi.mockResolvedValue(rows("2026-11-24"));
    fxSeries.mockResolvedValue(rows("2026-11-21"));
    const seg = await fetchKrQuotes("2026-11-24", ctx);
    expect(seg.quotes.map((q) => q.label)).toEqual(["코스피", "코스닥"]);
    expect(seg.status).toEqual({ kospi: "ok", kosdaq: "ok", fx: "stale" });
    fxSeries.mockResolvedValue(null);
    expect((await fetchKrQuotes("2026-11-24", ctx)).status.fx).toBe("fail");
  });
  it("환율 정상이면 kind fx 포함", async () => {
    kospi.mockResolvedValue(rows("2026-11-24"));
    fxSeries.mockResolvedValue(rows("2026-11-24", 1380, 1385));
    const seg = await fetchKrQuotes("2026-11-24", ctx);
    expect(seg.quotes.find((q) => q.kind === "fx")?.price).toBe(1385);
  });
  it("호출 수 추정", () => {
    expect(estimateKisCalls(true, true)).toBe(5);
    expect(estimateKisCalls(false, true)).toBe(3);
  });
});
