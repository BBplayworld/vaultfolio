// #349 환율 없는 보유에 매수할 때 저장 환율 희석(1,400 → 700) 방지 — 쓰기 3곳의 저장값 확인
// 보유 픽스처는 실제 쓰기 경로 값으로 만든다(C162): 직접 입력 달러 평단(환율 칸 미입력 → 없음 / 지움 → 0 / 입력 1,300),
// 앱 거래로만 만든 종목(기준 보유 0, C163). 저장값 = 각 화면이 쓰는 함수 결과의 `avgExchangeRate || undefined`.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { applyStockTrade, fillBaseRateForBuy, resolveTradeRate, rollbackStockTrade } from "@/lib/trade/trade-form";
import { computeNewPosition, rollbackTransaction } from "@/lib/trade/trade-utils";
import { getPositionSnapshot } from "@/app/(main)/_components/forms/trade/stock-target-picker";
import type { Stock } from "@/types/asset";
import type { PositionSnapshot, Transaction } from "@/types/transaction";

const USD = 1400;
const held = (o: Partial<Stock>): Stock => ({
  id: "s1", category: "foreign", name: "애플", ticker: "AAPL", quantity: 10, averagePrice: 100, currentPrice: 120,
  currency: "USD", purchaseDate: "2026-01-01", ...o,
} as Stock);
const NONE = held({});                                   // 직접 입력, 환율 칸 미입력
const ZERO = held({ purchaseExchangeRate: 0 });          // 직접 입력, 입력 후 지움
const HAS = held({ purchaseExchangeRate: 1300 });        // 직접 입력, 환율 1,300
const KR = held({ category: "domestic", ticker: "005930", currency: "KRW", averagePrice: 70000, currentPrice: 80000 });

let seq = 0;
const tx = (o: Partial<Transaction>): Transaction => ({
  id: `t${++seq}`, stockId: "s1", ticker: "AAPL", stockName: "애플", type: "buy", quantity: 10, price: 100, currency: "USD",
  date: "2026-11-01", reflected: true, createdAt: `2026-11-01T00:00:0${seq % 10}.000Z`, ...o,
} as Transaction);
// 기록 화면 체결 환율(칸 비움 → 오늘 환율)
const rate = (input?: number) => resolveTradeRate({ input, currentRate: USD, isForeign: true });
const saved = (p: { avgExchangeRate: number }) => p.avgExchangeRate || undefined;

// ① trade-input buildReflectionPatch: getPositionSnapshot(stock, manual 잠금) → applyStockTrade
const tradeInputSaved = (stock: Stock, t: Transaction) =>
  saved(applyStockTrade(getPositionSnapshot(stock, stock.positionSource === "manual" || !stock.positionSource), t));

describe("#349 ① 거래 기록(trade-input) 저장값", () => {
  it("환율 없음 10주 + 매수 10주(체결 환율 칸 비움 → 1,400) = 1,400 (수정 전 700)", () => {
    const t = tx({ exchangeRate: rate() });
    expect(tradeInputSaved(NONE, t)).toBe(1400);
    expect(computeNewPosition(getPositionSnapshot(NONE), t).avgExchangeRate).toBe(700); // 공용 함수는 그대로(replay 통제군)
  });
  it("환율 0 보유도 같음, 체결 환율 직접 입력 1,450이면 1,450", () => {
    expect(tradeInputSaved(ZERO, tx({ exchangeRate: rate() }))).toBe(1400);
    expect(tradeInputSaved(NONE, tx({ exchangeRate: rate(1450) }))).toBe(1450);
  });
  it("통제: 환율 있는 보유는 기존 가중 평균(1,350)", () => {
    const t = tx({ exchangeRate: rate() });
    expect(tradeInputSaved(HAS, t)).toBe(1350);
    expect(tradeInputSaved(HAS, t)).toBe(saved(computeNewPosition(getPositionSnapshot(HAS), t)));
  });
  it("통제: 기준 보유 0(앱 거래로만 만든 종목) → 체결 환율 그대로, 기존과 같음", () => {
    const empty = held({ quantity: 0, averagePrice: 0 });
    const t = tx({ exchangeRate: rate(1320) });
    expect(tradeInputSaved(empty, t)).toBe(1320);
    expect(fillBaseRateForBuy(getPositionSnapshot(empty), t)).toEqual(getPositionSnapshot(empty));
  });
  it("통제: 매도는 채우지 않음 — 환율 없는 보유는 매도 뒤에도 없음", () => {
    expect(tradeInputSaved(NONE, tx({ type: "sell", quantity: 5, exchangeRate: rate() }))).toBeUndefined();
  });
  it("통제: 국내 매수는 체결 환율 없음 → 저장 없음", () => {
    const t = tx({ stockId: "s1", currency: "KRW", price: 70000, exchangeRate: resolveTradeRate({ input: undefined, currentRate: 0, isForeign: false }) });
    expect(tradeInputSaved(KR, t)).toBeUndefined();
  });
});

