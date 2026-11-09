// #109 (a) 자산 삭제 시 거래 정리 — 자산 간 흐름 표 A1~A8(C42) + 평가액 0 예외 + 3경로 + 연결 짝 기록·잔액 불변(4.58 F24)
import { describe, expect, it } from "vitest";
import { planDeleteCryptos, planDeleteStocks } from "@/contexts/asset-data-context";
import { computeSettlementCauses, matchRecordedTransferDetail } from "@/app/(main)/_components/views/activity/change-hero";
import { computeAttributionBetween, getAttributionItems, type AttributionTransfer } from "@/lib/report/asset-report";
import { buildLink, cryptoLinkTrade, stockLinkTrade } from "@/lib/trade/linked-record";
import type { AssetData, Crypto, CryptoTransaction, MonthlyAssetSnapshot, Stock, Transaction } from "@/types/asset";

const RATES = { USD: 1400, JPY: 900 };
const M = 1_000_000;
const X = M; // 매수·매도 금액
const data = (o: Partial<AssetData> = {}): AssetData => ({
  realEstate: [], stocks: [], crypto: [], cash: [], loans: [],
  yearlyNetAssets: [], transactions: [], cashTransactions: [], loanTransactions: [], cryptoTransactions: [],
  lastUpdated: "2026-01-01T00:00:00.000Z", nickname: "", ...o,
});

type Kind = "none" | "cash" | "loan";
type Asset = "crypto" | "stock";
interface Case { id: string; asset: Asset; side: "buy" | "sell"; kind: Kind; month: "this" | "last" }

const snap = (month: string, date: string, o: { cash: number; held: number; loans: number }, asset: Asset): MonthlyAssetSnapshot => ({
  month, date, netAsset: o.cash + o.held - o.loans, financialAsset: o.cash + o.held,
  breakdown: { realEstate: 0, stocks: asset === "stock" ? o.held : 0, crypto: asset === "crypto" ? o.held : 0, cash: o.cash, loans: o.loans, tenantDeposit: 0, physical: 0 },
  fx: { ...RATES }, fxBase: { USD: 0, JPY: 0 },
  cost: { total: o.cash + o.held, stock: asset === "stock" ? o.held : 0, crypto: asset === "crypto" ? o.held : 0, realEstate: 0, physical: 0 },
});

/** 삭제 직전 데이터(코인/주식이 아직 있다)와 월별 스냅샷 4점(1월·9월말·10월말·11월 삭제 후) */
function build(c: Case) {
  const date = c.month === "this" ? "2026-11-03" : "2026-10-10";
  const qty = c.side === "buy" ? 1 : 0; // 매도 행 = 전량 매도(수량 0)
  const coin: Crypto = { id: "c1", symbol: "BTC", name: "비트코인", quantity: qty, averagePrice: X, currentPrice: X, purchaseDate: "2026-01-02" } as Crypto;
  const stock: Stock = { id: "s1", ticker: "005930", name: "삼성", quantity: qty, averagePrice: X, currentPrice: X, currency: "KRW", category: "domestic" } as unknown as Stock;
  const ctx: CryptoTransaction = { id: "crtx_1", cryptoId: "c1", symbol: "BTC", name: "비트코인", type: c.side, quantity: 1, price: X, date, reflected: true, createdAt: "x" } as CryptoTransaction;
  const stx: Transaction = { id: "tx_1", stockId: "s1", ticker: "005930", stockName: "삼성", type: c.side, quantity: 1, price: X, currency: "KRW", date, reflected: true, createdAt: "x" } as Transaction;
  const sign = c.side === "buy" ? -1 : 1; // 현금 잔액 방향
  const startCash = c.kind === "cash" ? 10 * M : 10 * M;
  const loans0 = 30 * M;
  let d = data({
    cash: [{ id: "a", type: "bank", name: "주거래", balance: startCash, currency: "KRW" } as AssetData["cash"][number]],
    loans: [{ id: "l", type: "credit", name: "신용", balance: loans0, interestRate: 0, startDate: "2025-01-01" }],
    ...(c.asset === "crypto" ? { crypto: [coin], cryptoTransactions: [ctx] } : { stocks: [stock], transactions: [stx] }),
  });
  const trade = c.asset === "crypto" ? cryptoLinkTrade(ctx) : stockLinkTrade(stx);
  if (c.kind !== "none") {
    const b = buildLink(d, trade, c.kind === "cash" ? { kind: "cash", cashId: "a" } : { kind: "loan", loanId: "l" }, c.month === "this" ? "2026-11-05" : "2026-10-31");
    if (!b.ok) throw new Error(b.reason);
    d = b.data;
  }
  // 거래 반영 뒤 계좌 상태(연결이면 잔액·대출이 움직인다)
  const cashAfter = c.kind === "cash" ? startCash + sign * X : startCash;
  const loanAfter = c.kind === "loan" ? loans0 - sign * X : loans0; // 매수=대출 증가, 매도=상환
  const heldBefore = c.side === "buy" ? 0 : X; // 거래 전 보유 평가액
  const heldAfter = c.side === "buy" ? X : 0;
  const JAN_SEP = { cash: startCash, held: heldBefore, loans: loans0 };
  const AFTER = { cash: cashAfter, held: heldAfter, loans: loanAfter };
  const DELETED = { cash: cashAfter, held: 0, loans: loanAfter };
  // 거래 전 → 거래 후(거래 달 끝) → 삭제 후(11월)
  const sep = snap("2026-09", "2026-09-30", JAN_SEP, c.asset);
  const oct = snap("2026-10", "2026-10-31", c.month === "last" ? AFTER : JAN_SEP, c.asset);
  const nov = snap("2026-11", "2026-11-05", DELETED, c.asset);
  const jan = snap("2026-01", "2026-01-31", JAN_SEP, c.asset);
  return { before: d, sep, oct, nov, jan };
}

