// 월 탭 자산 구성 변화(#83, 4.48) — 비교 구간·반올림 차·숨김 조건·금지어·끝값 출처·결산 파일 diff 범위
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { COMPOSITION_FORBIDDEN_WORDS, COMPOSITION_KEYS, computeMonthComposition, type CompositionBreakdown } from "../composition";
import { resolveSettlementWindow, settlementRangeLabel } from "../settlement";
import { buildLiveAttributionCurr } from "../asset-report";
import { CompositionBlock, COMPOSITION_HINT, COMPOSITION_COLORS } from "@/app/(main)/_components/views/activity/composition-block";
import { MAIN_PALETTE } from "@/config/theme";
import type { AssetData, MonthlyAssetSnapshot, SnapshotBreakdown } from "@/types/asset";

const bd = (realEstate: number, stocks: number, crypto: number, cash: number, loans = 0): SnapshotBreakdown => ({ realEstate, stocks, crypto, cash, loans });
const snap = (month: string, date: string | undefined, b?: SnapshotBreakdown): MonthlyAssetSnapshot => ({
  month, netAsset: 100, financialAsset: 100, ...(date ? { date } : {}), ...(b ? { breakdown: b } : {}),
});
const TODAY = "2026-11-15";
const win = (monthly: MonthlyAssetSnapshot[], month: string) => resolveSettlementWindow(monthly, month, TODAY);

describe("computeMonthComposition — 비교 구간·반올림 차", () => {
  const monthly = [snap("2026-09", "2026-09-30", bd(620, 200, 30, 150)), snap("2026-10", "2026-10-31", bd(580, 240, 20, 160))];
  const c = computeMonthComposition(win(monthly, "2026-10"))!;
  it("시작=w.start.breakdown, 끝=w.end.breakdown, 라벨은 Hero 시작·끝점과 같은 글자", () => {
    const byKey = Object.fromEntries(c.items.map((i) => [i.key, i]));
    expect(byKey.realEstate.startPct).toBe(62);
    expect(byKey.realEstate.endPct).toBe(58);
    expect(byKey.realEstate.deltaText).toBe("−4%p");
    expect(byKey.stocks.deltaText).toBe("+4%p");
    expect([c.startLabel, c.endLabel].join(" → ")).toBe(settlementRangeLabel(win(monthly, "2026-10")));
  });
  it("증감 = round(끝) − round(시작), 합은 100%(±1), 사실 문장은 큰 순서 2개", () => {
    for (const i of c.items) expect(i.delta).toBe(Math.round(i.endRatio) - Math.round(i.startRatio));
    expect(Math.abs(c.items.reduce((s, i) => s + i.startRatio, 0) - 100)).toBeLessThan(1e-9);
    expect(c.sentence).toBe("이 구간 동안 부동산 −4%p, 주식 +4%p");
    expect(COMPOSITION_KEYS).toHaveLength(4);
  });
  it("실제 차가 1%p 미만이라도 반올림 차 0이면 '변화 없음', 전부 0이면 '거의 같아요'", () => {
    const m2 = [snap("2026-09", "2026-09-30", bd(500, 500, 0, 0)), snap("2026-10", "2026-10-31", bd(504, 496, 0, 0))];
    const r = computeMonthComposition(win(m2, "2026-10"))!;
    expect(r.items.map((i) => i.deltaText)).toEqual(["변화 없음", "변화 없음"]);
    expect(r.sentence).toBe("이 구간 동안 구성이 거의 같아요");
  });
  it("1% 미만은 '<1%', 새 자산군(0%→n%)은 그대로 표시", () => {
    const m3 = [snap("2026-09", "2026-09-30", bd(900, 100, 0, 0)), snap("2026-10", "2026-10-31", bd(890, 105, 4, 1))];
    const r = computeMonthComposition(win(m3, "2026-10"))!;
    const cr = r.items.find((i) => i.key === "crypto")!;
    expect([cr.startText, cr.endText, cr.deltaText]).toEqual(["0%", "<1%", "변화 없음"]);
    const m4 = [snap("2026-09", "2026-09-30", bd(900, 100, 0, 0)), snap("2026-10", "2026-10-31", bd(800, 100, 100, 0))];
    const r4 = computeMonthComposition(win(m4, "2026-10"))!;
    expect(r4.items.find((i) => i.key === "crypto")!.deltaText).toBe("+10%p");
  });
  it("부채는 분모에 넣지 않는다(loans 무시)", () => {
    const m5 = [snap("2026-09", "2026-09-30", bd(500, 500, 0, 0, 9999)), snap("2026-10", "2026-10-31", bd(500, 500, 0, 0, 1))];
    expect(computeMonthComposition(win(m5, "2026-10"))!.items[0].startPct).toBe(50);
  });
});

