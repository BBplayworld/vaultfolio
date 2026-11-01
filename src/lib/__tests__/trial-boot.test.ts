// #59 체험 모드 부팅 — 거부 판정(읽기 전용)·메모리 Storage·검증 5종(S1 모킹)·fetch 거부 래퍼.
// node 환경(jsdom 없음). 원본 Storage는 키를 own 열거 속성으로 두는 가짜(실제 Storage처럼 Object.keys에 잡힘).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import {
  bootTrial,
  createMemoryStorage,
  createTrialFetch,
  isTrialBlockedRequest,
  trialRejectReason,
} from "../trial/trial-boot";
import { __resetTrialModeForTest, isTrialMode, TRIAL_BLOCKED_MESSAGE } from "../trial/trial-mode";
import { assetDataSchema } from "@/types/asset";

const BASE = "https://secretasset.test/?trial=1";

// 원본 가짜 Storage — 실제 Storage처럼 키가 Object.keys에 열거된다. 쓰기 호출을 기록한다
function makeOriginal(init: Record<string, string> = {}) {
  const s = createMemoryStorage();
  for (const [k, v] of Object.entries(init)) s.setItem(k, v);
  const writes: string[] = [];
  const origSet = s.setItem.bind(s);
  const origRemove = s.removeItem.bind(s);
  Object.defineProperty(s, "setItem", { enumerable: false, value: (k: string, v: string) => { writes.push(`set:${k}`); origSet(k, v); } });
  Object.defineProperty(s, "removeItem", { enumerable: false, value: (k: string) => { writes.push(`remove:${k}`); origRemove(k); } });
  return { s, writes };
}
const dump = (s: Storage) => JSON.stringify(Object.keys(s).sort().map((k) => [k, s.getItem(k)]));

const fetchMock = vi.fn(async () => new Response("{}", { status: 200 }));

