// 4.65 #122 — 구간 안 외화 매수·입출금의 환율 몫을 '환율'로 (costFxRevaluation을 구간 시작 보유분 기준으로).
// 리허설 픽스처(P5b·U1·U3·F1 + 외화 매매 없는 대조군)를 커밋. 대조군 기대값은 main(v4.64) 실측 그대로(C48: causes 자체 비교),
// 바뀌는 4건은 main 값을 주석으로 남긴다. 합계·Hero는 모든 케이스에서 불변.
import { describe, expect, it, vi } from "vitest";
import { computeAssetCost, computeNetAsset } from "@/contexts/asset-data-context";
import { computeAttributionBetween, buildLiveAttributionCurr } from "@/lib/report/asset-report";
import { computeSettlementCauses } from "@/app/(main)/_components/views/activity/change-hero";
import { applyBalanceEdits } from "@/lib/asset/balance-edits";
import { buildLink, stockLinkTrade, cryptoLinkTrade, type LinkTrade } from "@/lib/trade/linked-record";
import { computeNewPosition } from "@/lib/trade/trade-utils";
import type { AssetData, MonthlyAssetSnapshot, Stock, Transaction } from "@/types/asset";

const M = 1_000_000;
const R_OCT = { USD: 1400, JPY: 900 };
const R_NOV = { USD: 1420, JPY: 900 };

const empty = (): AssetData => ({
  realEstate: [], stocks: [], crypto: [], cash: [], loans: [], yearlyNetAssets: [], transactions: [], cashTransactions: [], loanTransactions: [], cryptoTransactions: [], physicalAssets: [],
  lastUpdated: "2026-10-31T09:00:00.000Z", nickname: "",
});

// ── 10월 말 사용자 상태 ──
function octData(): AssetData {
  const d = empty();
  d.yearlyNetAssets = [{ year: 2023, netAsset: 300 * M }, { year: 2024, netAsset: 380 * M }, { year: 2025, netAsset: 410 * M, note: "수동" }];
  d.realEstate = [{ id: "re1", type: "apartment", name: "우리집", purchasePrice: 400 * M, currentValue: 520 * M, purchaseDate: "2021-05-01", tenantDeposit: 0 } as AssetData["realEstate"][number]];
  d.stocks = [
    { id: "s_sam", category: "domestic", name: "삼성전자", ticker: "005930", quantity: 100, averagePrice: 62000, currentPrice: 70000, currency: "KRW", purchaseDate: "2024-03-02", broker: "키움증권" },
    { id: "s_aapl", category: "foreign", name: "애플", ticker: "AAPL", quantity: 20, averagePrice: 170, currentPrice: 190, currency: "USD", purchaseDate: "2024-06-02", purchaseExchangeRate: 1300, broker: "미래에셋증권" },
    { id: "s_nvda", category: "foreign", name: "엔비디아", ticker: "NVDA", quantity: 5, averagePrice: 120, currentPrice: 140, currency: "USD", purchaseDate: "2025-01-02", purchaseExchangeRate: 1350, broker: "미래에셋증권" },
  ] as Stock[];
  d.crypto = [{ id: "cr_btc", name: "비트코인", symbol: "BTC", quantity: 0.1, averagePrice: 90 * M, currentPrice: 100 * M, purchaseDate: "2024-02-01" } as AssetData["crypto"][number]];
  d.cash = [
    { id: "c_krw", type: "bank", name: "주거래 통장", balance: 30 * M, currency: "KRW" },
    { id: "c_usd", type: "bank", name: "달러 통장", balance: 2000, currency: "USD" },
  ] as AssetData["cash"];
  d.loans = [
    { id: "l_cred", type: "credit", name: "신용대출", balance: 20 * M, interestRate: 4.5, startDate: "2024-01-01" },
    { id: "l_mort", type: "mortgage-home", name: "주택담보", balance: 120 * M, interestRate: 3.8, startDate: "2021-05-01", linkedRealEstateId: "re1" },
  ] as AssetData["loans"];
  return d;
}

const mulOf = (r: typeof R_NOV) => (c?: string) => (c === "USD" ? r.USD : c === "JPY" ? r.JPY / 100 : 1);

