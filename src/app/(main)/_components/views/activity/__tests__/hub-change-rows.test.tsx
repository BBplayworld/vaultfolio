// 4.83 성과 허브 `자산 변화` 카드 안 행 3개 — C76 기본 경로: 주 탭 D(7·8·9 / 10·14 / 15 / 기록 없음)마다 행 1 = 주 탭 Hero(같은 훅·같은 값),
// 행 2 N = 월별 기록 카드 행 수(C84), 행 3 = 시장과 비교 1주 지수 문자열. 중첩 인터랙티브 0(KpiCard rows).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { Wallet } from "lucide-react";
import type { MonthlyAssetSnapshot, Stock } from "@/types/asset";
import type { MarketIndexResponse } from "@/app/api/finance/market-index/route";
import { computeIndexSpan, formatCompareRate, type PeriodRefs } from "@/lib/finance/market-compare";
import { buildMonthlyLog, monthlyLogEntryCount } from "@/lib/report/monthly-log";
import { NOW_ISO, RICH_STEPS, buildScenario, type Scenario } from "./week-fixtures";

const h = vi.hoisted(() => ({
  sc: null as null | Scenario,
  navigate: vi.fn(),
  peer: null as null | ReadonlySet<string>,
  idx: {} as unknown,
}));
vi.mock("@/contexts/asset-data-context", async (orig) => ({
  ...(await orig<typeof import("@/contexts/asset-data-context")>()),
  useAssetData: () => ({
    assetData: h.sc!.assetData, exchangeRates: h.sc!.rates, snapshotVersion: 1, previousVisitDate: null, getAssetSummary: () => h.sc!.summary,
  }),
}));
vi.mock("@/lib/asset/snapshot-storage", async (orig) => ({
  ...(await orig<typeof import("@/lib/asset/snapshot-storage")>()),
  readDailySnapshots: () => h.sc!.daily,
  readMonthlySnapshots: () => h.sc!.monthly,
}));
vi.mock("@/lib/finance/profit-utils", async (orig) => ({
  ...(await orig<typeof import("@/lib/finance/profit-utils")>()),
  readExchangeHistory: () => h.sc!.exchangeHistory,
}));
vi.mock("@/app/(main)/_components/layout/navigation/navigation-context", async (orig) => ({
  ...(await orig<typeof import("@/app/(main)/_components/layout/navigation/navigation-context")>()),
  useAssetNavigation: () => ({ navigate: h.navigate }),
}));
vi.mock("@/hooks/use-market-compare", () => ({
  useCompareBasis: () => ({ basis: "sameBusinessDay", hydrated: true }),
  useDailyRefToken: () => "t",
  useKospiPeerCodes: () => h.peer,
  useMarketIndexRefs: () => h.idx,
}));

import { WeekList } from "../asset-change-view";
import { HubChangeRows } from "../hub-change-rows";
import { KpiCard } from "../../../layout/ui/kpi-card";

const IDX: PeriodRefs<MarketIndexResponse> = {
  daily: { KOSPI: { refPrice: 101, refDate: "2026-11-09", prevPrice: 100, prevDate: "2026-11-06" }, SPX: { refPrice: 7550, refDate: "2026-11-09", prevPrice: 7377, prevDate: "2026-11-06" } },
  weekly: { KOSPI: { refPrice: 99.8, refDate: "2026-11-03" }, SPX: { refPrice: 7569, refDate: "2026-11-03" } },
};
const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
// data-testid 요소 안 첫 텍스트(다음 태그 전까지) / 시장 값은 중첩 span이라 chevron(svg) 전까지
const own = (html: string, id: string) => html.match(new RegExp(`data-testid="${id}"[^>]*>([^<]*)`))![1];
const upToSvg = (html: string, id: string) => text(html.slice(html.indexOf(`data-testid="${id}"`)).split("<svg")[0]);
const attr = (html: string, testId: string, name: string) => html.match(new RegExp(`data-testid="${testId}"[^>]*?${name}="([^"]*)"`))?.[1];

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(NOW_ISO));
  h.navigate.mockClear();
  h.peer = new Set(["005930"]);
  h.idx = IDX;
});
afterEach(() => vi.useRealTimers());

