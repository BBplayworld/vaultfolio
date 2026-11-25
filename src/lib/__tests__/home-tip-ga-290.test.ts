import { describe, it, expect } from "vitest";
import { featureTitleOf, PARAM_VALUES } from "@/lib/analytics/ga";

// #290(5.148) 홈 팁 종류별 보임·누름 title
const VIEW: Record<string, string> = {
  backup: "백업", tax: "세금", settlement: "결산", due: "점검 차례", whats_new: "새 소식",
  relink: "끊긴 거래", refresh: "최신화", notify: "알림", feature: "기능",
};
const CLICK: Record<string, string> = {
  backup: "백업", tax: "세금", settlement: "결산", whats_new: "새 소식", relink: "끊긴 거래", refresh: "최신화", feature: "기능",
};

describe("홈 팁 종류별 GA title", () => {
  it("보임 9종", () => {
    for (const [k, n] of Object.entries(VIEW)) {
      expect(featureTitleOf("feature_use", { category: `tip_view_${k}` as never }, "home")).toBe(`홈 팁 보임·${n}`);
    }
  });
  it("누름 7종 (점검 차례·알림은 기존 title)", () => {
    for (const [k, n] of Object.entries(CLICK)) {
      expect(featureTitleOf("feature_use", { category: `tip_click_${k}` as never }, "home")).toBe(`홈 팁 누름·${n}`);
    }
    expect(featureTitleOf("feature_use", { category: "home_tip_due" }, "home")).toBe("홈 팁·점검 차례");
    expect(featureTitleOf("feature_use", { category: "home_tip_notify", method: "click" }, "home")).toBe("홈 팁·알림·누름");
  });
  it("기존 홈 팁 title 유지 + 신규 category 16개 등록", () => {
    expect(featureTitleOf("feature_use", { category: "home_tip", method: "view" }, "home")).toBe("홈 팁");
    expect(featureTitleOf("feature_use", { category: "home_tip", method: "click" }, "home")).toBe("홈 팁·누름");
    expect(PARAM_VALUES.category.filter((c) => c.startsWith("tip_view_") || c.startsWith("tip_click_"))).toHaveLength(16);
  });
});