beforeEach(() => {
  __resetTrialModeForTest();
  fetchMock.mockClear();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("거부 판정(읽기 전용, C-4)", () => {
  const empty = JSON.stringify({ realEstate: [], stocks: [], crypto: [], cash: [], loans: [] });
  it.each([
    ["빈 저장소", {}, "", null],
    ["자산 0건 데이터", { secretasset_asset_data: empty }, "", null],
    ["배열 일부 없음(빈 배열로 간주)", { secretasset_asset_data: JSON.stringify({ stocks: [] }) }, "", null],
    ["자산 1건", { secretasset_asset_data: JSON.stringify({ stocks: [{ id: "s" }] }) }, "", "asset_data"],
    ["손상 JSON", { secretasset_asset_data: "{oops" }, "", "asset_data"],
    ["객체 아님(배열)", { secretasset_asset_data: "[]" }, "", "asset_data"],
    ["객체 아님(null)", { secretasset_asset_data: "null" }, "", "asset_data"],
    ["배열 아닌 값", { secretasset_asset_data: JSON.stringify({ stocks: {} }) }, "", "asset_data"],
    ["구버전 키(값 무관)", { "secretasset-asset-data": "" }, "", "legacy_asset_data"],
    ["동기화 키(값 무관)", { secretasset_sync: "x" }, "", "sync"],
    ["앱 잠금 enabled", { secretasset_pwa_auth_enabled: "true" }, "", "app_lock"],
    ["앱 잠금 pin hash", { secretasset_pwa_auth_pin_hash: "h" }, "", "app_lock"],
    ["#share 해시", {}, "#share=abc", "restore_hash"],
    ["#sync 해시", {}, "#sync=aid", "restore_hash"],
    ["#asset 해시", {}, "#asset=aid", "restore_hash"],
    ["#vault 해시", {}, "#vault=aid", "restore_hash"],
  ])("%s", (_n, init, hash, expected) => {
    const { s, writes } = makeOriginal(init as Record<string, string>);
    expect(trialRejectReason(s, hash)).toBe(expected);
    expect(writes).toEqual([]);
  });
  it("getItem이 throw하면 거부", () => {
    expect(trialRejectReason({ getItem: () => { throw new Error("x"); } }, "")).toBe("storage_error");
  });
});

describe("메모리 Storage", () => {
  it("키가 Object.keys로 열거되고 Storage 메서드처럼 동작", () => {
    const m = createMemoryStorage();
    m.setItem("secretasset_a", "1");
    m.setItem("b", "2");
    expect(Object.keys(m).sort()).toEqual(["b", "secretasset_a"]);
    expect(m.length).toBe(2);
    expect(m.getItem("secretasset_a")).toBe("1");
    expect(m.getItem("none")).toBeNull();
    expect(m.key(0)).not.toBeNull();
    m.removeItem("b");
    expect(Object.keys(m)).toEqual(["secretasset_a"]);
    m.clear();
    expect(m.length).toBe(0);
  });
});

describe("fetch 거부 래퍼", () => {
  it.each([
    "/api/parse-screenshot",
    "/api/share",
    "/api/share?id=1",
    "/api/sync",
    "/api/sync?meta=1",
    "/api/sync/abc",
    "/api/feedback",
    "https://secretasset.test/api/share",
  ])("거부: %s", (url) => {
    expect(isTrialBlockedRequest(url, BASE)).toBe(true);
    expect(isTrialBlockedRequest(new URL(url, BASE), BASE)).toBe(true);
    expect(isTrialBlockedRequest(new Request(new URL(url, BASE)), BASE)).toBe(true);
  });
  it.each([
    "/api/finance?type=stock",
    "/api/finance/dividend",
    "/api/xray-classify",
    "/api/shared",
    "/api/syncx",
    "https://other.test/api/share",
  ])("통과: %s", (url) => {
    expect(isTrialBlockedRequest(url, BASE)).toBe(false);
  });
  it("해석 불가 입력은 거부(fail-closed)", () => {
    expect(isTrialBlockedRequest({}, BASE)).toBe(true);
    expect(isTrialBlockedRequest("http://[bad", BASE)).toBe(true);
  });
  it("거부는 네트워크 없이 합성 403 + 체험 문구, 그 밖은 원래 fetch", async () => {
    const f = createTrialFetch(fetchMock as unknown as typeof fetch, () => BASE);
    const res = await f("/api/parse-screenshot", { method: "POST" });
    expect(res.status).toBe(403);
    expect(res.ok).toBe(false);
    expect(await res.json()).toEqual({ error: TRIAL_BLOCKED_MESSAGE });
    expect(fetchMock).not.toHaveBeenCalled();
    await f("/api/finance?type=exchange");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

// 브라우저와 같은 구성: window === globalThis, 전역 식별자 localStorage는 globalThis 속성
function stubBrowser(original: Storage) {
  vi.stubGlobal("localStorage", original);
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("location", { href: BASE, origin: "https://secretasset.test", hash: "" });
  vi.stubGlobal("dispatchEvent", () => true); // 저장 후 알림 이벤트(브라우저 window 메서드)
  vi.stubGlobal("window", globalThis);
}

describe("정상 경로 — 메모리에만 주입, 원본 불변", () => {
  it("검증 5종 통과 → 체험, 원본 바이트 동일, 메모리에 데모(@PY 포함), 거부 API 403", async () => {
    const { s: original, writes } = makeOriginal({ "ga-optout": "1", secretasset_notice_seen: "{}" });
    const before = dump(original);
    stubBrowser(original);
    const { injectDemoPayload, skipDemoTutorial } = await import("../preview/demo-inject");
    const result = await bootTrial({
      win: globalThis as unknown as Window & typeof globalThis,
      original,
      hash: "",
      inject: async () => { await injectDemoPayload(); skipDemoTutorial(); },
    });
    expect(result).toBe("trial");
    expect(isTrialMode()).toBe(true);
    expect(dump(original)).toBe(before);
    expect(writes).toEqual([]);
    // 메모리 대상
    const mem = (globalThis as unknown as { localStorage: Storage }).localStorage;
    expect(mem).not.toBe(original);
    expect(mem.getItem("ga-optout")).toBe("1");
    const data = assetDataSchema.parse(JSON.parse(mem.getItem("secretasset_asset_data")!));
    expect(data.stocks.length).toBeGreaterThan(0);
    expect(data.yearlyNetAssets?.[0]?.year).toBe(new Date().getFullYear() - 1);
    expect(Object.keys(mem).some((k) => k.startsWith("__secretasset_trial_probe__"))).toBe(false);
    // S5: 다른 탭 storage 이벤트 처리 경로(getAssetData)는 메모리만 읽는다
    const { getAssetData } = await import("../asset/asset-storage");
    expect(getAssetData().stocks.length).toBe(data.stocks.length);
    // fetch 래퍼
    const res = await fetch("/api/share", { method: "POST" });
    expect(res.status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
    await fetch("/api/finance/dividend");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("체험 주입 닉네임(ui-review R2)", () => {
  const nick = (m: Storage) => JSON.parse(m.getItem("secretasset_asset_data")!).nickname;
  it("체험 경로는 닉네임을 비운다, preview ?demo=1 경로(기본)는 '데모' 그대로, 데모 JSON 원본 불변", async () => {
    const raw = readFileSync(path.resolve(__dirname, "../preview/demo-data.json"), "utf8");
    const { injectDemoPayload } = await import("../preview/demo-inject");
    const a = createMemoryStorage();
    stubBrowser(a);
    await injectDemoPayload({ nickname: "" });
    expect(nick(a)).toBe("");
    vi.unstubAllGlobals();
    const b = createMemoryStorage();
    stubBrowser(b);
    await injectDemoPayload();
    expect(nick(b)).toBe("데모");
    expect(JSON.parse(raw).nickname).toBe("데모"); // 데모 JSON은 fs로만 읽는다(preview-safety 9번)
    expect(readFileSync(path.resolve(__dirname, "../preview/demo-data.json"), "utf8")).toBe(raw);
  });
  it("runTrialBoot은 닉네임 빈 값으로 주입", () => {
    expect(readFileSync(path.resolve(__dirname, "../trial/trial-boot.ts"), "utf8")).toContain('await injectDemoPayload({ nickname: "" });');
  });
});

describe("S1 모킹 — 실패하면 주입 0·원본 해시 동일·체험 아님", () => {
  const run = async (win: unknown, original: Storage) => {
    const inject = vi.fn(async () => {});
    const result = await bootTrial({ win: win as Window & typeof globalThis, original, hash: "", inject });
    return { result, inject };
  };

  it("① defineProperty 무시(Proxy가 정의를 삼킴)", async () => {
    const { s: original, writes } = makeOriginal({ secretasset_notice_seen: "{}" });
    const before = dump(original);
    stubBrowser(original);
    const target = { localStorage: original, fetch: fetchMock, location: { href: BASE } };
    const win = new Proxy(target, { defineProperty: () => true });
    const { result, inject } = await run(win, original);
    expect(result).toBe("failed");
    expect(inject).not.toHaveBeenCalled();
    expect(isTrialMode()).toBe(false);
    expect(dump(original)).toBe(before);
    expect(writes).toEqual([]);
  });

  it("① defineProperty가 throw(설정 불가 속성)", async () => {
    const { s: original } = makeOriginal();
    const before = dump(original);
    stubBrowser(original);
    const win = { fetch: fetchMock, location: { href: BASE } };
    Object.defineProperty(win, "localStorage", { configurable: false, get: () => original });
    const { result, inject } = await run(win, original);
    expect(result).toBe("failed");
    expect(inject).not.toHaveBeenCalled();
    expect(dump(original)).toBe(before);
  });

  it("② 전역 식별자 불일치(window ≠ 전역) — 원본에 probe도 쓰지 않음", async () => {
    const { s: original, writes } = makeOriginal({ secretasset_tutorial_status: "{}" });
    const before = dump(original);
    stubBrowser(original);
    const win = { localStorage: original, fetch: fetchMock, location: { href: BASE } };
    const { result, inject } = await run(win, original);
    expect(result).toBe("failed");
    expect(inject).not.toHaveBeenCalled();
    expect(isTrialMode()).toBe(false);
    expect(dump(original)).toBe(before);
    expect(writes).toEqual([]);
  });

  it("③ probe가 원본에서 보이면 지우고 실패", async () => {
    const { s: original, writes } = makeOriginal();
    stubBrowser(original);
    // 누출 흉내: 원본 getItem이 probe 키에 값을 돌려준다
    const realGet = original.getItem.bind(original);
    Object.defineProperty(original, "getItem", {
      enumerable: false,
      value: (k: string) => (k.startsWith("__secretasset_trial_probe__") ? "1" : realGet(k)),
    });
    const { result, inject } = await run(globalThis, original);
    expect(result).toBe("failed");
    expect(inject).not.toHaveBeenCalled();
    expect(writes.length).toBe(1);
    expect(writes[0]).toMatch(/^remove:__secretasset_trial_probe__/);
  });

  it("④ Object.keys(mem)에 기록한 키가 열거되지 않으면 실패", async () => {
    const { s: original } = makeOriginal();
    const before = dump(original);
    stubBrowser(original);
    const realKeys = Object.keys;
    vi.spyOn(Object, "keys").mockImplementation((o: object) =>
      o === (globalThis as unknown as { localStorage: unknown }).localStorage && o !== original ? [] : realKeys(o),
    );
    const { result, inject } = await run(globalThis, original);
    expect(result).toBe("failed");
    expect(inject).not.toHaveBeenCalled();
    expect(dump(original)).toBe(before);
  });

  it("⑤ fetch 교체가 무시되면 실패(래퍼 미설치)", async () => {
    const { s: original, writes } = makeOriginal();
    const before = dump(original);
    stubBrowser(original);
    const target = { localStorage: original, fetch: fetchMock, location: { href: BASE } };
    const win = new Proxy(target, {
      set: (t, k, v) => (k === "fetch" ? true : Reflect.set(t, k, v)),
    });
    // 전역 식별자도 win을 통해 보이게(②는 통과시켜 ⑤만 실패하도록)
    Object.defineProperty(globalThis, "localStorage", { configurable: true, get: () => (win as { localStorage: Storage }).localStorage });
    const { result, inject } = await run(win, original);
    expect(result).toBe("failed");
    expect(inject).not.toHaveBeenCalled();
    expect(isTrialMode()).toBe(false);
    expect(dump(original)).toBe(before);
    expect(writes).toEqual([]);
  });

  it("거부 판정 해당(자산 1건)이면 설치 자체를 하지 않음 — rejected", async () => {
    const { s: original, writes } = makeOriginal({ secretasset_asset_data: JSON.stringify({ stocks: [{ id: "x" }] }) });
    const before = dump(original);
    stubBrowser(original);
    const { result, inject } = await run(globalThis, original);
    expect(result).toBe("rejected");
    expect(inject).not.toHaveBeenCalled();
    expect((globalThis as unknown as { localStorage: Storage }).localStorage).toBe(original);
    expect(globalThis.fetch).toBe(fetchMock);
    expect(dump(original)).toBe(before);
    expect(writes).toEqual([]);
  });

  it("기존 사용자 불변 — 구버전 형태(닉네임 단독 키 + 영문 거래소 코인 + 자산)도 거부, 마이그레이션 쓰기 0", async () => {
    const legacy = {
      secretasset_asset_data: JSON.stringify({ crypto: [{ id: "c", symbol: "BTC", exchange: "upbit", quantity: 1 }] }),
      secretasset_nickname: "옛닉네임",
    };
    const { s: original, writes } = makeOriginal(legacy);
    const before = dump(original);
    stubBrowser(original);
    const { result } = await run(globalThis, original);
    expect(result).toBe("rejected");
    expect(dump(original)).toBe(before);
    expect(writes).toEqual([]);
  });
});

describe("정적 import 0건", () => {
  it("trial-boot는 동적 import로만 로드", () => {
    const root = path.resolve(__dirname, "../..");
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const full = path.join(dir, name);
        if (statSync(full).isDirectory()) { if (name !== "__tests__") walk(full); }
        else if (/\.(tsx?|jsx?|mjs)$/.test(name)) files.push(full);
      }
    };
    walk(root);
    const offenders = files.filter((f) => /import\s+[^("']*from\s+["'][^"']*trial-boot["']/.test(readFileSync(f, "utf8")));
    expect(offenders).toEqual([]);
  });
});
