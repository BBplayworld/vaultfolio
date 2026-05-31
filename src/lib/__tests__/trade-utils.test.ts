import { describe, it, expect } from "vitest";
import { computeNewPosition, recomputeFromLog, rollbackTransaction } from "../trade-utils";
import type { Transaction, PositionSnapshot } from "@/types/transaction";

const makeSnapshot = (overrides: Partial<PositionSnapshot> = {}): PositionSnapshot => ({
  stockId: "s1",
  quantity: 100,
  avgPrice: 50000,
  avgExchangeRate: 0,
  source: "manual",
  effectiveDate: "2026-01-01",
  lockedByManual: false,
  ...overrides,
});

const makeTx = (overrides: Partial<Transaction> = {}): Transaction => ({
  id: `tx_${Date.now()}`,
  stockId: "s1",
  ticker: "005930",
  stockName: "삼성전자",
  type: "buy",
  quantity: 50,
  price: 60000,
  currency: "KRW",
  date: "2026-05-01",
  reflected: true,
  createdAt: new Date().toISOString(),
  ...overrides,
});

describe("computeNewPosition", () => {
  it("매수 시 가중평균 평단 계산", () => {
    const pos = makeSnapshot({ quantity: 100, avgPrice: 50000 });
    const tx = makeTx({ type: "buy", quantity: 50, price: 60000 });
    const result = computeNewPosition(pos, tx);

    expect(result.quantity).toBe(150);
    // (50000*100 + 60000*50) / 150 = 8000000/150 ≈ 53333.33
    expect(result.avgPrice).toBeCloseTo(53333.33, 0);
  });

  it("매도 시 수량 차감 + 평단 유지", () => {
    const pos = makeSnapshot({ quantity: 100, avgPrice: 50000 });
    const tx = makeTx({ type: "sell", quantity: 30, price: 60000 });
    const result = computeNewPosition(pos, tx);

    expect(result.quantity).toBe(70);
    expect(result.avgPrice).toBe(50000);
  });

  it("전량 매도 시 평단 0", () => {
    const pos = makeSnapshot({ quantity: 100, avgPrice: 50000 });
    const tx = makeTx({ type: "sell", quantity: 100, price: 60000 });
    const result = computeNewPosition(pos, tx);

    expect(result.quantity).toBe(0);
    expect(result.avgPrice).toBe(0);
  });

  it("해외주식 환율 가중평균", () => {
    const pos = makeSnapshot({
      quantity: 100,
      avgPrice: 150,
      avgExchangeRate: 1300,
    });
    const tx = makeTx({
      type: "buy",
      quantity: 50,
      price: 160,
      currency: "USD",
      exchangeRate: 1350,
    });
    const result = computeNewPosition(pos, tx);

    expect(result.quantity).toBe(150);
    expect(result.avgPrice).toBeCloseTo(153.33, 0);
    // (1300*100 + 1350*50) / 150 = 197500/150 ≈ 1316.67
    expect(result.avgExchangeRate).toBeCloseTo(1316.67, 0);
  });
});

describe("recomputeFromLog", () => {
  it("연속 거래 적용 후 최종 포지션", () => {
    const base = makeSnapshot({ quantity: 0, avgPrice: 0, avgExchangeRate: 0 });
    const txs: Transaction[] = [
      makeTx({ id: "tx1", type: "buy", quantity: 100, price: 50000, date: "2026-01-10", reflected: true }),
      makeTx({ id: "tx2", type: "buy", quantity: 50, price: 60000, date: "2026-02-15", reflected: true }),
      makeTx({ id: "tx3", type: "sell", quantity: 30, price: 70000, date: "2026-03-20", reflected: true }),
    ];
    const result = recomputeFromLog(base, txs);

    // 매수 후: 150주 @ 53333.33
    // 매도 후: 120주 @ 53333.33 (매도 시 평단 유지)
    expect(result.quantity).toBe(120);
    expect(result.avgPrice).toBeCloseTo(53333.33, 0);
  });

  it("미반영 거래는 건너뜀", () => {
    const base = makeSnapshot({ quantity: 0, avgPrice: 0, avgExchangeRate: 0 });
    const txs: Transaction[] = [
      makeTx({ id: "tx1", type: "buy", quantity: 100, price: 50000, reflected: true }),
      makeTx({ id: "tx2", type: "buy", quantity: 50, price: 60000, reflected: false }),
    ];
    const result = recomputeFromLog(base, txs);

    expect(result.quantity).toBe(100);
    expect(result.avgPrice).toBe(50000);
  });
});

describe("rollbackTransaction", () => {
  it("반영된 거래 삭제 시 재계산", () => {
    const base = makeSnapshot({ quantity: 0, avgPrice: 0, avgExchangeRate: 0 });
    const txs: Transaction[] = [
      makeTx({ id: "tx1", type: "buy", quantity: 100, price: 50000, date: "2026-01-10", reflected: true }),
      makeTx({ id: "tx2", type: "buy", quantity: 50, price: 60000, date: "2026-02-15", reflected: true }),
    ];
    // tx2 삭제 → tx1만 남음
    const result = rollbackTransaction(base, txs, "tx2");

    expect(result.quantity).toBe(100);
    expect(result.avgPrice).toBe(50000);
  });
});
