import { describe, it, expect } from "vitest";
import { computeDailyStockProfit } from "../profit-utils";
import type { Stock } from "@/types/asset";
import type { ProfitRefResponse } from "@/app/api/finance/profit/route";

const RATES = { USD: 1400, JPY: 900 };

const makeStock = (o: Partial<Stock> = {}): Stock => ({
  id: "s1",
  ticker: "005930",
  category: "domestic",
  name: "테스트종목",
  quantity: 10,
  averagePrice: 100,
  currentPrice: 100,
  currency: "KRW",
  purchaseDate: "2024-01-01",
  ...o,
} as Stock);

// KRW 종목은 rateFor가 항상 1을 반환해 환율 이력(localStorage) 없이도 결정적으로 테스트 가능
describe("computeDailyStockProfit · useLivePrice (상세 > 주식 리스트 등락율 실시간화)", () => {
  it("useLivePrice 미지정(기본값 false) — 기존 종가 vs 종가 계산 그대로", () => {
    const stocks = [makeStock({ currentPrice: 999 })]; // 이 분기에서는 currentPrice 값 자체는 안 쓰임(truthy 가드만 통과하면 됨)
    const refData: ProfitRefResponse = {
      "005930": { refPrice: 110, refDate: "2026-08-27", prevPrice: 100, prevDate: "2026-08-26" },
    };
    const r = computeDailyStockProfit(stocks, refData, RATES);
    expect(r.dailyProfit).toBeCloseTo((110 - 100) * 10, 5);
    expect(r.dailyProfitRate).toBeCloseTo(10, 5);
  });

  it("장 마감 후(refDate=오늘)에는 baseline이 prevPrice이고, currentPrice=오늘종가면 기존 계산과 동일하게 수렴한다(회귀 없음)", () => {
    const today = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().split("T")[0];
    const stocks = [makeStock({ currentPrice: 110 })]; // 장마감 후라 currentPrice == 오늘 종가
    const refData: ProfitRefResponse = {
      "005930": { refPrice: 110, refDate: today, prevPrice: 100, prevDate: "2026-01-01" },
    };
    const live = computeDailyStockProfit(stocks, refData, RATES, { useLivePrice: true });
    const legacy = computeDailyStockProfit(stocks, refData, RATES);
    expect(live.dailyProfitRate).toBeCloseTo(legacy.dailyProfitRate!, 5);
    expect(live.dailyProfitRate).toBeCloseTo(10, 5);
  });

  it("장중(refDate≠오늘)에는 baseline이 refPrice(어제 종가)이고, currentPrice 실시간 변동이 즉시 반영된다", () => {
    const stocks = [makeStock({ currentPrice: 105 })]; // 어제 종가(100) 대비 +5% 장중 실시간가
    const refData: ProfitRefResponse = {
      // refDate가 오늘이 아님 = 아직 컷오프 전(장중), 이 경우 refPrice 자체가 "어제 종가"
      "005930": { refPrice: 100, refDate: "2000-01-01", prevPrice: 90, prevDate: "1999-12-31" },
    };
    const r = computeDailyStockProfit(stocks, refData, RATES, { useLivePrice: true });
    expect(r.dailyProfitRate).toBeCloseTo(5, 5);
    // 대조: 기존(종가 vs 종가) 계산은 어제 하루치 변동만 보여줘 오늘 장중 움직임을 반영하지 못한다
    const legacy = computeDailyStockProfit(stocks, refData, RATES);
    expect(legacy.dailyProfitRate).toBeCloseTo(((100 - 90) / 90) * 100, 5);
  });
});
