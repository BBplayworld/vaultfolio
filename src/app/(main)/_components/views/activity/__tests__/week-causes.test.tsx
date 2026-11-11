// 4.79 #153 최근 7일 결산 — T1~T3, T5~T13. T4(홈 골든)는 week-attribution.test.ts.
// 모든 줄 검증은 홈 Hero 항목(computeAttributionView.causes)과 같은 입력으로 호출해 대조한다(C48 — causes 자체 비교).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { AttributionDisplayItem } from "@/lib/report/asset-report";
import { CAUSE_DISPLAY_MIN, offsetAttributionEffects } from "@/lib/report/asset-report";
import { buildWeekRows } from "@/lib/report/settlement";
import { featureTitleOf } from "@/lib/analytics/ga";
import { APP_FEATURES } from "@/config/app-features";
import { viewToKey } from "@/lib/feature-usage";
import { computeAttributionView, mapWeekCauses, resolveWeekHero, weekLineOf, weekSinceDate, weekToday, type AttributionView } from "../week-attribution";
import {
  RICH_STEPS, NOW_ISO, TODAY, buildScenario, cashEdit, rateAt, snapOf, stateOn, summaryOf, deposit, loanBorrow, loanRepay, realEstateValue, stockBuy, stockTrade, withdraw,
  type Scenario, type Step,
} from "./week-fixtures";

const h = vi.hoisted(() => ({ sc: null as null | Scenario, track: vi.fn(), navigate: vi.fn() }));
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
vi.mock("@/lib/analytics/ga", async (orig) => ({ ...(await orig<typeof import("@/lib/analytics/ga")>()), track: h.track }));
vi.mock("@/app/(main)/_components/layout/navigation/navigation-context", async (orig) => ({
  ...(await orig<typeof import("@/app/(main)/_components/layout/navigation/navigation-context")>()),
  useAssetNavigation: () => ({ navigate: h.navigate }),
}));

import { AssetChangeView, WeekList } from "../asset-change-view";

beforeEach(() => { vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date(NOW_ISO)); h.track.mockClear(); });
afterEach(() => vi.useRealTimers());

const view = (steps: Step[], opts: Parameters<typeof buildScenario>[1] = {}, since = "2026-11-05") => {
  const sc = buildScenario(steps, opts);
  const v = computeAttributionView({ ...sc, sinceDate: since })!;
  return { sc, v, mapped: mapWeekCauses(v) };
};
const lines = (steps: Step[], opts: Parameters<typeof buildScenario>[1] = {}) => {
  const { mapped } = view(steps, opts);
  return Object.fromEntries(mapped.causes.map((c) => [c.key, c.amount])) as Record<string, number>;
};
const sumOf = (m: ReturnType<typeof mapWeekCauses>) => m.causes.reduce((s, c) => s + c.amount, 0);
const BASE = { price: 1_309_840, fx: 162_400 }; // 시세·환율만 움직인 7일(다른 기록 없음)

