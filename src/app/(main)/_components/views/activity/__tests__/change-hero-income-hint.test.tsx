// 5.152 C′: 월 탭 순유입 도움말이 computeSettlementCauses가 쓴 cashTracked를 따른다(세 갈래) — 판정 함수를 따로 부르지 않는다
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";
import { CauseBlock, computeSettlementCauses } from "../change-hero";
import type { AssetData, MonthlyAssetSnapshot } from "@/types/asset";

// 팝오버는 닫혀 있으면 렌더되지 않으므로 summary를 그대로 노출
vi.mock("../../../layout/ui/info-hint", () => ({ InfoHint: ({ summary }: { summary: ReactNode }) => <span data-hint>{summary}</span> }));

const RATES = { USD: 1400, JPY: 900 };
const TRACKED = "입금에서 출금을 뺀 금액이에요";
const UNTRACKED = "입출금 기록이 없어 사고판 금액의 차이로 계산했어요";
const data = (): AssetData => ({
  realEstate: [], stocks: [], crypto: [], cash: [], loans: [],
  yearlyNetAssets: [], transactions: [], cashTransactions: [], loanTransactions: [], cryptoTransactions: [],
  lastUpdated: "2026-01-01T00:00:00.000Z", nickname: "",
});
const snap = (month: string, date: string, o: { cash: number; stock: number }): MonthlyAssetSnapshot => ({
  month, date, netAsset: o.cash + o.stock, financialAsset: o.cash + o.stock,
  breakdown: { realEstate: 0, stocks: o.stock, crypto: 0, cash: o.cash, loans: 0, tenantDeposit: 0 },
  fx: { ...RATES }, fxBase: { USD: 0, JPY: 0 },
  cost: { total: o.cash + o.stock, stock: o.stock, crypto: 0, realEstate: 0 },
});
const buy = (createdAt: string) =>
  ({ id: "b", stockId: "s", ticker: "005930", stockName: "삼성전자", type: "buy", quantity: 1, price: 5_000_000, currency: "KRW", date: "2026-10-10", reflected: true, createdAt }) as AssetData["transactions"][number];
const LIVE = { date: "2026-10-28", _date: "2026-10-28", _display: "2026-10-28", netAsset: 0, financialAsset: 0 } as unknown as Parameters<typeof computeSettlementCauses>[0]["live"];
const run = (d: AssetData, start: MonthlyAssetSnapshot, end: MonthlyAssetSnapshot) =>
  computeSettlementCauses({ start, end, live: LIVE, deltaNet: end.netAsset - start.netAsset, startDate: start.date!, endDate: end.date!, liveCash: 0, exchangeHistory: {}, assetData: d, rates: RATES });
const html = (r: ReturnType<typeof run>) => renderToStaticMarkup(<CauseBlock scope="month" mapped={r.mapped} estimatedLabel={r.estimatedLabel} cashTracked={r.cashTracked} />);
const plain = (r: ReturnType<typeof run>) => renderToStaticMarkup(<CauseBlock scope="month" mapped={r.mapped} estimatedLabel={r.estimatedLabel} />);
const S = "2026-09-30", E = "2026-10-28";

describe("월 탭 순유입 도움말 2갈래(5.152 C′)", () => {
  it("① 주식만 기록(현금 0·입출금 0) → 사고판 금액 문장", () => {
    const d = data();
    d.transactions = [buy("2026-10-10T00:00:00.000Z")];
    const r = run(d, snap("2026-09", S, { cash: 0, stock: 20_000_000 }), snap("2026-10", E, { cash: 0, stock: 25_000_000 }));
    expect(r.cashTracked).toBe(false);
    expect(r.mapped.causes.find((c) => c.key === "income")?.amount).toBe(5_000_000);
    const h = html(r);
    expect(h).toContain(UNTRACKED);
    expect(h).not.toContain(TRACKED);
  });
  it("② 입출금 기록 있음 → 현행 문장", () => {
    const d = data();
    d.cashTransactions = [{ id: "d", cashId: "c", date: "2026-10-05", type: "deposit", amount: 5_000_000, currency: "KRW", reflected: true } as AssetData["cashTransactions"][number]];
    const r = run(d, snap("2026-09", S, { cash: 0, stock: 20_000_000 }), snap("2026-10", E, { cash: 5_000_000, stock: 20_000_000 }));
    expect(r.cashTracked).toBe(true);
    const h = html(r);
    expect(h).toContain(TRACKED);
    expect(h).not.toContain(UNTRACKED);
  });
  it("③ #250 ⑯ 소급: 구간 도중 현금을 처음 등록, 그 전에 입력한 매매만 → 사고판 금액 문장", () => {
    const d = data();
    d.cash = [{ id: "cash_1792000000000", name: "현금", amount: 3_000_000, currency: "KRW" } as unknown as AssetData["cash"][number]];
    d.transactions = [buy("2026-10-10T00:00:00.000Z")]; // 현금 id 시각(2026-10-14)보다 먼저 입력한 매매
    const r = run(d, snap("2026-09", S, { cash: 0, stock: 20_000_000 }), snap("2026-10", E, { cash: 3_000_000, stock: 25_000_000 }));
    expect(r.cashTracked).toBe(false);
    const h = html(r);
    expect(h).toContain(UNTRACKED);
    expect(h).not.toContain(TRACKED);
  });
  it("cashTracked를 넘기지 않으면(주 탭·기존) 현행 문장, 합계·행은 같다", () => {
    const d = data();
    d.transactions = [buy("2026-10-10T00:00:00.000Z")];
    const r = run(d, snap("2026-09", S, { cash: 0, stock: 20_000_000 }), snap("2026-10", E, { cash: 0, stock: 25_000_000 }));
    expect(plain(r)).toContain(TRACKED);
    const strip = (s: string) => s.replace(/<span data-hint[^>]*>[^<]*<\/span>/g, "");
    expect(strip(html(r))).toBe(strip(plain(r)));
  });
});
