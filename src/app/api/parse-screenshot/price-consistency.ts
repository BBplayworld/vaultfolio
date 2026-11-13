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

/** 이미지 단위 다수결용 표: asIs=읽은 그대로가 맞다고 수익률로 명확히 갈림, swap=바꿔야 한다고 명확히 갈림, null=애매·근거 없음 */
type Vote = "asIs" | "swap" | null;

export function reconcilePrices(
  currentPrice: number,
  averagePrice: number,
  profitRate: number,
  evidence?: PriceEvidence,
): PriceConsistencyResult {
  return classifyRow(currentPrice, averagePrice, profitRate, evidence).result;
}

function classifyRow(
  currentPrice: number,
  averagePrice: number,
  profitRate: number,
  evidence?: PriceEvidence,
): { result: PriceConsistencyResult; vote: Vote; ambiguous: boolean } {
  const keepR = { currentPrice, averagePrice, action: "keep" as const };
  const none = (result: PriceConsistencyResult) => ({ result, vote: null as Vote, ambiguous: false });
  // 검증 불가(둘 중 하나 없음·수익률 없음)면 그대로 둔다
  if (!(currentPrice > 0) || !(averagePrice > 0) || !profitRate) return none(keepR);
  const r = reconcileCore(currentPrice, averagePrice, profitRate, evidence);
  const asIs = Math.abs(((currentPrice - averagePrice) / averagePrice) * 100 - profitRate);
  const swapped = Math.abs(((averagePrice - currentPrice) / currentPrice) * 100 - profitRate);
  // 두 해석이 수익률상 모두 가능한 소수익률 행은 한 행만으로 방향을 정할 수 없다(이미지 단위로 정함)
  const ambiguous = asIs <= TOLERANCE_PP && swapped <= TOLERANCE_PP;
  if (r.action === "estimate") return none(r);
  if (r.action === "swap") return { result: r, vote: ambiguous ? null : "swap", ambiguous: false };
  // keep: 수익률로 읽은 그대로가 명확히 맞는 행만 asIs 표
  return { result: r, vote: asIs <= TOLERANCE_PP && swapped > TOLERANCE_PP ? "asIs" : null, ambiguous };
}

export interface PriceRowInput {
  currentPrice: number;
  averagePrice: number;
  profitRate: number;
  evidence?: PriceEvidence;
}

/** 다수결이 "명확"하다고 보는 조건: 최소 표 수, 반대 표 대비 배수 */
const MIN_VOTES = 2;
const MAJORITY_RATIO = 3;

/**
 * 한 이미지(한 응답)의 종목들을 함께 교정한다. 행마다 reconcilePrices를 적용하되, 수익률로 swap이 명확히 갈리는 행들의
 * 다수결이 swap으로 명확하면(표 2 이상, 반대 표의 3배 이상) 소수익률이라 방향을 못 정한 행에도 같은 방향(swap)을 적용한다.
 * 한 이미지는 현재가/평균단가 위치가 모두 같기 때문이다. 단 평가손익이 없거나 부호가 swap 결과와 모순이거나, 평가금액÷수량이 읽은 그대로와 맞으면 그 행은 그대로 둔다.
 * 동률·근거 부족이면 행별 결과 그대로(기존 동작). asIs가 다수면 애매한 행은 어차피 그대로라 변화 없음.
 */
export function reconcileImagePrices(rows: PriceRowInput[]): PriceConsistencyResult[] {
  const cls = rows.map((r) => classifyRow(r.currentPrice, r.averagePrice, r.profitRate, r.evidence));
  const swapVotes = cls.filter((c) => c.vote === "swap").length;
  const asIsVotes = cls.filter((c) => c.vote === "asIs").length;
  const swapMajority = swapVotes >= MIN_VOTES && swapVotes >= asIsVotes * MAJORITY_RATIO;
  return cls.map((c, i) => {
    if (!swapMajority || !c.ambiguous || c.result.action !== "keep") return c.result;
    const { currentPrice: cur, averagePrice: avg, evidence } = rows[i];
    const pa = evidence?.profitAmount ?? 0;
    // 평가손익이 없으면 다수결을 적용하지 않는다(근거 없이 새로 뒤집지 않음, C102)
    if (pa === 0) return c.result;
    // 평가손익 부호가 swap 결과(avg-cur)와 다르면 swap은 평가손익과 모순
    if (Math.sign(pa) !== Math.sign(avg - cur)) return c.result;
    // 평가금액÷수량이 읽은 그대로에 엄격히 맞으면 읽은 그대로가 맞다는 근거라 다수결로 덮지 않는다
    if (unitVerdict(cur, avg, evidence, UNIT_MATCH_STRICT) === "asIs") return c.result;
    if (cur === avg) return c.result;
    return { currentPrice: avg, averagePrice: cur, action: "swap" };
  });
}

function reconcileCore(
  currentPrice: number,
  averagePrice: number,
  profitRate: number,
  evidence?: PriceEvidence,
): PriceConsistencyResult {
  const keep = { currentPrice, averagePrice, action: "keep" as const };

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