describe("#349 ② 사진 가져오기(trade-screenshot-import) 저장값", () => {
  // 화면 simulation과 같은 순서: finalPos ?? getPositionSnapshot(base) → applyStockTrade(체결 환율 = 오늘 환율)
  function importSaved(base: Stock | undefined, trades: { type: "buy" | "sell"; quantity: number; price: number }[]) {
    let cur: PositionSnapshot = base
      ? getPositionSnapshot(base)
      : { stockId: "k", quantity: 0, avgPrice: 0, avgExchangeRate: 0, source: "computed", effectiveDate: "2026-11-01", lockedByManual: false };
    for (const t of trades) {
      const p = applyStockTrade(cur, { ...t, exchangeRate: USD } as Transaction);
      cur = { ...cur, quantity: p.quantity, avgPrice: p.avgPrice, avgExchangeRate: p.avgExchangeRate, source: "computed" };
    }
    return saved(cur);
  }
  it("환율 없음 보유 + 매수 2건 = 1,400", () => {
    expect(importSaved(NONE, [{ type: "buy", quantity: 10, price: 100 }, { type: "buy", quantity: 5, price: 110 }])).toBe(1400);
    expect(importSaved(ZERO, [{ type: "buy", quantity: 10, price: 100 }])).toBe(1400);
  });
  it("통제: 환율 있는 보유 1,350 / 신규 자산(기준 0) 1,400 / 매도만이면 없음", () => {
    expect(importSaved(HAS, [{ type: "buy", quantity: 10, price: 100 }])).toBe(1350);
    expect(importSaved(undefined, [{ type: "buy", quantity: 10, price: 100 }])).toBe(1400);
    expect(importSaved(NONE, [{ type: "sell", quantity: 3, price: 100 }])).toBeUndefined();
  });
  it("화면 코드가 applyStockTrade로 계산한다", () => {
    const src = readFileSync(path.resolve(__dirname, "../../app/(main)/_components/forms/trade/trade-screenshot-import.tsx"), "utf8");
    expect(src).toContain("const p = applyStockTrade(cur,");
    expect(src).not.toContain("computeNewPosition(");
  });
});

