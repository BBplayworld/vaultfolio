// #366 [5.179] 증권사별 마지막 맞춘 날 — high 게이트 (a)~(e)와 쓰기 경로(변경 있음·변경 0 확인·되돌리기)·손상 내성.
// 옛 기기 = main 21bd696의 asset-refresh-status.ts를 그대로 둔 사본(fixtures/asset-refresh-status-5176.ts, 수정 0 — 첫 테스트가 해시를 고정한다).
// 저장 키는 그대로(secretasset_asset_refresh)이고 새 필드는 `brokers.stock` 배열뿐이다. 모든 기록 값은 실제 쓰기 함수로 만든다(C162).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";

vi.mock("@/lib/asset/resync", async (orig) => {
  const m = await orig<typeof import("@/lib/asset/resync")>();
  return { ...m, applyResync: vi.fn(m.applyResync), planUndo: vi.fn(m.planUndo) };
});

import * as cur from "../asset/asset-refresh-status";
import * as old from "./fixtures/asset-refresh-status-5176";
import { applyResync, computeDiff, defaultRemoveIds, mergeScreens, planUndo, resolveScreens, type ResyncSelection } from "@/lib/asset/resync";
import { confirmSameDeps, confirmSameResync, markAppliedResync, syncedLabel, writableScopes } from "../asset/broker-synced";
import { applyImportedPayload, buildExportPayload, getAssetData, saveAssetData } from "../asset/asset-storage";
import { STORAGE_KEYS } from "../local-storage";
import { deriveKeys, decryptPayload, type AssetKeys } from "../cloud-sync/crypto";
import { pullAsset, pushAsset } from "../cloud-sync/sync-client";
import { bootTrial, createMemoryStorage } from "../trial/trial-boot";
import { __resetTrialModeForTest } from "../trial/trial-mode";
import { buildDemoRefreshMeta } from "../preview/demo-payload";
import { emptySel, row, screen, st } from "../asset/resync/__tests__/fixtures";
import { g, memoryStorage } from "./physical-fixtures";
import type { RawScreenItem } from "../asset/resync";
import type { Stock } from "@/types/asset";

const KEY = STORAGE_KEYS.assetRefresh;
const TODAY = "2026-11-08";
const raw = () => localStorage.getItem(KEY);
const meta = () => JSON.parse(raw() ?? "{}");
const dumpExcept = (s: Storage, skip: string) => JSON.stringify(Object.keys(s).filter((k) => k !== skip).sort().map((k) => [k, s.getItem(k)]));

const K1 = st("K1", "005930", "domestic", "키움증권", 10, 70000);
const K2 = st("K2", "000660", "domestic", "키움증권", 5, 120000);
const K3 = st("K3", "AAPL", "foreign", "키움증권", 3, 150);
const T1 = st("T1", "035420", "domestic", "토스증권", 4, 50000);
const kiwoom = { brokerHint: "키움증권" };
/** 키움 국내 화면 — 보유와 똑같다(변경 0) */
const sameItems = () => [row("005930", 10, 70000, kiwoom), row("000660", 5, 120000, kiwoom)];

function diffOf(items: RawScreenItem[], status: "ok" | "failed" = "ok", extra: RawScreenItem[][] = []) {
  return (stocks: Stock[]) => {
    const screens = [screen(0, items, status), ...extra.map((x, i) => screen(i + 1, x))];
    const res = resolveScreens(screens, stocks, { usdRate: 1400 });
    return computeDiff(stocks, mergeScreens(res), res);
  };
}
const selOf = (d: ReturnType<ReturnType<typeof diffOf>>, patch: Partial<ResyncSelection> = {}): ResyncSelection => ({ ...emptySel(), remove: defaultRemoveIds(d), ...patch });
const seed = (stocks: Stock[]) => saveAssetData({ ...getAssetData(), stocks });
/** 대화상자의 경로 B와 같은 호출(누른 순간 diff를 다시 만든다) */
function confirm(items = sameItems(), patch: Partial<ResyncSelection> = {}, deps = confirmSameDeps) {
  const make = diffOf(items);
  const sel = selOf(make(getAssetData().stocks), patch);
  return confirmSameResync(make, sel, deps);
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-08T03:00:00Z"));
  g.window = globalThis;
  g.localStorage = memoryStorage();
  g.fetch = vi.fn(async () => ({ ok: false, status: 599, json: async () => ({}) }));
  vi.mocked(applyResync).mockClear();
  vi.mocked(planUndo).mockClear();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  delete g.window; delete g.localStorage; delete g.fetch;
  __resetTrialModeForTest();
});

