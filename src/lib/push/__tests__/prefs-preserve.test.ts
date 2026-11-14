// #179 D1 — 로컬 설정 키는 가져오기·복원·동기화 pull·구버전 clearAssetData에 지워지지 않고, 구 키는 1회 이전된다.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { applyImportedPayload, clearAssetData } from "@/lib/asset/asset-storage";
import { emptyData, g, memoryStorage } from "@/lib/__tests__/physical-fixtures";
import { LEGACY_PUSH_PREFS_KEY, PUSH_PREFS_KEY, clearPushPrefs, readPushPrefs, writePushPrefs } from "../prefs";

const ON = { v: 2 as const, on: true, topics: ["settle", "tax"] };

beforeEach(() => {
  g.window = globalThis;
  g.localStorage = memoryStorage();
});
afterEach(() => {
  delete g.window;
  delete g.localStorage;
  vi.unstubAllGlobals();
});

describe("키 이름", () => {
  it("점 접두 — clearAssetData의 secretasset_ 접두 삭제에 걸리지 않는다", () => {
    expect(PUSH_PREFS_KEY).toBe("secretasset.push_prefs");
    expect(PUSH_PREFS_KEY.startsWith("secretasset_")).toBe(false);
  });
});

describe("보존", () => {
  it("켜기 → applyImportedPayload(가져오기·복원·동기화 pull 경로) → prefs 보존", () => {
    writePushPrefs(ON);
    expect(applyImportedPayload({ assetData: emptyData() })).toBeTruthy();
    expect(readPushPrefs()).toEqual(ON);
  });
  it("clearAssetData 후에도 보존, 명시 삭제(clearPushPrefs)만 지운다", () => {
    writePushPrefs(ON);
    clearAssetData();
    expect(readPushPrefs()).toEqual(ON);
    clearPushPrefs();
    expect(localStorage.getItem(PUSH_PREFS_KEY)).toBeNull();
    expect(readPushPrefs().on).toBe(false);
  });
});

describe("이전 버전 데이터 → 새 버전 (구 키 secretasset_push_prefs)", () => {
  it("구 키만 있으면 읽을 때 1회 새 키로 옮기고 구 키를 삭제한다", () => {
    localStorage.setItem(LEGACY_PUSH_PREFS_KEY, JSON.stringify(ON));
    expect(readPushPrefs()).toEqual(ON);
    expect(localStorage.getItem(PUSH_PREFS_KEY)).not.toBeNull();
    expect(localStorage.getItem(LEGACY_PUSH_PREFS_KEY)).toBeNull();
    clearAssetData();
    expect(readPushPrefs()).toEqual(ON);
  });
  it("새 키가 이미 있으면 새 키 우선, 구 키는 삭제", () => {
    writePushPrefs({ ...ON, topics: ["tax"] });
    localStorage.setItem(LEGACY_PUSH_PREFS_KEY, JSON.stringify(ON));
    expect(readPushPrefs().topics).toEqual(["tax"]);
    expect(localStorage.getItem(LEGACY_PUSH_PREFS_KEY)).toBeNull();
  });
  it("v1 값(지수 ID·조건)이 저장돼 있으면 무시하고 off·미선택으로 읽는다 — 새 값을 쓰면 v2로 교체", () => {
    localStorage.setItem(PUSH_PREFS_KEY, JSON.stringify({ v: 1, on: true, topics: ["kospi", "spx"], cond: "pm2" }));
    expect(readPushPrefs()).toEqual({ v: 2, on: false, topics: [] });
    localStorage.setItem(LEGACY_PUSH_PREFS_KEY, JSON.stringify({ v: 1, on: true, topics: ["kospi"], cond: "daily" }));
    localStorage.removeItem(PUSH_PREFS_KEY);
    expect(readPushPrefs()).toEqual({ v: 2, on: false, topics: [] });
    writePushPrefs(ON);
    expect(readPushPrefs()).toEqual(ON);
  });
  it("구 키가 깨져 있어도 오류 없이 기본값(off)", () => {
    localStorage.setItem(LEGACY_PUSH_PREFS_KEY, "{bad");
    expect(readPushPrefs().on).toBe(false);
  });
});

describe("모든 데이터 삭제 — 실제 기기 구독 기준(R4)", () => {
  it("prefs가 off로 보여도 기기 구독이 있으면 서버 DELETE + unsubscribe 호출", async () => {
    const unsubscribe = vi.fn().mockResolvedValue(true);
    const sub = { endpoint: "https://fcm.googleapis.com/fcm/send/x", unsubscribe };
    vi.stubGlobal("navigator", { serviceWorker: { ready: Promise.resolve({ pushManager: { getSubscription: async () => sub } }) } });
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);
    const { unsubscribePush } = await import("../client");
    expect(readPushPrefs().on).toBe(false); // 로컬 설정은 없음
    await unsubscribePush(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe("/api/push/subscribe");
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: "DELETE", body: JSON.stringify({ endpoint: sub.endpoint }) });
    expect(unsubscribe).toHaveBeenCalled();
  });
});
