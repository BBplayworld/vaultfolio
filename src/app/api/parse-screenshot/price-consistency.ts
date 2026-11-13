// 2줄 헤더 표(현재가/평균단가가 한 칸에 위·아래로 쌓인 증권사)에서 AI가 두 값을 바꿔 읽은 경우를
// 수익률로 검증·교정하는 순수 함수. 서버 후처리 전용 (저장·전송 값 변경 없음).

export type PriceConsistency = "keep" | "swap" | "estimate";

export interface PriceConsistencyResult {
  currentPrice: number;
  averagePrice: number;
  action: PriceConsistency;
}

// 수수료·세금·환율로 생기는 수익률 오차 허용치(%p)
const TOLERANCE_PP = 3;

export function reconcilePrices(
  currentPrice: number,
  averagePrice: number,
  profitRate: number,
): PriceConsistencyResult {
  const keep = { currentPrice, averagePrice, action: "keep" as const };
  // 검증 불가(둘 중 하나 없음·수익률 없음)면 그대로 둔다
  if (!(currentPrice > 0) || !(averagePrice > 0) || !profitRate) return keep;

  const asIs = Math.abs(((currentPrice - averagePrice) / averagePrice) * 100 - profitRate);
  if (asIs <= TOLERANCE_PP) return keep;

  const swapped = Math.abs(((averagePrice - currentPrice) / currentPrice) * 100 - profitRate);
  if (swapped <= TOLERANCE_PP) {
    return { currentPrice: averagePrice, averagePrice: currentPrice, action: "swap" };
  }
  // 둘 다 안 맞으면 평단을 믿지 않고 수익률로 역산(averagePriceEstimated 경로)
  return { currentPrice, averagePrice: 0, action: "estimate" };
}
