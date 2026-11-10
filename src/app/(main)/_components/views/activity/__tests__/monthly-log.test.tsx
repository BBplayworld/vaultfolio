// 월별 기록(#127, 4.67 R3) — 월 탭 인라인 카드 노출 조건·위치, 줄 렌더(원 단위 순자산·변화 손익색·첫 기록·건너뛴 달·기록 없음·종류별 기록 없음),
// 기본 펼침·패널(자산군 기여 변화)·더 보기, 시트·표·가로 스크롤 제거, 읽기 전용
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { existsSync, readFileSync } from "node:fs";
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
import { MonthlyLogBlock, MONTHLY_LOG_CAPTION } from "../monthly-log-block";
import { buildMonthlyLog, buildMonthlyLogChanges, MONTHLY_LOG_KEYS } from "@/lib/report/monthly-log";
import { shiftMonth } from "@/lib/report/settlement";

const snap = (month: string, date: string, netAsset: number): MonthlyAssetSnapshot => ({ month, date, netAsset, financialAsset: netAsset });
const render = (initialMonth?: string) => renderToStaticMarkup(<SettlementView initialMonth={initialMonth} source="menu" />);
/** data-testid 요소의 여는 태그 */
const tagOf = (html: string, id: string) => {
  const at = html.indexOf(`data-testid="${id}"`);
  if (at < 0) throw new Error(`no ${id}`);
  return html.slice(html.lastIndexOf("<", at), html.indexOf(">", at) + 1);
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-05T03:00:00Z")); // KST 11/5
  Object.assign(h, { monthly: [snap("2026-09", "2026-09-28", 100_000_000), snap("2026-10", "2026-10-28", 109_000_000)], causesThrow: false, hasAssets: true });
});
afterEach(() => vi.useRealTimers());

describe("월 탭 인라인 카드 monthly-log-block", () => {
  it("기록된 달 3개: 카드 1개, 원인 블록 뒤·AI 질문 행 앞, 진입 행·시트·dialog 없음", () => {
    const html = render();
    expect(html.match(/data-testid="monthly-log-block"/g)?.length).toBe(1);
    const block = html.indexOf('data-testid="monthly-log-block"');
    expect(html.indexOf('data-testid="cause-block"')).toBeLessThan(block);
    expect(block).toBeLessThan(html.indexOf('data-testid="settlement-ai-button"'));
    expect(html).not.toMatch(/monthly-log-button|monthly-log-sheet|monthly-log-table|role="dialog"|aria-haspopup/);
    expect(html).toContain(MONTHLY_LOG_CAPTION);
  });
  it("선택 달과 무관 — 10월·11월 화면의 카드 마크업이 같다", () => {
    const cut = (x: string) => x.slice(x.indexOf('data-testid="monthly-log-block"'), x.indexOf('data-testid="settlement-ai-button"'));
    expect(cut(render("2026-10"))).toBe(cut(render("2026-11")));
  });
  it("기록된 달 2개(지난 달 1 + 진행 중): 카드 있음", () => {
    h.monthly = [snap("2026-10", "2026-10-28", 1)];
    expect(render("2026-11")).toContain('data-testid="monthly-log-block"');
  });
  it("첫 달 화면·이번 달만·빈 상태·계산 오류: 없음", () => {
    h.monthly = [snap("2026-10", "2026-10-28", 1)];
    const first = render("2026-10");
    expect(first).toContain("settlement-first-month");
    expect(first).not.toContain("monthly-log-block");
    h.monthly = [snap("2026-11", "2026-11-03", 1)];
    expect(render("2026-11")).not.toContain("monthly-log-block");
    h.monthly = [];
    expect(render()).not.toContain("monthly-log-block");
    h.monthly = [snap("2026-09", "2026-09-28", 1), snap("2026-10", "2026-10-28", 2)]; h.hasAssets = false;
    expect(render()).not.toContain("monthly-log-block");
    h.hasAssets = true; h.causesThrow = true;
    expect(render()).not.toContain("monthly-log-block");
  });
  it("brand 채움 버튼 아님(채움 버튼은 캘린더 추가 1개)", () => {
    const html = render();
    expect(html.match(/data-testid="prep-ics-button"/g)?.length).toBe(1);
    const block = html.slice(html.indexOf('data-testid="monthly-log-block"'), html.indexOf('data-testid="settlement-ai-button"'));
    expect(block).not.toMatch(/bg-brand|bg-primary /);
  });
});

