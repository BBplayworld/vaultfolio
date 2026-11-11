// #150 ytd 클라이언트 캐시 토큰 = 날짜(연말까지 stale 방지), prune이 지난 날 ytd 키만 정리
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getProfitCacheKey, getProfitCacheToken } from "../profit-utils";
import { prunePeriodProfitCache } from "../profit-cache-cleanup";
import { STORAGE_KEY_PREFIXES } from "@/lib/local-storage";

const store = new Map<string, string>();
beforeEach(() => {
  store.clear();
  vi.stubGlobal("window", {});
  vi.stubGlobal("localStorage", Object.assign(Object.create(null), {
    removeItem: (k: string) => store.delete(k),
  }));
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-11T12:00:00+09:00"));
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("ytd 캐시 토큰·정리", () => {
  it("토큰 = KST 오늘 날짜(Y 아님), 키는 기존 profit 프리픽스 안의 기간 변형", () => {
    expect(getProfitCacheToken("ytd", "sameBusinessDay")).toBe("2026-11-11");
    expect(getProfitCacheKey("AAPL,KO", "ytd", "sameBusinessDay")).toBe(`${STORAGE_KEY_PREFIXES.profit}sameBusinessDay:ytd:2026-11-11:AAPL,KO`);
  });

  it("prune: 지난 날 ytd 키 삭제, 오늘 ytd 키 유지, 알 수 없는 period는 보존", () => {
    const p = STORAGE_KEY_PREFIXES.profit;
    const keys = [`${p}sameBusinessDay:ytd:2026-11-10:AAPL`, `${p}sameBusinessDay:ytd:2026-11-11:AAPL`, `${p}sameBusinessDay:other:x:AAPL`];
    for (const k of keys) store.set(k, "{}");
    // Object.keys(localStorage)가 저장 키를 돌려주도록 프로퍼티로 반영
    const ls = localStorage as unknown as Record<string, string>;
    for (const k of keys) ls[k] = "{}";
    store.clear(); for (const k of keys) store.set(k, "{}");
    (localStorage as unknown as { removeItem: (k: string) => void }).removeItem = (k) => { delete ls[k]; store.delete(k); };
    expect(prunePeriodProfitCache()).toBe(1);
    expect(store.has(keys[0])).toBe(false);
    expect(store.has(keys[1])).toBe(true);
    expect(store.has(keys[2])).toBe(true);
  });
});
