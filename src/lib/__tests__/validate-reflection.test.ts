import { describe, it, expect } from "vitest";
import { validateReflection } from "../validate-reflection";
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
  reflected: false,
  createdAt: new Date().toISOString(),
  ...overrides,
});

describe("validateReflection", () => {
  it("Case 1: 직접 입력 후 거래 반영 → confirm", () => {
    const pos = makeSnapshot({ lockedByManual: true });
    const tx = makeTx();
    const result = validateReflection(tx, pos);

    expect(result.level).toBe("confirm");
    expect(result.reason).toBe("manual_override");
    expect(result.preview).toBeDefined();
    expect(result.preview!.quantity).toBe(150);
  });

  it("Case 2: 보유 초과 매도 → restrict + maxQty", () => {
    const pos = makeSnapshot({ quantity: 100 });
    const tx = makeTx({ type: "sell", quantity: 150 });
    const result = validateReflection(tx, pos);

    expect(result.level).toBe("restrict");
    expect(result.reason).toBe("oversell");
    expect(result.maxQty).toBe(100);
  });

  it("Case 3: 과거 날짜 거래 → confirm", () => {
    const pos = makeSnapshot({ effectiveDate: "2026-06-01" });
    const tx = makeTx({ date: "2026-05-01" });
    const result = validateReflection(tx, pos);

    expect(result.level).toBe("confirm");
    expect(result.reason).toBe("backdated");
    expect(result.preview).toBeDefined();
  });

  it("Case 4: 중복 반영 → restrict", () => {
    const pos = makeSnapshot();
    const tx = makeTx({ reflected: true, reflectionId: "ref_123" });
    const result = validateReflection(tx, pos);

    expect(result.level).toBe("restrict");
    expect(result.reason).toBe("already_reflected");
  });

  it("정상 통과 → pass", () => {
    const pos = makeSnapshot({ effectiveDate: "2026-01-01", lockedByManual: false });
    const tx = makeTx({ date: "2026-05-01", reflected: false });
    const result = validateReflection(tx, pos);

    expect(result.level).toBe("pass");
    expect(result.preview).toBeDefined();
    expect(result.preview!.quantity).toBe(150);
  });
});
