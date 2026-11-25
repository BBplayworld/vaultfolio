// #295 P4 — 기록만(reflected=false) 대출·코인 기록이 있을 때 성과 원인이 왜곡되는지 재현 (엔진 수정 없음, 테스트만)
// 사용자가 잔액·수량을 이미 직접 맞춘 상태에서 기록만 거래를 더했을 때 원인 합 = Hero이고, 기록 없을 때보다 나빠지지 않는지 본다.
import { describe, expect, it } from "vitest";
import { computeSettlementCauses } from "@/app/(main)/_components/views/activity/change-hero";
import type { AssetData, MonthlyAssetSnapshot } from "@/types/asset";

const W = 10_000; // 만 원
const RATES = { USD: 1400, JPY: 900 };
const S = "2026-09-30", E = "2026-10-28";
const data = (): AssetData => ({
  realEstate: [], stocks: [], crypto: [], cash: [], loans: [],
  yearlyNetAssets: [], transactions: [], cashTransactions: [], loanTransactions: [], cryptoTransactions: [],
  lastUpdated: "2026-01-01T00:00:00.000Z", nickname: "",
});
// 만 원 단위 입력: cash·loan·cryptoValue·cryptoCost
const snap = (month: string, date: string, p: { cash: number; loan?: number; crypto?: number; cryptoCost?: number }): MonthlyAssetSnapshot => {
  const cash = p.cash * W, loans = (p.loan ?? 0) * W, crypto = (p.crypto ?? 0) * W, cc = (p.cryptoCost ?? 0) * W;
  return {
    month, date, netAsset: cash + crypto - loans, financialAsset: cash + crypto,
    breakdown: { realEstate: 0, stocks: 0, crypto, cash, loans, tenantDeposit: 0 },
    fx: { ...RATES }, fxBase: { USD: 0, JPY: 0 },
    cost: { total: cash + cc, stock: 0, crypto: cc, realEstate: 0 },
  };
};
const LIVE = { date: E, _date: E, _display: E, netAsset: 0, financialAsset: 0 } as unknown as Parameters<typeof computeSettlementCauses>[0]["live"];
const run = (d: AssetData, start: MonthlyAssetSnapshot, end: MonthlyAssetSnapshot) => {
  const m = computeSettlementCauses({
    start, end, live: LIVE, deltaNet: end.netAsset - start.netAsset, startDate: S, endDate: E,
    liveCash: 0, exchangeHistory: {}, assetData: d, rates: RATES,
  }).mapped;
  const a = (k: string) => m.causes.find((c) => c.key === k)?.amount ?? 0;
  return {
    hero: end.netAsset - start.netAsset, sum: m.causes.reduce((s, c) => s + c.amount, 0),
    causes: Object.fromEntries(m.causes.map((c) => [c.key, c.amount / W])) as Record<string, number>,
    unrecorded: a("unrecorded"), loan: a("loan"), price: a("price"),
  };
};
const ltx = (id: string, type: "repay" | "borrow", amt: number, reflected: boolean) =>
  ({ id, loanId: "l1", date: "2026-10-10", type, amount: amt * W, reflected, createdAt: `2026-10-10T0${id.length}:00:00.000Z` }) as AssetData["loanTransactions"][number];
const ctx = (id: string, type: "buy" | "sell", qty: number, price: number, reflected: boolean) =>
  ({ id, cryptoId: "k1", symbol: "BTC", name: "코인", date: "2026-10-10", type, quantity: qty, price, reflected, createdAt: "2026-10-10T01:00:00.000Z" }) as AssetData["cryptoTransactions"][number];
const withLoanTx = (txs: AssetData["loanTransactions"]) => { const d = data(); d.loanTransactions = txs; return d; };
const withCryptoTx = (txs: AssetData["cryptoTransactions"]) => { const d = data(); d.cryptoTransactions = txs; return d; };

// 판정 ② 왜곡: 기록 안 된 변화와 반대 방향 원인(loan 또는 price)이 각각 10원 이상이면서 부호가 갈림
const distorted = (r: { unrecorded: number }, other: number) => Math.abs(r.unrecorded) >= 10 && Math.abs(other) >= 10 && Math.sign(r.unrecorded) !== Math.sign(other);

const L_UP = [snap("2026-09", S, { cash: 1000, loan: 3000 }), snap("2026-10", E, { cash: 700, loan: 2700 })]; // 상환 300
const L_DN = [snap("2026-09", S, { cash: 1000, loan: 3000 }), snap("2026-10", E, { cash: 1500, loan: 3500 })]; // 추가 대출 500
const C_BUY = [snap("2026-09", S, { cash: 1000 }), snap("2026-10", E, { cash: 700, crypto: 360, cryptoCost: 300 })];
const C_SELL = [snap("2026-09", S, { cash: 700, crypto: 300, cryptoCost: 300 }), snap("2026-10", E, { cash: 1000 })];

const SCENARIOS: { id: string; d: AssetData; pts: MonthlyAssetSnapshot[]; other: "loan" | "price"; hero: number }[] = [
  { id: "L1", d: withLoanTx([ltx("a", "repay", 300, false)]), pts: L_UP, other: "loan", hero: 0 },
  { id: "L2", d: withLoanTx([ltx("a", "repay", 200, true), ltx("bb", "repay", 100, false)]), pts: L_UP, other: "loan", hero: 0 },
  { id: "L3", d: withLoanTx([ltx("a", "borrow", 500, false)]), pts: L_DN, other: "loan", hero: 0 },
  { id: "L4", d: withLoanTx([ltx("a", "borrow", 300, true), ltx("bb", "borrow", 200, false)]), pts: L_DN, other: "loan", hero: 0 },
  { id: "C1", d: withCryptoTx([ctx("a", "buy", 3, 100 * W, false)]), pts: C_BUY, other: "price", hero: 60 },
  { id: "C2", d: withCryptoTx([ctx("a", "buy", 2, 100 * W, true), ctx("bb", "buy", 1, 100 * W, false)]), pts: C_BUY, other: "price", hero: 60 },
  { id: "C3", d: withCryptoTx([ctx("a", "sell", 3, 100 * W, false)]), pts: C_SELL, other: "price", hero: 0 },
  { id: "C4", d: withCryptoTx([ctx("a", "sell", 2, 100 * W, true), ctx("bb", "sell", 1, 100 * W, false)]), pts: C_SELL, other: "price", hero: 0 },
];

describe("#295 P4 대출·코인 기록만 시나리오 (현행 엔진 결과 고정 — 왜곡 0)", () => {
  for (const sc of SCENARIOS) {
    it(`${sc.id}: 원인 합 = Hero, 기대 원인 그대로, 기록 없을 때(대조)와 같고 왜곡 없음`, () => {
      const r = run(sc.d, sc.pts[0], sc.pts[1]);
      const base = run(data(), sc.pts[0], sc.pts[1]);
      expect(r.hero / W).toBe(sc.hero);
      expect(Math.round(r.sum)).toBe(Math.round(r.hero));
      expect(r.causes).toEqual(sc.hero === 0 ? {} : { price: sc.hero });
      expect(r.causes).toEqual(base.causes);
      expect(distorted(r, sc.other === "loan" ? r.loan : r.price)).toBe(false);
    });
  }
});
