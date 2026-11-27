// qa 5.175 결함 재현(#354 평단 0 복원, #355 다 판 코인 소실) — main d9e318f, 소스 무수정.
// C162: 보유 픽스처와 저장값은 실제 쓰기 경로 함수로 만든다.
//  - 매도 기록(주식) = trade-input buildReflectionPatch: applyStockTrade(getPositionSnapshot(stock), tx)
//  - 매도 기록(코인) = crypto-tx-input buildReflectionPatch: computeNewPosition(getCryptoPosition(coin), tx)
//  - 삭제(주식) = stock-trades-view handleDeleteClick → rollbackStockTrade → deleteTransactionWithPosition({...s, ...patch})
//  - 삭제(코인) = crypto-tx-view confirmDelete → rollbackTransaction → deleteCryptoTransactionWithPosition({...c, ...patch})
// 주의: 코인 쪽 계산값은 saveAssetData(strict cryptoSchema: 수량>0·평단>0)를 통과하지 못한다 → qa-5175-save-gate.test.ts.
//  즉 코인 0@0·10@0은 '계산 결과'일 뿐 실제 저장되지 않는다(로컬 prod UI에서도 전량 매도 저장 실패 확인).
import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { applyStockTrade, rollbackStockTrade } from "@/lib/trade/trade-form";
import { computeNewPosition, rollbackTransaction } from "@/lib/trade/trade-utils";
import { getPositionSnapshot } from "@/app/(main)/_components/forms/trade/stock-target-picker";
import type { Crypto, Loan, Stock } from "@/types/asset";
import type { CryptoTransaction, PositionSnapshot, Transaction } from "@/types/transaction";

// ── 화면 렌더용 목(#355) ──
let mockData: { crypto: Crypto[]; loans: Loan[]; cryptoTransactions: CryptoTransaction[] } = { crypto: [], loans: [], cryptoTransactions: [] };
let mockSummary = { cryptoValue: 0, cryptoProfit: 0, cryptoCost: 0, loanBalance: 0 };
vi.mock("@/contexts/asset-data-context", () => ({
  useAssetData: () => ({
    assetData: { ...mockData, stocks: [], cash: [], realEstate: [] },
    deleteCrypto: () => {}, deleteCryptos: () => {}, deleteLoan: () => {},
    getAssetSummary: () => mockSummary,
  }),
}));
vi.mock("@/app/(main)/_components/layout/navigation/navigation-context", () => ({
  useAssetNavigation: () => ({ navigate: () => {} }),
}));
import { CryptoTab } from "@/app/(main)/_components/views/detail/tabs/crypto-tab";
import { LoanTab } from "@/app/(main)/_components/views/detail/tabs/loan-tab";

// ── 주식 쓰기 경로 ──
let seq = 0;
const stx = (o: Partial<Transaction>): Transaction => ({
  id: `t${++seq}`, stockId: "s1", ticker: "005930", stockName: "삼성전자", type: "buy", quantity: 10, price: 100, currency: "KRW",
  date: "2026-11-01", reflected: true, createdAt: `2026-11-01T00:00:${String(seq).padStart(2, "0")}.000Z`, ...o,
} as Transaction);
const manualStock = (o: Partial<Stock> = {}): Stock => ({
  id: "s1", category: "domestic", name: "삼성전자", ticker: "005930", quantity: 10, averagePrice: 100, currentPrice: 150,
  currency: "KRW", purchaseDate: "2026-01-01", ...o,
} as Stock);
// trade-input onSubmit → buildReflectionPatch → addTransactionWithPosition({...s, ...patch})
function recordStock(stock: Stock, t: Transaction): Stock {
  const p = applyStockTrade(getPositionSnapshot(stock, stock.positionSource === "manual" || !stock.positionSource), t);
  return { ...stock, quantity: p.quantity, averagePrice: p.avgPrice, purchaseExchangeRate: p.avgExchangeRate || undefined, positionSource: "computed", positionEffectiveDate: t.date };
}
// stock-trades-view handleDeleteClick + handleConfirmDelete
function deleteStockTx(stock: Stock, all: Transaction[], txId: string): Stock {
  const cur: PositionSnapshot = {
    stockId: stock.id, quantity: stock.quantity, avgPrice: stock.averagePrice, avgExchangeRate: stock.purchaseExchangeRate ?? 0,
    source: stock.positionSource ?? "manual", effectiveDate: stock.positionEffectiveDate ?? stock.purchaseDate, lockedByManual: false,
  };
  const r = rollbackStockTrade(cur, all.filter((t) => t.stockId === stock.id), txId);
  return { ...stock, quantity: r.quantity, averagePrice: r.avgPrice, purchaseExchangeRate: r.avgExchangeRate || undefined, positionSource: "computed" };
}