describe("줄·패널 MonthlyLogBlock", () => {
  const TODAY = "2026-11-05";
  const monthly: MonthlyAssetSnapshot[] = [
    { month: "2026-07", netAsset: 300_000_000, financialAsset: 0 }, // 레거시(date·breakdown 없음)
    { month: "2026-08", date: "2026-08-28", netAsset: 410_000_000, financialAsset: 0,
      breakdown: { realEstate: 600_000_000, stocks: 30_000_000, crypto: 0, cash: 5_000, loans: 220_005_000, tenantDeposit: 0 } },
    { month: "2026-10", date: "2026-10-28", netAsset: 420_000_000, financialAsset: 0,
      breakdown: { realEstate: 600_000_000, stocks: 40_000_000, crypto: 0, cash: 0, loans: 220_000_000, tenantDeposit: 0 } },
  ];
  // 11월: 주식 +5,000,000, 대출 220,000,000 → 221,000,000(증가) — 순자산 +4,000,000
  const live = { breakdown: { realEstate: 600_000_000, stocks: 45_000_000, crypto: 0, cash: 0, loans: 221_000_000, tenantDeposit: 0, physical: 0 }, netAsset: 424_000_000 };
  const log = buildMonthlyLog(monthly, TODAY, live);
  const html = renderToStaticMarkup(<MonthlyLogBlock log={log} today={TODAY} />);

  it("섹션 헤더·캡션, 최신순, 이번 달 '진행 중'·'오늘', 레거시 'YYYY-MM 기록'", () => {
    expect(html).toContain('data-testid="monthly-log-title"');
    expect(html).toContain("월별 기록");
    expect(MONTHLY_LOG_CAPTION).toBe("금액 아래 숫자는 바로 앞 기록보다 늘거나 줄어든 금액이에요");
    const order = ["2026-11", "2026-10", "2026-09", "2026-08", "2026-07"].map((m) => html.indexOf(`monthly-log-row-${m}"`));
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(html).toMatch(/monthly-log-row-2026-11" data-kind="full" data-current=""/);
    expect(html).toContain("진행 중");
    expect(html).toContain("오늘");
    expect(html).toContain("10/28");
    expect(html).toContain("2026-07 기록");
  });
  it("순자산은 원 단위 전체, 짧은 표기(만·억) 없음, tabular-nums·nowrap", () => {
    expect(html).toMatch(/data-testid="monthly-log-net-2026-11"[^>]*>424,000,000원</);
    expect(html).toMatch(/data-testid="monthly-log-net-2026-07"[^>]*>300,000,000원</);
    expect(html).not.toMatch(/\d(만|억)/);
    expect(tagOf(html, "monthly-log-net-2026-11")).toContain("whitespace-nowrap");
    expect(html).toContain("tabular-nums");
  });
  it("전월 대비 변화: 상승 빨강 '+', 첫 기록은 '첫 기록'(색·부호 없음), 건너뛴 달 뒤 '· 8월 대비'", () => {
    expect(tagOf(html, "monthly-log-delta-2026-11")).toContain('data-value="4000000"');
    expect(html).toMatch(/monthly-log-delta-2026-11"[^>]*><span class="[^"]*text-rose-600[^"]*">\+4,000,000원</);
    expect(html).toMatch(/monthly-log-delta-2026-10"[^>]*><span class="[^"]*text-rose-600[^"]*">\+10,000,000원<\/span><span[^>]*>\u00a0· 8월 대비/);
    expect(html).not.toMatch(/monthly-log-delta-2026-11"[^>]*>.{0,200}대비/);
    expect(tagOf(html, "monthly-log-delta-2026-07")).toContain("data-first");
    expect(html).toMatch(/monthly-log-delta-2026-07"[^>]*>첫 기록</);
    expect(html).not.toMatch(/>-\d/);
  });
  it("하락은 파랑 U+2212, 0은 muted '0원'", () => {
    const down = buildMonthlyLog([snap("2026-10", "2026-10-28", 5_000)], TODAY, { breakdown: null, netAsset: 4_000 });
    const d = renderToStaticMarkup(<MonthlyLogBlock log={down} today={TODAY} />);
    expect(d).toMatch(/monthly-log-delta-2026-11"[^>]*><span class="[^"]*text-blue-600[^"]*">\u22121,000원</);
    const flat = buildMonthlyLog([snap("2026-10", "2026-10-28", 5_000)], TODAY, { breakdown: null, netAsset: 5_000 });
    const f = renderToStaticMarkup(<MonthlyLogBlock log={flat} today={TODAY} />);
    expect(f).toMatch(/monthly-log-delta-2026-11"[^>]*><span class="[^"]*text-muted-foreground[^"]*">0원</);
    expect(f).not.toMatch(/monthly-log-delta-2026-11"[^>]*><span class="[^"]*text-(rose|blue)-/);
  });
  it("기록 없음 줄: 비교·토글 없음 / 종류별 기록 없음 줄: 토글 없음·순자산 표시", () => {
    expect(html).toMatch(/monthly-log-row-2026-09" data-kind="gap"[^>]*>.*?기록 없음/);
    expect(html).not.toContain("monthly-log-delta-2026-09");
    expect(html).not.toContain("monthly-log-toggle-2026-09");
    expect(html).toMatch(/monthly-log-row-2026-07" data-kind="net-only"/);
    expect(html).not.toContain("monthly-log-toggle-2026-07");
    expect(html.slice(html.indexOf('monthly-log-row-2026-07"'))).toContain("종류별 기록 없음");
  });
  it("이번 달만 기본 펼침: aria-expanded·aria-controls, 접힌 패널은 inert·aria-hidden·0fr(항상 마운트)", () => {
    const t11 = tagOf(html, "monthly-log-toggle-2026-11");
    expect(t11).toContain('aria-expanded="true"');
    expect(t11).toContain('aria-controls="monthly-log-panel-2026-11"');
    expect(t11).toMatch(/min-h-14/);
    expect(tagOf(html, "monthly-log-toggle-2026-10")).toContain('aria-expanded="false"');
    expect(tagOf(html, "monthly-log-toggle-2026-08")).toContain('aria-expanded="false"');
    const p11 = tagOf(html, "monthly-log-panel-2026-11");
    expect(p11).toContain("grid-rows-[1fr]");
    expect(p11).not.toMatch(/inert|aria-hidden/);
    const p10 = tagOf(html, "monthly-log-panel-2026-10");
    expect(p10).toContain("grid-rows-[0fr]");
    expect(p10).toMatch(/inert=""/);
    expect(p10).toContain('aria-hidden="true"');
    expect(p10).toContain("motion-safe:transition-[grid-template-rows]");
  });
  it("패널: 자산군 금액·기여 변화 — 대출 증가는 파랑 U+2212, 합 = 순자산 변화, 0인 자산군 줄 없음", () => {
    expect(html).toMatch(/monthly-log-group-2026-11-loans" data-delta="-1000000"[^>]*>.*?\u2212221,000,000원.*?text-blue-600[^"]*">\u22121,000,000원/);
    expect(html).toMatch(/monthly-log-group-2026-11-stocks" data-delta="5000000"[^>]*>.*?45,000,000원.*?text-rose-600[^"]*">\+5,000,000원/);
    expect(html).toMatch(/monthly-log-group-2026-11-realEstate" data-delta="0"[^>]*>.*?text-muted-foreground">0원/);
    const deltas = [...html.matchAll(/monthly-log-group-2026-11-[a-zA-Z]+" data-delta="(-?\d+)"/g)].map((m) => Number(m[1]));
    expect(deltas.reduce((a, b) => a + b, 0)).toBe(4_000_000);
    expect(html).not.toContain("monthly-log-group-2026-11-crypto");
    expect(html).not.toContain("monthly-log-group-2026-11-cash"); // 10월·11월 모두 0
  });
  it("앞 기록이 레거시면 금액만 + 안내, 첫 기록 달 full 줄도 금액만", () => {
    expect(html).toMatch(/monthly-log-group-2026-08-stocks"[^>]*>(?:(?!data-delta).)*?30,000,000원<\/span><\/span>/);
    expect(html).toContain('data-testid="monthly-log-panel-note-2026-08"');
    expect(html).toContain("이전 기록에 종류별 값이 없어 금액만 보여요");
    expect(html).not.toContain("monthly-log-panel-note-2026-11");
  });
  it("sm 이상 패널 금액·변화 한 줄(sm:flex-row), 가로 스크롤 요소·표·transition-all 없음", () => {
    expect(html).toContain("sm:flex-row");
    expect(html).not.toMatch(/overflow-x-auto|overflow-auto|overflow-x-scroll|<table|transition-all|\btransition\b(?!-)/);
  });
  it("더 보기: 6줄 이하면 없음, 7줄 이상이면 처음 6줄 + '이전 N개월 더 보기'(40px)", () => {
    expect(html).not.toContain("monthly-log-more");
    const many = Array.from({ length: 12 }, (_, i) => snap(shiftMonth("2026-10", -i), `${shiftMonth("2026-10", -i)}-20`, 100_000_000 + i));
    const big = buildMonthlyLog(many, TODAY, { breakdown: null, netAsset: 100_000_000 });
    expect(big.rows).toHaveLength(13);
    const m = renderToStaticMarkup(<MonthlyLogBlock log={big} today={TODAY} />);
    expect(m.match(/data-testid="monthly-log-row-/g)).toHaveLength(6);
    expect(m).toContain("이전 7개월 더 보기");
    expect(tagOf(m, "monthly-log-more")).toContain("min-h-10");
    expect(m).toContain("최근 13개월까지 보여요");
  });
  it("변화 표시값 = buildMonthlyLogChanges, 자산군 키는 정해진 집합 안", () => {
    const ch = buildMonthlyLogChanges(log.rows);
    expect(ch.get("2026-11")!.net).toBe(4_000_000);
    expect(Object.keys(ch.get("2026-11")!.groups!).every((k) => (MONTHLY_LOG_KEYS as string[]).includes(k))).toBe(true);
  });
});

describe("문구·데이터 안전", () => {
  const files = [
    readFileSync("src/lib/report/monthly-log.ts", "utf8"),
    readFileSync("src/app/(main)/_components/views/activity/monthly-log-block.tsx", "utf8"),
  ];
  it("'월말'·투자 조언·상승/하락 어휘 0건, 시트 파일·GA 화면 키 제거", () => {
    for (const f of files) expect(f).not.toMatch(/월말|상승|하락|추천|매수하|매도하/);
    expect(existsSync("src/app/(main)/_components/views/activity/monthly-log-sheet.tsx")).toBe(false);
    expect(readFileSync("src/lib/analytics/ga.ts", "utf8")).not.toContain("activity:change:monthly-log");
  });
  it("저장·서버 전송 코드 0(localStorage·fetch·save·sync·clipboard·share 없음)", () => {
    for (const f of files) expect(f).not.toMatch(/localStorage|setItem|fetch\(|save[A-Z]|sync|clipboard|navigator\.share/i);
  });
});