describe("0. 옛 기기 하네스", () => {
  it("fixtures/asset-refresh-status-5176.ts = main 21bd696 원문(수정 0, 158줄)", () => {
    const src = readFileSync(path.resolve(__dirname, "fixtures/asset-refresh-status-5176.ts"));
    expect(createHash("sha256").update(src).digest("hex")).toBe("74fd6ea9c44421706d71aab7afbefda6feb04b48818433ae225ca5ab8b7c2b16");
    expect(src.toString("utf8").split("\n")).toHaveLength(159); // 158줄 + 끝 줄바꿈
  });
  it("저장 키는 그대로이고 새 필드는 brokers.stock뿐", () => {
    expect(KEY).toBe("secretasset_asset_refresh");
    seed([K1, K2, K3, T1]);
    cur.markCategoryRefreshed("stock", { notify: false });
    expect(confirm().ok).toBe(true);
    expect(Object.keys(meta()).sort()).toEqual(["brokers", "categories"]);
    expect(Object.keys(meta().brokers)).toEqual(["stock"]);
    expect(meta().brokers.stock).toEqual([{ broker: "키움증권", category: "domestic", date: TODAY, count: 2 }]);
  });
});

describe("경로 B — 변경 0 확인(자산 저장 0)", () => {
  it("brokers·categories.stock만 바뀌고 assetData·다른 키 바이트 불변, applyResync·planUndo·fetch 0, GA 1", () => {
    seed([K1, K2, K3, T1]);
    localStorage.setItem("secretasset_snapshots_daily", JSON.stringify([{ date: "2026-11-07", netAsset: 1 }]));
    const before = dumpExcept(localStorage, KEY);
    const ga = vi.fn();
    const r = confirm(sameItems(), {}, { ...confirmSameDeps, track: ga });
    expect(r.ok).toBe(true);
    expect(dumpExcept(localStorage, KEY)).toBe(before);
    expect(applyResync).not.toHaveBeenCalled();
    expect(planUndo).not.toHaveBeenCalled();
    expect(g.fetch).not.toHaveBeenCalled();
    expect(ga).toHaveBeenCalledTimes(1);
    expect(cur.isRefreshedToday("stock")).toBe(true);
    expect(cur.parseBrokerSynced(meta(), TODAY)).toEqual([{ broker: "키움증권", category: "domestic", date: TODAY, count: 2 }]);
  });

  it("본문 정적 검사: 자산 저장·적용 계산·되돌리기·대조·화면 상태 정리 호출 0", () => {
    const src = readFileSync(path.resolve(__dirname, "../asset/broker-synced.ts"), "utf8");
    const body = src.slice(src.indexOf("export function confirmSameResync"), src.indexOf("/** 변경 있음(경로 A)"));
    expect(body.length).toBeGreaterThan(100);
    expect(body).not.toMatch(/applyResync|saveData|saveAssetData|planUndo|pruneStockTargets|reconcile|localStorage/);
  });

  it("잘림·실패 장이 있으면 쓰기 0(GA 0), 증권사 미확정 장도 0", () => {
    seed([K1, K2, T1]);
    const ga = vi.fn();
    const make = diffOf(sameItems(), "ok", []);
    const failed = (stocks: Stock[]) => {
      const res = resolveScreens([screen(0, sameItems()), screen(1, [], "truncated")], stocks, { usdRate: 1400 });
      return computeDiff(stocks, mergeScreens(res), res);
    };
    expect(confirmSameResync(failed, selOf(failed(getAssetData().stocks)), { ...confirmSameDeps, track: ga }).ok).toBe(false);
    const noBroker = diffOf([row("005930", 10, 70000)]); // 힌트 없음 → 미확정
    expect(confirmSameResync(noBroker, selOf(noBroker(getAssetData().stocks)), { ...confirmSameDeps, track: ga }).ok).toBe(false);
    expect(writableScopes(make(getAssetData().stocks), selOf(make(getAssetData().stocks)), getAssetData().stocks)).toHaveLength(1);
    expect(raw()).toBeNull();
    expect(ga).not.toHaveBeenCalled();
  });

  it("남는 삭제 후보(기본 해제 포함)가 있는 범위는 제외, 다른 범위는 쓴다", () => {
    const K4 = st("K4", "035720", "domestic", "키움증권", 1, 40000);
    seed([K1, K2, K3, K4, T1]);
    // 키움 국내 화면에 K4가 없다 → 삭제 후보. 체크를 끄면 변경 0이지만 그 범위는 쓰지 않는다. 해외 화면(K3)은 쓴다
    const make = diffOf(sameItems(), "ok", [[row("AAPL", 3, 150, kiwoom)]]);
    const d = make(getAssetData().stocks);
    const sel = selOf(d, { remove: new Set() });
    expect(writableScopes(d, sel, getAssetData().stocks)).toEqual([{ broker: "키움증권", category: "foreign", count: 1 }]);
    expect(confirmSameResync(make, sel).ok).toBe(true);
    expect(cur.parseBrokerSynced(meta(), TODAY).map((e) => e.category)).toEqual(["foreign"]);
  });

  it("맞추지 않는 확인 필요 행이 남은 범위는 제외", () => {
    seed([K1, K2, K3, T1]);
    // 000660 수량 미인식 → 확인 필요(포함 체크 안 함)
    const make = diffOf([row("005930", 10, 70000, kiwoom), row("000660", 5, 120000, { ...kiwoom, quantityMissing: true })], "ok", [[row("AAPL", 3, 150, kiwoom)]]);
    const d = make(getAssetData().stocks);
    expect(writableScopes(d, selOf(d), getAssetData().stocks).map((s) => s.category)).toEqual(["foreign"]);
  });

  it("누른 순간 보유 현황이 바뀌어 바뀔 내용이 생기면 실패(쓰기 0)", () => {
    seed([K1, K2, T1]);
    const make = diffOf(sameItems());
    const sel = selOf(make(getAssetData().stocks));
    seed([{ ...K1, quantity: 11 }, K2, T1]);
    expect(confirmSameResync(make, sel).ok).toBe(false);
    expect(raw()).toBeNull();
  });

  it("쓰기 실패(저장소 쓰기 throw)면 null → ok:false, 맞춘 시각·GA 0", () => {
    seed([K1, K2, T1]);
    const s = localStorage;
    const orig = s.setItem.bind(s);
    Object.defineProperty(s, "setItem", { value: (k: string, v: string) => { if (k === KEY) throw new Error("quota"); orig(k, v); }, enumerable: false, configurable: true });
    const ga = vi.fn();
    expect(confirm(sameItems(), {}, { ...confirmSameDeps, track: ga }).ok).toBe(false);
    expect(ga).not.toHaveBeenCalled();
    expect(raw()).toBeNull();
  });
});