describe("#349 ③ 거래내역 삭제 롤백(stock-trades-view) 저장값", () => {
  const pos = (s: Stock): PositionSnapshot => ({
    stockId: s.id, quantity: s.quantity, avgPrice: s.averagePrice, avgExchangeRate: s.purchaseExchangeRate ?? 0,
    source: s.positionSource ?? "manual", effectiveDate: s.positionEffectiveDate ?? s.purchaseDate, lockedByManual: false,
  });
  it("수정 후 기록(환율 없음 10주 + 매수 1,400 + 매수 1,500) — 둘째 삭제 1,400, 첫째 삭제 1,450", () => {
    const b1 = tx({ exchangeRate: 1400, date: "2026-11-01" });
    const b2 = tx({ exchangeRate: 1500, date: "2026-11-02" });
    // 실제 쓰기 경로로 현재 보유 만들기
    const r1 = applyStockTrade(getPositionSnapshot(NONE), b1);
    const s1 = held({ quantity: r1.quantity, averagePrice: r1.avgPrice, purchaseExchangeRate: saved(r1), positionSource: "computed" });
    const r2 = applyStockTrade(getPositionSnapshot(s1), b2);
    const s2 = held({ quantity: r2.quantity, averagePrice: r2.avgPrice, purchaseExchangeRate: saved(r2), positionSource: "computed" });
    expect(saved(rollbackStockTrade(pos(s2), [b1, b2], b2.id))).toBeCloseTo(1400, 9);
    expect(saved(rollbackStockTrade(pos(s2), [b1, b2], b1.id))).toBeCloseTo(1450, 9);
    // 이 경우 기존 롤백과 같은 값(기준분 환율이 채워져 있어 분기 안 탐)
    expect(rollbackStockTrade(pos(s2), [b1, b2], b2.id)).toEqual(rollbackTransaction(pos(s2), [b1, b2], b2.id));
  });
  it("수정 전 희석 기록(700)이 남은 종목에서 다른 거래를 삭제하면 재계산이 다시 희석하지 않음(사용자 삭제 시에만)", () => {
    const b1 = tx({ exchangeRate: 1400, date: "2026-11-01" });
    const b2 = tx({ exchangeRate: 1500, date: "2026-11-02" });
    const legacy = held({ quantity: 30, averagePrice: 100, purchaseExchangeRate: (700 * 20 + 1500 * 10) / 30, positionSource: "computed" });
    expect(saved(rollbackTransaction(pos(legacy), [b1, b2], b2.id))).toBeCloseTo(700, 9);
    expect(saved(rollbackStockTrade(pos(legacy), [b1, b2], b2.id))).toBeCloseTo(1400, 9);
  });
  it("통제: 마지막 매수 삭제는 기준 보유분 환율(없음) 복원 — 수정 전 기록 기준", () => {
    const b1 = tx({ exchangeRate: 1400 });
    const legacy = held({ quantity: 20, purchaseExchangeRate: 700, positionSource: "computed" });
    expect(saved(rollbackStockTrade(pos(legacy), [b1], b1.id))).toBeUndefined();
  });
  it("통제: 앱 거래로만 만든 종목(기준 보유 0) — 기존 롤백과 같음", () => {
    const b1 = tx({ exchangeRate: 1300, date: "2026-11-01" });
    const b2 = tx({ exchangeRate: 1500, date: "2026-11-02" });
    const r1 = applyStockTrade(getPositionSnapshot(held({ quantity: 0, averagePrice: 0 })), b1);
    const s1 = held({ quantity: r1.quantity, averagePrice: r1.avgPrice, purchaseExchangeRate: saved(r1), positionSource: "computed" });
    const r2 = applyStockTrade(getPositionSnapshot(s1), b2);
    const s2 = held({ quantity: r2.quantity, averagePrice: r2.avgPrice, purchaseExchangeRate: saved(r2), positionSource: "computed" });
    for (const id of [b1.id, b2.id]) {
      expect(rollbackStockTrade(pos(s2), [b1, b2], id)).toEqual(rollbackTransaction(pos(s2), [b1, b2], id));
    }
    expect(saved(rollbackStockTrade(pos(s2), [b1, b2], b2.id))).toBeCloseTo(1300, 9);
  });
  it("화면 코드가 rollbackStockTrade로 계산한다", () => {
    const src = readFileSync(path.resolve(__dirname, "../../app/(main)/_components/views/detail/trades/stock-trades-view.tsx"), "utf8");
    expect(src).toContain("rollbackStockTrade(currentPosition, allTx, tx.id)");
    const input = readFileSync(path.resolve(__dirname, "../../app/(main)/_components/forms/trade/trade-input.tsx"), "utf8");
    expect(input).toContain("const preview = applyStockTrade(pos, tx);");
    expect(input).not.toContain("computeNewPosition(");
  });
});
