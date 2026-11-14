import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { FileCacheStorage } from "@/lib/cache-storage";
import { createCipheriv, randomBytes } from "crypto";
import { getStoreKey, pushSubId } from "../crypto";
import type { PushSubRecord } from "../types";

const KEY = Buffer.alloc(32, 7).toString("base64");
const ENDPOINT = "https://fcm.googleapis.com/fcm/send/SECRET-ENDPOINT-TOKEN";
const rec = (over: Partial<PushSubRecord> = {}): PushSubRecord => ({
  endpoint: ENDPOINT, p256dh: "P".repeat(87), auth: "AUTHSECRET12345678901", topics: ["settle", "tax"], cond: "daily", updatedAt: "2026-11-12", ...over,
});

let dir = "";
let file = "";
const env = { ...process.env };
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "push-"));
  file = path.join(dir, "push.json");
  process.env.PUSH_SUBS_FILE = file;
  process.env.PUSH_STORE_KEY = KEY;
  delete process.env.VERCEL_ENV;
});
afterEach(() => {
  process.env = { ...env };
  fs.rmSync(dir, { recursive: true, force: true });
});

describe("push 저장소", () => {
  it("저장 파일에 평문 endpoint·keys가 없다(AES-GCM 블롭 + 카탈로그 ID·조건·날짜만)", async () => {
    const st = new FileCacheStorage();
    const id = pushSubId(ENDPOINT);
    await st.putPushSub(id, rec());
    const raw = fs.readFileSync(file, "utf8");
    expect(raw).not.toContain("SECRET-ENDPOINT-TOKEN");
    expect(raw).not.toContain("fcm.googleapis.com");
    expect(raw).not.toContain("AUTHSECRET");
    expect(raw).not.toContain("P".repeat(20));
    expect(Object.keys(JSON.parse(raw).subs[`push:dev:sub:${id}`].rec).sort()).toEqual(["blob", "cond", "createdAt", "topics", "updatedAt"]);
    expect(await st.getPushSub(id)).toEqual(rec());
  });
  it("id는 HMAC — sha256 단순 해시와 다르고 키가 다르면 달라진다", () => {
    const a = pushSubId(ENDPOINT);
    process.env.PUSH_STORE_KEY = Buffer.alloc(32, 9).toString("base64");
    expect(pushSubId(ENDPOINT)).not.toBe(a);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });
  it("키가 바뀌면 복호화 실패 → null(발송 불가, 평문 노출 없음)", async () => {
    const st = new FileCacheStorage();
    await st.putPushSub("x", rec());
    process.env.PUSH_STORE_KEY = Buffer.alloc(32, 1).toString("base64");
    expect(await st.getPushSub("x")).toBeNull();
  });
  it("환경 접두어 — preview 구독은 prod 조회에 안 나온다", async () => {
    const st = new FileCacheStorage();
    process.env.VERCEL_ENV = "preview";
    await st.putPushSub("p1", rec());
    expect(await st.listPushSubIdsByTopics(["settle"])).toEqual(["p1"]);
    process.env.VERCEL_ENV = "production";
    expect(await st.listPushSubIdsByTopics(["settle"])).toEqual([]);
    expect(await st.getPushSub("p1")).toBeNull();
    expect(Object.keys(JSON.parse(fs.readFileSync(file, "utf8")).subs)[0]).toBe("push:preview:sub:p1");
  });
  it("토픽 역색인 — 갱신 시 이전 토픽에서 빠지고 삭제 시 모두 빠진다", async () => {
    const st = new FileCacheStorage();
    await st.putPushSub("a", rec({ topics: ["settle"] }));
    await st.putPushSub("b", rec({ topics: ["tax"] }));
    expect((await st.listPushSubIdsByTopics(["settle", "tax"])).sort()).toEqual(["a", "b"]);
    await st.putPushSub("a", rec({ topics: ["tax"] }));
    expect(await st.listPushSubIdsByTopics(["settle"])).toEqual([]);
    await st.deletePushSub("a");
    expect(await st.listPushSubIdsByTopics(["tax"])).toEqual(["b"]);
  });
  it("회차 중복 플래그 NX", async () => {
    const st = new FileCacheStorage();
    expect(await st.markPushSent("settle", "2026-11-12")).toBe(true);
    expect(await st.markPushSent("settle", "2026-11-12")).toBe(false);
    expect(await st.markPushSent("tax", "2026-11-12")).toBe(true);
  });
  it("전체 구독 수 — 저장·삭제·환경 접두 분리", async () => {
    const st = new FileCacheStorage();
    expect(await st.countPushSubs()).toBe(0);
    await st.putPushSub("a", rec());
    await st.putPushSub("b", rec());
    await st.putPushSub("a", rec({ topics: ["tax"] }));
    expect(await st.countPushSubs()).toBe(2);
    await st.deletePushSub("a");
    await st.deletePushSub("없는-id"); // 고아 삭제도 오류 없음
    expect(await st.countPushSubs()).toBe(1);
    process.env.VERCEL_ENV = "preview";
    expect(await st.countPushSubs()).toBe(0);
  });
  it("cond 없는 이전 레코드는 daily로 읽는다(구버전 혼재)", async () => {
    const st = new FileCacheStorage();
    const id = pushSubId(ENDPOINT);
    await st.putPushSub(id, rec());
    const data = JSON.parse(fs.readFileSync(file, "utf8"));
    delete data.subs[`push:dev:sub:${id}`].rec.cond;
    fs.writeFileSync(file, JSON.stringify(data));
    expect((await new FileCacheStorage().getPushSub(id))?.cond).toBe("daily");
  });
});

