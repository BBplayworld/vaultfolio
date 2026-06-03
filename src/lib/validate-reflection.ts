import type { Transaction, PositionSnapshot, GuardResult } from "@/types/transaction";
import { computeNewPosition } from "./trade-utils";

/**
 * 거래 반영 전 정합성 검증
 * - Case 2: 보유 초과 매도 → restrict
 * - Case 4: 중복 반영 → restrict
 * - Case 1: 직접 입력값 충돌 → confirm (preview 포함)
 * - Case 3: 과거 날짜 역행 → confirm (preview 포함)
 * - 통과 → pass
 */
export function validateReflection(
  tx: Transaction,
  pos: PositionSnapshot,
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
