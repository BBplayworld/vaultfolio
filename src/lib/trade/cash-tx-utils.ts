import type { CashTransaction } from "@/types/transaction";
import { TRANSACTION_RETENTION_YEARS } from "./trade-utils";

// 현금 입출금 로그 유틸 — 주식 trade-utils의 prune/중복검출 패턴 재사용.
// 현금은 잔액 선형 가감이라 가중평균(computeNewPosition) 계열은 불필요하다.

/** 보존 기간(기본 3년)보다 오래된 현금 거래 로그 제거 — date 기준 롤링 윈도우 */
export function pruneCashTransactions(
  transactions: CashTransaction[],
  years: number = TRANSACTION_RETENTION_YEARS,
): CashTransaction[] {
  const cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - years);
  const cutoffStr = cutoff.toISOString().split("T")[0];
  return transactions.filter((t) => t.date >= cutoffStr);
}

/** 중복 거래 탐지 — 계좌(cashId) · 날짜 · 금액 · 유형이 모두 동일한 기존 거래 반환 */
export function findDuplicateCashTx(
  transactions: CashTransaction[],
  c: { cashId: string; date: string; amount: number; type: "deposit" | "withdrawal" },
): CashTransaction | undefined {
  return transactions.find(
    (t) => t.cashId === c.cashId && t.date === c.date && t.amount === c.amount && t.type === c.type,
  );
}

/** 반영된 거래로부터 잔액 순변화 산출 — Σ반영입금 − Σ반영출금 (특정 계좌) */
export function reflectedBalanceDelta(transactions: CashTransaction[], cashId: string): number {
  return transactions
    .filter((t) => t.cashId === cashId && t.reflected)
    .reduce((sum, t) => sum + (t.type === "deposit" ? t.amount : -t.amount), 0);
}

/** 출금 반영 가드 — 반영 출금액이 현재 잔액을 초과하면 차단(주식 oversell 대칭) */
export function isCashWithdrawalValid(currentBalance: number, amount: number): boolean {
  return amount <= currentBalance;
}