describe("경로 A — 변경 있음(자산 저장 뒤 날짜)", () => {
  it("체크 삭제가 적용된 범위는 쓰고 count는 적용 뒤 항목 수", () => {
    const K4 = st("K4", "035720", "domestic", "키움증권", 1, 40000);
    seed([K1, K2, K4, T1]);
    const make = diffOf([row("005930", 12, 70000, kiwoom), row("000660", 5, 120000, kiwoom)]);
    const data = getAssetData();
    const d = make(data.stocks);
    const sel = selOf(d, { remove: new Set(["K4"]) });
    const result = applyResync(data.stocks, d, sel, { today: TODAY, usdRate: 1400, now: 1 });
    expect(saveAssetData({ ...data, stocks: result.stocks })).not.toBe(false);
    const u = markAppliedResync(d, sel, result.stocks);
    expect(u).not.toBeNull();
    expect(cur.parseBrokerSynced(meta(), TODAY)).toEqual([{ broker: "키움증권", category: "domestic", date: TODAY, count: 2 }]);
  });
  it("incomplete면 null(쓰기 0)", () => {
    seed([K1, K2, T1]);
    const failed = (stocks: Stock[]) => {
      const res = resolveScreens([screen(0, [row("005930", 12, 70000, kiwoom)]), screen(1, [], "failed")], stocks, { usdRate: 1400 });
      return computeDiff(stocks, mergeScreens(res), res);
    };
    const d = failed(getAssetData().stocks);
    expect(markAppliedResync(d, selOf(d), getAssetData().stocks)).toBeNull();
    expect(raw()).toBeNull();
  });
});

