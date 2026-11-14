// 저장 보호 요청(5.115) — 미지원·Firefox·persisted 참=호출 0, 예외 삼킴, 1회, 허용/거부 GA 각 1건
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const tracked: unknown[][] = [];
vi.mock("../analytics/ga", () => ({ track: (...a: unknown[]) => void tracked.push(a) }));

import { ensureStoragePersist, resetStoragePersistForTest } from "../pwa/persist-storage";

function stub(storage: unknown, ua = "Mozilla/5.0 Chrome/120") {
  vi.stubGlobal("navigator", { storage, userAgent: ua });
}

beforeEach(() => {
  tracked.length = 0;
  resetStoragePersistForTest();
});
afterEach(() => vi.unstubAllGlobals());

describe("ensureStoragePersist", () => {
  it("persist 미지원이면 호출 0·GA 0", async () => {
    stub({});
    await ensureStoragePersist();
    expect(tracked).toHaveLength(0);
  });
  it("Firefox UA면 호출 0", async () => {
    const persist = vi.fn();
    stub({ persist, persisted: async () => false }, "Mozilla/5.0 (X11; Linux) Gecko/20100101 Firefox/120.0");
    await ensureStoragePersist();
    expect(persist).not.toHaveBeenCalled();
    expect(tracked).toHaveLength(0);
  });
  it("persisted()가 참이면 persist 호출 0·GA 0", async () => {
    const persist = vi.fn();
    stub({ persist, persisted: async () => true });
    await ensureStoragePersist();
    expect(persist).not.toHaveBeenCalled();
    expect(tracked).toHaveLength(0);
  });
  it("허용·거부 결과로 GA 1건, 다시 불러도 1회만", async () => {
    const persist = vi.fn(async () => true);
    stub({ persist, persisted: async () => false });
    await ensureStoragePersist();
    await ensureStoragePersist();
    expect(persist).toHaveBeenCalledTimes(1);
    expect(tracked).toEqual([["feature_use", { category: "persist_ok" }]]);
    resetStoragePersistForTest();
    tracked.length = 0;
    stub({ persist: async () => false, persisted: async () => false });
    await ensureStoragePersist();
    expect(tracked).toEqual([["feature_use", { category: "persist_denied" }]]);
  });
  it("예외는 삼키고 GA 0", async () => {
    stub({ persist: async () => { throw new Error("x"); }, persisted: async () => false });
    await expect(ensureStoragePersist()).resolves.toBeUndefined();
    expect(tracked).toHaveLength(0);
  });
});