const planOf = (a: Asset, d: AssetData) => (a === "crypto" ? planDeleteCryptos(d, ["c1"], RATES) : planDeleteStocks(d, ["s1"], RATES));
/** main 동작: 자산만 지우고 거래는 남김(수정 전 deleteCrypto·묶음 삭제) */
const mainOf = (a: Asset, d: AssetData): AssetData => (a === "crypto" ? { ...d, crypto: [] } : { ...d, stocks: [] });

function view(d: AssetData, start: MonthlyAssetSnapshot, end: MonthlyAssetSnapshot, includeStartDay = false) {
  const live = { date: end.date, _date: end.date, _display: end.date, netAsset: 0, financialAsset: 0 } as unknown as Parameters<typeof computeSettlementCauses>[0]["live"];
  const mapped = computeSettlementCauses({ start, end, live, deltaNet: end.netAsset - start.netAsset, startDate: start.date!, endDate: end.date!, liveCash: 0, exchangeHistory: {}, assetData: d, rates: RATES }).mapped;
  const attr = computeAttributionBetween(start, end, {}, d, RATES, includeStartDay)!;
  const items = getAttributionItems(attr, matchRecordedTransferDetail(d, start.date!, end.date!, RATES) as AttributionTransfer);
  return {
    deltaNet: mapped.deltaNet,
    causes: mapped.causes.map((c) => `${c.key}:${Math.round(c.amount)}`),
    items: items.map((i) => `${i.key}:${Math.round(i.amount)}`),
    effects: attr.effects.filter((e) => Math.round(e.amount) !== 0).map((e) => `${e.key}:${Math.round(e.amount)}`),
  };
}

const cases: Case[] = [
  { id: "A1", asset: "crypto", side: "buy", kind: "none", month: "this" },
  { id: "A2", asset: "crypto", side: "buy", kind: "none", month: "last" },
  { id: "A3", asset: "crypto", side: "buy", kind: "cash", month: "this" },
  { id: "A4", asset: "crypto", side: "buy", kind: "cash", month: "last" },
  { id: "A5", asset: "crypto", side: "buy", kind: "loan", month: "this" },
  { id: "A6", asset: "crypto", side: "buy", kind: "loan", month: "last" },
  { id: "A7", asset: "crypto", side: "sell", kind: "cash", month: "this" },
  { id: "A8", asset: "crypto", side: "sell", kind: "cash", month: "last" },
];

// 기대값(수정 후). 키 표기는 자산 중립 — `A` = crypto|stock. nov=11월 결산 원인(effects: 엔진 원자료, causes: 결산 화면 원인), year=연 탭(1월→11월)
// 10월 칸은 스냅샷에 원가(cost)가 있어 매수 줄이 원가 증감으로도 설명되므로 main과 같다(Hero·합계 불변). 원가가 없는 레거시 스냅샷일 때만 라벨이 시세 쪽으로 옮겨 간다.
const EXPECT: Record<string, { nov: [string[], string[]]; oct: [string[], string[]]; year: [string[], string[]] }> = {
  A1: { nov: [[], []], oct: [[], []], year: [[], []] },
  A2: { nov: [["sell:A:-1000000"], ["unrecorded:-1000000"]], oct: [["buy:A:1000000"], ["unrecorded:1000000"]], year: [[], []] },
  A3: { nov: [["income:-1000000"], ["income:-1000000"]], oct: [[], []], year: [["income:-1000000"], ["income:-1000000"]] },
  A4: { nov: [["sell:A:-1000000"], ["unrecorded:-1000000"]], oct: [["buy:A:1000000", "income:-1000000"], ["income:-1000000", "unrecorded:1000000"]], year: [["income:-1000000"], ["income:-1000000"]] },
  A5: { nov: [["debt:-1000000"], ["loan:-1000000"]], oct: [[], []], year: [["debt:-1000000"], ["loan:-1000000"]] },
  A6: { nov: [["sell:A:-1000000"], ["unrecorded:-1000000"]], oct: [["buy:A:1000000", "debt:-1000000"], []], year: [["debt:-1000000"], ["loan:-1000000"]] },
  A7: { nov: [["sell:A:-1000000", "income:1000000"], []], oct: [[], []], year: [["sell:A:-1000000", "income:1000000"], []] },
  A8: { nov: [[], []], oct: [["sell:A:-1000000", "income:1000000"], []], year: [["sell:A:-1000000", "income:1000000"], []] },
};

