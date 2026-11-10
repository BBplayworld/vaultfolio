// #91 C21 코인 대응 — 맞추기 결과가 결산 엔진에서 직접 수정과 같은 방식으로 흐른다(코인 매수·매도). 거래 기록은 만들지도 지우지도 않는다.
import { describe, expect, it } from "vitest";
import { computeAttributionBetween } from "../asset-report";
import { applyResync, computeDiff, cryptoToStock, defaultRemoveIds, matchExchangeHint, mergeScreens, parsedCryptoToRaw, resolveScreens, stocksToCrypto } from "@/lib/asset/resync";
import { emptySel } from "@/lib/asset/resync/__tests__/fixtures";
import type { AssetData, Crypto, MonthlyAssetSnapshot } from "@/types/asset";

const RATES = { USD: 1400, JPY: 900 };
const START = "2026-09-30";
const END = "2026-11-08";
const CASH = 1_000_000;
const co = (id: string, symbol: string, quantity: number, averagePrice: number): Crypto =>
  ({ id, name: symbol, symbol, quantity, averagePrice, currentPrice: averagePrice, purchaseDate: "2025-01-01", exchange: "업비트" });
const data = (crypto: Crypto[], cryptoTransactions: AssetData["cryptoTransactions"] = []): AssetData => ({
  realEstate: [], stocks: [], crypto, cash: [], loans: [], yearlyNetAssets: [], transactions: [], cashTransactions: [], loanTransactions: [], cryptoTransactions,
  lastUpdated: "x", nickname: "",
});
const snap = (d: AssetData, month: string, date: string): MonthlyAssetSnapshot => {
  const cost = d.crypto.reduce((s, c) => s + c.quantity * c.averagePrice, 0);
  return {
    month, date, netAsset: CASH + cost, financialAsset: CASH + cost,
    breakdown: { realEstate: 0, stocks: 0, crypto: cost, cash: CASH, loans: 0, tenantDeposit: 0 },
    fx: { ...RATES }, fxBase: { USD: 0, JPY: 0 }, cost: { total: CASH + cost, stock: 0, crypto: cost, realEstate: 0 },
  } as MonthlyAssetSnapshot;
};
const tx = (id: string, cryptoId: string, type: "buy" | "sell", quantity: number, price: number, date: string) =>
  ({ id, cryptoId, symbol: "X", name: "X", type, quantity, price, date, reflected: true, createdAt: `${date}T00:00:00Z` }) as AssetData["cryptoTransactions"][number];
const resync = (existing: Crypto[], items: ReturnType<typeof parsedCryptoToRaw>[], remove: string[] = []) => {
  const adapted = existing.map(cryptoToStock);
  const res = resolveScreens([{ index: 0, status: "ok", items }], adapted, { usdRate: 1400, matchHint: matchExchangeHint });
  const diff = computeDiff(adapted, mergeScreens(res), res);
  const sel = { ...emptySel(), remove: defaultRemoveIds(diff) };
  remove.forEach((id) => sel.remove.add(id));
  return stocksToCrypto(existing, adapted, applyResync(adapted, diff, sel, { today: END, usdRate: 1400, now: 3 }).stocks);
};
const raw = (symbol: string, q: number, avg: number) => parsedCryptoToRaw({ name: symbol, symbol, quantity: q, averagePrice: avg, currentPrice: avg, exchange: "업비트", currency: "KRW" }, 1400);
const causes = (before: AssetData, after: AssetData) => {
  const prev = snap(before, "2026-09", START);
  const curr = snap(after, "2026-11", END);
  const attr = computeAttributionBetween(prev, curr, {}, after, RATES, false)!;
  const amt = (k: string) => attr.effects.find((e) => e.key === k)?.amount ?? 0;
  return { buy: amt("buy:crypto"), sell: amt("sell:crypto"), dCost: curr.cost!.crypto - prev.cost!.crypto };
};

describe("C21 코인", () => {
  const A = co("a", "BTC", 10, 100_000);
  const K = co("k", "ETH", 1, 1000);
  it("(a) 기록 없이 수량 10→7: 코인 매도 = 기존 평단×3, 거래 0건, 직접 수정과 같다", () => {
    const after = resync([A], [raw("BTC", 7, 100_000)]);
    const res = causes(data([A]), data(after));
    expect(res.sell).toBe(-300_000);
    expect(res.buy + res.sell).toBe(res.dCost);
    expect(res).toEqual(causes(data([A]), data([{ ...A, quantity: 7 }])));
  });
  it("(b) 지난달 반영 매수가 있는 코인 삭제: 매도 = 삭제 원가, 지난달 매수 불변, 거래 보관", () => {
    const txs = [tx("t1", "a", "buy", 10, 100_000, "2026-09-10")];
    const after = resync([A, K], [raw("ETH", 1, 1000)], ["a"]);
    expect(after.map((c) => c.id)).toEqual(["k"]);
    const aD = data(after, txs);
    const res = causes(data([A, K], txs), aD);
    expect(res.sell).toBe(-1_000_000);
    expect(res.buy).toBe(0);
    expect(aD.cryptoTransactions).toBe(txs);
  });
  it("(c) 이번 달 반영 매수 X 후 삭제: 매수 +X와 매도 두 줄, 합 = dCost", () => {
    const a0 = co("a", "BTC", 8, 100_000);
    const txs = [tx("t1", "a", "buy", 2, 100_000, "2026-10-10")];
    const after = resync([{ ...a0, quantity: 10 }, K], [raw("ETH", 1, 1000)], ["a"]);
    const res = causes(data([a0, K]), data(after, txs));
    expect(res.buy).toBe(200_000);
    expect(res.sell).toBe(-1_000_000);
    expect(res.buy + res.sell).toBe(res.dCost);
  });
  it("(d) 신규 추가: 이번 달 매수 = 원가, 매수일 올해 1월 1일(#139), 기존 코인 매수일 승계", () => {
    const after = resync([A], [raw("BTC", 10, 100_000), raw("SOL", 5, 10_000)]);
    const res = causes(data([A]), data(after));
    expect(res.buy).toBe(50_000);
    expect(after.find((c) => c.symbol === "SOL")!.purchaseDate).toBe("2026-01-01");
    expect(after.find((c) => c.id === "a")).toBe(A);
  });
});
