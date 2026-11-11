// #148 도넛·비중 바 표시 폭 최소 비중 공용 유틸 — 폭만 보장, 숫자는 호출부 실제 값
import { describe, expect, it } from "vitest";
import { displayShareWidths, MIN_BAR_PCT, MIN_DONUT_PCT, MIN_SHARE_MAX_ITEMS } from "../min-share";
import { displayBarWidths } from "../composition";

const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);

describe("displayShareWidths", () => {
  it("5개 이하: 1% 미만 항목도 최소 폭 보장, 합 100, 큰 항목이 줄어듦", () => {
    const w = displayShareWidths([99.6, 0.3, 0.1], { minPct: MIN_DONUT_PCT });
    expect(w[1]).toBeCloseTo(MIN_DONUT_PCT, 6);
    expect(w[2]).toBeCloseTo(MIN_DONUT_PCT, 6);
    expect(sum(w)).toBeCloseTo(100, 6);
    expect(w[0]).toBeCloseTo(100 - 2 * MIN_DONUT_PCT, 6);
  });
  it("정확히 5개도 적용, 6개 이상은 순수 비례(현행 유지)", () => {
    expect(MIN_SHARE_MAX_ITEMS).toBe(5);
    expect(displayShareWidths([96, 1, 1, 1, 1])[1]).toBeCloseTo(MIN_BAR_PCT, 6);
    const six = displayShareWidths([95, 1, 1, 1, 1, 1]);
    expect(six[1]).toBeCloseTo(1, 6);
    expect(sum(six)).toBeCloseTo(100, 6);
  });
  it("0·음수 항목은 0(그리지 않음)이고 개수에 세지 않는다", () => {
    const w = displayShareWidths([0, 98, 2, -1, 0, 0, 0]);
    expect(w[0]).toBe(0);
    expect(w[3]).toBe(0);
    expect(w[2]).toBeCloseTo(MIN_BAR_PCT, 6); // 양수 2개라 적용
    expect(displayShareWidths([0, 0])).toEqual([0, 0]);
  });
  it("충분히 큰 비중은 그대로(변화 없음)", () => {
    expect(displayShareWidths([50, 30, 20])).toEqual([50, 30, 20]);
  });
  it("total이 합보다 크면 합/total만 채운다(막대의 빈 여백 유지)", () => {
    const w = displayShareWidths([60, 0.5], { total: 200 });
    expect(sum(w)).toBeCloseTo((60.5 / 200) * 100, 6);
    expect(w[1]).toBeCloseTo(MIN_BAR_PCT * (60.5 / 200), 6);
  });
  it("항목이 많아 최소폭 합이 100 이상이면 균등", () => {
    expect(displayShareWidths([1, 1, 1], { minPct: 40 }).map((x) => Math.round(x))).toEqual([33, 33, 33]);
  });
  it("displayBarWidths는 4.70 동작 그대로(composition 재노출)", () => {
    const w = displayBarWidths([95, 3, 2, 0]);
    expect(w[3]).toBe(0);
    expect(w[1]).toBeCloseTo(7, 6);
  });
});
