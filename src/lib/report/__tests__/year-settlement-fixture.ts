// 5.124 올해 결산 — 실사용 형태 픽스처(작년 말 수동값 1억 · 1~9월 레거시 · 10월부터 enrich). 저장 코드와 같은 수식으로 월 기록을 만든다.
// 10/31 이후 효과: 순유입 +3,000,000 · 시세 +3,000,000 · 환율 +300,000 · 대출 −200,000 · 잔차 −100,000. 테스트 전용(운영 번들 미포함).
import { computeAssetCost, computeNetAsset } from "@/contexts/asset-data-context";
import type { buildLiveAttributionCurr } from "../asset-report";
import type { AssetData, MonthlyAssetSnapshot, Stock } from "@/types/asset";

export const M = 1_000_000;
export const R0 = { USD: 1500, JPY: 900 };
export const R1 = { USD: 1515, JPY: 900 };

export const emptyData = (): AssetData => ({
  realEstate: [], stocks: [], crypto: [], cash: [], loans: [], yearlyNetAssets: [], transactions: [], cashTransactions: [], loanTransactions: [], cryptoTransactions: [], physicalAssets: [],
  lastUpdated: "2026-10-31T09:00:00.000Z", nickname: "",
});
export const dep = (id: string, date: string, amount: number) =>
  ({ id, cashId: "c_krw", date, type: "deposit", amount, currency: "KRW", reflected: true }) as AssetData["cashTransactions"][number];

export interface StateOpts { krwPrice: number; cash: number; loan: number; tx: AssetData["cashTransactions"]; y2026: number; noCashAccount?: boolean; noLoan?: boolean; yearly?: AssetData["yearlyNetAssets"] }
export function state(o: StateOpts): AssetData {
  const d = emptyData();
  d.yearlyNetAssets = o.yearly ?? [{ year: 2025, netAsset: 100 * M, note: "" }, { year: 2026, netAsset: o.y2026, note: "자동" }];
  d.stocks = [
    { id: "s_kr", category: "domestic", name: "국내주식", ticker: "005930", quantity: 1000, averagePrice: 50000, currentPrice: o.krwPrice, currency: "KRW", purchaseDate: "2024-03-02", broker: "키움증권" },
    { id: "s_us", category: "foreign", name: "해외주식", ticker: "AAPL", quantity: 100, averagePrice: 200, currentPrice: 200, currency: "USD", purchaseDate: "2024-06-02", purchaseExchangeRate: 1500, broker: "미래에셋증권" },
  ] as Stock[];
  d.cash = o.noCashAccount ? [] : [{ id: "c_krw", type: "bank", name: "주거래 통장", balance: o.cash, currency: "KRW" }] as AssetData["cash"];
  d.loans = o.noLoan ? [] : [{ id: "l1", type: "credit", name: "신용대출", balance: o.loan, interestRate: 0, startDate: "2024-01-01" }] as AssetData["loans"];
  d.cashTransactions = o.tx;
  return d;
}

export function mkSnap(d: AssetData, rates: typeof R0, month: string, date: string): MonthlyAssetSnapshot {
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
export function summaryOf(d: AssetData, rates: typeof R0) {
  const n = computeNetAsset(d, rates);
  const c = computeAssetCost(d, rates);
  return { ...n, realEstateCost: c.realEstateCost, stockCost: c.stockCost, cryptoCost: c.cryptoCost, physicalCost: c.physicalCost } as unknown as Parameters<typeof buildLiveAttributionCurr>[2];
}

export const TX_NOV = [dep("d1", "2026-11-10", 2 * M)];
export const TX_DEC = [...TX_NOV, dep("d2", "2026-12-05", 1 * M)];
export const oct = state({ krwPrice: 60000, cash: 32 * M, loan: 10 * M, tx: [], y2026: 112 * M });
export const nov = state({ krwPrice: 61000, cash: 34 * M, loan: 10 * M, tx: TX_NOV, y2026: 115 * M });
export const now = state({ krwPrice: 63000, cash: 34.9 * M, loan: 10.2 * M, tx: TX_DEC, y2026: 118 * M });
export const decEnd = state({ krwPrice: 64000, cash: 34.9 * M, loan: 10.2 * M, tx: TX_DEC, y2026: 119 * M });
export const sOct = mkSnap(oct, R0, "2026-10", "2026-10-31");
export const sNov = mkSnap(nov, R0, "2026-11", "2026-11-30");
export const sDecMid = mkSnap(now, R1, "2026-12", "2026-12-15");
export const sDec = mkSnap(decEnd, R1, "2026-12", "2026-12-31");
export const legacy = ["01", "02", "03", "04", "05", "06", "07", "08", "09"].map((m, i): MonthlyAssetSnapshot => ({ month: `2026-${m}`, netAsset: 101 * M + i * M, financialAsset: 101 * M + i * M }));
export const FIXTURE_TODAY = "2026-12-15";
export const fixtureMonthly = [...legacy, sOct, sNov, sDecMid];
