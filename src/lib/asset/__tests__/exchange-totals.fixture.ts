// #325(5.163) 거래소별 합계 테스트 픽스처 — 거래소 3곳·미지정·`기타`·같은 코인 2개 거래소·현재가 0 코인(spec 8-4)
import type { AssetData, Crypto } from "@/types/asset";
import { computeAssetCost, computeNetAsset } from "@/contexts/asset-data-context";

const RATES = { USD: 1387.3, JPY: 911 };
export const co = (o: Partial<Crypto>): Crypto =>
  ({ id: "c", name: "비트코인", symbol: "BTC", quantity: 0.1, averagePrice: 90000000.5, currentPrice: 141234567.3, purchaseDate: "2025-01-01", ...o }) as Crypto;

// 거래소 3곳·미지정·`기타`·같은 코인 2개 거래소·현재가 0 코인(spec 8-4)
export const FIXTURE: Crypto[] = [
  co({ id: "a1", exchange: "업비트", quantity: 0.12345678 }),
  co({ id: "a2", exchange: " 업비트 ", symbol: "ETH", name: "이더리움", quantity: 1.7, averagePrice: 4000000.4, currentPrice: 5123456.7 }),
  co({ id: "a3", exchange: "upbit", symbol: "btc", quantity: 0.01 }),
  co({ id: "b1", exchange: "빗썸", quantity: 0.0333 }),
  co({ id: "c1", exchange: "바이낸스", symbol: "SOL", name: "솔라나", quantity: 12.5, averagePrice: 250000.3, currentPrice: 201234.9 }),
  co({ id: "d1", exchange: "기타", symbol: "XRP", name: "리플", quantity: 1000.5, averagePrice: 800.7, currentPrice: 3333.3 }),
  co({ id: "e1", exchange: "코인", symbol: "DOGE", name: "도지", quantity: 777.7, averagePrice: 100.1, currentPrice: 555.5 }),
  co({ id: "e2", exchange: "코인원", symbol: "DOGE", name: "도지", quantity: 10.1, averagePrice: 100.1, currentPrice: 555.5 }),
  co({ id: "z1", exchange: "코빗", symbol: "NEW", name: "시세없음", quantity: 3, averagePrice: 10000.5, currentPrice: 0 }),
  co({ id: "u1", exchange: "", symbol: "ADA", name: "에이다", quantity: 50.5, averagePrice: 500.5, currentPrice: 1234.5 }),
  co({ id: "u2", exchange: undefined, symbol: "ADA", name: "에이다", quantity: 1.5, averagePrice: 500.5, currentPrice: 1234.5 }),
  co({ id: "u3", exchange: "항목 2", symbol: "TRX", name: "트론", quantity: 9.9, averagePrice: 100, currentPrice: 432.1 }),
  co({ id: "q0", exchange: "크라켄", symbol: "ZERO", name: "수량0", quantity: 0 }),
];

const data = (crypto: Crypto[]) => ({ stocks: [], crypto, cash: [], realEstate: [], loans: [], physicalAssets: [] }) as unknown as AssetData;
/** 요약 헤더가 보여 주는 값(getAssetSummary와 같은 헬퍼·같은 식) */
export const header = (crypto: Crypto[]) => {
  const cryptoValue = computeNetAsset(data(crypto), RATES).cryptoValue;
  const cryptoProfit = cryptoValue - computeAssetCost(data(crypto), RATES).cryptoCost;
  return { cryptoValue, cryptoProfit };
};