describe("되돌리기 원복(compare-and-restore)", () => {
  it("기록이 없던 상태 → 되돌리면 stock 키 없음, 맞춘 시각도 원복", () => {
    seed([K1, K2, T1]);
    const r = confirm();
    if (!r.ok) throw new Error("ok 아님");
    expect(cur.restoreBrokersSynced(r.brokers)).toBe(true);
    expect(cur.restoreCategoryRefreshed("stock", r.prevRefreshedAt, r.appliedAt)).toBe(true);
    expect(meta().brokers).toBeUndefined();
    expect(meta().categories.stock).toBeUndefined();
  });
  it("이전 기록 있음 → 되돌리면 이전 배열과 깊은 동일. 그 사이 다시 맞췄으면 유지", () => {
    seed([K1, K2, K3, T1]);
    const first = markAppliedResync(diffOf([row("AAPL", 3, 150, kiwoom)])(getAssetData().stocks), emptySel(), getAssetData().stocks);
    expect(first).not.toBeNull();
    const before = meta().brokers.stock;
    const r = confirm();
    if (!r.ok) throw new Error("ok 아님");
    expect(cur.restoreBrokersSynced(r.brokers)).toBe(true);
    expect(meta().brokers.stock).toEqual(before);
    const r2 = confirm();
    if (!r2.ok) throw new Error("ok 아님");
    vi.setSystemTime(new Date("2026-11-09T03:00:00Z"));
    confirm(); // 다음 날 다시 맞춤
    expect(cur.restoreBrokersSynced(r2.brokers)).toBe(false);
    expect(cur.parseBrokerSynced(meta(), "2026-11-09").find((e) => e.category === "domestic")?.date).toBe("2026-11-09");
  });
});

describe("(a) push 키 diff 0", () => {
  it("buildExportPayload·push 평문에 brokers·기록 날짜 0, 최상위 키 목록 동일", async () => {
    seed([K1, K2, K3, T1]);
    const p0 = JSON.stringify(buildExportPayload());
    expect(confirm().ok).toBe(true);
    const p1 = buildExportPayload();
    expect(JSON.stringify(p1)).toBe(p0);
    expect(JSON.stringify(p1)).not.toMatch(/brokers|"date":"2026-11-08"|asset_refresh/);
    const puts: { iv: string; ciphertext: string }[] = [];
    g.fetch = vi.fn(async (_u: string, init?: { method?: string; body?: string }) => {
      if (init?.method === "PUT") puts.push(JSON.parse(init.body!));
      return { ok: true, status: 200, json: async () => ({ version: 1 }) };
    });
    const keys: AssetKeys = await deriveKeys("test-pass-123!", "aid-5179-test-0000000000");
    expect((await pushAsset("aid-5179-test-0000000000", keys)).status).toBe("ok");
    const plain = await decryptPayload(puts[0], keys.encKey);
    expect(Object.keys(plain as object).sort()).toEqual(Object.keys(JSON.parse(p0)).sort());
    expect(JSON.stringify(plain)).not.toMatch(/brokers|asset_refresh/);
  });
});

