// #157 가격 흐름 요청 — URL 키는 ticker·range 둘뿐(수량·평단·날짜 전송 0)
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildPriceHistoryUrl, requestPriceHistory } from "../use-price-history";

afterEach(() => vi.unstubAllGlobals());

describe("요청 키", () => {
  it("쿼리 키 집합 = {ticker, range}", () => {
    const url = new URL(buildPriceHistoryUrl("005930", "1y"), "https://x.test");
    expect(url.pathname).toBe("/api/finance/price-history");
    expect([...url.searchParams.keys()].sort()).toEqual(["range", "ticker"]);
    expect(url.searchParams.get("range")).toBe("1y");
  });
  it("fetch에는 URL만(본문·추가 헤더 없음), 5년은 range=5y", async () => {
    const f = vi.fn(async () => ({ ok: true, json: async () => ({ currency: "USD", interval: "W", points: [{ d: "2026-01-02", c: 1 }] }) }));
    vi.stubGlobal("fetch", f);
    const r = await requestPriceHistory("AAPL", "5y");
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit | undefined];
    expect(url).toBe("/api/finance/price-history?ticker=AAPL&range=5y");
    expect(init?.body).toBeUndefined();
    expect(r.currency).toBe("USD");
    expect(r.points).toHaveLength(1);
  });
  it("실패 응답은 throw(화면 오류 줄)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 503, json: async () => ({}) })));
    await expect(requestPriceHistory("AAPL", "1y")).rejects.toThrow();
  });
});