describe("computeMonthComposition — 숨김 조건", () => {
  const ok = [snap("2026-09", "2026-09-30", bd(600, 400, 0, 0)), snap("2026-10", "2026-10-31", bd(500, 500, 0, 0))];
  it("첫 달·시작 breakdown 없음(7월 결산·레거시)·끝 breakdown 없음", () => {
    expect(computeMonthComposition(win([snap("2026-10", "2026-10-31", bd(1, 1, 0, 0))], "2026-10"))).toBeNull();
    expect(computeMonthComposition(win([snap("2026-09", "2026-09-30"), ok[1]], "2026-10"))).toBeNull();
    expect(computeMonthComposition(win([ok[0], snap("2026-10", "2026-10-31")], "2026-10"))).toBeNull();
    expect(computeMonthComposition(win([snap("2026-07", undefined, bd(600, 400, 0, 0)), snap("2026-08", "2026-08-31")], "2026-08"))).toBeNull();
  });
  it("총자산 0, 두 시점 모두 단일 자산군이면 숨김(한쪽만 단일이면 표시)", () => {
    expect(computeMonthComposition(win([snap("2026-09", "2026-09-30", bd(0, 0, 0, 0)), ok[1]], "2026-10"))).toBeNull();
    expect(computeMonthComposition(win([snap("2026-09", "2026-09-30", bd(1000, 0, 0, 0)), snap("2026-10", "2026-10-31", bd(900, 0, 0, 0))], "2026-10"))).toBeNull();
    expect(computeMonthComposition(win([snap("2026-09", "2026-09-30", bd(1000, 0, 0, 0)), ok[1]], "2026-10"))).not.toBeNull();
  });
  it("이번 달인데 live 없음 → 숨김", () => {
    expect(computeMonthComposition(win([ok[0]], "2026-11"))).toBeNull();
  });
});

describe("끝값 출처 — 이번 달은 buildLiveAttributionCurr breakdown(Hero·원인과 같은 값)", () => {
  it("live.breakdown 그대로 비중 계산, 라벨 '지금'", () => {
    const summary = { realEstateValue: 300, stockValue: 500, cryptoValue: 100, cashValue: 100, loanBalance: 777, tenantDepositTotal: 0,
      netAsset: 0, totalValue: 1000, realEstateCost: 0, stockCost: 0, cryptoCost: 0 } as never;
    const assetData = { stocks: [], crypto: [], cash: [], loans: [], realEstate: [] } as unknown as AssetData;
    const live = buildLiveAttributionCurr(assetData, { USD: 1400, JPY: 900 }, summary);
    const w = win([snap("2026-10", "2026-10-31", bd(500, 500, 0, 0))], "2026-11");
    const c = computeMonthComposition(w, live.breakdown as CompositionBreakdown)!;
    expect(c.endLabel).toBe("지금");
    expect(c.items.map((i) => i.endPct)).toEqual([30, 50, 10, 10]);
    expect(c.items.map((i) => i.endRatio)).toEqual([30, 50, 10, 10]);
  });
});

