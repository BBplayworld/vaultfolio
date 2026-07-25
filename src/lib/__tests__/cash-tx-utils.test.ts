import { describe, it, expect } from "vitest";
import {
  pruneCashTransactions,
  findDuplicateCashTx,
  reflectedBalanceDelta,
  isCashWithdrawalValid,
} from "../cash-tx-utils";
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
});
