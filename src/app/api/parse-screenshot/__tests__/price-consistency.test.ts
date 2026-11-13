import { describe, expect, it } from "vitest";
import { reconcilePrices } from "../price-consistency";

describe("reconcilePrices (2줄 헤더 평단·현재가 정합)", () => {
  it("수익률과 맞으면 유지", () => {
    expect(reconcilePrices(120, 100, 20)).toEqual({ currentPrice: 120, averagePrice: 100, action: "keep" });
  });
  it("값이 바뀌어 읽히면 교정 (양수 수익률)", () => {
    expect(reconcilePrices(100, 120, 20)).toEqual({ currentPrice: 120, averagePrice: 100, action: "swap" });
  });
  it("음수 수익률 유지", () => {
    expect(reconcilePrices(40, 100, -60)).toEqual({ currentPrice: 40, averagePrice: 100, action: "keep" });
  });
  it("음수 수익률에서 바뀌어 읽히면 교정", () => {
    expect(reconcilePrices(100, 40, -60)).toEqual({ currentPrice: 40, averagePrice: 100, action: "swap" });
  });
  it("수수료 수준의 오차는 유지", () => {
    expect(reconcilePrices(104.4, 100, 4.0).action).toBe("keep");
  });
  it("둘 다 안 맞으면 평단을 비우고 추정 경로", () => {
    expect(reconcilePrices(120, 100, -30)).toEqual({ currentPrice: 120, averagePrice: 0, action: "estimate" });
  });
  it("수익률 없음·값 없음은 검증하지 않고 유지", () => {
    expect(reconcilePrices(120, 100, 0).action).toBe("keep");
    expect(reconcilePrices(0, 100, 5).action).toBe("keep");
    expect(reconcilePrices(120, 0, 5).action).toBe("keep");
  });
  it("현재가≈평단 보합은 유지", () => {
    expect(reconcilePrices(100.5, 100, 0.5).action).toBe("keep");
  });
});
