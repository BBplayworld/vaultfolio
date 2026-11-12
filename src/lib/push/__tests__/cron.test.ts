import { describe, it, expect, vi, beforeEach } from "vitest";

const { store, kis, budget, quotes, send, configured } = vi.hoisted(() => ({
  configured: vi.fn(),
  store: { markPushSent: vi.fn(), listPushSubIdsByTopics: vi.fn(), getPushSub: vi.fn(), deletePushSub: vi.fn() },
  kis: { getKisAccessToken: vi.fn(), recordKisFailure: vi.fn(), recordKisSuccess: vi.fn() },
  budget: vi.fn(),
  quotes: vi.fn(),
  send: vi.fn(),
}));
vi.mock("@/lib/cache-storage", () => ({ getCacheStorage: () => store }));
vi.mock("@/lib/finance/kis-token", () => kis);
vi.mock("@/server/api-guard", () => ({ withinUpstreamBudget: budget }));
vi.mock("../quotes", () => ({ fetchPushRates: quotes, estimateKisCalls: () => 1 }));
vi.mock("../send", () => ({ sendPush: send, isPushConfigured: () => configured() }));

import { isCronAuthorized, resolveCronWindow, runPushCron } from "../cron-run";

const req = (auth?: string) => new Request("http://x/api/push/cron/kr", { headers: auth ? { authorization: auth } : {} });
// KST 2026-11-12(목) 16:30 = UTC 07:30
const KR_NOW = Date.UTC(2026, 10, 12, 7, 30);
// KST 2026-11-13(금) 09:30 = UTC 00:30 → 미국 거래일 11/12
const US_NOW = Date.UTC(2026, 10, 13, 0, 30);

beforeEach(() => {
  vi.resetAllMocks();
  process.env.CRON_SECRET = "s3cret-value-for-test";
  process.env.VERCEL_ENV = "production";
  vi.useFakeTimers();
  vi.setSystemTime(KR_NOW);
  store.markPushSent.mockResolvedValue(true);
  store.listPushSubIdsByTopics.mockResolvedValue(["id1"]);
  store.getPushSub.mockResolvedValue({ endpoint: "https://fcm.googleapis.com/x", p256dh: "p", auth: "a", topics: ["kospi", "spx"], cond: "daily", updatedAt: "2026-11-12" });
  kis.getKisAccessToken.mockResolvedValue({ token: "t", unavailable: false });
  budget.mockResolvedValue(true);
  quotes.mockResolvedValue({ kospi: 0.8 });
  send.mockResolvedValue("ok");
  configured.mockReturnValue(true);
});

describe("cron 인증·환경", () => {
  it("CRON_SECRET 없음·불일치 → 401", async () => {
    expect((await runPushCron(req(), "kr")).status).toBe(401);
    expect((await runPushCron(req("Bearer wrong"), "kr")).status).toBe(401);
    delete process.env.CRON_SECRET;
    expect((await runPushCron(req("Bearer undefined"), "kr")).status).toBe(401);
    expect(isCronAuthorized("Bearer ")).toBe(false);
  });
  it("운영 외 환경은 204 종료", async () => {
    process.env.VERCEL_ENV = "preview";
    expect((await runPushCron(req("Bearer s3cret-value-for-test"), "kr")).status).toBe(204);
    expect(store.markPushSent).not.toHaveBeenCalled();
  });
});

describe("키 미설정·고아 정리", () => {
  it("키 미설정이면 회차 플래그 전에 중단(복호화 실패로 구독이 지워지는 것 방지)", async () => {
    configured.mockReturnValue(false);
    const res = await runPushCron(req("Bearer s3cret-value-for-test"), "kr");
    expect(await res.json()).toEqual({ skipped: "not-configured" });
    expect(store.markPushSent).not.toHaveBeenCalled();
    expect(store.deletePushSub).not.toHaveBeenCalled();
  });
  it("레코드가 없는 고아 id는 삭제한다", async () => {
    store.listPushSubIdsByTopics.mockResolvedValue(["orphan", "id1"]);
    store.getPushSub.mockImplementation(async (id: string) =>
      id === "orphan" ? null : { endpoint: "https://fcm.googleapis.com/x", p256dh: "p", auth: "a", topics: ["kospi"], cond: "daily", updatedAt: "2026-11-12" },
    );
    await runPushCron(req("Bearer s3cret-value-for-test"), "kr");
    expect(store.deletePushSub).toHaveBeenCalledWith("orphan");
    expect(store.deletePushSub).not.toHaveBeenCalledWith("id1");
  });
});

