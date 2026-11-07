// #84 동기화 덮임 감지·되돌리기 — qa 재현 하네스(기기 2개 localStorage 분리 + 409 모의)를 실제 pushAsset/pullAsset으로 이식.
// 공통: 현금 c1=1000·c2=500, 주식 S1 수량 10 동기화(v1) → B가 c1=2000 push(v2) → A 편집 후 push 409 → force pull.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { getAssetData, saveAssetData } from "../asset/asset-storage";
import { deriveKeys, type AssetKeys } from "../cloud-sync/crypto";
import { pullAsset, pushAsset } from "../cloud-sync/sync-client";
import {
  applyRevert, beginPull, beginPush, commitPull, commitPush, detectOverwrites, captureSnapshot,
  getBaseline, getEntries, refreshEntries, resetOverwriteGuard, setBaseline, setEntries,
  type OverwriteEntry, type SyncSnapshot,
} from "../cloud-sync/overwrite-guard";
import type { AssetData } from "@/types/asset";

function memoryStorage(): Storage {
  const s = {} as Record<string, string>;
  const def = (k: string, value: unknown) => Object.defineProperty(s, k, { value, enumerable: false });
  def("getItem", (k: string) => (Object.prototype.hasOwnProperty.call(s, k) ? s[k] : null));
  def("setItem", (k: string, v: string) => { s[k] = String(v); });
  def("removeItem", (k: string) => { delete s[k]; });
  def("clear", () => { for (const k of Object.keys(s)) delete s[k]; });
  def("key", (i: number) => Object.keys(s)[i] ?? null);
  Object.defineProperty(s, "length", { get: () => Object.keys(s).length, enumerable: false });
  return s as unknown as Storage;
}

const g = globalThis as unknown as { window?: unknown; localStorage?: Storage; fetch?: unknown };
const AID = "test-asset-id-1234567890";

interface Server { version: number; iv?: string; ciphertext?: string }
interface Device { name: string; storage: Storage; baseline: SyncSnapshot | null; entries: OverwriteEntry[] }

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

const cash = (id: string, balance: number) => ({ id, type: "bank", name: `계좌${id}`, balance, currency: "KRW" });
const stock = (qty: number) => ({
  id: "S1", category: "domestic", name: "삼성전자", ticker: "005930", quantity: qty,
  averagePrice: 70000, currentPrice: 71000, currency: "KRW", purchaseDate: "2024-01-01",
});

function edit(d: Device, fn: (data: AssetData) => void) {
  switchTo(d);
  const data = getAssetData();
  fn(data);
  saveAssetData(data);
}
const cashOf = (d: Device) => { switchTo(d); return Object.fromEntries(getAssetData().cash.map((c) => [c.id, c.balance])); };
const setCash = (data: AssetData, id: string, balance: number) => { data.cash = data.cash.map((c) => (c.id === id ? { ...c, balance } : c)); };

// provider의 runPush/runPull과 같은 호출 순서
async function push(d: Device, guard = true) {
  switchTo(d);
  const snap = beginPush(getAssetData());
  const r = await pushAsset(AID, keys);
  if (r.status === "ok" && guard) commitPush(snap);
  return r;
}
async function pull(d: Device, { auto = true, guard = true } = {}) {
  switchTo(d);
  const before = guard ? beginPull(getAssetData(), auto) : null;
  const r = await pullAsset(AID, keys);
  const res = r.status === "ok" && guard ? commitPull(before, getAssetData()) : { added: 0, total: getEntries().length };
  return { r, ...res };
}
async function conflictThenPull(d: Device, guard = true) {
  const r = await push(d, guard);
  expect(r.status).toBe("conflict");
  return pull(d, { auto: true, guard });
}