describe("흐름 표 A1~A8 (코인·주식 공통): 삭제 후 홈·결산·연 원인", () => {
  it.each(cases.flatMap((c) => [c, { ...c, id: c.id, asset: "stock" as const }]))("$id $asset", (c) => {
    const b = build(c);
    const after = planOf(c.asset, b.before), main = mainOf(c.asset, b.before);
    const fix = (a: string[]) => a.map((x) => x.replace("A", c.asset));
    const e = EXPECT[c.id];
    for (const [name, start, end, incl] of [["nov", b.oct, b.nov, false], ["oct", b.sep, b.oct, false], ["year", b.jan, b.nov, true]] as const) {
      const v = view(after, start, end, incl);
      expect(v.effects, `${c.id} ${name} effects`).toEqual(fix(e[name][0]));
      expect(v.causes, `${c.id} ${name} causes`).toEqual(e[name][1]);
      // Hero·순자산 합계는 삭제 전후(main 대비) 항상 같다 — 라벨만 바뀐다
      expect(v.deltaNet).toBe(view(main, start, end, incl).deltaNet);
    }
  });
  it("A7·A8(평가액 0 항목): 거래가 그대로 남는다 / 평가액이 남은 A1~A6은 해당 id 거래 0건", () => {
    for (const c of cases) for (const asset of ["crypto", "stock"] as const) {
      const b = build({ ...c, asset });
      const after = planOf(asset, b.before);
      const txs = asset === "crypto" ? after.cryptoTransactions : after.transactions;
      const orig = asset === "crypto" ? b.before.cryptoTransactions : b.before.transactions;
      expect(txs).toHaveLength(c.side === "sell" ? orig!.length : 0);
    }
  });
  it("연결 짝 기록·계좌 잔액·대출 잔액은 삭제 전과 같다(4.58 F24)", () => {
    for (const c of cases.filter((x) => x.kind !== "none")) for (const asset of ["crypto", "stock"] as const) {
      const b = build({ ...c, asset });
      const after = planOf(asset, b.before);
      expect(after.cash).toEqual(b.before.cash);
      expect(after.loans).toEqual(b.before.loans);
      expect(after.cashTransactions).toEqual(b.before.cashTransactions);
      expect(after.loanTransactions).toEqual(b.before.loanTransactions);
    }
  });
});

