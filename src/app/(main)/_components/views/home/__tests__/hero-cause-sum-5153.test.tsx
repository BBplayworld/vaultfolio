// 5.153 B: 홈 Hero 증감 글자와 원인 행 글자가 같은 돈을 같은 숫자로 보여 주는지 **표시 문자열 단계**에서 고정한다.
// 5.152 E(cause-consistency-5152)는 엔진 원 단위만 비교해 축약·버림 차이가 빠졌다(CHECKLIST: 합계·내역 표시 문자열 일치).
// 픽스처는 year-settlement-fixture(실데이터 형태) 재사용. 홈은 정적 렌더(NetAssetSummaryBox) 결과에서 글자를 읽는다.
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("@/app/(main)/_components/layout/navigation/navigation-context", () => ({
  useAssetNavigation: () => ({ navigate: () => {} }),
}));

import { NetAssetSummaryBox } from "../dashboard";
import { buildLiveAttributionCurr, CAUSE_DISPLAY_MIN } from "@/lib/report/asset-report";
import { computeChainCauses, computeSettlementCauses, signed } from "../../activity/change-hero";
import { computeAttributionView, mapWeekCauses } from "../../activity/week-attribution";
import { M, R0, mkSnap, state, summaryOf } from "@/lib/report/__tests__/year-settlement-fixture";
import type { AssetData, DailyAssetSnapshot } from "@/types/asset";

const TODAY = "2026-11-20";
const START = "2026-10-31";
beforeAll(() => { vi.useFakeTimers(); vi.setSystemTime(new Date(`${TODAY}T03:00:00Z`)); });
afterAll(() => vi.useRealTimers());

type Rates = typeof R0;
type Mut = (d: AssetData) => void;
function scenario(mutate: Mut, rates: Rates = R0) {
  const startData = state({ krwPrice: 60000, cash: 32 * M, loan: 10 * M, tx: [], y2026: 112 * M });
  const start = mkSnap(startData, R0, "2026-10", START);
  const end = structuredClone(startData);
  mutate(end);
  const summary = summaryOf(end, rates);
  const view = computeAttributionView({ assetData: end, rates, summary, daily: [start as unknown as DailyAssetSnapshot], monthly: [], exchangeHistory: {}, sinceDate: START })!;
  const live = buildLiveAttributionCurr(end, rates, summary);
  const deltaNet = summary.netAsset - start.netAsset;
  const common = { live, deltaNet, endDate: TODAY, liveCash: summary.cashValue, exchangeHistory: {}, assetData: end, rates };
  return {
    view,
    week: mapWeekCauses(view),
    month: computeSettlementCauses({ ...common, start, end: null, startDate: START }).mapped,
    year: computeChainCauses({ ...common, points: [start] }).mapped,
  };
}

