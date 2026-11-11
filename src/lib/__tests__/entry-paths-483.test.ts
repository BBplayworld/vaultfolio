// 4.83 신기능 진입 경로 — 순수 로직: `새` 표시(켜짐·꺼짐·우선순위), 주 탭 방문 기록(실제 쓰기 함수 결과로 판정, C83),
// 새 소식 바로 가기 정정·tip:false, 미니 차트 계산(다운샘플·평단 점선·상태), X-Ray 1회 소비 store.
import { beforeEach, describe, expect, it } from "vitest";
import { APP_FEATURES } from "@/config/app-features";
import { WHATS_NEW } from "@/config/whats-new";
import { HUB_NEW_SPOT_ORDER, NEW_SPOTS, type NewSpot } from "@/config/new-spots";
import { dismissTip, getLastVisitedAt, pickRecommendedFeature, recordVisit, runFeatureEntry } from "../feature-usage";
import { isSpotNew, pickNewSpot } from "../new-spot";
import { CHANGE_WEEK_VISIT_KEY, isChangeWeekAll, recordViewVisits, type AssetView } from "@/app/(main)/_components/layout/navigation/navigation-context";
import { buildRowFlow, buildSparkGeometry, downsample, ROW_SPARK_POINTS, ROW_SPARK_W, signedRate, computePriceChange } from "../finance/stock-page";
import { useXrayViewStore } from "@/stores/xray-view-store";
import type { PriceHistory, PricePoint } from "../finance/price-history";

const store = new Map<string, string>();
beforeEach(() => {
  store.clear();
  (globalThis as Record<string, unknown>).window = globalThis;
  (globalThis as Record<string, unknown>).localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => { store.set(k, v); },
    removeItem: (k: string) => { store.delete(k); },
  };
  useXrayViewStore.getState().clear();
});

const WEEK_ALL: AssetView = { type: "activity", tab: "change", init: { scope: "all", period: "week" } };
const lastVisited = (k: string) => getLastVisitedAt(k);

describe("`새` 켜짐·꺼짐 (C76 새 경과일 구간)", () => {
  // 연결 새 소식 03(최근 7일) = 20261111-03 → 게시일 11/11
  it.each([["2026-11-11", true], ["2026-11-12", true], ["2026-12-11", true], ["2026-12-12", false], ["2026-11-10", false]])("게시일+경과 %s → %s (30일 포함·31일 꺼짐·게시 전 꺼짐)", (today, on) => {
    expect(isSpotNew("hub-week", today, undefined)).toBe(on);
  });
  it("방문(KST 게시일 00:00 이후)하면 꺼짐, 게시일 전 방문 기록은 켜짐 유지", () => {
    expect(isSpotNew("hub-week", "2026-11-12", "2026-11-10T14:59:59Z")).toBe(true); // KST 11/10 23:59:59 = 게시 전 방문 → 켜짐
    expect(isSpotNew("hub-week", "2026-11-12", "2026-11-10T15:00:00Z")).toBe(false); // KST 11/11 00:00 = 게시일 → 꺼짐
  });
  it("대응표: 새 소식 id가 실제 항목이고 visitKey가 있다", () => {
    for (const [spot, c] of Object.entries(NEW_SPOTS) as [NewSpot, { entryId: string; visitKey: string }][]) {
      expect(WHATS_NEW.some((e) => e.id === c.entryId), spot).toBe(true);
      expect(c.visitKey.length).toBeGreaterThan(0);
    }
  });
});

describe("한 화면 1개·우선순위 — 실제 recordVisit 결과로 넘어간다(C83)", () => {
  const TODAY = "2026-11-12";
  it("허브: 처음엔 hub-week → 주 탭 방문 후 hub-monthly → 월별 기록 방문 후 hub-market → 시장 방문 후 0개", () => {
    expect(pickNewSpot(HUB_NEW_SPOT_ORDER, TODAY, lastVisited)).toBe("hub-week");
    recordViewVisits(WEEK_ALL);
    expect(pickNewSpot(HUB_NEW_SPOT_ORDER, TODAY, lastVisited)).toBe("hub-monthly");
    recordVisit("monthly-log");
    expect(pickNewSpot(HUB_NEW_SPOT_ORDER, TODAY, lastVisited)).toBe("hub-market");
    recordViewVisits({ type: "activity", tab: "change-market" });
    expect(pickNewSpot(HUB_NEW_SPOT_ORDER, TODAY, lastVisited)).toBeNull();
  });
  it("보이는 자리만 후보: 행 2 숨김이면 hub-week 다음은 hub-market", () => {
    recordViewVisits(WEEK_ALL);
    expect(pickNewSpot(["hub-week", "hub-market"], TODAY, lastVisited)).toBe("hub-market");
  });
  it("시장과 비교 방문은 상세·주식 stock-market과 허브 hub-market을 함께 끈다(같은 visitKey)", () => {
    expect(pickNewSpot(["stock-market"], TODAY, lastVisited)).toBe("stock-market");
    recordViewVisits({ type: "activity", tab: "change-market" });
    expect(pickNewSpot(["stock-market"], TODAY, lastVisited)).toBeNull();
    expect(pickNewSpot(["hub-market"], TODAY, lastVisited)).toBeNull();
  });
  it("새 소식 시트 읽음 기록은 `새`에 영향 없음(방문으로만 꺼짐)", () => {
    store.set("secretasset_notice_seen", JSON.stringify({ id: "20261111-08", seenAt: Date.now() + 1e9 }));
    expect(pickNewSpot(HUB_NEW_SPOT_ORDER, TODAY, lastVisited)).toBe("hub-week");
  });
});