describe("문구·색·렌더", () => {
  it("힌트·배지·문장·행 문구에 금지어 0건, 힌트에 '부채를 뺀'·'소수' 없음", () => {
    const monthly = [snap("2026-09", "2026-09-30", bd(620, 200, 30, 150)), snap("2026-10", "2026-10-31", bd(580, 240, 20, 160))];
    const c = computeMonthComposition(win(monthly, "2026-10"))!;
    const texts = [COMPOSITION_HINT, "총자산 기준", "자산 구성 변화", c.sentence, ...c.items.flatMap((i) => [i.startText, i.endText, i.deltaText])].join("\n");
    for (const w of COMPOSITION_FORBIDDEN_WORDS) expect(texts).not.toContain(w);
    expect(COMPOSITION_HINT).not.toMatch(/부채를 뺀|소수/);
    expect(COMPOSITION_HINT).toBe("홈 도넛은 부채도 함께 나눠 보여줘서 같은 항목도 %가 다를 수 있어요. 이 블록은 부동산·주식·암호화폐·현금성의 합을 100%로 봐요.");
  });
  it("색은 MAIN_PALETTE 고정 매핑", () => {
    expect(COMPOSITION_COLORS).toEqual({ realEstate: MAIN_PALETTE[0], stocks: MAIN_PALETTE[4], crypto: MAIN_PALETTE[3], cash: MAIN_PALETTE[5] });
  });
  it("블록 DOM: 배지·막대 2줄·행·손익색 0·금액 0·실제 비중 폭, 숨김이면 빈 출력", () => {
    const monthly = [snap("2026-09", "2026-09-30", bd(620, 200, 30, 150)), snap("2026-10", "2026-10-31", bd(580, 240, 20, 160))];
    const html = renderToStaticMarkup(createElement(CompositionBlock, { w: win(monthly, "2026-10") }));
    expect(html).toContain('data-testid="composition-block"');
    expect(html).toContain(">총자산 기준<");
    expect(html).toContain("data-screenshot-hide");
    expect(html.match(/data-testid="composition-bar-(start|end)"/g)).toHaveLength(2);
    expect(html).toContain('data-ratio="62"');
    expect(html).toContain("62% → 58%");
    expect(html).toContain("−4%p");
    expect(html).toContain('aria-hidden="true"');
    expect(html).not.toMatch(/text-(red|blue)-|profit|loss|aria-pressed|원</);
    // 막대 안 %는 10% 이상만 — 3%(암호화폐 시작)에는 글자 없음
    expect(html).not.toMatch(/composition-seg-start-crypto[^>]*>3%</);
    expect(renderToStaticMarkup(createElement(CompositionBlock, { w: win(monthly, "2026-09") }))).toBe("");
  });
});

describe("결산 파일 diff 범위(정적 검사)", () => {
  const view = readFileSync("src/app/(main)/_components/views/activity/settlement-view.tsx", "utf8");
  it("렌더 1줄 + import + memo live 뿐, Hero·원인·AI 행 코드는 그대로", () => {
    expect(view.match(/<CompositionBlock /g)).toHaveLength(1);
    expect(view).toContain("<CauseBlock key={month} scope=\"month\" mapped={mapped} estimatedLabel={estimatedLabel} />");
    expect(view.indexOf("<CauseBlock")).toBeLessThan(view.indexOf("<CompositionBlock"));
    expect(view.indexOf("<CompositionBlock")).toBeLessThan(view.indexOf("SettlementAiButton name"));
  });
  it("origin/main 대비 settlement-view diff 허용 줄만(+import, live 3곳, +렌더(빈 줄 포함)), 무변경 파일은 diff 0", () => {
    let diff = "";
    try { diff = execSync("git diff origin/main -- 'src/app/(main)/_components/views/activity/settlement-view.tsx'", { encoding: "utf8" }); } catch { return; }
    if (!diff) return;
    const added = diff.split("\n").filter((l) => l.startsWith("+") && !l.startsWith("+++"));
    expect(added.length).toBeLessThanOrEqual(6);
    expect(diff.split("\n").filter((l) => l.startsWith("-") && !l.startsWith("---")).length).toBeLessThanOrEqual(2);
    for (const f of ["src/lib/report/settlement.ts", "src/app/(main)/_components/views/activity/change-hero.tsx", "src/app/(main)/_components/views/activity/asset-change-view.tsx", "src/lib/ai-prompts.ts"]) {
      expect(execSync(`git diff origin/main -- '${f}'`, { encoding: "utf8" })).toBe("");
    }
  });
});
