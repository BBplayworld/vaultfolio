// #310(5.156) 맞추기 저장 계획 — ① 결함: 체크 삭제 종목의 거래가 고아로 남던 문제(직접 삭제 planDeleteStocks 규칙과 일치)
// ② 증권사 이관(이어받기·합치기)의 결산 원인·세금·백업·되돌리기 불변. 순수 함수만 쓴다(저장·React 0).
import { describe, expect, it } from "vitest";
import { computeAssetCost, planDeleteStocks } from "@/contexts/asset-data-context";
import { computeAttributionBetween } from "../asset-report";
import { computeSettlementCauses } from "@/app/(main)/_components/views/activity/change-hero";
import { applyResync, buildResyncUndoEntries, computeDiff, defaultRemoveIds, mergeScreens, planResyncSave, planUndo, resolveScreens, type ResyncSelection } from "@/lib/asset/resync";
import { emptySel, row, screen, st } from "@/lib/asset/resync/__tests__/fixtures";
import { computeForeignRealizedGain, getYearEndTaxSimulation } from "@/lib/tax-utils";
import type { AssetData, MonthlyAssetSnapshot, Stock } from "@/types/asset";

const RATES = { USD: 1400, JPY: 900 };
const START = "2026-09-30";
const END = "2026-11-08";
const CASH = 0; // 스냅샷 현금 = assetData 현금(빈 배열)과 맞춘다 — 어긋나면 원인 매핑에 가짜 '기록 안 된 변화'가 생긴다

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

