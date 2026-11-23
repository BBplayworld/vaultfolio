import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PARAM_VALUES, __resetGaStateForTest, featureTitleOf, screenPath, track, trackScreen } from "@/lib/analytics/ga";

const read = (p: string) => readFileSync(join(process.cwd(), "src", p), "utf8");

describe("투자 탭 GA(#263, 기존 page_title 패턴만)", () => {
  it("화면 제목: 투자 · 가이드·시장 역사", () => {
    expect(featureTitleOf("page_view", {}, "invest")).toBe("투자");
    expect(featureTitleOf("page_view", {}, "guide:market-history")).toBe("가이드·시장 역사");
    expect(screenPath("guide:market-history")).toBe("/v/guide/market-history");
  });
  it("feature_use 제목 6종", () => {
    const t = (category: string) => featureTitleOf("feature_use", { category: category as never }, "invest");
    expect(t("invest_index_ndx")).toBe("투자·지수·나스닥100");
    expect(t("invest_index_kospi")).toBe("투자·지수·코스피");
    expect(t("invest_index_spx")).toBe("투자·지수·S&P 500");
    expect(t("invest_overlay")).toBe("투자·겹쳐 보기");
    expect(t("invest_table")).toBe("투자·연도별 표");
    expect(t("invest_calc")).toBe("투자·넣었다면 계산");
  });
  it("5.141 제목: 세 지수 — category만, 파라미터 0", () => {
    expect(featureTitleOf("feature_use", { category: "invest_three" }, "invest")).toBe("투자·세 지수");
    expect(featureTitleOf("feature_use", { category: "invest_decade" }, "invest")).toBe("투자·연대별");
    expect(featureTitleOf("feature_use", { category: "invest_ratio" }, "invest")).toBe("투자·내 비중 보기");
  });
  it("R4 제목 2종", () => {
    expect(featureTitleOf("feature_use", { category: "invest_rise_tab" }, "invest")).toBe("투자·크게 오른 해");
    expect(featureTitleOf("feature_use", { category: "invest_pattern" }, "invest")).toBe("투자·하락 전 12개월");
  });
  it("5.138 제목 2종(해 선택·하락 행 펼침) — 연도·금액 인자 없이 category만", () => {
    expect(featureTitleOf("feature_use", { category: "invest_year_pick" }, "invest")).toBe("투자·해 선택");
    expect(featureTitleOf("feature_use", { category: "invest_drop_open" }, "invest")).toBe("투자·하락 행 펼침");
    const src = read("app/(main)/_components/views/invest/invest-view.tsx");
    expect(src).toContain('once("invest_year_pick")');
    expect(src).toContain('once("invest_drop_open")');
    expect(read("app/(main)/_components/views/invest/year-grid.tsx")).not.toMatch(/track\(/);
  });
  it("가이드 CTA `가이드·내 자산 이동` — category만, 파라미터 0", () => {
    expect(featureTitleOf("feature_use", { category: "guide_move" }, "guide:market-history")).toBe("가이드·내 자산 이동");
    const src = read("app/guide/guide-actions.tsx");
    expect(src).toContain('track("feature_use", { category: "guide_move" })');
    expect(PARAM_VALUES.category).toContain("guide_move");
  });
  it("새 파라미터 키 0: category 값만 추가됐고 연도·금액·배수 값 목록은 없다", () => {
    expect(Object.keys(PARAM_VALUES).sort()).toEqual(["asset_type", "category", "content_type", "method", "result", "source", "step", "theme"]);
    expect(PARAM_VALUES.category.filter((c) => c.startsWith("invest_"))).toEqual(["invest_index_spx", "invest_index_ndx", "invest_index_kospi", "invest_three", "invest_decade", "invest_ratio", "invest_overlay", "invest_table", "invest_calc", "invest_rise_tab", "invest_pattern", "invest_year_pick", "invest_drop_open", "invest_phase_table", "invest_recession", "invest_range", "invest_my_start", "invest_my_xray"]);
  });
  it("투자 화면 소스는 track에 category만 넘긴다(보유 시장·연도·배수·금액 인자 0), 기본 지수 선택은 전송하지 않는다", () => {
    const src = read("app/(main)/_components/views/invest/invest-view.tsx");
    const calls = [...src.matchAll(/track\(([^)]*)\)/g)].map((m) => m[1]);
    expect(calls).toEqual(['"feature_use", { category }']);
    expect(src).toContain('once("invest_rise_tab")');
    expect(src).toContain('once("invest_pattern")');
    expect(src).toContain("once(`invest_index_${k}`)");
    expect(src).toMatch(/if \(k === idx\) return;/);
    // 기본 지수 판정(내 자산)은 GA 모듈을 쓰지 않는다
    expect(read("lib/invest/default-index.ts")).not.toMatch(/analytics|track\(/);
    expect(read("app/(main)/_components/views/invest/invest-lazy.tsx")).not.toMatch(/track\(/);
  });
});

describe("투자 탭 GA 전송(실제 gtag 호출)", () => {
  const gtag = vi.fn();
  beforeEach(() => {
    gtag.mockReset();
    (globalThis as unknown as { window: unknown }).window = { gtag, location: { origin: "https://www.secretasset.xyz", pathname: "/", search: "", hash: "" } };
    __resetGaStateForTest();
  });
  afterEach(() => { delete (globalThis as unknown as { window?: unknown }).window; });
  it("화면 진입 page_title `투자`, 지수 변경 title만 — 금액·연도 파라미터 없음", () => {
    trackScreen("invest");
    expect(gtag.mock.calls.at(-1)![2].page_title).toBe("투자");
    track("feature_use", { category: "invest_index_kospi" });
    const [, name, payload] = gtag.mock.calls.at(-1)!;
    expect(name).toBe("feature_use");
    expect(Object.keys(payload).sort()).toEqual(["page_location", "page_title"]);
    expect(payload.page_title).toBe("투자·지수·코스피");
    expect(payload.page_location).toBe("https://www.secretasset.xyz/v/invest");
  });
});