// saveSnapshots와 같은 수식으로 스냅샷 박제
function mkSnap(d: AssetData, rates: typeof R_NOV, month: string, date: string): MonthlyAssetSnapshot {
  const nab = computeNetAsset(d, rates);
  const cost = computeAssetCost(d, rates);
  const fxBase = { USD: 0, JPY: 0 };
  for (const s of d.stocks) { if (s.currency === "USD") fxBase.USD += s.quantity * s.currentPrice * rates.USD; }
  for (const c of d.cash) { if (c.currency === "USD") fxBase.USD += c.balance * rates.USD; }
  return {
    month, date, netAsset: nab.netAsset, financialAsset: nab.financialAsset,
    breakdown: { realEstate: nab.realEstateValue, stocks: nab.stockValue, crypto: nab.cryptoValue, cash: nab.cashValue, loans: nab.loanBalance, tenantDeposit: nab.tenantDepositTotal, physical: nab.physicalValue },
    fx: { USD: rates.USD, JPY: rates.JPY }, fxBase,
    cost: { total: cost.realEstateCost + cost.physicalCost + cost.stockCost + cost.cryptoCost + nab.cashValue, stock: cost.stockCost, crypto: cost.cryptoCost, realEstate: cost.realEstateCost, physical: cost.physicalCost },
  };
}

function summaryOf(d: AssetData, rates: typeof R_NOV) {
  const n = computeNetAsset(d, rates);
  const c = computeAssetCost(d, rates);
  return {
    ...n, realEstateValue: n.realEstateValue, stockValue: n.stockValue, cryptoValue: n.cryptoValue, cashValue: n.cashValue, loanBalance: n.loanBalance,
    tenantDepositTotal: n.tenantDepositTotal, physicalValue: n.physicalValue, netAsset: n.netAsset,
    realEstateCost: c.realEstateCost, stockCost: c.stockCost, cryptoCost: c.cryptoCost, physicalCost: c.physicalCost,
  } as unknown as Parameters<typeof buildLiveAttributionCurr>[2];
}

// ── 11월 기본 시세 변화(모든 시나리오 공통, 대조군 포함) ──
function novPrices(d: AssetData): AssetData {
  return {
    ...d,
    stocks: d.stocks.map((s) => (s.id === "s_sam" ? { ...s, currentPrice: 72000 } : s.id === "s_aapl" ? { ...s, currentPrice: 200 } : s.id === "s_nvda" ? { ...s, currentPrice: 150 } : s)),
    crypto: d.crypto.map((c) => ({ ...c, currentPrice: 105 * M })),
  };
}

// ── 경로 함수 ──
type Step = (d: AssetData) => AssetData;
const stamp = (date: string) => ({ reflected: true, reflectedAt: `${date}T10:00:00.000Z`, createdAt: `${date}T10:00:00.000Z` });
let seq = 0;
const nid = (p: string) => `${p}_${1700000000000 + ++seq}`;

