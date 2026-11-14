import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { store, send, configured, usQ, krQ, token, budget } = vi.hoisted(() => ({
  usQ: vi.fn(),
  krQ: vi.fn(),
  token: vi.fn(),
  budget: vi.fn(),
  configured: vi.fn(),
  store: { markPushSent: vi.fn(), listPushSubIdsByTopics: vi.fn(), getPushSub: vi.fn(), deletePushSub: vi.fn(), capLegacyPushTtl: vi.fn() },
  send: vi.fn(),
}));
vi.mock("@/lib/cache-storage", () => ({ getCacheStorage: () => store }));
vi.mock("@/lib/finance/kis-token", () => ({ getKisAccessToken: token, recordKisFailure: vi.fn(), recordKisSuccess: vi.fn() }));
vi.mock("@/server/api-guard", () => ({ withinUpstreamBudget: budget }));
vi.mock("../quotes", async (orig) => ({ ...(await orig<typeof import("../quotes")>()), fetchUsQuotes: usQ, fetchKrQuotes: krQ }));
vi.mock("../send", () => ({ sendPush: send, isPushConfigured: () => configured() }));

const US_OK = { quotes: [{ label: "S&P 500", kind: "index", rate: 0.8, price: 1 }, { label: "나스닥", kind: "index", rate: 1.1, price: 1 }], status: { spx: "ok", comp: "ok" } };
const KR_OK = { quotes: [{ label: "코스피", kind: "index", rate: 0.5, price: 1 }, { label: "코스닥", kind: "index", rate: -0.3, price: 1 }, { label: "환율", kind: "fx", rate: 0.4, price: 1385 }], status: { kospi: "ok", kosdaq: "ok", fx: "ok" } };
const sub = (topics: string[], cond = "daily") => ({ endpoint: "https://fcm.googleapis.com/x", p256dh: "p", auth: "a", topics, cond, updatedAt: "2026-11-12" });

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
  store.getPushSub.mockResolvedValue({ endpoint: "https://fcm.googleapis.com/x", p256dh: "p", auth: "a", topics: ["settle"], cond: "daily", updatedAt: "2026-11-12" });
  send.mockResolvedValue("ok");
  configured.mockReturnValue(true);
  token.mockResolvedValue({ token: "tk", unavailable: false });
  budget.mockResolvedValue(true);
  usQ.mockResolvedValue(US_OK);
  krQ.mockResolvedValue(KR_OK);
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
      id === "orphan" ? null : sub(["settle"]),
    );
    await runPushCron(req(AUTH));
    expect(store.deletePushSub).toHaveBeenCalledWith("orphan");
    expect(store.deletePushSub).not.toHaveBeenCalledWith("id1");
  });
});