describe("T1·T2 줄 = 그룹 Hero 항목 합, 합계 = Hero 증감", () => {
  const scenarios: [string, Step[], Parameters<typeof buildScenario>[1]?][] = [
    ["풍부한 7일", RICH_STEPS],
    ["레거시 시작점", RICH_STEPS, { legacyStart: true }],
    ["입금만", [deposit("2026-11-08", 3_000_000)]],
    ["출금→매수", [withdraw("2026-11-08", 3_590_000), stockBuy("2026-11-08", "s_sam", 50, 71800)]],
    ["평가 갱신+대출", [realEstateValue("2026-11-08", 540_000_000), loanBorrow("2026-11-08", 15_000_000)]],
  ];
  it.each(scenarios)("%s", (_n, steps, opts) => {
    const { v, mapped } = view(steps, opts);
    expect(mapped.deltaNet).toBe(Math.round(v.attr.deltaNet)); // B 증감 = Hero 증감
    expect(sumOf(mapped)).toBe(Math.round(v.attr.deltaNet));    // T2: 정확히
    for (const c of mapped.causes) {
      const group = v.causes.filter((i) => weekLineOf(i.key) === c.key).reduce((s, i) => s + i.amount, 0);
      const tol = c.key === "unrecorded" ? CAUSE_DISPLAY_MIN : 1; // 기록 안 된 변화만 1만 원 미만 잔차 흡수
      expect(Math.abs(c.amount - Math.round(group))).toBeLessThan(tol);
    }
    // 고정 순서, 10원 미만 줄 없음
    const order = ["price", "valuation", "fx", "income", "loan", "unrecorded"];
    const idx = mapped.causes.map((c) => order.indexOf(c.key));
    expect(idx).toEqual([...idx].sort((a, b) => a - b));
    expect(mapped.causes.every((c) => Math.abs(c.amount) >= 10)).toBe(true);
  });
  it("C48: 홈 Hero 항목(causes)은 리팩터 전 main 골든과 같다 — week-attribution.test.ts T4", () => {
    expect(view(RICH_STEPS).v.causes.map((c) => c.key)).toEqual(["price:stock", "price:crypto", "price:realEstate", "fx", "unrecorded"]);
  });
});

describe("T3 표기 5-2", () => {
  const stub = (fromDate: string, windowFrom?: string) => ({ attr: { fromDate, windowFrom } }) as unknown as AttributionView;
  const since = (d: string) => (n: number) => new Date(Date.parse(`${d}T00:00:00Z`) - n * 86_400_000).toISOString().slice(0, 10);
  const ago = since(TODAY);
  it.each([7, 8, 9])("D=%i → 최근 7일 + 구간 M/D → 오늘", (d) => {
    const s = ago(d);
    expect(resolveWeekHero(stub(s), TODAY)).toEqual({ kind: "recent", title: "최근 7일", range: `${Number(s.slice(5, 7))}/${Number(s.slice(8, 10))} → 오늘` });
  });
  it.each([1, 3, 6, 10, 14])("D=%i → M/D 이후, 구간 없음", (d) => {
    const s = ago(d);
    const r = resolveWeekHero(stub(s), TODAY);
    expect(r).toEqual({ kind: "since", title: `${Number(s.slice(5, 7))}/${Number(s.slice(8, 10))} 이후` });
    expect("range" in r).toBe(false);
  });
  it("D=15·월 스냅샷 폴백 → 분해하지 않는다", () => {
    expect(resolveWeekHero(stub(ago(15)), TODAY).kind).toBe("insufficient");
    expect(resolveWeekHero(stub("2026-10", "2026-10-20"), TODAY).kind).toBe("insufficient"); // 월 스냅샷 시작점(실제 기록일 D=23)
  });
  it("월 표기 시작점이어도 실제 기록일이 14일 안이면 그 날짜 기준", () => {
    expect(resolveWeekHero(stub("2026-11", "2026-11-01"), TODAY)).toEqual({ kind: "since", title: "11/1 이후" });
  });
  it("attr = null → 빈 상태", () => {
    expect(resolveWeekHero(null, TODAY)).toEqual({ kind: "empty", title: "최근 7일" });
  });
  it("엔진 연동: today−7 시작 = 최근 7일 11/5 → 오늘", () => {
    const { v } = view(RICH_STEPS);
    expect(resolveWeekHero(v, TODAY)).toEqual({ kind: "recent", title: "최근 7일", range: "11/5 → 오늘" });
  });
});

describe("T5 레거시 시작점", () => {
  it("통합 시세는 기록 안 된 변화(예측), 환율은 Hero 매핑 + 예측, 합계 항등", () => {
    const { v, mapped } = view(RICH_STEPS, { legacyStart: true });
    expect(v.causes.map((c) => c.key)).toContain("price"); // Hero는 통합 `price`(시세 예측)
    const byKey = Object.fromEntries(mapped.causes.map((c) => [c.key, c]));
    expect(byKey.price).toBeUndefined();
    expect(byKey.unrecorded.estimated).toBe(true);
    expect(byKey.fx.estimated).toBe(true);
    expect(byKey.unrecorded.amount).toBe(6_492_595); // 통합 시세 5,522,595 + 기록 안 된 970,000
    expect(sumOf(mapped)).toBe(Math.round(v.attr.deltaNet));
  });
});

