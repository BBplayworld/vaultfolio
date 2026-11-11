// 4.79 최근 7일 결산 테스트 공용 픽스처 — 일별 스냅샷(enrich) + 7일 동안의 시세·환율·입출금·매매·대출·평가 갱신.
// 오늘 = 2026-11-12(KST). 시작점 = 11/05. 스냅샷은 saveSnapshots와 같은 수식(computeNetAsset·computeAssetCost)으로 박제한다.
import { computeAssetCost, computeNetAsset } from "@/contexts/asset-data-context";
import type { buildLiveAttributionCurr } from "@/lib/report/asset-report";
import type { AssetData, DailyAssetSnapshot, MonthlyAssetSnapshot, Stock } from "@/types/asset";

export const M = 1_000_000;
export const NOW_ISO = "2026-11-12T03:00:00Z"; // KST 2026-11-12 12:00
export const TODAY = "2026-11-12";
export type Rates = { USD: number; JPY: number };
export const rateAt = (i: number): Rates => ({ USD: 1400 + i * 4, JPY: 900 });
export const DAYS = ["2026-11-05", "2026-11-06", "2026-11-07", "2026-11-08", "2026-11-09", "2026-11-10", "2026-11-11"];

const empty = (): AssetData => ({
  realEstate: [], stocks: [], crypto: [], cash: [], loans: [], yearlyNetAssets: [], transactions: [], cashTransactions: [], loanTransactions: [], cryptoTransactions: [], physicalAssets: [],
  lastUpdated: "2026-11-05T09:00:00.000Z", nickname: "",
});

export function baseData(): AssetData {
  const d = empty();
  d.realEstate = [{ id: "re1", type: "apartment", name: "우리집", purchasePrice: 400 * M, currentValue: 520 * M, purchaseDate: "2021-05-01", tenantDeposit: 0 } as AssetData["realEstate"][number]];
  d.stocks = [
    { id: "s_sam", category: "domestic", name: "삼성전자", ticker: "005930", quantity: 100, averagePrice: 62000, currentPrice: 70000, currency: "KRW", purchaseDate: "2024-03-02", broker: "키움증권" },
    { id: "s_aapl", category: "foreign", name: "애플", ticker: "AAPL", quantity: 20, averagePrice: 170, currentPrice: 190, currency: "USD", purchaseDate: "2024-06-02", purchaseExchangeRate: 1300, broker: "미래에셋증권" },
  ] as Stock[];
  d.crypto = [{ id: "cr_btc", name: "비트코인", symbol: "BTC", quantity: 0.1, averagePrice: 90 * M, currentPrice: 100 * M, purchaseDate: "2024-02-01" } as AssetData["crypto"][number]];
  d.cash = [
    { id: "c_krw", type: "bank", name: "주거래 통장", balance: 30 * M, currency: "KRW" },
    { id: "c_usd", type: "bank", name: "달러 통장", balance: 2000, currency: "USD" },
  ] as AssetData["cash"];
  d.loans = [{ id: "l_cred", type: "credit", name: "신용대출", balance: 20 * M, interestRate: 4.5, startDate: "2024-01-01" }] as AssetData["loans"];
  return d;
}

const stamp = (date: string) => ({ reflected: true, reflectedAt: `${date}T10:00:00.000Z`, createdAt: `${date}T10:00:00.000Z` });

/** 스냅샷 박제와 같은 수식 */
export function snapOf(d: AssetData, rates: Rates, date: string): DailyAssetSnapshot {
  const nab = computeNetAsset(d, rates);
  const cost = computeAssetCost(d, rates);
  const fxBase = { USD: 0, JPY: 0 };
  for (const s of d.stocks) if (s.currency === "USD") fxBase.USD += s.quantity * s.currentPrice * rates.USD;
  for (const c of d.cash) if (c.currency === "USD") fxBase.USD += c.balance * rates.USD;
  return {
    date, netAsset: nab.netAsset, financialAsset: nab.financialAsset,
    breakdown: { realEstate: nab.realEstateValue, stocks: nab.stockValue, crypto: nab.cryptoValue, cash: nab.cashValue, loans: nab.loanBalance, tenantDeposit: nab.tenantDepositTotal, physical: nab.physicalValue },
    fx: { USD: rates.USD, JPY: rates.JPY }, fxBase,
    cost: { total: cost.realEstateCost + cost.physicalCost + cost.stockCost + cost.cryptoCost + nab.cashValue, stock: cost.stockCost, crypto: cost.cryptoCost, realEstate: cost.realEstateCost, physical: cost.physicalCost },
  };
}

/** getAssetSummary 대용 — 홈이 쓰는 summary와 같은 필드 */
export function summaryOf(d: AssetData, rates: Rates) {
  const n = computeNetAsset(d, rates);
  const c = computeAssetCost(d, rates);
  return {
    ...n, realEstateValue: n.realEstateValue, stockValue: n.stockValue, cryptoValue: n.cryptoValue, cashValue: n.cashValue, loanBalance: n.loanBalance,
    tenantDepositTotal: n.tenantDepositTotal, physicalValue: n.physicalValue, netAsset: n.netAsset,
    realEstateCost: c.realEstateCost, stockCost: c.stockCost, cryptoCost: c.cryptoCost, physicalCost: c.physicalCost,
  } as unknown as Parameters<typeof buildLiveAttributionCurr>[2];
}

export type Step = { date: string; apply: (d: AssetData) => AssetData };
let seq = 0;
const nid = (p: string) => `${p}_${1700000000000 + ++seq}`;

