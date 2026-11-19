import { describe, it, expect, vi, beforeEach } from "vitest";

const { kospi, overseas, fxSeries } = vi.hoisted(() => ({ kospi: vi.fn(), overseas: vi.fn(), fxSeries: vi.fn() }));
vi.mock("@/lib/finance/finance-service", () => ({
  fetchKospiDailySeries: kospi,
  fetchOverseasIndexDailySeries: overseas,
  fetchFxKrwDailySeries: fxSeries,
}));
import { changeFromSeries, estimateKisCalls, fetchFxQuote, fetchKrQuotes, fetchUsQuotes } from "../quotes";

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
  it("호출 수 추정 — 아침 최대 3(미국 2 + 환율 1), 미국 반복일 1, 16시 3", () => {
    expect(estimateKisCalls(true, true, false)).toBe(3);
    expect(estimateKisCalls(false, true, false)).toBe(1);
    expect(estimateKisCalls(false, false, true)).toBe(3);
    expect(estimateKisCalls(true, true, true)).toBe(6); // preview 미리보기(아침 + 국내 장 마감 동시)
  });
});

describe("아침 환율(#241) — 기대일 = 오늘, 오늘 행 ÷ 전일 행", () => {
  it("오늘 행이 있고 전일과 다르면 ok — 금액은 오늘 행, 코스피·코스닥·미국은 조회하지 않는다", async () => {
    fxSeries.mockResolvedValue([{ date: "2026-11-18", price: 1333.7 }, { date: "2026-11-19", price: 1331.5 }]);
    const seg = await fetchFxQuote("2026-11-19", ctx);
    expect(seg.status).toEqual({ fx: "ok" });
    expect(seg.quotes).toHaveLength(1);
    expect(seg.quotes[0]).toMatchObject({ label: "환율", kind: "fx", price: 1331.5 });
    expect(seg.quotes[0].rate).toBeCloseTo(((1331.5 - 1333.7) / 1333.7) * 100, 8);
    expect(fxSeries).toHaveBeenCalledTimes(1);
    expect(fxSeries.mock.calls[0][1]).toBe("2026-11-19"); // 조회 끝 날짜 = 오늘
    expect(kospi).not.toHaveBeenCalled();
    expect(overseas).not.toHaveBeenCalled();
  });
  it("마지막 행이 오늘이 아니면 stale(전일 행을 오늘 값처럼 싣지 않는다)", async () => {
    fxSeries.mockResolvedValue([{ date: "2026-11-17", price: 1335.4 }, { date: "2026-11-18", price: 1333.7 }]);
    expect(await fetchFxQuote("2026-11-19", ctx)).toEqual({ quotes: [], status: { fx: "stale" } });
  });
  it("조회 실패(null·예외)는 fail", async () => {
    fxSeries.mockResolvedValue(null);
    expect(await fetchFxQuote("2026-11-19", ctx)).toEqual({ quotes: [], status: { fx: "fail" } });
    fxSeries.mockRejectedValue(new Error("x"));
    expect(await fetchFxQuote("2026-11-19", ctx)).toEqual({ quotes: [], status: { fx: "fail" } });
  });
  it("오늘 행 값 = 전일 행 값(자리만 잡힌 행)이면 flat으로 생략 — 0.0%를 싣지 않는다", async () => {
    fxSeries.mockResolvedValue([{ date: "2026-11-18", price: 1333.7 }, { date: "2026-11-19", price: 1333.7 }]);
    expect(await fetchFxQuote("2026-11-19", ctx)).toEqual({ quotes: [], status: { fx: "flat" } });
  });
  it("flat 보호는 아침 환율 전용 — 16시 국내 구간은 같은 값이어도 그대로 싣는다", async () => {
    kospi.mockResolvedValue(rows("2026-11-24"));
    fxSeries.mockResolvedValue(rows("2026-11-24", 1385, 1385));
    const seg = await fetchKrQuotes("2026-11-24", ctx);
    expect(seg.status.fx).toBe("ok");
    expect(seg.quotes.find((q) => q.kind === "fx")?.rate).toBe(0);
  });
});
