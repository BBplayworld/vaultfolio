import type { Transaction, PositionSnapshot, PositionPreview } from "@/types/transaction";

// 거래 로그 최대 보존 기간(년). 이보다 오래된 기록은 자동 정리.
export const TRANSACTION_RETENTION_YEARS = 3;

// 아래 포지션 재계산 함수들이 실제로 읽는 최소 필드만 뽑은 구조적 타입 — 주식(Transaction·
// PositionSnapshot)뿐 아니라 코인(CryptoTransaction·코인 포지션)도 그대로 통과시켜 가중평균
// 재계산 수학을 복제하지 않고 재사용한다. 제네릭 P가 각 자산의 고유 id 필드(stockId·cryptoId
// 등)를 보존한 채로 spread를 타고 다시 나온다.
export interface TxLike {
  type: "buy" | "sell";
  quantity: number;
  price: number;
  exchangeRate?: number;
  date: string;
  reflected: boolean;
  createdAt: string;
}

export interface PositionLike {
  quantity: number;
  avgPrice: number;
  avgExchangeRate: number;
  source: "manual" | "computed";
  effectiveDate: string;
  lockedByManual: boolean;
}

/** 보존 기간(기본 3년)보다 오래된 거래 로그 제거 — tx.date 기준 롤링 윈도우 */
export function pruneTransactions<T extends { date: string }>(
  transactions: T[],
  years: number = TRANSACTION_RETENTION_YEARS,
): T[] {
  const cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - years);
  const cutoffStr = cutoff.toISOString().split("T")[0];
  return transactions.filter((t) => t.date >= cutoffStr);
}

/**
 * 중복 거래 탐지 — 자산 id(주식=stockId·코인=cryptoId) · 날짜 · 수량 · 체결가 · 유형이
 * 모두 동일한 기존 거래 반환. assetIdKey로 어떤 필드를 자산 id로 볼지 지정한다.
 */
export function findDuplicateTransaction<T extends { date: string; quantity: number; price: number; type: "buy" | "sell" }>(
  transactions: T[],
  assetIdKey: keyof T,
  c: { assetId: string; date: string; quantity: number; price: number; type: "buy" | "sell" },
): T | undefined {
  return transactions.find(
    (t) =>
      t[assetIdKey] === c.assetId &&
      t.date === c.date &&
      t.quantity === c.quantity &&
      t.price === c.price &&
      t.type === c.type,
  );
}

/**
 * 매수 시 가중평균 평단 재계산, 매도 시 수량 차감 + 평단 유지
 */
export function computeNewPosition<P extends PositionLike>(
  current: P,
  tx: TxLike,
): PositionPreview {
  if (tx.type === "buy") {
    const totalQty = current.quantity + tx.quantity;
    if (totalQty === 0) {
      return { quantity: 0, avgPrice: 0, avgExchangeRate: 0 };
    }
    // 가중평균 평단
    const avgPrice =
      (current.avgPrice * current.quantity + tx.price * tx.quantity) / totalQty;
    // 가중평균 환율 (해외주식. 코인 등 환율 없는 자산은 exchangeRate가 항상 undefined라 0 유지)
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
export function recomputeFromLog<P extends PositionLike>(
  baseSnapshot: P,
  transactions: TxLike[],
): P {
  const sorted = [...transactions]
    .filter((t) => t.reflected)
    .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt));

  let current: P = { ...baseSnapshot };

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
export function reverseTransaction<P extends PositionLike>(
  current: P,
  tx: TxLike,
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
export function deriveBaseSnapshot<P extends PositionLike>(
  currentPosition: P,
  transactions: TxLike[],
): P {
  const sorted = [...transactions]
    .filter((t) => t.reflected)
    .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt));

  let current: P = { ...currentPosition };
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
export function rollbackTransaction<P extends PositionLike, T extends TxLike & { id: string }>(
  currentPosition: P,
  allTransactions: T[],
  removeTxId: string,
): P {
  const base = deriveBaseSnapshot(currentPosition, allTransactions);
  const remaining = allTransactions.filter((t) => t.id !== removeTxId);
  return recomputeFromLog(base, remaining);
}