describe("행 1 = 주 탭 Hero (C76 D 구간표)", () => {
  // 기본 D=7(매일 연 사용자)·8·9 → `최근 7일`, 10·14 → `M/D 이후`
  it.each([["2026-11-05", 7], ["2026-11-04", 8], ["2026-11-03", 9], ["2026-11-02", 10], ["2026-10-29", 14]])("시작 %s(D=%i): 행 이름 = week-title, data-value = change-hero-delta", (start) => {
    h.sc = buildScenario(RICH_STEPS, { days: [start, "2026-11-08", "2026-11-09", "2026-11-10", "2026-11-11"] });
    const week = renderToStaticMarkup(<WeekList />);
    const row = renderToStaticMarkup(<HubChangeRows monthlyCount={4} />);
    const title = week.match(/data-testid="week-title"[^>]*>([^<]+)</)![1];
    expect(own(row, "hub-row-week-name")).toBe(title);
    expect(attr(row, "hub-row-week-value", "data-value")).toBe(attr(week, "change-hero-delta", "data-value"));
    // 같은 문자열(부호·원 단위) — Hero 금액과 행 금액
    const heroText = text(week.match(/data-testid="change-hero-delta"[^>]*>(.*?)<\/p>/)![1]);
    expect(own(row, "hub-row-week-value")).toBe(heroText);
  });
  it("D=15(기록 부족) → 이름 `최근 7일`·값 `기록 부족`, 숫자 없음", () => {
    h.sc = buildScenario([], { days: ["2026-10-28", "2026-11-11"] });
    expect(renderToStaticMarkup(<WeekList />)).toContain("week-insufficient");
    const row = renderToStaticMarkup(<HubChangeRows monthlyCount={null} />);
    expect(text(row)).toContain("최근 7일 기록 부족");
    expect(row).not.toContain('data-value=');
  });
  it("기록 없음 → `기록 쌓는 중`", () => {
    h.sc = { ...buildScenario(RICH_STEPS), daily: [] };
    expect(text(renderToStaticMarkup(<HubChangeRows monthlyCount={null} />))).toContain("최근 7일 기록 쌓는 중");
  });
});

describe("행 2·3", () => {
  beforeEach(() => { h.sc = buildScenario(RICH_STEPS); });
  it("월별 기록 N<2·첫 달(null)이면 행 없음, 있으면 `{N}개월`·data-value", () => {
    expect(renderToStaticMarkup(<HubChangeRows monthlyCount={null} />)).not.toContain("hub-row-monthly");
    const html = renderToStaticMarkup(<HubChangeRows monthlyCount={4} />);
    expect(own(html, "hub-row-monthly-value")).toBe("4개월");
    expect(attr(html, "hub-row-monthly-value", "data-value")).toBe("4");
  });
  it("시장 값 = 시장과 비교 페이지 1주 지수 문자열(국내+미국·미국만)", () => {
    h.sc = { ...buildScenario(RICH_STEPS), assetData: { ...buildScenario(RICH_STEPS).assetData, stocks: [
      { id: "a", category: "domestic", name: "삼성전자", ticker: "005930", quantity: 1, averagePrice: 1, currentPrice: 1, currency: "KRW", purchaseDate: "2026-01-01" },
      { id: "b", category: "foreign", name: "애플", ticker: "AAPL", quantity: 1, averagePrice: 1, currentPrice: 1, currency: "USD", purchaseDate: "2026-01-01" },
    ] as Stock[] } };
    const kr = formatCompareRate(computeIndexSpan("kr", "weekly", IDX).rate!);
    const us = formatCompareRate(computeIndexSpan("us", "weekly", IDX).rate!);
    expect(upToSvg(renderToStaticMarkup(<HubChangeRows monthlyCount={null} />), "hub-row-market-value")).toContain(`1주 코스피 ${kr} · S&P 500 ${us}`);
    h.peer = new Set(); // 국내 종목이 비교 대상 아님 → 미국만
    expect(upToSvg(renderToStaticMarkup(<HubChangeRows monthlyCount={null} />), "hub-row-market-value")).toContain(`1주 S&P 500 ${us}`);
  });
  it("비교할 종목 0 → 시장 행 없음. 지수 실패 → `지수와 나란히 보기`, 판별 전 → 스켈레톤(숫자 0)", () => {
    h.sc = { ...h.sc!, assetData: { ...h.sc!.assetData, stocks: [] } };
    expect(renderToStaticMarkup(<HubChangeRows monthlyCount={null} />)).not.toContain("hub-row-market");
    h.sc = buildScenario(RICH_STEPS);
    h.idx = { daily: { KOSPI: null, SPX: null }, weekly: { KOSPI: null, SPX: null } };
    expect(text(renderToStaticMarkup(<HubChangeRows monthlyCount={null} />))).toContain("지수와 나란히 보기");
    h.peer = null;
    const loading = renderToStaticMarkup(<HubChangeRows monthlyCount={null} />);
    expect(loading).toContain("animate-pulse");
    expect(upToSvg(loading, "hub-row-market-value")).not.toMatch(/%/);
  });
  it("행 구분선 직선(rounded 없음) · 값 한 줄 유지(whitespace-nowrap, 320에서 `1주`만 떨어지지 않음)", () => {
    const html = renderToStaticMarkup(<HubChangeRows monthlyCount={4} />);
    expect(html).not.toMatch(/class="[^"]*\brounded/);
    const val = html.match(/data-testid="hub-row-market-value"[^>]*class="([^"]*)"|class="([^"]*)"[^>]*data-testid="hub-row-market-value"/);
    expect(val?.[1] ?? val?.[2]).toContain("whitespace-nowrap");
  });
  it("행 높이 ≥ 44px(min-h-11) · 인증카드 캡처 제외 마커 · `새` 0(마운트 전 판정)", () => {
    const html = renderToStaticMarkup(<HubChangeRows monthlyCount={4} />);
    expect(html.match(/min-h-11/g)?.length).toBe(3);
    expect(html).toContain("data-screenshot-hide");
    expect(html).not.toContain('data-testid="new-chip"');
  });
});

