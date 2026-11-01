// /ratio "예시로 먼저 보기" 고정 데이터(#66). 가상 종목·티커 없음, 환율 조회 없이 고정 환율로 계산한다.
import type { ParsedStock } from "@/lib/asset/screenshot-stock-map";
import { FALLBACK_JPY, FALLBACK_USD, type RatioRates } from "./ratio-list";

const base = { averagePrice: 1, purchaseDate: "2025-01-01" } as const;
const krw = (id: string, name: string, quantity: number, currentPrice: number): ParsedStock => ({
  ...base, id, name, quantity, currentPrice, category: "domestic", currency: "KRW", section: "국내", originalCurrency: "KRW",
});
const usd = (id: string, name: string, quantity: number, currentPrice: number): ParsedStock => ({
  ...base, id, name, quantity, currentPrice, category: "foreign", currency: "USD", section: "해외", originalCurrency: "USD",
});

/** 표시 순서 = 비중 내림차순: 28/22/16/14/12/8 (국내 58 · 해외 42) */
export const RATIO_SAMPLE_STOCKS: ParsedStock[] = [
  krw("sample-1", "가나전자", 40, 70000),
  usd("sample-2", "사아테크", 10, 159.42),
  krw("sample-3", "다라바이오", 20, 80000),
  krw("sample-4", "마바금융", 35, 40000),
  usd("sample-5", "자차클라우드", 5, 173.91),
  usd("sample-6", "카타에너지", 4, 144.93),
];

export const RATIO_SAMPLE_RATES: RatioRates = { USD: FALLBACK_USD, JPY: FALLBACK_JPY };