describe("#310 증권사 이관 — 합치기(대표 사례: A·B 모두 저장 → B 화면으로 맞추기 → 카드 체크)", () => {
  const A = st("a", "005930", "domestic", "미래에셋증권", 10, 60_000, { purchaseDate: "2024-05-01", currentPrice: 70_000 });
  const B = st("b", "005930", "domestic", "토스증권", 10, 60_000, { purchaseDate: "2026-06-01", currentPrice: 70_000 });
  const txs = [tx("t1", "a", "buy", 6, 55_000, "2024-05-01"), tx("t2", "a", "buy", 4, 66_000, "2026-09-10"), tx("t3", "b", "buy", 1, 70_000, "2026-11-02")];
  const loan = { id: "l1", type: "mortgage-stock", name: "담보", balance: 1_000_000, interestRate: 5, startDate: "2025-01-01", linkedStockId: "a" } as unknown as AssetData["loans"][number];
  const other = { ...loan, id: "l2", linkedStockId: "b" };
  const fresh = () => data([A, B], txs, { loans: [loan, other] });
  const screenRow = [row("005930", 10, 60_000, hint)];
  const check = (sel: ResyncSelection) => { sel.transfer = new Set(["a"]); };

  it("체크 → A 삭제·거래와 대출 연결 B로·B 매수일 = 이른 날, 수량·평단은 화면 값, 고아 0", () => {
    const f = fresh();
    const r = resyncSave(f, screenRow, check);
    expect(r.saved.stocks.map((s) => s.id)).toEqual(["b"]);
    expect(r.saved.stocks[0]).toMatchObject({ quantity: 10, averagePrice: 60_000, broker: "토스증권", purchaseDate: "2024-05-01" });
    expect(r.saved.transactions.map((t) => [t.id, t.stockId])).toEqual([["t1", "b"], ["t2", "b"], ["t3", "b"]]);
    // 재작성 필드는 stockId뿐
    r.saved.transactions.forEach((t, i) => expect({ ...t, stockId: txs[i].stockId }).toEqual(txs[i]));
    expect(r.saved.transactions[2]).toBe(txs[2]);
    expect(r.saved.loans.map((l) => l.linkedStockId)).toEqual(["b", "b"]);
    expect(r.saved.loans[1]).toBe(other);
    expect(orphans(r.saved)).toBe(0);
    expect(r.result.counts).toMatchObject({ change: 1, remove: 0, add: 0 });
    expect(r.plan).toMatchObject({ moved: 1, movedTx: 2 });
  });

  it("결산·홈 원인: 순자산 차이 = −A 평가액, '기록 안 된 변화' 0, 매수+매도 = 원가 차이", () => {
    const f = fresh();
    const r = resyncSave(f, screenRow, check);
    const c = causes(f, r.saved);
    expect(c.deltaNet).toBe(-10 * 70_000);
    expect(c.unrecorded).toBe(0);
    expect(c.buy + c.sell).toBe(c.dCost);
  });

  it("이관 전 닫힌 달(9월) 원인 금액은 이관 전후 같다", () => {
    const f = fresh();
    const r = resyncSave(f, screenRow, check);
    const s8 = snap(data([{ ...A, quantity: 6 }, B]), "2026-08", "2026-08-31");
    const s9 = snap(f, "2026-09", "2026-09-30");
    const eff = (d: AssetData) => computeAttributionBetween(s8, s9, {}, d, RATES, false)!.effects;
    expect(eff(r.saved)).toEqual(eff(f));
  });

  it("미체크 = v5.152와 같은 결과(stocks·transactions·loans)", () => {
    const f = fresh();
    const r = resyncSave(f, screenRow);
    expect(r.saved.stocks).toEqual(f.stocks);
    expect(r.saved.transactions).toBe(f.transactions);
    expect(r.saved.loans).toBe(f.loans);
    expect(r.plan).toMatchObject({ moved: 0, movedTx: 0 });
    expect(r.result.transfers).toEqual([]);
  });

  it("되돌리기 왕복: 세 컬렉션 레코드가 적용 전과 같다", () => {
    const f = fresh();
    const r = resyncSave(f, screenRow, check);
    const back = planUndo(buildResyncUndoEntries(f, r.saved), r.saved);
    const byId = <T extends { id: string }>(xs: T[]) => [...xs].sort((a, b) => a.id.localeCompare(b.id));
    expect(back.skipped).toBe(0);
    expect(byId(back.data.stocks)).toEqual(byId(f.stocks));
    expect(byId(back.data.transactions)).toEqual(byId(f.transactions));
    expect(byId(back.data.loans)).toEqual(byId(f.loans));
  });

  it("이관 뒤 B를 직접 고치고 되돌리기: B는 건너뛰고 A·거래는 돌아와 고아 0", () => {
    const f = fresh();
    const r = resyncSave(f, screenRow, check);
    const edited = { ...r.saved, stocks: r.saved.stocks.map((s) => ({ ...s, quantity: 11 })) };
    const back = planUndo(buildResyncUndoEntries(f, r.saved), edited);
    expect(back.skipped).toBe(1);
    expect(back.data.stocks.find((s) => s.id === "b")!.quantity).toBe(11);
    expect(back.data.stocks.some((s) => s.id === "a")).toBe(true);
    expect(back.data.transactions.filter((t) => t.stockId === "a").map((t) => t.id)).toEqual(["t1", "t2"]);
    expect(orphans(back.data)).toBe(0);
  });

  it("멱등: 저장본으로 같은 화면을 다시 맞추면 후보 0·재작성 0", () => {
    const r1 = resyncSave(fresh(), screenRow, check);
    const r2 = resyncSave(r1.saved, screenRow, check);
    expect(r2.result.transfers).toEqual([]);
    expect(r2.saved.transactions).toBe(r1.saved.transactions);
    expect(r2.saved.loans).toBe(r1.saved.loans);
  });

  it("세금: 해외 종목 합치기 전후 실현손익 동일", () => {
    const fa = st("fa", "AAPL", "foreign", "미래에셋증권", 5, 100, { purchaseExchangeRate: 1300 });
    const fb = st("fb", "AAPL", "foreign", "토스증권", 5, 100, { purchaseExchangeRate: 1300 });
    const ftx = [tx("b1", "fa", "buy", 10, 100, "2026-02-01", "USD", 1300), tx("s1", "fa", "sell", 5, 150, "2026-03-01", "USD", 1350)];
    const f = data([fa, fb], ftx);
    const r = resyncSave(f, [row("AAPL", 5, 100, hint)], (sel) => { sel.transfer = new Set(["fa"]); });
    expect(r.saved.stocks.map((s) => s.id)).toEqual(["fb"]);
    const before = computeForeignRealizedGain(f, 2026, RATES);
    expect(before).not.toBeNull();
    expect(computeForeignRealizedGain(r.saved, 2026, RATES)).toEqual(before);
    expect(getYearEndTaxSimulation(r.saved, 2026, RATES).baselineGainKrw).toBe(getYearEndTaxSimulation(f, 2026, RATES).baselineGainKrw);
  });
});