async function setup(guard = true) {
  g.window = globalThis;
  server = { version: 0 };
  A = { name: "A", storage: memoryStorage(), baseline: null, entries: [] };
  B = { name: "B", storage: memoryStorage(), baseline: null, entries: [] };
  current = null;
  resetOverwriteGuard();
  for (const d of [A, B]) {
    switchTo(d);
    const base = getAssetData();
    saveAssetData({ ...base, cash: [cash("c1", 1000), cash("c2", 500)] as never, stocks: [stock(10)] as never });
  }
  expect((await push(A, guard)).status).toBe("ok"); // v1
  // B: 연결 직후 pull(merge:false) — 감지 대상 아님, 기준만 잡는다
  switchTo(B);
  resetOverwriteGuard();
  expect((await pullAsset(AID, keys, { merge: false })).status).toBe("ok");
  if (guard) setBaseline(captureSnapshot(getAssetData()));
  edit(B, (d) => setCash(d, "c1", 2000));
  expect((await push(B, guard)).status).toBe("ok"); // v2
}

function mockServer() {
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
}

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-08T03:00:00Z"));
  mockServer();
  keys = await deriveKeys("test-pass-123!", AID);
});
afterEach(() => {
  vi.useRealTimers();
  delete g.window; delete g.localStorage; delete g.fetch;
  resetOverwriteGuard();
});

const kinds = () => getEntries().map((e) => `${e.coll}:${e.kind}`);

describe("재현 4케이스 — 감지", () => {
  it("1. 같은 항목 수정(c1=3000): 원격 값 유지 + 목록에 c1", async () => {
    await setup();
    edit(A, (d) => setCash(d, "c1", 3000));
    const res = await conflictThenPull(A);
    expect(cashOf(A).c1).toBe(2000);
    expect(res.added).toBe(1);
    expect(kinds()).toEqual(["cash:modified"]);
    expect(getEntries()[0].label).toBe("계좌c1");
  });
  it("2. 무관 항목 수정(S1=99): pull 후 S1=10, 목록에 S1", async () => {
    await setup();
    edit(A, (d) => { d.stocks = d.stocks.map((s) => ({ ...s, quantity: 99 })); });
    await conflictThenPull(A);
    expect(getAssetData().stocks[0].quantity).toBe(10);
    expect(kinds()).toEqual(["stocks:modified"]);
  });
  it("3. 삭제 부활(c2 삭제): pull 후 c2 존재, 목록에 '다시 생김'", async () => {
    await setup();
    edit(A, (d) => { d.cash = d.cash.filter((c) => c.id !== "c2"); });
    await conflictThenPull(A);
    expect(cashOf(A).c2).toBe(500);
    expect(kinds()).toEqual(["cash:resurrected"]);
  });
  it("4. 신규 추가(c3)는 보존되고 목록에 없다. 4건 섞으면 c1·S1·c2 3건", async () => {
    await setup();
    edit(A, (d) => {
      setCash(d, "c1", 3000);
      d.stocks = d.stocks.map((s) => ({ ...s, quantity: 99 }));
      d.cash = [...d.cash.filter((c) => c.id !== "c2"), cash("c3", 777) as never];
    });
    await conflictThenPull(A);
    expect(cashOf(A)).toEqual({ c1: 2000, c2: 500, c3: 777 });
    expect(getEntries().map((e) => e.label).sort()).toEqual(["계좌c1", "계좌c2", "삼성전자"].sort());
  });
  it("원격 삭제: 내가 수정한 항목을 다른 기기가 지웠으면 '원격 삭제'", async () => {
    await setup();
    edit(B, (d) => { d.cash = d.cash.filter((c) => c.id !== "c2"); });
    expect((await push(B)).status).toBe("ok"); // v3 (c2 삭제)
    edit(A, (d) => setCash(d, "c2", 900));
    await conflictThenPull(A);
    expect(cashOf(A).c2).toBeUndefined();
    expect(getEntries().some((e) => e.kind === "remoteDeleted" && e.label === "계좌c2")).toBe(true);
  });
  it("5. 오프라인 복귀(같은 실행): online pull도 같은 목록", async () => {
    await setup();
    edit(A, (d) => setCash(d, "c1", 3000));
    const res = await pull(A, { auto: true });
    expect(res.added).toBe(1);
    expect(kinds()).toEqual(["cash:modified"]);
  });
  it("5. 재시작 후(기준 없음) 시작 pull: 알림 0, 저장 결과는 main과 동일", async () => {
    await setup();
    edit(A, (d) => setCash(d, "c1", 3000));
    resetOverwriteGuard(); A.baseline = null; A.entries = []; // 앱 재시작
    const res = await pull(A);
    expect(res.added).toBe(0);
    expect(getEntries()).toEqual([]);
    expect(cashOf(A).c1).toBe(2000);
  });
  it("6. 편집 없는 pull: 알림 0, 월 스냅샷·설정 포함 저장 결과가 guard 없이 돌린 결과(main 로직)와 같다 (C13)", async () => {
    const dump = (d: Device) => JSON.stringify(Object.keys(d.storage).sort().map((k) => [k, d.storage.getItem(k)]));
    await setup(false);
    edit(A, (d) => setCash(d, "c1", 3000));
    await conflictThenPull(A, false);
    const mainResult = dump(A);
    await setup(true);
    edit(A, (d) => setCash(d, "c1", 3000));
    await conflictThenPull(A, true);
    expect(dump(A)).toBe(mainResult);
    // 편집이 없는 폴링 pull은 알림 0
    await setup();
    const res = await pull(A);
    expect(res.added).toBe(0);
  });
});