describe("T6 빈 날", () => {
  it("일별 기록이 today−10, today−3뿐이면 fromDate = today−10 → `M/D 이후`", () => {
    const sc = buildScenario([], { days: ["2026-11-02", "2026-11-09"] });
    const v = computeAttributionView({ ...sc, sinceDate: weekSinceDate(TODAY) })!;
    expect(v.attr.fromDate).toBe("2026-11-02");
    expect(resolveWeekHero(v, TODAY)).toEqual({ kind: "since", title: "11/2 이후" });
  });
});

describe("buildWeekRows extendFrom(4.79)", () => {
  const daily = ["2026-11-04", "2026-11-05", "2026-11-09", "2026-11-12"].map((date, i) => ({ date, netAsset: 100 + i * 10, financialAsset: 0 }));
  it("생략하면 main과 같다, 지정하면 그 날짜 행부터(weekDiff 불변)", () => {
    const base = buildWeekRows(daily, "2026-11-12");
    expect(buildWeekRows(daily, "2026-11-12", "2026-11-07")).toEqual(base); // 창 안이면 무시
    const ext = buildWeekRows(daily, "2026-11-12", "2026-11-05");
    expect(ext.rows.map((r) => r.date)).toEqual(["2026-11-12", "2026-11-09", "2026-11-05"]);
    expect(ext.rows[2].diff).toBe(10); // 전일 대비는 원본 정렬 기준
    expect(ext.weekDiff).toBe(base.weekDiff);
  });
});

describe("T7 buildWeekRows 출력 main 동일", () => {
  it("7일 행(최신순)·전일 대비·7일 전 대비 값", () => {
    const daily = ["2026-11-04", "2026-11-06", "2026-11-09", "2026-11-12"].map((date, i) => ({ date, netAsset: 100 + i * 10, financialAsset: 0 }));
    const r = buildWeekRows(daily, "2026-11-12");
    expect(r.rows).toEqual([
      { date: "2026-11-12", netAsset: 130, diff: 10 },
      { date: "2026-11-09", netAsset: 120, diff: 10 },
      { date: "2026-11-06", netAsset: 110, diff: 10 },
    ]);
    expect(r.weekDiff).toBe(30);
  });
});

describe("T8 부동산·실물 매수·매도도 순유입", () => {
  it.each(["buy:realEstate", "sell:realEstate", "buy:physical", "sell:physical", "buy:stock", "sell:crypto", "income"] as const)("%s → 순유입", (k) => {
    expect(weekLineOf(k)).toBe("income");
  });
  it("그 밖의 키", () => {
    expect(weekLineOf("price:stock")).toBe("price");
    expect(weekLineOf("price:crypto")).toBe("price");
    expect(weekLineOf("price:realEstate")).toBe("valuation");
    expect(weekLineOf("price:physical")).toBe("valuation");
    expect(weekLineOf("fx")).toBe("fx");
    expect(weekLineOf("debt")).toBe("loan");
    for (const k of ["cash", "deposit", "unrecorded", "price"] as const) expect(weekLineOf(k)).toBe("unrecorded");
  });
  it("합산 — 4키 합이 순유입 한 줄", () => {
    const items = (["buy:realEstate", "sell:realEstate", "buy:physical", "sell:physical"] as const).map((key, i) => ({ key, amount: (i + 1) * 1_000_000 })) as unknown as AttributionDisplayItem[];
    const m = mapWeekCauses({ attr: { deltaNet: 10_000_000 } as never, causes: items });
    expect(m.causes).toEqual([{ key: "income", amount: 10_000_000, estimated: false }]);
  });
});

