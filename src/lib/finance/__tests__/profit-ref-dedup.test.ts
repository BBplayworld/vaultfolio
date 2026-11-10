// #141 fetchProfitRef dedup — 선행 호출이 abort로 끝나면 후행 호출자에게 부분 결과를 "완료"로 주지 않고 재시도
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ProfitRefResponse } from "@/app/api/finance/profit/route";

const TICKERS = "T1,T2,T3,T4"; // 배치 3+1
type Pending = { url: string; resolve: () => void };

let pending: Pending[];
let urls: string[];
let store: Map<string, string>;

function stubFetch() {
  vi.stubGlobal("fetch", (url: string, init?: { signal?: AbortSignal }) => new Promise<Response>((resolve, reject) => {
    urls.push(url);
    const signal = init?.signal;
    if (signal?.aborted) { reject(new DOMException("aborted", "AbortError")); return; }
    signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")), { once: true });
    const tickers = new URL(url, "http://x").searchParams.get("tickers")!.split(",");
    const body: ProfitRefResponse = {};
    for (const t of tickers) body[t] = { refPrice: 100, refDate: "2026-10-01" } as ProfitRefResponse[string];
    pending.push({ url, resolve: () => resolve(new Response(JSON.stringify(body), { status: 200 })) });
  }));
}

// 진행 중인 fetch 1건 응답 + 마이크로태스크 비우기
async function respondNext() {
  const p = pending.shift();
  if (!p) throw new Error("대기 중인 fetch 없음");
  p.resolve();
  await vi.advanceTimersByTimeAsync(0);
}
// 배치 간 지연(1초) 경과
const passBatchDelay = () => vi.advanceTimersByTimeAsync(1000);
const flush = () => vi.advanceTimersByTimeAsync(0);

beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers();
  pending = [];
  urls = [];
  store = new Map();
  vi.stubGlobal("localStorage", { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => { store.set(k, v); } });
  stubFetch();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function track() {
  const calls = { progress: [] as ProfitRefResponse[], complete: [] as boolean[] };
  return {
    calls,
    onProgress: (p: ProfitRefResponse) => { calls.progress.push(p); },
    onComplete: (fromCache: boolean) => { calls.complete.push(fromCache); },
  };
}

describe("fetchProfitRef dedup — 선행 호출 abort 시 후행 호출자", () => {
  it("A가 첫 배치 중 abort → B는 {}를 완료로 받지 않고 재시도해 4티커 완전 결과", async () => {
    const { fetchProfitRef } = await import("../profit-utils");
    const a = new AbortController();
    const b = new AbortController();
    const tb = track();
    const pa = fetchProfitRef(TICKERS, "monthly", { signal: a.signal, caller: "A" });
    const pb = fetchProfitRef(TICKERS, "monthly", { signal: b.signal, caller: "B", onProgress: tb.onProgress, onComplete: tb.onComplete });
    await flush();
    expect(urls).toHaveLength(1); // B는 A에 dedup

    a.abort();
    pending.shift(); // A의 첫 배치는 abort로 reject됨
    await flush();
    expect(await pa).toEqual({});
    expect(tb.calls.complete).toEqual([]); // 부분 결과({})를 완료로 받지 않음

    // B 자체 재시도: 3 + 1
    expect(urls).toHaveLength(2);
    await respondNext();
    await passBatchDelay();
    await respondNext();
    const rb = await pb;
    expect(Object.keys(rb).sort()).toEqual(["T1", "T2", "T3", "T4"]);
    expect(tb.calls.complete).toHaveLength(1);
    expect(Object.keys(tb.calls.progress.at(-1)!).sort()).toEqual(["T1", "T2", "T3", "T4"]);
    expect(urls).toHaveLength(3);
  });

  it("A가 첫 배치 응답 후 두 번째 배치 중 abort → B는 3티커 부분 결과를 완료로 받지 않고 재시도", async () => {
    const { fetchProfitRef } = await import("../profit-utils");
    const a = new AbortController();
    const b = new AbortController();
    const tb = track();
    const pa = fetchProfitRef(TICKERS, "monthly", { signal: a.signal, caller: "A" });
    const pb = fetchProfitRef(TICKERS, "monthly", { signal: b.signal, caller: "B", onProgress: tb.onProgress, onComplete: tb.onComplete });
    await flush();
    await respondNext(); // A 배치1(T1~T3)
    await passBatchDelay();
    expect(urls).toHaveLength(2); // A 배치2(T4) 진행 중

    a.abort();
    pending.shift();
    await flush();
    expect(Object.keys(await pa).sort()).toEqual(["T1", "T2", "T3"]);
    expect(tb.calls.complete).toEqual([]);

    await respondNext();
    await passBatchDelay();
    await respondNext();
    const rb = await pb;
    expect(Object.keys(rb).sort()).toEqual(["T1", "T2", "T3", "T4"]);
    expect(tb.calls.complete).toHaveLength(1);
    expect(tb.calls.progress.every((p) => Object.keys(p).length > 0)).toBe(true);
    expect(Object.keys(tb.calls.progress.at(-1)!).sort()).toEqual(["T1", "T2", "T3", "T4"]);
  });

  it("정상 경로 — A 완료 시 B는 결과 공유, 요청 수 2(3+1) 그대로", async () => {
    const { fetchProfitRef } = await import("../profit-utils");
    const tb = track();
    const pa = fetchProfitRef(TICKERS, "monthly", { signal: new AbortController().signal, caller: "A" });
    const pb = fetchProfitRef(TICKERS, "monthly", { signal: new AbortController().signal, caller: "B", onProgress: tb.onProgress, onComplete: tb.onComplete });
    await flush();
    await respondNext();
    await passBatchDelay();
    await respondNext();
    const [ra, rb] = await Promise.all([pa, pb]);
    expect(rb).toEqual(ra);
    expect(Object.keys(rb).sort()).toEqual(["T1", "T2", "T3", "T4"]);
    expect(tb.calls.complete).toEqual([true]);
    expect(urls).toEqual([
      "/api/finance/profit?tickers=T1,T2,T3&period=monthly&basis=kstAccessDay",
      "/api/finance/profit?tickers=T4&period=monthly&basis=kstAccessDay",
    ]);
  });

  it("A·B 둘 다 abort → B는 콜백 없이 종료, 추가 요청 0", async () => {
    const { fetchProfitRef } = await import("../profit-utils");
    const a = new AbortController();
    const b = new AbortController();
    const tb = track();
    const pa = fetchProfitRef(TICKERS, "monthly", { signal: a.signal, caller: "A" });
    const pb = fetchProfitRef(TICKERS, "monthly", { signal: b.signal, caller: "B", onProgress: tb.onProgress, onComplete: tb.onComplete });
    await flush();
    b.abort();
    a.abort();
    pending.shift();
    await flush();
    await pa;
    await pb;
    expect(tb.calls.complete).toEqual([]);
    expect(tb.calls.progress).toEqual([]);
    expect(urls).toHaveLength(1);
  });
});