const DAY = 24 * 3600 * 1000;
const subsOf = () => JSON.parse(fs.readFileSync(file, "utf8")).subs as Record<string, { rec: { blob: string }; expires_at: number }>;
const legacyBlob = () => {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", getStoreKey()!, iv, { authTagLength: 16 });
  const ct = Buffer.concat([c.update(JSON.stringify({ endpoint: ENDPOINT, p256dh: "p", auth: "a" }), "utf8"), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), ct]).toString("base64");
};

describe("5.113 보관 30일", () => {
  it("저장 시 만료는 30일(90일 아님), 블롭은 2: 접두", async () => {
    const st = new FileCacheStorage();
    await st.putPushSub("a", rec());
    const e = subsOf()["push:dev:sub:a"];
    const left = e.expires_at - Date.now();
    expect(left).toBeLessThanOrEqual(30 * DAY);
    expect(left).toBeGreaterThan(30 * DAY - 60_000);
    expect(e.rec.blob.startsWith("2:")).toBe(true);
  });
  it("구독 갱신(재저장) 시 만료가 다시 30일로 연장된다", async () => {
    const st = new FileCacheStorage();
    await st.putPushSub("a", rec());
    const data = JSON.parse(fs.readFileSync(file, "utf8"));
    data.subs["push:dev:sub:a"].expires_at = Date.now() + 2 * DAY;
    fs.writeFileSync(file, JSON.stringify(data));
    await st.putPushSub("a", rec());
    expect(subsOf()["push:dev:sub:a"].expires_at - Date.now()).toBeGreaterThan(29 * DAY);
  });
  it("capLegacyPushTtl: 구 형식 + 만료 90일 → 30일로 축소, 이미 짧으면 유지, 신 형식은 무변경", async () => {
    const st = new FileCacheStorage();
    await st.putPushSub("n", rec());
    const data = JSON.parse(fs.readFileSync(file, "utf8"));
    data.subs["push:dev:sub:old90"] = { rec: { blob: legacyBlob(), topics: ["settle"], createdAt: "x", updatedAt: "x" }, expires_at: Date.now() + 90 * DAY };
    data.subs["push:dev:sub:old5"] = { rec: { blob: legacyBlob(), topics: ["settle"], createdAt: "x", updatedAt: "x" }, expires_at: Date.now() + 5 * DAY };
    data.subs["push:dev:sub:n"].expires_at = Date.now() + 90 * DAY; // 신 형식은 건드리지 않음을 확인
    fs.writeFileSync(file, JSON.stringify(data));
    const before5 = subsOf()["push:dev:sub:old5"].expires_at;
    for (const id of ["old90", "old5", "n"]) await st.capLegacyPushTtl(id);
    await st.capLegacyPushTtl("없는-id");
    const after = subsOf();
    expect(after["push:dev:sub:old90"].expires_at - Date.now()).toBeLessThanOrEqual(30 * DAY);
    expect(after["push:dev:sub:old5"].expires_at).toBe(before5);
    expect(after["push:dev:sub:n"].expires_at - Date.now()).toBeGreaterThan(89 * DAY);
  });
  it("구 형식 레코드(구 id·구 블롭)도 이중 읽기로 조회된다", async () => {
    const st = new FileCacheStorage();
    const data = { subs: { "push:dev:sub:oldid": { rec: { blob: legacyBlob(), topics: ["tax"], createdAt: "x", updatedAt: "2026-11-01" }, expires_at: Date.now() + DAY } }, sent: {} };
    fs.writeFileSync(file, JSON.stringify(data));
    expect(await st.getPushSub("oldid")).toMatchObject({ endpoint: ENDPOINT, topics: ["tax"] });
  });
});

