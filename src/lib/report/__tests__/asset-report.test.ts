import { describe, it, expect } from "vitest";
import { computeAttributionSince, getAttributionItems, getOrderedCauses } from "../asset-report";
import type { AssetData, DailyAssetSnapshot, Loan, SnapshotBreakdown, SnapshotCost, Stock } from "@/types/asset";
import type { CashTransaction, Transaction } from "@/types/transaction";

// 원인분해 항등식 회귀 — 표시 항목의 합이 항상 Δ순자산과 일치해야 한다(S-4.22 AC6).
// resolveAttribution은 비공개라 computeAttributionSince를 통해 검증한다.

const RATES = { USD: 1400, JPY: 900 };

const emptyData = (): AssetData => ({
  realEstate: [], stocks: [], crypto: [], cash: [], loans: [],
  yearlyNetAssets: [], transactions: [], cashTransactions: [],
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

const trade = (o: Partial<Transaction> = {}): Transaction => ({
  id: `tx_${Math.random().toString(36).slice(2)}`,
  stockId: "s1", ticker: "005930", stockName: "삼성전자",
  type: "buy", quantity: 10, price: 70_000, currency: "KRW",
  date: "2026-05-10", reflected: true, createdAt: new Date().toISOString(), ...o,
});

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

  it("미반영(과거 소급) 현금 기록 자체는 원인이 아니고, 실제 잔액 증가가 소득으로 귀속된다", () => {
    const data = emptyData();
    data.cashTransactions = [cashTx({ date: "2026-05-10", amount: 3_000_000, reflected: false })];
    // 미반영 거래는 cost.total을 움직이지 않는다 → savingFull = 0. 잔액(breakdown.cash)만 +300만
    const daily = [snap("2026-05-01", 100_000_000, 90_000_000), snap("2026-05-20", 103_000_000, 90_000_000)];
    const attr = run(data, daily, "2026-05-01")!;
    expect(attr.incomeEffect).toBe(0); // 순자산을 움직이지 않은 기록은 집계하지 않는다
    expect(attr.savingEffect).toBe(0);
    // 실제 현금 증가분은 표시 단계에서 소득으로 귀속되고 시세로 오인되지 않는다
    const byKey = new Map(getOrderedCauses(attr).map((c) => [c.key, c.amount]));
    expect(byKey.get("income")).toBeCloseTo(3_000_000, 6);
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
    // CAUSE_ORDER: buy:stock(5) < sell:stock(6) < income(11) < debt(12) — 절대값 크기와 무관하게 이 순서
    expect(ordered).toEqual(["buy:stock", "sell:stock", "income", "debt"]);
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
});