describe("회차 판정", () => {
  it("국내 16시 전·주말·휴장은 종료, 정상은 오늘 날짜", () => {
    expect(resolveCronWindow("kr", Date.UTC(2026, 10, 12, 6, 0))).toEqual({ ok: false, reason: "too-early" });
    expect(resolveCronWindow("kr", Date.UTC(2026, 10, 14, 7, 30))).toEqual({ ok: false, reason: "holiday" }); // 토
    expect(resolveCronWindow("kr", Date.UTC(2026, 11, 25, 7, 30))).toEqual({ ok: false, reason: "holiday" }); // 성탄절
    expect(resolveCronWindow("kr", KR_NOW)).toMatchObject({ ok: true, marketDate: "2026-11-12" });
  });
  it("미국 KST 9시 전 종료, 전날이 미국 거래일일 때만, 시장일=전날", () => {
    expect(resolveCronWindow("us", Date.UTC(2026, 10, 12, 23, 0))).toEqual({ ok: false, reason: "too-early" });
    expect(resolveCronWindow("us", US_NOW)).toMatchObject({ ok: true, marketDate: "2026-11-12" });
    expect(resolveCronWindow("us", Date.UTC(2026, 10, 16, 0, 30))).toEqual({ ok: false, reason: "holiday" }); // KST 월 → 미국 일요일
    expect(resolveCronWindow("us", Date.UTC(2026, 10, 27, 0, 30))).toEqual({ ok: false, reason: "holiday" }); // 추수감사절 다음 날 아침 KST(11/26 미국 휴장)
  });
});

describe("runPushCron 흐름", () => {
  const AUTH = "Bearer s3cret-value-for-test";
  it("중복 플래그 실패 → 종료, KIS 미호출", async () => {
    store.markPushSent.mockResolvedValue(false);
    const r = await (await runPushCron(req(AUTH), "kr")).json();
    expect(r.skipped).toBe("duplicate");
    expect(kis.getKisAccessToken).not.toHaveBeenCalled();
  });
  it("구독 0이면 KIS 미호출", async () => {
    store.listPushSubIdsByTopics.mockResolvedValue([]);
    expect((await (await runPushCron(req(AUTH), "kr")).json()).skipped).toBe("no-subscribers");
    expect(kis.getKisAccessToken).not.toHaveBeenCalled();
  });
  it("서킷 open(토큰 불가)·예산 초과는 건너뜀(발송 0)", async () => {
    kis.getKisAccessToken.mockResolvedValue({ token: null, unavailable: true });
    expect((await (await runPushCron(req(AUTH), "kr")).json()).skipped).toBe("kis-unavailable");
    kis.getKisAccessToken.mockResolvedValue({ token: "t", unavailable: false });
    budget.mockResolvedValue(false);
    expect((await (await runPushCron(req(AUTH), "kr")).json()).skipped).toBe("budget");
    expect(send).not.toHaveBeenCalled();
  });
  it("시세 전부 실패 → 실패 기록·미발송", async () => {
    quotes.mockResolvedValue({});
    expect((await (await runPushCron(req(AUTH), "kr")).json()).skipped).toBe("no-quotes");
    expect(kis.recordKisFailure).toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });
  it("정상 발송 — 구독의 해당 시장 대상만, 공통 문구", async () => {
    const r = await (await runPushCron(req(AUTH), "kr")).json();
    expect(r).toEqual({ sent: 1, failed: 0, removed: 0 });
    expect(send.mock.calls[0][1]).toEqual({ m: "kr", t: "11/12 국내 종가", b: "코스피 +0.8%" });
  });
  it("410 응답이면 구독 삭제", async () => {
    send.mockResolvedValue("gone");
    const r = await (await runPushCron(req(AUTH), "kr")).json();
    expect(r.removed).toBe(1);
    expect(store.deletePushSub).toHaveBeenCalledWith("id1");
  });
});
