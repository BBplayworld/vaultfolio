import { describe, it, expect } from "vitest";
import { CAUSE_DISPLAY_MIN, computeAttributionSince, computePeriodAttribution, getAttributionItems, getOrderedCauses, groupAttributionItems } from "../asset-report";
import type { AssetData, Crypto, DailyAssetSnapshot, Loan, MonthlyAssetSnapshot, SnapshotBreakdown, SnapshotCost, Stock } from "@/types/asset";
import type { CashTransaction, CryptoTransaction, LoanTransaction, Transaction } from "@/types/transaction";

// 원인분해 항등식 회귀 — 표시 항목의 합이 항상 Δ순자산과 일치해야 한다(S-4.22 AC6).
// resolveAttribution은 비공개라 computeAttributionSince를 통해 검증한다.

const RATES = { USD: 1400, JPY: 900 };

const emptyData = (): AssetData => ({
  realEstate: [], stocks: [], crypto: [], cash: [], loans: [],
  yearlyNetAssets: [], transactions: [], cashTransactions: [], loanTransactions: [], cryptoTransactions: [],
  lastUpdated: new Date().toISOString(), nickname: "",
});

// v2 enrich를 갖춘 daily 스냅샷 (정밀 분해 경로 진입 조건)
const snap = (date: string, netAsset: number, costTotal: number, loans = 0): DailyAssetSnapshot => ({
  date,
  netAsset,
  financialAsset: netAsset,
  breakdown: { realEstate: 0, stocks: 0, crypto: 0, cash: netAsset, loans },
  fx: { ...RATES },
  fxBase: { USD: 0, JPY: 0 },
  cost: { total: costTotal, stock: 0, crypto: 0, realEstate: 0 },
});

// fx·fxBase를 개별 지정하는 enriched 스냅샷 (환율 변동 케이스용)
const snapFx = (
  date: string,
  netAsset: number,
  costTotal: number,
  fx: { USD: number; JPY: number },
  fxBase: { USD: number; JPY: number },
): DailyAssetSnapshot => ({
  date,
  netAsset,
  financialAsset: netAsset,
  breakdown: { realEstate: 0, stocks: netAsset, crypto: 0, cash: 0, loans: 0 },
  fx: { ...fx },
  fxBase: { ...fxBase },
  cost: { total: costTotal, stock: costTotal, crypto: 0, realEstate: 0 },
});

// 자산군별 평가액·원가를 개별 지정하는 enriched 스냅샷 (시세·매수의 자산군 분해 검증용)
const snapClass = (
  date: string,
  breakdown: Partial<SnapshotBreakdown>,
  cost: Partial<SnapshotCost>,
): DailyAssetSnapshot => {
  const bd: SnapshotBreakdown = { realEstate: 0, stocks: 0, crypto: 0, cash: 0, loans: 0, ...breakdown };
  const c = { stock: 0, crypto: 0, realEstate: 0, ...cost };
  const netAsset = bd.realEstate + bd.stocks + bd.crypto + bd.cash - bd.loans;
  return {
    date, netAsset, financialAsset: bd.stocks + bd.crypto + bd.cash,
    breakdown: bd,
    fx: { ...RATES },
    fxBase: { USD: 0, JPY: 0 },
    cost: { total: cost.total ?? c.stock + c.crypto + c.realEstate + bd.cash, ...c },
  };
};

const usdStock = (o: Partial<Stock> = {}): Stock => ({
  id: "s1", category: "foreign", name: "Apple", ticker: "AAPL",
  quantity: 100, averagePrice: 10, currentPrice: 12, currency: "USD",
  purchaseDate: "2026-04-01", ...o,
});

const loan = (o: Partial<Loan> = {}): Loan => ({
  id: "l1", type: "credit", name: "신용대출", balance: 3_000_000, interestRate: 0, startDate: "2026-01-01", ...o,
});

const cashTx = (o: Partial<CashTransaction> = {}): CashTransaction => ({
  id: `ctx_${Math.random().toString(36).slice(2)}`,
  cashId: "c1", type: "deposit", amount: 1_000_000, currency: "KRW",
  date: "2026-05-10", reflected: true, createdAt: new Date().toISOString(), ...o,
});

const loanTx = (o: Partial<LoanTransaction> = {}): LoanTransaction => ({
  id: `ltx_${Math.random().toString(36).slice(2)}`,
  loanId: "l1", type: "repay", amount: 1_000_000,
  date: "2026-05-10", reflected: true, createdAt: new Date().toISOString(), ...o,
});

const trade = (o: Partial<Transaction> = {}): Transaction => ({
  id: `tx_${Math.random().toString(36).slice(2)}`,
  stockId: "s1", ticker: "005930", stockName: "삼성전자",
  type: "buy", quantity: 10, price: 70_000, currency: "KRW",
  date: "2026-05-10", reflected: true, createdAt: new Date().toISOString(), ...o,
});

const cryptoAsset = (o: Partial<Crypto> = {}): Crypto => ({
  id: "cr1", name: "비트코인", symbol: "BTC",
  quantity: 1, averagePrice: 100_000_000, currentPrice: 110_000_000,
  purchaseDate: "2026-04-01", ...o,
});

const cryptoTx = (o: Partial<CryptoTransaction> = {}): CryptoTransaction => ({
  id: `crtx_${Math.random().toString(36).slice(2)}`,
  cryptoId: "cr1", symbol: "BTC", name: "비트코인",
  type: "buy", quantity: 0.1, price: 110_000_000,
  date: "2026-05-10", reflected: true, createdAt: new Date().toISOString(), ...o,
});

// buildLiveAttributionCurr가 만드는 실시간 끝점과 동형 — computePeriodAttribution의 liveCurr 인자용.
// snapClass(저장 스냅샷)와 달리 _date/_display를 직접 갖춰야 AttributionPoint로 쓸 수 있다.
const liveCurr = (date: string, breakdown: Partial<SnapshotBreakdown>, cost: Partial<SnapshotCost>) => {
  const s = snapClass(date, breakdown, cost);
  return { ...s, _date: date, _display: date, _isLive: true as const };
};

// 표시되는 원인(top + rest + 잔여)의 합 — 뷰가 렌더하는 것과 동일 집합
const sumEffects = (a: NonNullable<ReturnType<typeof computeAttributionSince>>) =>
  a.priceEffect + a.fxEffect + a.savingEffect + a.buyEffect + a.sellEffect + a.incomeEffect + a.debtEffect;

// 뷰가 실제로 렌더하는 항목(getAttributionItems)의 합 — 자산군 분해 후에도 deltaNet과 맞아야 한다
const sumDisplayed = (a: NonNullable<ReturnType<typeof computeAttributionSince>>) =>
  getAttributionItems(a).reduce((s, i) => s + i.amount, 0);

const run = (data: AssetData, daily: DailyAssetSnapshot[], since: string) =>
  computeAttributionSince(daily, [], {}, since, data, RATES);