/** 주식 거래 기록(반영) + 포지션 갱신. link 있으면 buildLink. 반환 trade id */
function stockTrade(d: AssetData, o: { stockId: string; type: "buy" | "sell"; qty: number; price: number; date: string; link?: { kind: "cash"; cashId: string } | { kind: "loan"; loanId: string }; id?: string }): AssetData {
  const s = d.stocks.find((x) => x.id === o.stockId)!;
  const tx: Transaction = {
    id: o.id ?? nid("tx"), stockId: s.id, ticker: s.ticker ?? "", stockName: s.name, type: o.type, quantity: o.qty, price: o.price, currency: s.currency,
    ...(s.currency === "USD" ? { exchangeRate: R_NOV.USD } : {}), date: o.date, ...stamp(o.date),
  } as Transaction;
  const pos = computeNewPosition({ quantity: s.quantity, avgPrice: s.averagePrice, avgExchangeRate: s.purchaseExchangeRate ?? 0, source: "manual", effectiveDate: o.date, lockedByManual: false }, tx);
  let next: AssetData = {
    ...d,
    transactions: [...d.transactions, tx],
    stocks: d.stocks.map((x) => (x.id === s.id ? { ...x, quantity: pos.quantity, averagePrice: pos.avgPrice || x.averagePrice } : x)),
  };
  if (o.link) {
    const b = buildLink(next, stockLinkTrade(tx), o.link, o.date);
    if (!b.ok) throw new Error(`link fail ${b.reason}`);
    next = b.data;
  }
  return next;
}
function cryptoBuy(d: AssetData, o: { qty: number; price: number; date: string; link?: { kind: "cash"; cashId: string } | { kind: "loan"; loanId: string } }): AssetData {
  const c = d.crypto[0];
  const tx = { id: nid("crtx"), cryptoId: c.id, symbol: c.symbol, name: c.name, type: "buy" as const, quantity: o.qty, price: o.price, date: o.date, ...stamp(o.date) };
  const newQty = c.quantity + o.qty;
  const avg = (c.averagePrice * c.quantity + o.price * o.qty) / newQty;
  let next: AssetData = { ...d, cryptoTransactions: [...(d.cryptoTransactions ?? []), tx], crypto: d.crypto.map((x) => (x.id === c.id ? { ...x, quantity: newQty, averagePrice: avg } : x)) };
  if (o.link) {
    const b = buildLink(next, cryptoLinkTrade(tx as never), o.link, o.date);
    if (!b.ok) throw new Error(`link fail ${b.reason}`);
    next = b.data;
  }
  return next;
}
const cashWithdraw = (d: AssetData, cashId: string, amount: number, date: string, currency: "KRW" | "USD" = "KRW"): AssetData => ({
  ...d,
  cashTransactions: [...d.cashTransactions, { id: nid("ctx"), cashId, type: "withdrawal", amount, currency, date, ...stamp(date) } as AssetData["cashTransactions"][number]],
  cash: d.cash.map((c) => (c.id === cashId ? { ...c, balance: c.balance - amount } : c)),
});
const cashDeposit = (d: AssetData, cashId: string, amount: number, date: string, recurring = true): AssetData => ({
  ...d,
  cashTransactions: [...d.cashTransactions, { id: nid("ctx"), cashId, type: "deposit", amount, currency: "KRW", recurring, date, ...stamp(date) } as AssetData["cashTransactions"][number]],
  cash: d.cash.map((c) => (c.id === cashId ? { ...c, balance: c.balance + amount } : c)),
});
const loanRepay = (d: AssetData, loanId: string, amount: number, date: string): AssetData => ({
  ...d,
  loanTransactions: [...d.loanTransactions, { id: nid("ltx"), loanId, type: "repay", amount, date, ...stamp(date) } as AssetData["loanTransactions"][number]],
  loans: d.loans.map((l) => (l.id === loanId ? { ...l, balance: l.balance - amount } : l)),
});


// P1 잔액 맞추기(현금·대출) — 거래 기록 없음
const P1: Step = (d) => {
  const c = applyBalanceEdits(d.cash, { c_krw: d.cash[0].balance + 1_200_000, c_usd: 1800 }).list;
  const l = applyBalanceEdits(d.loans, { l_cred: 19 * M }).list;
  return { ...d, cash: c, loans: l };
};
// P5 연결 계좌
const P5a: Step = (d) => stockTrade(d, { stockId: "s_sam", type: "buy", qty: 20, price: 74000, date: "2026-11-05", link: { kind: "cash", cashId: "c_krw" } });
const P5b: Step = (d) => stockTrade(d, { stockId: "s_nvda", type: "sell", qty: 2, price: 145, date: "2026-11-08", link: { kind: "cash", cashId: "c_usd" } });
const P5c: Step = (d) => cryptoBuy(d, { qty: 0.01, price: 100 * M, date: "2026-11-09", link: { kind: "loan", loanId: "l_cred" } });
const P5d: Step = (d) => stockTrade(d, { stockId: "s_sam", type: "sell", qty: 10, price: 73000, date: "2026-11-15", link: { kind: "loan", loanId: "l_cred" } });
// 해외주식 원화 매수 기준선(#119 전): 연결 안 함 + 원화 현금 수동 출금 (±3일 짝 / 5일 어긋남)
const FXW_same: Step = (d) => { let n = cashWithdraw(d, "c_krw", 5 * 200 * R_NOV.USD, "2026-11-15"); n = stockTrade(n, { stockId: "s_aapl", type: "buy", qty: 5, price: 200, date: "2026-11-15" }); return n; };
const FXW_far: Step = (d) => { let n = cashWithdraw(d, "c_krw", 5 * 200 * R_NOV.USD, "2026-11-10"); n = stockTrade(n, { stockId: "s_aapl", type: "buy", qty: 5, price: 200, date: "2026-11-15" }); return n; };
const P5big: Step = (d) => stockTrade(d, { stockId: "s_sam", type: "sell", qty: 60, price: 72500, date: "2026-11-18", link: { kind: "cash", cashId: "c_krw" } });
const SALARY: Step = (d) => cashDeposit(d, "c_krw", 3 * M, "2026-11-25");
// Oct 말 baseline에 10월 연결 거래(지난달 연결) 포함: AAPL 10/20 매수 1주 연결 USD (10월 말에 이미 반영된 상태로 baseline 구성)
function octBase(): AssetData {
  const d = octData();
  // 10월 20일 NVDA 1주 매수(연결: USD 현금). 10월 말 상태에 이미 포함 — 수량/잔액은 octData에 반영된 값으로 간주하므로 기록만 추가
  const tx = { id: "tx_oct_nvda", stockId: "s_nvda", ticker: "NVDA", stockName: "엔비디아", type: "buy", quantity: 1, price: 125, currency: "USD", exchangeRate: 1400, date: "2026-10-20", ...stamp("2026-10-20") } as Transaction;
  const withTx = { ...d, transactions: [tx] };
  // 짝 기록만 추가(잔액은 이미 반영된 상태)
  const probe = { ...withTx, cash: withTx.cash.map((c) => (c.id === "c_usd" ? { ...c, balance: c.balance + 125 } : c)) };
  const b = buildLink(probe, stockLinkTrade(tx), { kind: "cash", cashId: "c_usd" }, "2026-10-20");
  if (!b.ok) throw new Error(b.reason);
  return b.data;
}

