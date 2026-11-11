import { describe, expect, it } from "vitest";
import { formatPriceByCurrency, formatCurrency } from "@/lib/number-utils";

// 4.85 formatPrice 3벌 통합 — 동작 동일(USD $ 소수 2자리, JPY ¥ 정수, 그 외 원)
describe("formatPriceByCurrency", () => {
  it("통화별 표기", () => {
    expect(formatPriceByCurrency(1234.567, "USD")).toBe("$1,234.57");
    expect(formatPriceByCurrency(1500.4, "JPY")).toBe("¥1,500");
    expect(formatPriceByCurrency(61000, "KRW")).toBe(formatCurrency(61000));
    expect(formatPriceByCurrency(61000, "")).toBe(formatCurrency(61000));
  });
});