describe("월별 기록 N = 월 탭 카드 행 수 (C84)", () => {
  const snap = (month: string, date: string): MonthlyAssetSnapshot => ({ month, netAsset: 100, financialAsset: 100, date });
  const TODAY = "2026-11-12";
  it("기록 4개월(저장 3 + 이번 달) → N=4 = buildMonthlyLog 행 중 gap 아닌 수", () => {
    const monthly = [snap("2026-08", "2026-08-31"), snap("2026-09", "2026-09-30"), snap("2026-10", "2026-10-31")];
    const n = monthlyLogEntryCount(monthly, TODAY, 500);
    const log = buildMonthlyLog(monthly, TODAY, { netAsset: 500 });
    expect(n).toBe(4);
    expect(log.rows.filter((r) => r.kind !== "gap").length).toBe(n);
  });
  it("중간에 빈 달이 있어도 N은 기록된 달만(gap 제외)", () => {
    const monthly = [snap("2026-07", "2026-07-31"), snap("2026-10", "2026-10-31")];
    const log = buildMonthlyLog(monthly, TODAY, { netAsset: 500 });
    expect(log.rows.some((r) => r.kind === "gap")).toBe(true);
    expect(monthlyLogEntryCount(monthly, TODAY, 500)).toBe(log.rows.filter((r) => r.kind !== "gap").length);
  });
  it("경계 2개월 → 2, 첫 달(저장 0) → null, 저장 1개 = 이번 달 포함 2개월", () => {
    expect(monthlyLogEntryCount([snap("2026-10", "2026-10-31")], TODAY, 500)).toBe(2);
    expect(monthlyLogEntryCount([], TODAY, 500)).toBeNull();
  });
  it("상한 13개월(보존 범위)", () => {
    const monthly = Array.from({ length: 14 }, (_, i) => {
      const d = new Date(Date.UTC(2025, 9 + i, 1));
      const month = d.toISOString().slice(0, 7);
      return snap(month, `${month}-28`);
    }).filter((s) => s.month < "2026-11");
    const n = monthlyLogEntryCount(monthly, TODAY, 500)!;
    expect(n).toBeLessThanOrEqual(13);
  });
});

describe("KpiCard rows 슬롯 — 머리와 행은 형제(중첩 버튼 0), 기존 호출 불변", () => {
  const props = { icon: Wallet, title: "자산 변화", description: "설명", primary: "+1원", onClick: () => {}, dataTutorial: "tut-x" };
  it("rows 없음: 카드 전체가 클릭 영역(기존), data-tutorial 보존", () => {
    const html = renderToStaticMarkup(<KpiCard {...props} />);
    expect(html).toContain('data-tutorial="tut-x"');
    expect(html).toContain("cursor-pointer");
    expect(html).not.toContain('role="button"');
  });
  it("rows 있음: 머리 role=button 안에 행 버튼이 없고, 행은 머리 뒤 형제. data-tutorial 보존", () => {
    const html = renderToStaticMarkup(<KpiCard {...props} rows={<button data-testid="r1">행</button>} />);
    expect(html).toContain('data-tutorial="tut-x"');
    const headStart = html.indexOf('role="button"');
    const rowsStart = html.indexOf('<div class="mt-3 ml-9">');
    expect(headStart).toBeGreaterThan(0);
    expect(html.indexOf('data-testid="r1"')).toBeGreaterThan(rowsStart); // 행은 머리 뒤 형제
    expect(html.slice(headStart, rowsStart)).not.toContain("<button"); // 머리 안 중첩 버튼 0
  });
  it("허브: 자산 변화 래퍼 lg:row-span-2, rows는 자산 있을 때만(자산 0이면 행 전부 없음)", () => {
    const src = readFileSync("src/app/(main)/_components/views/activity/performance-hub.tsx", "utf8");
    expect(src).toContain('data-testid="hub-card-change" className="lg:row-span-2"');
    expect(src).toContain("rows={hasAssets ? <HubChangeRows monthlyCount={monthlyCount} /> : undefined}");
  });
});
