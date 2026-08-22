import type { LoanTransaction } from "@/types/transaction";
import { TRANSACTION_RETENTION_YEARS } from "./trade-utils";

// 대출 상환/추가 대출 로그 유틸 — cash-tx-utils의 prune/중복검출 패턴 미러링(S-4.24).
// 대출도 잔액 선형 가감이라 가중평균(computeNewPosition) 계열은 불필요하다.

/** 보존 기간(기본 3년)보다 오래된 대출 거래 로그 제거 — date 기준 롤링 윈도우 */
export function pruneLoanTransactions(
  transactions: LoanTransaction[],
  years: number = TRANSACTION_RETENTION_YEARS,
): LoanTransaction[] {
  const cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - years);
  const cutoffStr = cutoff.toISOString().split("T")[0];
  return transactions.filter((t) => t.date >= cutoffStr);
}

/** 중복 거래 탐지 — 대출(loanId) · 날짜 · 금액 · 유형이 모두 동일한 기존 거래 반환 */
export function findDuplicateLoanTx(
  transactions: LoanTransaction[],
  c: { loanId: string; date: string; amount: number; type: "repay" | "borrow" },
): LoanTransaction | undefined {
  return transactions.find(
    (t) => t.loanId === c.loanId && t.date === c.date && t.amount === c.amount && t.type === c.type,
  );
}

/** 반영된 거래로부터 잔액 순변화 산출 — Σ반영추가대출 − Σ반영상환 (특정 대출) */
export function reflectedLoanBalanceDelta(transactions: LoanTransaction[], loanId: string): number {
  return transactions
    .filter((t) => t.loanId === loanId && t.reflected)
    .reduce((sum, t) => sum + (t.type === "borrow" ? t.amount : -t.amount), 0);
}

/** 상환 반영 가드 — 반영 상환액이 현재 잔액을 초과하면 차단(현금 출금 가드와 대칭) */
export function isLoanRepaymentValid(currentBalance: number, amount: number): boolean {
  return amount <= currentBalance;
}
