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

  describe("2차 근거 (5.0)", () => {
    // 현재가 90·평단 100을 바르게 읽고 수익률 부호만 빠져 +10으로 읽힌 경우(C102)
    it("부호 누락 + 평가금액÷수량이 현재가 쪽 → keep", () => {
      const r = reconcilePrices(90, 100, 10, { quantity: 10, currentValue: 900, profitAmount: -100 });
      expect(r).toEqual({ currentPrice: 90, averagePrice: 100, action: "keep" });
    });
    it("부호 누락 + 평가금액 없음 + 손익 부호 반대 → keep", () => {
      expect(reconcilePrices(90, 100, 10, { quantity: 10, profitAmount: -100 }).action).toBe("keep");
    });
    it("부호 누락 + 근거 전혀 없음 → 4.99 동작(swap) 유지", () => {
      expect(reconcilePrices(90, 100, 10).action).toBe("swap");
      expect(reconcilePrices(90, 100, 10, {}).action).toBe("swap");
    });
    it("진짜 2줄 헤더 swap: 평가금액÷수량이 swap 쪽 → swap", () => {
      const r = reconcilePrices(100, 120, 20, { quantity: 10, currentValue: 1200, profitAmount: 200 });
      expect(r).toEqual({ currentPrice: 120, averagePrice: 100, action: "swap" });
    });
    it("진짜 swap + 손익 부호 일치(평가금액 없음) → swap", () => {
      expect(reconcilePrices(100, 120, 20, { quantity: 10, profitAmount: 200 }).action).toBe("swap");
    });
    it("음수 수익률 swap: 부호 일치 → swap, 부호 반대 → keep", () => {
      expect(reconcilePrices(100, 40, -60, { profitAmount: -600 }).action).toBe("swap");
      expect(reconcilePrices(100, 40, -60, { profitAmount: 600 }).action).toBe("keep");
    });
    it("수량 미인식이면 E1 생략 (평가금액 무시)", () => {
      // quantity 미전달: 평가금액만으로는 판정하지 않으므로 4.99 동작
      expect(reconcilePrices(90, 100, 10, { currentValue: 900 }).action).toBe("swap");
    });
    it("원화 표시 해외주식: 원화 평가금액÷수량으로도 판정", () => {
      const r = reconcilePrices(135000, 150000, 11, { quantity: 2, currentValue: 270000 });
      expect(r).toEqual({ currentPrice: 135000, averagePrice: 150000, action: "keep" });
    });
    it("통화가 달라 평가금액÷수량이 어느 쪽에도 안 맞으면 근거 없음", () => {
      // 가격은 USD, 평가금액은 KRW → E1 없음 → 수익률 판정(swap)
      expect(reconcilePrices(100, 120, 20, { quantity: 10, currentValue: 1_650_000 }).action).toBe("swap");
    });
  });

  describe("소수익률 뒤바뀜 교정 (C)", () => {
    // AVGO: 현재가 345.00, 평단 342.06, +0.86%
    it("바뀐 읽기(현재가↔평단) + 평가금액÷수량이 swap 쪽에 맞음 → swap", () => {
      const r = reconcilePrices(342.06, 345, 0.86, { quantity: 10, currentValue: 3450 });
      expect(r).toEqual({ currentPrice: 345, averagePrice: 342.06, action: "swap" });
    });
    it("바른 읽기 → keep", () => {
      const r = reconcilePrices(345, 342.06, 0.86, { quantity: 10, currentValue: 3450 });
      expect(r.action).toBe("keep");
    });
    it("평가금액 없으면 소수익률은 건드리지 않음", () => {
      expect(reconcilePrices(342.06, 345, 0.86).action).toBe("keep");
    });
    it("수수료 근처 0%: 둘 다 0.2% 이내로 맞으면 근거 없음 → keep", () => {
      expect(reconcilePrices(100.1, 100, 0.1, { quantity: 10, currentValue: 1000.5 }).action).toBe("keep");
      expect(reconcilePrices(100, 100.1, -0.1, { quantity: 10, currentValue: 1000.5 }).action).toBe("keep");
    });
    it("0.2% 초과 오차(합계 반올림 등)는 교정하지 않음", () => {
      expect(reconcilePrices(342.06, 345, 0.86, { quantity: 10, currentValue: 3470 }).action).toBe("keep");
    });
  });
});
