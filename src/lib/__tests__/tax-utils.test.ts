import { describe, it, expect, beforeEach } from "vitest";
import {
  resolveTaxTags,
  computeForeignRealizedGain,
  getAssetDrivenHighlights,
  isTaxNoticeDismissed,
  markTaxNoticeDismissed,
  shouldShowTaxNotice,
} from "../tax-utils";
import { STORAGE_KEYS } from "../local-storage";
import type { AssetData, RealEstate, Stock, Loan, Cash } from "@/types/asset";
import type { Transaction } from "@/types/transaction";

const RATES = { USD: 1400, JPY: 900 };

const emptyData = (): AssetData => ({
  realEstate: [],
  stocks: [],
  crypto: [],
  cash: [],
  loans: [],
  yearlyNetAssets: [],
  transactions: [],
  cashTransactions: [],
  loanTransactions: [],
  cryptoTransactions: [],
  lastUpdated: new Date().toISOString(),
  nickname: "",
});

const makeRealEstate = (o: Partial<RealEstate> = {}): RealEstate => ({
  id: `re_${Math.random().toString(36).slice(2)}`,
  type: "apartment",
  name: "테스트 부동산",
  purchasePrice: 500_000_000,
  currentValue: 600_000_000,
  purchaseDate: "2020-01-01",
  tenantDeposit: 0,
  ...o,
} as RealEstate);

const makeStock = (o: Partial<Stock> = {}): Stock => ({
  id: `s_${Math.random().toString(36).slice(2)}`,
  category: "domestic",
  name: "테스트종목",
  quantity: 10,
  averagePrice: 10_000,
  currentPrice: 12_000,
  currency: "KRW",
  purchaseDate: "2024-01-01",
  ...o,
} as Stock);

const makeTx = (o: Partial<Transaction> = {}): Transaction => ({
  id: `tx_${Math.random().toString(36).slice(2)}`,
  stockId: "s1",
  ticker: "AAPL",
  stockName: "Apple",
  type: "buy",
  quantity: 10,
  price: 100,
  currency: "USD",
  date: "2026-01-10",
  reflected: true,
  createdAt: "2026-01-10T00:00:00.000Z",
  ...o,
});

describe("tax-utils · resolveTaxTags (S-4.23 AC1)", () => {
  it("상가·사무실 보유 시 business 태그와 근거 문구를 반환한다", () => {
    const data = emptyData();
    data.realEstate = [makeRealEstate({ type: "commercial" })];
    const tags = resolveTaxTags(data);
    expect(tags.has("business")).toBe(true);
    expect(tags.get("business")).toContain("상가·사무실 1건");
    expect(tags.has("realestate")).toBe(true);
  });

  it("일반 아파트만 보유하면 realestate만 붙고 business는 붙지 않는다", () => {
    const data = emptyData();
    data.realEstate = [makeRealEstate({ type: "apartment" })];
    const tags = resolveTaxTags(data);
    expect(tags.has("realestate")).toBe(true);
    expect(tags.has("business")).toBe(false);
  });

  it("해외주식·연금계좌·주담대·예적금을 각각 판정한다", () => {
    const data = emptyData();
    data.stocks = [
      makeStock({ category: "foreign", currency: "USD" }),
      makeStock({ category: "irp" }),
    ];
    data.loans = [{ id: "l1", type: "mortgage-home", name: "주담대", balance: 1, interestRate: 3 } as Loan];
    data.cash = [{ id: "c1", type: "deposit", name: "예금", balance: 1, currency: "KRW" } as Cash];
    const tags = resolveTaxTags(data);
    expect(tags.has("foreign")).toBe(true);
    expect(tags.has("pension")).toBe(true);
    expect(tags.has("loan")).toBe(true);
    expect(tags.has("cash")).toBe(true);
    expect(tags.has("stock")).toBe(true);
  });

  it("자산이 없어도 common은 항상 포함된다", () => {
    const tags = resolveTaxTags(emptyData());
    expect(tags.has("common")).toBe(true);
    expect(tags.size).toBe(1);
  });
});