describe("#310 증권사 이관 — 이어받기(B 행이 추가)", () => {
  const A = st("a", "005930", "domestic", "미래에셋증권", 10, 60_000, { purchaseDate: "2024-05-01" });
  const K = st("k", "000660", "domestic", "토스증권", 1, 100_000);
  const txs = [tx("t1", "a", "buy", 10, 60_000, "2024-05-01")];
  const loan = { id: "l1", type: "mortgage-stock", name: "담보", balance: 1, interestRate: 5, startDate: "2025-01-01", linkedStockId: "a" } as unknown as AssetData["loans"][number];
  const items = [row("005930", 10, 60_000, hint), row("000660", 1, 100_000, hint)];

  it("체크 → A id 생존·broker=B·매수일 그대로, 거래·대출 diff 0, 추가 0·변경 1", () => {
    const f = data([A, K], txs, { loans: [loan] });
    const r = resyncSave(f, items, (sel) => { sel.transfer = new Set(["a"]); });
    const a = r.saved.stocks.find((s) => s.id === "a")!;
    expect(r.saved.stocks.map((s) => s.id)).toEqual(["a", "k"]);
    expect(a).toMatchObject({ broker: "토스증권", category: "domestic", purchaseDate: "2024-05-01", description: A.description });
    expect(r.saved.transactions).toBe(f.transactions);
    expect(r.saved.loans).toBe(f.loans);
    expect(r.result.counts).toMatchObject({ add: 0, change: 1, remove: 0 });
    expect(r.result.transfers).toEqual([{ fromId: "a", toId: "a", path: "inherit" }]);
    expect(r.plan).toMatchObject({ moved: 1, movedTx: 1 });
    expect(causes(f, r.saved).unrecorded).toBe(0);
  });

  it("미체크 = 새 종목 추가(v5.152 동작), A는 유지", () => {
    const f = data([A, K], txs);
    const r = resyncSave(f, items);
    expect(r.result.counts).toMatchObject({ add: 1, remove: 0 });
    expect(r.saved.stocks.some((s) => s.id === "a" && s.broker === "미래에셋증권")).toBe(true);
    expect(r.saved.transactions).toBe(f.transactions);
  });

  it("체크한 쌍은 순위로 고르지 않고 A로 고정 — 다른 장에서 같은 티커를 함께 지워도 그 종목을 잇지 않는다", () => {
    const S = st("s", "005930", "domestic", "삼성증권", 3, 60_000, { purchaseDate: "2020-01-01" });
    const S2 = st("s2", "035420", "domestic", "삼성증권", 1, 200_000);
    const sTx = [tx("u1", "s", "buy", 3, 60_000, "2020-01-01")];
    const f = data([A, K, S, S2], [...txs, ...sTx]);
    const screens = [screen(0, items), screen(1, [row("035420", 1, 200_000, { brokerHint: "삼성증권" })])];
    const run = (transfer: boolean) => {
      const resolved = resolveScreens(screens, f.stocks, { usdRate: RATES.USD });
      const diff = computeDiff(f.stocks, mergeScreens(resolved), resolved);
      const sel: ResyncSelection = { ...emptySel(), remove: new Set([...defaultRemoveIds(diff), "s"]), ...(transfer ? { transfer: new Set(["a"]) } : {}) };
      const result = applyResync(f.stocks, diff, sel, { today: END, usdRate: RATES.USD, now: 1 });
      return planResyncSave(f, result, del).data;
    };
    // 기존 동작(카드 미체크): 지우는 S를 순위로 이어받는다
    expect(run(false).stocks.find((s) => s.ticker === "005930" && s.broker === "토스증권")!.id).toBe("s");
    const saved = run(true);
    expect(saved.stocks.find((s) => s.ticker === "005930")!.id).toBe("a");
    expect(saved.stocks.map((s) => s.id).sort()).toEqual(["a", "k", "s2"]);
    expect(saved.transactions.map((t) => t.id)).toEqual(["t1"]); // S의 거래는 직접 삭제 규칙으로 정리
    expect(orphans(saved)).toBe(0);
  });
});
