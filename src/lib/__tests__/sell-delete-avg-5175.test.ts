// 5.175 #354 — 전량 매도 기록 삭제 시 평단 0 복원 방지(주식). qa 재현(5.175-qa-repro.test.tsx)을 회귀 테스트로 바꾼 것.
// C162: 보유 픽스처·저장값은 실제 쓰기 경로 함수로 만든다.
//  - 매도 기록 = trade-input buildReflectionPatch: applyStockTrade(getPositionSnapshot(stock), tx)
//  - 삭제 = stock-trades-view handleDeleteClick(rollbackStockTrade) → 확인창(applyRollbackAvgInput) → handleConfirmDelete
// positionSource 실사용 값 3가지(없음·manual 직접 입력·computed 앱 거래 기록)를 모두 거친다.
import { describe, it, expect } from "vitest";
import { applyStockTrade, applyRollbackAvgInput, needsRollbackAvgInput, rollbackStockTrade } from "@/lib/trade/trade-form";
import { getPositionSnapshot } from "@/app/(main)/_components/forms/trade/stock-target-picker";
import type { Stock } from "@/types/asset";
import type { PositionPreview, PositionSnapshot, Transaction } from "@/types/transaction";

let seq = 0;
const stx = (o: Partial<Transaction>): Transaction => ({
  id: `t${++seq}`, stockId: "s1", ticker: "005930", stockName: "삼성전자", type: "buy", quantity: 10, price: 100, currency: "KRW",
  date: "2026-11-01", reflected: true, createdAt: `2026-11-01T00:00:${String(seq).padStart(2, "0")}.000Z`, ...o,
} as Transaction);
const manualStock = (o: Partial<Stock> = {}): Stock => ({
  id: "s1", category: "domestic", name: "삼성전자", ticker: "005930", quantity: 10, averagePrice: 100, currentPrice: 150,
  currency: "KRW", purchaseDate: "2026-01-01", ...o,
} as Stock);
function recordStock(stock: Stock, t: Transaction): Stock {
  const p = applyStockTrade(getPositionSnapshot(stock, stock.positionSource === "manual" || !stock.positionSource), t);
  return { ...stock, quantity: p.quantity, averagePrice: p.avgPrice, purchaseExchangeRate: p.avgExchangeRate || undefined, positionSource: "computed", positionEffectiveDate: t.date };
}
// handleDeleteClick — 확인창 미리보기
function previewDelete(stock: Stock, all: Transaction[], txId: string): PositionPreview {
  const cur: PositionSnapshot = {
    stockId: stock.id, quantity: stock.quantity, avgPrice: stock.averagePrice, avgExchangeRate: stock.purchaseExchangeRate ?? 0,
    source: stock.positionSource ?? "manual", effectiveDate: stock.positionEffectiveDate ?? stock.purchaseDate, lockedByManual: false,
  };
  const r = rollbackStockTrade(cur, all.filter((t) => t.stockId === stock.id), txId);
  return { quantity: r.quantity, avgPrice: r.avgPrice, avgExchangeRate: r.avgExchangeRate };
}
// 확인창 → handleConfirmDelete 저장값. null = 확인 버튼 비활성(저장 없음)
function confirmDelete(stock: Stock, preview: PositionPreview, avgInput?: number): Stock | null {
  const p = applyRollbackAvgInput(preview, avgInput);
  if (!p) return null;
  return { ...stock, quantity: p.quantity, averagePrice: p.avgPrice, purchaseExchangeRate: p.avgExchangeRate || undefined, positionSource: "computed" };
}

describe("needsRollbackAvgInput / applyRollbackAvgInput", () => {
  it("수량 > 0 · 평단 ≤ 0만 입력 필요", () => {
    expect(needsRollbackAvgInput({ quantity: 10, avgPrice: 0 })).toBe(true);
    expect(needsRollbackAvgInput({ quantity: 10, avgPrice: -5 })).toBe(true);
    expect(needsRollbackAvgInput({ quantity: 10, avgPrice: NaN })).toBe(true);
    expect(needsRollbackAvgInput({ quantity: 10, avgPrice: 100 })).toBe(false);
    expect(needsRollbackAvgInput({ quantity: 0, avgPrice: 0 })).toBe(false); // 삭제 후에도 0주 — 평단 의미 없음
  });
  it("입력 필요 시 0·음수·미입력은 null(차단), 양수만 평단으로", () => {
    const p = { quantity: 10, avgPrice: 0, avgExchangeRate: 0 };
    expect(applyRollbackAvgInput(p, undefined)).toBeNull();
    expect(applyRollbackAvgInput(p, 0)).toBeNull();
    expect(applyRollbackAvgInput(p, -1)).toBeNull();
    expect(applyRollbackAvgInput(p, 100)).toEqual({ quantity: 10, avgPrice: 100, avgExchangeRate: 0 });
  });
  it("입력 불필요 시 입력값을 무시하고 그대로", () => {
    const p = { quantity: 10, avgPrice: 100, avgExchangeRate: 0 };
    expect(applyRollbackAvgInput(p, 999)).toBe(p);
  });
});

