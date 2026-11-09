// 월별 기록(#127, 4.67) — 결산 화면 진입 행 노출 조건·위치·문구, 표 렌더(의미 요소·부호·— 칸·기록 없음 줄), 읽기 전용
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
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
import { MonthlyLogTable, MONTHLY_LOG_CAPTION } from "../monthly-log-sheet";
import { buildMonthlyLog } from "@/lib/report/monthly-log";

const snap = (month: string, date: string, netAsset: number): MonthlyAssetSnapshot => ({ month, date, netAsset, financialAsset: netAsset });
const render = (initialMonth?: string) => renderToStaticMarkup(<SettlementView initialMonth={initialMonth} source="menu" />);

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-05T03:00:00Z")); // KST 11/5
  Object.assign(h, { monthly: [snap("2026-09", "2026-09-28", 100_000_000), snap("2026-10", "2026-10-28", 109_000_000)], causesThrow: false, hasAssets: true });
});
afterEach(() => vi.useRealTimers());

describe("진입 행 monthly-log-button", () => {
  it("기록된 달 3개: 행 1개, 보조 줄 '9월~11월 · 3개월 기록', 원인 블록 뒤·AI 질문 행 앞, 캡처 숨김·dialog 표시", () => {
    const html = render();
    expect(html.match(/data-testid="monthly-log-button"/g)?.length).toBe(1);
    expect(html).toContain("9월~11월 · 3개월 기록");
    const row = html.indexOf('data-testid="monthly-log-button"');
    expect(html.indexOf('data-testid="cause-block"')).toBeLessThan(row);
    expect(row).toBeLessThan(html.indexOf('data-testid="settlement-ai-button"'));
    expect(html).toMatch(/data-testid="monthly-log-button"[^>]*data-screenshot-hide[^>]*aria-haspopup="dialog"/);
    // 시트는 닫힌 상태로 렌더되지 않는다(열 때만)
    expect(html).not.toContain("monthly-log-sheet");
  });
  it("선택 달을 바꿔도 보조 줄이 같다", () => {
    expect(render("2026-10")).toContain("9월~11월 · 3개월 기록");
    expect(render("2026-11")).toContain("9월~11월 · 3개월 기록");
  });
  it("기록된 달 2개(지난 달 1 + 진행 중): 행 있음", () => {
    h.monthly = [snap("2026-10", "2026-10-28", 1)];
    expect(render("2026-11")).toContain("10월~11월 · 2개월 기록");
  });
  it("첫 달 화면: 없음", () => {
    h.monthly = [snap("2026-10", "2026-10-28", 1)];
    const html = render("2026-10");
    expect(html).toContain("settlement-first-month");
    expect(html).not.toContain("monthly-log-button");
  });
  it("기록된 달 1개(이번 달만): 없음", () => {
    h.monthly = [snap("2026-11", "2026-11-03", 1)];
    expect(render("2026-11")).not.toContain("monthly-log-button");
  });
  it("빈 상태(스냅샷 0·자산 0)·계산 오류: 없음", () => {
    h.monthly = [];
    expect(render()).not.toContain("monthly-log-button");
    h.monthly = [snap("2026-09", "2026-09-28", 1), snap("2026-10", "2026-10-28", 2)]; h.hasAssets = false;
    expect(render()).not.toContain("monthly-log-button");
    h.hasAssets = true; h.causesThrow = true;
    expect(render()).not.toContain("monthly-log-button");
  });
  it("행은 brand 채움 버튼이 아니다(채움 버튼은 캘린더 추가 1개)", () => {
    const html = render();
    expect(html.match(/data-testid="prep-ics-button"/g)?.length).toBe(1);
    const btn = html.slice(html.indexOf('data-testid="monthly-log-button"') - 400, html.indexOf('data-testid="monthly-log-button"') + 600);
    expect(btn).not.toMatch(/bg-brand|bg-primary /);
  });
});