describe("삭제 계획: 경로·평가액 기준", () => {
  const coin = (id: string, quantity: number, currentPrice = 50_000_000): Crypto => ({ id, symbol: id.toUpperCase(), name: id, quantity, averagePrice: currentPrice, currentPrice, purchaseDate: "2026-01-02" } as Crypto);
  const ctx = (id: string, cryptoId: string, type: "buy" | "sell" = "buy"): CryptoTransaction => ({ id, cryptoId, symbol: "X", name: "x", type, quantity: 1, price: 1000, date: "2026-11-03", reflected: true, createdAt: "x" } as CryptoTransaction);
  const stk = (id: string, quantity: number, currentPrice = 70_000, currency = "KRW"): Stock => ({ id, ticker: id, name: id, quantity, averagePrice: currentPrice, currentPrice, currency, category: "domestic" } as unknown as Stock);
  const stx = (id: string, stockId: string, type: "buy" | "sell" = "buy"): Transaction => ({ id, stockId, ticker: "T", stockName: "t", type, quantity: 1, price: 1000, currency: "KRW", date: "2026-11-03", reflected: true, createdAt: "x" } as Transaction);

  it("deleteCrypto 단건: 그 코인 거래 0건, 다른 코인 거래는 그대로", () => {
    const d = data({ crypto: [coin("c1", 1), coin("c2", 1)], cryptoTransactions: [ctx("t1", "c1"), ctx("t2", "c1", "sell"), ctx("t3", "c2")] });
    const r = planDeleteCryptos(d, ["c1"], RATES);
    expect(r.crypto.map((c) => c.id)).toEqual(["c2"]);
    expect(r.cryptoTransactions!.map((t) => t.id)).toEqual(["t3"]);
  });
  it("코인 묶음 삭제: 모든 id의 거래 0건", () => {
    const d = data({ crypto: [coin("c1", 1), coin("c2", 2), coin("c3", 1)], cryptoTransactions: [ctx("t1", "c1"), ctx("t2", "c2"), ctx("t3", "c3")] });
    const r = planDeleteCryptos(d, ["c1", "c2"], RATES);
    expect(r.cryptoTransactions!.map((t) => t.id)).toEqual(["t3"]);
  });
  it("주식 묶음 삭제: 모든 id의 거래 0건", () => {
    const d = data({ stocks: [stk("s1", 3), stk("s2", 1), stk("s3", 1)], transactions: [stx("t1", "s1"), stx("t2", "s2"), stx("t3", "s3")] });
    const r = planDeleteStocks(d, ["s1", "s2"], RATES);
    expect(r.stocks.map((s) => s.id)).toEqual(["s3"]);
    expect(r.transactions.map((t) => t.id)).toEqual(["t3"]);
  });
  it("코인 잔량 1e-12 삭제: 평가액 반올림 0원 → 거래 보존", () => {
    const d = data({ crypto: [coin("c1", 1e-12)], cryptoTransactions: [ctx("t1", "c1"), ctx("t2", "c1", "sell")] });
    expect(planDeleteCryptos(d, ["c1"], RATES).cryptoTransactions).toHaveLength(2);
  });
  it("시세 0 코인도 거래 보존", () => {
    const d = data({ crypto: [coin("c1", 1, 0)], cryptoTransactions: [ctx("t1", "c1")] });
    expect(planDeleteCryptos(d, ["c1"], RATES).cryptoTransactions).toHaveLength(1);
  });
  it("주식 전량 매도(수량 0) 후 삭제: 거래 보존", () => {
    const d = data({ stocks: [stk("s1", 0)], transactions: [stx("t1", "s1"), stx("t2", "s1", "sell")] });
    const r = planDeleteStocks(d, ["s1"], RATES);
    expect(r.stocks).toHaveLength(0);
    expect(r.transactions).toHaveLength(2);
  });
  it("평가액 1원 이상 잔량 삭제: 거래 0건(경계 0.5원 → 1원)", () => {
    const d = data({ crypto: [coin("c1", 1e-8, 100_000_000)], cryptoTransactions: [ctx("t1", "c1")] }); // 평가액 1원
    expect(planDeleteCryptos(d, ["c1"], RATES).cryptoTransactions).toHaveLength(0);
    const d2 = data({ stocks: [stk("s1", 1, 1)], transactions: [stx("t1", "s1")] });
    expect(planDeleteStocks(d2, ["s1"], RATES).transactions).toHaveLength(0);
    const half = data({ crypto: [coin("c1", 1e-8, 40_000_000)], cryptoTransactions: [ctx("t1", "c1")] }); // 0.4원
    expect(planDeleteCryptos(half, ["c1"], RATES).cryptoTransactions).toHaveLength(1);
  });
  it("묶음은 항목별 판정: 평가액 0 항목만 거래 보존", () => {
    const d = data({ crypto: [coin("c1", 1e-12), coin("c2", 1)], cryptoTransactions: [ctx("t1", "c1"), ctx("t2", "c2")] });
    expect(planDeleteCryptos(d, ["c1", "c2"], RATES).cryptoTransactions!.map((t) => t.id)).toEqual(["t1"]);
  });
  it("외화 주식은 원화 환산으로 판정", () => {
    const d = data({ stocks: [stk("s1", 1, 0.0003, "USD")], transactions: [stx("t1", "s1")] }); // 0.42원 → 0
    expect(planDeleteStocks(d, ["s1"], RATES).transactions).toHaveLength(1);
    const d2 = data({ stocks: [stk("s1", 1, 10, "USD")], transactions: [stx("t1", "s1")] });
    expect(planDeleteStocks(d2, ["s1"], RATES).transactions).toHaveLength(0);
  });
  it("빈 데이터·거래 없는 코인: 오류 없이 그대로", () => {
    expect(planDeleteCryptos(data(), ["x"], RATES).cryptoTransactions).toEqual([]);
    const d = data({ crypto: [coin("c1", 1)] });
    expect(planDeleteCryptos({ ...d, cryptoTransactions: undefined } as unknown as AssetData, ["c1"], RATES).cryptoTransactions).toEqual([]);
  });
  it("원본 데이터를 바꾸지 않는다", () => {
    const d = data({ crypto: [coin("c1", 1)], cryptoTransactions: [ctx("t1", "c1")] });
    planDeleteCryptos(d, ["c1"], RATES);
    expect(d.crypto).toHaveLength(1);
    expect(d.cryptoTransactions).toHaveLength(1);
  });
});