describe("(b) pull·백업 복원 보존", () => {
  it("applyImportedPayload(백업)·pullAsset 뒤 brokers.stock·categories 깊은 동일", async () => {
    seed([K1, K2, K3, T1]);
    const backup = buildExportPayload();
    expect(confirm().ok).toBe(true);
    const keep = { brokers: meta().brokers, categories: meta().categories };
    applyImportedPayload(backup);
    expect({ brokers: meta().brokers, categories: meta().categories }).toEqual(keep);
    // 서버 1칸 모의 — 다른 기기가 올린 것을 받는다
    let server: { iv?: string; ciphertext?: string; version: number } = { version: 0 };
    g.fetch = vi.fn(async (_u: string, init?: { method?: string; body?: string }) => {
      const json = (status: number, body: unknown) => ({ ok: status < 400, status, json: async () => body });
      if (init?.method === "PUT") {
        const b = JSON.parse(init.body!);
        server = { iv: b.iv, ciphertext: b.ciphertext, version: server.version + 1 };
        return json(200, { version: server.version });
      }
      return json(200, { asset: { iv: server.iv, ciphertext: server.ciphertext, version: server.version } });
    });
    const keys = await deriveKeys("test-pass-123!", "aid-5179-test-0000000000");
    const mine = localStorage;
    g.localStorage = memoryStorage(); // 다른 기기
    seed([{ ...K1, quantity: 99 }, K2, T1]);
    expect((await pushAsset("aid-5179-test-0000000000", keys)).status).toBe("ok");
    g.localStorage = mine;
    expect((await pullAsset("aid-5179-test-0000000000", keys, { merge: false })).status).toBe("ok");
    expect(getAssetData().stocks.find((s) => s.id === "K1")?.quantity).toBe(99);
    expect({ brokers: meta().brokers, categories: meta().categories }).toEqual(keep);
    // 받은 뒤 수가 같으면 그대로 보이고, 구성이 바뀌면(T1·K2만 남음) 수 불일치로 숨는다
    expect(syncedLabel({ name: "키움증권", unassigned: false, scopeCounts: { domestic: 2 } }, cur.parseBrokerSynced(meta(), TODAY), TODAY)?.text).toBe("11/8 맞춤");
  });
});

describe("(c) 구버전 writer(21bd696) 보존", () => {
  it("새 값 위에서 옛 markCategoryRefreshed·restoreCategoryRefreshed·markRefreshNudgeShown 각각 실행 → brokers 깊은 동일, 새 읽기 정상", () => {
    seed([K1, K2, K3, T1]);
    const r = confirm();
    if (!r.ok) throw new Error("ok 아님");
    const keep = meta().brokers;
    const parsed = cur.parseBrokerSynced(meta(), TODAY);
    const at = old.markCategoryRefreshed("crypto", { notify: false });
    expect(meta().brokers).toEqual(keep);
    expect(old.restoreCategoryRefreshed("crypto", null, at)).toBe(true);
    expect(meta().brokers).toEqual(keep);
    old.markRefreshNudgeShown();
    expect(meta().brokers).toEqual(keep);
    expect(meta().nudgeShownOn).toBe(TODAY);
    expect(cur.parseBrokerSynced(meta(), TODAY)).toEqual(parsed);
    expect(cur.lastRefreshedAt("stock")).toBe(old.lastRefreshedAt("stock"));
    expect(cur.getStaleCategories("2026-01-01T00:00:00Z")).toEqual(old.getStaleCategories("2026-01-01T00:00:00Z"));
    // 옛 기기 되돌리기(맞춤 표시 원복)도 brokers를 건드리지 않는다
    expect(old.restoreCategoryRefreshed("stock", r.prevRefreshedAt, r.appliedAt)).toBe(true);
    expect(meta().brokers).toEqual(keep);
  });
});

