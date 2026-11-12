import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { FileCacheStorage } from "@/lib/cache-storage";
import { pushSubId } from "../crypto";
import type { PushSubRecord } from "../types";

const KEY = Buffer.alloc(32, 7).toString("base64");
const ENDPOINT = "https://fcm.googleapis.com/fcm/send/SECRET-ENDPOINT-TOKEN";
const rec = (over: Partial<PushSubRecord> = {}): PushSubRecord => ({
  endpoint: ENDPOINT, p256dh: "P".repeat(87), auth: "AUTHSECRET12345678901", topics: ["kospi", "spx"], cond: "daily", updatedAt: "2026-11-12", ...over,
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
    expect(await st.listPushSubIdsByTopics(["kospi"])).toEqual(["p1"]);
    process.env.VERCEL_ENV = "production";
    expect(await st.listPushSubIdsByTopics(["kospi"])).toEqual([]);
    expect(await st.getPushSub("p1")).toBeNull();
    expect(Object.keys(JSON.parse(fs.readFileSync(file, "utf8")).subs)[0]).toBe("push:preview:sub:p1");
  });
  it("토픽 역색인 — 갱신 시 이전 토픽에서 빠지고 삭제 시 모두 빠진다", async () => {
    const st = new FileCacheStorage();
    await st.putPushSub("a", rec({ topics: ["kospi"] }));
    await st.putPushSub("b", rec({ topics: ["spx"] }));
    expect((await st.listPushSubIdsByTopics(["kospi", "spx"])).sort()).toEqual(["a", "b"]);
    await st.putPushSub("a", rec({ topics: ["spx"] }));
    expect(await st.listPushSubIdsByTopics(["kospi"])).toEqual([]);
    await st.deletePushSub("a");
    expect(await st.listPushSubIdsByTopics(["spx"])).toEqual(["b"]);
  });
  it("회차 중복 플래그 NX", async () => {
    const st = new FileCacheStorage();
    expect(await st.markPushSent("kr", "2026-11-12")).toBe(true);
    expect(await st.markPushSent("kr", "2026-11-12")).toBe(false);
    expect(await st.markPushSent("us", "2026-11-12")).toBe(true);
  });
  it("전체 구독 수 — 저장·삭제·환경 접두 분리", async () => {
    const st = new FileCacheStorage();
    expect(await st.countPushSubs()).toBe(0);
    await st.putPushSub("a", rec());
    await st.putPushSub("b", rec());
    await st.putPushSub("a", rec({ topics: ["spx"] }));
    expect(await st.countPushSubs()).toBe(2);
    await st.deletePushSub("a");
    await st.deletePushSub("없는-id"); // 고아 삭제도 오류 없음
    expect(await st.countPushSubs()).toBe(1);
    process.env.VERCEL_ENV = "preview";
    expect(await st.countPushSubs()).toBe(0);
  });
});