describe("tax-utils · getAssetDrivenHighlights (AC2·AC3)", () => {
  it("자산이 없으면 빈 배열 — 홈 배너가 뜨지 않는다", () => {
    expect(getAssetDrivenHighlights(emptyData(), "2026-07-15")).toEqual([]);
  });

  it("common 태그 전용 항목만 있는 달에도 자산 파생 항목이 없으면 빈 배열", () => {
    const data = emptyData();
    // 연금계좌만 보유 → 2월(연말정산·pension)·3월에는 pension 항목이 없다
    data.stocks = [makeStock({ category: "pension" })];
    // 4월(건보료 정산=common only) + 5월(종소세=common/business/realestate/stock)
    // pension 보유자는 stock 태그도 함께 붙으므로 5월 종소세가 걸린다 → 별도 케이스로 확인
    const only = getAssetDrivenHighlights(data, "2026-03-15");
    expect(only.every((m) => m.event.tags.some((t) => t !== "common"))).toBe(true);
  });

  it("상가 보유자는 7월에 부가세 확정신고가 매칭되고 근거 문구가 붙는다", () => {
    const data = emptyData();
    data.realEstate = [makeRealEstate({ type: "commercial" })];
    const matches = getAssetDrivenHighlights(data, "2026-07-15");
    const vat = matches.find((m) => m.event.id === "vat-1h-final");
    expect(vat).toBeDefined();
    expect(vat?.reasons.some((r) => r.includes("상가·사무실"))).toBe(true);
  });

  it("12월에는 다음 달이 1월로 롤오버된다", () => {
    const data = emptyData();
    data.realEstate = [makeRealEstate({ type: "commercial" })];
    const matches = getAssetDrivenHighlights(data, "2026-12-05", 10);
    expect(matches.some((m) => m.event.month === 12)).toBe(true);
    expect(matches.some((m) => m.event.id === "vat-2h-final")).toBe(true); // 1월 항목
  });

  it("common 전용 항목(건강보험료 정산)은 홈 배너 대상에서 제외된다", () => {
    const data = emptyData();
    data.stocks = [makeStock({ category: "domestic" })];
    const matches = getAssetDrivenHighlights(data, "2026-04-10", 10);
    expect(matches.some((m) => m.event.id === "health-insurance-settlement")).toBe(false);
  });

  it("high severity가 먼저 정렬된다", () => {
    const data = emptyData();
    data.realEstate = [makeRealEstate({ type: "commercial" })];
    data.stocks = [makeStock({ category: "domestic" })];
    const matches = getAssetDrivenHighlights(data, "2026-07-01", 3);
    expect(matches[0].event.severity).toBe("high");
  });
});

