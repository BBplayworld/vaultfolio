// #155 인증카드 금액 숨김 시 수량('N주')도 가려 평가금액 역산을 막는다. 일반 화면은 불변.
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { StockRowHeader } from "../stock-tab";
import type { Stock } from "@/types/asset";

const STOCK = {
  id: "s1", name: "테스트전자", ticker: "005930", category: "domestic", currency: "KRW",
  quantity: 1234, averagePrice: 70000, currentPrice: 80000,
} as unknown as Stock;

const base = { stock: STOCK, color: "#5b6fbf", pct: 50, currentVal: 98_720_000, profit: 12_340_000, profitRate: 14.3 };
const maskOn = (_: number) => "••••";
const maskOff = (v: number) => `${v.toLocaleString()}원`;

describe("StockRowHeader 수량 가림(#155)", () => {
  it("인증카드 + 금액 숨김: 수량 미노출", () => {
    const html = renderToStaticMarkup(<StockRowHeader {...base} maskFn={maskOn} screenshotMode />);
    expect(html).not.toContain("1,234");
    expect(html).toContain("••••주");
  });
  it("인증카드 + 금액 표시: 수량 그대로", () => {
    const html = renderToStaticMarkup(<StockRowHeader {...base} maskFn={maskOff} screenshotMode />);
    expect(html).toContain("1,234주");
  });
  it("일반 화면(maskFn 없음): 수량 그대로", () => {
    const html = renderToStaticMarkup(<StockRowHeader {...base} />);
    expect(html).toContain("1,234주");
  });
});
