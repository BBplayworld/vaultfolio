import { describe, expect, it } from "vitest";
import { pinMismatchGoesInvalid, shouldRetryPin } from "../share-pin-retry";

describe("shouldRetryPin", () => {
  it("간편 공유(once 없음) 오답은 즉시 invalid-access(재시도 불가)", () => {
    expect(shouldRetryPin(undefined, 1)).toBe(false);
    expect(shouldRetryPin(false, 1)).toBe(false);
  });
  it("1회용 오답은 4회까지 재시도, 5회째 중단", () => {
    for (let n = 1; n <= 4; n++) expect(shouldRetryPin(true, n)).toBe(true);
    expect(shouldRetryPin(true, 5)).toBe(false);
  });
});

describe("pinMismatchGoesInvalid", () => {
  it("간편 공유 v73A·v72Z 오답은 즉시 invalid", () => {
    expect(pinMismatchGoesInvalid("v73Axxx", undefined, 1)).toBe(true);
    expect(pinMismatchGoesInvalid("v72Zxxx", false, 1)).toBe(true);
  });
  it("구 v71P 오답은 재입력(5.112 동작 유지)", () => {
    expect(pinMismatchGoesInvalid("v71Pxxx", undefined, 1)).toBe(false);
    expect(pinMismatchGoesInvalid("v71Pxxx", undefined, 9)).toBe(false);
  });
  it("1회용은 4회 재입력 후 5회째 invalid", () => {
    expect(pinMismatchGoesInvalid("v73Axxx", true, 4)).toBe(false);
    expect(pinMismatchGoesInvalid("v73Axxx", true, 5)).toBe(true);
  });
});
