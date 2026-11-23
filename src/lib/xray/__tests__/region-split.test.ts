// 5.142 B2: 내 주식 국내·해외 = 주식 X-Ray 지역 축 값 그대로(100−국내 금지), 네트워크·저장 0
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Stock } from "@/types/asset";
import { regionSplit } from "../region-split";
import { computeBreakdown, formatBreakdownPct } from "../stock-xray";

const rates = { USD: 1400, JPY: 900 } as never;
const st = (o: Partial<Stock>): Stock => ({ id: o.ticker ?? "x", name: "종목", ticker: "T", category: "domestic", quantity: 1, currentPrice: 1000, averagePrice: 1000, currency: "KRW", purchaseDate: "2020-01-01", ...o }) as Stock;
let fetchSpy: ReturnType<typeof vi.fn>;
beforeEach(() => { fetchSpy = vi.fn(); vi.stubGlobal("fetch", fetchSpy); });
afterEach(() => { vi.unstubAllGlobals(); });

describe("regionSplit = X-Ray 지역 축 값", () => {
  const cases: [string, Stock[]][] = [
    ["국내 주식만", [st({ ticker: "005930", name: "삼성전자", currentPrice: 70000, quantity: 3 })]],
    ["해외 직접투자(미국·일본)", [st({ ticker: "AAPL", category: "foreign", currency: "USD", currentPrice: 200, quantity: 2 }), st({ ticker: "7203", category: "foreign", currency: "JPY", currentPrice: 3000, quantity: 5 })]],
    ["국내 ETF 해외지수(미국)·국내 개별주", [st({ ticker: "360750", name: "TIGER 미국S&P500", currentPrice: 20000, quantity: 10 }), st({ ticker: "005930", name: "삼성전자", currentPrice: 70000, quantity: 3 })]],
    ["기타(유럽 ETF) 포함", [st({ ticker: "195930", name: "TIGER 유로스탁스50", currentPrice: 15000, quantity: 10 }), st({ ticker: "AAPL", category: "foreign", currency: "USD", currentPrice: 200, quantity: 2 }), st({ ticker: "005930", name: "삼성전자", currentPrice: 70000, quantity: 2 })]],
  ];
  it.each(cases)("%s: 국내·해외·기타가 X-Ray 항목 값과 같다", (_n, stocks) => {
    const s = regionSplit(stocks, rates)!;
    const r = computeBreakdown("region", stocks, rates);
    const pct = (keys: string[]) => formatBreakdownPct(r.items.filter((i) => keys.includes(i.key)).reduce((a, i) => a + i.ratio, 0));
    expect(s.domestic).toBe(pct(["KR"]));
    expect(s.other).toBe(pct(["Other"]));
    expect(s.overseas).toBe(pct(["US", "JP", "CN", "HK"]));
    expect(s.domestic).toBe(formatBreakdownPct(r.items.find((i) => i.key === "KR")?.ratio ?? 0));
    expect(fetchSpy).not.toHaveBeenCalled();
  });
  it("기타가 있으면 0보다 크고, 해외는 100−국내로 만들지 않는다", () => {
    const s = regionSplit(cases[3][1], rates)!;
    expect(s.other).toBeGreaterThan(0);
    expect(s.overseas).not.toBe(Math.round((100 - s.domestic) * 10) / 10);
  });
  it("주식이 없거나 상장폐지·수량 0뿐이면 null", () => {
    expect(regionSplit([], rates)).toBeNull();
    expect(regionSplit([st({ inactiveStatus: "delisted" }), st({ quantity: 0, ticker: "B" })], rates)).toBeNull();
  });
});
