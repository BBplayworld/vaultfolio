// #258 AC-10 — 처음 사는 종목 거래 저장(새 stock + 거래 + 짝 기록 + 잔액)이 결산·홈 원인에 새 줄을 만들지 않는다.
// 비교 기준은 #258 착수 직전 issue-5.134 head(1707b6b) — 원인 엔진(effects) 무변경이라 같은 엔진으로 저장 결과만 단언한다(#251 별도 파일).
import { describe, expect, it } from "vitest";
import { computeSettlementCauses, matchRecordedTransferDetail } from "@/app/(main)/_components/views/activity/change-hero";
import { computeAttributionBetween, getAttributionItems, type AttributionTransfer } from "@/lib/report/asset-report";
import { buildLink, stockLinkTrade, type LinkChoice } from "@/lib/trade/linked-record";
import { buildPickedStockDraft, withInitialPrice, type PickedTicker } from "@/lib/trade/new-stock";
import type { AssetData, MonthlyAssetSnapshot, Stock, Transaction } from "@/types/asset";

const RATES = { USD: 1390, JPY: 905 };
const M = 1_000_000;
const TODAY = "2026-11-05";
const NOW = new Date("2026-11-05T03:00:00Z");
const BUY_DATE = "2026-11-03";

const data = (o: Partial<AssetData> = {}): AssetData => ({
  realEstate: [], stocks: [], crypto: [], cash: [], loans: [],
  yearlyNetAssets: [], transactions: [], cashTransactions: [], loanTransactions: [], cryptoTransactions: [],
  lastUpdated: "2026-01-01T00:00:00.000Z", nickname: "", ...o,
});
const base = () => data({
  cash: [{ id: "a", type: "bank", name: "주거래", balance: 10 * M, currency: "KRW" }],
  loans: [{ id: "l", type: "credit", name: "신용", balance: 30 * M, interestRate: 0, startDate: "2025-01-01" }],
});
const snap = (month: string, date: string, o: { cash: number; stock: number; stockCost: number; loans: number }): MonthlyAssetSnapshot => ({
  month, date, netAsset: o.cash + o.stock - o.loans, financialAsset: o.cash + o.stock,
  breakdown: { realEstate: 0, stocks: o.stock, crypto: 0, cash: o.cash, loans: o.loans, tenantDeposit: 0, physical: 0 },
  fx: { ...RATES }, fxBase: { USD: 0, JPY: 0 },
  cost: { total: o.cash + o.stockCost, stock: o.stockCost, crypto: 0, realEstate: 0, physical: 0 },
});
const START = snap("2026-10", "2026-10-31", { cash: 10 * M, stock: 20 * M, stockCost: 20 * M, loans: 30 * M });
const LIVE = { date: TODAY, _date: TODAY, _display: TODAY, netAsset: 0, financialAsset: 0 } as unknown as Parameters<typeof computeSettlementCauses>[0]["live"];
const END = (o: { cash: number; stock: number; stockCost: number; loans: number }) => snap("2026-11", TODAY, o);

// 거래 입력 onSubmit 새 종목 분기와 같은 순서로 만든 저장 결과(새 stock 1 + 거래 1 + 짝 기록 + 잔액)
function savedNewStock(picked: PickedTicker, qty: number, price: number, link: LinkChoice | undefined, krwPerUsd?: number): AssetData {
  const stockId = "stock_new";
  const category = picked.market === "us" ? "foreign" : "domestic";
  const draft = buildPickedStockDraft(stockId, picked, { broker: "토스증권", category });
  const tx: Transaction = {
    id: "tx_new", stockId, ticker: picked.ticker, stockName: picked.name, type: "buy", quantity: qty, price,
    currency: picked.market === "us" ? "USD" : "KRW", exchangeRate: krwPerUsd, date: BUY_DATE, reflected: true,
    reflectedAt: "2026-11-03T00:00:00.000Z", reflectionId: "ref_1", createdAt: "x",
  } as Transaction;
  const stock: Stock = withInitialPrice(
    { ...draft, purchaseDate: BUY_DATE, quantity: qty, averagePrice: price, purchaseExchangeRate: krwPerUsd, positionSource: "computed", positionEffectiveDate: BUY_DATE } as Stock,
    undefined, price,
  );
  let d = base();
  if (link) {
    const b = buildLink(d, stockLinkTrade(tx), link, TODAY, NOW);
    if (!b.ok) throw new Error(b.reason);
    d = b.data;
  }
  return { ...d, stocks: [stock], transactions: [tx] };
}

