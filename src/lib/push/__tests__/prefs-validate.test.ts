import { describe, it, expect } from "vitest";
import { consumePushFlag, defaultPushPrefs, parsePushPrefs, summarizePushPrefs } from "../prefs";
import { isAllowedPushEndpoint, parseSubscribeBody } from "../validate";

describe("prefs (이전 버전 데이터 → 새 버전: 키 없음·손상은 기본 off·미선택)", () => {
  it("키 없음·깨진 JSON·v 불일치 → 기본값 off·종류 미선택(미리 체크 없음)", () => {
    for (const raw of [null, "{oops", JSON.stringify({ v: 4, on: true }), "null", ""]) {
      expect(parsePushPrefs(raw)).toEqual(defaultPushPrefs());
    }
    expect(defaultPushPrefs()).toEqual({ v: 3, on: false, topics: [], cond: "daily" });
  });
  it("구버전 v1 값(지수 ID·조건)은 무시하고 기본값 — 켜져 있던 값도 off로 읽는다", () => {
    expect(parsePushPrefs(JSON.stringify({ v: 1, on: true, topics: ["kospi", "sox"], cond: "pm2" }))).toEqual(defaultPushPrefs());
    expect(parsePushPrefs(JSON.stringify({ v: 1, on: false, topics: ["spx"], cond: "daily" }))).toEqual(defaultPushPrefs());
  });
  it("정상 값 보존·알 수 없는 ID 제거, 종류가 비면 on 해제", () => {
    expect(parsePushPrefs(JSON.stringify({ v: 3, on: true, topics: ["tax", "x", "kospi", "morning"], cond: "pm2" }))).toEqual({ v: 3, on: true, topics: ["morning", "tax"], cond: "pm2" });
    expect(parsePushPrefs(JSON.stringify({ v: 3, on: true, topics: ["kospi"], cond: "zzz" }))).toEqual({ v: 3, on: false, topics: [], cond: "daily" });
    expect(parsePushPrefs(JSON.stringify({ v: 2, on: true, topics: ["tax"] }))).toEqual(defaultPushPrefs()); // v2는 못 읽음 → 기본값
  });
  it("요약 문구", () => {
    const label = (id: string) => id;
    expect(summarizePushPrefs({ topics: ["a", "b"], cond: "daily" }, label)).toBe("a, b");
    expect(summarizePushPrefs({ topics: ["morning", "tax"], cond: "pm2" }, label)).toBe("morning, tax · 큰 움직임 있는 날만");
    expect(summarizePushPrefs({ topics: ["tax"], cond: "pm2" }, label)).toBe("tax"); // 조건 대상 종류가 없으면 생략
  });
  it("자산 키는 건드리지 않는다(소스에 asset 키 참조 없음)", async () => {
    const src = (await import("fs")).readFileSync(new URL("../prefs.ts", import.meta.url), "utf8");
    expect(src).not.toMatch(/secretasset_asset_data|assetData/);
  });
});

describe("consumePushFlag", () => {
  it("from=push·t 제거, 종류 추출", () => {
    expect(consumePushFlag("/?from=push")).toEqual({ fromPush: true, target: null, cleanUrl: "/" });
    expect(consumePushFlag("/?from=push&t=settle")).toEqual({ fromPush: true, target: "settle", cleanUrl: "/" });
    expect(consumePushFlag("/?a=1&from=push&t=tax#x")).toEqual({ fromPush: true, target: "tax", cleanUrl: "/?a=1#x" });
    expect(consumePushFlag("/?from=push&t=morning").target).toBe("morning");
    expect(consumePushFlag("/?from=push&t=kr").target).toBe("kr");
    expect(consumePushFlag("/?from=push&t=zzz").target).toBeNull();
    expect(consumePushFlag("/?a=1").fromPush).toBe(false);
  });
});

const ok = {
  endpoint: "https://fcm.googleapis.com/fcm/send/abc",
  p256dh: "B".repeat(87),
  auth: "a".repeat(22),
  topics: ["morning", "kr", "settle", "tax"],
  cond: "daily",
  standalone: true,
};

describe("subscribe 검증", () => {
  it("정상", () => expect(parseSubscribeBody(ok)).not.toBeNull());
  it("standalone 플래그 없으면 거부", () => {
    expect(parseSubscribeBody({ ...ok, standalone: undefined })).toBeNull();
    expect(parseSubscribeBody({ ...ok, standalone: false })).toBeNull();
  });
  it("카탈로그 외 ID(구버전 지수 ID 포함)·빈 목록·중복 거부", () => {
    expect(parseSubscribeBody({ ...ok, topics: ["zzz"] })).toBeNull();
    expect(parseSubscribeBody({ ...ok, topics: [] })).toBeNull();
    expect(parseSubscribeBody({ ...ok, topics: ["settle", "settle"] })).toBeNull();
    expect(parseSubscribeBody({ ...ok, topics: ["kospi"] })).toBeNull();
  });
  it("cond는 daily·pm2만", () => {
    expect(parseSubscribeBody({ ...ok, cond: "pm2" })?.cond).toBe("pm2");
    expect(parseSubscribeBody({ ...ok, cond: undefined })).toBeNull();
    expect(parseSubscribeBody({ ...ok, cond: "x" })).toBeNull();
  });
  it("키 길이·형식 검증", () => {
    expect(parseSubscribeBody({ ...ok, p256dh: "x" })).toBeNull();
    expect(parseSubscribeBody({ ...ok, auth: "a".repeat(200) })).toBeNull();
    expect(parseSubscribeBody({ ...ok, auth: "한글한글한글한글한글" })).toBeNull();
  });
  it("endpoint 호스트 화이트리스트", () => {
    for (const e of [
      "https://fcm.googleapis.com/x",
      "https://web.push.apple.com/x",
      "https://updates.push.services.mozilla.com/x",
      "https://wns2-abc.notify.windows.com/x",
    ]) expect(isAllowedPushEndpoint(e)).toBe(true);
    for (const e of ["http://fcm.googleapis.com/x", "https://evil.example.com/x", "https://fcm.googleapis.com.evil.com/x", "ftp://x", 3, "https://" + "a".repeat(700) + ".push.apple.com"])
      expect(isAllowedPushEndpoint(e)).toBe(false);
  });
});