describe("되돌리기 (R1·R2·R3)", () => {
  const revert = (d: Device) => {
    switchTo(d);
    const plan = refreshEntries(getAssetData());
    saveAssetData(applyRevert(getAssetData(), plan.valid)); // provider는 saveData(저장 + notifyAssetUserEdit)
    setEntries([]);
    return plan;
  };

  it("1. 같은 항목: 되돌리기 후 A·B 모두 c1=3000", async () => {
    await setup();
    edit(A, (d) => setCash(d, "c1", 3000));
    await conflictThenPull(A);
    revert(A);
    expect((await push(A)).status).toBe("ok");
    await pull(B);
    expect(cashOf(A).c1).toBe(3000);
    expect(cashOf(B).c1).toBe(3000);
  });
  it("2. 무관 항목: S1=99로 복구, c1=2000 유지(목록 밖 원격 변경 보존)", async () => {
    await setup();
    edit(A, (d) => { d.stocks = d.stocks.map((s) => ({ ...s, quantity: 99 })); });
    await conflictThenPull(A);
    revert(A);
    await push(A);
    await pull(B);
    expect(getAssetData().stocks[0].quantity).toBe(99);
    expect(cashOf(B).c1).toBe(2000);
    expect(cashOf(A).c1).toBe(2000);
  });
  it("3. 삭제 부활: 되돌리기 후 c2 없음(A·B)", async () => {
    await setup();
    edit(A, (d) => { d.cash = d.cash.filter((c) => c.id !== "c2"); });
    await conflictThenPull(A);
    revert(A);
    await push(A);
    await pull(B);
    expect(cashOf(A).c2).toBeUndefined();
    expect(cashOf(B).c2).toBeUndefined();
  });
  it("원격 삭제분은 내 값으로 다시 추가", async () => {
    await setup();
    edit(B, (d) => { d.cash = d.cash.filter((c) => c.id !== "c2"); });
    await push(B);
    edit(A, (d) => setCash(d, "c2", 900));
    await conflictThenPull(A);
    revert(A);
    expect(cashOf(A).c2).toBe(900);
  });
  it("10. R1: 덮인 뒤 다시 고친 항목은 목록에서 빠지고 현재 값 유지, 나머지만 되돌림", async () => {
    await setup();
    edit(A, (d) => { setCash(d, "c1", 3000); d.stocks = d.stocks.map((s) => ({ ...s, quantity: 99 })); });
    await conflictThenPull(A);
    edit(A, (d) => setCash(d, "c1", 4000)); // 이후 이 기기에서 다시 수정
    const plan = revert(A);
    expect(plan.dropped).toBe(1);
    expect(plan.valid.map((e) => e.coll)).toEqual(["stocks"]);
    expect(cashOf(A).c1).toBe(4000);
    expect(getAssetData().stocks[0].quantity).toBe(99);
  });
  it("10. R1: 다음 pull로 또 바뀐 항목도 빠진다", async () => {
    await setup();
    edit(A, (d) => setCash(d, "c1", 3000));
    await conflictThenPull(A);
    edit(B, (d) => setCash(d, "c1", 2500));
    await push(B);
    await pull(A); // c1 또 바뀜(편집 없음 → 새 알림 없음)
    const plan = revert(A);
    expect(plan.valid).toHaveLength(0);
    expect(cashOf(A).c1).toBe(2500);
  });
  it("11. 목록 밖 항목·월 스냅샷·설정은 되돌리기 전후 동일", async () => {
    await setup();
    switchTo(A);
    A.storage.setItem("secretasset_monthly_snapshots", JSON.stringify([{ month: "2026-10", netAsset: 1 }]));
    A.storage.setItem("secretasset_profit_basis", "kstAccessDay");
    edit(A, (d) => setCash(d, "c1", 3000));
    await conflictThenPull(A);
    const before = Object.fromEntries(Object.keys(A.storage).filter((k) => k !== "secretasset_asset_data").map((k) => [k, A.storage.getItem(k)]));
    const stocksBefore = JSON.stringify(getAssetData().stocks);
    revert(A);
    const after = Object.fromEntries(Object.keys(A.storage).filter((k) => k !== "secretasset_asset_data").map((k) => [k, A.storage.getItem(k)]));
    expect(after).toEqual(before);
    expect(JSON.stringify(getAssetData().stocks)).toBe(stocksBefore);
    expect(cashOf(A).c2).toBe(500);
  });
  it("11. 되돌리기 push가 409면 같은 감지 흐름으로 새 목록이 생긴다", async () => {
    await setup();
    edit(A, (d) => setCash(d, "c1", 3000));
    await conflictThenPull(A);
    edit(B, (d) => setCash(d, "c1", 5000));
    await push(B); // v3
    revert(A);
    const res = await conflictThenPull(A);
    expect(res.added).toBe(1);
    expect(kinds()).toEqual(["cash:modified"]);
    expect(cashOf(A).c1).toBe(5000);
  });
  it("12. 그대로 두기·새로고침 후 메모리 사본 0, localStorage 잔존물 0", async () => {
    await setup();
    edit(A, (d) => setCash(d, "c1", 3000));
    await conflictThenPull(A);
    const keysBefore = Object.keys(A.storage).sort();
    setEntries([]); // 그대로 두기
    resetOverwriteGuard(); // 새로고침
    expect(getEntries()).toEqual([]);
    expect(getBaseline()).toBeNull();
    expect(Object.keys(A.storage).sort()).toEqual(keysBefore);
    // 새 저장 키: guard 이름이 들어간 키 없음
    expect(keysBefore.some((k) => /overwrite|guard|baseline/i.test(k))).toBe(false);
  });
});