function run(d: AssetData, e: MonthlyAssetSnapshot) {
  const mapped = computeSettlementCauses({ start: START, end: e, live: LIVE, deltaNet: e.netAsset - START.netAsset, startDate: START.date!, endDate: e.date!, liveCash: 0, exchangeHistory: {}, assetData: d, rates: RATES }).mapped;
  const attr = computeAttributionBetween(START, e, {}, d, RATES, true)!;
  const transfer = matchRecordedTransferDetail(d, START.date!, e.date!, RATES) as AttributionTransfer;
  const items = getAttributionItems(attr, transfer);
  return { mapped, items, sumMapped: mapped.causes.reduce((s, c) => s + c.amount, 0), keys: mapped.causes.map((c) => c.key), detail: matchRecordedTransferDetail(d, START.date!, e.date!, RATES) };
}
const BANNED = ["buy", "buy:stock", "income", "unrecorded", "newCash"];

const KR: PickedTicker = { ticker: "005930", name: "삼성전자", market: "kr", exchange: "코스피" };
const US: PickedTicker = { ticker: "AAPL", name: "Apple", market: "us", exchange: "NASDAQ" };

describe("#258 AC-10 결산·홈 원인 — 처음 사는 종목 + 연결 계좌", () => {
  it("ⓐ 국내 종목 + 원화 통장: 월 결산·홈 원인 0줄(주식 매수·신규 현금·기록 안 된 변화 없음), Σ원인=Δ순자산", () => {
    const d = savedNewStock(KR, 10, 100_000, { kind: "cash", cashId: "a" });
    const r = run(d, END({ cash: 9 * M, stock: 21 * M, stockCost: 21 * M, loans: 30 * M }));
    expect(r.keys).toEqual([]);
    expect(r.items).toEqual([]);
    expect(r.sumMapped).toBe(r.mapped.deltaNet);
    expect(r.detail.out.stock).toBe(M);
  });
  it("ⓑ 해외 종목 + 원화 통장 환산: 원인 0줄, 환산 금액이 짝으로 잡힘", () => {
    // 10주 × $100 × 1,390원 = 1,390,000원
    const d = savedNewStock(US, 10, 100, { kind: "cash", cashId: "a" }, 1390);
    const r = run(d, END({ cash: 10 * M - 1_390_000, stock: 20 * M + 1_390_000, stockCost: 20 * M + 1_390_000, loans: 30 * M }));
    expect(r.keys).toEqual([]);
    expect(r.items).toEqual([]);
    expect(r.sumMapped).toBe(r.mapped.deltaNet);
    expect(r.detail.out.stock).toBe(1_390_000);
  });
  it("ⓒ 대출 연결: 원인 0줄, 대출 증가는 짝(viaLoan.buy)", () => {
    const d = savedNewStock(KR, 10, 100_000, { kind: "loan", loanId: "l" });
    const r = run(d, END({ cash: 10 * M, stock: 21 * M, stockCost: 21 * M, loans: 31 * M }));
    expect(r.keys).toEqual([]);
    expect(r.items).toEqual([]);
    expect(r.sumMapped).toBe(r.mapped.deltaNet);
    expect(r.detail.viaLoan.buy).toBe(M);
  });
  it("같은 달 시세 변동만 있으면 원인은 시세(가격) 줄뿐 — Σ원인=Δ순자산 유지", () => {
    const d = savedNewStock(KR, 10, 100_000, { kind: "cash", cashId: "a" });
    const r = run(d, END({ cash: 9 * M, stock: 21.2 * M, stockCost: 21 * M, loans: 30 * M }));
    expect(r.keys.filter((k) => BANNED.includes(k))).toEqual([]);
    expect(r.sumMapped).toBe(r.mapped.deltaNet);
  });
});

describe("#258 AC-10 ⓓ 연결 안 함 — 기존 `주식 추가`와 같은 원인 분류", () => {
  it("연결 안 함 저장과 주식 추가(거래 없음)가 같은 원인 키·금액", () => {
    const viaTrade = savedNewStock(KR, 10, 100_000, undefined);
    const viaAdd: AssetData = { ...viaTrade, transactions: [], stocks: viaTrade.stocks.map((s) => ({ ...s, positionSource: undefined, positionEffectiveDate: undefined })) };
    const e = END({ cash: 10 * M, stock: 21 * M, stockCost: 21 * M, loans: 30 * M });
    const a = run(viaTrade, e);
    const b = run(viaAdd, e);
    expect(a.mapped.causes.map((c) => [c.key, c.amount])).toEqual(b.mapped.causes.map((c) => [c.key, c.amount]));
    expect(a.sumMapped).toBe(a.mapped.deltaNet);
    expect(a.mapped.causes.map((c) => [c.key, c.amount])).toEqual([["unrecorded", M]]); // 주식 추가와 같은 분류(연결 안 함은 현금이 그대로라 기록 안 된 변화)
  });
});