describe("(d) 손상 내성", () => {
  const LAST = "2026-11-01T00:00:00.000Z";
  const whole = ["null", "[]", '"문자열"', "5", "true", "{oops"];
  it.each(whole)("원시값·배열·깨진 JSON %s → throw 0, 빈 메타와 같은 판정, 다음 쓰기 정상", (v) => {
    localStorage.setItem(KEY, v);
    expect(() => cur.parseBrokerSynced(JSON.parse(v === "{oops" ? "{}" : v), TODAY)).not.toThrow();
    expect(cur.brokerSyncedFromRaw(v, TODAY)).toEqual([]);
    expect(cur.lastRefreshedAt("stock")).toBeNull();
    expect(cur.getStaleCategories("2026-01-01T00:00:00Z")).toEqual(["stock", "crypto", "cash", "loan"]);
    expect(() => cur.markCategoryRefreshed("stock", { notify: false })).not.toThrow();
    expect(Object.keys(meta())).toEqual(["categories"]); // 글자 키(0·1·…)가 섞이지 않는다
    seed([K1, K2, T1]);
    expect(confirm().ok).toBe(true);
  });

  const brokersBad: [string, unknown][] = [
    ["brokers 숫자", 5],
    ["brokers 배열", [{ broker: "키움증권" }]],
    ["stock 객체", { stock: {} }],
    ["stock 문자열", { stock: "x" }],
    ["__proto__ 키", JSON.parse('{"__proto__":{"polluted":1},"stock":{"__proto__":[]}}')],
  ];
  it.each(brokersBad)("%s → categories·넛지 판정 손상 전과 같음, 표시 0, 오염 0", (_n, b) => {
    localStorage.setItem(KEY, JSON.stringify({ categories: { stock: LAST, cash: LAST }, nudgeShownOn: "2026-11-07" }));
    const before = { last: cur.lastRefreshedAt("stock"), stale: cur.getStaleCategories("2026-01-01T00:00:00Z"), show: cur.shouldShowRefreshNudge({ hasAssets: true }) };
    localStorage.setItem(KEY, JSON.stringify({ categories: { stock: LAST, cash: LAST }, nudgeShownOn: "2026-11-07", brokers: b }));
    expect(cur.parseBrokerSynced(meta(), TODAY)).toEqual([]);
    expect({ last: cur.lastRefreshedAt("stock"), stale: cur.getStaleCategories("2026-01-01T00:00:00Z"), show: cur.shouldShowRefreshNudge({ hasAssets: true }) }).toEqual(before);
    expect(syncedLabel({ name: "키움증권", unassigned: false, scopeCounts: { domestic: 2 } }, cur.brokerSyncedFromRaw(raw(), TODAY), TODAY)).toBeNull();
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    seed([K1, K2, T1]);
    expect(confirm().ok).toBe(true); // 다음 쓰기에서 유효 항목만 남겨 덮는다
    expect(cur.parseBrokerSynced(meta(), TODAY)).toEqual([{ broker: "키움증권", category: "domestic", date: TODAY, count: 2 }]);
    expect(meta().categories.cash).toBe(LAST);
  });

  it("항목 일부 손상·미래 날짜·달력 불일치·중복 → 유효 항목만, 중복은 늦은 날", () => {
    const ok = { broker: "키움증권", category: "domestic", date: "2026-11-01", count: 2 };
    const list = [
      ok, null, "x", 3, [], { ...ok, broker: 5 }, { ...ok, broker: "" }, { ...ok, broker: "항목 1" }, { ...ok, broker: "가".repeat(41) },
      { ...ok, category: "unlisted" }, { ...ok, category: "toString" }, { ...ok, date: "2026-02-30" }, { ...ok, date: "2026-11-09" }, { ...ok, date: "26-11-01" },
      { ...ok, count: -1 }, { ...ok, count: 1.5 }, { ...ok, count: "2" }, { ...ok, broker: "키움 증권", date: "2026-11-05" }, { broker: "토스증권", category: "foreign", date: "2025-12-03", count: 1 },
    ];
    localStorage.setItem(KEY, JSON.stringify({ brokers: { stock: list } }));
    expect(cur.parseBrokerSynced(meta(), TODAY)).toEqual([
      { broker: "키움 증권", category: "domestic", date: "2026-11-05", count: 2 },
      { broker: "토스증권", category: "foreign", date: "2025-12-03", count: 1 },
    ]);
    const entries = cur.brokerSyncedFromRaw(raw(), TODAY);
    expect(syncedLabel({ name: "키움증권", unassigned: false, scopeCounts: { domestic: 2 } }, entries, TODAY)).toEqual({ date: "2026-11-05", text: "11/5 맞춤" });
    expect(syncedLabel({ name: "토스증권", unassigned: false, scopeCounts: { foreign: 1 } }, entries, TODAY)).toEqual({ date: "2025-12-03", text: "2025.12.3 맞춤" });
  });

  it("`__proto__`·`constructor` 증권사명으로 맞춰도 Object.prototype 오염 0, 표시 정상", () => {
    const P = st("P", "005930", "domestic", "__proto__", 1, 1000);
    const C = st("C", "000660", "domestic", "constructor", 2, 1000);
    seed([P, C]);
    for (const b of ["__proto__", "constructor"]) {
      const items = [row(b === "__proto__" ? "005930" : "000660", b === "__proto__" ? 1 : 2, 1000, { brokerHint: b })];
      const make = (stocks: Stock[]) => {
        const res = resolveScreens([screen(0, items)], stocks, { usdRate: 1400, brokerOverrides: { 0: b } });
        return computeDiff(stocks, mergeScreens(res), res);
      };
      expect(confirmSameResync(make, selOf(make(getAssetData().stocks))).ok).toBe(true);
    }
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    expect(Object.getPrototypeOf(meta().brokers)).toBe(Object.prototype);
    const entries = cur.brokerSyncedFromRaw(raw(), TODAY);
    expect(syncedLabel({ name: "__proto__", unassigned: false, scopeCounts: { domestic: 1 } }, entries, TODAY)?.text).toBe("11/8 맞춤");
    expect(syncedLabel({ name: "constructor", unassigned: false, scopeCounts: { domestic: 1 } }, entries, TODAY)?.text).toBe("11/8 맞춤");
  });
});

