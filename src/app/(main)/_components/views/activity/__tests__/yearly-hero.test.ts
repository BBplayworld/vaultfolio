// 5.108 연 Hero — 올해 항목이 없으면 작년 값만 있어도 '진행 중' 비교 대신 안내만
import { describe, expect, it } from "vitest";
import { yearlyHeroNoCurrentYear, yearlyNoCurrentMessage } from "../net-asset-chart";

describe("연 Hero 올해 항목 판정", () => {
  it("[올해-1] 1건 → 안내(올해 순자산이 기록되면 …)", () => {
    expect(yearlyHeroNoCurrentYear(2025, 2026)).toBe(true);
    expect(yearlyNoCurrentMessage(2025)).toBe("올해 순자산이 기록되면 2025년 말과 비교해 드려요");
  });
  it("[2024, 2025]도 올해 항목 없음 → 안내(2025를 진행 중으로 보이지 않음)", () => {
    expect(yearlyHeroNoCurrentYear(2025, 2026)).toBe(true);
  });
  it("[올해-1, 올해] 또는 올해 이후 항목 → 현행 Hero", () => {
    expect(yearlyHeroNoCurrentYear(2026, 2026)).toBe(false);
    expect(yearlyHeroNoCurrentYear(2027, 2026)).toBe(false);
  });
  it("항목 없음 → 현행(작년 말 순자산을 넣으면 …)", () => {
    expect(yearlyHeroNoCurrentYear(undefined, 2026)).toBe(false);
  });
});
