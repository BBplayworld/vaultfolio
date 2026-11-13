// 4.94 처음 맞는 결산 픽스처 — F1(기본)·F2(현금 계좌 매수). 저장 코드와 같은 수식(computeNetAsset·computeAssetCost·buildLiveAttributionCurr)으로
// 일별·월 기록을 만들어, 시세만 바뀌는 구간의 '기록 안 된 변화' 비중을 검증한다. 테스트 전용(운영 번들 미포함).
import type { AssetData, DailyAssetSnapshot, MonthlyAssetSnapshot } from "@/types/asset";
import { computeAssetCost, computeNetAsset } from "@/contexts/asset-data-context";
import { buildLiveAttributionCurr } from "../asset-report";
import { daysBetween, resolveSettlementWindow, type SettlementWindow } from "../settlement";
import { computeSettlementCauses, settlementDelta } from "@/app/(main)/_components/views/activity/change-hero";

/** 'YYYY-MM-DD' KST 10시 → id에 들어가는 13자리 ms */
export const msOf = (date: string): number => Date.parse(`${date}T01:00:00Z`);

export const addDays = (date: string, n: number): string => {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

const R0 = "2026-11-03"; // 1차 등록(자산 2건)
const R1 = "2026-11-06"; // 2차 등록(자산 3건)

/** 기준 시세 가정: 날짜 d의 시세는 11/3 대비 일수 k에 대한 결정적 함수(KRW 주식 +0.2%/일, 달러 주식 진동, BTC +0.4%/일, 환율 완만) */
export const ratesOn = (date: string) => ({ USD: 1400 + 2 * daysBetween(R0, date), JPY: 900 });

export interface FixtureOpts {
  cashBuy?: boolean;                        // F2: 11/6 신규 달러 주식을 현금 계좌 잔액으로 매수(현금 감소 + 주식 증가)
  extra?: { id: string; date: string }[];   // 추가 등록 자산(창 중 신규 등록·매수 등)
}

/** 날짜 d 시점의 자산 상태 — 등록일이 d 이전(포함)인 자산만 존재 */
export function assetDataOn(date: string, opts: FixtureOpts = {}): AssetData {
  const k = daysBetween(R0, date);
  const usdQty = 15;
  const buyKrw = usdQty * 200 * 1400;
  const stocks = [
    { id: `stock_${msOf(R0)}`, category: "domestic", name: "국내주", ticker: "005930", quantity: 100, averagePrice: 65000, currentPrice: Math.round(70000 * (1 + 0.002 * k)), currency: "KRW" },
    ...(date >= R1 ? [{ id: `stock_${msOf(R1)}`, category: "foreign", name: "해외주", ticker: "AAPL", quantity: usdQty, averagePrice: 190, currentPrice: Math.round(200 * (1 + 0.003 * Math.sin(k)) * 100) / 100, currency: "USD", purchaseExchangeRate: 1380 }] : []),
  ];
  const crypto = date >= R1 ? [{ id: `crypto_${msOf(R1)}_0`, name: "비트코인", symbol: "BTC", quantity: 0.1, averagePrice: 95_000_000, currentPrice: Math.round(100_000_000 * (1 + 0.004 * k)) }] : [];
  const cashBal = opts.cashBuy && date >= R1 ? 20_000_000 - buyKrw : 20_000_000;
  const cash = [{ id: `cash_${msOf(R0)}`, type: "bank", name: "생활비", balance: cashBal, currency: "KRW" }];
  const loans = date >= R1 ? [{ id: `loan_${msOf(R1)}`, type: "credit", name: "신용대출", balance: 10_000_000, interestRate: 4 }] : [];
  for (const e of opts.extra ?? []) {
    if (date >= e.date) stocks.push({ id: e.id, category: "domestic", name: "추가주", ticker: "000660", quantity: 10, averagePrice: 150000, currentPrice: 150000, currency: "KRW" });
  }
  return {
    realEstate: [], stocks, crypto, cash, loans, physicalAssets: [],
    yearlyNetAssets: [], transactions: [], cashTransactions: [], loanTransactions: [], cryptoTransactions: [],
    lastUpdated: `${date}T00:00:00.000Z`,
  } as unknown as AssetData;
}

/** 날짜 d의 라이브 점·요약 */
export function liveOn(data: AssetData, date: string) {
  const rates = ratesOn(date);
  const n = computeNetAsset(data, rates);
  const c = computeAssetCost(data, rates);
  const summary = { ...n, ...c } as unknown as Parameters<typeof buildLiveAttributionCurr>[2];
  return { rates, n, live: buildLiveAttributionCurr(data, rates, summary) };
}

/** 저장 코드와 같은 모양의 일별 기록 */
export function dailyOn(date: string, opts: FixtureOpts = {}): DailyAssetSnapshot {
  const { n, live } = liveOn(assetDataOn(date, opts), date);
  return {
    date, netAsset: n.netAsset, financialAsset: live.financialAsset,
    breakdown: live.breakdown, fx: live.fx, fxBase: live.fxBase, cost: live.cost,
  } as DailyAssetSnapshot;
}

export function dailyRange(from: string, to: string, opts: FixtureOpts = {}): DailyAssetSnapshot[] {
  const out: DailyAssetSnapshot[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(dailyOn(d, opts));
  return out;
}

export const monthlyOf = (d: DailyAssetSnapshot): MonthlyAssetSnapshot => ({ ...d, month: d.date.slice(0, 7) }) as MonthlyAssetSnapshot;


/** 구간의 Hero 증감·원인(결산 화면 계산과 같은 함수) */
export function causesOf(w: SettlementWindow, data: AssetData, today: string) {
  const { rates, n, live } = liveOn(data, today);
  const { delta } = settlementDelta(w, n.netAsset);
  const { mapped } = computeSettlementCauses({
    start: w.start, end: w.end, live, deltaNet: delta, startDate: w.startDate, endDate: w.endDate,
    liveCash: n.cashValue, exchangeHistory: {}, assetData: data, rates,
  });
  const unrecorded = mapped.causes.find((c) => c.key === "unrecorded")?.amount ?? 0;
  return { delta, mapped, unrecorded, sum: mapped.causes.reduce((s, c) => s + c.amount, 0) };
}

export { resolveSettlementWindow };