describe("asset-report 원인분해", () => {
  it("항등식: 모든 효과의 합 = deltaNet (정밀 경로)", () => {
    const data = emptyData();
    data.cashTransactions = [cashTx({ date: "2026-05-10", amount: 2_000_000 })];
    data.transactions = [trade({ date: "2026-05-10" })];
    const daily = [snap("2026-05-01", 100_000_000, 90_000_000), snap("2026-05-20", 105_000_000, 93_000_000)];
    const attr = run(data, daily, "2026-05-01");
    expect(attr).not.toBeNull();
    expect(sumEffects(attr!)).toBeCloseTo(attr!.deltaNet, 6);
  });

  it("미반영(과거 소급) 현금 기록 자체는 원인이 아니고, 실제 잔액 증가는 cash로 귀속되어 기록된 income과 구분된다", () => {
    const data = emptyData();
    data.cashTransactions = [cashTx({ date: "2026-05-10", amount: 3_000_000, reflected: false })];
    // 미반영 거래는 cost.total을 움직이지 않는다 → savingFull = 0. 잔액(breakdown.cash)만 +300만
    const daily = [snap("2026-05-01", 100_000_000, 90_000_000), snap("2026-05-20", 103_000_000, 90_000_000)];
    const attr = run(data, daily, "2026-05-01")!;
    expect(attr.incomeEffect).toBe(0); // 순자산을 움직이지 않은 기록은 집계하지 않는다
    expect(attr.savingEffect).toBe(0);
    // 기록 없이 실제로 변한 잔액은 income(=기록된 입출금)이 아니라 cash(=설명되지 않는 잔차)로 귀속된다
    const byKey = new Map(getOrderedCauses(attr).map((c) => [c.key, c.amount]));
    expect(byKey.get("cash")).toBeCloseTo(3_000_000, 6);
    expect(byKey.has("income")).toBe(false); // incomeEffect=0이라 pickTopCauses가 자동으로 걸러낸다
    expect(byKey.has("price:stock")).toBe(false);
    expect(sumDisplayed(attr)).toBeCloseTo(attr.deltaNet, 6);
  });

  it("반영 현금 입금은 saving이 아니라 income으로 귀속된다", () => {
    const data = emptyData();
    data.cashTransactions = [cashTx({ date: "2026-05-10", amount: 3_000_000, reflected: true })];
    // 반영 거래는 잔액=원가를 움직인다 → cost.total +300만
    const daily = [snap("2026-05-01", 100_000_000, 90_000_000), snap("2026-05-20", 103_000_000, 93_000_000)];
    const attr = run(data, daily, "2026-05-01")!;
    expect(attr.incomeEffect).toBe(3_000_000);
    expect(attr.savingEffect).toBe(0);
    expect(sumEffects(attr)).toBeCloseTo(attr.deltaNet, 6);
  });

  it("매수·매도가 buy/sell로 분리되고 합은 종전 saving과 같다", () => {
    const data = emptyData();
    data.transactions = [
      trade({ date: "2026-05-10", type: "buy", quantity: 10, price: 100_000 }),   // +100만
      trade({ date: "2026-05-12", type: "sell", quantity: 5, price: 100_000 }),   // −50만
    ];
    const daily = [snap("2026-05-01", 100_000_000, 90_000_000), snap("2026-05-20", 100_500_000, 90_500_000)];
    const attr = run(data, daily, "2026-05-01")!;
    expect(attr.buyEffect).toBe(1_000_000);
    expect(attr.sellEffect).toBe(-500_000);
    // buy + sell + saving = 종전 savingEffect(= Δcost.total − 반영 income = 50만)
    expect(attr.buyEffect + attr.sellEffect + attr.savingEffect).toBeCloseTo(500_000, 6);
    expect(sumEffects(attr)).toBeCloseTo(attr.deltaNet, 6);
  });

  it("체결 시 환율이 있으면 그 환율로 매수액을 환산한다", () => {
    const data = emptyData();
    data.transactions = [trade({ date: "2026-05-10", currency: "USD", quantity: 10, price: 100, exchangeRate: 1300 })];
    const daily = [snap("2026-05-01", 100_000_000, 90_000_000), snap("2026-05-20", 101_300_000, 91_300_000)];
    const attr = run(data, daily, "2026-05-01")!;
    expect(attr.buyEffect).toBe(1_300_000); // 현재 환율 1400이 아닌 체결 환율 1300
    expect(sumEffects(attr)).toBeCloseTo(attr.deltaNet, 6);
  });

  it("미반영 거래내역은 매수로 집계되지 않는다", () => {
    const data = emptyData();
    data.transactions = [trade({ date: "2026-05-10", reflected: false })];
    const daily = [snap("2026-05-01", 100_000_000, 90_000_000), snap("2026-05-20", 100_000_000, 90_000_000)];
    const attr = run(data, daily, "2026-05-01")!;
    expect(attr.buyEffect).toBe(0);
    expect(attr.sellEffect).toBe(0);
  });

  it("외화 원가 환율 재평가는 saving·price가 아니라 fx로만 귀속된다", () => {
    // 외화 주식만 보유, 매수 없음, 환율만 USD 1400→1500 상승 (주가 $12 불변)
    const data = emptyData();
    data.stocks = [usdStock()];
    const daily = [
      // 원가 100×$10, 평가 100×$12 — 환율만 반영
      snapFx("2026-05-01", 1_680_000, 1_400_000, { USD: 1400, JPY: 900 }, { USD: 1_680_000, JPY: 0 }),
      snapFx("2026-05-20", 1_800_000, 1_500_000, { USD: 1500, JPY: 900 }, { USD: 1_800_000, JPY: 0 }),
    ];
    const attr = run(data, daily, "2026-05-01")!;
    expect(attr.deltaNet).toBe(120_000);
    expect(attr.fxEffect).toBeCloseTo(120_000, 6); // 평가액 환차익 전액
    expect(attr.savingEffect).toBeCloseTo(0, 6);    // 원가 재평가가 저축으로 새지 않음
    expect(attr.priceEffect).toBeCloseTo(0, 6);     // 시세로도 새지 않음
    expect(sumEffects(attr)).toBeCloseTo(attr.deltaNet, 6);
  });

  it("환율+실제 시세가 함께 움직이면 fx·price로 정확히 갈린다", () => {
    // USD 1400→1500 상승 + 주가 $12→$13 상승
    const data = emptyData();
    data.stocks = [usdStock({ currentPrice: 13 })];
    const daily = [
      snapFx("2026-05-01", 1_680_000, 1_400_000, { USD: 1400, JPY: 900 }, { USD: 1_680_000, JPY: 0 }),
      // 평가 100×$13×1500 = 1,950,000, 원가 100×$10×1500 = 1,500,000
      snapFx("2026-05-20", 1_950_000, 1_500_000, { USD: 1500, JPY: 900 }, { USD: 1_950_000, JPY: 0 }),
    ];
    const attr = run(data, daily, "2026-05-01")!;
    expect(attr.deltaNet).toBe(270_000);
    expect(attr.fxEffect).toBeCloseTo(120_000, 6);  // 시작 노출×환율변동률
    expect(attr.savingEffect).toBeCloseTo(0, 6);     // 원가 재평가 누출 없음
    expect(attr.priceEffect).toBeCloseTo(150_000, 6); // 나머지 = 시세
    expect(sumEffects(attr)).toBeCloseTo(attr.deltaNet, 6);
  });

  it("토요일 실시간 끝점에서도 주식 시세가 그대로 노출된다(미국 금요일장 종가는 토요일 새벽 KST에 확정)", () => {
    // 2026-08-01은 토요일 — 국내·해외 증시는 닫혀 있지만 직전 미국장 종가가 새로 반영된 날이다.
    const data = emptyData();
    data.stocks = [usdStock({ currentPrice: 13 })];
    const prevSnap = snapFx("2026-07-31", 1_680_000, 1_400_000, { USD: 1400, JPY: 900 }, { USD: 1_680_000, JPY: 0 });
    const liveCurr = {
      date: "2026-08-01", netAsset: 1_950_000, financialAsset: 1_950_000,
      breakdown: { realEstate: 0, stocks: 1_950_000, crypto: 0, cash: 0, loans: 0 },
      fx: { USD: 1400, JPY: 900 }, fxBase: { USD: 1_950_000, JPY: 0 },
      cost: { total: 1_400_000, stock: 1_400_000, crypto: 0, realEstate: 0 },
      _date: "2026-08-01", _display: "2026-08-01", _isLive: true,
    };
    const attr = computeAttributionSince([prevSnap], [], {}, "2026-07-31", data, RATES, liveCurr as never)!;
    const keys = getOrderedCauses(attr).map((c) => c.key);
    expect(keys).toContain("price:stock");
    expect(sumDisplayed(attr)).toBeCloseTo(attr.deltaNet, 6);
  });

  it("실시간 끝점에서 주식·코인 시세가 각각 노출된다(휴장 여부로 억제하지 않는다)", () => {
    const data = emptyData();
    const prevSnap = snapClass("2026-07-31", { stocks: 10_000_000, crypto: 5_000_000 }, { stock: 8_000_000, crypto: 4_000_000 });
    const liveCurr = {
      ...snapClass("2026-08-01", { stocks: 10_300_000, crypto: 5_400_000 }, { stock: 8_000_000, crypto: 4_000_000 }),
      _date: "2026-08-01", _display: "2026-08-01", _isLive: true,
    };
    const attr = computeAttributionSince([prevSnap], [], {}, "2026-07-31", data, RATES, liveCurr as never)!;
    const keys = getOrderedCauses(attr).map((c) => c.key);
    expect(keys).toContain("price:stock");
    expect(keys).toContain("price:crypto");
    expect(sumDisplayed(attr)).toBeCloseTo(attr.deltaNet, 6);
  });

  it("어떤 원인도 '그 외' 범주로 뭉뚱그려지지 않는다 (외화 주식+외화 현금 동시 보유)", () => {
    // 환율효과의 주식/현금 안분 근사를 없앴으므로 설명 안 되는 잔차가 남지 않아야 한다.
    const data = emptyData();
    data.stocks = [usdStock()];                                   // 원가 100×$10, 평가 100×$12
    data.cash = [{ id: "c1", name: "달러예금", balance: 1000, currency: "USD", type: "savings" }];
    const daily = [
      // 주식 1,680,000 + 현금 1,400,000 = 3,080,000
      snapClass("2026-05-01", { stocks: 1_680_000, cash: 1_400_000 }, { stock: 1_400_000, total: 2_800_000 }),
      // 환율 1400→1500: 주식 1,800,000 + 현금 1,500,000 = 3,300,000
      { ...snapClass("2026-05-20", { stocks: 1_800_000, cash: 1_500_000 }, { stock: 1_500_000, total: 3_000_000 }),
        fx: { USD: 1500, JPY: 900 } },
    ];
    daily[0].fxBase = { USD: 3_080_000, JPY: 0 };
    daily[1].fxBase = { USD: 3_300_000, JPY: 0 };
    const attr = run(data, daily, "2026-05-01")!;
    const items = getAttributionItems(attr);
    expect(items.map((i) => i.label)).not.toContain("그 외");
    expect(attr.fxEffect).toBeCloseTo(220_000, 6);  // 3,080,000 × (1500/1400 − 1)
    expect(sumDisplayed(attr)).toBeCloseTo(attr.deltaNet, 6);
  });

  it("같은 날짜의 daily·monthly가 함께 있으면 daily를 시작점으로 고른다", () => {
    // monthly는 v2 필드가 없거나 갱신이 늦어 예측 모드로 떨어질 수 있고, 표기도 "7월"이 아니라 날짜가 맞다.
    const data = emptyData();
    const prevDaily = snapClass("2026-07-31", { stocks: 10_000_000 }, { stock: 8_000_000 });
    const currDaily = snapClass("2026-08-01", { stocks: 10_500_000 }, { stock: 8_000_000 });
    const legacyMonthly = { month: "2026-07", netAsset: 10_000_000, financialAsset: 10_000_000 };
    const attr = computeAttributionSince([prevDaily, currDaily], [legacyMonthly], {}, "2026-07-31", data, RATES)!;
    expect(attr.fromDate).toBe("2026-07-31"); // "2026-07"(월 표기)이 아니어야 한다
    expect(attr.estimated).toBe(false);       // 정밀 분해 경로 유지
    expect(getOrderedCauses(attr).map((c) => c.key)).toContain("price:stock");
  });

  it("monthly 스냅샷의 실제 캡처일(date)이 있으면 월말이 아니라 그 날짜를 fromDate로 써서 그 사이 반영 거래를 포함한다", () => {
    // 1개월/3개월처럼 daily 30일 롤링 창 밖에서 monthly가 prevOld로 쓰일 때, 종전에는 _date가
    // 무조건 그 달 말일로 강제돼 실제 캡처일(예: 5/10)과 말일(5/31) 사이의 거래(예: 5/20 출금)가
    // fromDate(5/31)보다 이르다는 이유로 범위 밖으로 밀려 사라졌다 — "1주엔 보이는데 1개월엔
    // 안 보인다"는 증상의 원인.
    const data = emptyData();
    data.cashTransactions = [cashTx({ date: "2026-05-20", amount: 1_000_000, type: "withdrawal", reflected: true })];
    const prevMonthly: MonthlyAssetSnapshot = {
      month: "2026-05",
      date: "2026-05-10", // 실제 마지막 접속일(월말 아님)
      netAsset: 30_000_000, financialAsset: 30_000_000,
      breakdown: { realEstate: 0, stocks: 0, crypto: 0, cash: 30_000_000, loans: 0 },
      fx: { ...RATES }, fxBase: { USD: 0, JPY: 0 },
      cost: { total: 30_000_000, stock: 0, crypto: 0, realEstate: 0 },
    };
    const curr = snapClass("2026-06-20", { cash: 29_500_000 }, {});
    const attr = computePeriodAttribution([curr], [prevMonthly], {}, "1m", data, RATES)!;
    const byKey = new Map(getOrderedCauses(attr).map((c) => [c.key, c.amount]));
    expect(byKey.get("income")).toBeCloseTo(-1_000_000, 6); // fromDate(5/10) 이후라 정상 포함
    expect(sumDisplayed(attr)).toBeCloseTo(attr.deltaNet, 6);
  });

  it("monthly 스냅샷에 date가 없으면(레거시) 월말로 폴백한다 — 회귀 방지", () => {
    const data = emptyData();
    data.cashTransactions = [cashTx({ date: "2026-05-20", amount: 1_000_000, type: "withdrawal", reflected: true })];
    const prevMonthly: MonthlyAssetSnapshot = {
      month: "2026-05", // date 필드 없음 → monthEnd("2026-05-31")로 폴백(기존 동작 유지)
      netAsset: 30_000_000, financialAsset: 30_000_000,
      breakdown: { realEstate: 0, stocks: 0, crypto: 0, cash: 30_000_000, loans: 0 },
      fx: { ...RATES }, fxBase: { USD: 0, JPY: 0 },
      cost: { total: 30_000_000, stock: 0, crypto: 0, realEstate: 0 },
    };
    const curr = snapClass("2026-06-20", { cash: 29_500_000 }, {});
    const attr = computePeriodAttribution([curr], [prevMonthly], {}, "1m", data, RATES)!;
    const byKey = new Map(getOrderedCauses(attr).map((c) => [c.key, c.amount]));
    expect(byKey.has("income")).toBe(false); // 5/20 거래가 fromDate(5/31)보다 일러 여전히 제외된다
    expect(sumDisplayed(attr)).toBeCloseTo(attr.deltaNet, 6);
  });

  it("시세가 자산군별로 분해된다 (주식·코인·부동산)", () => {
    const data = emptyData();
    const cost = { stock: 8_000_000, crypto: 4_000_000, realEstate: 90_000_000 };
    const daily = [
      snapClass("2026-05-01", { stocks: 10_000_000, crypto: 5_000_000, realEstate: 100_000_000 }, cost),
      snapClass("2026-05-20", { stocks: 11_000_000, crypto: 6_000_000, realEstate: 103_000_000 }, cost),
    ];
    const attr = run(data, daily, "2026-05-01")!;
    const byKey = new Map(getOrderedCauses(attr).map((c) => [c.key, c.amount]));
    expect(byKey.get("price:stock")).toBeCloseTo(1_000_000, 6);
    expect(byKey.get("price:crypto")).toBeCloseTo(1_000_000, 6);
    expect(byKey.get("price:realEstate")).toBeCloseTo(3_000_000, 6);
    // 자산군별 시세의 합 = 종전 priceEffect 총액(잔차 총액 불변)
    expect(1_000_000 + 1_000_000 + 3_000_000).toBeCloseTo(attr.priceEffect, 6);
    expect(sumDisplayed(attr)).toBeCloseTo(attr.deltaNet, 6);
  });

  it("코인·부동산 신규 투입이 '매수'로 자산군별 분리된다", () => {
    const data = emptyData();
    const daily = [
      snapClass("2026-05-01", { cash: 10_000_000 }, { total: 10_000_000 }),
      snapClass("2026-05-20", { cash: 10_000_000, crypto: 3_000_000, realEstate: 50_000_000 },
        { total: 63_000_000, crypto: 3_000_000, realEstate: 50_000_000 }),
    ];
    const attr = run(data, daily, "2026-05-01")!;
    const byKey = new Map(getOrderedCauses(attr).map((c) => [c.key, c.amount]));
    expect(byKey.get("buy:crypto")).toBeCloseTo(3_000_000, 6);
    expect(byKey.get("buy:realEstate")).toBeCloseTo(50_000_000, 6);
    expect(sumDisplayed(attr)).toBeCloseTo(attr.deltaNet, 6);
  });

  it("거래내역 없는 주식 원가 증가(직접 수정·스크린샷 등록)는 주식 매수에 합산된다", () => {
    const data = emptyData();
    data.transactions = [trade({ date: "2026-05-10", type: "buy", quantity: 10, price: 100_000 })]; // +100만
    const daily = [
      snapClass("2026-05-01", { stocks: 10_000_000 }, { stock: 8_000_000 }),
      // 원가 +300만 중 거래내역으로 설명되는 건 100만 → 나머지 200만은 직접 수정분
      snapClass("2026-05-20", { stocks: 13_000_000 }, { stock: 11_000_000 }),
    ];
    const attr = run(data, daily, "2026-05-01")!;
    const byKey = new Map(getOrderedCauses(attr).map((c) => [c.key, c.amount]));
    expect(byKey.get("buy:stock")).toBeCloseTo(3_000_000, 6);
    expect(byKey.has("sell:stock")).toBe(false); // 방향별로 합산돼 같은 라벨이 두 줄로 갈라지지 않는다
    expect(sumDisplayed(attr)).toBeCloseTo(attr.deltaNet, 6);
  });

  it("거래내역 없는 코인 원가 증가(직접 수정)는 코인 매수에 합산된다(S-4.25)", () => {
    const data = emptyData();
    data.cryptoTransactions = [cryptoTx({ date: "2026-05-10", type: "buy", quantity: 0.01, price: 100_000_000 })]; // +100만
    const daily = [
      snapClass("2026-05-01", { crypto: 10_000_000 }, { crypto: 8_000_000 }),
      // 원가 +300만 중 거래내역으로 설명되는 건 100만 → 나머지 200만은 직접 수정분
      snapClass("2026-05-20", { crypto: 13_000_000 }, { crypto: 11_000_000 }),
    ];
    const attr = run(data, daily, "2026-05-01")!;
    const byKey = new Map(getOrderedCauses(attr).map((c) => [c.key, c.amount]));
    expect(byKey.get("buy:crypto")).toBeCloseTo(3_000_000, 6);
    expect(byKey.has("sell:crypto")).toBe(false); // 방향별로 합산돼 같은 라벨이 두 줄로 갈라지지 않는다
    expect(sumDisplayed(attr)).toBeCloseTo(attr.deltaNet, 6);
  });

  it("예측 경로: 코인의 기간 내 반영 매수도 buy:crypto로 잡히고 이중계산되지 않는다(S-4.25)", () => {
    // 원매수일이 기간 이전(purchaseDate 불변)인 코인에 기간 내 반영 매수 — estimatePeriodInflows가
    // tradedCryptoIds로 건너뛰지 않으면 inflows.crypto(추정)와 reflectedCryptoFlow(실측)가 이중 계산된다.
    const data = emptyData();
    data.crypto = [cryptoAsset({ id: "cr1", quantity: 1, averagePrice: 100_000_000, purchaseDate: "2026-04-01" })];
    data.cryptoTransactions = [cryptoTx({ cryptoId: "cr1", date: "2026-05-10", type: "buy", quantity: 0.05, price: 100_000_000 })]; // +500만
    const legacy = { date: "2026-05-01", netAsset: 100_000_000, financialAsset: 100_000_000 } as DailyAssetSnapshot;
    const daily = [legacy, snap("2026-05-20", 105_000_000, 90_000_000)];
    const attr = run(data, daily, "2026-05-01")!;
    expect(attr.estimated).toBe(true);
    const byKey = new Map(getOrderedCauses(attr).map((c) => [c.key, c.amount]));
    expect(byKey.get("buy:crypto")).toBeCloseTo(5_000_000, 6); // 이중계산이면 1000만
    expect(sumDisplayed(attr)).toBeCloseTo(attr.deltaNet, 6);
  });

  it("환율 동결 시 암호화폐 소폭 상승은 시세로 귀속된다(주말 케이스)", () => {
    // 외화·환율 변동 없음, 순자산만 소폭 상승(crypto 24h) → 전액 price
    const data = emptyData();
    const daily = [snap("2026-05-01", 100_000_000, 90_000_000), snap("2026-05-20", 100_005_000, 90_000_000)];
    const attr = run(data, daily, "2026-05-01")!;
    expect(attr.deltaNet).toBe(5_000);
    expect(attr.savingEffect).toBe(0);
    expect(attr.priceEffect).toBe(5_000);
    expect(attr.fxEffect).toBe(0);
    expect(sumEffects(attr)).toBeCloseTo(attr.deltaNet, 6);
  });

  it("예측 경로: 기존 보유 종목의 기간 내 추가 매수도 buy로 잡힌다", () => {
    // 원매수일이 기간 이전(purchaseDate 불변)인 종목에 기간 내 반영 매수 → 종전엔 saving에서 누락돼 시세로 흡수됐다
    const data = emptyData();
    data.stocks = [usdStock({ id: "s1", currency: "KRW", averagePrice: 70_000, quantity: 100, purchaseDate: "2026-04-01" })];
    data.transactions = [trade({ stockId: "s1", date: "2026-05-10", type: "buy", quantity: 5, price: 100_000 })]; // +50만
    const legacy = { date: "2026-05-01", netAsset: 100_000_000, financialAsset: 100_000_000 } as DailyAssetSnapshot;
    const daily = [legacy, snap("2026-05-20", 100_300_000, 90_000_000)];
    const attr = run(data, daily, "2026-05-01")!;
    expect(attr.estimated).toBe(true);
    expect(attr.buyEffect).toBe(500_000);   // 추가 매수가 노출됨
    expect(attr.savingEffect).toBe(0);       // 거래 있는 종목은 매수일 추정에서 제외(이중계산 없음)
    expect(attr.priceEffect).toBe(-200_000); // 나머지 잔차 = deltaNet(30만) − buy(50만)
    expect(sumEffects(attr)).toBeCloseTo(attr.deltaNet, 6);
  });

  it("getOrderedCauses: 연관 원인(주식 매수·매도)이 카테고리 순서로 나란히 정렬된다", () => {
    const data = emptyData();
    data.transactions = [
      trade({ date: "2026-05-10", type: "buy", quantity: 50, price: 100_000 }),   // +500만
      trade({ date: "2026-05-12", type: "sell", quantity: 20, price: 100_000 }),  // −200만
    ];
    data.loans = [loan({ balance: 3_000_000 })];
    const daily = [
      snap("2026-05-01", 100_000_000, 90_000_000, 0),
      snap("2026-05-20", 107_000_000, 96_000_000, 3_000_000),
    ];
    const attr = run(data, daily, "2026-05-01")!;
    const ordered = getOrderedCauses(attr).map((c) => c.key);
    // CAUSE_ORDER: buy:stock(5) < sell:stock(6) < cash(12) < debt(13) — 절대값 크기와 무관하게 이 순서.
    // cashTransactions 기록이 없어 incomeEffect=0이므로 잔차는 income이 아니라 cash로 잡힌다
    // (이 테스트의 snap() 헬퍼는 cost.stock을 항상 0으로 둬 실제 매매와 어긋나는 합성 잔차를 만든다).
    expect(ordered).toEqual(["buy:stock", "sell:stock", "cash", "debt"]);
    expect(sumEffects(attr)).toBeCloseTo(attr.deltaNet, 6);
    expect(sumDisplayed(attr)).toBeCloseTo(attr.deltaNet, 6);
  });

  it("항등식: 예측 경로(레거시 스냅샷)에서도 합 = deltaNet", () => {
    const data = emptyData();
    data.cashTransactions = [
      cashTx({ date: "2026-05-10", amount: 1_000_000, reflected: true }),
      cashTx({ date: "2026-05-11", amount: 500_000, reflected: false }),
    ];
    // 시작 스냅샷이 netAsset만 있는 레거시 → estimated 경로
    const legacy = { date: "2026-05-01", netAsset: 100_000_000, financialAsset: 100_000_000 } as DailyAssetSnapshot;
    const daily = [legacy, snap("2026-05-20", 104_000_000, 93_000_000)];
    const attr = run(data, daily, "2026-05-01")!;
    expect(attr.estimated).toBe(true);
    expect(attr.incomeEffect).toBe(1_000_000); // 미반영 50만은 순자산을 움직이지 않아 집계 제외
    expect(sumEffects(attr)).toBeCloseTo(attr.deltaNet, 6);
  });

  it("예측 경로: 기간 내 기존 대출의 반영된 상환이 debt effect에 포착된다(S-4.24)", () => {
    // 대출은 startDate가 기간 밖(신규 대출 아님)이라 estimatePeriodInflows의 매수일 기반 추정은
    // 이 상환을 전혀 못 잡는다 — reflectedLoanFlow가 없으면 debtEffect=0으로 과소평가됐다.
    const data = emptyData();
    data.loans = [loan({ id: "l1", balance: 2_000_000, startDate: "2026-01-01" })];
    data.loanTransactions = [loanTx({ loanId: "l1", type: "repay", amount: 1_000_000, date: "2026-05-10", reflected: true })];
    const legacy = { date: "2026-05-01", netAsset: 100_000_000, financialAsset: 100_000_000 } as DailyAssetSnapshot;
    const daily = [legacy, snap("2026-05-20", 104_000_000, 93_000_000)];
    const attr = run(data, daily, "2026-05-01")!;
    expect(attr.estimated).toBe(true);
    expect(attr.debtEffect).toBe(1_000_000); // 상환 = +(순자산 증가 방향)
    expect(sumEffects(attr)).toBeCloseTo(attr.deltaNet, 6);
  });

  it("예측 경로: 기간 내 신규 대출 + 그 대출의 반영 거래가 동시에 있어도 이중계산되지 않는다(S-4.24)", () => {
    // 신규 대출(startDate 기간 내)이면서 동시에 반영된 borrow 거래도 있는 경우 —
    // estimatePeriodInflows가 loanTxLoanIds로 스킵하지 않으면 -balance(추정) + -amount(reflectedLoanFlow)가
    // 이중으로 잡혀 debtEffect가 실제 대출액의 2배로 과대평가된다.
    const data = emptyData();
    data.loans = [loan({ id: "l1", balance: 5_000_000, startDate: "2026-05-05" })];
    data.loanTransactions = [loanTx({ loanId: "l1", type: "borrow", amount: 5_000_000, date: "2026-05-05", reflected: true })];
    const legacy = { date: "2026-05-01", netAsset: 100_000_000, financialAsset: 100_000_000 } as DailyAssetSnapshot;
    const daily = [legacy, snap("2026-05-20", 104_000_000, 93_000_000)];
    const attr = run(data, daily, "2026-05-01")!;
    expect(attr.estimated).toBe(true);
    expect(attr.debtEffect).toBe(-5_000_000); // 단일 계산(신규 대출로 순자산 감소 방향), 이중계산이면 -10,000,000
    expect(sumEffects(attr)).toBeCloseTo(attr.deltaNet, 6);
  });

  it("예측 경로: breakdown만 있고 fx·cost가 없어도 대출 잔액 직접 수정(상환 기록 없음)을 debtEffect로 정확히 잡는다", () => {
    // 백업 복원 등으로 대출 잔액만 바뀌고 loanTransactions에 상환 기록이 안 남는 경우 —
    // fx·cost가 없어 bothEnriched는 아니지만 breakdown(loans 포함)은 있는 흔한 부분 인리치드 상태.
    // 기존에는 inflows.debt(신규 대출만 감지)+reflectedLoanFlow(기록된 거래만 집계) 둘 다 이걸 놓쳐
    // debtEffect≈0이 되고 실제 변화가 시세("price")로 잘못 흡수됐다.
    const data = emptyData(); // loans·loanTransactions 모두 비어있음(기록 없음)
    const prev = {
      date: "2026-06-01", netAsset: 30_000_000, financialAsset: 30_000_000,
      breakdown: { realEstate: 0, stocks: 0, crypto: 0, cash: 50_000_000, loans: 20_000_000 },
    } as DailyAssetSnapshot;
    const curr = snapClass("2026-06-20", { cash: 33_000_000, loans: 15_000_000 }, {});
    const attr = run(data, [prev, curr], "2026-06-01")!;
    expect(attr.estimated).toBe(true); // prev가 fx·cost 없어 전체 분해는 여전히 예측
    expect(attr.debtEffect).toBeCloseTo(5_000_000, 6); // -(15,000,000-20,000,000)
    const causes = getOrderedCauses(attr);
    const debtCause = causes.find((c) => c.key === "debt")!;
    expect(debtCause.estimated).toBeFalsy(); // breakdown 델타 기반이라 이 항목만은 실측
    expect(sumEffects(attr)).toBeCloseTo(attr.deltaNet, 6);
  });

  it("임계값 미만 잔차가 버려지지 않고 절대값 최대 원인에 흡수된다", () => {
    // "그 외" 범주를 폐지한 뒤 잔차를 흡수하는 분기(getAttributionItems)를 직접 태우는 케이스.
    // 코인·부동산이 각각 9천원만 올라 개별로는 표시 임계값(1만원) 미만 → restCauses에서 탈락하지만
    // 합(1.8만원)은 임계값 이상이라 버리면 표시 합계가 deltaNet과 어긋난다.
    const data = emptyData();
    const cost = { stock: 90_000_000, crypto: 9_000_000, realEstate: 45_000_000 };
    const daily = [
      snapClass("2026-05-01", { stocks: 100_000_000, crypto: 10_000_000, realEstate: 50_000_000 }, cost),
      snapClass("2026-05-20", { stocks: 105_000_000, crypto: 10_009_000, realEstate: 50_009_000 }, cost),
    ];
    const attr = run(data, daily, "2026-05-01")!;
    expect(attr.restCauses).toHaveLength(0);       // 개별 9천원은 표시 대상 아님
    expect(attr.restEffect).toBeCloseTo(18_000, 6);
    const items = getAttributionItems(attr);
    expect(items).toHaveLength(1);
    expect(items[0].key).toBe("price:stock");
    expect(items[0].amount).toBeCloseTo(5_018_000, 6); // 500만 + 흡수된 잔차 1.8만
    expect(sumDisplayed(attr)).toBeCloseTo(attr.deltaNet, 6);
  });

  it("예측 경로에서도 표시 항목 합계 = deltaNet", () => {
    // 기존 예측 테스트는 집계 필드(sumEffects)만 봐서 자산군 분해·잔차 흡수를 우회했다.
    const data = emptyData();
    data.cashTransactions = [cashTx({ date: "2026-05-10", amount: 1_000_000, reflected: true })];
    data.transactions = [trade({ date: "2026-05-10", type: "buy", quantity: 10, price: 100_000 })];
    data.crypto = [{ id: "c1", name: "비트코인", symbol: "BTC", quantity: 1, averagePrice: 500_000, currentPrice: 600_000, purchaseDate: "2026-05-12" }];
    data.loans = [loan({ balance: 2_000_000, startDate: "2026-05-05" })];
    const legacy = { date: "2026-05-01", netAsset: 100_000_000, financialAsset: 100_000_000 } as DailyAssetSnapshot;
    const daily = [legacy, snap("2026-05-20", 104_000_000, 93_000_000)];
    const attr = run(data, daily, "2026-05-01")!;
    expect(attr.estimated).toBe(true);
    expect(sumDisplayed(attr)).toBeCloseTo(attr.deltaNet, 6);
  });

  it("cashTransactions 기록 여부에 따라 income⇄cash 사이에서 표시가 실제로 이동한다(B-1 회귀 수정 검증)", () => {
    // 종전엔 income = incomeEffect + dCostCash로 합쳐 방출해 incomeEffect가 대수적으로 소거됐다
    // (기록을 넣든 안 넣든 표시 금액이 같았다). 이제는 두 키로 나눠 방출해 기록 여부가 실제로 반영된다.
    const daily = [snap("2026-05-01", 100_000_000, 90_000_000), snap("2026-05-20", 103_000_000, 93_000_000)];

    const noTx = emptyData();
    const attrNoTx = run(noTx, daily, "2026-05-01")!;
    const byKeyNoTx = new Map(getOrderedCauses(attrNoTx).map((c) => [c.key, c.amount]));
    expect(attrNoTx.incomeEffect).toBe(0);
    expect(byKeyNoTx.has("income")).toBe(false); // 기록이 없으므로 income 항목 자체가 없음
    expect(byKeyNoTx.get("cash")).toBeCloseTo(3_000_000, 6); // 기록 없이 변한 잔액은 cash로

    const withTx = emptyData();
    withTx.cashTransactions = [cashTx({ date: "2026-05-10", amount: 3_000_000, reflected: true })];
    const attrWithTx = run(withTx, daily, "2026-05-01")!;
    expect(attrWithTx.incomeEffect).toBe(3_000_000);
    const byKeyWithTx = new Map(getOrderedCauses(attrWithTx).map((c) => [c.key, c.amount]));
    expect(byKeyWithTx.get("income")).toBeCloseTo(3_000_000, 6); // 같은 금액이 이제 income으로
    expect(byKeyWithTx.has("cash")).toBe(false); // 전부 설명됐으므로 cash는 남지 않음

    expect(sumDisplayed(attrNoTx)).toBeCloseTo(attrNoTx.deltaNet, 6);
    expect(sumDisplayed(attrWithTx)).toBeCloseTo(attrWithTx.deltaNet, 6);
  });

  it("경계일(fromDate)에 남긴 반영 거래도 income/debt로 정상 집계된다 — 통째로 누락돼 cash로 새던 버그 수정(2026-08 P1)", () => {
    // 실사용 재현: 대출 상환 기록 + 대응하는 현금 출금 기록을 둘 다 남겼는데도 홈에는 "대출 상환"·
    // "현금 출금"이 안 뜨고 "현금 잔액 증가(추정)"만 표시됐다. 원인은 reflectedCashInflow의
    // 경계 조건이 "(from,to]"(시작일 당일 거래 제외)라, 거래 날짜가 시작 스냅샷 날짜(fromDate)와
    // 정확히 같으면(소급 기록·마지막 방문일과 같은 날짜) 통째로 걸러져 income이 0이 되고, 원래
    // 상쇄됐어야 할 현금 감소분이 그대로 dCostCash(→cash 잔차)로 새어나갔다.
    const data = emptyData();
    data.loanTransactions = [loanTx({ loanId: "l1", type: "repay", amount: 1_000_000, date: "2026-05-01", reflected: true })];
    data.cashTransactions = [cashTx({ date: "2026-05-01", amount: 1_000_000, type: "withdrawal", reflected: true })];
    const prev = snapClass("2026-05-01", { cash: 10_000_000, loans: 3_000_000 }, {});
    const curr = snapClass("2026-05-20", { cash: 9_000_000, loans: 2_000_000 }, {});
    const attr = run(data, [prev, curr], "2026-05-01")!;
    const byKey = new Map(getOrderedCauses(attr).map((c) => [c.key, c.amount]));
    expect(byKey.get("income")).toBeCloseTo(-1_000_000, 6); // 출금 기록이 사라지지 않고 정상 표시
    expect(byKey.get("debt")).toBeCloseTo(1_000_000, 6);    // 정밀 경로는 breakdown 델타라 원래도 정상
    expect(byKey.has("cash")).toBe(false); // 둘 다 설명됐으니 무관한 cash 잔차가 남으면 안 된다
    expect(sumDisplayed(attr)).toBeCloseTo(attr.deltaNet, 6);
  });

  it("예측 경로: 경계일(fromDate)에 남긴 대출 상환 기록도 debt로 정상 집계된다(2026-08 P1)", () => {
    const data = emptyData();
    data.loans = [loan({ id: "l1", balance: 2_000_000, startDate: "2026-01-01" })];
    data.loanTransactions = [loanTx({ loanId: "l1", type: "repay", amount: 1_000_000, date: "2026-05-01", reflected: true })];
    const legacy = { date: "2026-05-01", netAsset: 100_000_000, financialAsset: 100_000_000 } as DailyAssetSnapshot;
    const daily = [legacy, snap("2026-05-20", 101_000_000, 90_000_000)];
    const attr = run(data, daily, "2026-05-01")!;
    expect(attr.estimated).toBe(true);
    expect(attr.debtEffect).toBe(1_000_000); // 경계일 거래라도 debt에서 누락되면 안 된다
    expect(sumEffects(attr)).toBeCloseTo(attr.deltaNet, 6);
  });

  it("경계일(fromDate)에 이미 반영된 주식 매수는 이중계상되지 않는다 — 입력한 적 없는 '주식 매도'가 매수와 쌍으로 뜨던 버그(2026-08-06)", () => {
    // 실사용 재현: 08-05에 매수 2건만 입력했는데 홈 "전일 대비"에 주식 매수 11.8만·주식 매도 11.8만이
    // 동시에 표시됐다. 08-05 스냅샷은 반영 **이후**에 저장돼 cost.stock에 117,515원이 이미 들어 있어
    // dCostStock=0인데, reflectedTradeFlow가 시작일 당일 거래를 다시 세어 buyEffect=+117,515가 되고
    // 균형을 맞추는 stockManual=−117,515가 "주식 매도"로 둔갑했다.
    const data = emptyData();
    data.transactions = [
      trade({ stockId: "s1", ticker: "314250", stockName: "KODEX 미국빅테크10(H)", quantity: 1, price: 62_235, date: "2026-08-05" }),
      trade({ stockId: "s2", ticker: "360200", stockName: "ACE 미국S&P500", quantity: 2, price: 27_640, date: "2026-08-05" }),
    ];
    const prev = snapClass("2026-08-05", { stocks: 10_000_000 }, { stock: 8_117_515 });
    const curr = snapClass("2026-08-06", { stocks: 10_200_000 }, { stock: 8_117_515 });
    const attr = run(data, [prev, curr], "2026-08-05")!;
    const byKey = new Map(getOrderedCauses(attr).map((c) => [c.key, c.amount]));
    expect(byKey.has("sell:stock")).toBe(false); // 유령 매도가 뜨면 안 된다
    expect(byKey.has("buy:stock")).toBe(false);  // 이미 스냅샷에 반영된 매수도 다시 뜨면 안 된다
    expect(byKey.get("price:stock")).toBeCloseTo(200_000, 6);
    expect(sumDisplayed(attr)).toBeCloseTo(attr.deltaNet, 6);
  });

  it("시작 스냅샷 저장 후 시작일자로 소급 반영한 주식 매수는 매수로 한 번만 잡힌다(부호 뒤집힘 없음)", () => {
    // 당일 거래를 제외해도 누락되지 않음을 고정 — 스냅샷에 없던 매수는 원가가 올라가므로
    // stockManual이 **같은 부호로** 잡아 "주식 매수"로 표시된다.
    const data = emptyData();
    data.transactions = [trade({ quantity: 1, price: 117_515, date: "2026-08-05" })];
    const prev = snapClass("2026-08-05", { stocks: 10_000_000 }, { stock: 8_000_000 });
    const curr = snapClass("2026-08-06", { stocks: 10_317_515 }, { stock: 8_117_515 });
    const attr = run(data, [prev, curr], "2026-08-05")!;
    const byKey = new Map(getOrderedCauses(attr).map((c) => [c.key, c.amount]));
    expect(byKey.get("buy:stock")).toBeCloseTo(117_515, 6); // 두 배가 되면 이중계상
    expect(byKey.has("sell:stock")).toBe(false);
    expect(byKey.get("price:stock")).toBeCloseTo(200_000, 6);
    expect(sumDisplayed(attr)).toBeCloseTo(attr.deltaNet, 6);
  });

  it("코인도 경계일(fromDate)에 이미 반영된 매수를 이중계상하지 않는다", () => {
    const data = emptyData();
    data.cryptoTransactions = [cryptoTx({ quantity: 0.1, price: 1_000_000, date: "2026-08-05" })];
    const prev = snapClass("2026-08-05", { crypto: 10_000_000 }, { crypto: 9_000_000 });
    const curr = snapClass("2026-08-06", { crypto: 10_100_000 }, { crypto: 9_000_000 });
    const attr = run(data, [prev, curr], "2026-08-05")!;
    const byKey = new Map(getOrderedCauses(attr).map((c) => [c.key, c.amount]));
    expect(byKey.has("sell:crypto")).toBe(false);
    expect(byKey.has("buy:crypto")).toBe(false);
    expect(byKey.get("price:crypto")).toBeCloseTo(100_000, 6);
    expect(sumDisplayed(attr)).toBeCloseTo(attr.deltaNet, 6);
  });

  it("임차보증금 증감은 독립된 deposit 원인으로 분리되고 income·cash를 오염시키지 않는다(B-2)", () => {
    const data = emptyData();
    const prev = snapClass("2026-05-01", { cash: 100_000_000 }, {});
    const curr = snapClass("2026-05-20", { cash: 100_000_000 }, {});
    prev.breakdown!.tenantDeposit = 20_000_000;
    curr.breakdown!.tenantDeposit = 25_000_000; // 보증금 500만 증가(부채성 증가) → netAsset 감소 요인
    prev.netAsset = 100_000_000 - 20_000_000;
    curr.netAsset = 100_000_000 - 25_000_000;
    const attr = run(data, [prev, curr], "2026-05-01")!;
    const byKey = new Map(getOrderedCauses(attr).map((c) => [c.key, c.amount]));
    expect(byKey.get("deposit")).toBeCloseTo(-5_000_000, 6); // 증가는 음수(대출 증가와 동일 부호 규약)
    expect(byKey.has("income")).toBe(false);
    expect(byKey.has("cash")).toBe(false);
    expect(sumDisplayed(attr)).toBeCloseTo(attr.deltaNet, 6);
  });

  it("잔차 흡수는 부호가 같은 원인에만 붙는다 — 반대 부호 잔차는 방향 고정 라벨을 오염시키지 않고 cash로 간다(B-3)", () => {
    const data = emptyData();
    const cost = { stock: 8_000_000, crypto: 900_000, realEstate: 1_900_000 };
    const prev = snapClass("2026-05-01", { stocks: 10_000_000, crypto: 1_000_000, realEstate: 2_000_000 }, cost);
    // 주식은 +500만(큰 양수), 코인·부동산은 각각 −6천·−7천(개별로는 임계값 1만원 미만이라 안 보이지만
    // 합은 −1.3만원이라 잔차 흡수 대상). 원가는 불변이라 셋 다 시세만 순수 반영.
    const curr = snapClass("2026-05-20", { stocks: 15_000_000, crypto: 994_000, realEstate: 1_993_000 }, cost);
    const attr = run(data, [prev, curr], "2026-05-01")!;
    const items = getAttributionItems(attr);
    const byKey = new Map(items.map((c) => [c.key, c.amount]));
    // price:stock은 잔차에 오염되지 않고 순수 500만원 그대로여야 한다("주식 매수로 −1만원 늘었어요" 같은
    // 모순 문장 방지). 반대 부호 잔차(−1.3만원)는 별도 cash 항목으로 정직하게 분리된다.
    expect(byKey.get("price:stock")).toBeCloseTo(5_000_000, 6);
    expect(byKey.get("cash")).toBeCloseTo(-13_000, 6);
    expect(sumDisplayed(attr)).toBeCloseTo(attr.deltaNet, 6);
  });
});

