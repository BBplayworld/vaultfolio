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
  it("반영된 거래 삭제 시 현재 포지션에서 역산 재계산", () => {
    // 현재 보유: buy100 + buy50 = 150주 @53333.33
    const current = makeSnapshot({ quantity: 150, avgPrice: 53333.333, source: "computed" });
    const txs: Transaction[] = [
      makeTx({ id: "tx1", type: "buy", quantity: 100, price: 50000, date: "2026-01-10", reflected: true }),
      makeTx({ id: "tx2", type: "buy", quantity: 50, price: 60000, date: "2026-02-15", reflected: true }),
    ];
    // tx2 삭제 → tx1만 남음
    const result = rollbackTransaction(current, txs, "tx2");

    expect(result.quantity).toBe(100);
    expect(result.avgPrice).toBeCloseTo(50000, 0);
  });

  it("거래로그에 없는 수동 보유분이 거래 삭제 후에도 보존됨 (P1 회귀)", () => {
    // 수동 100주 @50000 위에 buy50@60000 반영 → 현재 150주 @53333.33
    // 거래로그에는 buy50만 존재 (최초 100주는 수동 입력이라 미기록)
    const current = makeSnapshot({ quantity: 150, avgPrice: 53333.333, source: "computed" });
    const txs: Transaction[] = [
      makeTx({ id: "tx_buy50", type: "buy", quantity: 50, price: 60000, date: "2026-02-15", reflected: true }),
    ];
    const result = rollbackTransaction(current, txs, "tx_buy50");

    // 거래 삭제 시 0이 아니라 수동 보유분 100주 @50000이 복원되어야 함
    expect(result.quantity).toBe(100);
    expect(result.avgPrice).toBeCloseTo(50000, 0);
  });
});

// 코인(cryptoId·exchangeRate 없음)도 구조적 타입 완화 후 동일한 가중평균 로직을 그대로
// 통과하는지 확인 — 주식 전용 코드를 복제하지 않고 재사용한다는 계약의 회귀 방지(S-4.25).
describe("코인 거래 재사용 (trade-utils 구조적 타입 완화)", () => {
  interface CryptoPos {
    cryptoId: string;
    quantity: number;
    avgPrice: number;
    avgExchangeRate: number;
    source: "manual" | "computed";
    effectiveDate: string;
    lockedByManual: boolean;
  }
  const makeCryptoPos = (overrides: Partial<CryptoPos> = {}): CryptoPos => ({
    cryptoId: "c1",
    quantity: 1,
    avgPrice: 100_000_000,
    avgExchangeRate: 0,
    source: "manual",
    effectiveDate: "2026-01-01",
    lockedByManual: false,
    ...overrides,
  });
  const makeCryptoTx = (overrides: Partial<{ type: "buy" | "sell"; quantity: number; price: number; date: string; reflected: boolean; createdAt: string; id: string }> = {}) => ({
    id: `crtx_${Date.now()}`,
    type: "buy" as const,
    quantity: 0.5,
    price: 110_000_000,
    date: "2026-05-01",
    reflected: true,
    createdAt: new Date().toISOString(),
    ...overrides,
  });

  it("computeNewPosition: 코인 매수 가중평균(환율 필드 없이도 동작)", () => {
    const pos = makeCryptoPos({ quantity: 1, avgPrice: 100_000_000 });
    const tx = makeCryptoTx({ type: "buy", quantity: 0.5, price: 110_000_000 });
    const result = computeNewPosition(pos, tx);
    expect(result.quantity).toBeCloseTo(1.5, 6);
    // (1억*1 + 1.1억*0.5) / 1.5 = 1.55억/1.5 ≈ 103,333,333
    expect(result.avgPrice).toBeCloseTo(103_333_333, -2);
  });

  it("rollbackTransaction: 코인도 거래 삭제 시 역산 재계산", () => {
    const current = makeCryptoPos({ quantity: 1.5, avgPrice: 103_333_333.33, source: "computed" });
    const txs = [
      makeCryptoTx({ id: "ctx1", type: "buy", quantity: 1, price: 100_000_000, date: "2026-01-10" }),
      makeCryptoTx({ id: "ctx2", type: "buy", quantity: 0.5, price: 110_000_000, date: "2026-02-15" }),
    ];
    const result = rollbackTransaction(current, txs, "ctx2");
    expect(result.quantity).toBeCloseTo(1, 6);
    expect(result.avgPrice).toBeCloseTo(100_000_000, -2);
  });
});
