// 5.175 #357 N1(a) — 코인 '반영' 전량 매도 무음 실패 제거. qa 재현(5.175-qa-repro-save-gate.test.ts)을 회귀 테스트로 바꾼 것.
// 저장 관문(saveAssetData: strict cryptoSchema 수량>0·평단>0)은 바꾸지 않는다 → 폼이 미리 막고, 실패 시 토스트.
import { describe, it, expect, beforeEach, vi } from "vitest";
import { readFileSync } from "fs";
import path from "path";
import { saveAssetData } from "@/lib/asset/asset-storage";
import { computeNewPosition } from "@/lib/trade/trade-utils";
import { blocksCoinZeroQty, COIN_ZERO_QTY_NOTE, TRADE_SAVE_FAIL_TOAST } from "@/lib/trade/trade-form";
import type { AssetData, Crypto, Stock } from "@/types/asset";
import type { CryptoTransaction } from "@/types/transaction";

const mem = new Map<string, string>();
beforeEach(() => {
  mem.clear();
  vi.stubGlobal("window", {});
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => (mem.has(k) ? mem.get(k)! : null), setItem: (k: string, v: string) => void mem.set(k, v),
    removeItem: (k: string) => void mem.delete(k), key: (i: number) => [...mem.keys()][i] ?? null, get length() { return mem.size; }, clear: () => mem.clear(),
  });
});
const base = (o: Partial<AssetData>): AssetData => ({
  realEstate: [], stocks: [], crypto: [], cash: [], loans: [], yearlyNetAssets: [], transactions: [], cashTransactions: [],
  loanTransactions: [], cryptoTransactions: [], lastUpdated: "", nickname: "", ...o,
} as AssetData);
const coin = (o: Partial<Crypto> = {}): Crypto => ({ id: "k1", name: "비트코인", symbol: "BTC", quantity: 10, averagePrice: 100, currentPrice: 150, purchaseDate: "2026-01-01", ...o } as Crypto);
const stock = (o: Partial<Stock>): Stock => ({ id: "s1", category: "domestic", name: "삼성전자", ticker: "005930", quantity: 10, averagePrice: 100, currentPrice: 150, currency: "KRW", purchaseDate: "2026-01-01", ...o } as Stock);
const sellTx = (q: number, reflected: boolean): CryptoTransaction => ({
  id: "c1", cryptoId: "k1", symbol: "BTC", name: "비트코인", type: "sell", quantity: q, price: 130, date: "2026-11-20", reflected, createdAt: "2026-11-20T00:00:00.000Z",
} as CryptoTransaction);
// crypto-tx-input buildReflectionPatch와 같은 계산(실제 쓰기 경로)
const recordCoin = (c: Crypto, t: CryptoTransaction): Crypto => {
  const p = computeNewPosition({ quantity: c.quantity, avgPrice: c.averagePrice, avgExchangeRate: 0, source: "manual" as const, effectiveDate: c.purchaseDate, lockedByManual: false }, t);
  return { ...c, quantity: p.quantity, averagePrice: p.avgPrice, positionSource: "computed", positionEffectiveDate: t.date };
};

describe("저장 관문 계약(스키마 불변)", () => {
  it("코인 10@100 저장 = true (통제군)", () => { expect(saveAssetData(base({ crypto: [coin()] }))).toBe(true); });
  it("반영 전량 매도 결과 0@0 저장 = false — 폼 가드가 막아야 하는 경우", () => {
    const t = sellTx(10, true);
    const after = recordCoin(coin(), t);
    expect([after.quantity, after.averagePrice]).toEqual([0, 0]);
    expect(saveAssetData(base({ crypto: [after], cryptoTransactions: [t] }))).toBe(false);
    expect(blocksCoinZeroQty({ reflected: true, type: "sell", quantity: 10, holding: 10 })).toBe(true);
  });
  it("'반영' 해제(기록만) 전량 매도 = 저장 true, 보유 10@100 유지 — 차단 안내의 우회 경로", () => {
    const t = sellTx(10, false);
    expect(blocksCoinZeroQty({ reflected: false, type: "sell", quantity: 10, holding: 10 })).toBe(false);
    expect(saveAssetData(base({ crypto: [coin()], cryptoTransactions: [t] }))).toBe(true);
  });
  it("일부 매도 반영 = 저장 true(통제군)", () => {
    const t = sellTx(4, true);
    expect(blocksCoinZeroQty({ reflected: true, type: "sell", quantity: 4, holding: 10 })).toBe(false);
    expect(saveAssetData(base({ crypto: [recordCoin(coin(), t)], cryptoTransactions: [t] }))).toBe(true);
  });
  it("주식 0@0·10@0 저장 = true (완화 스키마 그대로)", () => {
    expect(saveAssetData(base({ stocks: [stock({ quantity: 0, averagePrice: 0 })] }))).toBe(true);
    expect(saveAssetData(base({ stocks: [stock({ quantity: 10, averagePrice: 0 })] }))).toBe(true);
  });
});

