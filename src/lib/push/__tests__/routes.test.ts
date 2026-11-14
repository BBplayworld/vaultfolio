import { describe, it, expect, vi, beforeEach } from "vitest";

const { store, send, configured, build } = vi.hoisted(() => ({ build: vi.fn(), configured: vi.fn(() => true), store: { countPushSubs: vi.fn(), putPushSub: vi.fn(), deletePushSub: vi.fn(), getPushSub: vi.fn(), acquireLock: vi.fn(), incrementCounter: vi.fn() }, send: vi.fn() }));
vi.mock("@/lib/cache-storage", () => ({ getCacheStorage: () => store }));
vi.mock("../test-payloads", () => ({ buildTestPayloads: (...a: unknown[]) => build(...a) }));
vi.mock("../send", () => ({ isPushConfigured: () => configured(), sendPush: send }));

import { POST, DELETE } from "@/app/api/push/subscribe/route";
import { POST as TEST } from "@/app/api/push/test/route";
import { NextRequest } from "next/server";

const ENDPOINT = "https://fcm.googleapis.com/fcm/send/abc";
const body = { endpoint: ENDPOINT, p256dh: "B".repeat(87), auth: "a".repeat(22), topics: ["settle"], cond: "daily" as const, standalone: true };
let n = 0;
const mk = (method: string, b: unknown) => {
  const s = JSON.stringify(b);
  return new NextRequest("http://localhost/api/push/x", { method, body: s, headers: { "content-length": String(s.length), "content-type": "application/json", "x-real-ip": `10.0.0.${++n}` } });
};

beforeEach(() => {
  vi.clearAllMocks();
  process.env.PUSH_STORE_KEY = Buffer.alloc(32, 3).toString("base64");
  delete process.env.VERCEL_ENV;
  store.incrementCounter.mockResolvedValue(1);
  configured.mockReturnValue(true);
  store.getPushSub.mockResolvedValue(null);
  store.countPushSubs.mockResolvedValue(0);
});

describe("/api/push/subscribe", () => {
  it("정상 저장 — 레코드에 IP·UA 없음, id는 sha256 단순 해시가 아님", async () => {
    const res = await POST(mk("POST", body));
    expect(res.status).toBe(200);
    const [id, rec] = store.putPushSub.mock.calls[0];
    expect(id).toMatch(/^[0-9a-f]{64}$/);
    expect(Object.keys(rec).sort()).toEqual(["auth", "cond", "endpoint", "p256dh", "topics", "updatedAt"]);
    expect(rec.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
  it("standalone 없음·카탈로그 외 ID·허용 외 호스트는 400", async () => {
    for (const b of [{ ...body, standalone: undefined }, { ...body, topics: ["x"] }, { ...body, endpoint: "https://evil.com/x" }]) {
      expect((await POST(mk("POST", b))).status).toBe(400);
    }
    expect(store.putPushSub).not.toHaveBeenCalled();
  });
  it("본문 길이 헤더 없음 411·초과 413·cross-site 403", async () => {
    expect((await POST(new NextRequest("http://localhost/x", { method: "POST", body: "{}" }))).status).toBe(411);
    expect((await POST(new NextRequest("http://localhost/x", { method: "POST", body: "{}", headers: { "content-length": "99999" } }))).status).toBe(413);
    expect((await POST(new NextRequest("http://localhost/x", { method: "POST", body: "{}", headers: { "content-length": "2", "sec-fetch-site": "cross-site" } }))).status).toBe(403);
  });
  it("rate limit 초과 429", async () => {
    store.incrementCounter.mockResolvedValue(999);
    expect((await POST(mk("POST", body))).status).toBe(429);
  });
  it("전체 구독 수 상한 — 신규는 503, 기존 구독 갱신은 허용", async () => {
    store.countPushSubs.mockResolvedValue(5000);
    expect((await POST(mk("POST", body))).status).toBe(503);
    expect(store.putPushSub).not.toHaveBeenCalled();
    store.getPushSub.mockResolvedValue({ ...body, updatedAt: "2026-11-12" });
    expect((await POST(mk("POST", body))).status).toBe(200);
  });
  it("키 미설정 — POST 503, DELETE는 500이 아니라 안전 응답(200)", async () => {
    configured.mockReturnValue(false);
    expect((await POST(mk("POST", body))).status).toBe(503);
    const res = await DELETE(mk("DELETE", { endpoint: ENDPOINT }));
    expect(res.status).toBe(200);
    expect(store.deletePushSub).not.toHaveBeenCalled();
  });
  it("DELETE — endpoint 원문으로 HMAC id 삭제", async () => {
    expect((await DELETE(mk("DELETE", { endpoint: ENDPOINT }))).status).toBe(200);
    expect(store.deletePushSub).toHaveBeenCalledTimes(1);
    expect(store.deletePushSub.mock.calls[0][0]).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("/api/push/test", () => {
  it("운영은 404", async () => {
    process.env.VERCEL_ENV = "production";
    expect((await TEST(mk("POST", { endpoint: ENDPOINT }))).status).toBe(404);
  });
  it("저장 안 된 구독은 404, 발송 없음", async () => {
    store.getPushSub.mockResolvedValue(null);
    expect((await TEST(mk("POST", { endpoint: ENDPOINT }))).status).toBe(404);
    expect(send).not.toHaveBeenCalled();
  });
  it("쿨다운 429, 정상 시 본인 구독에 종류별 생성 알림을 1건씩", async () => {
    build.mockResolvedValue([{ m: "settle", t: "11월 결산이 열렸어요", b: "x" }, { m: "tax", t: "세금", b: "y" }]);
    store.getPushSub.mockResolvedValue({ endpoint: ENDPOINT, p256dh: "p", auth: "a", topics: ["settle"], cond: "daily", updatedAt: "2026-11-12" });
    store.acquireLock.mockResolvedValueOnce(null);
    expect((await TEST(mk("POST", { endpoint: ENDPOINT }))).status).toBe(429);
    store.acquireLock.mockResolvedValueOnce("tok");
    send.mockResolvedValue("ok");
    expect((await TEST(mk("POST", { endpoint: ENDPOINT }))).status).toBe(200);
    expect(send).toHaveBeenCalledTimes(2);
    expect(send.mock.calls[0][1].m).toBe("settle");
    expect(build.mock.calls[0][0]).toEqual(["settle"]);
  });
});
