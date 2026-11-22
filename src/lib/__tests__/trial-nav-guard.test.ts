// 5.133 체험 중 스와이프 순서·해시 가드 — 체험이면 더보기·설정 제외, 체험 아니면 입력 그대로(실사용자 경로 무영향)
import { describe, expect, it } from "vitest";
import {
  guardTrialView,
  parseHash,
  swipeOrderOf,
  type AssetView,
} from "@/app/(main)/_components/layout/navigation/navigation-context";

describe("swipeOrderOf", () => {
  it("체험: 홈·상세·성과·투자(더보기는 순서 밖)", () => {
    expect(swipeOrderOf(true)).toEqual(["home", "detail", "activity", "invest"]);
  });
  it("체험 아님: 같은 순서(더보기는 홈 헤더에서 여는 페이지라 순서 밖)", () => {
    expect(swipeOrderOf(false)).toEqual(["home", "detail", "activity", "invest"]);
  });
});

describe("guardTrialView", () => {
  it("체험 중 #more·#settings → 홈", () => {
    expect(guardTrialView(parseHash("#more"), true)).toEqual({ type: "home" });
    expect(guardTrialView(parseHash("#settings"), true)).toEqual({ type: "home" });
    expect(guardTrialView({ type: "settings", focus: "notify" }, true)).toEqual({ type: "home" });
  });
  const keep: AssetView[] = [
    { type: "home" },
    { type: "detail", tab: "hub" },
    { type: "activity", tab: "hub" },
    { type: "tax" },
  ];
  it.each(keep)("체험 중 그 밖 화면은 같은 참조 %o", (v) => {
    expect(guardTrialView(v, true)).toBe(v);
  });
  it("체험 아님: 더보기·설정 포함 전부 같은 참조", () => {
    const all: AssetView[] = [...keep, { type: "more" }, { type: "settings" }, { type: "settings", focus: "notify" }];
    for (const v of all) expect(guardTrialView(v, false)).toBe(v);
  });
});
