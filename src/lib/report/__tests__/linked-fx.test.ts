// #103 F20 — USD 종목 ↔ USD 현금 연결: 결산 환율 효과가 연결 전후 같고 Σ원인 = Δ순자산 (수수료·소수 단가 반올림 일치)
import { describe, expect, it } from "vitest";
import { computeSettlementCauses } from "@/app/(main)/_components/views/activity/change-hero";
import { buildLink, linkAmount, stockLinkTrade } from "@/lib/trade/linked-record";
import type { AssetData, MonthlyAssetSnapshot } from "@/types/asset";

const R0 = { USD: 1400, JPY: 900 }, R1 = { USD: 1450, JPY: 900 };
const snap = (month: string, date: string, rates: { USD: number; JPY: number }, usdCash: number, usdStock: number, usdStockCost: number): MonthlyAssetSnapshot => {
  const cash = usdCash * rates.USD, stock = usdStock * rates.USD;
  return {
    month, date, netAsset: cash + stock, financialAsset: cash + stock,
    breakdown: { realEstate: 0, stocks: stock, crypto: 0, cash, loans: 0, tenantDeposit: 0, physical: 0 },
    fx: { ...rates }, fxBase: { USD: 0, JPY: 0 },
    cost: { total: cash + usdStockCost * rates.USD, stock: usdStockCost * rates.USD, crypto: 0, realEstate: 0, physical: 0 },
  };
};
const LIVE = { date: "2026-11-05", _date: "2026-11-05", _display: "2026-11-05", netAsset: 0, financialAsset: 0 } as unknown as Parameters<typeof computeSettlementCauses>[0]["live"];
const base = (): AssetData => ({
  realEstate: [], crypto: [], loans: [], yearlyNetAssets: [], transactions: [], cashTransactions: [], loanTransactions: [], cryptoTransactions: [], lastUpdated: "x", nickname: "",
  cash: [{ id: "u", type: "bank", name: "달러", balance: 5000, currency: "USD" }],
  stocks: [{ id: "s1", category: "foreign", name: "AAPL", ticker: "AAPL", quantity: 10, averagePrice: 100, currentPrice: 100, currency: "USD", purchaseDate: "2025-01-01", purchaseExchangeRate: 1400 }],
} as unknown as AssetData);
const tx = { id: "tx_u1", stockId: "s1", ticker: "AAPL", stockName: "AAPL", type: "buy" as const, quantity: 3, price: 10.005, fee: 0.333, currency: "USD" as const, exchangeRate: 1400, date: "2026-11-03", reflected: true, createdAt: "x" };

function causes(d: AssetData, usdCash: number) {
  const start = snap("2026-10", "2026-10-31", R0, 5000, 1000, 1000);
  const end = snap("2026-11", "2026-11-05", R1, usdCash, 1000 + 30.35, 1000 + 30.35);
  const m = computeSettlementCauses({ start, end, live: LIVE, deltaNet: end.netAsset - start.netAsset, startDate: start.date!, endDate: end.date!, liveCash: 0, exchangeHistory: {}, assetData: d, rates: R1 }).mapped;
  return { m, sum: m.causes.reduce((s, c) => s + c.amount, 0) };
}

describe("F20 USD 연결", () => {
  it("연결 금액은 수수료·소수 단가를 USD 0.01로 반올림해 짝 기록과 같다", () => {
    expect(linkAmount({ ...tx })).toBe(30.35);
    const b = buildLink({ ...base(), transactions: [tx] }, stockLinkTrade(tx), { kind: "cash", cashId: "u" }, "2026-11-12");
    if (!b.ok) throw new Error(b.reason);
    expect(b.data.cashTransactions[0]).toMatchObject({ amount: 30.35, currency: "USD", type: "withdrawal" });
    expect(b.data.cash[0].balance).toBe(4969.65);
  });
  it("결산 환율 효과: 연결 전(거래만 + 맞춘 잔액)과 연결 후가 같고 Σ = Δ", () => {
    const plain = causes({ ...base(), transactions: [tx], cash: [{ ...base().cash[0], balance: 4969.65 }] }, 4969.65);
    const b = buildLink({ ...base(), transactions: [tx] }, stockLinkTrade(tx), { kind: "cash", cashId: "u" }, "2026-11-12");
    if (!b.ok) throw new Error(b.reason);
    const linked = causes(b.data, 4969.65);
    const fx = (r: ReturnType<typeof causes>) => r.m.causes.find((c) => c.key === "fx")?.amount ?? 0;
    expect(fx(linked)).toBe(fx(plain));
    expect(Math.abs(linked.sum - linked.m.deltaNet)).toBeLessThan(1);
    expect(Math.abs(plain.sum - plain.m.deltaNet)).toBeLessThan(1);
    // 연결이 남기는 차이는 체결 환율 vs 현재 환율·수수료 몫의 순유입 잔여뿐이고 1만원 미만(홈은 숨김 임계, spec 7 외화)
    const income = linked.m.causes.find((c) => c.key === "income")?.amount ?? 0;
    expect(Math.abs(income)).toBeLessThan(10_000);
    expect(linked.m.causes.map((c) => c.key).filter((k) => k !== "income")).toEqual(plain.m.causes.map((c) => c.key));
  });
});
