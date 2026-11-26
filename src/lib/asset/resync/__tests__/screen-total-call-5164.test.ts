// 5.164 #328 화면 합계 전용 호출(기기) — 요청 본문·1회·8초·실패/한도/지연 시 값 없음(줄 숨김 + GA skip)
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { reconcileGaCategory, reconcileLines, reconcileTotal, settledScreenTotal, type ReconcileFlags, type ScreenTotalFetch } from "..";
import { startScreenTotalCall } from "../screen-total-call";

const OK: ReconcileFlags = { okShots: 1, shotProblem: false, unapplied: false, stalePrice: false, foreignRateUnsynced: false, undone: false };
const file = () => new File([new Uint8Array([1, 2, 3]) as BlobPart], "shot.png", { type: "image/png" });
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const TOTAL = { value: 1_000_000, label: "총 평가금액", currency: "KRW" };
/** '맞추기'를 누른 순간의 화면 줄·GA 구간 */
const judge = (f: ScreenTotalFetch) => {
  const view = reconcileTotal({ screenTotal: settledScreenTotal(f), rows: [{ name: "삼성전자", screenValue: 1_000_000, appValue: 1_000_000 }], flags: OK });
  return { lines: reconcileLines(view), ga: reconcileGaCategory(view, f.status) };
};
// 응답 본문 읽기(Response.json)는 마이크로태스크만으로 끝나지 않는다 — 가짜가 아닌 setImmediate로 넘긴다
const flush = async () => { for (let i = 0; i < 3; i++) await new Promise<void>((r) => setImmediate(r)); };

beforeEach(() => vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] }));
afterEach(() => vi.useRealTimers());

describe("요청", () => {
  it("POST /api/parse-screenshot 1회, 본문은 image + assetType=stock-total 2개뿐", async () => {
    const f = file();
    const fetchImpl = vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) => json({ screenTotal: TOTAL }));
    startScreenTotalCall(f, { fetchImpl });
    await flush();
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe("/api/parse-screenshot");
    expect(init?.method).toBe("POST");
    const body = init?.body as FormData;
    expect([...body.keys()].sort()).toEqual(["assetType", "image"]);
    expect(body.get("assetType")).toBe("stock-total");
    expect(body.get("image")).toBe(f);
    expect(init?.headers).toBeUndefined();
  });
});

describe("상태 → 판정", () => {
  it("값을 받으면 done → 일치 줄 · GA match", async () => {
    const c = startScreenTotalCall(file(), { fetchImpl: async () => json({ screenTotal: TOTAL }) });
    expect(c.state()).toEqual({ status: "pending" });
    await flush();
    expect(c.state()).toEqual({ status: "done", total: TOTAL });
    expect(judge(c.state())).toEqual({ lines: ["증권사 화면 합계와 맞아요"], ga: "resync_check_match" });
  });
  it("200 null(화면에 합계 없음) → 줄 숨김 · GA none", async () => {
    const c = startScreenTotalCall(file(), { fetchImpl: async () => json({ screenTotal: null }) });
    await flush();
    expect(c.state()).toEqual({ status: "done", total: null });
    expect(judge(c.state())).toEqual({ lines: [], ga: "resync_check_none" });
  });
  it.each([429, 500, 400, 403])("HTTP %i → failed → 줄 숨김 · GA skip (본문에 값이 있어도 쓰지 않는다)", async (status) => {
    const c = startScreenTotalCall(file(), { fetchImpl: async () => json({ screenTotal: TOTAL, error: "x" }, status) });
    await flush();
    expect(c.state()).toEqual({ status: "failed" });
    expect(judge(c.state())).toEqual({ lines: [], ga: "resync_check_skip" });
  });
  it("네트워크 오류·읽을 수 없는 본문 → failed", async () => {
    const a = startScreenTotalCall(file(), { fetchImpl: async () => { throw new TypeError("network"); } });
    const b = startScreenTotalCall(file(), { fetchImpl: async () => new Response("<html>", { status: 200 }) });
    await flush();
    expect(a.state()).toEqual({ status: "failed" });
    expect(b.state()).toEqual({ status: "failed" });
  });
  it("미도착: 응답 전 판정하면 pending → 줄 숨김 · GA skip, 판정 뒤 취소하면 늦은 응답은 버려진다", async () => {
    let resolve!: (r: Response) => void;
    const c = startScreenTotalCall(file(), { fetchImpl: () => new Promise<Response>((r) => { resolve = r; }) });
    await flush();
    const atClick = c.state();
    expect(judge(atClick)).toEqual({ lines: [], ga: "resync_check_skip" });
    c.cancel();
    resolve(json({ screenTotal: TOTAL }));
    await flush();
    expect(c.state()).toEqual({ status: "failed" });
    expect(atClick).toEqual({ status: "pending" }); // 누른 순간 읽은 값은 그대로
  });
  it("8초에 끊는다: 7,999ms까지 pending, 8,000ms에 failed + 요청 취소. 그 뒤 온 응답은 무시", async () => {
    let signal: AbortSignal | undefined;
    let resolve!: (r: Response) => void;
    const c = startScreenTotalCall(file(), {
      fetchImpl: (_u, init) => {
        signal = init?.signal ?? undefined;
        return new Promise<Response>((r) => { resolve = r; });
      },
    });
    await vi.advanceTimersByTimeAsync(7999);
    expect(c.state()).toEqual({ status: "pending" });
    expect(signal?.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(c.state()).toEqual({ status: "failed" });
    expect(signal?.aborted).toBe(true);
    resolve(json({ screenTotal: TOTAL }));
    await flush();
    expect(c.state()).toEqual({ status: "failed" });
  });
  it("취소(대화상자 닫기)하면 요청이 끊기고, 이미 받은 값은 바뀌지 않는다", async () => {
    let signal: AbortSignal | undefined;
    const pending = startScreenTotalCall(file(), { fetchImpl: (_u, init) => { signal = init?.signal ?? undefined; return new Promise<Response>(() => {}); } });
    pending.cancel();
    expect(signal?.aborted).toBe(true);
    expect(pending.state()).toEqual({ status: "failed" });
    const done = startScreenTotalCall(file(), { fetchImpl: async () => json({ screenTotal: TOTAL }) });
    await flush();
    done.cancel();
    expect(done.state()).toEqual({ status: "done", total: TOTAL });
  });
  it("다시 보내지 않는다: 실패·시간 초과 뒤에도 요청은 1회", async () => {
    const fetchImpl = vi.fn(async () => json({}, 500));
    const c = startScreenTotalCall(file(), { fetchImpl });
    await flush();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(c.state()).toEqual({ status: "failed" });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});
