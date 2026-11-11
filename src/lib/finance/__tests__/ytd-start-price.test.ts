import { describe, expect, it } from "vitest";
import { pickYtdStartPrice } from "../ytd-start-price";

describe("pickYtdStartPrice", () => {
  it("배당 수준 조정(r=0.98) → raw", () => expect(pickYtdStartPrice(100, 98)).toBe(100));
  it("경계: r=0.81 → raw, r=0.79 → adj", () => {
    expect(pickYtdStartPrice(100, 81)).toBe(100);
    expect(pickYtdStartPrice(100, 79)).toBe(79);
  });
  it("10:1 분할(r=0.1) → adj", () => expect(pickYtdStartPrice(1000, 100)).toBe(100));
  it("2:1 병합(r=2) → adj", () => expect(pickYtdStartPrice(50, 100)).toBe(100));
  it("한쪽 실패는 raw 우선, raw 없으면 adj, 둘 다 없으면 null", () => {
    expect(pickYtdStartPrice(100, null)).toBe(100);
    expect(pickYtdStartPrice(null, 90)).toBe(90);
    expect(pickYtdStartPrice(null, null)).toBeNull();
    expect(pickYtdStartPrice(0, undefined)).toBeNull();
  });
});
