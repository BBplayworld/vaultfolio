// #310(5.156) 맞추기 저장 계획 — ① 결함: 체크 삭제 종목의 거래가 고아로 남던 문제(직접 삭제 planDeleteStocks 규칙과 일치)
// ② 증권사 이관(이어받기·합치기)의 결산 원인·세금·백업·되돌리기 불변. 순수 함수만 쓴다(저장·React 0).
import { describe, expect, it } from "vitest";
import { computeAssetCost, planDeleteStocks } from "@/contexts/asset-data-context";
import { computeAttributionBetween } from "../asset-report";
import { computeSettlementCauses } from "@/app/(main)/_components/views/activity/change-hero";
import { applyResync, buildResyncUndoEntries, computeDiff, defaultRemoveIds, mergeScreens, planResyncSave, planUndo, resolveScreens, type ResyncSelection } from "@/lib/asset/resync";
import { emptySel, row, screen, st } from "@/lib/asset/resync/__tests__/fixtures";
import type { AssetData, MonthlyAssetSnapshot, Stock } from "@/types/asset";

const RATES = { USD: 1400, JPY: 900 };
const START = "2026-09-30";
const END = "2026-11-08";
const CASH = 1_000_000;

const data = (stocks: Stock[], transactions: AssetData["transactions"] = [], o: Partial<AssetData> = {}): AssetData => ({
  realEstate: [], stocks, crypto: [], cash: [], loans: [],
  yearlyNetAssets: [], transactions, cashTransactions: [], loanTransactions: [], cryptoTransactions: [],
  lastUpdated: "2026-01-01T00:00:00.000Z", nickname: "", ...o,
});
const mul = (c: string) => (c === "USD" ? RATES.USD : 1);
const snap = (d: AssetData, month: string, date: string): MonthlyAssetSnapshot => {
  const value = d.stocks.reduce((s, x) => s + x.quantity * x.currentPrice * mul(x.currency), 0);
  const cost = computeAssetCost(d, RATES).stockCost;
  return {
    month, date, netAsset: CASH + value, financialAsset: CASH + value,
    breakdown: { realEstate: 0, stocks: value, crypto: 0, cash: CASH, loans: 0, tenantDeposit: 0 },
    fx: { ...RATES }, fxBase: { USD: 0, JPY: 0 }, cost: { total: CASH + cost, stock: cost, crypto: 0, realEstate: 0 },
  } as MonthlyAssetSnapshot;
};
const tx = (id: string, stockId: string, type: "buy" | "sell", quantity: number, price: number, date: string, currency: "KRW" | "USD" = "KRW", exchangeRate?: number) =>
  ({ id, stockId, ticker: "T", stockName: "종목", type, quantity, price, currency, exchangeRate, date, reflected: true, createdAt: `${date}T00:00:00Z` }) as AssetData["transactions"][number];

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
  return { buy: amt("buy:stock"), sell: amt("sell:stock"), unrecorded: mapped.causes.find((c) => c.key === "unrecorded")?.amount ?? 0, dCost: curr.cost!.stock - prev.cost!.stock, deltaNet: curr.netAsset - prev.netAsset };
};

const del = (d: AssetData, ids: string[]) => planDeleteStocks(d, ids, RATES, END);
const orphans = (d: AssetData) => (d.transactions ?? []).filter((t) => !d.stocks.some((s) => s.id === t.stockId)).length;

/** 화면 1장 맞추기 → 저장 데이터(현행 handleApply와 같은 순서) */
function resyncSave(fresh: AssetData, items: ReturnType<typeof row>[], pick: (sel: ResyncSelection, diff: ReturnType<typeof computeDiff>) => void = () => {}) {
  const resolved = resolveScreens([screen(0, items)], fresh.stocks, { usdRate: RATES.USD });
  const diff = computeDiff(fresh.stocks, mergeScreens(resolved), resolved);
  const sel: ResyncSelection = { ...emptySel(), remove: defaultRemoveIds(diff) };
  pick(sel, diff);
  const result = applyResync(fresh.stocks, diff, sel, { today: END, usdRate: RATES.USD, now: Date.parse(`${END}T03:00:00Z`) });
  const plan = planResyncSave(fresh, result, del);
  return { diff, sel, result, plan, saved: plan.data, legacy: { ...fresh, stocks: result.stocks } };
}

