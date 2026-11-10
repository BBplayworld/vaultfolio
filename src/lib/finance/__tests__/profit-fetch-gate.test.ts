// 4.72 D1(#137)·D2(#138) — 기간 전환 경합(마지막 선택만 반영)과 취소 뒤 재조회. 수정 전 main 동작 재현을 먼저 고정한다
import { describe, expect, it } from "vitest";
import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { beginLatestFetch, cancelThenRefetchProfit, createFetchSlot, resetFetchSlot } from "../profit-fetch-gate";

type Data = { period: string };
// fetchProfitRef 흉내: resolve()를 부르면 응답 도착. abortOnly=true면 실제 fetch처럼 취소된 요청은 onProgress를 부르지 않는다
function deferredFetch(abortOnly = true) {
  const pending = new Map<string, () => void>();
  const fetchFn = (key: string, signal: AbortSignal, onProgress: (d: Data) => void) =>
    new Promise<void>((done) => {
      pending.set(key, () => {
        if (!(abortOnly && signal.aborted)) onProgress({ period: key });
        done();
      });
    });
  return { fetchFn, resolve: async (key: string) => { pending.get(key)!(); await Promise.resolve(); } };
}

// ── 수정 전 main(962830d) profit-chart.tsx ref effect 사본(재현용, 수정 금지) ──
function mainEffect(st: { inFlight: string | null; data: Data | undefined }, key: string, fetchFn: ReturnType<typeof deferredFetch>["fetchFn"]) {
  if (st.inFlight === key) return () => {};
  st.inFlight = key;
  const controller = new AbortController();
  st.data = undefined;
  void fetchFn(key, controller.signal, (p) => { st.data = p; }).finally(() => { if (st.inFlight === key) st.inFlight = null; });
  return () => { if (st.inFlight !== key) controller.abort(); };
}

// ── 수정 후 effect(profit-chart.tsx와 같은 호출) ──
function newEffect(slot: ReturnType<typeof createFetchSlot>, st: { data: Data | undefined }, key: string, fetchFn: ReturnType<typeof deferredFetch>["fetchFn"]) {
  const req = beginLatestFetch(slot, key);
  if (!req) return;
  st.data = undefined;
  void fetchFn(key, req.controller.signal, (p) => { if (req.isCurrent()) st.data = p; }).finally(req.done);
}

describe("D1 기간 전환 경합 — 연 시작 → 주 시작 → 주 응답 → 연 응답 늦게 도착", () => {
  it("수정 전 main: 늦게 온 1년 응답이 `주` 화면을 덮는다(재현)", async () => {
    const f = deferredFetch();
    const st = { inFlight: null as string | null, data: undefined as Data | undefined };
    const cleanupYear = mainEffect(st, "yearly", f.fetchFn);
    cleanupYear(); // React: 의존성(period) 변경 → 이전 cleanup(이 시점 inFlight === yearly라 abort 안 함)
    mainEffect(st, "weekly", f.fetchFn);
    await f.resolve("weekly");
    await f.resolve("yearly");
    expect(st.data).toEqual({ period: "yearly" }); // 결함: 제목은 주, 값은 1년
  });

  it("수정 후: 마지막 선택(주)만 반영, 이전 기간 요청은 abort", async () => {
    const f = deferredFetch();
    const slot = createFetchSlot();
    const st = { data: undefined as Data | undefined };
    newEffect(slot, st, "yearly", f.fetchFn);
    const yearCtrl = slot.controller!;
    newEffect(slot, st, "weekly", f.fetchFn);
    expect(yearCtrl.signal.aborted).toBe(true);
    await f.resolve("weekly");
    await f.resolve("yearly");
    expect(st.data).toEqual({ period: "weekly" });
  });

  it("응답 순서가 뒤집혀도(주 늦게) 결과는 주, 취소 신호를 무시하고 콜백이 와도(공유 요청) 버린다", async () => {
    const f = deferredFetch(false);
    const slot = createFetchSlot();
    const st = { data: undefined as Data | undefined };
    for (const k of ["daily", "yearly", "monthly", "weekly"]) newEffect(slot, st, k, f.fetchFn);
    await f.resolve("yearly");
    await f.resolve("monthly");
    expect(st.data).toBeUndefined(); // 아직 주 응답 전 — 다른 기간 값을 그리지 않음(스켈레톤)
    await f.resolve("weekly");
    await f.resolve("daily");
    expect(st.data).toEqual({ period: "weekly" });
  });

  it("같은 key 재실행은 진행 보존(기존 의도), 끝난 뒤 같은 key는 새로 시작", async () => {
    const f = deferredFetch();
    const slot = createFetchSlot();
    const st = { data: undefined as Data | undefined };
    newEffect(slot, st, "weekly", f.fetchFn);
    const c = slot.controller!;
    expect(beginLatestFetch(slot, "weekly")).toBeNull();
    expect(c.signal.aborted).toBe(false);
    await f.resolve("weekly");
    expect(st.data).toEqual({ period: "weekly" });
    expect(slot.inFlightKey).toBeNull();
    expect(beginLatestFetch(slot, "weekly")).not.toBeNull();
  });

  it("리셋(데이터 삭제·불러오기) 뒤 늦은 응답은 버린다", async () => {
    const f = deferredFetch(false);
    const slot = createFetchSlot();
    const st = { data: undefined as Data | undefined };
    newEffect(slot, st, "weekly", f.fetchFn);
    resetFetchSlot(slot);
    await f.resolve("weekly");
    expect(st.data).toBeUndefined();
  });
});

describe("D2 취소 뒤 재조회 — 상세·주식 '오늘' 칩 쿼리", () => {
  const setup = () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    let calls = 0;
    const resolvers: (() => void)[] = [];
    const observer = new QueryObserver(client, {
      queryKey: ["profit", "daily", "kstAccessDay", "005930"],
      queryFn: ({ signal }) => new Promise<{ n: number }>((res, rej) => {
        const n = ++calls;
        signal.addEventListener("abort", () => rej(new DOMException("aborted", "AbortError")));
        resolvers.push(() => res({ n }));
      }),
    });
    const unsub = observer.subscribe(() => {});
    return { client, observer, unsub, resolvers, calls: () => calls };
  };

  it("수정 전 main: cancelQueries만 하면 pending/idle로 남고 다시 부르지 않는다(재현)", async () => {
    const t = setup();
    await new Promise((r) => setTimeout(r, 0));
    await t.client.cancelQueries({ queryKey: ["profit"] });
    await new Promise((r) => setTimeout(r, 10));
    const s = t.observer.getCurrentResult();
    expect([s.status, s.fetchStatus, t.calls()]).toEqual(["pending", "idle", 1]);
    t.unsub();
  });

  it("수정 후: 취소 직후 화면에 붙은 쿼리를 다시 불러 데이터가 온다", async () => {
    const t = setup();
    await new Promise((r) => setTimeout(r, 0));
    await Promise.race([cancelThenRefetchProfit(t.client), new Promise((r) => setTimeout(r, 5))]);
    expect(t.calls()).toBe(2);
    t.resolvers[1]();
    await new Promise((r) => setTimeout(r, 10));
    const s = t.observer.getCurrentResult();
    expect([s.status, s.data]).toEqual(["success", { n: 2 }]);
    t.unsub();
  });

  it("화면에 없는(관찰자 0) 이전 키는 다시 부르지 않는다(데이터 삭제 뒤 이전 칩 잔존 0)", async () => {
    const t = setup();
    t.unsub();
    await cancelThenRefetchProfit(t.client).catch(() => {});
    expect(t.calls()).toBe(1);
  });
});