describe("앱 자동 갱신 필드는 내 변경이 아니다", () => {
  const thisYear = new Date().getFullYear();
  const data = (mut: (d: AssetData) => void): AssetData => {
    const d = getFixtureData();
    d.stocks = [stock(10)] as never;
    d.crypto = [{ id: "k1", name: "비트", symbol: "BTC", quantity: 1, averagePrice: 1, currentPrice: 10, purchaseDate: "2024-01-01", baseDate: "a" }] as never;
    d.realEstate = [{ id: "r1", type: "apartment", name: "집", purchasePrice: 1, currentValue: 5, purchaseDate: "2020-01-01", tenantDeposit: 0 }] as never;
    d.yearlyNetAssets = [{ year: thisYear, netAsset: 100, note: "자동" }, { year: 2020, netAsset: 1 }] as never;
    mut(d);
    return d;
  };
  const auto = (d: AssetData) => {
    d.stocks = d.stocks.map((s) => ({ ...s, currentPrice: 99999, baseDate: "x", name: "삼성전자(보정)", inactiveStatus: "halted" as const, inactiveReason: "r", inactiveCheckedAt: "t" }));
    d.crypto = d.crypto.map((c) => ({ ...c, currentPrice: 777, baseDate: "b" }));
    d.realEstate = d.realEstate.map((r) => ({ ...r, marketEstimate: 123, marketEstimateDate: "2026-01-01", marketEstimateGrade: "exact" as const }));
    d.yearlyNetAssets = d.yearlyNetAssets.map((y) => (y.year === thisYear ? { ...y, netAsset: 555 } : y));
  };
  it("자동 갱신만 일어난 로컬이 pull로 원격 값에 덮여도 알림 0", () => {
    const baseline = captureSnapshot(data(() => {}));
    const before = captureSnapshot(data(auto));
    const after = captureSnapshot(data((d) => { d.stocks = d.stocks.map((s) => ({ ...s, currentPrice: 1 })); }));
    expect(detectOverwrites(baseline, before, after)).toEqual([]);
  });
  it("올해 연도별 순자산 자동 업서트로 항목이 바뀌거나 사라져도 알림 0", () => {
    const baseline = captureSnapshot(data(() => {}));
    const before = captureSnapshot(data((d) => { d.yearlyNetAssets = d.yearlyNetAssets.filter((y) => y.year !== thisYear); }));
    expect(detectOverwrites(baseline, before, captureSnapshot(data(() => {})))).toEqual([]);
  });
  it("부동산 currentValue·주식 수량 같은 사용자 입력 변경은 여전히 감지", () => {
    const baseline = captureSnapshot(data(() => {}));
    const before = captureSnapshot(data((d) => {
      auto(d);
      d.realEstate = d.realEstate.map((r) => ({ ...r, currentValue: 9 }));
      d.stocks = d.stocks.map((s) => ({ ...s, quantity: 99 }));
    }));
    const after = captureSnapshot(data(() => {}));
    expect(detectOverwrites(baseline, before, after).map((e) => e.coll).sort()).toEqual(["realEstate", "stocks"]);
  });
});

