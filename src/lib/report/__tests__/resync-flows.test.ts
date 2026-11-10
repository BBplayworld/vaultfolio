// #91 C21 거래 패턴 (a)~(g) — 맞추기 결과가 결산 엔진·양도세·거래 롤백에서 직접 수정(updateStock)과 같은 방식으로 흐르는지 고정한다.
// 맞추기는 거래 기록을 만들지도 지우지도 않는다(transactions 배열 참조 동일).
import { describe, expect, it } from "vitest";
import { computeAssetCost } from "@/contexts/asset-data-context";
import { computeAttributionBetween } from "../asset-report";
import { computeSettlementCauses } from "@/app/(main)/_components/views/activity/change-hero";
import { computeForeignRealizedGain } from "@/lib/tax-utils";
import { rollbackTransaction } from "@/lib/trade/trade-utils";
import { applyResync, computeDiff, defaultRemoveIds, mergeScreens, resolveScreens } from "@/lib/asset/resync";
import { emptySel, row, screen, st } from "@/lib/asset/resync/__tests__/fixtures";
import type { AssetData, MonthlyAssetSnapshot, Stock } from "@/types/asset";

const RATES = { USD: 1400, JPY: 900 };
const START = "2026-09-30";
const END = "2026-11-08";
const CASH = 1_000_000;

const data = (stocks: Stock[], transactions: AssetData["transactions"] = []): AssetData => ({
  realEstate: [], stocks, crypto: [], cash: [], loans: [],
  yearlyNetAssets: [], transactions, cashTransactions: [], loanTransactions: [], cryptoTransactions: [],
  lastUpdated: "2026-01-01T00:00:00.000Z", nickname: "",
});
const mul = (c: string) => (c === "USD" ? RATES.USD : 1);
const snap = (d: AssetData, month: string, date: string, enriched = true): MonthlyAssetSnapshot => {
  const value = d.stocks.reduce((s, x) => s + x.quantity * x.currentPrice * mul(x.currency), 0);
  const cost = computeAssetCost(d, RATES).stockCost;
  return {
    month, date, netAsset: CASH + value, financialAsset: CASH + value,
    breakdown: { realEstate: 0, stocks: value, crypto: 0, cash: CASH, loans: 0, tenantDeposit: 0 },
    ...(enriched ? { fx: { ...RATES }, fxBase: { USD: 0, JPY: 0 }, cost: { total: CASH + cost, stock: cost, crypto: 0, realEstate: 0 } } : {}),
  } as MonthlyAssetSnapshot;
};
const tx = (id: string, stockId: string, type: "buy" | "sell", quantity: number, price: number, date: string, currency: "KRW" | "USD" = "KRW", exchangeRate?: number) =>
  ({ id, stockId, ticker: "T", stockName: "종목", type, quantity, price, currency, exchangeRate, date, reflected: true, createdAt: `${date}T00:00:00Z` }) as AssetData["transactions"][number];

function resync(existing: Stock[], items: ReturnType<typeof row>[], opts: { remove?: string[] } = {}) {
  const resolved = resolveScreens([screen(0, items)], existing, { usdRate: RATES.USD });
  const diff = computeDiff(existing, mergeScreens(resolved), resolved);
  const sel = { ...emptySel(), remove: defaultRemoveIds(diff) };
  // 사용자가 유지 묶음·삭제 후보에서 직접 체크한 삭제
  for (const id of opts.remove ?? []) sel.remove.add(id);
  return applyResync(existing, diff, sel, { today: END, usdRate: RATES.USD, now: 1 }).stocks;
}
const causes = (before: AssetData, after: AssetData) => {
  const prev = snap(before, "2026-09", START);
  const curr = snap(after, "2026-11", END);
  const attr = computeAttributionBetween(prev, curr, {}, after, RATES, false)!;
  const amt = (k: string) => attr.effects.find((e) => e.key === k)?.amount ?? 0;
  const live = { date: END, _date: END, _display: END, netAsset: 0, financialAsset: 0 } as unknown as Parameters<typeof computeSettlementCauses>[0]["live"];
  const mapped = computeSettlementCauses({
    start: prev, end: curr, live, deltaNet: curr.netAsset - prev.netAsset, startDate: START, endDate: END,
    liveCash: 0, exchangeHistory: {}, assetData: after, rates: RATES,
  }).mapped;
  return { buy: amt("buy:stock"), sell: amt("sell:stock"), unrecorded: mapped.causes.find((c) => c.key === "unrecorded")?.amount ?? 0, dCost: curr.cost!.stock - prev.cost!.stock };
};
const direct = (existing: Stock[], patch: (s: Stock) => Stock | null) => existing.map(patch).filter((s): s is Stock => !!s);

