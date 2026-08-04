import type { GuardResult } from "@/types/transaction";
import { computeNewPosition, type TxLike, type PositionLike } from "./trade-utils";

/**
 * 거래 반영 전 정합성 검증 — 주식뿐 아니라 코인 등 동일한 수량×평단 가중평균 구조를 가진
 * 자산이면 그대로 재사용 가능하도록 TxLike/PositionLike 구조적 타입을 받는다.
 * - Case 2: 보유 초과 매도 → restrict
 * - Case 4: 중복 반영 → restrict
 * - Case 1: 직접 입력값 충돌 → confirm (preview 포함)
 * - Case 3: 과거 날짜 역행 → confirm (preview 포함)
 * - 통과 → pass
 */
export function validateReflection<P extends PositionLike>(
  tx: TxLike & { reflectionId?: string },
  pos: P,
): GuardResult {
  // Case 2: 보유 초과 매도 (제한)
  if (tx.type === "sell" && tx.quantity > pos.quantity) {
    return { level: "restrict", reason: "oversell", maxQty: pos.quantity };
  }

  // Case 4: 중복 반영 (제한)
  if (tx.reflected && tx.reflectionId) {
    return { level: "restrict", reason: "already_reflected" };
  }

  // Case 1: 직접 입력값 변경 (확인)
  if (pos.lockedByManual) {
    const preview = computeNewPosition(pos, tx);
    return { level: "confirm", reason: "manual_override", preview };
  }

  // Case 3: 과거 날짜 역행 (확인)
  if (tx.date < pos.effectiveDate) {
    const preview = computeNewPosition(pos, tx);
    return { level: "confirm", reason: "backdated", preview };
  }

  // 통과 — 바로 반영
  return { level: "pass", preview: computeNewPosition(pos, tx) };
}
