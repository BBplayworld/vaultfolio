import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { store, send, configured } = vi.hoisted(() => ({
  configured: vi.fn(),
  store: { markPushSent: vi.fn(), listPushSubIdsByTopics: vi.fn(), getPushSub: vi.fn(), deletePushSub: vi.fn() },
  send: vi.fn(),
}));
vi.mock("@/lib/cache-storage", () => ({ getCacheStorage: () => store }));
vi.mock("../send", () => ({ sendPush: send, isPushConfigured: () => configured() }));

import { isCronAuthorized, kstToday, runPushCron } from "../cron-run";

const AUTH = "Bearer s3cret-value-for-test";
const req = (auth?: string) => new Request("http://x/api/push/cron", { headers: auth ? { authorization: auth } : {} });
// Cron 00:00 UTC = KST 09:00. 2026-11-26 15:00Z = KST 11/27 00:00 이후 같은 날 → 11/27 00:00Z = KST 09:00
const SETTLE_DAY = Date.UTC(2026, 10, 27, 0, 0); // KST 2026-11-27 09:00 (결산 창 첫날)
const QUIET_DAY = Date.UTC(2026, 10, 12, 0, 0); // KST 2026-11-12 09:00

beforeEach(() => {
  vi.resetAllMocks();
  process.env.CRON_SECRET = "s3cret-value-for-test";
  process.env.VERCEL_ENV = "production";
  vi.useFakeTimers();
  vi.setSystemTime(SETTLE_DAY);
  store.markPushSent.mockResolvedValue(true);
  store.listPushSubIdsByTopics.mockResolvedValue(["id1"]);
  store.getPushSub.mockResolvedValue({ endpoint: "https://fcm.googleapis.com/x", p256dh: "p", auth: "a", topics: ["settle"], updatedAt: "2026-11-12" });
  send.mockResolvedValue("ok");
  configured.mockReturnValue(true);
});
afterEach(() => vi.useRealTimers());

describe("cron 인증·환경", () => {
  it("CRON_SECRET 없음·불일치 → 401", async () => {
    expect((await runPushCron(req())).status).toBe(401);
    expect((await runPushCron(req("Bearer wrong"))).status).toBe(401);
    delete process.env.CRON_SECRET;
    expect((await runPushCron(req("Bearer undefined"))).status).toBe(401);
    expect(isCronAuthorized("Bearer ")).toBe(false);
  });
  it("운영 외 환경은 204 종료", async () => {
    process.env.VERCEL_ENV = "preview";
    expect((await runPushCron(req(AUTH))).status).toBe(204);
    expect(store.markPushSent).not.toHaveBeenCalled();
  });
  it("KST 날짜 변환", () => {
    expect(kstToday(Date.UTC(2026, 10, 26, 15, 0))).toBe("2026-11-27");
    expect(kstToday(SETTLE_DAY)).toBe("2026-11-27");
  });
});

describe("키 미설정·고아 정리", () => {
  it("키 미설정이면 플래그 전에 중단(복호화 실패로 구독이 지워지는 것 방지)", async () => {
    configured.mockReturnValue(false);
    expect(await (await runPushCron(req(AUTH))).json()).toEqual({ skipped: "not-configured" });
    expect(store.markPushSent).not.toHaveBeenCalled();
    expect(store.deletePushSub).not.toHaveBeenCalled();
  });
  it("레코드가 없는 고아 id는 삭제한다", async () => {
    store.listPushSubIdsByTopics.mockResolvedValue(["orphan", "id1"]);
    store.getPushSub.mockImplementation(async (id: string) =>
      id === "orphan" ? null : { endpoint: "https://fcm.googleapis.com/x", p256dh: "p", auth: "a", topics: ["settle"], updatedAt: "2026-11-12" },
    );
    await runPushCron(req(AUTH));
    expect(store.deletePushSub).toHaveBeenCalledWith("orphan");
    expect(store.deletePushSub).not.toHaveBeenCalledWith("id1");
  });
});

describe("runPushCron 흐름", () => {
  it("발송일이 아니면 종료 — 플래그·조회·발송 없음", async () => {
    vi.setSystemTime(QUIET_DAY);
    expect((await (await runPushCron(req(AUTH))).json()).skipped).toBe("no-event");
    expect(store.markPushSent).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });
  it("결산 창 첫날 — 종류·날짜 플래그 후 해당 종류 구독자에게만 결산 문구 발송", async () => {
    const r = await (await runPushCron(req(AUTH))).json();
    expect(store.markPushSent).toHaveBeenCalledWith("settle", "2026-11-27");
    expect(store.listPushSubIdsByTopics).toHaveBeenCalledWith(["settle"]);
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][1]).toEqual({ m: "settle", t: "11월 결산이 열렸어요", b: "12월 10일까지 이번 달 자산 변화를 볼 수 있어요" });
    expect(r).toMatchObject({ sent: 1, failed: 0, removed: 0 });
  });
  it("세금 마감일(12/24)은 tax 구독자에게 발송", async () => {
    vi.setSystemTime(Date.UTC(2026, 11, 24, 0, 0));
    await runPushCron(req(AUTH));
    expect(store.listPushSubIdsByTopics).toHaveBeenCalledWith(["tax"]);
    expect(send.mock.calls[0][1]).toMatchObject({ m: "tax", t: "연금저축·IRP 세액공제" });
  });
  it("중복 플래그 실패 → 조회·발송 없음", async () => {
    store.markPushSent.mockResolvedValue(false);
    const r = await (await runPushCron(req(AUTH))).json();
    expect(r).toMatchObject({ sent: 0, duplicate: 1 });
    expect(store.listPushSubIdsByTopics).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });
  it("구독 0이면 발송 없음", async () => {
    store.listPushSubIdsByTopics.mockResolvedValue([]);
    expect((await (await runPushCron(req(AUTH))).json()).sent).toBe(0);
    expect(send).not.toHaveBeenCalled();
  });
  it("410(gone)은 구독 삭제·집계, 일부 실패해도 나머지 발송", async () => {
    store.listPushSubIdsByTopics.mockResolvedValue(["a", "b", "c"]);
    send.mockResolvedValueOnce("gone").mockResolvedValueOnce("fail").mockResolvedValueOnce("ok");
    const r = await (await runPushCron(req(AUTH))).json();
    expect(r).toMatchObject({ sent: 1, failed: 1, removed: 1 });
    expect(store.deletePushSub).toHaveBeenCalledWith("a");
  });
  it("서버로 가는 페이로드는 {m,t,b} 3필드뿐", async () => {
    await runPushCron(req(AUTH));
    expect(Object.keys(send.mock.calls[0][1]).sort()).toEqual(["b", "m", "t"]);
  });
});
