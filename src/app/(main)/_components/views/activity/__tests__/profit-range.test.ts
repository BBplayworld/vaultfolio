// 주식 Hero 기준 종가 구간 표기(#32 r2 qa 권고) — 해가 다르면 연도를 붙여 거꾸로 읽히지 않게
import { describe, expect, it } from "vitest";
import { formatRefRange, isRefMissing } from "../profit-chart";

describe("formatRefRange", () => {
  it("같은 해는 M/D", () => {
    expect(formatRefRange("2026-10-27", "2026-10-28")).toBe("10/27 → 10/28");
  });
  it("해가 다르면 YY.M.D", () => {
    expect(formatRefRange("2025-10-28", "2026-10-27")).toBe("25.10.28 → 26.10.27");
    expect(formatRefRange("2025-12-31", "2026-01-02")).toBe("25.12.31 → 26.1.2");
  });
});

describe("isRefMissing — 전 종목 기준가 없음", () => {
  it("조회 완료 + 전부 기준가 없음일 때만 true", () => {
    expect(isRefMissing(false, [{ hasRef: false }, { hasRef: false }])).toBe(true);
    expect(isRefMissing(true, [{ hasRef: false }])).toBe(false);
    expect(isRefMissing(false, [{ hasRef: false }, { hasRef: true }])).toBe(false);
    expect(isRefMissing(false, [])).toBe(false);
  });
});
