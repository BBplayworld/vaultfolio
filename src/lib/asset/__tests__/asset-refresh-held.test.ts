// #99 p2-1 — 최신화 팁 보유 자산군만
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getStaleCategories, heldRefreshCategories, shouldShowRefreshNudge } from "../asset-refresh-status";

const store = new Map<string, string>();
beforeEach(() => {
  store.clear();
  vi.stubGlobal("window", {});
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  });
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-15T00:00:00Z"));
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const D8 = "2026-11-07T00:00:00.000Z"; // 8일 전(이력 없음 → 유예 7일 초과 = 오래됨)
const arr = (n: number) => Array.from({ length: n }, () => ({}));
const data = (s: number, c: number, ca: number, l: number) => ({ stocks: arr(s), crypto: arr(c), cash: arr(ca), loans: arr(l) }) as never;

describe("heldRefreshCategories", () => {
  it("배열 길이 > 0만 보유", () => {
    expect(heldRefreshCategories(data(1, 0, 0, 0))).toEqual(["stock"]);
    expect(heldRefreshCategories(data(0, 0, 0, 0))).toEqual([]);
    expect(heldRefreshCategories(data(1, 1, 1, 1))).toEqual(["stock", "crypto", "cash", "loan"]);
  });
});

describe("보유 필터", () => {
  it("1. 주식만 보유 8일차 → 주식만", () => {
    expect(getStaleCategories(D8, heldRefreshCategories(data(1, 0, 0, 0)))).toEqual(["stock"]);
  });
  it("2. 부동산만 보유(4종 0건) → 빈 목록, 넛지 없음", () => {
    const held = heldRefreshCategories(data(0, 0, 0, 0));
    expect(getStaleCategories(D8, held)).toEqual([]);
    expect(shouldShowRefreshNudge({ hasAssets: true, assetLastUpdated: D8, held })).toBe(false);
  });
  it("3. 4종 보유 → held 미지정과 동일", () => {
    const held = heldRefreshCategories(data(1, 1, 1, 1));
    expect(getStaleCategories(D8, held)).toEqual(getStaleCategories(D8));
    expect(getStaleCategories(D8)).toHaveLength(4);
  });
  it("4. 넛지 판정과 목록이 같은 필터(팁 선택됨 + 목록 빈 상태 0)", () => {
    for (const held of [[], ["stock"], ["crypto", "loan"]] as never[][]) {
      const show = shouldShowRefreshNudge({ hasAssets: true, assetLastUpdated: D8, held: held as never });
      expect(show).toBe(getStaleCategories(D8, held as never).length > 0);
    }
  });
});
