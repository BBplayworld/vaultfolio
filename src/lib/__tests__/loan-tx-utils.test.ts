import { describe, it, expect } from "vitest";
import {
  pruneLoanTransactions,
  findDuplicateLoanTx,
  reflectedLoanBalanceDelta,
  isLoanRepaymentValid,
} from "../trade/loan-tx-utils";
import type { LoanTransaction } from "@/types/transaction";

const makeTx = (overrides: Partial<LoanTransaction> = {}): LoanTransaction => ({
  id: `ltx_${Math.random().toString(36).slice(2)}`,
  loanId: "l1",
  type: "repay",
  amount: 1_000_000,
  date: "2026-05-01",
  reflected: true,
  createdAt: new Date().toISOString(),
  ...overrides,
});

describe("loan-tx-utils (S-4.24)", () => {
  // AC5 — 3년 롤링 정리
  it("AC5: prunes transactions older than retention window", () => {
    const old = makeTx({ date: "2020-01-01" });
    const recent = makeTx({ date: new Date().toISOString().split("T")[0] });
    const pruned = pruneLoanTransactions([old, recent]);
    expect(pruned).toHaveLength(1);
    expect(pruned[0].date).toBe(recent.date);
  });

  // 중복 탐지 — 대출·날짜·금액·유형 동일
  it("detects duplicate by loanId/date/amount/type", () => {
    const list = [makeTx({ date: "2026-05-01", amount: 1_000_000, type: "repay" })];
    expect(findDuplicateLoanTx(list, { loanId: "l1", date: "2026-05-01", amount: 1_000_000, type: "repay" })).toBeDefined();
    expect(findDuplicateLoanTx(list, { loanId: "l1", date: "2026-05-01", amount: 1_000_000, type: "borrow" })).toBeUndefined();
    expect(findDuplicateLoanTx(list, { loanId: "l2", date: "2026-05-01", amount: 1_000_000, type: "repay" })).toBeUndefined();
  });

  // AC2/AC4 — 반영분 잔액 순변화 = Σ추가대출 − Σ상환 (미반영 제외)
  it("AC2/AC4: reflectedLoanBalanceDelta sums only reflected borrow minus repay", () => {
    const txns = [
      makeTx({ loanId: "l1", type: "borrow", amount: 3_000_000, reflected: true }),
      makeTx({ loanId: "l1", type: "repay", amount: 500_000, reflected: true }),
      makeTx({ loanId: "l1", type: "borrow", amount: 9_000_000, reflected: false }), // 미반영 제외
      makeTx({ loanId: "l2", type: "borrow", amount: 1_000_000, reflected: true }),   // 다른 대출 제외
    ];
    expect(reflectedLoanBalanceDelta(txns, "l1")).toBe(2_500_000);
  });

  // AC3 — 상환 반영 초과 가드
  it("AC3: blocks repayment exceeding balance", () => {
    expect(isLoanRepaymentValid(1_000_000, 1_000_000)).toBe(true);
    expect(isLoanRepaymentValid(1_000_000, 1_000_001)).toBe(false);
  });
});