describe("asset-report 원인분해 — computePeriodAttribution 하이브리드(1주·1개월·3개월·올해 공통)", () => {
  it("mid가 있으면 (prevOld,mid]은 예측 + (mid,curr]은 실측으로 합성되고 표시 합계 = 전체 deltaNet", () => {
    const data = emptyData();
    const prevOld = { date: "2026-06-01", netAsset: 100_000_000, financialAsset: 100_000_000 } as DailyAssetSnapshot;
    const mid = snap("2026-06-15", 105_000_000, 95_000_000);
    const curr = snap("2026-07-01", 108_000_000, 95_000_000);
    const attr = computePeriodAttribution([prevOld, mid, curr], [], {}, "1m", data, RATES)!;
    expect(attr).not.toBeNull();
    expect(attr.fromDate).toBe("2026-06-01");
    expect(attr.toDate).toBe("2026-07-01");
    expect(attr.deltaNet).toBe(8_000_000);
    expect(attr.estimated).toBe(false); // 실측이 섞였으므로 "전체 예측"은 아님
    expect(attr.estimatedUntil).toBe("2026-06-15"); // mid 이전만 예측
    expect(sumDisplayed(attr)).toBeCloseTo(attr.deltaNet, 6);
  });

  it("mid 날짜에 남긴 현금 입금이 두 구간에 중복 계상되지 않는다 — income 2배 + 유령 '현금 잔액 감소' 회귀(2026-08-06 QA)", () => {
    // 하이브리드는 [prevOld,mid] + (mid,curr]로 쪼개는데, 양쪽 다 시작일 당일을 포함하면
    // mid 당일 거래가 두 구간에 모두 잡힌다. 합계 = deltaNet 항등식은 유지되므로(income +2배,
    // cash −1배로 상쇄) 기존 항등식 테스트로는 잡히지 않아 key별 금액을 직접 단정한다.
    const data = emptyData();
    data.cashTransactions = [cashTx({ date: "2026-06-15", amount: 10_000_000, type: "deposit", reflected: true })];
    const prevOld = { date: "2026-06-01", netAsset: 100_000_000, financialAsset: 100_000_000 } as DailyAssetSnapshot;
    const mid = snapClass("2026-06-15", { cash: 110_000_000 }, {});
    const curr = snapClass("2026-07-01", { cash: 110_000_000 }, {});
    const attr = computePeriodAttribution([prevOld, mid, curr], [], {}, "1m", data, RATES)!;
    const byKey = new Map(getOrderedCauses(attr).map((c) => [c.key, c.amount]));
    expect(byKey.get("income")).toBe(10_000_000); // 20,000,000이면 중복 계상
    expect(byKey.has("cash")).toBe(false);        // 반대급부로 뜨던 유령 "현금 잔액 감소"
    expect(sumDisplayed(attr)).toBeCloseTo(attr.deltaNet, 6);
  });

  it("전체 기간 시작일(prevOld) 당일에 남긴 현금 입금은 하이브리드에서도 여전히 income으로 잡힌다(2026-08 P1 보존)", () => {
    // 중복 제거를 위해 경계를 통일해버리면 이 케이스가 통째로 걸러져 무관한 cash 잔차로 샌다.
    const data = emptyData();
    data.cashTransactions = [cashTx({ date: "2026-06-01", amount: 10_000_000, type: "deposit", reflected: true })];
    const prevOld = { date: "2026-06-01", netAsset: 100_000_000, financialAsset: 100_000_000 } as DailyAssetSnapshot;
    const mid = snapClass("2026-06-15", { cash: 110_000_000 }, {});
    const curr = snapClass("2026-07-01", { cash: 110_000_000 }, {});
    const attr = computePeriodAttribution([prevOld, mid, curr], [], {}, "1m", data, RATES)!;
    const byKey = new Map(getOrderedCauses(attr).map((c) => [c.key, c.amount]));
    expect(byKey.get("income")).toBe(10_000_000);
    expect(sumDisplayed(attr)).toBeCloseTo(attr.deltaNet, 6);
  });

  it("mid 날짜의 반영 주식 매수도 두 구간에 중복 계상되지 않는다", () => {
    const data = emptyData();
    data.transactions = [trade({ quantity: 1, price: 5_000_000, date: "2026-06-15" })];
    const prevOld = { date: "2026-06-01", netAsset: 100_000_000, financialAsset: 100_000_000 } as DailyAssetSnapshot;
    const mid = snapClass("2026-06-15", { stocks: 105_000_000 }, { stock: 100_000_000 });
    const curr = snapClass("2026-07-01", { stocks: 105_000_000 }, { stock: 100_000_000 });
    const attr = computePeriodAttribution([prevOld, mid, curr], [], {}, "1m", data, RATES)!;
    const byKey = new Map(getOrderedCauses(attr).map((c) => [c.key, c.amount]));
    expect(byKey.get("buy:stock") ?? 0).toBeLessThanOrEqual(5_000_000); // 1,000만원이면 중복
    expect(byKey.has("sell:stock")).toBe(false);                        // 유령 매도
    expect(sumDisplayed(attr)).toBeCloseTo(attr.deltaNet, 6);
  });

  it("mid가 없으면(사이에 enriched daily가 없음) 단일 구간과 완전히 동일한 결과(회귀 방지)", () => {
    const data = emptyData();
    const prevOld = snap("2026-06-01", 100_000_000, 90_000_000);
    const curr = snap("2026-06-20", 103_000_000, 91_000_000);
    const attr = computePeriodAttribution([prevOld, curr], [], {}, "1m", data, RATES)!;
    expect(attr.estimatedUntil).toBeUndefined();
    expect(attr.estimated).toBe(false);
    expect(sumDisplayed(attr)).toBeCloseTo(attr.deltaNet, 6);
  });

  it("prevOld가 이미 실측이면 사이에 다른 enriched daily가 있어도 쪼개지 않는다(1주 오판정 회귀 수정)", () => {
    // 실사용 버그 재현: 1주 기간은 prevOld(daily 30일 창 안)가 이미 완전히 실측인데,
    // 그 사이에 또 다른 enriched daily(mid 후보)가 있다는 이유만으로 잘못 쪼개져
    // "그 날짜 이전은 추정치" 배지가 근거 없이 붙던 버그.
    const data = emptyData();
    const prevOld = snap("2026-07-25", 100_000_000, 90_000_000); // 완전 실측
    const between = snap("2026-07-27", 101_000_000, 90_500_000); // 완전 실측이지만 mid로 쓰이면 안 됨
    const curr = snap("2026-08-01", 103_000_000, 91_000_000);
    const attr = computePeriodAttribution([prevOld, between, curr], [], {}, "1w", data, RATES)!;
    expect(attr.fromDate).toBe("2026-07-25");
    expect(attr.estimated).toBe(false);
    expect(attr.estimatedUntil).toBeUndefined(); // "07/27 이전은 추정치" 같은 근거 없는 배지 금지
    expect(sumDisplayed(attr)).toBeCloseTo(attr.deltaNet, 6);
  });

  it("liveCurr 없이는 세션 중 반영한 오늘 거래가 stale 저장 스냅샷 탓에 원인분해에서 통째로 누락된다(회귀 재현)", () => {
    // 페이지 로드 시점에 저장된 "오늘" 스냅샷은 이후 세션 중 기록한 대출 상환을 알 수 없다
    // (saveSnapshots는 로드 시 1회만 실행) — liveCurr 없는 기존 호출은 이 stale 스냅샷을 그대로 curr로 쓴다.
    const data = emptyData();
    data.loans = [loan({ id: "l1", balance: 2_000_000 })];
    data.loanTransactions = [loanTx({ loanId: "l1", type: "repay", amount: 1_000_000, date: "2026-08-04", reflected: true })];
    const prevOld = snapClass("2026-08-01", { cash: 10_000_000, loans: 3_000_000 }, {});
    const staleToday = snapClass("2026-08-04", { cash: 10_000_000, loans: 3_000_000 }, {}); // 상환 반영 전 상태로 저장됨
    const attr = computePeriodAttribution([prevOld, staleToday], [], {}, "1w", data, RATES)!;
    expect(attr.deltaNet).toBe(0); // stale curr라 상환 자체가 안 보임
    expect(getOrderedCauses(attr).find((c) => c.key === "debt")).toBeUndefined();
  });

  it("liveCurr 전달 시 오늘 기록한 대출 상환이 stale 저장 스냅샷과 무관하게 정확히 debt로 잡힌다(수정 확인)", () => {
    const data = emptyData();
    data.loans = [loan({ id: "l1", balance: 2_000_000 })];
    data.loanTransactions = [loanTx({ loanId: "l1", type: "repay", amount: 1_000_000, date: "2026-08-04", reflected: true })];
    const prevOld = snapClass("2026-08-01", { cash: 10_000_000, loans: 3_000_000 }, {});
    const staleToday = snapClass("2026-08-04", { cash: 10_000_000, loans: 3_000_000 }, {}); // 여전히 stale
    const curr = liveCurr("2026-08-04", { cash: 10_000_000, loans: 2_000_000 }, {}); // 실시간 값은 상환 반영됨
    const attr = computePeriodAttribution([prevOld, staleToday], [], {}, "1w", data, RATES, curr)!;
    expect(attr.deltaNet).toBe(1_000_000);
    const byKey = new Map(getOrderedCauses(attr).map((c) => [c.key, c.amount]));
    expect(byKey.get("debt")).toBeCloseTo(1_000_000, 6);
  });

  it("일요일: 저장 daily가 토요일 항목뿐이어도 liveCurr가 일요일 날짜면 일요일자 반영 거래가 range에 포함된다(가설 B 수정 확인)", () => {
    // saveSnapshots는 일요일엔 "오늘(일요일)" 날짜로 저장하지 않고 토요일 슬롯만 upsert한다
    // (asset-data-context.tsx) — liveCurr 없이는 curr이 토요일에 고정돼 일요일자 거래가
    // reflectedCryptoFlow의 [fromDate, toDate=토요일] 범위 밖으로 밀려 완전히 사라진다.
    const data = emptyData();
    data.crypto = [cryptoAsset({ id: "cr1", quantity: 0, averagePrice: 0, purchaseDate: "2026-08-01" })];
    data.cryptoTransactions = [cryptoTx({ cryptoId: "cr1", date: "2026-08-09", type: "buy", quantity: 0.01, price: 100_000_000, reflected: true })]; // 일요일 매수 +100만
    const prevOld = snapClass("2026-08-01", { cash: 10_000_000, crypto: 0 }, { crypto: 0 });
    const saturdaySnap = snapClass("2026-08-08", { cash: 10_000_000, crypto: 0 }, { crypto: 0 }); // 토요일까지 무변동

    const withoutLive = computePeriodAttribution([prevOld, saturdaySnap], [], {}, "1w", data, RATES)!;
    expect(withoutLive.deltaNet).toBe(0);
    expect(getOrderedCauses(withoutLive).find((c) => c.key === "buy:crypto")).toBeUndefined();

    const sundayLive = liveCurr("2026-08-09", { cash: 10_000_000, crypto: 1_000_000 }, { crypto: 1_000_000 });
    const withLive = computePeriodAttribution([prevOld, saturdaySnap], [], {}, "1w", data, RATES, sundayLive)!;
    expect(withLive.deltaNet).toBe(1_000_000);
    const byKey = new Map(getOrderedCauses(withLive).map((c) => [c.key, c.amount]));
    expect(byKey.get("buy:crypto")).toBeCloseTo(1_000_000, 6);
  });

  it("기간 중 현금이 왕복(등락 후 복귀)하면 순변화는 0이지만 cashRoundTrip 힌트가 잡힌다", () => {
    // 실사용 재현: mid(=1개월 실측 시작점)와 curr의 breakdown.cash가 완전히 같아 "cash" 원인 자체는
    // 사라지지만(net=0), 중간에 07-27까지 +530만원 벗어났다가 되돌아온 사실을 힌트로 알려줘야 한다.
    const data = emptyData();
    const prevOld = { date: "2025-01-01", netAsset: 90_000_000, financialAsset: 90_000_000 } as DailyAssetSnapshot;
    const mid = snap("2026-07-24", 9_450_000, 9_450_000);
    const rise1 = snap("2026-07-25", 14_250_000, 9_450_000);
    const rise2 = snap("2026-07-27", 14_750_000, 9_450_000); // 최고 이탈점(+530만)
    const back = snap("2026-07-30", 9_450_000, 9_450_000);
    const curr = snap("2026-08-01", 9_450_000, 9_450_000); // mid와 완전히 동일 → net cash = 0
    const attr = computePeriodAttribution([prevOld, mid, rise1, rise2, back, curr], [], {}, "1m", data, RATES)!;
    const byKey = new Map(getOrderedCauses(attr).map((c) => [c.key, c.amount]));
    expect(byKey.has("cash")).toBe(false); // 순변화 0이라 원인 목록엔 안 잡힘(정상)
    expect(attr.cashRoundTrip).toBeDefined();
    expect(attr.cashRoundTrip!.peakDate).toBe("2026-07-27");
    expect(attr.cashRoundTrip!.peakAmount).toBeCloseTo(5_300_000, 6);
  });

  it("왕복 없이 단조 변화하면 cashRoundTrip 힌트가 붙지 않는다(오탐 방지)", () => {
    const data = emptyData();
    const prevOld = { date: "2025-01-01", netAsset: 90_000_000, financialAsset: 90_000_000 } as DailyAssetSnapshot;
    const mid = snap("2026-07-24", 9_450_000, 9_450_000);
    const rise = snap("2026-07-27", 12_000_000, 9_450_000);
    const curr = snap("2026-08-01", 14_000_000, 9_450_000); // 계속 증가 — 왕복 아님
    const attr = computePeriodAttribution([prevOld, mid, rise, curr], [], {}, "1m", data, RATES)!;
    expect(attr.cashRoundTrip).toBeUndefined();
  });

  it("기록된 입금으로 현금이 단조 증가하면 cashRoundTrip 힌트가 붙지 않는다(오탐 방지, 실사용 재현)", () => {
    // 실사용 재현: reflected 입금 2,800만원이 기록돼 breakdown.cash가 그만큼 영구히 올랐는데,
    // 이탈폭 계산이 income을 빼지 않으면 "왕복 후 복귀"로 오판해 income cause와 모순되는 힌트가 뜬다.
    const data = emptyData();
    data.cashTransactions = [cashTx({ date: "2026-08-01", amount: 28_000_000 })];
    const prevOld = { date: "2025-01-01", netAsset: 90_000_000, financialAsset: 90_000_000 } as DailyAssetSnapshot;
    const mid = snap("2026-07-24", 9_450_000, 9_450_000);
    const curr = snap("2026-08-01", 37_450_000, 37_450_000);
    const attr = computePeriodAttribution([prevOld, mid, curr], [], {}, "1m", data, RATES)!;
    expect(attr.cashRoundTrip).toBeUndefined();
    const byKey = new Map(getOrderedCauses(attr).map((c) => [c.key, c.amount]));
    expect(byKey.get("income")).toBeCloseTo(28_000_000, 6);
    expect(byKey.has("cash")).toBe(false);
  });

  it("일요일 홈: 토요일 스냅샷이 stale(목요일 종가)이면 price:stock에 미국 금요일장 하루치가 통째로 잡힌다", () => {
    // 실사용 재현: 토요일 새벽 접속 시 getDailyClosingRefDates가 목요일 종가로 스냅샷을 박제하면,
    // 일요일 실시간 끝점(금요일 확정 종가)과 비교해 휴장일(일요일)인데도 큰 주식 시세 원인이 뜬다.
    const stale = snapClass("2026-08-01", { stocks: 100_000_000, cash: 0 }, { stock: 90_000_000 });
    const liveCurr = {
      ...snapClass("2026-08-02", { stocks: 103_270_000, cash: 0 }, { stock: 90_000_000 }),
      _date: "2026-08-02", _display: "2026-08-02", _isLive: true,
    };
    const attr = computeAttributionSince([stale], [], {}, "2026-08-01", emptyData(), RATES, liveCurr as never);
    expect(attr).not.toBeNull();
    const byKey = new Map(getOrderedCauses(attr!).map((c) => [c.key, c.amount]));
    expect(byKey.get("price:stock")).toBeGreaterThan(CAUSE_DISPLAY_MIN);
  });

  it("일요일 홈: 토요일 스냅샷을 금요일 종가로 교정하면 price:stock이 표시 임계값 아래로 사라진다", () => {
    const corrected = snapClass("2026-08-01", { stocks: 103_270_000, cash: 0 }, { stock: 90_000_000 });
    const liveCurr = {
      ...snapClass("2026-08-02", { stocks: 103_270_000, cash: 0 }, { stock: 90_000_000 }),
      _date: "2026-08-02", _display: "2026-08-02", _isLive: true,
    };
    const attr = computeAttributionSince([corrected], [], {}, "2026-08-01", emptyData(), RATES, liveCurr as never);
    expect(attr).not.toBeNull();
    const byKey = new Map(getOrderedCauses(attr!).map((c) => [c.key, c.amount]));
    expect(Math.abs(byKey.get("price:stock") ?? 0)).toBeLessThan(CAUSE_DISPLAY_MIN);
  });

  it("1주·1개월·3개월·올해 네 기간 모두 같은 하이브리드 규칙을 따른다(기간별 특수 취급 없음)", () => {
    const data = emptyData();
    const prevOld = { date: "2025-01-01", netAsset: 90_000_000, financialAsset: 90_000_000 } as DailyAssetSnapshot;
    const mid = snap("2026-07-20", 100_000_000, 90_000_000);
    const curr = snap("2026-08-01", 102_000_000, 90_000_000);
    for (const period of ["1w", "1m", "3m", "ytd"] as const) {
      const attr = computePeriodAttribution([prevOld, mid, curr], [], {}, period, data, RATES)!;
      expect(attr).not.toBeNull();
      expect(attr.toDate).toBe("2026-08-01");
      expect(sumDisplayed(attr)).toBeCloseTo(attr.deltaNet, 6);
    }
  });

  it("목표일 이하 기록이 전혀 없으면(연초 등) 가장 오래된 포인트로 폴백해 '기록 없음' 대신 결과를 낸다", () => {
    const data = emptyData();
    const onlyOld = { date: "2026-03-01", netAsset: 95_000_000, financialAsset: 95_000_000 } as DailyAssetSnapshot;
    const curr = snap("2026-08-01", 100_000_000, 90_000_000);
    // ytd 목표일(1/1)보다 onlyOld(3/1)가 더 나중이라 <=targetStr 조건은 불만족하지만,
    // 폴백으로 가장 오래된 포인트를 써서 null이 아니라 결과를 낸다(computeAttributionSince와 동일 원칙).
    const attr = computePeriodAttribution([onlyOld, curr], [], {}, "ytd", data, RATES)!;
    expect(attr).not.toBeNull();
    expect(attr.fromDate).toBe("2026-03-01");
    expect(sumDisplayed(attr)).toBeCloseTo(attr.deltaNet, 6);
  });

  it("하이브리드: 예측 구간의 통합 price가 mid 구성비로 안분돼 실측 price:stock과 한 항목으로 합쳐지고 '일부 예측'로 표시된다", () => {
    // 실사용 재현: "시세 하락"(예측, 통합)과 "주식 시세 하락"(실측)이 별도 두 줄로 뜨던 문제.
    // mid 시점 자산 구성이 전부 주식이므로 older의 price(2백만) 전액이 price:stock으로 재배분되고,
    // newer의 price:stock(2백만)과 합쳐져 한 항목(4백만)이 되어야 한다.
    const data = emptyData();
    const prevOld = { date: "2025-01-01", netAsset: 8_000_000, financialAsset: 8_000_000 } as DailyAssetSnapshot;
    const mid = snapClass("2026-06-15", { stocks: 10_000_000 }, { stock: 8_000_000 });
    const curr = snapClass("2026-07-01", { stocks: 12_000_000 }, { stock: 8_000_000 });
    const attr = computePeriodAttribution([prevOld, mid, curr], [], {}, "1m", data, RATES)!;
    expect(attr).not.toBeNull();
    expect(attr.estimatedUntil).toBe("2026-06-15");
    const byKey = new Map(getOrderedCauses(attr).map((c) => [c.key, c.amount]));
    expect(byKey.has("price")).toBe(false); // 통합 key는 안분 후 사라져야 한다
    expect(byKey.get("price:stock")).toBeCloseTo(4_000_000, 6); // 2백만(예측 안분) + 2백만(실측)
    const items = getAttributionItems(attr);
    const stockItem = items.find((i) => i.key === "price:stock");
    expect(stockItem?.estimated).toBe(true); // 일부 예측이 섞인 항목이므로 배지 대상
    expect(sumDisplayed(attr)).toBeCloseTo(attr.deltaNet, 6);
  });

  it("하이브리드: mid의 자산 구성 정보가 없으면(전액 현금 등) price가 안분되지 않고 통합 라벨 그대로 남는다", () => {
    const data = emptyData();
    const prevOld = { date: "2025-01-01", netAsset: 90_000_000, financialAsset: 90_000_000 } as DailyAssetSnapshot;
    const mid = snap("2026-06-15", 95_000_000, 90_000_000); // snap 헬퍼는 stocks/crypto/realEstate=0, cash만
    const curr = snap("2026-07-01", 98_000_000, 90_000_000);
    const attr = computePeriodAttribution([prevOld, mid, curr], [], {}, "1m", data, RATES)!;
    const byKey = new Map(getOrderedCauses(attr).map((c) => [c.key, c.amount]));
    expect(byKey.has("price")).toBe(true); // 안분 불가 → 통합 key 유지
    const items = getAttributionItems(attr);
    const priceItem = items.find((i) => i.key === "price");
    expect(priceItem?.label).toContain("보유자산 시세"); // 자산군 통합임이 라벨로 드러나야 한다
  });

  it("순수 예측 구간(mid 없음)에서도 price 라벨이 '보유자산 시세'로 명확히 표시된다", () => {
    const data = emptyData();
    const legacy = { date: "2026-05-01", netAsset: 100_000_000, financialAsset: 100_000_000 } as DailyAssetSnapshot;
    const daily = [legacy, snap("2026-05-20", 100_005_000, 90_000_000)];
    const attr = run(data, daily, "2026-05-01")!;
    expect(attr.estimated).toBe(true);
    const items = getAttributionItems(attr);
    const priceItem = items.find((i) => i.key === "price");
    expect(priceItem?.label).toBe("보유자산 시세 상승");
  });

  it("소득 유입/유출 문구가 매수·매도와 같은 패턴('현금 입금/출금으로 ~')으로 통일된다", () => {
    const data = emptyData();
    data.cashTransactions = [cashTx({ date: "2026-05-10", amount: 1_000_000, reflected: true })];
    const daily = [snap("2026-05-01", 100_000_000, 90_000_000), snap("2026-05-20", 101_000_000, 91_000_000)];
    const attr = run(data, daily, "2026-05-01")!;
    const items = getAttributionItems(attr);
    const incomeItem = items.find((i) => i.key === "income");
    expect(incomeItem?.label).toBe("현금 입금");
    expect(incomeItem?.sentence).toBe("현금 입금으로 +100만원 늘었어요.");
  });

  it("하이브리드: 부동산 비중이 커도 예측 price 안분은 주식·코인에만 적용되고 부동산은 제외된다", () => {
    // 부동산은 currentValue를 사용자가 수동으로만 갱신하는 계단식 값이라(real-estate-input.tsx),
    // "정체불명 시세 변동"을 부동산 비중만큼 떼어주면 근거 없는 "부동산 시세 하락"이 뜬다.
    // mid 구성이 부동산 80%·주식 20%여도, 예측 price(2백만) 전액이 주식에만 안분돼야 한다
    // (구버전 버그였다면 20%인 40만원만 주식에, 나머지 160만원이 price:realEstate로 샜을 것).
    const data = emptyData();
    const prevOld = { date: "2025-01-01", netAsset: 8_000_000, financialAsset: 8_000_000 } as DailyAssetSnapshot;
    const cost = { stock: 2_000_000, realEstate: 8_000_000 };
    const mid = snapClass("2026-06-15", { stocks: 2_000_000, realEstate: 8_000_000 }, cost);
    const curr = snapClass("2026-07-01", { stocks: 3_000_000, realEstate: 8_000_000 }, cost);
    const attr = computePeriodAttribution([prevOld, mid, curr], [], {}, "1m", data, RATES)!;
    const byKey = new Map(getOrderedCauses(attr).map((c) => [c.key, c.amount]));
    expect(byKey.has("price")).toBe(false);
    expect(byKey.has("price:realEstate")).toBe(false); // 부동산은 안분 대상에서 완전히 빠져야 한다
    expect(byKey.get("price:stock")).toBeCloseTo(3_000_000, 6); // 2백만(예측 전액) + 1백만(실측)
    expect(sumDisplayed(attr)).toBeCloseTo(attr.deltaNet, 6);
  });

  it("groupAttributionItems: 같은 자산군 원인(시세·매수·매도)을 한 박스로 묶고 현금·대출은 항상 각자의 그룹으로 완전히 분리되며, 그룹은 합계 절대값 큰 순서로 정렬된다", () => {
    const items = [
      { key: "price:stock", label: "주식 시세 상승", sentence: "주식 시세 상승으로 100원 늘었어요.", amount: 100, text: "+100원" },
      { key: "fx", label: "환율 상승", sentence: "환율 상승이 50원 보탰어요.", amount: 50, text: "+50원" },
      { key: "buy:stock", label: "주식 매수", sentence: "주식 매수로 30원 늘었어요.", amount: 30, text: "+30원" },
      { key: "sell:stock", label: "주식 매도", sentence: "주식 매도로 10원 줄었어요.", amount: -10, text: "-10원" },
      { key: "income", label: "현금 입금", sentence: "현금 입금으로 20원 늘었어요.", amount: 20, text: "+20원" },
      { key: "cash", label: "신규 현금", sentence: "새로 추가한 현금으로 5원 늘었어요.", amount: 5, text: "+5원" },
      { key: "debt", label: "대출 상환", sentence: "대출 상환으로 15원 늘었어요.", amount: 15, text: "+15원" },
    ] as ReturnType<typeof getAttributionItems>;
    const groups = groupAttributionItems(items);
    // 대출 활동이 있어도 cash는 항상 "현금" 그룹에만 남는다(2026-08 병합 규칙 완전 제거 — 무관한
    // 소액 대출 변동이 같은 기간에 있다는 이유만으로 큰 현금 변동까지 "대출" 섹션에 끌려가는 오분류
    // 방지). 그룹 합계(절대값): stock=120, fx=50, 현금(income+cash)=25, 대출(debt만)=15.
    expect(groups.map((g) => g.key)).toEqual(["stock", null, "cash", "loan"]);
    expect(groups[0].label).toBe("주식");
    expect(groups[0].items.map((i) => i.key)).toEqual(["price:stock", "buy:stock", "sell:stock"]);
    expect(groups[1].items.map((i) => i.key)).toEqual(["fx"]);
    expect(groups[2].label).toBe("현금");
    expect(groups[2].items.map((i) => i.key)).toEqual(["income", "cash"]);
    expect(groups[3].label).toBe("대출");
    expect(groups[3].items.map((i) => i.key)).toEqual(["debt"]);
  });

  it("groupAttributionItems: 대출 활동이 있어도 현금 잔차는 대출 박스로 묶이지 않고 각자의 그룹으로 완전히 분리된다", () => {
    // 대출 상환만 기록하고 그 돈이 나간 현금 계좌 쪽엔 별도 출금 기록을 안 남긴 시나리오라도,
    // 무관한 큰 현금 변동(예: 신규 현금 자산 대량 추가)이 같은 기간에 있으면 "대출" 섹션에
    // 잘못 끌려가는 오분류가 있었다(2026-08 QA) — 병합 규칙을 완전히 제거해 항상 분리한다.
    const data = emptyData();
    data.loanTransactions = [loanTx({ loanId: "l1", type: "repay", amount: 1_000_000, date: "2026-05-10", reflected: true })];
    const prev = snapClass("2026-05-01", { cash: 10_000_000, loans: 3_000_000 }, {});
    const curr = snapClass("2026-05-20", { cash: 9_000_000, loans: 2_000_000 }, {});
    const attr = run(data, [prev, curr], "2026-05-01")!;
    const items = getAttributionItems(attr);
    const byKey = new Map(items.map((c) => [c.key, c.amount]));
    expect(byKey.get("debt")).toBeCloseTo(1_000_000, 6); // 상환 사실이 상쇄되지 않고 그대로 보임
    expect(byKey.get("cash")).toBeCloseTo(-1_000_000, 6); // 미기록 현금 유출도 별도 금액으로 그대로 보임
    const groups = groupAttributionItems(items);
    const loanGroup = groups.find((g) => g.key === "loan")!;
    const cashGroup = groups.find((g) => g.key === "cash")!;
    expect(loanGroup.items.map((i) => i.key)).toEqual(["debt"]); // 대출 그룹엔 debt만
    expect(cashGroup.items.map((i) => i.key)).toEqual(["cash"]); // 현금 그룹엔 cash만 — 더 이상 합쳐지지 않음
    expect(sumDisplayed(attr)).toBeCloseTo(attr.deltaNet, 6);
  });

  it("groupAttributionItems: 신규 현금 대량 추가와 무관한 소액 대출 변동이 같은 기간에 있어도 현금 금액이 그대로 표시된다(대출 오분류 회귀)", () => {
    // 실사용 재현: 8600만원 규모 신규 현금 자산을 등록한 주에, 무관한 소액 대출 변동(예: 이자
    // 반영으로 인한 잔액 소폭 증가)이 같은 기간에 겹치면 신규 현금 추가가 "대출" 섹션에 잘못
    // 표시되고 금액도 착시로 다르게 읽히는 문제가 보고됐다(2026-08). dCostCash 자체는 loans를
    // 참조하지 않으므로 금액은 원래도 정확해야 하고, 그룹 분리로 표시도 더 이상 뒤섞이지 않는다.
    const data = emptyData();
    const prev = snapClass("2026-07-28", { cash: 5_000_000, loans: 20_000_000 }, {});
    const curr = snapClass("2026-08-04", { cash: 91_000_000, loans: 20_300_000 }, {}); // 현금 +8600만, 대출 +30만(무관한 소액 변동)
    const attr = run(data, [prev, curr], "2026-07-28")!;
    const items = getAttributionItems(attr);
    const byKey = new Map(items.map((c) => [c.key, c.amount]));
    expect(byKey.get("cash")).toBeCloseTo(86_000_000, 6); // 신규 현금 추가액이 정확히 그대로
    expect(byKey.get("debt")).toBeCloseTo(-300_000, 6); // 대출 증가(부호 규약상 음수)는 별개 값
    const groups = groupAttributionItems(items);
    expect(groups.find((g) => g.key === "cash")!.items.map((i) => i.key)).toEqual(["cash"]);
    expect(groups.find((g) => g.key === "loan")!.items.map((i) => i.key)).toEqual(["debt"]);
    expect(sumDisplayed(attr)).toBeCloseTo(attr.deltaNet, 6);
  });

  it("groupAttributionItems: 반대 부호 항목이 상쇄돼도 순변동(합계 절대값) 기준으로 정렬된다", () => {
    // 주식은 개별 항목 크기(90+90=180)는 크지만 매수·매도가 상쇄돼 순변동은 0에 가깝다.
    // 코인은 순변동 40 하나뿐이라 실제로는 코인이 더 위로 와야 한다(단순 절대값 합이 아니라 순합의 절대값).
    const items = [
      { key: "buy:stock", label: "주식 매수", sentence: "주식 매수로 90원 늘었어요.", amount: 90, text: "+90원" },
      { key: "sell:stock", label: "주식 매도", sentence: "주식 매도로 88원 줄었어요.", amount: -88, text: "-88원" },
      { key: "price:crypto", label: "코인 시세 상승", sentence: "코인 시세 상승으로 40원 늘었어요.", amount: 40, text: "+40원" },
    ] as ReturnType<typeof getAttributionItems>;
    const groups = groupAttributionItems(items);
    expect(groups.map((g) => g.key)).toEqual(["crypto", "stock"]); // 코인(40) > 주식 순변동(2)
  });
});