describe("change-week 방문 기록 2경로 (실제 recordVisit 호출)", () => {
  it("init 진입(새 소식·팁·허브 행): 범위 전체·주 → 기록 / scope 생략도 전체 / 주식·월·연은 기록 안 함", () => {
    expect(isChangeWeekAll(WEEK_ALL)).toBe(true);
    expect(isChangeWeekAll({ type: "activity", tab: "change", init: { period: "week" } })).toBe(true);
    expect(isChangeWeekAll({ type: "activity", tab: "change", init: { scope: "stock", period: "week" } })).toBe(false);
    expect(isChangeWeekAll({ type: "activity", tab: "change", init: { scope: "all", period: "month" } })).toBe(false);
    expect(isChangeWeekAll({ type: "activity", tab: "change" })).toBe(false);
    recordViewVisits({ type: "activity", tab: "change", init: { scope: "stock", period: "week" } });
    expect(getLastVisitedAt(CHANGE_WEEK_VISIT_KEY)).toBeUndefined();
    recordViewVisits(WEEK_ALL);
    expect(getLastVisitedAt(CHANGE_WEEK_VISIT_KEY)).toBeDefined();
    expect(JSON.parse(store.get("secretasset_feature_usage") ?? store.values().next().value!).visits["activity:change"].count).toBe(2);
  });
  it("기록 후 홈 팁 `주간 변화 원인`이 추천 우선순위에서 내려간다(방문 0회 우선)", () => {
    const week = APP_FEATURES.find((f) => f.id === "week-causes")!;
    expect(week.visitKey).toBe(CHANGE_WEEK_VISIT_KEY);
    // 다른 후보를 전부 방문시켜 week-causes만 0회로 남기면 추천된다 → 방문 후엔 추천 1순위가 아니다
    for (const f of APP_FEATURES) if (f.id !== "week-causes" && f.tip !== false) recordVisit(f.visitKey ?? (f.target ? (f.target.type === "detail" || f.target.type === "activity" ? `${f.target.type}:${f.target.tab}` : f.target.type) : f.id));
    expect(pickRecommendedFeature()?.id).toBe("week-causes");
    recordViewVisits(WEEK_ALL);
    expect(pickRecommendedFeature()?.id).not.toBe("week-causes");
  });
  it("주 탭 전환 경로: AssetChangeView.changePeriod가 같은 키로 recordVisit(정적 확인 — jsdom 없음, 상호작용은 qa Playwright)", async () => {
    const { readFileSync } = await import("node:fs");
    const src = readFileSync("src/app/(main)/_components/views/activity/asset-change-view.tsx", "utf8");
    expect(src).toMatch(/v === "week" && scope === "all"\) \{[\s\S]{0,200}recordVisit\(CHANGE_WEEK_VISIT_KEY\)/);
  });
});

