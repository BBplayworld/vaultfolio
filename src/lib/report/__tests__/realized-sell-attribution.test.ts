// 4.64 D1 — 반영 매도의 실현손익은 '기록 안 된 변화'가 아니라 시세로 분류한다(#117).
// 리허설(P5b·P5d·P5big·코인 이익/손실·F1 대조) 픽스처를 커밋. 합계·Hero·매도 대금 쪽은 불변, 키 간 이동만 확인.
import { describe, expect, it } from "vitest";
import { computeAttributionBetween } from "@/lib/report/asset-report";
import { computeSettlementCauses } from "@/app/(main)/_components/views/activity/change-hero";
import { buildLink, type LinkTrade } from "@/lib/trade/linked-record";
import type { AssetData, MonthlyAssetSnapshot } from "@/types/asset";
import type { CashTransaction, CryptoTransaction, Transaction } from "@/types/transaction";

const RATES = { USD: 1400, JPY: 900 };
const empty = (o: Partial<AssetData> = {}): AssetData => ({
  realEstate: [], stocks: [], crypto: [], cash: [], loans: [],
  yearlyNetAssets: [], transactions: [], cashTransactions: [], loanTransactions: [], cryptoTransactions: [],
  lastUpdated: "2026-01-01T00:00:00.000Z", nickname: "", ...o,
});

interface S { cash: number; stock?: number; stockCost?: number; crypto?: number; cryptoCost?: number; fx?: { USD: number; JPY: number } }
const snap = (month: string, date: string, o: S): MonthlyAssetSnapshot => {
  const stock = o.stock ?? 0, crypto = o.crypto ?? 0, sc = o.stockCost ?? 0, cc = o.cryptoCost ?? 0;
  return {
    month, date, netAsset: o.cash + stock + crypto, financialAsset: o.cash + stock + crypto,
    breakdown: { realEstate: 0, stocks: stock, crypto, cash: o.cash, loans: 0, tenantDeposit: 0, physical: 0 },
    fx: { ...(o.fx ?? RATES) }, fxBase: { USD: 0, JPY: 0 },
    cost: { total: o.cash + sc + cc, stock: sc, crypto: cc, realEstate: 0, physical: 0 },
  };
};
const dep = (amount: number, date = "2026-11-18"): CashTransaction => ({ id: "ctx_1", cashId: "a", type: "deposit", amount, currency: "KRW", date, reflected: true, createdAt: "x" });
const stockTx = (o: Partial<Transaction>): Transaction => ({ id: "tx_1", stockId: "s", ticker: "005930", stockName: "삼성", type: "sell", quantity: 1, price: 1, currency: "KRW", date: "2026-11-18", reflected: true, createdAt: "2026-11-18T01:00:00Z", ...o });
const cryptoTx = (o: Partial<CryptoTransaction>): CryptoTransaction => ({ id: "crtx_1", cryptoId: "c", symbol: "BTC", name: "BTC", type: "sell", quantity: 1, price: 1, date: "2026-11-18", reflected: true, createdAt: "2026-11-18T01:00:00Z", ...o });

const START = snap("2026-10", "2026-10-31", { cash: 10_000_000, stock: 7_000_000, stockCost: 6_200_000 });
const run = (d: AssetData, e: MonthlyAssetSnapshot, start: MonthlyAssetSnapshot = START) => {
  const a = computeAttributionBetween(start, e, {}, d, RATES, true)!;
  const m = new Map(a.effects.map((x) => [x.key, x.amount]));
  const sum = a.effects.reduce((s, x) => s + x.amount, 0);
  return { a, m, sum, get: (k: string) => m.get(k as never) ?? 0 };
};
const sampleStock = (qty: number, avg = 62_000, price = 72_500) => ({ id: "s", category: "domestic" as const, name: "삼성", ticker: "005930", quantity: qty, averagePrice: avg, currentPrice: price, currency: "KRW" as const, purchaseDate: "2026-01-01" });