// 홈 Hero 뷰모델 — useHeaderNetChange와 같은 필드 구성(pct는 글자 비교 대상 아님)
function homeChange(view: ReturnType<typeof scenario>["view"]) {
  const d = view.attr.deltaNet;
  return {
    deltaNet: d, pct: 0, isBig: false, negligible: Math.abs(d) < CAUSE_DISPLAY_MIN, label: "전일 대비",
    estimated: view.attr.estimated, sentence: view.sentence, causes: view.causes, offsetTotal: view.offsetTotal,
  };
}
function renderHome(view: ReturnType<typeof scenario>["view"]) {
  const html = renderToStaticMarkup(<NetAssetSummaryBox netAsset={100 * M} treemapData={[]} showRealtimeBadge change={homeChange(view)} />);
  const hero = html.match(/<span class="whitespace-nowrap">([▲▼][^<]*)<\/span>/)![1];
  const line = html.match(/data-testid="home-cause-line"[\s\S]*?shrink-0 text-sm font-semibold tabular-nums[^"]*">([^<]+)</)![1];
  const rows = [...html.matchAll(/tabular-nums shrink-0[^"]*">([^<]+)<\/span><\/li>/g)].map((m) => m[1]);
  return { hero, line, rows, keys: view.causes.map((c) => c.key) };
}
// 표시 글자 → 만원 정수(부호 포함). 1억 이상은 0.1억 축약이라 합 비교에서 뺀다
const manOf = (s: string) => {
  const t = s.replace(/[▲▼\s,]/g, "");
  const neg = t.startsWith("-") || t.startsWith("−");
  const n = t.replace(/^[+\-−]/, "");
  const v = n.endsWith("억원") ? Math.round(parseFloat(n) * 10000) : parseInt(n, 10);
  return neg ? -v : v;
};

const cash = (delta: number): Mut => (d) => { d.cash[0].balance += delta; };
const krw = (perShare: number): Mut => (d) => { d.stocks[0].currentPrice += perShare; }; // 1,000주 → perShare×1,000원
const loan = (delta: number): Mut => (d) => { d.loans[0].balance += delta; };
const all = (...ms: Mut[]): Mut => (d) => ms.forEach((m) => m(d));

describe("B 홈 Hero ↔ 원인 행 표시 글자", () => {
  it("H1 원인 1개 +25,900원", () => {
    const r = renderHome(scenario(cash(25_900)).view);
    // 결함: Hero는 만원 미만 버림(formatShortCurrency), 행은 반올림(fmtManwon) — 같은 돈이 2만원/3만원
    expect(r).toEqual({ hero: "▲ +2만원", line: "+3만원", rows: ["+3만원"], keys: ["cash"] });
  });
  it("H2 원인 1개 −25,900원", () => {
    const r = renderHome(scenario(cash(-25_900)).view);
    // 결함: 금액 2만원/3만원 + 부호 글리프 ASCII '-'(Hero) vs U+2212 '−'(행)
    expect(r).toEqual({ hero: "▼ -2만원", line: "−3만원", rows: ["−3만원"], keys: ["cash"] });
  });
  it("H3 원인 1개 1.25억", () => {
    const r = renderHome(scenario(cash(125_000_000)).view);
    // 결함: Hero 0.1억 버림 1.2억, 행 toFixed 반올림 1.3억
    expect(r).toEqual({ hero: "▲ +1.2억원", line: "+1.3억원", rows: ["+1.3억원"], keys: ["cash"] });
  });
  it("H4 상쇄 +30.4만·−10.2만", () => {
    const r = renderHome(scenario(all(krw(304), loan(102_000))).view);
    expect(r).toEqual({ hero: "▲ +20만원", line: "+30만원", rows: ["+30만원", "−10만원"], keys: ["price:stock", "debt"] });
  });
  it("H5 3행 반올림 합 초과(+15.6만·+30만·+5.7만)", () => {
    const r = renderHome(scenario(all(krw(156), cash(57_000)), { USD: 1515, JPY: 900 }).view);
    // 결함: 행 합 52만원 ≠ Hero 51만원
    expect(r).toEqual({ hero: "▲ +51만원", line: "+30만원", rows: ["+16만원", "+30만원", "+6만원"], keys: ["price:stock", "fx", "cash"] });
  });
  it("H6 3행 반올림 합 미달(+15.4만·+5.4만·+10.4만)", () => {
    const r = renderHome(scenario(all(krw(154), cash(54_000), loan(-104_000))).view);
    // 결함: 행 합 30만원 ≠ Hero 31만원
    expect(r).toEqual({ hero: "▲ +31만원", line: "+15만원", rows: ["+15만원", "+5만원", "+10만원"], keys: ["price:stock", "cash", "debt"] });
  });
  it("H7 1억 이상 여럿(+1.25억·+3.46만)", () => {
    const r = renderHome(scenario(all(krw(125_000), cash(34_600))).view);
    // 결함: 원인 행 1.3억(반올림) vs Hero 1.2억(버림)
    expect(r).toEqual({ hero: "▲ +1.2억원", line: "+1.3억원", rows: ["+1.3억원", "+3만원"], keys: ["price:stock", "cash"] });
  });
  it("H8 외화 소수(USD 단가 200.37·환율 1512.47, C65)", () => {
    const r = renderHome(scenario((d) => { d.stocks[1].currentPrice = 200.37; }, { USD: 1512.47, JPY: 900 }).view);
    // 결함: 행 합 31만원(5.6만·24.9만 반올림) ≠ Hero 30만원
    expect(r).toEqual({ hero: "▲ +30만원", line: "+25만원", rows: ["+6만원", "+25만원"], keys: ["price:stock", "fx"] });
  });
  it("H9 잔차 흡수 행(임계 미만 원인 2개 합 1.2만이 가장 큰 같은 부호 행에 얹힘)", () => {
    const r = renderHome(scenario(all(krw(203), cash(6_000), loan(-6_000))).view);
    // 결함: 행 22만원(21.5 반올림) ≠ Hero 21만원
    expect(r).toEqual({ hero: "▲ +21만원", line: "+22만원", rows: ["+22만원"], keys: ["price:stock"] });
  });
});

// 수용 기준(A) — 원인 1개면 행 글자 = Hero 글자, 1억 미만 행만이면 행 표시 합 = Hero(만원), 0만원·부호 반전 0, 음수는 U+2212
const ACCEPT: [string, Mut, Rates?][] = [
  ["H1", cash(25_900)], ["H2", cash(-25_900)], ["H3", cash(125_000_000)], ["H4", all(krw(304), loan(102_000))],
  ["H5", all(krw(156), cash(57_000)), { USD: 1515, JPY: 900 }], ["H6", all(krw(154), cash(54_000), loan(-104_000))],
  ["H7", all(krw(125_000), cash(34_600))], ["H8", (d) => { d.stocks[1].currentPrice = 200.37; }, { USD: 1512.47, JPY: 900 }],
  ["H9", all(krw(203), cash(6_000), loan(-6_000))], ["H10 음수 3행", all(krw(-156), cash(-57_000), loan(104_000))],
];
function accept(mut: Mut, rates?: Rates) {
  const { view } = scenario(mut, rates);
  const r = renderHome(view);
  const heroBody = r.hero.slice(2); // "▲ " / "▼ " 뒤
  expect(heroBody).not.toContain("-"); // ASCII 하이픈 금지(U+2212)
  if (r.rows.length === 1) expect(r.rows[0]).toBe(heroBody);
  r.rows.forEach((t, i) => {
    expect(manOf(t)).not.toBe(0);
    expect(Math.sign(manOf(t))).toBe(Math.sign(view.causes[i].amount));
  });
  // 같은 부호 행만 있으면 어느 행도 Hero보다 클 수 없다(1억 이상 0.1억 축약 행 포함)
  if (r.rows.every((t) => Math.sign(manOf(t)) === Math.sign(manOf(heroBody)))) r.rows.forEach((t) => expect(Math.abs(manOf(t))).toBeLessThanOrEqual(Math.abs(manOf(heroBody))));
  if (r.rows.every((t) => !t.endsWith("억원"))) expect(r.rows.reduce((a, t) => a + manOf(t), 0)).toBe(manOf(heroBody));
}
describe("수용 — 표시 합 = Hero", () => {
  // 결함: 수정 전(5.150) 동작 — H4(상쇄, 이미 일치)만 통과하고 나머지는 실패한다
  for (const [name, mut, rates] of ACCEPT) (name === "H4" ? it : it.fails)(name, () => accept(mut, rates));
});

// 성과 주·월·연 — Hero(signed)와 행(signed)이 같은 formatPriceByMode라 현행 일치. 기대값 변경 없이 회귀만 고정한다
describe("B 성과 주·월·연 Hero ↔ 행 (현행 일치 회귀)", () => {
  const s = scenario(cash(25_900));
  const d = s.view.attr.deltaNet;
  const won = (t: string) => Number(t.replace(/[^\d]/g, "")) * (/^[-−]/.test(t) ? -1 : 1);
  for (const [name, causes] of [["주", s.week.causes], ["월", s.month.causes], ["연", s.year.causes]] as const) {
    it(`${name}: 원인 1개 +25,900원 — 행 글자 = Hero 글자`, () => {
      expect(causes).toHaveLength(1);
      // 의도: 성과 탭은 원 단위 전액 표기(formatPriceByMode full-only)라 버림·반올림 차이가 없다
      expect(signed(causes[0].amount)).toBe(signed(d));
      expect(causes.reduce((acc, c) => acc + won(signed(c.amount)), 0)).toBe(won(signed(d)));
    });
  }
});
