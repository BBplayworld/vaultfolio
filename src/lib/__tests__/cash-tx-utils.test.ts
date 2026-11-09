import { describe, it, expect } from "vitest";
import {
  pruneCashTransactions,
  findDuplicateCashTx,
  reflectedBalanceDelta,
  isCashWithdrawalValid,
  isCashWithdrawalBelowFloor,
  reflectedDeleteBalance,
  cashBalanceFloor,
} from "../trade/cash-tx-utils";
import type { CashTransaction } from "@/types/transaction";

const makeTx = (overrides: Partial<CashTransaction> = {}): CashTransaction => ({
  id: `ctx_${Math.random().toString(36).slice(2)}`,
  cashId: "c1",
  type: "deposit",
  amount: 1_000_000,
  currency: "KRW",
  date: "2026-05-01",
  reflected: true,
  createdAt: new Date().toISOString(),
  ...overrides,
});

describe("cash-tx-utils (S-4.22)", () => {
  // AC5 — 3년 롤링 정리
  it("AC5: prunes transactions older than retention window", () => {
    const old = makeTx({ date: "2020-01-01" });
    const recent = makeTx({ date: new Date().toISOString().split("T")[0] });
    const pruned = pruneCashTransactions([old, recent]);
    expect(pruned).toHaveLength(1);
    expect(pruned[0].date).toBe(recent.date);
  });

  // 중복 탐지 — 계좌·날짜·금액·유형 동일
  it("detects duplicate by cashId/date/amount/type", () => {
    const list = [makeTx({ date: "2026-05-01", amount: 1_000_000, type: "deposit" })];
    expect(findDuplicateCashTx(list, { cashId: "c1", date: "2026-05-01", amount: 1_000_000, type: "deposit" })).toBeDefined();
    expect(findDuplicateCashTx(list, { cashId: "c1", date: "2026-05-01", amount: 1_000_000, type: "withdrawal" })).toBeUndefined();
    expect(findDuplicateCashTx(list, { cashId: "c2", date: "2026-05-01", amount: 1_000_000, type: "deposit" })).toBeUndefined();
  });

  // AC2/AC4 — 반영분 잔액 순변화 = Σ입금 − Σ출금 (미반영 제외)
  it("AC2/AC4: reflectedBalanceDelta sums only reflected deposits minus withdrawals", () => {
    const txns = [
      makeTx({ cashId: "c1", type: "deposit", amount: 3_000_000, reflected: true }),
      makeTx({ cashId: "c1", type: "withdrawal", amount: 500_000, reflected: true }),
      makeTx({ cashId: "c1", type: "deposit", amount: 9_000_000, reflected: false }), // 미반영 제외
      makeTx({ cashId: "c2", type: "deposit", amount: 1_000_000, reflected: true }),   // 다른 계좌 제외
    ];
    expect(reflectedBalanceDelta(txns, "c1")).toBe(2_500_000);
  });

  // AC3 — 출금 반영 초과 가드
  it("AC3: blocks withdrawal exceeding balance", () => {
    expect(isCashWithdrawalValid(1_000_000, 1_000_000)).toBe(true);
    expect(isCashWithdrawalValid(1_000_000, 1_000_001)).toBe(false);
  });

  // #107 ② 전액 출금 → 0원 저장 실패 차단
  it("#107: 전액 출금은 하한 미만으로 차단, 1원 남기면 허용", () => {
    expect(isCashWithdrawalBelowFloor(1_000_000, 1_000_000)).toBe(true);
    expect(isCashWithdrawalBelowFloor(1_000_000, 999_999)).toBe(false);
    expect(isCashWithdrawalBelowFloor(10, 10, "USD")).toBe(true);
    expect(isCashWithdrawalBelowFloor(10, 9.99, "USD")).toBe(false);
  });

  // #107 ③ 반영 입금 삭제 → 하한 1원
  it("#107: 반영 입금 삭제로 0원 이하가 되면 1원(USD 0.01)으로 고정", () => {
    expect(cashBalanceFloor("KRW")).toBe(1);
    expect(cashBalanceFloor("USD")).toBe(0.01);
    expect(cashBalanceFloor("JPY")).toBe(1); // 통화 최소 단위 기준 통일(#103 병합)
    expect(reflectedDeleteBalance(500, { type: "deposit", amount: 500 })).toBe(1);
    expect(reflectedDeleteBalance(300, { type: "deposit", amount: 500 })).toBe(1);
    expect(reflectedDeleteBalance(600, { type: "deposit", amount: 500 })).toBe(100);
    expect(reflectedDeleteBalance(5, { type: "deposit", amount: 5 }, "USD")).toBe(0.01);
    expect(reflectedDeleteBalance(100, { type: "withdrawal", amount: 50 })).toBe(150);
  });
});
