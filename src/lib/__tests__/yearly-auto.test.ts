import { describe, expect, it } from "vitest";
import { yearlyAutoCaption, yearlyAutoCaptionText, yearlyEditDefaults } from "../asset/yearly-auto";

const snap = (month: string, netAsset: number, date?: string) => ({ month, netAsset, financialAsset: 0, date });

describe("yearlyAutoCaption (D1·D2 픽스처 3종)", () => {
  it("2025 자동 + 마지막 월 스냅샷 날짜·값 일치 → 날짜 문구", () => {
    const c = yearlyAutoCaption({ year: 2025, netAsset: 500, note: "자동" }, [snap("2025-11", 400, "2025-11-30"), snap("2025-12", 500, "2025-12-20")]);
    expect(c).toEqual({ year: 2025, date: "12/20" });
    expect(yearlyAutoCaptionText(c!)).toBe("2025년 말 값은 12/20 기록이에요");
    expect(yearlyAutoCaptionText(c!)).not.toMatch(/12\/31|종가/);
  });
  it("자동 + 스냅샷 없음·값 불일치·date 없음 → 날짜 없는 문구", () => {
    const prev = { year: 2025, netAsset: 500, note: "자동" };
    for (const m of [[], [snap("2025-12", 999, "2025-12-20")], [snap("2025-12", 500)]]) {
      expect(yearlyAutoCaptionText(yearlyAutoCaption(prev, m)!)).toBe("2025년 말 값은 자동으로 기록된 값이에요");
    }
  });
  it("수동 prev·prev 없음(연 값 1건) → 캡션 없음", () => {
    expect(yearlyAutoCaption({ year: 2025, netAsset: 1, note: "내 메모" }, [])).toBeNull();
    expect(yearlyAutoCaption({ year: 2025, netAsset: 1 }, [])).toBeNull();
    expect(yearlyAutoCaption(null, [])).toBeNull();
  });
});

describe("yearlyEditDefaults (D3)", () => {
  it("지난 연도 자동 → 메모 빈 칸, 값 유지", () => {
    expect(yearlyEditDefaults({ year: 2025, netAsset: 7, note: "자동" }, 2026)).toEqual({ year: 2025, netAsset: 7, note: "" });
  });
  it("올해 자동 → 자동 유지, 수동 → 그대로", () => {
    const cur = { year: 2026, netAsset: 7, note: "자동" };
    expect(yearlyEditDefaults(cur, 2026)).toBe(cur);
    const man = { year: 2025, netAsset: 7, note: "메모" };
    expect(yearlyEditDefaults(man, 2026)).toBe(man);
  });
});