// ── 코인 쓰기 경로 ──
const coinPos = (c: Crypto) => ({
  cryptoId: c.id, quantity: c.quantity, avgPrice: c.averagePrice, avgExchangeRate: 0,
  source: c.positionSource ?? "manual", effectiveDate: c.positionEffectiveDate ?? c.purchaseDate, lockedByManual: false,
});
const ctx = (o: Partial<CryptoTransaction>): CryptoTransaction => ({
  id: `c${++seq}`, cryptoId: "k1", symbol: "BTC", name: "비트코인", type: "buy", quantity: 10, price: 100,
  date: "2026-11-01", reflected: true, createdAt: `2026-11-01T00:00:${String(seq).padStart(2, "0")}.000Z`, ...o,
} as CryptoTransaction);
const manualCoin = (o: Partial<Crypto> = {}): Crypto => ({
  id: "k1", name: "비트코인", symbol: "BTC", quantity: 10, averagePrice: 100, currentPrice: 150, purchaseDate: "2026-01-01", ...o,
} as Crypto);
function recordCoin(coin: Crypto, t: CryptoTransaction): Crypto {
  const p = computeNewPosition(coinPos(coin), t);
  return { ...coin, quantity: p.quantity, averagePrice: p.avgPrice, positionSource: "computed", positionEffectiveDate: t.date };
}
function deleteCoinTx(coin: Crypto, all: CryptoTransaction[], txId: string): Crypto {
  const r = rollbackTransaction(coinPos(coin), all.filter((t) => t.cryptoId === coin.id), txId);
  return { ...coin, quantity: r.quantity, averagePrice: r.avgPrice, positionSource: "computed" };
}

// 결과 기록용
const out: string[] = [];
const log = (s: string) => { out.push(s); };

