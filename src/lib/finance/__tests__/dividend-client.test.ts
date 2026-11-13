import { afterEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { countFailedDividends, dividendQueryOptions, fetchDividend } from "../dividend-client";

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

describe("실패 쿼리 재조회 차단 (#189 qa FAIL 회귀)", () => {
  async function mountOnce(qc: QueryClient, ticker: string, type: string) {
    const o = new QueryObserver(qc, { ...dividendQueryOptions(ticker, type), enabled: true });
    const un = o.subscribe(() => {});
    await vi.waitFor(() => expect(o.getCurrentResult().isFetching).toBe(false));
    un();
  }
  it("1종목 실패(KIS 불가) + 관찰자 재마운트 5회 → 요청 수 ≤ 종목 수", async () => {
    const f = vi.fn(async (url: string) => {
      const bad = String(url).includes("NVDA");
      return {
        ok: true, status: 200,
        headers: new Headers(bad ? { "X-KIS-Unavailable": "1" } : {}),
        json: async () => ({ data: bad ? [] : [{ payoutDate: "2026-12-01", amountPerShare: 1 }] }),
      };
    });
    vi.stubGlobal("fetch", f);
    const qc = new QueryClient();
    const tickers = ["AAPL", "NVDA", "KO"];
    for (let i = 0; i < 5; i += 1) for (const t of tickers) await mountOnce(qc, t, "foreign");
    expect(f).toHaveBeenCalledTimes(tickers.length);
    qc.clear();
  });
  it("실패 쿼리는 error 상태·data undefined로 남는다", async () => {
    mockFetch({ ok: false, status: 429, json: {} });
    const qc = new QueryClient();
    await mountOnce(qc, "NVDA", "foreign");
    const st = qc.getQueryState(["dividend", "v11", "NVDA", "foreign"]);
    expect(st?.status).toBe("error");
    expect(st?.data).toBeUndefined();
    qc.clear();
  });
});

describe("실패를 0·없음으로 말하지 않기 (C101)", () => {
  it("전부 실패(합계 0, 실패>0)·1종목 보유 1개 실패 → unknown", async () => {
    const { isDividendUnknown } = await import("../dividend-client");
    expect(isDividendUnknown(3, 0)).toBe(true);
    expect(isDividendUnknown(1, 0)).toBe(true);
  });
  it("부분 실패(합계>0)·실패 없음(진짜 0) → unknown 아님", async () => {
    const { isDividendUnknown } = await import("../dividend-client");
    expect(isDividendUnknown(1, 12000)).toBe(false);
    expect(isDividendUnknown(0, 0)).toBe(false);
  });
  it("안내 문구는 '일부'가 아니라 1종목 보유·전부 실패에도 맞는 표현", async () => {
    const { DIVIDEND_FETCH_FAILED_MESSAGE } = await import("../dividend-client");
    expect(DIVIDEND_FETCH_FAILED_MESSAGE).toBe("배당을 불러오지 못한 종목이 있어요. 앱을 다시 열면 다시 불러올게요");
  });
});