describe("순수 함수", () => {
  const snap = (cashItems: Record<string, number>, nickname = ""): SyncSnapshot =>
    captureSnapshot({
      realEstate: [], stocks: [], crypto: [], cash: Object.entries(cashItems).map(([id, b]) => cash(id, b)) as never, loans: [],
      yearlyNetAssets: [], transactions: [], cashTransactions: [], loanTransactions: [], cryptoTransactions: [],
      lastUpdated: "", nickname,
    });
  it("기준이 없으면 감지하지 않는다", () => {
    expect(detectOverwrites(null, snap({ a: 1 }), snap({ a: 2 }))).toEqual([]);
  });
  it("닉네임 덮임 감지·되돌리기", () => {
    const found = detectOverwrites(snap({}, "가"), snap({}, "나"), snap({}, "다"));
    expect(found).toHaveLength(1);
    const next = applyRevert({ ...getFixtureData(), nickname: "다" }, found);
    expect(next.nickname).toBe("나");
  });
  it("시세(currentPrice) 같은 파생값 변화는 내 변경으로 보지 않는다", () => {
    const base = captureSnapshot({ ...getFixtureData(), stocks: [stock(10)] as never });
    const priced = captureSnapshot({ ...getFixtureData(), stocks: [{ ...stock(10), currentPrice: 99999 }] as never });
    expect(detectOverwrites(base, priced, base)).toEqual([]);
  });
});

function getFixtureData(): AssetData {
  return {
    realEstate: [], stocks: [], crypto: [], cash: [], loans: [], yearlyNetAssets: [],
    transactions: [], cashTransactions: [], loanTransactions: [], cryptoTransactions: [],
    lastUpdated: "", nickname: "",
  };
}