describe("#354 주식 — 전량 매도 기록 삭제", () => {
  for (const src of [undefined, "manual"] as const) {
    it(`경우 1(positionSource=${src ?? "없음"}): 직접 10@100 → 전량 매도 → 삭제 — 입력 전 차단, 100 입력 시 10@100`, () => {
      let s = manualStock(src ? { positionSource: src } : {});
      const sell = stx({ type: "sell", quantity: 10, price: 130, date: "2026-11-20" });
      s = recordStock(s, sell);
      expect([s.quantity, s.averagePrice, s.positionSource]).toEqual([0, 0, "computed"]);
      const preview = previewDelete(s, [sell], sell.id);
      expect(needsRollbackAvgInput(preview)).toBe(true);
      expect(confirmDelete(s, preview)).toBeNull(); // 확인 버튼 비활성 — 10@0 저장 불가
      const after = confirmDelete(s, preview, 100)!;
      expect([after.quantity, after.averagePrice]).toEqual([10, 100]);
    });
  }
  it("경우 2(computed): 직접 10@100 + 매수 10@120(→20@110) → 전량 매도 → 삭제 — 110 입력 시 20@110", () => {
    let s = manualStock();
    const buy = stx({ type: "buy", quantity: 10, price: 120, date: "2026-11-10" });
    s = recordStock(s, buy);
    expect([s.quantity, s.averagePrice, s.positionSource]).toEqual([20, 110, "computed"]);
    const sell = stx({ type: "sell", quantity: 20, price: 130, date: "2026-11-20" });
    s = recordStock(s, sell);
    const preview = previewDelete(s, [buy, sell], sell.id);
    expect(preview.quantity).toBe(20);
    expect(needsRollbackAvgInput(preview)).toBe(true);
    expect(confirmDelete(s, preview)).toBeNull();
    const after = confirmDelete(s, preview, 110)!;
    expect(after.quantity).toBe(20);
    expect(after.averagePrice).toBe(110);
  });
  it("통제군: 직접 10@100 → 일부 매도 4 → 삭제 = 입력 없이 10@100(불변)", () => {
    let s = manualStock();
    const sell = stx({ type: "sell", quantity: 4, price: 130, date: "2026-11-20" });
    s = recordStock(s, sell);
    expect([s.quantity, s.averagePrice]).toEqual([6, 100]);
    const preview = previewDelete(s, [sell], sell.id);
    expect(needsRollbackAvgInput(preview)).toBe(false);
    const after = confirmDelete(s, preview)!;
    expect([after.quantity, after.averagePrice]).toEqual([10, 100]);
  });
  it("통제군 2: 20@110 → 일부 매도 5 → 삭제 = 입력 없이 20@110(불변)", () => {
    let s = manualStock();
    const buy = stx({ type: "buy", quantity: 10, price: 120, date: "2026-11-10" });
    s = recordStock(s, buy);
    const sell = stx({ type: "sell", quantity: 5, price: 130, date: "2026-11-20" });
    s = recordStock(s, sell);
    const preview = previewDelete(s, [buy, sell], sell.id);
    expect(needsRollbackAvgInput(preview)).toBe(false);
    const after = confirmDelete(s, preview)!;
    expect(after.quantity).toBe(20);
    expect(after.averagePrice).toBeCloseTo(110, 9);
  });
  it("경계(C163 기준분 0): 앱 기록만 매수 10@120 → 전량 매도 → 삭제 = 입력 없이 10@120", () => {
    let s = manualStock({ quantity: 0, averagePrice: 0 });
    const buy = stx({ type: "buy", quantity: 10, price: 120, date: "2026-11-10" });
    s = recordStock(s, buy);
    const sell = stx({ type: "sell", quantity: 10, price: 130, date: "2026-11-20" });
    s = recordStock(s, sell);
    const preview = previewDelete(s, [buy, sell], sell.id);
    expect(needsRollbackAvgInput(preview)).toBe(false);
    const after = confirmDelete(s, preview)!;
    expect([after.quantity, after.averagePrice]).toEqual([10, 120]);
  });
  it("매수 삭제로 0주가 되는 경우는 입력 불필요(통제군)", () => {
    let s = manualStock({ quantity: 0, averagePrice: 0 });
    const buy = stx({ type: "buy", quantity: 10, price: 120, date: "2026-11-10" });
    s = recordStock(s, buy);
    const preview = previewDelete(s, [buy], buy.id);
    expect(preview.quantity).toBe(0);
    expect(needsRollbackAvgInput(preview)).toBe(false);
  });
});