describe("새 소식 바로 가기 정정 + tip:false", () => {
  const entry = (n: string) => WHATS_NEW.find((e) => e.id === `20261111-${n}`)!;
  it("04 → monthly-log(월 탭 + 월별 기록 focus), 05 → 바로 가기 없음, 07 → share-card-stock(주식 현황 탭)", () => {
    expect(entry("04").featureId).toBe("monthly-log");
    const m = APP_FEATURES.find((f) => f.id === "monthly-log")!;
    expect(m.target).toEqual({ type: "activity", tab: "change", init: { scope: "all", period: "month", source: "menu", focus: "monthly-log" } });
    expect(m.visitKey).toBe("monthly-log");
    expect(entry("05").featureId).toBeUndefined();
    expect(entry("07").featureId).toBe("share-card-stock");
    expect(APP_FEATURES.find((f) => f.id === "share-card-stock")!.visitKey).toBe("share-card");
    for (const e of WHATS_NEW) if (e.featureId) expect(APP_FEATURES.some((f) => f.id === e.featureId), e.id).toBe(true);
  });
  it("01·02·03·06 대상은 그대로, 인증카드 기본 탭·기존 share-card 항목 불변", () => {
    expect([entry("01"), entry("02"), entry("03"), entry("06")].map((e) => e.featureId)).toEqual(["stocks", "market-compare", "week-causes", "stocks"]);
    expect(APP_FEATURES.find((f) => f.id === "share-card")).toMatchObject({ visitKey: "share-card" });
  });
  it("tip:false 항목은 홈 기능 팁 후보에서 제외 — 다른 후보를 모두 dismiss해도 추천되지 않는다", () => {
    const hidden = APP_FEATURES.filter((f) => f.tip === false).map((f) => f.id);
    expect(hidden.sort()).toEqual(["monthly-log", "share-card-stock"]);
    for (const f of APP_FEATURES) if (f.tip !== false) dismissTip(f.id);
    expect(pickRecommendedFeature()).toBeNull();
  });
  it("monthly-log 바로 가기는 월 탭 init(focus)으로 이동 — runFeatureEntry 실제 호출", () => {
    const seen: AssetView[] = [];
    runFeatureEntry(APP_FEATURES.find((f) => f.id === "monthly-log")!, (v) => seen.push(v), "whats_new");
    expect(seen).toEqual([{ type: "activity", tab: "change", init: { scope: "all", period: "month", source: "menu", focus: "monthly-log" } }]);
  });
});

// ── 미니 차트 ──
const mk = (n: number, f: (i: number) => number = (i) => 100 + i): PricePoint[] => Array.from({ length: n }, (_, i) => ({ d: `2026-01-${String(i + 1).padStart(2, "0")}`, c: f(i) }));
describe("downsample·스파크 좌표", () => {
  it("250점 → 40점, 첫·마지막 점 포함, 순서(단조) 유지. 40점 이하는 그대로", () => {
    const pts = mk(250);
    const d = downsample(pts, ROW_SPARK_POINTS);
    expect(d).toHaveLength(40);
    expect(d[0]).toBe(pts[0]);
    expect(d[39]).toBe(pts[249]);
    const idx = d.map((p) => pts.indexOf(p));
    expect(idx).toEqual([...idx].sort((a, b) => a - b));
    expect(downsample(mk(10), 40)).toHaveLength(10);
  });
  it("좌표: x는 0..폭, 점선 y는 평단이 범위 안일 때만(범위 밖·없음 → null)", () => {
    const pts = mk(60, (i) => 100 + i);
    const g = buildSparkGeometry(pts, 130, ROW_SPARK_W, 32)!;
    expect(g.line.split(" ")[0].startsWith("0.0,")).toBe(true);
    expect(g.line.split(" ").at(-1)!.startsWith(`${ROW_SPARK_W.toFixed(1)},`)).toBe(true);
    expect(g.avgY).not.toBeNull();
    expect(buildSparkGeometry(pts, 5000, ROW_SPARK_W, 32)!.avgY).toBeNull(); // 범위 밖
    expect(buildSparkGeometry(pts, null, ROW_SPARK_W, 32)!.avgY).toBeNull();
    expect(buildSparkGeometry(mk(1), 100, ROW_SPARK_W, 32)).toBeNull();
  });
  it("buildRowFlow: 1년 %는 원본 points 값(다운샘플과 무관), 상태 4종", () => {
    const pts = mk(250, (i) => 100 + i * 0.5);
    const data = { points: pts } as PriceHistory;
    const r = buildRowFlow(true, { isError: false, data }, 120);
    expect(r.kind).toBe("ready");
    if (r.kind === "ready") expect(signedRate(r.change)).toBe(signedRate(computePriceChange(pts)!));
    expect(buildRowFlow(false, { isError: false }, null).kind).toBe("none");
    expect(buildRowFlow(true, { isError: false }, null).kind).toBe("loading");
    expect(buildRowFlow(true, { isError: true }, null).kind).toBe("fallback");
    expect(buildRowFlow(true, { isError: false, data: { points: [] } as unknown as PriceHistory }, null).kind).toBe("fallback");
  });
});

describe("X-Ray 초기 축 1회 소비 store", () => {
  it("지정 → 읽으면 값, clear 뒤 null(직접 진입은 기본 축)", () => {
    useXrayViewStore.getState().setInitialAxis("region");
    expect(useXrayViewStore.getState().initialAxis).toBe("region");
    useXrayViewStore.getState().clear();
    expect(useXrayViewStore.getState().initialAxis).toBeNull();
  });
});