describe("T9 잔차 흡수", () => {
  const item = (key: string, amount: number, estimated = false) => ({ key, amount, ...(estimated ? { estimated } : {}) }) as unknown as AttributionDisplayItem;
  it("(a) |deltaNet| < 1만 → 줄 0개", () => {
    const m = mapWeekCauses({ attr: { deltaNet: 9_999.4 } as never, causes: [item("price:stock", 20_000), item("fx", -10_000)] });
    expect(m.causes).toEqual([]);
  });
  it("(b) Hero 항목 0개·|deltaNet| ≥ 1만 → 기록 안 된 변화 1줄", () => {
    const m = mapWeekCauses({ attr: { deltaNet: 50_000 } as never, causes: [] });
    expect(m.causes).toEqual([{ key: "unrecorded", amount: 50_000, estimated: false }]);
  });
  it("(c) 1만 미만 잔차 흡수 — 합계 유지, 흡수분은 예측을 만들지 않는다", () => {
    const m = mapWeekCauses({ attr: { deltaNet: 1_005_000 } as never, causes: [item("price:stock", 1_000_000, true)] });
    expect(m.causes).toEqual([
      { key: "price", amount: 1_000_000, estimated: true },
      { key: "unrecorded", amount: 5_000, estimated: false },
    ]);
    expect(sumOf(m)).toBe(1_005_000);
  });
  it("10원 미만 줄은 숨긴다", () => {
    const m = mapWeekCauses({ attr: { deltaNet: 2_000_004 } as never, causes: [item("price:stock", 2_000_000)] });
    expect(m.causes.map((c) => c.key)).toEqual(["price"]); // 잔차 4원 → 숨김
    expect(sumOf(m)).toBe(2_000_000);
  });
});

describe("T11 실사용 거래 패턴(C21) — 기대값을 미리 적는다", () => {
  it("① 출금 → 같은 날 매수: 순유입 0·기록 안 된 변화 0 (매수분 시세 +120,000만 더해짐)", () => {
    const l = lines([withdraw("2026-11-08", 3_590_000), stockBuy("2026-11-08", "s_sam", 50, 71800)]);
    expect(l).toEqual({ price: BASE.price + 120_000, fx: BASE.fx });
  });
  it("② 출금 → 대출 상환: 순유입 0·대출 0·기록 안 된 변화 0", () => {
    expect(lines([withdraw("2026-11-08", 5_000_000), loanRepay("2026-11-08", 5_000_000)])).toEqual(BASE);
  });
  it("③ 입금만: 순유입 +3,000,000", () => {
    expect(lines([deposit("2026-11-08", 3_000_000)])).toEqual({ ...BASE, income: 3_000_000 });
  });
  it("④ 시작점이 앵커·레거시 → T5(통합 시세는 기록 안 된 변화)", () => {
    expect(lines(RICH_STEPS, { legacyStart: true }).price).toBeUndefined();
  });
  it("⑤ 거래 기록 없는 자산 증가(대출로 산 부동산): 평가 갱신 +20,000,000·대출 −15,000,000", () => {
    expect(lines([realEstateValue("2026-11-08", 540_000_000), loanBorrow("2026-11-08", 15_000_000)])).toEqual({ price: BASE.price, valuation: 20_000_000, fx: BASE.fx, loan: -15_000_000 });
  });
});

