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
// 평가금액÷수량(1주 평가액)과 가격이 "맞는다"고 볼 상대 오차: 일반(swap 판정) / 엄격(소수익률 교정)
const UNIT_MATCH = 0.02;
const UNIT_MATCH_STRICT = 0.002;

/** 수익률 외 2차 근거 (모두 선택). 서버 후처리 전용, 저장·전송 값 아님 */
export interface PriceEvidence {
  /** 수량이 화면에서 인식된 경우만 전달 (수량 미인식이면 생략) */
  quantity?: number;
  /** 총평가금액 */
  currentValue?: number;
  /** 평가손익 금액(부호 포함) */
  profitAmount?: number;
}

type UnitVerdict = "asIs" | "swap" | "none";

// E1: 평가금액÷수량이 어느 값에 맞는지. 둘 다/둘 다 아니면 근거 없음
function unitVerdict(cur: number, avg: number, ev: PriceEvidence | undefined, tol: number): UnitVerdict {
  const q = ev?.quantity ?? 0;
  const v = ev?.currentValue ?? 0;
  if (!(q > 0) || !(v > 0)) return "none";
  const unit = v / q;
  const nearCur = Math.abs(cur - unit) / unit <= tol;
  const nearAvg = Math.abs(avg - unit) / unit <= tol;
  if (nearCur && !nearAvg) return "asIs";
  if (nearAvg && !nearCur) return "swap";
  return "none";
}

// swap 시 평가손익이 평가금액·수량과 맞는지(평가금액 칸에 매입금액 등을 잘못 읽은 경우 걸러냄).
// 평가손익이 없으면 확인할 수 없으므로 통과
function swapMatchesProfitAmount(cur: number, avg: number, ev: PriceEvidence | undefined): boolean {
  const q = ev?.quantity ?? 0;
  const v = ev?.currentValue ?? 0;
  const pa = ev?.profitAmount ?? 0;
  if (!(q > 0) || !(v > 0) || pa === 0) return true;
  // swap 후 현재가=avg, 평단=cur → 기대 평가손익 = 평가금액 - cur × 수량
  const expected = v - cur * q;
  return Math.sign(expected) === Math.sign(pa) && Math.abs(expected - pa) <= v * 0.03;
}

export function reconcilePrices(
  currentPrice: number,
  averagePrice: number,
  profitRate: number,
  evidence?: PriceEvidence,
): PriceConsistencyResult {
  const keep = { currentPrice, averagePrice, action: "keep" as const };
  // 검증 불가(둘 중 하나 없음·수익률 없음)면 그대로 둔다
  if (!(currentPrice > 0) || !(averagePrice > 0) || !profitRate) return keep;

  const swap = { currentPrice: averagePrice, averagePrice: currentPrice, action: "swap" as const };

  const asIs = Math.abs(((currentPrice - averagePrice) / averagePrice) * 100 - profitRate);
  const swapped = Math.abs(((averagePrice - currentPrice) / currentPrice) * 100 - profitRate);
  // 수익률이 퍼센트가 아닌 비율(0.0839 = 8.39%)로 읽힌 경우: ×100하면 현재 읽기와 맞으면 평단을 지우지 않고 유지
  if (asIs > TOLERANCE_PP && swapped > TOLERANCE_PP && Math.abs(profitRate) < 1) {
    const asIsScaled = Math.abs(((currentPrice - averagePrice) / averagePrice) * 100 - profitRate * 100);
    // 지지 근거는 평가손익(존재 + 부호가 현재가-평단과 일치)만 인정. 평가금액은 swap 쪽일 때 차단용으로만 사용
    // (평가금액이 매입금액으로 오독돼도 단독 근거가 되지 않게). 평가손익이 없으면 기존 흐름(estimate)
    const pa = evidence?.profitAmount ?? 0;
    const unit = unitVerdict(currentPrice, averagePrice, evidence, UNIT_MATCH);
    const supported = pa !== 0 && Math.sign(pa) === Math.sign(currentPrice - averagePrice);
    if (asIsScaled <= TOLERANCE_PP && supported && unit !== "swap") return keep;
  }
  if (asIs <= TOLERANCE_PP) {
    // 소수익률: 두 해석이 모두 수익률상 가능할 때만(swapped도 허용폭 안) 평가금액÷수량이
    // swap 쪽에만 엄격히 맞고 평가손익과도 모순 없을 때 교정
    const ok =
      swapped <= TOLERANCE_PP &&
      (evidence?.profitAmount ?? 0) !== 0 && // 평가손익이 없으면 오독 평가금액을 못 걸러 4.99 동작(keep)
      unitVerdict(currentPrice, averagePrice, evidence, UNIT_MATCH_STRICT) === "swap" &&
      swapMatchesProfitAmount(currentPrice, averagePrice, evidence);
    return ok ? swap : keep;
  }

  if (swapped <= TOLERANCE_PP) {
    // swap 전 2차 근거 확인: 근거가 반대면 swap하지 않는다 (수익률 부호 누락 대비, C102)
    const e1 = unitVerdict(currentPrice, averagePrice, evidence, UNIT_MATCH);
    if (e1 === "asIs") return keep;
    if (e1 === "swap") return swapMatchesProfitAmount(currentPrice, averagePrice, evidence) ? swap : keep;
    // E2: 평가손익 부호와 수익률 부호가 다르면 수익률을 믿지 않는다
    const pa = evidence?.profitAmount ?? 0;
    if (pa !== 0 && Math.sign(pa) !== Math.sign(profitRate)) return keep;
    return swap;
  }
  // 둘 다 안 맞으면 평단을 믿지 않고 수익률로 역산(averagePriceEstimated 경로)
  return { currentPrice, averagePrice: 0, action: "estimate" };
}
