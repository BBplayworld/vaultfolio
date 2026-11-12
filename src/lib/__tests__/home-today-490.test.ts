// 4.90 #175 — GA 값 추가·송출처 전수(C90)·시장과 비교 '하루' init·홈 진입 연결
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { PARAM_VALUES, featureTitleOf } from "@/lib/analytics/ga";
import { listPeriodFromInit } from "@/app/(main)/_components/views/activity/market-compare-view";
import { isChangeWeekAll } from "@/app/(main)/_components/layout/navigation/navigation-context";
import { parseHash, toHash } from "@/app/(main)/_components/layout/navigation/navigation-context";

const root = join(process.cwd(), "src");
const DASH = "app/(main)/_components/views/home/dashboard.tsx";
function filesWith(needle: RegExp): string[] {
  const out: string[] = [];
  const walk = (d: string) => {
    for (const n of readdirSync(d)) {
      const f = join(d, n);
      if (statSync(f).isDirectory()) { if (n !== "__tests__") walk(f); continue; }
      if (/\.(ts|tsx)$/.test(n) && needle.test(readFileSync(f, "utf8"))) out.push(f.slice(root.length + 1).replace(/\\/g, "/"));
    }
  };
  walk(root);
  return out.filter((f) => f !== "lib/analytics/ga.ts");
}

describe("GA — 값 enum 추가만(맞춤 정의 0)", () => {
  it("신규 값이 화이트리스트에 있다", () => {
    expect(PARAM_VALUES.category).toContain("home_market");
    expect(PARAM_VALUES.source).toContain("home_week");
  });
  it("title 표(spec 8절)", () => {
    const t = (params: Parameters<typeof featureTitleOf>[1]) => featureTitleOf("feature_use", params, "home");
    expect(t({ category: "home_market" })).toBe("홈·오늘 시장");
    expect(t({ category: "change_week_all", source: "home_week" })).toBe("홈·7일");
    expect(t({ category: "change_week_all" })).toBe("성과·자산 변화·최근 7일");
    expect(t({ category: "change_week_all", source: "home_tip" })).toBe("성과·자산 변화·최근 7일");
    expect(t({ category: "change_week_all", source: "whats_new" })).toBe("성과·자산 변화·최근 7일");
    expect(t({ category: "home_cause_open" })).toBe("홈 변동 원인 열기");
  });
});

describe("송출처 전수(C90)", () => {
  it("home_market은 홈 대시보드 1곳", () => {
    expect(filesWith(/category: "home_market"/)).toEqual([DASH]);
  });
  it("source: home_week는 홈 대시보드 1곳, 다른 change_week_all 송출처는 source 없음/기존 경로", () => {
    expect(filesWith(/source: "home_week"/)).toEqual([DASH]);
    const senders = filesWith(/category: "change_week_all"/).sort();
    expect(senders).toEqual([
      DASH,
      "app/(main)/_components/views/activity/asset-change-view.tsx",
      "app/(main)/_components/views/activity/hub-change-rows.tsx",
    ].sort());
    for (const f of senders.filter((x) => x !== DASH)) expect(readFileSync(join(root, f), "utf8")).not.toContain("home_week");
  });
  it("홈 종가 줄 탭 = home_market 송출 후 시장과 비교 '하루' init, 7일 카드 탭 = 전체·주 init(방문 기록은 navigate 경로 1곳)", () => {
    const src = readFileSync(join(root, DASH), "utf8");
    expect(src).toMatch(/category: "home_market" \}\);\s*navigate\(\{ type: "activity", tab: "change-market", init: \{ period: "day" \} \}\)/);
    expect(src).toMatch(/source: "home_week" \}\);\s*navigate\(\{ type: "activity", tab: "change", init: \{ scope: "all", period: "week" \} \}\)/);
    expect(src).not.toContain("recordVisit"); // C83 — 직접 기록 금지, navigate→recordViewVisits
    expect(isChangeWeekAll({ type: "activity", tab: "change", init: { scope: "all", period: "week" } })).toBe(true);
  });
});

describe("시장과 비교 '하루' init", () => {
  it("init.period day면 하루, 없으면 1주(새로 들어오면 다시 1주)", () => {
    expect(listPeriodFromInit({ period: "day" })).toBe("daily");
    expect(listPeriodFromInit(undefined)).toBe("weekly");
    expect(listPeriodFromInit({ period: "week" })).toBe("weekly");
  });
  it("해시·저장에 싣지 않는다 — 주소는 그대로 #activity/change-market, 해시 진입은 init 없음", () => {
    expect(toHash({ type: "activity", tab: "change-market", init: { period: "day" } })).toBe("#activity/change-market");
    expect(parseHash("#activity/change-market")).toEqual({ type: "activity", tab: "change-market" });
  });
});