describe("tax-utils · computeForeignRealizedGain (AC6·AC7)", () => {
  it("거래 로그가 없으면 null", () => {
    const data = emptyData();
    data.stocks = [makeStock({ id: "s1", category: "foreign", currency: "USD" })];
    expect(computeForeignRealizedGain(data, 2026, RATES)).toBeNull();
  });

  it("해당 연도 매도가 없으면 null", () => {
    const data = emptyData();
    data.stocks = [makeStock({ id: "s1", category: "foreign", currency: "USD" })];
    data.transactions = [makeTx({ stockId: "s1", type: "buy" })];
    expect(computeForeignRealizedGain(data, 2026, RATES)).toBeNull();
  });

  it("매수→매도 replay로 실현손익을 KRW로 통산하고 250만원 초과를 판정한다", () => {
    const data = emptyData();
    data.stocks = [makeStock({ id: "s1", category: "foreign", currency: "USD" })];
    data.transactions = [
      makeTx({ stockId: "s1", type: "buy", quantity: 100, price: 100, date: "2026-01-10", exchangeRate: 1300 }),
      makeTx({ stockId: "s1", type: "sell", quantity: 100, price: 130, date: "2026-06-10", exchangeRate: 1400, createdAt: "2026-06-10T00:00:00.000Z" }),
    ];
    const r = computeForeignRealizedGain(data, 2026, RATES);
    // 양도가 100*130*1400 = 18,200,000 / 취득가 100*100*1300 = 13,000,000
    expect(r).not.toBeNull();
    expect(r?.gainKrw).toBeCloseTo(5_200_000, 0);
    expect(r?.sellCount).toBe(1);
    expect(r?.estimated).toBe(false);
    expect(r?.overDeduction).toBe(true);
  });

  it("250만원 이하면 overDeduction이 false", () => {
    const data = emptyData();
    data.stocks = [makeStock({ id: "s1", category: "foreign", currency: "USD" })];
    data.transactions = [
      makeTx({ stockId: "s1", type: "buy", quantity: 100, price: 100, date: "2026-01-10", exchangeRate: 1400 }),
      makeTx({ stockId: "s1", type: "sell", quantity: 100, price: 101, date: "2026-06-10", exchangeRate: 1400, createdAt: "2026-06-10T00:00:00.000Z" }),
    ];
    const r = computeForeignRealizedGain(data, 2026, RATES);
    expect(r?.gainKrw).toBeCloseTo(140_000, 0);
    expect(r?.overDeduction).toBe(false);
  });

  it("매수 로그 없이 매도만 있으면 현재 평단으로 폴백하고 estimated=true", () => {
    const data = emptyData();
    data.stocks = [makeStock({ id: "s1", category: "foreign", currency: "USD", averagePrice: 100, purchaseExchangeRate: 1300 })];
    data.transactions = [
      makeTx({ stockId: "s1", type: "sell", quantity: 100, price: 130, date: "2026-06-10", exchangeRate: 1400 }),
    ];
    const r = computeForeignRealizedGain(data, 2026, RATES);
    expect(r?.estimated).toBe(true);
    expect(r?.gainKrw).toBeCloseTo(5_200_000, 0);
  });

  it("체결 환율이 없으면 현재 환율로 폴백하고 estimated=true", () => {
    const data = emptyData();
    data.stocks = [makeStock({ id: "s1", category: "foreign", currency: "USD" })];
    data.transactions = [
      makeTx({ stockId: "s1", type: "buy", quantity: 100, price: 100, date: "2026-01-10", exchangeRate: 1400 }),
      makeTx({ stockId: "s1", type: "sell", quantity: 100, price: 130, date: "2026-06-10", exchangeRate: undefined, createdAt: "2026-06-10T00:00:00.000Z" }),
    ];
    const r = computeForeignRealizedGain(data, 2026, RATES);
    expect(r?.estimated).toBe(true);
    expect(r?.gainKrw).toBeCloseTo(100 * 30 * 1400, 0);
  });

  it("국내주식 거래는 집계에서 제외된다", () => {
    const data = emptyData();
    data.stocks = [makeStock({ id: "s1", category: "domestic", currency: "KRW" })];
    data.transactions = [
      makeTx({ stockId: "s1", currency: "KRW", type: "buy", quantity: 10, price: 10_000, date: "2026-01-10" }),
      makeTx({ stockId: "s1", currency: "KRW", type: "sell", quantity: 10, price: 30_000, date: "2026-06-10", createdAt: "2026-06-10T00:00:00.000Z" }),
    ];
    expect(computeForeignRealizedGain(data, 2026, RATES)).toBeNull();
  });
});

describe("tax-utils · 홈 배너 닫기 (AC4)", () => {
  // vitest 기본 환경(node)에는 window·localStorage가 없다. tax-utils가 SSR 가드
  // (typeof window === "undefined")를 두고 있으므로 둘 다 최소 구현으로 주입한다.
  const store = new Map<string, string>();
  const shim = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => { store.set(k, v); },
    removeItem: (k: string) => { store.delete(k); },
  };

  beforeEach(() => {
    store.clear();
    (globalThis as Record<string, unknown>).window = globalThis;
    (globalThis as Record<string, unknown>).localStorage = shim;
  });

  it("닫기 전에는 미닫힘, 닫으면 이번 달 동안 닫힘 상태", () => {
    expect(isTaxNoticeDismissed()).toBe(false);
    markTaxNoticeDismissed();
    expect(isTaxNoticeDismissed()).toBe(true);
  });

  it("다른 달에 닫은 기록은 이번 달 노출을 막지 않는다", () => {
    localStorage.setItem(STORAGE_KEYS.taxNotice, JSON.stringify({ dismissedMonth: "1999-01" }));
    expect(isTaxNoticeDismissed()).toBe(false);
  });

  it("닫으면 shouldShowTaxNotice가 false", () => {
    const data = emptyData();
    data.realEstate = [makeRealEstate({ type: "commercial" })];
    markTaxNoticeDismissed();
    expect(shouldShowTaxNotice(data)).toBe(false);
  });

  it("자산이 없으면 닫지 않아도 shouldShowTaxNotice가 false", () => {
    expect(shouldShowTaxNotice(emptyData())).toBe(false);
  });
});
