import { describe, it, expect } from "vitest";
import { zeroSafe, signPrefix } from "../asset-report-view";

describe("성적표 0 표기 — 부호 없음", () => {
  it("−0·반올림 0은 부호·음수 없음", () => {
    expect(signPrefix(-0)).toBe("");
    expect(Object.is(zeroSafe(-0), 0)).toBe(true);
    expect(signPrefix(-0.04, 1)).toBe("");
    expect(zeroSafe(-0.04, 1).toFixed(1)).toBe("0.0");
    expect(zeroSafe(-0.04, 1).toFixed(1)).not.toContain("-");
  });
  it("양수는 +, 음수는 그대로", () => {
    expect(signPrefix(0.05, 1)).toBe("+");
    expect(signPrefix(1200)).toBe("+");
    expect(signPrefix(-1200)).toBe("");
    expect(zeroSafe(-0.06, 1)).toBe(-0.06);
  });
});