describe("#354 주식 — 전량 매도 기록 삭제", () => {
  it("경우 1: 직접 10@100 → 전량 매도 10@130 → 매도 삭제", () => {
    let s = manualStock();
    const sell = stx({ type: "sell", quantity: 10, price: 130, date: "2026-11-20" });
    s = recordStock(s, sell);
    expect([s.quantity, s.averagePrice]).toEqual([0, 0]); // 전량 매도 후 저장값
    const after = deleteStockTx(s, [sell], sell.id);
    log(`주식 경우1 삭제 후 저장값 quantity=${after.quantity} averagePrice=${after.averagePrice} (기대 10/100)`);
    expect(after.quantity).toBe(10);
    expect(after.averagePrice).toBe(0); // 결함: 기대 100
  });
  it("경우 2: 직접 10@100 + 매수 10@120 → 전량 매도 20@130 → 매도 삭제", () => {
    let s = manualStock();
    const buy = stx({ type: "buy", quantity: 10, price: 120, date: "2026-11-10" });
    s = recordStock(s, buy);
    expect([s.quantity, s.averagePrice]).toEqual([20, 110]);
    const sell = stx({ type: "sell", quantity: 20, price: 130, date: "2026-11-20" });
    s = recordStock(s, sell);
    expect([s.quantity, s.averagePrice]).toEqual([0, 0]);
    const after = deleteStockTx(s, [buy, sell], sell.id);
    log(`주식 경우2 삭제 후 저장값 quantity=${after.quantity} averagePrice=${after.averagePrice} (기대 20/110)`);
    expect(after.quantity).toBe(20);
    expect(after.averagePrice).toBeCloseTo(0, 9); // 결함: 기대 110 (기준분 역산 10@-120)
  });
  it("통제군: 직접 10@100 → 일부 매도 4 → 매도 삭제 = 10@100 복원", () => {
    let s = manualStock();
    const sell = stx({ type: "sell", quantity: 4, price: 130, date: "2026-11-20" });
    s = recordStock(s, sell);
    expect([s.quantity, s.averagePrice]).toEqual([6, 100]);
    const after = deleteStockTx(s, [sell], sell.id);
    log(`주식 통제군(일부 매도) 삭제 후 quantity=${after.quantity} averagePrice=${after.averagePrice}`);
    expect([after.quantity, after.averagePrice]).toEqual([10, 100]);
  });
  it("통제군: 직접 10@100 + 매수 10@120 → 일부 매도 5 → 매도 삭제 = 20@110 복원", () => {
    let s = manualStock();
    const buy = stx({ type: "buy", quantity: 10, price: 120, date: "2026-11-10" });
    s = recordStock(s, buy);
    const sell = stx({ type: "sell", quantity: 5, price: 130, date: "2026-11-20" });
    s = recordStock(s, sell);
    const after = deleteStockTx(s, [buy, sell], sell.id);
    log(`주식 통제군2 삭제 후 quantity=${after.quantity} averagePrice=${after.averagePrice}`);
    expect(after.quantity).toBe(20);
    expect(after.averagePrice).toBeCloseTo(110, 9);
  });
  it("경계: 앱 기록만(기준 0) 매수 10@120 → 전량 매도 → 매도 삭제 = 10@120 정상", () => {
    let s = manualStock({ quantity: 0, averagePrice: 0 });
    const buy = stx({ type: "buy", quantity: 10, price: 120, date: "2026-11-10" });
    s = recordStock(s, buy);
    const sell = stx({ type: "sell", quantity: 10, price: 130, date: "2026-11-20" });
    s = recordStock(s, sell);
    const after = deleteStockTx(s, [buy, sell], sell.id);
    log(`주식 경계(앱 기록만) 삭제 후 quantity=${after.quantity} averagePrice=${after.averagePrice}`);
    expect([after.quantity, after.averagePrice]).toEqual([10, 120]);
  });
});

describe("#354 코인 — 전량 매도 기록 삭제", () => {
  it("경우 1: 직접 10@100 → 전량 매도 → 매도 삭제", () => {
    let c = manualCoin();
    const sell = ctx({ type: "sell", quantity: 10, price: 130, date: "2026-11-20" });
    c = recordCoin(c, sell);
    expect([c.quantity, c.averagePrice]).toEqual([0, 0]);
    const after = deleteCoinTx(c, [sell], sell.id);
    log(`코인 경우1 삭제 후 quantity=${after.quantity} averagePrice=${after.averagePrice} (기대 10/100)`);
    expect(after.quantity).toBe(10);
    expect(after.averagePrice).toBe(0);
  });
  it("경우 2: 직접 10@100 + 매수 10@120 → 전량 매도 → 매도 삭제", () => {
    let c = manualCoin();
    const buy = ctx({ type: "buy", quantity: 10, price: 120, date: "2026-11-10" });
    c = recordCoin(c, buy);
    const sell = ctx({ type: "sell", quantity: 20, price: 130, date: "2026-11-20" });
    c = recordCoin(c, sell);
    const after = deleteCoinTx(c, [buy, sell], sell.id);
    log(`코인 경우2 삭제 후 quantity=${after.quantity} averagePrice=${after.averagePrice} (기대 20/110)`);
    expect(after.quantity).toBe(20);
    expect(after.averagePrice).toBeCloseTo(0, 9);
  });
  it("통제군: 일부 매도 4 삭제 = 10@100", () => {
    let c = manualCoin();
    const sell = ctx({ type: "sell", quantity: 4, price: 130, date: "2026-11-20" });
    c = recordCoin(c, sell);
    const after = deleteCoinTx(c, [sell], sell.id);
    log(`코인 통제군 삭제 후 quantity=${after.quantity} averagePrice=${after.averagePrice}`);
    expect([after.quantity, after.averagePrice]).toEqual([10, 100]);
  });
  it("영향: 복원 행 원가 0 → 손익 = 평가액 전체(10 × 150 = 1,500, 정상 500)", () => {
    let c = manualCoin();
    const sell = ctx({ type: "sell", quantity: 10, price: 130, date: "2026-11-20" });
    c = recordCoin(c, sell);
    const after = deleteCoinTx(c, [sell], sell.id);
    const profit = after.quantity * after.currentPrice - after.quantity * after.averagePrice;
    log(`코인 경우1 복원 후 손익=${profit} (정상 500)`);
    expect(profit).toBe(1500);
  });
});

