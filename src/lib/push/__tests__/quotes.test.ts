import { describe, it, expect, vi } from "vitest";
vi.mock("@/lib/finance/finance-service", () => ({}));
vi.mock("@/lib/cache-storage", () => ({ getCacheStorage: () => ({}) }));
import { changeFromSeries } from "../quotes";

describe("changeFromSeries", () => {
  const rows = [{ date: "2026-11-11", price: 100 }, { date: "2026-11-12", price: 101.5 }];
  it("마지막 2행 전일 대비", () => expect(changeFromSeries(rows, "2026-11-12")).toBeCloseTo(1.5));
  it("마지막 행이 직전 거래일이 아니면 stale → null", () => expect(changeFromSeries(rows, "2026-11-13")).toBeNull());
  it("행 부족·null → null", () => {
    expect(changeFromSeries(null, "2026-11-12")).toBeNull();
    expect(changeFromSeries(rows.slice(1), "2026-11-12")).toBeNull();
  });
});