const U1: Step = (d) => stockTrade(d, { stockId: "s_aapl", type: "buy", qty: 5, price: 200, date: "2026-11-15", link: { kind: "cash", cashId: "c_krw" } });
const U2: Step = (d) => stockTrade(d, { stockId: "s_aapl", type: "sell", qty: 5, price: 200, date: "2026-11-15", link: { kind: "cash", cashId: "c_krw" } });
const U3: Step = (d) => stockTrade(d, { stockId: "s_aapl", type: "buy", qty: 5, price: 200, date: "2026-11-15", link: { kind: "loan", loanId: "l_cred" } });
const U4: Step = (d) => stockTrade(d, { stockId: "s_aapl", type: "sell", qty: 5, price: 200, date: "2026-11-15", link: { kind: "loan", loanId: "l_cred" } });
const U5: Step = (d) => stockTrade(d, { stockId: "s_nvda", type: "sell", qty: 3, price: 145, date: "2026-11-12", link: { kind: "cash", cashId: "c_krw" } });
const U6: Step = (d) => stockTrade(d, { stockId: "s_aapl", type: "sell", qty: 20, price: 205, date: "2026-11-20", link: { kind: "cash", cashId: "c_krw" } }); // 전량 매도

// ── 실행기: 10월 말 스냅샷 → 11월 경로 적용 → 결산(11/30 live 끝 / 12/01 저장 끝)·홈 효과 ──
function run(steps: Step[]) {
  seq = 0;
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-30T03:00:00Z"));
  try {
    const base = octBase();
    const oct = mkSnap(base, R_OCT, "2026-10", "2026-10-31");
    let d = { ...novPrices(base), lastUpdated: "2026-11-30T09:00:00.000Z" };
    for (const s of steps) d = s(d);
    const live = buildLiveAttributionCurr(d, R_NOV, summaryOf(d, R_NOV));
    const nab = computeNetAsset(d, R_NOV);
    const nov = mkSnap(d, R_NOV, "2026-11", "2026-11-30");
    const causesOf = (end: MonthlyAssetSnapshot | null) => computeSettlementCauses({
      start: oct, end, live, deltaNet: (end ? end.netAsset : nab.netAsset) - oct.netAsset, startDate: "2026-10-31", endDate: "2026-11-30", liveCash: nab.cashValue, exchangeHistory: {}, assetData: d, rates: R_NOV,
    }).mapped;
    const fmt = (m: ReturnType<typeof causesOf>) => m.causes.map((c) => `${c.key}:${Math.round(c.amount)}${c.estimated ? "(예)" : ""}`).join(" | ");
    const a = causesOf(null);
    const b = causesOf(nov);
    const home = computeAttributionBetween(oct, live, {}, d, R_NOV, true)!;
    return {
      liveStr: fmt(a), storedStr: fmt(b),
      liveSum: a.causes.reduce((s, c) => s + c.amount, 0), delta: nab.netAsset - oct.netAsset,
      storedSum: b.causes.reduce((s, c) => s + c.amount, 0), storedDelta: nov.netAsset - oct.netAsset,
      home, homeAmt: (k: string) => home.effects.find((e) => e.key === k)?.amount ?? 0,
    };
  } finally {
    vi.useRealTimers();
  }
}