describe("(e) 삭제·체험 격리", () => {
  it("전체 삭제(clearAssetRefreshStatus) 뒤 키 없음", () => {
    seed([K1, K2, T1]);
    expect(confirm().ok).toBe(true);
    cur.clearAssetRefreshStatus();
    expect(raw()).toBeNull();
  });

  it("실제 저장소 brokers → 체험 진입·맞추기 → 실제 저장소 바이트 불변, 체험 메모리에는 데모 메타만 주입된 뒤 맞춘 값", async () => {
    __resetTrialModeForTest();
    const original = createMemoryStorage();
    g.localStorage = original;
    // 실제 기기: 자산은 없고(체험 거부 조건 아님) 맞춘 날 기록만 남아 있다 — 실제 쓰기 함수로 만든다
    expect(cur.markBrokersSynced([{ broker: "실제증권", category: "domestic", count: 3 }], "2026-11-01")).not.toBeNull();
    const before = JSON.stringify(Object.keys(original).sort().map((k) => [k, original.getItem(k)]));
    vi.stubGlobal("localStorage", original);
    vi.stubGlobal("location", { href: "https://secretasset.test/?trial=1", origin: "https://secretasset.test", hash: "" });
    vi.stubGlobal("dispatchEvent", () => true);
    vi.stubGlobal("window", globalThis);
    const { injectDemoPayload } = await import("../preview/demo-inject");
    const result = await bootTrial({ win: globalThis as unknown as Window & typeof globalThis, original, hash: "", inject: () => injectDemoPayload({ mode: "trial" }) });
    expect(result).toBe("trial");
    const mem = (globalThis as unknown as { localStorage: Storage }).localStorage;
    expect(mem).not.toBe(original);
    expect(JSON.parse(mem.getItem(KEY)!)).toEqual(JSON.parse(JSON.stringify(buildDemoRefreshMeta())));
    expect(mem.getItem(KEY)).not.toContain("실제증권");
    // 체험 안에서 데모증권 국내 화면 그대로 맞추기(변경 0 확인)
    const demo = getAssetData().stocks.filter((s) => s.broker === "데모증권" && s.category === "domestic");
    const items = demo.map((s) => row(s.ticker ?? "", s.quantity, s.averagePrice, { brokerHint: "데모증권", name: s.name }));
    const make = (stocks: Stock[]) => {
      const res = resolveScreens([screen(0, items)], stocks, { usdRate: 1400, brokerOverrides: { 0: "데모증권" } });
      return computeDiff(stocks, mergeScreens(res), res);
    };
    expect(confirmSameResync(make, selOf(make(getAssetData().stocks))).ok).toBe(true);
    expect(cur.parseBrokerSynced(JSON.parse(mem.getItem(KEY)!), TODAY).some((e) => e.broker === "데모증권" && e.date === TODAY)).toBe(true);
    // 종료(새로고침) = 메모리 폐기. 실제 저장소는 바이트 그대로
    expect(JSON.stringify(Object.keys(original).sort().map((k) => [k, original.getItem(k)]))).toBe(before);
  });
});