const A = st("a", "005930", "domestic", "토스증권", 10, 100_000);
const hint = { brokerHint: "토스증권" };

describe("C21 거래 패턴", () => {
  it("(a) 기록 없이 수량 10→7: 주식 매도 = 기존 평단×3, 거래 0건 추가, 직접 수정과 같은 결과", () => {
    const txs: AssetData["transactions"] = [];
    const after = resync([A], [row("005930", 7, 100_000, hint)], {});
    // ① 정확 일치 수량 감소는 확인 필요가 아니라 변경이다
    expect(after[0].quantity).toBe(7);
    const b = data([A], txs);
    const res = causes(b, data(after, txs));
    const dir = causes(b, data(direct([A], (s) => ({ ...s, quantity: 7 })), txs));
    expect(res.sell).toBe(-300_000);
    expect(res.buy + res.sell).toBe(res.dCost);
    expect(res).toEqual(dir);
    expect(txs).toHaveLength(0);
  });

  it("(b) 지난달 반영 매수가 있는 종목 삭제: 이번 달 매도 = 삭제 원가, 지난달 매수 불변, 거래 보관, 양도세 불변", () => {
    const f = st("f", "AAPL", "foreign", "토스증권", 10, 100);
    const txs = [tx("t1", "f", "buy", 10, 100, "2026-09-10", "USD", 1300)];
    const other = st("o", "000660", "domestic", "토스증권", 1, 1000);
    const after = resync([f, other], [row("000660", 1, 1000, hint)], { remove: ["f"] });
    expect(after.map((s) => s.id)).toEqual(["o"]);
    const b = data([f, other], txs);
    const aD = data(after, txs);
    const res = causes(b, aD);
    expect(res.sell).toBe(-1_400_000);
    expect(res.buy).toBe(0);
    expect(res.buy + res.sell).toBe(res.dCost);
    expect(aD.transactions).toBe(txs);
    expect(computeForeignRealizedGain(aD, 2026, RATES)).toEqual(computeForeignRealizedGain(b, 2026, RATES));
    expect(causes(b, data(direct([f, other], (s) => (s.id === "f" ? null : s)), txs)).unrecorded).toBe(res.unrecorded);
  });

  it("(c) 이번 달 반영 매수 X 후 삭제: 매수 +X와 매도 두 줄, 합 = dCost", () => {
    const s0 = st("a", "005930", "domestic", "토스증권", 8, 100_000);
    const sNow = { ...s0, quantity: 10 }; // 이번 달 2주 매수 반영 후
    const txs = [tx("t1", "a", "buy", 2, 100_000, "2026-10-10")];
    const keep = st("k", "000660", "domestic", "토스증권", 1, 1000);
    const after = resync([sNow, keep], [row("000660", 1, 1000, hint)], { remove: ["a"] });
    const res = causes(data([s0, keep], []), data(after, txs));
    expect(res.buy).toBe(200_000);
    expect(res.sell).toBe(-1_000_000);
    expect(res.buy + res.sell).toBe(res.dCost);
  });

  it("(d) 신규 추가: 매수일이 올해 1월 1일(#139), 이번 달 매수 = 원가(정밀 구간), 기존 종목은 신규 투입으로 잡히지 않는다(예측 구간 포함)", () => {
    const after = resync([A], [row("005930", 10, 100_000, hint), row("TSLA", 5, 100, hint)]);
    const added = after.find((s) => s.ticker === "TSLA")!;
    expect(added.purchaseDate).toBe("2026-01-01");
    expect(added.positionEffectiveDate).toBe(END);
    const b = data([A]);
    const aD = data(after);
    const res = causes(b, aD);
    expect(res.buy).toBe(5 * 100 * RATES.USD);
    expect(res.sell).toBe(0);
    // 예측 구간의 신규 투입 추정은 purchaseDate를 본다: 기존 종목은 승계(불변), 신규만 오늘
    expect(after.find((s) => s.id === "a")!.purchaseDate).toBe(A.purchaseDate);
  });

  it("(d') #139 예측 구간(시작 스냅샷 원가 없음)에서 신규 추가의 원가는 매수일(1월 1일)이 든 구간에 '매수(추정)'로 잡힌다 — 정밀 구간은 영향 없음", () => {
    const after = resync([A], [row("005930", 10, 100_000, hint), row("TSLA", 5, 100, hint)]);
    const cost = 5 * 100 * RATES.USD;
    const est = (from: string, to: string, fromMonth: string, toMonth: string) => {
      const attr = computeAttributionBetween(snap(data([A]), fromMonth, from, false), snap(data(after), toMonth, to), {}, data(after), RATES, false)!;
      return attr.effects.find((e) => e.key === "buy:stock")?.amount ?? 0;
    };
    // 이번 달 구간(9/30~11/8): 1월 1일이 구간 밖이라 매수(추정)에서 빠진다(이전: 오늘 매수일이라 포함)
    expect(est(START, END, "2026-09", "2026-11")).toBe(0);
    // 올해 구간(12/31~11/8): 1월 1일이 구간 안 → 포함(이전과 같음)
    expect(est("2025-12-31", END, "2025-12", "2026-11")).toBe(cost);
    // 1월 월 결산(12/31~1/31, 시작 스냅샷 원가 없음): 그때 없던 종목이 '매수(추정)'로 소급되고 시세에서 같은 금액이 빠진다(합계 불변)
    const jan = computeAttributionBetween(snap(data([A]), "2025-12", "2025-12-31", false), snap(data([A]), "2026-01", "2026-01-31"), {}, data(after), RATES, false)!;
    const amt = (k: string) => jan.effects.find((e) => e.key === k)?.amount ?? 0;
    expect(amt("buy:stock")).toBe(cost);
    expect(amt("buy:stock") + amt("price")).toBeCloseTo(0, 6);
    // 정밀 구간(원가 기록 스냅샷)은 원가 차이로 재므로 매수일과 무관
    expect(causes(data([A]), data(after)).buy).toBe(cost);
  });

  it("(e) 해외 평단 변경: 매입 환율 불변, 환차손익 기준 환율은 기존 값", () => {
    const f = st("f", "AAPL", "foreign", "토스증권", 10, 100, { purchaseExchangeRate: 1300 });
    const after = resync([f], [row("AAPL", 10, 110, hint)]);
    expect(after[0]).toMatchObject({ averagePrice: 110, purchaseExchangeRate: 1300, id: "f" });
    const res = causes(data([f]), data(after));
    expect(res.buy).toBe(10 * 10 * RATES.USD);
    expect(computeAssetCost(data(after), RATES).stockCurrencyGain).toBe((RATES.USD - 1300) * 10 * 110);
    expect(res).toEqual(causes(data([f]), data(direct([f], (s) => ({ ...s, averagePrice: 110 })))));
  });

  it("(f) 해외 종목 삭제 후 양도세: 실현손익은 맞추기 전과 같다(거래 보관)", () => {
    const f = st("f", "AAPL", "foreign", "토스증권", 5, 100, { purchaseExchangeRate: 1300 });
    const k = st("k", "000660", "domestic", "토스증권", 1, 1000);
    const txs = [tx("b1", "f", "buy", 10, 100, "2026-02-01", "USD", 1300), tx("s1", "f", "sell", 5, 150, "2026-03-01", "USD", 1350)];
    const after = resync([f, k], [row("000660", 1, 1000, hint)], { remove: ["f"] });
    expect(after.map((s) => s.id)).toEqual(["k"]);
    const bTax = computeForeignRealizedGain(data([f, k], txs), 2026, RATES);
    expect(bTax).not.toBeNull();
    expect(computeForeignRealizedGain(data(after, txs), 2026, RATES)).toEqual(bTax);
  });

  it("(g) S5: 수량을 줄인 항목에서 맞추기 전 반영 매수 삭제 결과 = updateStock으로 고친 뒤 삭제한 결과(현상 고정: 음수 기준 0 절단)", () => {
    const s = st("a", "005930", "domestic", "토스증권", 100, 100);
    const buy = tx("t1", "a", "buy", 100, 100, "2026-10-01");
    const pos = (x: Stock) => ({ quantity: x.quantity, avgPrice: x.averagePrice, avgExchangeRate: 0, source: "manual" as const, effectiveDate: END, lockedByManual: false });
    const afterResync = resync([s], [row("005930", 60, 100, hint)])[0];
    const viaUpdate = { ...s, quantity: 60 };
    const r1 = rollbackTransaction(pos(afterResync), [buy], "t1");
    const r2 = rollbackTransaction(pos(viaUpdate), [buy], "t1");
    expect(r1).toEqual({ ...r2, effectiveDate: r1.effectiveDate });
    // 현상 고정: 60-100 = -40 → 0, 평단도 0 (근본 수정은 후속 이슈)
    expect(r1.quantity).toBe(0);
    expect(r1.avgPrice).toBe(0);
    // 수량을 늘린 경우(100→150)는 정상
    const up = resync([s], [row("005930", 150, 100, hint)])[0];
    expect(rollbackTransaction(pos(up), [buy], "t1").quantity).toBe(50);
  });
});
