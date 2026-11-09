// #58 실물 자산 — 기존 저장 경로 보존: #84 덮임 감지·되돌리기(완료 기준 13), 4.50 resync 적용·되돌리기(21)
// (22번 4.52 일괄 저장·saveAssetDataNotify는 4.52 머지 후 같은 방식으로 추가)
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { getAssetData, saveAssetData } from "../asset/asset-storage";
import { deriveKeys, type AssetKeys } from "../cloud-sync/crypto";
import { pullAsset, pushAsset } from "../cloud-sync/sync-client";
import {
  applyRevert, beginPull, beginPush, captureSnapshot, commitPull, commitPush, getBaseline, getEntries,
  refreshEntries, resetOverwriteGuard, setBaseline, setEntries, type OverwriteEntry, type SyncSnapshot,
} from "../cloud-sync/overwrite-guard";
import { applyResync, buildUndoEntries, computeDiff, defaultRemoveIds, mergeScreens, planUndo, resolveScreens } from "../asset/resync";
import { emptySel, row, screen, st } from "../asset/resync/__tests__/fixtures";
import { STORAGE_KEYS } from "../local-storage";
import type { AssetData, PhysicalAsset } from "@/types/asset";
import { g, gold, memoryStorage } from "./physical-fixtures";

const AID = "test-asset-id-1234567890";
interface Server { version: number; iv?: string; ciphertext?: string }
interface Device { storage: Storage; baseline: SyncSnapshot | null; entries: OverwriteEntry[] }
let server: Server;
let keys: AssetKeys;
let A: Device, B: Device;
let current: Device | null = null;

function switchTo(d: Device) {
  if (current) { current.baseline = getBaseline(); current.entries = getEntries(); }
  current = d;
  g.localStorage = d.storage;
  setBaseline(d.baseline);
  setEntries(d.entries);
}
function edit(d: Device, fn: (data: AssetData) => void) {
  switchTo(d);
  const data = getAssetData();
  fn(data);
  saveAssetData(data);
}
async function push(d: Device) {
  switchTo(d);
  const snap = beginPush(getAssetData());
  const r = await pushAsset(AID, keys);
  if (r.status === "ok") commitPush(snap);
  return r;
}
async function pull(d: Device) {
  switchTo(d);
  const before = beginPull(getAssetData(), true);
  const r = await pullAsset(AID, keys);
  return { r, ...(r.status === "ok" ? commitPull(before, getAssetData()) : { added: 0, total: 0 }) };
}
const rawPhys = (d: Device): PhysicalAsset[] => JSON.parse(d.storage.getItem(STORAGE_KEYS.physicalAssets) ?? "null");
const mapPhys = (arr: PhysicalAsset[]) => Object.fromEntries(arr.map((p) => [p.id, p.currentValue]));

async function setup() {
  g.window = globalThis;
  server = { version: 0 };
  A = { storage: memoryStorage(), baseline: null, entries: [] };
  B = { storage: memoryStorage(), baseline: null, entries: [] };
  current = null;
  resetOverwriteGuard();
  for (const d of [A, B]) {
    switchTo(d);
    saveAssetData({ ...getAssetData(), physicalAssets: [gold("P1"), gold("P2", { type: "silver", currentValue: 800_000 })], stocks: [st("S1", "005930", "domestic", "토스증권", 10, 70000)] });
  }
  expect((await push(A)).status).toBe("ok"); // v1
  switchTo(B);
  resetOverwriteGuard();
  expect((await pullAsset(AID, keys, { merge: false })).status).toBe("ok");
  setBaseline(captureSnapshot(getAssetData()));
}

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-08T03:00:00Z"));
  g.fetch = vi.fn(async (url: string, init?: { method?: string; body?: string }) => {
    const json = (status: number, body: unknown) => ({ ok: status < 400, status, json: async () => body });
    if (init?.method === "PUT") {
      const b = JSON.parse(init.body as string) as { baseVersion: number; iv: string; ciphertext: string };
      if (b.baseVersion !== server.version) return json(409, { asset: { version: server.version } });
      server = { version: server.version + 1, iv: b.iv, ciphertext: b.ciphertext };
      return json(200, { version: server.version });
    }
    if (String(url).includes("meta=1")) return json(200, { version: server.version });
    if (!server.iv) return json(404, {});
    return json(200, { asset: { iv: server.iv, ciphertext: server.ciphertext, version: server.version } });
  });
  keys = await deriveKeys("test-pass-123!", AID);
});
afterEach(() => {
  vi.useRealTimers();
  delete g.window; delete g.localStorage; delete g.fetch;
  resetOverwriteGuard();
});