export const deposit = (date: string, amount: number, cashId = "c_krw"): Step => ({
  date,
  apply: (d) => ({
    ...d,
    cashTransactions: [...d.cashTransactions, { id: nid("ctx"), cashId, type: "deposit", amount, currency: "KRW", date, ...stamp(date) } as AssetData["cashTransactions"][number]],
    cash: d.cash.map((c) => (c.id === cashId ? { ...c, balance: c.balance + amount } : c)),
  }),
});
export const withdraw = (date: string, amount: number, cashId = "c_krw"): Step => ({
  date,
  apply: (d) => ({
    ...d,
    cashTransactions: [...d.cashTransactions, { id: nid("ctx"), cashId, type: "withdrawal", amount, currency: "KRW", date, ...stamp(date) } as AssetData["cashTransactions"][number]],
    cash: d.cash.map((c) => (c.id === cashId ? { ...c, balance: c.balance - amount } : c)),
  }),
});
/** 거래 기록 + 수량 갱신(연결 없음 — 출금 기록과는 ±3일 짝) */
export const stockBuy = (date: string, stockId: string, qty: number, price: number): Step => ({
  date,
  apply: (d) => {
    const s = d.stocks.find((x) => x.id === stockId)!;
    const tx = { id: nid("tx"), stockId, ticker: s.ticker ?? "", stockName: s.name, type: "buy", quantity: qty, price, currency: s.currency, ...(s.currency === "USD" ? { exchangeRate: 1400 } : {}), date, ...stamp(date) };
    return { ...d, transactions: [...d.transactions, tx as never], stocks: d.stocks.map((x) => (x.id === stockId ? { ...x, quantity: x.quantity + qty } : x)) };
  },
});
export const loanBorrow = (date: string, amount: number, loanId = "l_cred"): Step => ({
  date,
  apply: (d) => ({
    ...d,
    loanTransactions: [...d.loanTransactions, { id: nid("ltx"), loanId, type: "borrow", amount, date, ...stamp(date) } as AssetData["loanTransactions"][number]],
    loans: d.loans.map((l) => (l.id === loanId ? { ...l, balance: l.balance + amount } : l)),
  }),
});
export const loanRepay = (date: string, amount: number, loanId = "l_cred"): Step => ({
  date,
  apply: (d) => ({
    ...d,
    loanTransactions: [...d.loanTransactions, { id: nid("ltx"), loanId, type: "repay", amount, date, ...stamp(date) } as AssetData["loanTransactions"][number]],
    loans: d.loans.map((l) => (l.id === loanId ? { ...l, balance: l.balance - amount } : l)),
  }),
});
export const realEstateValue = (date: string, value: number): Step => ({
  date, apply: (d) => ({ ...d, realEstate: d.realEstate.map((r) => ({ ...r, currentValue: value })) }),
});
/** 잔액만 고침(거래 기록 없음) */
export const cashEdit = (date: string, cashId: string, balance: number): Step => ({
  date, apply: (d) => ({ ...d, cash: d.cash.map((c) => (c.id === cashId ? { ...c, balance } : c)) }),
});

/** i번째 날(0 = 11/05)의 시세 반영 — 삼성전자·애플·BTC가 매일 조금씩 움직인다 */
export function withPrices(d: AssetData, i: number): AssetData {
  return {
    ...d,
    stocks: d.stocks.map((s) => (s.id === "s_sam" ? { ...s, currentPrice: 70000 + i * 600 } : s.id === "s_aapl" ? { ...s, currentPrice: 190 + i * 2 } : s)),
    crypto: d.crypto.map((c) => ({ ...c, currentPrice: 100 * M + i * 700_000 })),
  };
}

/** 날짜 index(0..7, 7 = 오늘 11/12)까지의 상태 */
export function stateAt(steps: Step[], i: number): AssetData {
  const day = i >= DAYS.length ? TODAY : DAYS[i];
  let d = withPrices(baseData(), i);
  for (const s of steps) if (s.date <= day) d = s.apply(d);
  return d;
}

export interface Scenario {
  assetData: AssetData;
  rates: Rates;
  summary: ReturnType<typeof summaryOf>;
  daily: DailyAssetSnapshot[];
  monthly: MonthlyAssetSnapshot[];
  exchangeHistory: Record<string, { USD: number; JPY: number }>;
}

/** 7일 연속 enrich 일별 스냅샷 + 오늘 실시간 상태. legacyStart면 시작점(11/05)만 enrich 없이(레거시) */
export function buildScenario(steps: Step[], opts: { legacyStart?: boolean; days?: string[] } = {}): Scenario {
  seq = 0; // 거래 id를 호출 순서로 고정(골든 안정)
  const days = opts.days ?? DAYS;
  const daily = days.map((date) => {
    const i = DAYS.indexOf(date) >= 0 ? DAYS.indexOf(date) : 0;
    const s = snapOf(stateAt(steps, i), rateAt(i), date);
    if (opts.legacyStart && date === days[0]) return { date, netAsset: s.netAsset, financialAsset: s.financialAsset } as DailyAssetSnapshot;
    return s;
  });
  const rates = rateAt(DAYS.length);
  const assetData = stateAt(steps, DAYS.length);
  const exchangeHistory: Scenario["exchangeHistory"] = {};
  DAYS.forEach((date, i) => { exchangeHistory[date] = rateAt(i); });
  exchangeHistory[TODAY] = rates;
  return { assetData, rates, summary: summaryOf(assetData, rates), daily, monthly: [], exchangeHistory };
}

/** 모든 종류 원인이 한 번씩 들어간 7일 — 시세·환율·입금·출금↔매수 짝·추가 대출·부동산 평가 갱신 */
export const RICH_STEPS: Step[] = [
  deposit("2026-11-07", 3 * M),
  withdraw("2026-11-08", 5 * M),
  stockBuy("2026-11-08", "s_sam", 70, 71000),
  loanBorrow("2026-11-09", 2 * M),
  realEstateValue("2026-11-10", 524 * M),
];