describe("D1 주식 반영 매도 — 정밀 분기", () => {
  it("P5big: 100주(평단 62,000) 중 60주를 72,500에 매도 → 시세 +250,000, 기록 안 된 변화·매수 0", () => {
    const d = empty({ stocks: [sampleStock(40)], transactions: [stockTx({ quantity: 60, price: 72_500 })], cashTransactions: [dep(4_350_000)] });
    const e = snap("2026-11", "2026-11-30", { cash: 14_350_000, stock: 2_900_000, stockCost: 2_480_000 });
    const r = run(d, e);
    expect(r.sum).toBeCloseTo(e.netAsset - START.netAsset, 6);
    expect(r.get("price:stock")).toBeCloseTo(250_000, 6);
    expect(r.get("sell:stock")).toBeCloseTo(-4_350_000, 6); // 매도 대금 쪽 불변
    expect(r.get("income")).toBe(4_350_000);
    expect(r.get("cash")).toBeCloseTo(0, 6);
    expect(r.get("buy:stock")).toBe(0);
    expect(r.a.priceEffect + r.a.fxEffect + r.a.savingEffect + r.a.buyEffect + r.a.sellEffect + r.a.incomeEffect + r.a.debtEffect).toBeCloseTo(r.a.deltaNet, 6);
  });

  it("손실 매도: 평단 80,000 중 30주를 72,500에 매도 → 음수가 시세로, 매도 줄에 새지 않음", () => {
    const start = snap("2026-10", "2026-10-31", { cash: 10_000_000, stock: 7_000_000, stockCost: 8_000_000 }); // 100주 @80,000
    const d = empty({ stocks: [sampleStock(70, 80_000)], transactions: [stockTx({ quantity: 30, price: 72_500 })], cashTransactions: [dep(2_175_000)] });
    const e = snap("2026-11", "2026-11-30", { cash: 12_175_000, stock: 5_075_000, stockCost: 5_600_000 });
    const r = run(d, e, start);
    expect(r.sum).toBeCloseTo(e.netAsset - start.netAsset, 6);
    // 시세 변동 총액 = 100주 × 2,500 = +250,000 (실현 손실 −225,000이 시세 안에서 반영됨. 수정 전엔 475,000 + 매도 줄 −225,000)
    expect(r.get("price:stock")).toBeCloseTo(250_000, 6);
    expect(r.get("sell:stock")).toBeCloseTo(-2_175_000, 6);
    expect(r.get("cash")).toBeCloseTo(0, 6);
  });

  it("매도 뒤 추가 매수가 있어도 매도 시점 평단으로 계산(역순 제거)", () => {
    // 100주 @62,000 보유 → 11/10 60주 매도 @72,500 → 11/20 40주 @80,000 매수 → 현재 80주 평균 71,000
    const d = empty({
      stocks: [sampleStock(80, 71_000, 80_000)],
      transactions: [
        stockTx({ id: "tx_s", quantity: 60, price: 72_500, date: "2026-11-10" }),
        stockTx({ id: "tx_b", type: "buy", quantity: 40, price: 80_000, date: "2026-11-20", createdAt: "2026-11-20T01:00:00Z" }),
      ],
      cashTransactions: [dep(4_350_000, "2026-11-10")],
    });
    const e = snap("2026-11", "2026-11-30", { cash: 14_350_000 - 3_200_000, stock: 6_400_000, stockCost: 5_680_000 });
    const r = run(d, e);
    expect(r.sum).toBeCloseTo(e.netAsset - START.netAsset, 6);
    expect(r.get("cash")).toBeCloseTo(-3_200_000, 6); // 출금 기록 없는 매수 대금(현행 동작)
    // 실현 R = 4,350,000 − 60×62,000 = 630,000 이 시세로 간다 (기록 안 된 변화로 새지 않음)
    expect(r.get("buy:stock") + r.get("sell:stock")).toBeCloseTo(3_200_000 - 4_350_000, 6);
  });

  it("역산 불가(전량 매도로 평단이 지워짐)면 R=0 — 현행 동작", () => {
    const d = empty({ stocks: [sampleStock(0, 0)], transactions: [stockTx({ quantity: 100, price: 72_500 })], cashTransactions: [dep(7_250_000)] });
    const e = snap("2026-11", "2026-11-30", { cash: 17_250_000, stock: 0, stockCost: 0 });
    const r = run(d, e);
    expect(r.sum).toBeCloseTo(e.netAsset - START.netAsset, 6);
    expect(r.get("price:stock")).toBeCloseTo(-7_000_000 + 6_200_000, 6);
  });

  it("외화(USD) 매도: 체결액 − 수량×직전 평단×월초 환율이 시세로", () => {
    // 10주, 평단 $100 (월초 환율 1400 → 원가 1,400,000), 시세 $140
    const s0 = snap("2026-10", "2026-10-31", { cash: 10_000_000, stock: 1_960_000, stockCost: 1_400_000, fx: RATES });
    const d = empty({
      stocks: [{ id: "s", category: "foreign", name: "A", ticker: "AAPL", quantity: 6, averagePrice: 100, currentPrice: 140, currency: "USD", purchaseDate: "2026-01-01" }],
      transactions: [stockTx({ stockId: "s", ticker: "AAPL", quantity: 4, price: 150, currency: "USD", exchangeRate: 1400 })], // 체결 $600 = 840,000
      cashTransactions: [dep(840_000)],
    });
    const e = snap("2026-11", "2026-11-30", { cash: 10_840_000, stock: 1_176_000, stockCost: 840_000 });
    const r = run(d, e, s0);
    expect(r.sum).toBeCloseTo(e.netAsset - s0.netAsset, 6);
    expect(r.get("cash")).toBeCloseTo(0, 6);
    expect(r.get("buy:stock")).toBe(0);
    expect(r.get("price:stock")).toBeCloseTo(56_000, 6); // 체결 $150 vs 시세 $140 × 4주 (실현 R=280,000 포함)
  });
});

