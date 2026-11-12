// 4.92 #181 휴면 복귀 — 비교 시작이 14일 초과 전이어도 이번 주 일별 기록이 2개 이상이면 가장 이른 기록부터 'M/D 이후'.
// 도착 Hero(WeekList)·성과 허브 행(HubChangeRows)이 같은 값(C65), 시각 고정 2026-11-12(KST).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { weekFallbackSince } from "../week-attribution";
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


const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
const own = (html: string, id: string) => html.match(new RegExp(`data-testid="${id}"[^>]*>([^<]*)`))![1];
const attr = (html: string, testId: string, name: string) => html.match(new RegExp(`data-testid="${testId}"[^>]*?${name}="([^"]*)"`))?.[1];

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(NOW_ISO));
  h.navigate.mockClear();
  h.peer = new Set(["005930"]);
  h.idx = {};
});
afterEach(() => vi.useRealTimers());

const render = (days: string[]) => {
  h.sc = buildScenario(RICH_STEPS, { days });
  const week = renderToStaticMarkup(<WeekList />);
  const row = renderToStaticMarkup(<HubChangeRows monthlyCount={4} />);
  return { week, row, title: week.match(/data-testid="week-title"[^>]*>([^<]+)</)?.[1] };
};

describe("휴면 20일 + 이번 주 기록 N일", () => {
  it("1일뿐이면 기록이 부족해요 그대로", () => {
    const { week, row } = render(["2026-10-23", "2026-11-11"]);
    expect(text(week)).toContain("최근 7일 기록이 부족해요");
    expect(own(row, "hub-row-week-name")).toBe("최근 7일");
  });
  it.each([
    [["2026-11-10", "2026-11-11"], "11/10 이후"],
    [["2026-11-08", "2026-11-09", "2026-11-10", "2026-11-11"], "11/8 이후"],
    [["2026-11-06", "2026-11-07", "2026-11-08", "2026-11-09", "2026-11-10", "2026-11-11"], "11/6 이후"],
  ])("2일 이상 %j → %s, 도착·허브 값 일치", (recent, title) => {
    const { week, row } = render(["2026-10-23", ...recent]);
    expect(week.match(/data-testid="week-title"[^>]*>([^<]+)</)![1]).toBe(title);
    expect(own(row, "hub-row-week-name")).toBe(title);
    expect(attr(row, "hub-row-week-value", "data-value")).toBe(attr(week, "change-hero-delta", "data-value"));
    expect(text(week)).not.toContain("기록이 부족해요");
  });
});

describe("회귀", () => {
  it("매일 7일(시작 11/5) → 최근 7일(recent) 그대로", () => {
    const { title } = render(["2026-11-05", "2026-11-08", "2026-11-09", "2026-11-10", "2026-11-11"]);
    expect(title).toBe("최근 7일");
  });
  it("신규 3일 → 가장 이른 기록 since 그대로", () => {
    const { title } = render(["2026-11-09", "2026-11-10", "2026-11-11"]);
    expect(title).toBe("11/9 이후");
  });
});

describe("weekFallbackSince", () => {
  const d = (...dates: string[]) => dates.map((date) => ({ date }));
  it("(오늘-7일, 오늘] 일별 기록 2개 이상이면 가장 이른 날, 아니면 null", () => {
    expect(weekFallbackSince(d("2026-10-23", "2026-11-10", "2026-11-11"), "2026-11-12")).toBe("2026-11-10");
    expect(weekFallbackSince(d("2026-10-23", "2026-11-11"), "2026-11-12")).toBeNull();
    expect(weekFallbackSince(d("2026-11-05", "2026-11-11"), "2026-11-12")).toBeNull(); // 11/5는 구간 밖(경계)
    expect(weekFallbackSince(d("2026-11-11", "2026-11-12"), "2026-11-12")).toBe("2026-11-11"); // 오늘 포함
  });
});