describe("#84 덮임 감지·되돌리기 × 실물 (완료 기준 13)", () => {
  it("원격이 내가 고친 실물을 덮으면 modified 알림, 되돌리기는 분리 키에 쓰고 본 키는 깨끗하다", async () => {
    await setup();
    edit(A, (d) => { d.physicalAssets = d.physicalAssets!.map((p) => (p.id === "P1" ? { ...p, currentValue: 2_500_000 } : p)); });
    edit(B, (d) => { d.physicalAssets = d.physicalAssets!.map((p) => (p.id === "P1" ? { ...p, currentValue: 9_000_000 } : p)); });
    expect((await push(B)).status).toBe("ok"); // v2
    expect((await push(A)).status).toBe("conflict");
    expect((await pull(A)).added).toBe(1);
    expect(getEntries().map((e) => `${e.coll}:${e.kind}`)).toEqual(["physicalAssets:modified"]);
    expect(getEntries()[0].label).toBe("금 10돈");
    expect(mapPhys(rawPhys(A)).P1).toBe(9_000_000);
    // 되돌리기 = 일반 편집 저장 경로(saveAssetData)
    switchTo(A);
    const plan = refreshEntries(getAssetData());
    expect(saveAssetData(applyRevert(getAssetData(), plan.valid))).toBe(true);
    expect(mapPhys(rawPhys(A)).P1).toBe(2_500_000);
    expect("physicalAssets" in JSON.parse(A.storage.getItem(STORAGE_KEYS.assetData)!)).toBe(false);
  });
  it("원격이 실물을 지우면 remoteDeleted, 내가 지운 걸 원격이 되살리면 resurrected — 되돌리면 복원·재삭제", async () => {
    await setup();
    edit(B, (d) => { d.physicalAssets = d.physicalAssets!.filter((p) => p.id !== "P2"); });
    expect((await push(B)).status).toBe("ok");
    edit(A, (d) => { d.physicalAssets = d.physicalAssets!.map((p) => (p.id === "P2" ? { ...p, currentValue: 900_000 } : p)); });
    expect((await push(A)).status).toBe("conflict");
    await pull(A);
    expect(getEntries().map((e) => `${e.coll}:${e.kind}`)).toEqual(["physicalAssets:remoteDeleted"]);
    expect(mapPhys(rawPhys(A))).toEqual({ P1: 2_000_000 });
    switchTo(A);
    const plan = refreshEntries(getAssetData());
    saveAssetData(applyRevert(getAssetData(), plan.valid));
    expect(mapPhys(rawPhys(A))).toEqual({ P1: 2_000_000, P2: 900_000 });
  });
  it("되돌리기가 applyImportedPayload 경로를 쓰지 않는다(정적)", () => {
    const src = readFileSync(join(process.cwd(), "src/lib/cloud-sync/overwrite-guard.ts"), "utf8");
    expect(src).not.toContain("applyImportedPayload");
    expect(src).not.toContain("saveAssetDataRaw");
  });
});

describe("4.50 resync 적용·되돌리기 × 실물 (완료 기준 21)", () => {
  const PHYS = () => [gold("P1", { grams: 37.5, nested: { a: 1 } } as Partial<PhysicalAsset>), gold("P2", { type: "silver" })];
  it("applyResync 적용 저장과 planUndo 되돌리기 저장 후 실물 배열이 저장 전과 같다(미래 필드 포함)", async () => {
    await setup();
    switchTo(A);
    saveAssetData({ ...getAssetData(), physicalAssets: PHYS() });
    const beforePhys = JSON.stringify(rawPhys(A));
    // 적용 — holdings-resync-dialog의 saveData({ ...fresh, stocks }) 와 같은 형태
    const fresh = getAssetData();
    const screens = resolveScreens([screen(0, [row("005930", 12, 70000, { brokerHint: "토스증권" }), row("035420", 4, 50000)])], fresh.stocks, { usdRate: 1400 });
    const diff = computeDiff(fresh.stocks, mergeScreens(screens), screens);
    const result = applyResync(fresh.stocks, diff, { ...emptySel(), remove: defaultRemoveIds(diff) }, { today: "2026-11-08", usdRate: 1400, now: 7 });
    expect(saveAssetData({ ...fresh, stocks: result.stocks })).toBe(true);
    expect(JSON.stringify(rawPhys(A))).toBe(beforePhys);
    // 되돌리기 — planUndo(entries, getAssetData()) → saveData(plan.data)
    const entries = buildUndoEntries(fresh.stocks, getAssetData().stocks);
    const plan = planUndo(entries, getAssetData());
    expect(plan.data.physicalAssets).toEqual(getAssetData().physicalAssets);
    expect(saveAssetData(plan.data)).toBe(true);
    expect(JSON.stringify(rawPhys(A))).toBe(beforePhys);
    expect(getAssetData().stocks.map((s) => s.id)).toContain("S1");
    expect("physicalAssets" in JSON.parse(A.storage.getItem(STORAGE_KEYS.assetData)!)).toBe(false);
  });
});
