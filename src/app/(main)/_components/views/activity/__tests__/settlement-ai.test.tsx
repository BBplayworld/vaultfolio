// #54 결산 화면 AI 질문 버튼 노출 조건 — 비교 가능한 달만(첫 달·빈 상태·오류 없음)
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { AssetData, MonthlyAssetSnapshot } from "@/types/asset";

const h = vi.hoisted(() => ({ monthly: [] as unknown[], causesThrow: false, hasAssets: true }));

vi.mock("@/contexts/asset-data-context", () => ({
  useAssetData: () => ({
    assetData: {
      realEstate: [], stocks: [], crypto: [], loans: [], cash: h.hasAssets ? [{ id: "c" }] : [],
      transactions: [], cashTransactions: [], loanTransactions: [], cryptoTransactions: [], yearlyNetAssets: [],
      lastUpdated: "2026-10-01T00:00:00.000Z",
    } as unknown as AssetData,
    exchangeRates: { USD: 1400, JPY: 9 },
    getAssetSummary: () => ({ netAsset: 110_000_000, cashValue: 10_000_000, totalValue: 110_000_000 }),
    snapshotVersion: 0,
  }),
}));
vi.mock("@/lib/asset/snapshot-storage", () => ({ readMonthlySnapshots: () => h.monthly }));
vi.mock("@/lib/finance/profit-utils", () => ({ readExchangeHistory: () => ({}) }));
vi.mock("@/lib/asset/asset-refresh-status", () => ({ getStaleCategories: () => [], daysSinceRefresh: () => null }));
vi.mock("@/lib/report/asset-report", async (orig) => ({
  ...(await orig<typeof import("@/lib/report/asset-report")>()),
  buildLiveAttributionCurr: () => ({}),
}));
vi.mock("../change-hero", async (orig) => ({
  ...(await orig<typeof import("../change-hero")>()),
  computeSettlementCauses: () => {
    if (h.causesThrow) throw new Error("x");
    return { mapped: { causes: [{ key: "price", amount: 1_000_000, estimated: false }], deltaNet: 1_000_000, showUnrecordedHint: false }, estimatedLabel: "예측" };
  },
}));

import { SettlementView } from "../settlement-view";

const snap = (month: string, date: string, netAsset: number): MonthlyAssetSnapshot => ({ month, date, netAsset, financialAsset: netAsset });
const render = (initialMonth?: string) => renderToStaticMarkup(<SettlementView initialMonth={initialMonth} source="menu" />);

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-05T03:00:00Z")); // KST 11/5 → 10월 결산
  Object.assign(h, { monthly: [snap("2026-09", "2026-09-28", 100_000_000), snap("2026-10", "2026-10-28", 109_000_000)], causesThrow: false, hasAssets: true });
});
afterEach(() => vi.useRealTimers());

describe("settlement-ai-button 노출", () => {
  it("비교 가능한 달: 버튼 1개, 문구 N월, 원인 블록 다음·다음 달 준비 앞, 캡처 숨김 마커", () => {
    const html = render();
    expect(html.match(/data-testid="settlement-ai-button"/g)?.length).toBe(1);
    expect(html).toContain("AI에게 10월 변화 물어보기");
    const ai = html.indexOf("settlement-ai-button");
    expect(html.indexOf('data-testid="cause-block"')).toBeLessThan(ai);
    expect(ai).toBeLessThan(html.indexOf('id="settlement-prep"'));
    expect(html).toMatch(/data-testid="settlement-ai-button"[^>]*data-screenshot-hide/);
    expect(html).toContain("transition-[background-color,scale]");
  });
  it("첫 달: 없음", () => {
    h.monthly = [snap("2026-11", "2026-11-03", 100_000_000)];
    const html = render("2026-11");
    expect(html).toContain("settlement-first-month");
    expect(html).not.toContain("settlement-ai-button");
  });
  it("빈 상태(월 기록 0건·자산 0건): 없음", () => {
    h.monthly = [];
    expect(render()).not.toContain("settlement-ai-button");
    h.monthly = [snap("2026-09", "2026-09-28", 1), snap("2026-10", "2026-10-28", 2)]; h.hasAssets = false;
    const html = render();
    expect(html).toContain("settlement-empty");
    expect(html).not.toContain("settlement-ai-button");
  });
  it("계산 오류: 없음", () => {
    h.causesThrow = true;
    const html = render();
    expect(html).toContain("settlement-error");
    expect(html).not.toContain("settlement-ai-button");
  });
});
