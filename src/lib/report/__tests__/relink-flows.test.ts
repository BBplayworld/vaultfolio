// #147(4.77) 끊긴 거래 다시 잇기 — 결산 원인 분해·순자산 합계 불변 + '처음부터 끊기지 않은 대조 픽스처'와 동일 확인(spec 10-4).
import { describe, expect, it } from "vitest";
import { computeAssetCost } from "@/contexts/asset-data-context";
import { computeAttributionBetween } from "../asset-report";
import { computeSettlementCauses } from "@/app/(main)/_components/views/activity/change-hero";
import { computeForeignRealizedGain } from "@/lib/tax-utils";
import { applyRelink, detectRelink } from "@/lib/asset/resync";
import { st } from "@/lib/asset/resync/__tests__/fixtures";
import type { AssetData, MonthlyAssetSnapshot, Stock } from "@/types/asset";

const RATES = { USD: 1400, JPY: 900 };
const START = "2026-09-30";
const END = "2026-11-08";
const CASH = 1_000_000;
const MS = Date.parse("2026-10-20T03:00:00Z"); // 만든 날 2026-10-20

const data = (stocks: Stock[], transactions: AssetData["transactions"] = []): AssetData => ({
  realEstate: [], stocks, crypto: [], cash: [], loans: [], yearlyNetAssets: [], transactions, cashTransactions: [], loanTransactions: [], cryptoTransactions: [],
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
const tx = (id: string, stockId: string, type: "buy" | "sell", quantity: number, price: number, date: string, ticker = "AAPL") =>
  ({ id, stockId, ticker, stockName: ticker, type, quantity, price, currency: "USD", exchangeRate: 1300, date, reflected: true, createdAt: `${date}T00:00:00Z` }) as AssetData["transactions"][number];

// 기존 종목 K(이은 종목 없음) + 끊긴 S(애플, 현재 7주 = 옛 매수 10 − 매도 3)
const K = st("k", "005930", "domestic", "토스증권", 10, 100_000, { purchaseDate: "2024-01-02" });
const S: Stock = { ...st(`stock_import_${MS}_0`, "AAPL", "foreign", "토스증권", 7, 150, { purchaseExchangeRate: 1380, description: "" }), purchaseDate: "2026-10-20" };
const ORPHANS = [tx("t1", "stock_old_1", "buy", 10, 140, "2025-02-03"), tx("t2", "stock_old_2", "sell", 3, 160, "2026-03-04"), tx("tk", "k", "buy", 10, 100_000, "2024-01-02", "005930")];
const before = data([K, S], ORPHANS);

// 대조: 처음부터 끊기지 않은 상태(후보 거래가 처음부터 S.id, 매수일 = 새 매수일)
const control = data(
  [K, { ...S, purchaseDate: "2025-02-03" }],
  ORPHANS.map((t) => (t.stockId.startsWith("stock_old") ? { ...t, stockId: S.id } : t)),
);

const relinked = () => {
  const rows = detectRelink(before);
  return applyRelink(before, Object.fromEntries(rows.map((r) => [r.rowId, r.targets[0].id]))).data;
};

function causes(d: AssetData, from: [string, string], to: [string, string]) {
  const prev = snap(data([K]), from[0], from[1]);
  const curr = snap(d, to[0], to[1]);
  const attr = computeAttributionBetween(prev, curr, {}, d, RATES, false)!;
  const live = { date: to[1], _date: to[1], _display: to[1], netAsset: 0, financialAsset: 0 } as unknown as Parameters<typeof computeSettlementCauses>[0]["live"];
  const deltaNet = curr.netAsset - prev.netAsset;
  const { mapped } = computeSettlementCauses({ start: prev, end: curr, live, deltaNet, startDate: from[1], endDate: to[1], liveCash: 0, exchangeHistory: {}, assetData: d, rates: RATES });
  const total = mapped.causes.reduce((s, c) => s + c.amount, 0);
  return { effects: attr.effects, deltaNet, total, causes: mapped.causes };
}

const INTERVALS: [string, [string, string], [string, string]][] = [
  ["이번 달 예측", ["2026-09", START], ["2026-11", END]],
  ["연 예측", ["2025-12", "2025-12-31"], ["2026-11", END]],
  ["이은 거래가 든 구간(2026-03)", ["2026-02", "2026-02-28"], ["2026-03", "2026-03-31"]],
  ["옛 매수가 든 구간(2025-02)", ["2025-01", "2025-01-31"], ["2025-02", "2025-02-28"]],
];

describe("결산 — 순자산 증감 합계 불변(spec 10-4 FAIL 기준)", () => {
  it.each(INTERVALS)("%s: 이은 뒤에도 순자산 증감·원인 합계가 main과 같다", (_n, from, to) => {
    const a = causes(before, from, to);
    const b = causes(relinked(), from, to);
    expect(b.deltaNet).toBe(a.deltaNet);
    expect(b.total).toBeCloseTo(a.total, 6); // 원인 합계 = 순자산 증감(항등식 유지)
    expect(b.total).toBeCloseTo(b.deltaNet, 6);
  });
});

describe("결산 — 처음부터 끊기지 않은 대조 픽스처와 같은 값(허용 기준)", () => {
  it("이은 결과 데이터 = 대조 데이터(거래·종목 deep equal), 그러므로 모든 구간 원인이 대조와 같다", () => {
    const r = relinked();
    expect(r.stocks).toEqual(control.stocks);
    expect(r.transactions).toEqual(control.transactions);
    for (const [, from, to] of INTERVALS) {
      expect(causes(r, from, to).causes).toEqual(causes(control, from, to).causes);
      expect(causes(r, from, to).effects).toEqual(causes(control, from, to).effects);
    }
  });
  it("이은 종목이 없는 자산(K)의 거래·종목은 한 글자도 바뀌지 않는다 — 이은 종목이 없는 구간(옛 매수 이전) 원인 분해 diff 0", () => {
    const r = relinked();
    expect(r.stocks[0]).toBe(before.stocks[0]);
    expect(r.transactions.find((t) => t.id === "tk")).toBe(before.transactions.find((t) => t.id === "tk"));
    // S 자체가 아직 없던 구간(2024-02): 기존과 같은 원인
    const a = causes(before, ["2024-01", "2024-01-31"], ["2024-02", "2024-02-29"]);
    const b = causes(r, ["2024-01", "2024-01-31"], ["2024-02", "2024-02-29"]);
    expect(b.causes).toEqual(a.causes);
  });
});

describe("해외 양도세·실현손익 — 이은 매도만 변화, 상한 내", () => {
  it("올해 이은 매도는 S 평단 기준으로 계산되고(과대 폴백 해소), 이은 매도 체결액 이하", () => {
    const sellProceeds = 3 * 160 * RATES.USD;
    const a = computeForeignRealizedGain(before, 2026, RATES);
    const b = computeForeignRealizedGain(relinked(), 2026, RATES);
    // 이으면 옛 매수(10주 @140, 환율 1300)가 S 거래로 붙어 매도 손익 = (160−140)×3×체결 환율 — 이전에는 매수 기록이 없어 폴백(estimated)
    expect(a?.gainKrw).toBeDefined();
    expect(b?.gainKrw).toBe(20 * 3 * 1300);
    expect(Math.abs((b?.gainKrw ?? 0) - (a?.gainKrw ?? 0))).toBeLessThanOrEqual(sellProceeds);
    expect(b?.estimated).toBe(false);
    // 대조와 같은 값
    expect(b).toEqual(computeForeignRealizedGain(control, 2026, RATES));
  });
});