describe("D1 코인 반영 매도", () => {
  const coin = (qty: number, avg: number, price: number) => ({ id: "c", name: "BTC", symbol: "BTC", quantity: qty, averagePrice: avg, currentPrice: price, purchaseDate: "2026-01-01" });
  it("이익 매도: 1개(평단 1,000만) 중 0.5개를 1,300만에 매도 → 기록 안 된 변화 0, 시세 귀속", () => {
    const d = empty({ crypto: [coin(0.5, 10_000_000, 13_000_000)], cryptoTransactions: [cryptoTx({ quantity: 0.5, price: 13_000_000 })], cashTransactions: [dep(6_500_000)] });
    const e = snap("2026-11", "2026-11-30", { cash: 16_500_000, crypto: 6_500_000, cryptoCost: 5_000_000 });
    const r = run(d, e, snap("2026-10", "2026-10-31", { cash: 10_000_000, crypto: 12_000_000, cryptoCost: 10_000_000 }));
    expect(r.sum).toBeCloseTo(e.netAsset - 22_000_000, 6);
    expect(r.get("price:crypto")).toBeCloseTo(1_000_000, 6); // (1,300만−1,200만)×1개
    expect(r.get("sell:crypto")).toBeCloseTo(-6_500_000, 6);
    expect(r.get("cash")).toBeCloseTo(0, 6);
    expect(r.get("buy:crypto")).toBe(0);
  });
  it("손실 매도: 평단 1,500만 코인 0.4개를 1,100만에 매도 → 음수가 시세로, 대출·기록 안 된 변화 줄 없음", () => {
    const st = snap("2026-10", "2026-10-31", { cash: 10_000_000, crypto: 12_000_000, cryptoCost: 15_000_000 });
    const d = empty({ crypto: [coin(0.6, 15_000_000, 11_000_000)], cryptoTransactions: [cryptoTx({ quantity: 0.4, price: 11_000_000 })], cashTransactions: [dep(4_400_000)] });
    const e = snap("2026-11", "2026-11-30", { cash: 14_400_000, crypto: 6_600_000, cryptoCost: 9_000_000 });
    const r = run(d, e, st);
    expect(r.sum).toBeCloseTo(e.netAsset - st.netAsset, 6);
    expect(r.get("price:crypto")).toBeCloseTo(-1_000_000 * 1, 6); // (1,100만−1,200만)×1개
    expect(r.get("cash")).toBeCloseTo(0, 6);
    expect(r.get("sell:crypto")).toBeCloseTo(-4_400_000, 6);
  });
});

describe("D1 가드 — 매도 없는 구간·예측 분기 diff 0", () => {
  it("매도 없음: 시세만 변한 구간은 시세 단일 원인", () => {
    const d = empty({ stocks: [sampleStock(100, 62_000, 72_500)] });
    const e = snap("2026-11", "2026-11-30", { cash: 10_000_000, stock: 7_250_000, stockCost: 6_200_000 });
    const r = run(d, e);
    expect(r.get("price:stock")).toBeCloseTo(250_000, 6);
    expect(r.m.size).toBeGreaterThan(0);
    expect(r.get("cash")).toBe(0);
  });
  it("미반영 매도·구간 밖 매도는 R에 들어가지 않는다", () => {
    const d = empty({
      stocks: [sampleStock(100, 62_000, 72_500)],
      transactions: [stockTx({ quantity: 10, price: 90_000, reflected: false }), stockTx({ id: "tx_old", quantity: 10, price: 90_000, date: "2026-10-15" })],
    });
    const e = snap("2026-11", "2026-11-30", { cash: 10_000_000, stock: 7_250_000, stockCost: 6_200_000 });
    const r = run(d, e);
    expect(r.get("price:stock")).toBeCloseTo(250_000, 6);
  });
  it("시작 스냅샷이 레거시(예측 분기)면 매도가 있어도 시세 단일 key 유지·합계 일치", () => {
    const legacy = { month: "2026-10", date: "2026-10-31", netAsset: 17_000_000, financialAsset: 17_000_000 } as MonthlyAssetSnapshot;
    const d = empty({ stocks: [sampleStock(40)], transactions: [stockTx({ quantity: 60, price: 72_500 })], cashTransactions: [dep(4_350_000)] });
    const e = snap("2026-11", "2026-11-30", { cash: 14_350_000, stock: 2_900_000, stockCost: 2_480_000 });
    const a = computeAttributionBetween(legacy, e, {}, d, RATES, true)!;
    expect(a.estimated).toBe(true);
    expect(a.effects.some((x) => x.key === "price:stock")).toBe(false);
    expect(a.effects.reduce((s, x) => s + x.amount, 0)).toBeCloseTo(a.deltaNet, 6);
  });
});