describe("T12 C42·C49 교차", () => {
  it("원화 계좌 연결 해외주식 매수: 순유입 0·기록 안 된 변화 0", () => {
    const l = lines([stockTrade({ date: "2026-11-09", stockId: "s_aapl", type: "buy", qty: 5, price: 200, link: { kind: "cash", cashId: "c_krw" } })]);
    expect(l.income).toBeUndefined();
    expect(l.unrecorded).toBeUndefined();
    expect(l.loan).toBeUndefined();
  });
  it("대출로 매수(연결): 순유입·대출·기록 안 된 변화 0", () => {
    const l = lines([stockTrade({ date: "2026-11-09", stockId: "s_aapl", type: "buy", qty: 5, price: 200, link: { kind: "loan", loanId: "l_cred" } })]);
    expect(l.income).toBeUndefined();
    expect(l.loan).toBeUndefined();
    expect(l.unrecorded).toBeUndefined();
  });
  it("현금 등록 + 짝 없는 매수: 순유입 양수(spec) — 부동소수 잡음이 상쇄 경로로 끌어들이던 결함 수정 후", () => {
    const { v, mapped } = view([stockBuy("2026-11-09", "s_sam", 20, 72000)]);
    expect(v.offsetTotal).toBe(0);
    expect(v.causes.find((c) => c.key === "buy:stock")?.amount).toBeCloseTo(1_440_000, 0);
    expect(v.causes.find((c) => c.key === "unrecorded")).toBeUndefined();
    expect(Object.fromEntries(mapped.causes.map((c) => [c.key, c.amount]))).toEqual({ price: 1_353_840, fx: BASE.fx, income: 1_440_000 });
  });
  it("현금 잔액만 고침: 기록 안 된 변화 1줄·순유입 0", () => {
    expect(lines([cashEdit("2026-11-09", "c_krw", 31_500_000)])).toEqual({ ...BASE, unrecorded: 1_500_000 });
  });
});

describe("상쇄 판정 부동소수 잡음(C73 — 4.79에서 수정)", () => {
  const attr = (effects: { key: string; amount: number }[]) => ({ effects, deltaNet: 0 }) as unknown as Parameters<typeof offsetAttributionEffects>[0];
  const zero = { out: { stock: 0, crypto: 0, physical: 0, loan: 0 }, in: { stock: 0, crypto: 0 } };
  it("1e-10 크기 반대 부호 다리는 상쇄 대상이 아니다(수정 전: offset ≈ 1e-10, 매수가 기록 안 된 변화로 합쳐짐)", () => {
    const r = offsetAttributionEffects(attr([{ key: "buy:stock", amount: 1_440_000 }, { key: "cash", amount: -1.1641532182693481e-10 }]), zero);
    expect(r.offset).toBe(0);
    expect(r.effects.find((e) => e.key === "buy:stock")?.amount).toBe(1_440_000);
    expect(r.effects.find((e) => (e.key as string) === "unrecorded")).toBeUndefined();
  });
  it("진짜 반대 부호 다리(1원 이상)는 그대로 상쇄", () => {
    const r = offsetAttributionEffects(attr([{ key: "buy:stock", amount: 1_000_000 }, { key: "cash", amount: -400_000 }]), zero);
    expect(r.offset).toBe(400_000);
    expect(r.effects.find((e) => (e.key as string) === "unrecorded")?.amount).toBe(600_000);
  });
});

describe("T13 오늘 = 홈 Hero와 같은 KST 날짜", () => {
  it("KST 00:30(UTC 전날 15:30)에 today−7이 KST 기준", () => {
    vi.setSystemTime(new Date("2026-11-11T15:30:00Z")); // KST 11/12 00:30
    const home = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().split("T")[0]; // dashboard.tsx todayStr와 같은 식
    expect(weekToday()).toBe(home);
    expect(weekToday()).toBe("2026-11-12");
    expect(weekSinceDate(weekToday())).toBe("2026-11-05");
  });
  it("월 경계(KST 11/01 00:30 → 10/25)", () => {
    vi.setSystemTime(new Date("2026-10-31T15:30:00Z"));
    expect(weekSinceDate(weekToday())).toBe("2026-10-25");
  });
});