describe("대화상자 정적 규칙(#366)", () => {
  const dialog = readFileSync(path.resolve(__dirname, "../../app/(main)/_components/forms/asset-update/screenshot/holdings-resync-dialog.tsx"), "utf8");
  const slice = (a: string, b: string) => dialog.slice(dialog.indexOf(a), dialog.indexOf(b));
  it("경로 B 핸들러: 자산 저장·적용 계산·대조·GA 직접 호출 0, 실패 토스트 1종", () => {
    const body = slice("const handleConfirmSame", "const handleApply");
    expect(body).toMatch(/confirmSameResync\(diffFor, sel\)/);
    expect(body).not.toMatch(/saveData|applyResync|planResyncSave|pruneStockTargets|computeReconcile|reconcile|track\(|markCategoryRefreshed/);
    expect(body).toMatch(/toast\.error\("맞춘 날을 남기지 못했어요"\)/);
    expect(body).toMatch(/confirmOnly: true/);
  });
  it("handleApply: 변경 0이면 주식 확인 경로만, 코인은 쓰기 0(경로 A의 날짜 기록도 주식만)", () => {
    const body = slice("const handleApply", "// 맞춘 직후 화면 합계 대조");
    expect(body).toMatch(/if \(changes === 0\) \{\n\s+if \(canConfirmSame\) handleConfirmSame\(\);\n\s+return;/);
    expect(body).toMatch(/const brokers = isCrypto \? null : markAppliedResync\(d, sel, next\.stocks\)/);
    expect(body.indexOf("saveData(next)")).toBeLessThan(body.indexOf("markAppliedResync"));
    expect(dialog).toMatch(/const canConfirmSame = !isCrypto && changes === 0 && writableScopes\(diff, sel, existing\)\.length > 0/);
  });
  it("되돌리기: 확인 경로는 planUndo·saveData·resync_undo 0, 두 경로 모두 맞춘 날 원복", () => {
    const body = slice("const doUndo", "const parsedOk");
    expect(body).toMatch(/const plan = u\.confirmOnly \? null : planUndo/);
    expect(body).toMatch(/const ok = plan \? saveData\(plan\.data\) : true/);
    expect(body).toMatch(/if \(u\.brokers\) restoreBrokersSynced\(u\.brokers\)/);
    expect(body).toMatch(/if \(plan\) track\("feature_use", \{ category: "resync_undo" \}\)/);
  });
  it("미리보기 안내: 한 요소·data-state·aria-live·버튼 aria-describedby(변경 0일 때만)", () => {
    expect(dialog).toMatch(/data-testid="resync-same-note"\n\s+data-state=\{canConfirmSame \? "confirm" : "blocked"\}\n\s+aria-live="polite"/);
    expect(dialog).toMatch(/aria-describedby=\{changes === 0 \? sameNoteId : undefined\}/);
    expect(dialog).toMatch(/disabled=\{applying \|\| \(changes === 0 \? !canConfirmSame : newDateInvalid\)\}/);
    expect(dialog).toContain('"바뀌는 내용이 없어요. 맞추면 오늘 맞춘 날로 남아요"');
    expect(dialog).toContain('"맞추면 오늘 맞춘 날로 남아요"');
  });
  it("결과(B): 요약·대조 줄 없이 resync-result-same, 되돌린 뒤 숨김", () => {
    const body = slice('{step === "result" && confirmedSame', '{step === "result" && applied');
    expect(body).toMatch(/\{!undoInfo && <p data-testid="resync-result-same"[^>]*>바뀐 내용 없이 오늘 맞춘 날로 남겼어요<\/p>\}/);
    expect(body).not.toMatch(/summaryParts|ReconcileLines|바뀌는 내용이 없어요/);
  });
});