// #119(4.63) 조합 — 해외주식(USD) 매도를 원화 현금·대출에 연결: D1이 같은 환산(tradeKrwRate)을 쓰는지 확인
describe("D1 × #119 원화 연결 외화 매도", () => {
  const FX = { USD: 1390, JPY: 905 };
  const snapL = (month: string, date: string, o: { cash: number; stock: number; stockCost: number; loans: number }): MonthlyAssetSnapshot => ({
    month, date, netAsset: o.cash + o.stock - o.loans, financialAsset: o.cash + o.stock,
    breakdown: { realEstate: 0, stocks: o.stock, crypto: 0, cash: o.cash, loans: o.loans, tenantDeposit: 0, physical: 0 },
    fx: { ...FX }, fxBase: { USD: 0, JPY: 0 },
    cost: { total: o.cash + o.stockCost, stock: o.stockCost, crypto: 0, realEstate: 0, physical: 0 },
  });
  const START_L = snapL("2026-10", "2026-10-31", { cash: 5_000_000, stock: 3_614_000, stockCost: 2_780_000, loans: 3_000_000 }); // 20주 @ $100, 시세 $130
  const sellTrade: LinkTrade = { id: "tx_1", type: "sell", quantity: 10, price: 130, fee: 0, currency: "USD", exchangeRate: 1390, date: "2026-11-03", name: "Apple" };
  const baseL = () => empty({
    cash: [{ id: "a", type: "bank", name: "주거래", balance: 5_000_000, currency: "KRW" }],
    loans: [{ id: "l", type: "credit", name: "신용", balance: 3_000_000, interestRate: 0, startDate: "2025-01-01" }],
    stocks: [{ id: "s", category: "foreign", name: "Apple", ticker: "AAPL", quantity: 10, averagePrice: 100, currentPrice: 130, currency: "USD", purchaseDate: "2026-01-01" }],
  });
  const settle = (choice: Parameters<typeof buildLink>[2], end: { cash: number; stock: number; stockCost: number; loans: number }) => {
    const b = buildLink(baseL(), sellTrade, choice, "2026-11-05", new Date("2026-11-05T03:00:00Z"));
    if (!b.ok) throw new Error(b.reason);
    const d: AssetData = { ...b.data, transactions: [{ id: "tx_1", stockId: "s", ticker: "AAPL", stockName: "Apple", type: "sell", quantity: 10, price: 130, currency: "USD", exchangeRate: 1390, date: "2026-11-03", reflected: true, createdAt: "x" }] };
    const e = snapL("2026-11", "2026-11-05", end);
    const live = { date: "2026-11-05", _date: "2026-11-05", _display: "2026-11-05", netAsset: 0, financialAsset: 0 } as unknown as Parameters<typeof computeSettlementCauses>[0]["live"];
    const mapped = computeSettlementCauses({ start: START_L, end: e, live, deltaNet: e.netAsset - START_L.netAsset, startDate: "2026-10-31", endDate: "2026-11-05", liveCash: 0, exchangeHistory: {}, assetData: d, rates: FX }).mapped;
    return { mapped, e, a: computeAttributionBetween(START_L, e, {}, d, FX, true)! };
  };
  it("원화 현금 입금 연결 매도: Hero 불변(Δ0), 결산 원인 0(수정 전 매수 +417,000·시세 −417,000 등 잔차)", () => {
    const r = settle({ kind: "cash", cashId: "a" }, { cash: 6_807_000, stock: 1_807_000, stockCost: 1_390_000, loans: 3_000_000 });
    expect(r.mapped.deltaNet).toBe(0);
    expect(r.mapped.causes.map((c) => [c.key, c.amount])).toEqual([]);
    expect(r.a.effects.reduce((s, x) => s + x.amount, 0)).toBeCloseTo(0, 6);
  });
  it("대출 상환 연결 매도: Hero 불변, 결산 원인 0", () => {
    const r = settle({ kind: "loan", loanId: "l" }, { cash: 5_000_000, stock: 1_807_000, stockCost: 1_390_000, loans: 1_193_000 });
    expect(r.mapped.deltaNet).toBe(0);
    expect(r.mapped.causes.map((c) => [c.key, c.amount])).toEqual([]);
  });
});