describe("runPushCron 흐름", () => {
  it("주말 아침(결산·세금 아님)은 종료 — 플래그·조회·발송 없음", async () => {
    vi.setSystemTime(Date.UTC(2026, 10, 14, 0, 0)); // KST 토요일
    expect((await (await runPushCron(req(AUTH))).json()).skipped).toBe("no-event");
    expect(store.markPushSent).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });
  it("결산 창 첫날 — 종류·날짜 플래그 후 해당 종류 구독자에게만 결산 문구 발송", async () => {
    const r = await (await runPushCron(req(AUTH))).json();
    expect(store.markPushSent).toHaveBeenCalledWith("settle", "2026-11-27");
    expect(store.listPushSubIdsByTopics).toHaveBeenCalledWith(["settle", "morning"]); // 금요일: 아침 요약도 대상 종류
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][1]).toEqual({ m: "settle", t: "11월 결산이 열렸어요", b: "12월 10일까지 이번 달 자산 변화를 볼 수 있어요" });
    expect(r).toMatchObject({ sent: 1, failed: 0, removed: 0 });
  });
  it("세금 마감일(12/24)은 tax 구독자에게 발송", async () => {
    vi.setSystemTime(Date.UTC(2026, 11, 24, 0, 0));
    store.getPushSub.mockResolvedValue(sub(["tax"]));
    await runPushCron(req(AUTH));
    expect(store.listPushSubIdsByTopics).toHaveBeenCalledWith(["tax", "morning"]);
    expect(send.mock.calls[0][1]).toMatchObject({ m: "tax", t: "연금저축·IRP 세액공제" });
  });
  it("중복 플래그 실패 → 조회·발송 없음", async () => {
    store.markPushSent.mockResolvedValue(false);
    const r = await (await runPushCron(req(AUTH))).json();
    expect(r).toMatchObject({ sent: 0, duplicate: 1 });
    expect(send).not.toHaveBeenCalled();
  });
  it("구독 0이면 발송 없음", async () => {
    store.listPushSubIdsByTopics.mockResolvedValue([]);
    expect((await (await runPushCron(req(AUTH))).json()).skipped).toBe("no-subscribers");
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

describe("5.113 구 형식 레코드 만료 축소", () => {
  it("읽은 구독마다 capLegacyPushTtl을 호출하고, 레코드가 없는 고아에는 호출하지 않는다", async () => {
    store.listPushSubIdsByTopics.mockResolvedValue(["id1", "orphan"]);
    store.getPushSub.mockImplementation(async (id: string) => (id === "orphan" ? null : sub(["settle"])));
    await runPushCron(req(AUTH));
    expect(store.capLegacyPushTtl).toHaveBeenCalledTimes(1);
    expect(store.capLegacyPushTtl).toHaveBeenCalledWith("id1");
  });
});

describe("시장 알림 회차", () => {
  it("아침(평일) — 아침 구독자에게 미국|국내 본문, 한국 휴장일에도 발송(11/26 목은 미국 휴장 구절)", async () => {
    vi.setSystemTime(Date.UTC(2026, 10, 24, 0, 0)); // KST 화요일 11/24
    store.getPushSub.mockResolvedValue(sub(["morning"]));
    const r = await (await runPushCron(req(AUTH))).json();
    expect(store.markPushSent).toHaveBeenCalledWith("morning", "2026-11-24");
    expect(usQ.mock.calls[0][0]).toBe("2026-11-23"); // 직전 미국 거래일
    expect(krQ.mock.calls[0][0]).toBe("2026-11-23"); // 직전 국내 거래일
    expect(send.mock.calls[0][1]).toEqual({
      m: "morning",
      t: "11/24 아침 시장",
      b: "미국 S&P 500 +0.8% · 나스닥 +1.1% | 국내 코스피 +0.5% · 코스닥 -0.3% · 환율 1,385원(+0.4%)",
    });
    expect(r).toMatchObject({ sent: 1 });
  });
  it("월요일은 금요일 미국·국내 종가를 기대일로 쓴다", async () => {
    vi.setSystemTime(Date.UTC(2026, 10, 22, 15, 0)); // KST 월요일 11/23 00:00
    vi.setSystemTime(Date.UTC(2026, 10, 23, 0, 0)); // KST 월요일 11/23 09:00
    store.getPushSub.mockResolvedValue(sub(["morning"]));
    await runPushCron(req(AUTH));
    expect(usQ.mock.calls[0][0]).toBe("2026-11-20");
    expect(krQ.mock.calls[0][0]).toBe("2026-11-20");
  });
  it("한국 휴장일(12/25 금)에도 아침 요약은 간다", async () => {
    vi.setSystemTime(Date.UTC(2026, 11, 25, 0, 0));
    store.getPushSub.mockResolvedValue(sub(["morning"]));
    await runPushCron(req(AUTH));
    expect(send.mock.calls[0][1].b).toContain("오늘 미국·국내 휴장");
  });
  it("결산 + 아침 → 1건으로 합침(결산 제목, 둘째 줄 아침 제목)", async () => {
    store.getPushSub.mockResolvedValue(sub(["morning", "settle"])); // SETTLE_DAY 11/27 금
    await runPushCron(req(AUTH));
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][1]).toMatchObject({ m: "settle", t: "11월 결산이 열렸어요" });
    expect(send.mock.calls[0][1].b).toContain("\n11/27 아침 시장");
  });
  it("시세 전부 실패 — 아침 플래그를 잡지 않고 미발송, 결산은 그대로 발송", async () => {
    usQ.mockResolvedValue({ quotes: [], status: { spx: "fail", comp: "fail" } });
    krQ.mockResolvedValue({ quotes: [], status: { kospi: "fail", kosdaq: "fail", fx: "fail" } });
    store.getPushSub.mockResolvedValue(sub(["morning", "settle"]));
    await runPushCron(req(AUTH));
    expect(store.markPushSent).not.toHaveBeenCalledWith("morning", expect.anything());
    expect(send.mock.calls[0][1].m).toBe("settle");
    expect(send.mock.calls[0][1].b).not.toContain("\n");
  });
  it("KIS 토큰 없음 — 아침 미발송", async () => {
    token.mockResolvedValue({ token: null, unavailable: true });
    store.getPushSub.mockResolvedValue(sub(["morning"]));
    vi.setSystemTime(Date.UTC(2026, 10, 24, 0, 0));
    const r = await (await runPushCron(req(AUTH))).json();
    expect(send).not.toHaveBeenCalled();
    expect(r.quotes).toEqual({ kis: "no-token" });
  });
  it("조건 pm2 — 큰 움직임 없으면 그 구독자만 건너뜀", async () => {
    vi.setSystemTime(Date.UTC(2026, 10, 24, 0, 0));
    store.listPushSubIdsByTopics.mockResolvedValue(["a", "b"]);
    store.getPushSub.mockImplementation(async (id: string) => (id === "a" ? sub(["morning"], "pm2") : sub(["morning"])));
    const r = await (await runPushCron(req(AUTH))).json();
    expect(r).toMatchObject({ sent: 1, skipped: 1 });
  });
  it("국내 회차(16시) — 평일만, 오늘 종가를 기대일로, 아침 종류는 건드리지 않음", async () => {
    vi.setSystemTime(Date.UTC(2026, 10, 24, 7, 0));
    store.getPushSub.mockResolvedValue(sub(["kr", "morning"]));
    await runPushCron(req(AUTH), "kr");
    expect(store.listPushSubIdsByTopics).toHaveBeenCalledWith(["kr"]);
    expect(krQ.mock.calls[0][0]).toBe("2026-11-24");
    expect(usQ).not.toHaveBeenCalled();
    expect(send.mock.calls[0][1]).toMatchObject({ m: "kr", t: "11/24 국내 종가" });
  });
  it("국내 회차 — 한국 휴장일·주말은 종료", async () => {
    vi.setSystemTime(Date.UTC(2026, 11, 25, 7, 0));
    expect((await (await runPushCron(req(AUTH), "kr")).json()).skipped).toBe("no-event");
    vi.setSystemTime(Date.UTC(2026, 10, 28, 7, 0));
    expect((await (await runPushCron(req(AUTH), "kr")).json()).skipped).toBe("no-event");
  });
  it("환율 stale이면 국내 알림은 지수 2개만", async () => {
    vi.setSystemTime(Date.UTC(2026, 10, 24, 7, 0));
    krQ.mockResolvedValue({ quotes: KR_OK.quotes.slice(0, 2), status: { kospi: "ok", kosdaq: "ok", fx: "stale" } });
    store.getPushSub.mockResolvedValue(sub(["kr"]));
    await runPushCron(req(AUTH), "kr");
    expect(send.mock.calls[0][1].b).toBe("코스피 +0.5% · 코스닥 -0.3%");
  });
});