const hint = { brokerHint: "토스증권" };

describe("#310 결함 — 맞추기 체크 삭제 종목의 거래 정리(직접 삭제와 같은 규칙)", () => {
  const gone = st("g", "000660", "domestic", "토스증권", 10, 1000);
  const keep = st("k", "005930", "domestic", "토스증권", 1, 50_000);
  const txs = [tx("t1", "g", "buy", 4, 1000, "2026-11-03"), tx("t2", "g", "buy", 6, 1000, "2026-08-01"), tx("t3", "k", "buy", 1, 50_000, "2026-11-02")];

  it("v5.152 저장(stocks만)은 고아 거래를 남긴다 — 수정본은 0", () => {
    const fresh = data([gone, keep], txs);
    const r = resyncSave(fresh, [row("005930", 1, 50_000, hint)], (sel) => sel.remove.add("g"));
    expect(r.result.stocks.map((s) => s.id)).toEqual(["k"]);
    expect(orphans(r.legacy)).toBe(2); // 재현: 이전 저장 방식
    expect(orphans(r.saved)).toBe(0);
    expect(r.saved.transactions.map((t) => t.id)).toEqual(["t3"]);
  });

  it("저장 결과 = 같은 종목을 planDeleteStocks로 직접 지운 결과(transactions 동일)", () => {
    const fresh = data([gone, keep], txs);
    const r = resyncSave(fresh, [row("005930", 1, 50_000, hint)], (sel) => sel.remove.add("g"));
    const direct = del(fresh, ["g"]);
    expect(r.saved.transactions).toEqual(direct.transactions);
    expect(r.saved.stocks).toEqual(direct.stocks.map((s) => r.saved.stocks.find((x) => x.id === s.id)));
  });

  it("평가액 0 종목(전량 매도)은 거래를 남긴다(C24)", () => {
    const zero = st("z", "000660", "domestic", "토스증권", 0, 1000);
    const zTx = [tx("s1", "z", "sell", 3, 1200, "2026-11-04")];
    const fresh = data([zero, keep], zTx);
    const r = resyncSave(fresh, [row("005930", 1, 50_000, hint)], (sel) => sel.remove.add("z"));
    expect(r.saved.stocks.map((s) => s.id)).toEqual(["k"]);
    expect(r.saved.transactions).toEqual(zTx);
  });

  it("결산 원인: 이번 달 반영 매수가 빠져 직접 삭제와 같은 원인, '기록 안 된 변화' 동일", () => {
    const fresh = data([gone, keep], txs);
    const r = resyncSave(fresh, [row("005930", 1, 50_000, hint)], (sel) => sel.remove.add("g"));
    const viaResync = causes(fresh, r.saved);
    const viaDirect = causes(fresh, del(fresh, ["g"]));
    expect(viaResync).toEqual(viaDirect);
    // 이전 방식은 지운 종목의 이번 달 매수 4,000원이 매수 원인에 남았다
    expect(causes(fresh, r.legacy).buy - viaResync.buy).toBe(4000);
  });

  it("되돌리기: 종목과 정리된 거래가 함께 돌아온다", () => {
    const fresh = data([gone, keep], txs);
    const r = resyncSave(fresh, [row("005930", 1, 50_000, hint)], (sel) => sel.remove.add("g"));
    const entries = buildResyncUndoEntries(fresh, r.saved);
    const back = planUndo(entries, r.saved);
    const byId = <T extends { id: string }>(xs: T[]) => [...xs].sort((a, b) => a.id.localeCompare(b.id));
    expect(back.skipped).toBe(0);
    expect(byId(back.data.stocks)).toEqual(byId(fresh.stocks));
    expect(byId(back.data.transactions)).toEqual(byId(fresh.transactions));
  });

  it("지우는 종목이 없으면 거래 배열 참조 그대로", () => {
    const fresh = data([keep], txs.slice(2));
    const r = resyncSave(fresh, [row("005930", 2, 50_000, hint)]);
    expect(r.saved.transactions).toBe(fresh.transactions);
  });
});