describe("표 MonthlyLogTable", () => {
  const TODAY = "2026-11-05";
  const monthly: MonthlyAssetSnapshot[] = [
    { month: "2026-07", netAsset: 300_000_000, financialAsset: 0 }, // 레거시(date·breakdown 없음)
    { month: "2026-08", date: "2026-08-28", netAsset: 410_000_000, financialAsset: 0,
      breakdown: { realEstate: 600_000_000, stocks: 30_000_000, crypto: 0, cash: 5_000, loans: 220_005_000, tenantDeposit: 0 } },
    { month: "2026-10", date: "2026-10-28", netAsset: 420_000_000, financialAsset: 0,
      breakdown: { realEstate: 600_000_000, stocks: 40_000_000, crypto: 0, cash: 0, loans: 220_000_000, tenantDeposit: 0 } },
  ];
  const live = { breakdown: { realEstate: 600_000_000, stocks: 45_000_000, crypto: 0, cash: 0, loans: 219_000_000, tenantDeposit: 0, physical: 0 }, netAsset: 426_000_000 };
  const html = renderToStaticMarkup(<MonthlyLogTable log={buildMonthlyLog(monthly, TODAY, live)} today={TODAY} />);

  it("실제 표 의미 요소: sr-only caption, 머리 th[scope=col], 월 th[scope=row]", () => {
    expect(html).toContain('<caption class="sr-only">월별 자산군 금액</caption>');
    expect(html.match(/scope="col"/g)?.length).toBe(2 + 4); // 월·순자산 + 부동산·주식·현금성·대출
    expect(html.match(/scope="row"/g)?.length).toBe(5); // 11·10·9(기록 없음)·8·7월
    expect(html).toContain('data-testid="monthly-log-table"');
    expect(html).toMatch(/data-testid="monthly-log-table"[^>]*tabindex="0"/i);
  });
  it("최신순, 이번 달 '진행 중'·'오늘', 레거시 '2026-07 기록'", () => {
    const order = ["2026-11", "2026-10", "2026-09", "2026-08", "2026-07"].map((m) => html.indexOf(`monthly-log-row-${m}"`));
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(html).toMatch(/monthly-log-row-2026-11" data-kind="full" data-current=""/);
    expect(html).toContain("진행 중");
    expect(html).toContain("오늘");
    expect(html).toContain("2026-07 기록");
    expect(html).toContain("10/28");
  });
  it("기록 없음 줄은 한 칸(colSpan = 자산군 수 + 1), 레거시 줄 자산군 칸은 — + aria-label", () => {
    expect(html).toMatch(/monthly-log-row-2026-09" data-kind="gap"/);
    expect(html).toMatch(/colSpan="5"[^>]*>.*기록 없음/i);
    expect(html).toMatch(/monthly-log-row-2026-07" data-kind="net-only"/);
    expect(html).toMatch(/data-testid="monthly-log-cell-2026-07-stocks" aria-label="종류별 기록 없음"[^>]*>—</);
    expect(html).toContain('data-testid="monthly-log-cell-2026-07-netAsset"');
  });
  it("부채는 U+2212, 0은 '0원', 짧은/원 단위 두 표기, 하이픈 부호 없음", () => {
    expect(html).toContain("−2.2억"); // 대출 short
    expect(html).toContain("−220,000,000원"); // 대출 full
    expect(html).toContain("5,000원"); // 1만원 미만은 '원' 유지
    expect(html).toMatch(/monthly-log-cell-2026-10-cash"[^>]*><span class="sm:hidden">0원<\/span>/);
    expect(html).not.toMatch(/>-\d/);
  });
  it("증감·%·비중 열·손익 색 없음, 누를 요소 없음", () => {
    expect(html).not.toMatch(/%|전월|증감|비중/);
    expect(html).not.toMatch(/text-(red|blue|rose|sky|emerald)-/);
    expect(html).not.toMatch(/<button|<a |onClick/);
  });
});

describe("문구·데이터 안전", () => {
  const files = [
    readFileSync("src/lib/report/monthly-log.ts", "utf8"),
    readFileSync("src/app/(main)/_components/views/activity/monthly-log-sheet.tsx", "utf8"),
  ];
  it("'월말' 0건, 캡션 문구 고정, GA title", () => {
    for (const f of files) expect(f).not.toContain("월말");
    expect(MONTHLY_LOG_CAPTION).toBe("그 달 마지막으로 앱을 연 날, 그때까지 맞춘 값이에요");
    expect(readFileSync("src/lib/analytics/ga.ts", "utf8")).toContain('"activity:change:monthly-log": "성과·자산 변화·월별 기록"');
  });
  it("저장·서버 전송 코드 0(localStorage·fetch·save·sync·clipboard·share 없음)", () => {
    for (const f of files) expect(f).not.toMatch(/localStorage|setItem|fetch\(|save[A-Z]|sync|clipboard|navigator\.share/i);
  });
});
