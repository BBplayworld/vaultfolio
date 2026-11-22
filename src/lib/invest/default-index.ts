// 투자 탭 기본 지수 판정용 보유 분할(기기 안 계산 전용). 결과는 저장하지도 서버·GA로 보내지도 않는다(보유 시장 역산 방지).
import type { AssetData } from "@/types/asset";

type StockLike = Pick<AssetData["stocks"][number], "category" | "quantity" | "currentPrice" | "currency" | "inactiveStatus">;

/** 국내·해외 주식 평가액(원 환산). 국내 = 국내주식, 해외 = 해외주식. 주식이 없거나 상장폐지뿐이면 null */
export function holdingSplit(stocks: readonly StockLike[], rates: { USD: number; JPY: number }): { domestic: number; overseas: number } | null {
  let domestic = 0, overseas = 0, n = 0;
  for (const s of stocks) {
    if (s.inactiveStatus === "delisted" || !(s.quantity > 0)) continue;
    const krw = s.currency === "USD" ? s.currentPrice * rates.USD : s.currency === "JPY" ? (s.currentPrice * rates.JPY) / 100 : s.currentPrice;
    const value = s.quantity * krw;
    if (s.category === "domestic") { domestic += value; n++; } else if (s.category === "foreign") { overseas += value; n++; }
  }
  return n ? { domestic, overseas } : null;
}
