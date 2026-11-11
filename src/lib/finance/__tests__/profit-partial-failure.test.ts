// 4.85 필수 4 — 배치가 429·5xx로 실패하면 불완전 처리(캐시 저장·완료 생략), Retry-After에 따라 실행당 1회만 재시도(요청량 상한)
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ProfitRefResponse } from "@/app/api/finance/profit/route";

const TICKERS = "T1,T2,T3,T4"; // 배치 3+1
let urls: string[];
let store: Map<string, string>;
let script: Array<{ status: number; retryAfter?: string }>; // 호출 순서별 응답(없으면 200)

function stubFetch() {
  vi.stubGlobal("fetch", async (url: string) => {
    urls.push(url);
    const r = script[urls.length - 1] ?? { status: 200 };
    if (r.status !== 200) {
      return new Response("{}", { status: r.status, headers: r.retryAfter ? { "Retry-After": r.retryAfter } : {} });
    }
    const body: ProfitRefResponse = {};
    for (const t of new URL(url, "http://x").searchParams.get("tickers")!.split(",")) {
      body[t] = { refPrice: 100, refDate: "2026-10-01" } as ProfitRefResponse[string];
    }
    return new Response(JSON.stringify(body), { status: 200 });
  });
}

beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers();
  urls = [];
  store = new Map();
  script = [];
  vi.stubGlobal("localStorage", { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => { store.set(k, v); } });
  stubFetch();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

async function run() {
  const { fetchProfitRef } = await import("../profit-utils");
  const completes: boolean[] = [];
  const p = fetchProfitRef(TICKERS, "monthly", { signal: new AbortController().signal, caller: "t", onComplete: (c) => completes.push(c) });
  await vi.advanceTimersByTimeAsync(30000);
  return { data: await p, completes };
}

describe("fetchProfitRef 부분 실패(429·5xx)", () => {
  it("429 후 Retry-After 대기 뒤 1회 재시도로 성공하면 정상 완료·캐시 저장", async () => {
    script = [{ status: 429, retryAfter: "2" }];
    const { data, completes } = await run();
    expect(Object.keys(data).sort()).toEqual(["T1", "T2", "T3", "T4"]);
    expect(completes).toEqual([false]);
    expect(store.size).toBe(1);
    expect(urls).toHaveLength(3); // 배치1 실패 + 재시도 + 배치2
  });

  it("재시도도 실패하면 불완전 — 캐시 저장·완료 콜백 없음, 남은 배치도 보내지 않음, 총 요청 2회", async () => {
    script = [{ status: 429 }, { status: 503 }];
    const { data, completes } = await run();
    expect(data).toEqual({});
    expect(completes).toEqual([]);
    expect(store.size).toBe(0);
    expect(urls).toHaveLength(2);
  });

  it("두 번째 배치의 5xx도 불완전: 첫 배치 결과만 진행으로 남고 저장·완료 없음", async () => {
    script = [{ status: 200 }, { status: 500 }, { status: 500 }];
    const { data, completes } = await run();
    expect(Object.keys(data).sort()).toEqual(["T1", "T2", "T3"]);
    expect(completes).toEqual([]);
    expect(store.size).toBe(0);
  });

  it("재시도는 실행당 1회 상한 — 모든 배치가 계속 429여도 요청은 최대 2회", async () => {
    script = Array.from({ length: 10 }, () => ({ status: 429 }));
    await run();
    expect(urls.length).toBeLessThanOrEqual(2);
  });

  it("Retry-After가 10초를 넘으면 재시도하지 않는다", async () => {
    script = [{ status: 429, retryAfter: "3600" }];
    const { completes } = await run();
    expect(urls).toHaveLength(1);
    expect(completes).toEqual([]);
    expect(store.size).toBe(0);
  });

  it("실패한 실행 뒤 다시 호출하면 캐시 miss로 재조회해 완전 결과를 얻는다", async () => {
    script = [{ status: 429, retryAfter: "99" }];
    await run();
    urls = [];
    script = [];
    const { data, completes } = await run();
    expect(Object.keys(data)).toHaveLength(4);
    expect(completes).toEqual([false]);
  });

  it("profitRetryDelayMs: 1~5초로 제한, 헤더 없음/이상값은 1초", async () => {
    const { profitRetryDelayMs } = await import("../profit-utils");
    expect(profitRetryDelayMs(null)).toBe(1000);
    expect(profitRetryDelayMs("0")).toBe(1000);
    expect(profitRetryDelayMs("3")).toBe(3000);
    expect(profitRetryDelayMs("8")).toBe(5000);
    expect(profitRetryDelayMs("11")).toBeNull();
    expect(profitRetryDelayMs("abc")).toBe(1000);
  });
});
