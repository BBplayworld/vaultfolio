import { describe, expect, it } from "vitest";
import { shouldRetryPin } from "../share-pin-retry";

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
