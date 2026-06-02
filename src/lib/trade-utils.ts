import type { Transaction, PositionSnapshot, PositionPreview } from "@/types/transaction";

// 거래 로그 최대 보존 기간(년). 이보다 오래된 기록은 자동 정리.
export const TRANSACTION_RETENTION_YEARS = 3;

/** 보존 기간(기본 3년)보다 오래된 거래 로그 제거 — tx.date 기준 롤링 윈도우 */
export function pruneTransactions(
  transactions: Transaction[],
  years: number = TRANSACTION_RETENTION_YEARS,
): Transaction[] {
  const cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - years);
  const cutoffStr = cutoff.toISOString().split("T")[0];
  return transactions.filter((t) => t.date >= cutoffStr);
}

/**
 * 중복 거래 탐지 — 증권사(=stockId) · 날짜 · 수량 · 체결가 · 유형이 모두 동일한 기존 거래 반환
 */
export function findDuplicateTransaction(
  transactions: Transaction[],
  c: { stockId: string; date: string; quantity: number; price: number; type: "buy" | "sell" },
): Transaction | undefined {
  return transactions.find(
    (t) =>
      t.stockId === c.stockId &&
      t.date === c.date &&
      t.quantity === c.quantity &&
      t.price === c.price &&
      t.type === c.type,
  );
}

/**
 * 매수 시 가중평균 평단 재계산, 매도 시 수량 차감 + 평단 유지
 */
export function computeNewPosition(
  current: PositionSnapshot,
  tx: Transaction,
): PositionPreview {
  if (tx.type === "buy") {
    const totalQty = current.quantity + tx.quantity;
    if (totalQty === 0) {
      return { quantity: 0, avgPrice: 0, avgExchangeRate: 0 };
    }
    // 가중평균 평단
    const avgPrice =
      (current.avgPrice * current.quantity + tx.price * tx.quantity) / totalQty;
    // 가중평균 환율 (해외주식)
    const txRate = tx.exchangeRate ?? current.avgExchangeRate;
    const avgExchangeRate =
      (current.avgExchangeRate * current.quantity + txRate * tx.quantity) /
      totalQty;

    return {
      quantity: totalQty,
      avgPrice,
      avgExchangeRate,
    };
  }

  // 매도: 수량 차감, 평단 유지
  const remainQty = current.quantity - tx.quantity;
  return {
    quantity: Math.max(0, remainQty),
    avgPrice: remainQty > 0 ? current.avgPrice : 0,
    avgExchangeRate: remainQty > 0 ? current.avgExchangeRate : 0,
  };
}

/**
 * 기준 스냅샷 + 반영된 거래들의 시간순 적용으로 포지션 재계산
 */
export function recomputeFromLog(
  baseSnapshot: PositionSnapshot,
  transactions: Transaction[],
): PositionSnapshot {
  const sorted = [...transactions]
    .filter((t) => t.reflected)
    .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt));

  let current: PositionSnapshot = { ...baseSnapshot };

  for (const tx of sorted) {
    const preview = computeNewPosition(current, tx);
    current = {
      ...current,
      quantity: preview.quantity,
      avgPrice: preview.avgPrice,
      avgExchangeRate: preview.avgExchangeRate,
      source: "computed",
      effectiveDate: tx.date,
    };
  }

  return current;
}

/**
 * computeNewPosition의 역연산 — 현재 포지션에서 한 거래의 효과를 제거
 */
export function reverseTransaction(
  current: PositionSnapshot,
  tx: Transaction,
): PositionPreview {
  if (tx.type === "buy") {
    const qtyBefore = current.quantity - tx.quantity;
    if (qtyBefore <= 0) {
      return { quantity: Math.max(0, qtyBefore), avgPrice: 0, avgExchangeRate: 0 };
    }
    // 가중평균 평단 역산: (현재평단*현재수량 - 체결가*체결수량) / 이전수량
    const avgPrice =
      (current.avgPrice * current.quantity - tx.price * tx.quantity) / qtyBefore;
    const txRate = tx.exchangeRate ?? current.avgExchangeRate;
    const avgExchangeRate =
      (current.avgExchangeRate * current.quantity - txRate * tx.quantity) / qtyBefore;
    return { quantity: qtyBefore, avgPrice, avgExchangeRate };
  }
  // 매도 역연산: 수량 복원, 평단·환율은 매도가 바꾸지 않았으므로 유지
  return {
    quantity: current.quantity + tx.quantity,
    avgPrice: current.avgPrice,
    avgExchangeRate: current.avgExchangeRate,
  };
}

/**
 * 현재 포지션에서 반영된 모든 거래를 역순으로 제거 →
 * 거래로그에 기록되지 않은 '기준(수동) 보유분' 복원
 */
export function deriveBaseSnapshot(
  currentPosition: PositionSnapshot,
  transactions: Transaction[],
): PositionSnapshot {
  const sorted = [...transactions]
    .filter((t) => t.reflected)
    .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt));

  let current: PositionSnapshot = { ...currentPosition };
  for (let i = sorted.length - 1; i >= 0; i--) {
    const prev = reverseTransaction(current, sorted[i]);
    current = {
      ...current,
      quantity: prev.quantity,
      avgPrice: prev.avgPrice,
      avgExchangeRate: prev.avgExchangeRate,
    };
  }
  return current;
}

/**
 * 반영된 거래 삭제 시 포지션 재계산
 * - 현재 포지션에서 반영 거래를 전부 역산해 기준 보유분(수동 보유분 포함)을 복원한 뒤,
 *   삭제 대상을 뺀 거래들을 재적용 → 거래로그에 없는 최초 보유분이 유실되지 않음
 */
export function rollbackTransaction(
  currentPosition: PositionSnapshot,
  allTransactions: Transaction[],
  removeTxId: string,
): PositionSnapshot {
  const base = deriveBaseSnapshot(currentPosition, allTransactions);
  const remaining = allTransactions.filter((t) => t.id !== removeTxId);
  return recomputeFromLog(base, remaining);
}