describe("#122 리허설 — 외화 매수·매도 환율 잔차", () => {
  // 외화 매매·외화 입출금이 바뀌는 4건. main(v4.64) 값은 주석.
  const changed: Array<[string, Step[], string, number]> = [
    // main: price:1046600 | fx:130000 | loan:-5800(예)  (홈 현금 −5,800)
    ["P5b 달러 현금 연결 매도", [P5b], "price:1040800 | fx:130000", -411_800], // 홈 매도 줄 = 연결 매도 체결액(입금과 짝)
    // main: price:1075000 | fx:130000 | loan:-20000(예)  (홈 주식 매도 −20,000)
    ["U1 USD 매수 원화 현금 연결", [U1], "price:1055000 | fx:130000", 0],
    // main: price:1075000 | fx:130000 | loan:-20000(예)
    ["U3 USD 매수 대출 연결", [U3], "price:1055000 | fx:130000", 0],
    // main: price:1075000 | fx:130000 | loan:-20000(예)  (연결 안 함 + 원화 수동 출금 같은 날)
    ["F1 해외주식 원화 매수(짝 맞음)", [FXW_same], "price:1055000 | fx:130000", 0],
  ];
  it.each(changed)("%s: 대출·기록 안 된 변화 0, 홈 '주식 매도'·'현금' 잔차 없음, Hero·합계 불변", (_n, steps, expected, homeSell) => {
    const r = run(steps);
    expect(r.liveStr).toBe(expected);
    expect(r.storedStr).toBe(expected); // 12/01 저장 스냅샷 끝도 동일
    expect(r.liveStr).not.toMatch(/loan|unrecorded/);
    expect(r.liveSum).toBeCloseTo(r.delta, 6);
    expect(r.storedSum).toBeCloseTo(r.storedDelta, 6);
    expect(r.homeAmt("sell:stock")).toBeCloseTo(homeSell, 0); // 환율 잔차가 만든 허구의 '주식 매도'(main −20,000) 없음
    expect(Math.abs(r.homeAmt("cash"))).toBeLessThan(0.5);
    // 합 항등식(price+fx+saving+buy+sell+income+debt = Δ) 유지
    const h = r.home;
    expect(h.priceEffect + h.fxEffect + h.savingEffect + h.buyEffect + h.sellEffect + h.incomeEffect + h.debtEffect).toBeCloseTo(h.deltaNet, 6);
  });

  // C48 — 외화 매매 없는 구간(또는 매도만): causes 문자열이 main과 byte 동일. 새 원인 키 0.
  const same: Array<[string, Step[], string]> = [
    ["S0 시세만", [], "price:1055000 | fx:130000"],
    ["S0b 월급 입금", [SALARY], "price:1055000 | fx:130000 | income:3000000"],
    ["P1 잔액 맞추기", [P1], "price:1051000 | fx:130000 | unrecorded:1920000"],
    ["P5a 국내 연결 매수", [P5a], "price:1015000 | fx:130000"],
    ["P5d 연결 매도 대출 상환", [P5d], "price:1065000 | fx:130000"],
    ["P5big 큰 이익 매도", [P5big], "price:1085000 | fx:130000"],
    ["U2 USD 매도 원화 현금", [U2], "price:1055000 | fx:130000"],
    ["U4 USD 매도 대출 상환", [U4], "price:1055000 | fx:130000"],
    ["U5 NVDA 원화 매도", [U5], "price:1033700 | fx:130000"],
    ["U6 AAPL 전량 매도", [U6], "price:1197000 | fx:130000"],
  ];
  it.each(same)("%s: main과 동일(diff 0)", (_n, steps, expected) => {
    const r = run(steps);
    expect(r.liveStr).toBe(expected);
    expect(r.storedStr).toBe(expected);
    expect(r.liveSum).toBeCloseTo(r.delta, 6);
  });
});