describe("5.113 Upstash 저장소 TTL", () => {
  it("putPushSub·capLegacyPushTtl이 30일 EXPIRE를 쓴다", async () => {
    vi.resetModules();
    const calls: { fn: string; args: unknown[] }[] = [];
    const store = new Map<string, unknown>();
    const ttlOf = new Map<string, number>();
    vi.doMock("@upstash/redis", () => ({
      Redis: class {
        async get(k: string) { return store.get(k) ?? null; }
        async set(k: string, v: unknown, o?: { ex?: number }) { store.set(k, v); if (o?.ex) ttlOf.set(k, o.ex); calls.push({ fn: "set", args: [k, o] }); return "OK"; }
        async sadd() { return 1; }
        async srem() { return 1; }
        async expire(k: string, sec: number) { ttlOf.set(k, sec); calls.push({ fn: "expire", args: [k, sec] }); return 1; }
        async ttl(k: string) { return ttlOf.get(k) ?? -2; }
      },
    }));
    process.env.KV_REST_API_URL = "https://kv.test";
    process.env.KV_REST_API_TOKEN = "t";
    const { getCacheStorage } = await import("@/lib/cache-storage");
    const st = getCacheStorage();
    await st.putPushSub("u1", rec());
    expect(ttlOf.get("push:dev:sub:u1")).toBe(30 * 24 * 3600);
    // 구 형식 90일 레코드 → 30일로 축소(1회), 이후 재호출은 변화 없음
    store.set("push:dev:sub:u2", { blob: legacyBlob(), topics: ["tax"], createdAt: "x", updatedAt: "x" });
    ttlOf.set("push:dev:sub:u2", 90 * 24 * 3600);
    await st.capLegacyPushTtl("u2");
    expect(ttlOf.get("push:dev:sub:u2")).toBe(30 * 24 * 3600);
    const n = calls.filter((c) => c.fn === "expire" && c.args[0] === "push:dev:sub:u2").length;
    await st.capLegacyPushTtl("u2");
    expect(calls.filter((c) => c.fn === "expire" && c.args[0] === "push:dev:sub:u2").length).toBe(n);
    // 신 형식은 건드리지 않는다
    ttlOf.set("push:dev:sub:u1", 90 * 24 * 3600);
    await st.capLegacyPushTtl("u1");
    expect(ttlOf.get("push:dev:sub:u1")).toBe(90 * 24 * 3600);
    vi.doUnmock("@upstash/redis");
    delete process.env.KV_REST_API_URL;
    delete process.env.KV_REST_API_TOKEN;
  });
});