describe("T10 팁·GA·화면 렌더", () => {
  it("week-causes는 market-compare 앞(isNew는 4.82에서 새 소식으로 흡수)", () => {
    const ids = APP_FEATURES.map((f) => f.id);
    expect(ids.indexOf("week-causes")).toBeGreaterThanOrEqual(0);
    expect(ids.indexOf("week-causes")).toBeLessThan(ids.indexOf("market-compare"));
    const f = APP_FEATURES.find((x) => x.id === "week-causes")!;
    expect(f.target).toEqual({ type: "activity", tab: "change", init: { scope: "all", period: "week" } });
    expect(f.entryCategory).toBe("change_week_all");
    expect(f.title).toBe("주간 변화 원인");
    expect(f.visitKey).toBe("change-week");
    // viewToKey는 init을 무시해 target만으로는 `change` 방문 집계와 같은 키 — visitKey로 분리했다
    expect(viewToKey(f.target!)).toBe("activity:change");
    expect(f.visitKey).not.toBe(viewToKey(f.target!));
  });
  it("GA 제목 `성과·자산 변화·최근 7일`", () => {
    expect(featureTitleOf("feature_use", { category: "change_week_all" }, "activity:change")).toBe("성과·자산 변화·최근 7일");
  });
  it("복원·첫 진입(init)은 렌더만으로 GA를 보내지 않는다", () => {
    h.sc = buildScenario(RICH_STEPS);
    renderToStaticMarkup(<AssetChangeView init={{ scope: "all", period: "week" }} />);
    expect(h.track).not.toHaveBeenCalled();
  });
  it("init 전체·주로 열린다 — 주 본문(원인 블록)이 나온다", () => {
    h.sc = buildScenario(RICH_STEPS);
    const html = renderToStaticMarkup(<AssetChangeView init={{ scope: "all", period: "week" }} />);
    expect(html).toContain('data-testid="cause-block"');
    expect(html).toContain('data-scope="week"');
  });

  const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  it("주 탭 본문 — 제목·구간·6줄 순서·푸터·접힘(기본 닫힘)", () => {
    h.sc = buildScenario(RICH_STEPS);
    const html = renderToStaticMarkup(<WeekList />);
    expect(html).toMatch(/data-testid="week-title"[^>]*>최근 7일</);
    expect(html).toMatch(/data-testid="week-range"[^>]*>11\/5 → 오늘</);
    expect(text(html)).not.toContain("이번 주");
    expect(text(html)).not.toContain("7일 전 대비");
    const order = ["cause-row-price", "cause-row-valuation", "cause-row-fx", "cause-row-unrecorded"].map((k) => html.indexOf(k));
    expect(order.every((i) => i > 0)).toBe(true);
    expect(order).toEqual([...order].sort((a, b) => a - b));
    expect(html).toContain('data-testid="week-market-link"');
    expect(html).toContain('aria-label="종목별 등락, 시장과 비교로 이동"');
    expect(html).toContain('data-testid="week-records"'); // 기록 내역(입출금·매매·대출 4건)
    expect(html).toMatch(/data-testid="week-closing-toggle"[^>]*aria-expanded="false"|aria-expanded="false"[^>]*data-testid="week-closing-toggle"/);
    expect(html).toMatch(/id="week-list"[^>]*inert/);
    expect(html).toContain("날짜별 마감 기준이라 위 금액과 조금 다를 수 있어요");
    expect(html).toContain('data-testid="week-row"');
    // 줄 data-value 합 = Hero 증감(5-4·수용 기준 2)
    const vals = [...html.matchAll(/data-testid="cause-row-[a-z]+" data-value="(-?\d+)"/g)].map((m) => Number(m[1]));
    const delta = Number(html.match(/data-testid="change-hero-delta" data-value="(-?\d+)"/)![1]);
    expect(vals.reduce((s, n) => s + n, 0)).toBe(delta);
  });
  it("정본 5-4(전제 확인): 끝 순자산 = 홈 Hero 순자산 원 단위, 시작 = 날짜별 마감 기록 11/5 행", () => {
    h.sc = buildScenario(RICH_STEPS);
    const html = renderToStaticMarkup(<WeekList />);
    expect(Number(html.match(/data-testid="change-hero-end" data-value="(-?\d+)"/)![1])).toBe(Math.round(h.sc.summary.netAsset));
    expect(Number(html.match(/data-testid="change-hero-start" data-value="(-?\d+)"/)![1])).toBe(Math.round(h.sc.daily[0].netAsset));
  });
  // qa D1(C65, 수용 기준 4): 시작일(D=7~9)이 7일 창 밖이어도 마감 기록 목록에 시작 행이 있어 Hero 시작과 같다
  it.each([["2026-11-05", 7], ["2026-11-04", 8], ["2026-11-03", 9]])("시작 행 포함 — 시작 %s(D=%i): change-hero-start = 마감 기록 시작 행", (start) => {
    h.sc = buildScenario(RICH_STEPS, { days: [start, "2026-11-08", "2026-11-09", "2026-11-10", "2026-11-11"] });
    const html = renderToStaticMarkup(<WeekList />);
    const heroStart = Number(html.match(/data-testid="change-hero-start" data-value="(-?\d+)"/)![1]);
    const startNet = Math.round(h.sc.daily[0].netAsset);
    expect(heroStart).toBe(startNet);
    const md = `${Number(start.slice(5, 7))}/${Number(start.slice(8, 10))}`;
    const rowHtml = html.split('data-testid="week-row"').slice(1).find((r) => r.includes(`>${md} (`));
    expect(rowHtml).toBeTruthy(); // 시작일 행이 목록에 있다
    expect(rowHtml).toContain(Math.round(startNet).toLocaleString("ko-KR"));
  });
  it("월 스냅샷 시작점(일별 행 없음): 시작 행은 없고 나머지 행은 그대로 — Hero 시작은 월 기록 값", () => {
    const sc = buildScenario(RICH_STEPS, { days: ["2026-11-09", "2026-11-10", "2026-11-11"] });
    const m = { ...snapOf(stateOn(RICH_STEPS, "2026-11-01"), rateAt(-4), "2026-11-01"), month: "2026-11" };
    h.sc = { ...sc, monthly: [m] };
    const html = renderToStaticMarkup(<WeekList />);
    expect(html).toMatch(/data-testid="week-title"[^>]*>11\/1 이후</);
    expect(html.split('data-testid="week-row"').length - 1).toBe(3); // 일별 기록 3행만
    expect(html).not.toContain(">11/1 (");
  });
  it("주식 미보유면 종목 등락 링크 없음", () => {
    const sc = buildScenario(RICH_STEPS);
    h.sc = { ...sc, assetData: { ...sc.assetData, stocks: [] } };
    expect(renderToStaticMarkup(<WeekList />)).not.toContain("week-market-link");
  });
  it("기록 없음 → week-empty, 원인·접힘 카드 없음", () => {
    h.sc = { ...buildScenario(RICH_STEPS), daily: [] };
    const html = renderToStaticMarkup(<WeekList />);
    expect(html).toContain('data-testid="week-empty"');
    expect(html).not.toContain("cause-block");
    expect(html).not.toContain("week-closing-toggle");
  });
  it("시작점이 14일 넘게 지남 → week-insufficient, 원인 없음, 접힘 카드는 있음", () => {
    h.sc = buildScenario([], { days: ["2026-10-20", "2026-11-11"] }); // sinceDate(11/5) 이하 가장 최근 = 10/20
    const html = renderToStaticMarkup(<WeekList />);
    expect(html).toContain('data-testid="week-insufficient"');
    expect(html).toContain("기록이 쌓이면 원인을 나눠 보여드려요");
    expect(html).not.toContain("cause-block");
    expect(html).toContain("week-closing-toggle");
  });
  it("뚜렷한 변화 없음 → 줄 없이 안내(원인 블록은 안내 한 줄)", () => {
    const sc = buildScenario([]);
    const assetData = stateOn([], "2026-11-05"); // 오늘 상태 = 시작 스냅샷 상태
    h.sc = { ...sc, assetData, rates: rateAt(0), summary: summaryOf(assetData, rateAt(0)) };
    const html = renderToStaticMarkup(<WeekList />);
    expect(html).toContain("뚜렷한 변화 원인이 없어요");
    expect(html).not.toContain("cause-row-");
  });
});