// ── 합성 픽스처: 체결 환율 ≠ 끝 환율(실사용 형태), 대출 보유 — C52 잔차 목적지 ──
describe("#122 C52 — 대출 × 외화 × 환율 변동: 남는 잔차 목적지", () => {
  const P = { USD: 1400, JPY: 900 }, C = { USD: 1420, JPY: 900 };
  const mk = (month: string, date: string, fx: typeof P, o: { krw: number; usdCash: number; stock: number; loans: number; fxBase: number }): MonthlyAssetSnapshot => {
    const cash = o.krw + o.usdCash;
    return { month, date, netAsset: cash + o.stock - o.loans, financialAsset: cash + o.stock, breakdown: { realEstate: 0, stocks: o.stock, crypto: 0, cash, loans: o.loans, tenantDeposit: 0, physical: 0 }, fx, fxBase: { USD: o.fxBase, JPY: 0 }, cost: { total: cash + o.stock, stock: o.stock, crypto: 0, realEstate: 0, physical: 0 } };
  };
  const blank = (o: Partial<AssetData>): AssetData => ({ ...empty(), ...o });
  const live = { date: "2026-11-30", _date: "2026-11-30", _display: "2026-11-30", netAsset: 0, financialAsset: 0 } as unknown as Parameters<typeof computeSettlementCauses>[0]["live"];
  const settle = (s: MonthlyAssetSnapshot, e: MonthlyAssetSnapshot, d: AssetData) => {
    const m = computeSettlementCauses({ start: s, end: e, live, deltaNet: e.netAsset - s.netAsset, startDate: s.date!, endDate: e.date!, liveCash: 0, exchangeHistory: {}, assetData: d, rates: C }).mapped;
    return { m, str: m.causes.map((c) => `${c.key}:${Math.round(c.amount)}`).join(" | "), sum: m.causes.reduce((x, c) => x + c.amount, 0) };
  };
  const aapl = (qty: number): AssetData["stocks"][number] => ({ id: "s", category: "foreign", name: "A", ticker: "AAPL", quantity: qty, averagePrice: 100, currentPrice: 100, currency: "USD", purchaseDate: "2026-01-01" });

  it("매수 체결 1,410 → 끝 1,420: (끝−체결) 몫 5,000이 환율로, 대출(예)·기록 안 된 변화 없음 (main: 시세 +10,000 · 환율 20,000 · 기록 안 된 변화 −5,000)", () => {
    const s = mk("2026-10", "2026-10-31", P, { krw: 10e6, usdCash: 0, stock: 1_400_000, loans: 3e6, fxBase: 1_400_000 });
    const e = mk("2026-11", "2026-11-30", C, { krw: 10e6 - 705_000, usdCash: 0, stock: 2_130_000, loans: 3e6, fxBase: 0 });
    const d = blank({
      stocks: [aapl(15)],
      transactions: [{ id: "t1", stockId: "s", ticker: "AAPL", stockName: "A", type: "buy", quantity: 5, price: 100, currency: "USD", exchangeRate: 1410, date: "2026-11-10", reflected: true, createdAt: "2026-11-10T01:00:00Z" }],
      cashTransactions: [{ id: "c1", cashId: "a", type: "withdrawal", amount: 705_000, currency: "KRW", date: "2026-11-10", reflected: true, createdAt: "x" }],
    });
    const r = settle(s, e, d);
    expect(r.str).toBe("fx:25000");
    expect(r.sum).toBeCloseTo(25_000, 6);
    const a = computeAttributionBetween(s, e, {}, d, C, true)!;
    expect(a.fxEffect).toBeCloseTo(25_000, 6);
    expect(a.priceEffect + a.fxEffect + a.savingEffect + a.buyEffect + a.sellEffect + a.incomeEffect + a.debtEffect).toBeCloseTo(a.deltaNet, 6);
  });

  it("매도 체결 1,410 → USD 현금 입금(끝 1,420): 남는 잔차는 시세 −2,400 / 순유입 +2,400(합 0)으로 가고 대출·기록 안 된 변화는 없음 (main: 시세 +2,400 · 순유입 +2,400 · 기록 안 된 변화 −4,800)", () => {
    const s = mk("2026-10", "2026-10-31", P, { krw: 1e6, usdCash: 0, stock: 840_000, loans: 3e6, fxBase: 840_000 });
    const e = mk("2026-11", "2026-11-30", C, { krw: 1e6, usdCash: 340_800, stock: 511_200, loans: 3e6, fxBase: 0 });
    const base = blank({ stocks: [aapl(3)], cash: [{ id: "u", type: "bank", name: "usd", balance: 0, currency: "USD" }] });
    const trade: LinkTrade = { id: "t1", type: "sell", quantity: 2, price: 120, fee: 0, currency: "USD", exchangeRate: 1410, date: "2026-11-10", name: "A" };
    base.stocks[0] = { ...base.stocks[0], averagePrice: 120, currentPrice: 120 };
    const b = buildLink(base, trade, { kind: "cash", cashId: "u" }, "2026-11-12", new Date("2026-11-12T03:00:00Z"));
    if (!b.ok) throw new Error(b.reason);
    const d: AssetData = { ...b.data, transactions: [{ id: "t1", stockId: "s", ticker: "AAPL", stockName: "A", type: "sell", quantity: 2, price: 120, currency: "USD", exchangeRate: 1410, date: "2026-11-10", reflected: true, createdAt: "2026-11-10T01:00:00Z" }] };
    const r = settle(s, e, d);
    expect(r.str).toBe("price:-2400 | fx:12000 | income:2400");
    expect(r.str).not.toMatch(/loan|unrecorded/);
    expect(r.sum).toBeCloseTo(12_000, 6);
  });

  it("외화 현금 입금(구간 안)은 시작 보유분이 아니다: 달러 100 입금 + 환율 변동 → 입금분 환율 몫이 현금 잔차로 새지 않음", () => {
    // 시작: USD 현금 $1,000(1,400,000). 11/10 $100 입금(income = 100 × 끝 환율 142,000). 끝: $1,100 × 1,420.
    const s = mk("2026-10", "2026-10-31", P, { krw: 1e6, usdCash: 1_400_000, stock: 0, loans: 3e6, fxBase: 1_400_000 });
    const e = mk("2026-11", "2026-11-30", C, { krw: 1e6, usdCash: 1_562_000, stock: 0, loans: 3e6, fxBase: 0 });
    const d = blank({
      cash: [{ id: "u", type: "bank", name: "usd", balance: 1100, currency: "USD" }],
      cashTransactions: [{ id: "c1", cashId: "u", type: "deposit", amount: 100, currency: "USD", date: "2026-11-10", reflected: true, createdAt: "x" }],
    });
    const r = settle(s, e, d);
    expect(r.str).toBe("fx:20000 | income:142000");
    expect(r.str).not.toMatch(/loan|unrecorded/);
    expect(r.sum).toBeCloseTo(162_000, 6);
  });

  it("예측 분기(시작 스냅샷 레거시)는 diff 0 — 환율 몫 이동 없음", () => {
    const legacy = { month: "2026-10", date: "2026-10-31", netAsset: 8_400_000, financialAsset: 11_400_000 } as MonthlyAssetSnapshot;
    const e = mk("2026-11", "2026-11-30", C, { krw: 10e6 - 705_000, usdCash: 0, stock: 2_130_000, loans: 3e6, fxBase: 2_130_000 });
    const d = blank({
      stocks: [aapl(15)],
      transactions: [{ id: "t1", stockId: "s", ticker: "AAPL", stockName: "A", type: "buy", quantity: 5, price: 100, currency: "USD", exchangeRate: 1410, date: "2026-11-10", reflected: true, createdAt: "2026-11-10T01:00:00Z" }],
    });
    const a = computeAttributionBetween(legacy, e, { "2026-10-31": P }, d, C, true)!;
    expect(a.estimated).toBe(true);
    expect(a.effects.reduce((sum, x) => sum + x.amount, 0)).toBeCloseTo(a.deltaNet, 6);
    // 예측 환율 = 현재 외화 노출 × (끝/시작 − 1) 그대로(flowFx 가산 없음)
    expect(a.fxEffect).toBeCloseTo(2_130_000 * (1420 / 1400 - 1), 6);
  });
});
