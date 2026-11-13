import { afterEach, describe, expect, it, vi } from "vitest";
import { countFailedDividends, fetchDividend } from "../dividend-client";

function mockFetch(res: { ok: boolean; status?: number; headers?: Record<string, string>; json?: unknown }) {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
    ok: res.ok,
    status: res.status ?? (res.ok ? 200 : 500),
    headers: new Headers(res.headers),
    json: async () => res.json,
  }));
}

afterEach(() => vi.unstubAllGlobals());

describe("fetchDividend", () => {
  it("!res.ok(429·500)면 throw — 빈 배당으로 캐시되지 않음", async () => {
    mockFetch({ ok: false, status: 429, json: { data: [] } });
    await expect(fetchDividend("AAPL", "foreign")).rejects.toThrow();
  });

  it("X-KIS-Unavailable 200 빈 응답은 throw", async () => {
    mockFetch({ ok: true, headers: { "X-KIS-Unavailable": "1" }, json: { data: [] } });
    await expect(fetchDividend("005930", "domestic")).rejects.toThrow();
  });

  it("헤더 없는 200 빈 배열은 정상 []", async () => {
    mockFetch({ ok: true, json: { data: [] } });
    await expect(fetchDividend("TSLA", "foreign")).resolves.toEqual([]);
  });

  it("정상 데이터는 그대로 반환", async () => {
    const data = [{ payoutDate: "2026-12-01", amountPerShare: 1 }];
    mockFetch({ ok: true, json: { data } });
    await expect(fetchDividend("KO", "foreign")).resolves.toEqual(data);
  });
});

describe("countFailedDividends", () => {
  it("isError 쿼리만 센다", () => {
    expect(countFailedDividends([{ isError: true }, { isError: false }, { isError: true }])).toBe(2);
    expect(countFailedDividends([])).toBe(0);
  });
});