describe("blocksCoinZeroQty", () => {
  it("반영·매도·결과 0개일 때만 true", () => {
    expect(blocksCoinZeroQty({ reflected: true, type: "sell", quantity: 0.5, holding: 0.5 })).toBe(true);
    expect(blocksCoinZeroQty({ reflected: true, type: "buy", quantity: 10, holding: 10 })).toBe(false);
    expect(blocksCoinZeroQty({ reflected: true, type: "sell", quantity: 0, holding: 10 })).toBe(false); // 미입력
    expect(blocksCoinZeroQty({ reflected: true, type: "sell", quantity: 11, holding: 10 })).toBe(false); // 보유 초과는 기존 가드
  });
});

describe("문구·연결(소스 고정)", () => {
  const read = (p: string) => readFileSync(path.resolve(__dirname, "../../..", p), "utf8");
  it("차단 문구는 코인 삭제를 권하지 않고 금액이 없다", () => {
    expect(COIN_ZERO_QTY_NOTE).toBe("코인은 0개로 남길 수 없어요. '반영'을 끄면 기록만 남아요.");
    expect(COIN_ZERO_QTY_NOTE).not.toMatch(/삭제|지우/);
    expect(TRADE_SAVE_FAIL_TOAST).toBe("저장하지 못했어요. 입력값을 확인해 주세요.");
  });
  const FAIL = 'toast.error(TRADE_SAVE_FAIL_TOAST, { className: "break-keep" })'; // 320~344 어절 중간 끊김 방지(qa D-1)
  it("거래 기록 폼: 제출 비활성 + 안내 aria-describedby + 실패 토스트(break-keep), 스크린샷 가져오기: 실패 토스트", () => {
    const form = read("src/app/(main)/_components/forms/asset-update/input/crypto-tx-input.tsx");
    expect(form).toContain('disabled={zeroQtyBlocked} aria-describedby={zeroQtyBlocked ? "crypto-zero-qty-note" : undefined}');
    expect(form).toContain('id="crypto-zero-qty-note"');
    expect(form).toContain(FAIL);
    const shot = read("src/app/(main)/_components/forms/trade/crypto-trade-screenshot-import.tsx");
    expect(shot).toContain(FAIL);
  });
  it("TRADE_SAVE_FAIL_TOAST는 모든 사용처에서 break-keep", () => {
    for (const f of [
      "src/app/(main)/_components/forms/asset-update/input/crypto-tx-input.tsx",
      "src/app/(main)/_components/forms/trade/crypto-trade-screenshot-import.tsx",
      "src/app/(main)/_components/views/detail/crypto-tx/crypto-tx-view.tsx",
      "src/app/(main)/_components/views/detail/trades/stock-trades-view.tsx",
    ]) {
      const src = read(f);
      const calls = src.match(/toast\.error\(TRADE_SAVE_FAIL_TOAST[^)]*\)/g) ?? [];
      expect(calls.length, f).toBeGreaterThan(0);
      for (const c of calls) expect(c, f).toBe(FAIL);
    }
  });
  it("반영 거래 삭제 실패(코인·주식): 창 유지 + 실패 토스트 — 성공 분기만 창을 닫는다(O-3·B1)", () => {
    const coinView = read("src/app/(main)/_components/views/detail/crypto-tx/crypto-tx-view.tsx");
    const coinFn = coinView.slice(coinView.indexOf("const runReflectedDelete"), coinView.indexOf("if (!target || !coin)"));
    expect(coinFn).toMatch(/\} else \{\s*\/\/[^\n]*\n\s*toast\.error\(TRADE_SAVE_FAIL_TOAST, \{ className: "break-keep" \}\);\s*return;\s*\}\s*setDeleteTarget\(null\);/);
    const stockView = read("src/app/(main)/_components/views/detail/trades/stock-trades-view.tsx");
    const stockFn = stockView.slice(stockView.indexOf("const handleConfirmDelete"), stockView.indexOf("if (!target || groupStocks.length === 0)"));
    expect(stockFn).toMatch(/if \(!ok\) \{\s*\/\/[^\n]*\n\s*toast\.error\(TRADE_SAVE_FAIL_TOAST, \{ className: "break-keep" \}\);\s*return;\s*\}/);
    expect(stockFn).not.toMatch(/if \(!ok\) \{ setDeleteTarget\(null\)/);
  });
  it("주식 삭제 확인창: label id ↔ 확인 버튼 aria-describedby(평단 미상일 때만), 입력칸 aria-label 덮어쓰기 0", () => {
    const dlg = read("src/app/(main)/_components/forms/trade/guards/delete-rollback-dialog.tsx");
    expect(dlg).toContain('id="rollback-avg-unknown-label" htmlFor="rollback-avg-input"');
    expect(dlg).toContain('aria-describedby={needsAvg ? "rollback-avg-unknown-label" : undefined}');
    expect(dlg).not.toContain('aria-label="평단가"');
    expect(dlg).toContain("평단가 입력 (");
  });
});
