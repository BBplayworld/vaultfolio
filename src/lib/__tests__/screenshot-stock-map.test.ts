import { describe, it, expect } from "vitest";
import {
  applyCommonDefaults,
  BROKER_NONE,
  isMixedSections,
  mapParsedStocks,
  type ParsedStock,
} from "@/lib/asset/screenshot-stock-map";

const USD_RATE = 1380;

function p(name: string, section: ParsedStock["section"], price: number, extra: Partial<ParsedStock> = {}): ParsedStock {
  return {
    id: name,
    name,
    ticker: name,
    category: section === "해외" ? "foreign" : "domestic",
    quantity: 10,
    averagePrice: price,
    currentPrice: price,
    section,
    originalCurrency: section === "해외" ? "USD" : "KRW",
    ...extra,
  } as unknown as ParsedStock;
}

const mixed = [
  p("삼성전자", "국내", 70000),
  p("카카오", "국내", 50000),
  p("네이버", "국내", 200000),
  p("AAPL", "해외", 200),
  p("TSLA", "해외", 250),
];

describe("mapParsedStocks (#64 혼합 인식)", () => {
  it("isMixed: 국내·해외 함께 있을 때만 true", () => {
    expect(mapParsedStocks(mixed, {}).isMixed).toBe(true);
    expect(mapParsedStocks(mixed.slice(0, 3), {}).isMixed).toBe(false);
    expect(mapParsedStocks(mixed.slice(3), {}).isMixed).toBe(false);
    expect(isMixedSections([{ section: "기타" }, { section: "해외" }])).toBe(true);
  });

  it("결함 고정: 혼합 결과에 공통 일괄 변환을 적용하면 해외 2종목이 국내로 바뀌고 가격이 ×환율", () => {
    const { stocks, defaultCategory, defaultBroker } = mapParsedStocks(mixed, {});
    const converted = applyCommonDefaults(stocks, defaultCategory, defaultBroker, USD_RATE);
    expect(converted.filter((s) => s.category === "foreign")).toHaveLength(0);
    expect(converted.find((s) => s.name === "AAPL")?.currentPrice).toBe(200 * USD_RATE);
  });

  it("수정 후: 혼합이면 매핑 결과가 국내 3·해외 2, 가격 원본 유지", () => {
    const { stocks } = mapParsedStocks(mixed, {});
    expect(stocks.filter((s) => s.category === "foreign").map((s) => s.name)).toEqual(["AAPL", "TSLA"]);
    expect(stocks.filter((s) => s.category === "domestic")).toHaveLength(3);
    expect(stocks.find((s) => s.name === "AAPL")?.currentPrice).toBe(200);
    expect(stocks.find((s) => s.name === "삼성전자")?.currentPrice).toBe(70000);
  });

  it("단일 section(국내만·해외만): 공통 적용 결과 스냅샷 동일", () => {
    const dom = mapParsedStocks(mixed.slice(0, 3), {});
    const domFinal = applyCommonDefaults(dom.stocks, dom.defaultCategory, dom.defaultBroker, USD_RATE);
    expect(dom.defaultCategory).toBe("domestic");
    expect(domFinal.map((s) => [s.name, s.category, s.currentPrice])).toEqual([
      ["삼성전자", "domestic", 70000],
      ["카카오", "domestic", 50000],
      ["네이버", "domestic", 200000],
    ]);
    const fr = mapParsedStocks(mixed.slice(3), {});
    const frFinal = applyCommonDefaults(fr.stocks, fr.defaultCategory, fr.defaultBroker, USD_RATE);
    expect(fr.defaultCategory).toBe("foreign");
    expect(frFinal.map((s) => [s.name, s.category, s.currentPrice, s.originalCurrency])).toEqual([
      ["AAPL", "foreign", 200, "USD"],
      ["TSLA", "foreign", 250, "USD"],
    ]);
  });

  it("activeTab 국내계열이면 국내 종목 카테고리를 탭으로, 동일 ticker 2번째는 '항목 2'", () => {
    const { stocks, defaultCategory } = mapParsedStocks(
      [p("삼성전자", "국내", 1), p("삼성전자", "국내", 1)],
      { activeTab: "isa" },
    );
    expect(defaultCategory).toBe("isa");
    expect(stocks.map((s) => s.category)).toEqual(["isa", "isa"]);
    expect(stocks[1].broker).toBe("항목 2");
  });

  it("증권사 힌트 없으면 BROKER_NONE", () => {
    expect(mapParsedStocks(mixed, {}).defaultBroker).toBe(BROKER_NONE);
  });
});
