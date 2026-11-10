// #132 A18 — 칩 종가일 = 비교 페이지 하루 끝 종가일이면 칩 값 = 그 종목 줄의 하루 값(소수 1자리), 국내·미국 모두
import { describe, expect, it } from "vitest";
import type { Stock } from "@/types/asset";
import type { ProfitRefResponse } from "@/app/api/finance/profit/route";
import { getStockChipQuote } from "../today-chip";
import { classifyHoldings, computePeriodCell, formatCompareRate, rateTenths } from "../market-compare";

const st = (o: Partial<Stock>): Stock => ({
  id: o.ticker ?? "x", category: "domestic", name: o.ticker ?? "x", ticker: "005930", quantity: 3,
  averagePrice: 100, currentPrice: 999999, currency: "KRW", purchaseDate: "2026-11-01", ...o,
} as Stock);

// 화 2026-11-10 20:00 KST: 국내 장 종료 후(11/9→11/10), 미국 개장 전(11/6→11/9). 종가 기준 kstAccessDay 응답
const NOW = new Date("2026-11-10T20:00:00+09:00");
const DAILY: ProfitRefResponse = {
  "005930": { refPrice: 101900, refDate: "2026-11-10", prevPrice: 100000, prevDate: "2026-11-09" },
  AAPL: { refPrice: 213.37, refDate: "2026-11-09", prevPrice: 208.11, prevDate: "2026-11-06" },
};
const IDX = {
  daily: {
    KOSPI: { refPrice: 5239.13, refDate: "2026-11-10", prevPrice: 5018.85, prevDate: "2026-11-09" },
    SPX: { refPrice: 7549.94, refDate: "2026-11-09", prevPrice: 7376.86, prevDate: "2026-11-06" },
  },
};

describe("A18 칩 값 = 비교 페이지 하루 종목 줄 값", () => {
  it.each([
    ["국내", st({ ticker: "005930" }), "kr" as const],
    ["미국", st({ ticker: "AAPL", category: "foreign", currency: "USD" }), "us" as const],
  ])("%s", (_l, stock, market) => {
    const q = getStockChipQuote(stock, DAILY, NOW)!;
    expect(q.live).toBe(false);
    const chipRate = (q.numerator / q.denominator - 1) * 100;
    const cell = computePeriodCell(market, "daily", classifyHoldings([stock], new Set(["005930"]))[market], { daily: DAILY }, IDX);
    expect(cell.endDate).toBe(q.closeDate);
    const row = cell.rows.find((r) => r.kind === "stock")!;
    expect(rateTenths(row.rate!)).toBe(rateTenths(chipRate));
    // 칩은 ▲/▼ + 절대값 toFixed(1), 페이지는 부호 + 같은 자릿수
    expect(formatCompareRate(row.rate!).replace(/^[+-]/, "")).toBe(`${Math.abs(chipRate).toFixed(1)}%`);
  });
});