describe("#355 다 판 코인 — 상세 목록 소실", () => {
  const loan = (o: Partial<Loan>): Loan => ({ id: "l1", type: "credit", name: "신용대출A", balance: 0, interestRate: 5, startDate: "2025-01-01", ...o } as Loan);

  it("[저장 관문 미통과 가정] 단일 코인 수량 0 → 카드 0개·'등록된 암호화폐가 없습니다'·내역 버튼 0", () => {
    let c = manualCoin({ exchange: undefined });
    const sell = ctx({ type: "sell", quantity: 10, price: 130, date: "2026-11-20" });
    c = recordCoin(c, sell);
    mockData = { crypto: [c], loans: [], cryptoTransactions: [sell] };
    mockSummary = { cryptoValue: 0, cryptoProfit: 0, cryptoCost: 0, loanBalance: 0 };
    const html = renderToStaticMarkup(<CryptoTab />);
    const hasEmpty = html.includes("등록된 암호화폐가 없습니다");
    const names = (html.match(/비트코인/g) ?? []).length;
    log(`코인 전량 매도 후: 저장 항목 ${mockData.crypto.length}개(qty=${c.quantity}), 상세 '비트코인' 표시 ${names}회, 빈 문구=${hasEmpty}, '내역' 버튼 ${(html.match(/내역/g) ?? []).length}개`);
    expect(mockData.crypto.length).toBe(1); // 항목은 지워지지 않음
    expect(hasEmpty).toBe(true);
    expect(names).toBe(0);
  });
  it("통제군: 두 거래소 중 한쪽만 0개 → 묶음 카드 유지, 0개 거래소 항목도 '거래소별 항목'에 남음", () => {
    const a = manualCoin({ id: "k1", exchange: "업비트", quantity: 0, averagePrice: 0, positionSource: "computed" });
    const b = manualCoin({ id: "k2", exchange: "빗썸", quantity: 5 });
    mockData = { crypto: [a, b], loans: [], cryptoTransactions: [] };
    mockSummary = { cryptoValue: 750, cryptoProfit: 250, cryptoCost: 500, loanBalance: 0 };
    const html = renderToStaticMarkup(<CryptoTab />);
    log(`통제군(두 거래소): 빈 문구=${html.includes("등록된 암호화폐가 없습니다")}, 카드 '비트코인' ${(html.match(/비트코인/g) ?? []).length}회`);
    expect(html.includes("등록된 암호화폐가 없습니다")).toBe(false);
    expect(html).toContain("비트코인");
  });
  it("통제군: 대출 잔액 0 → '완납된 대출' 구역에 내역·기록 버튼", () => {
    mockData = { crypto: [], loans: [loan({ balance: 0 })], cryptoTransactions: [] };
    mockSummary = { cryptoValue: 0, cryptoProfit: 0, cryptoCost: 0, loanBalance: 0 };
    const html = renderToStaticMarkup(<LoanTab />);
    log(`통제군(대출 완납): '완납된 대출' 구역=${html.includes("완납된 대출")}, 이름 표시=${html.includes("신용대출A")}`);
    expect(html).toContain("완납된 대출");
    expect(html).toContain("신용대출A");
    expect(html).toMatch(/내역/);
  });

  it("결과 출력", () => {
    console.log("\n[qa-5175]\n" + out.join("\n"));
  });
});