describe("정적 규칙 (C11·C16·C26)", () => {
  const read = (rel: string) => readFileSync(join(__dirname, "..", rel), "utf8");
  it("감지·계획 모듈은 저장·push·notify를 호출하지 않고 저장 키를 쓰지 않는다", () => {
    const src = read("cloud-sync/overwrite-guard.ts");
    expect(src).not.toMatch(/localStorage|sessionStorage|STORAGE_KEYS|saveAssetData|notifyAssetUserEdit|pushAsset|pullAsset|applyImportedPayload|clearAssetData/);
  });
  it("sync-client·sync-state·asset-storage에 덮임 로직이 없다(저장 결과 diff 0)", () => {
    for (const f of ["cloud-sync/sync-client.ts", "cloud-sync/sync-state.ts", "asset/asset-storage.ts"]) {
      expect(read(f)).not.toMatch(/overwrite-guard|OverwriteEntry/);
    }
  });
  it("GA 호출은 pullAsset·applyImportedPayload·runPush 내부가 아닌 UI 계층에만", () => {
    expect(read("cloud-sync/sync-client.ts")).not.toMatch(/track\(/);
    const provider = read("cloud-sync/cloud-sync-provider.tsx");
    const runPush = provider.slice(provider.indexOf("const runPush"), provider.indexOf("const showOverwriteToast"));
    expect(runPush).not.toMatch(/sync_overwrite/);
  });
  it("UI 검수 반영: 전체 토스트 닫기에서 덮임 토스트 제외·되돌렸어요 토스트는 이전 옵션 병합 방지·제목 span 묶음·확인 단계 목록 축소·포커스", () => {
    const ctx = read("../contexts/asset-data-context.tsx");
    expect(ctx).toContain('!== "sync-overwrite"');
    expect(ctx).not.toMatch(/toast\.dismiss\(\);/);
    const dlg = read("../app/(main)/_components/functions/cloud-sync/sync-overwrite-dialog.tsx");
    expect(dlg.indexOf('toast.dismiss("sync-overwrite")')).toBeLessThan(dlg.indexOf('toast.success("되돌렸어요"'));
    expect(dlg).toContain("duration: 2000");
    expect(dlg).toContain('<span>바뀐 내 변경 <span className="tabular-nums">{count}</span>건</span>');
    expect(dlg).toContain('confirming ? "max-h-[20vh]"');
    expect(dlg).toContain("titleRef.current?.focus()");
    expect(dlg).toContain("revertBtnRef.current?.focus()");
    expect(dlg).toContain("scrollbar-themed");
    expect(dlg).toContain("text-balance break-keep");
    const card = read("../app/(main)/_components/functions/cloud-sync/cloud-sync-menu-entry.tsx");
    expect(card).toContain('<span>바뀐 내 변경 <span className="tabular-nums">');
    const prov = read("cloud-sync/cloud-sync-provider.tsx");
    expect(prov).toContain("after:absolute after:-inset-2.5");
    // sonner 기본 description 색(테마 불일치 시 저대비)을 앱 토큰으로 덮어쓴다 — 하드코딩 색 금지
    expect(prov).toContain("!text-muted-foreground");
    expect(prov).toContain("!bg-popover !text-popover-foreground");
    expect(prov.slice(prov.indexOf("const showOverwriteToast"), prov.indexOf("const runPull")).replace('color: "#fff"', "")).not.toMatch(/#[0-9a-fA-F]{3,6}\b|rgb\(/);
  });
  it("새 문구에 '서버'와 보안 수식어가 없다", () => {
    const files = [
      "cloud-sync/cloud-sync-provider.tsx",
      "../app/(main)/_components/functions/cloud-sync/sync-overwrite-dialog.tsx",
    ];
    for (const f of files) {
      const src = read(f);
      const strings = [...src.matchAll(/["'`]([^"'`\n]*[가-힣][^"'`\n]*)["'`]/g)].map((m) => m[1]).join("\n");
      const added = f.includes("dialog") ? strings : strings.split("\n").filter((s) => /덮|되돌|바뀐|확인하기|다른 기기 변경/.test(s)).join("\n");
      expect(added).not.toMatch(/서버|절대|모든 |원천|이중|완벽/);
    }
  });
});
