// #91 S8 — 4.50 보유 현황 맞추기 ↔ #84 동기화 덮임 감지·되돌리기 하네스(기기 2개 localStorage 분리 + 409 모의).
// sync-overwrite.test.ts의 하네스 형태를 따른다(해당 파일은 헬퍼를 export하지 않아 최소 복사).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { getAssetData, saveAssetData } from "../asset/asset-storage";
import { deriveKeys, type AssetKeys } from "../cloud-sync/crypto";
import { pullAsset, pushAsset } from "../cloud-sync/sync-client";
import {
  beginPull, beginPush, captureSnapshot, commitPull, commitPush, getBaseline, getEntries,
  resetOverwriteGuard, setBaseline, setEntries, type OverwriteEntry, type SyncSnapshot,
} from "../cloud-sync/overwrite-guard";
import { applyResync, buildUndoEntries, computeDiff, defaultRemoveIds, mergeScreens, planUndo, resolveScreens } from "../asset/resync";
import { assetDataSchema, cryptoSchema, stockSchema } from "@/types/asset";
import type { AssetData, Crypto, Stock } from "@/types/asset";
import { cryptoToStock, matchExchangeHint, parsedCryptoToRaw, stocksToCrypto } from "../asset/resync";
import { emptySel, row, screen, st } from "../asset/resync/__tests__/fixtures";

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
const stocksOf = (d: Device) => { switchTo(d); return getAssetData().stocks; };
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
  const res = r.status === "ok" ? commitPull(before, getAssetData()) : { added: 0, total: 0 };
  return { r, ...res };
}

const S1 = st("S1", "005930", "domestic", "토스증권", 10, 70000);
const S2 = st("S2", "000660", "domestic", "토스증권", 5, 120000);
const S3 = st("S3", "AAPL", "foreign", "키움증권", 3, 150);
const co = (id: string, symbol: string, exchange: string, quantity: number, averagePrice: number): Crypto =>
  ({ id, name: symbol, symbol, quantity, averagePrice, currentPrice: averagePrice, purchaseDate: "2025-01-01", exchange });
const C1 = co("C1", "BTC", "업비트", 1, 50_000_000);
const C2 = co("C2", "ETH", "업비트", 2, 3_000_000);
const C3 = co("C3", "BTC", "빗썸", 1, 49_000_000);

/** 코인 맞추기 — 클릭 핸들러와 같은 순서(어댑터 → applyResync → 일반 편집 저장 1회) */
function doCryptoResync(d: Device, items: ReturnType<typeof parsedCryptoToRaw>[], remove: string[] = []) {
  switchTo(d);
  const data = getAssetData();
  const before = data.crypto.map(cryptoToStock);
  const screens = resolveScreens([screen(0, items)], before, { usdRate: 1400, matchHint: matchExchangeHint });
  const diff = computeDiff(before, mergeScreens(screens), screens);
  const sel = { ...emptySel(), remove: defaultRemoveIds(diff) };
  remove.forEach((id) => sel.remove.add(id));
  const result = applyResync(before, diff, sel, { today: "2026-11-08", usdRate: 1400, now: 8 });
  const next = stocksToCrypto(data.crypto, before, result.stocks);
  saveAssetData({ ...data, crypto: next });
  return { before: data.crypto, after: next };
}
const cryptoOf = (d: Device) => { switchTo(d); return getAssetData().crypto; };
const rawC = (symbol: string, q: number, avg: number, exchange = "") => parsedCryptoToRaw({ name: symbol, symbol, quantity: q, averagePrice: avg, currentPrice: avg, exchange, currency: "KRW" }, 1400);

/** 클릭 핸들러가 하는 일: 선택 → applyResync → 일반 편집 저장 1회 */
function doResync(d: Device, items: ReturnType<typeof row>[], remove: string[] = []) {
  switchTo(d);
  const data = getAssetData();
  const screens = resolveScreens([screen(0, items)], data.stocks, { usdRate: 1400 });
  const diff = computeDiff(data.stocks, mergeScreens(screens), screens);
  const sel = { ...emptySel(), remove: defaultRemoveIds(diff) };
  remove.forEach((id) => sel.remove.add(id));
  const result = applyResync(data.stocks, diff, sel, { today: "2026-11-08", usdRate: 1400, now: 7 });
  saveAssetData({ ...data, stocks: result.stocks });
  return { before: data.stocks, after: result.stocks, data };
}

async function setup() {
  g.window = globalThis;
  server = { version: 0 };
  A = { name: "A", storage: memoryStorage(), baseline: null, entries: [] };
  B = { name: "B", storage: memoryStorage(), baseline: null, entries: [] };
  current = null;
  resetOverwriteGuard();
  for (const d of [A, B]) {
    switchTo(d);
    saveAssetData({ ...getAssetData(), stocks: [S1, S2, S3], crypto: [C1, C2, C3] });
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

const hint = { brokerHint: "토스증권" };
// 토스증권 국내 화면: S1 수량 12, S2 삭제 후보(1/2 미만이 되도록 S4 추가 후 맞춤), 신규 035420
const screenItems = () => [row("005930", 12, 70000, hint), row("035420", 4, 50000)];

describe("S8 동기화 하네스", () => {
  it("A 맞추기 → push → B pull: B가 A와 같다", async () => {
    await setup();
    doResync(A, screenItems(), ["S2"]);
    expect((await push(A)).status).toBe("ok");
    expect((await pull(B)).r.status).toBe("ok");
    expect(stocksOf(B)).toEqual(stocksOf(A));
    expect(stocksOf(B).find((s) => s.id === "S1")).toMatchObject({ quantity: 12, positionSource: "manual" });
    expect(stocksOf(B).some((s) => s.id === "S2")).toBe(false);
    expect(stocksOf(B).find((s) => s.id === "S3")).toEqual(S3);
  });

  it("B 미push 편집 + A 맞추기 → B pull에서 #84 알림(modified·remoteDeleted)이 생긴다", async () => {
    await setup();
    doResync(A, screenItems(), ["S2"]);
    expect((await push(A)).status).toBe("ok"); // v2
    edit(B, (d) => { d.stocks = d.stocks.map((s) => (s.id === "S1" || s.id === "S2" ? { ...s, quantity: 99 } : s)); });
    expect((await push(B)).status).toBe("conflict");
    const res = await pull(B);
    expect(res.added).toBe(2);
    expect(getEntries().map((e) => `${e.coll}:${e.kind}:${e.key}`).sort()).toEqual(["stocks:modified:stocks:S1", "stocks:remoteDeleted:stocks:S2"]);
    expect(stocksOf(B).find((s) => s.id === "S1")!.quantity).toBe(12);
  });

  it("A 되돌리기 → push → B pull: B도 맞추기 전으로 복원, 삭제 항목은 목록 끝", async () => {
    await setup();
    const { before } = doResync(A, screenItems(), ["S2"]);
    switchTo(A);
    const entries = buildUndoEntries(before, getAssetData().stocks);
    expect((await push(A)).status).toBe("ok");
    expect((await pull(B)).r.status).toBe("ok");
    const overwriteBefore = getEntries().length;
    // 되돌리는 순간 보유 현황을 새로 읽는다
    switchTo(A);
    const undo = planUndo(entries, getAssetData());
    expect(undo.skipped).toBe(0);
    saveAssetData(undo.data);
    expect(getEntries()).toHaveLength(overwriteBefore); // #84 목록은 건드리지 않는다
    expect((await push(A)).status).toBe("ok");
    expect((await pull(B)).r.status).toBe("ok");
    expect(stocksOf(B)).toEqual(stocksOf(A));
    const ids = stocksOf(B).map((s) => s.id);
    expect(ids).toEqual(["S1", "S3", "S2"]); // 복원된 S2는 끝에 추가
    expect(stocksOf(B).find((s) => s.id === "S1")).toMatchObject({ quantity: 10 });
    expect(stocksOf(B).some((s) => s.ticker === "035420")).toBe(false);
  });

  it("4.50 → 4.49 롤백: 저장된 데이터는 기존 스키마로 그대로 읽히고 새 필드가 없다", async () => {
    await setup();
    doResync(A, screenItems(), ["S2"]);
    switchTo(A);
    const saved = getAssetData();
    expect(assetDataSchema.safeParse(saved).success).toBe(true);
    // 4.49 reader = 같은 stockSchema. 스키마에 없는 키가 새로 생기면 안 된다
    const known = new Set(Object.keys(stockSchema.innerType().shape));
    expect(known.size).toBeGreaterThan(10);
    for (const s of saved.stocks) for (const k of Object.keys(s)) expect(known.has(k), k).toBe(true);
  });
});

describe("S8 동기화 하네스 — 코인", () => {
  const items = () => [rawC("BTC", 2, 50_000_000, "업비트"), rawC("SOL", 5, 100_000)];
  it("A 맞추기 → push → B pull: B가 A와 같고 빗썸 줄은 불변", async () => {
    await setup();
    doCryptoResync(A, items(), ["C2"]);
    expect((await push(A)).status).toBe("ok");
    expect((await pull(B)).r.status).toBe("ok");
    expect(cryptoOf(B)).toEqual(cryptoOf(A));
    expect(cryptoOf(B).find((c) => c.id === "C3")).toEqual(C3);
    expect(cryptoOf(B).find((c) => c.id === "C1")).toMatchObject({ quantity: 2, positionSource: "manual" });
  });
  it("B 미push 편집 + A 맞추기 → B pull에서 crypto modified·remoteDeleted 알림", async () => {
    await setup();
    doCryptoResync(A, items(), ["C2"]);
    expect((await push(A)).status).toBe("ok");
    edit(B, (d) => { d.crypto = d.crypto.map((c) => (c.id === "C1" || c.id === "C2" ? { ...c, quantity: 99 } : c)); });
    expect((await push(B)).status).toBe("conflict");
    await pull(B);
    expect(getEntries().map((e) => `${e.kind}:${e.key}`).sort()).toEqual(["modified:crypto:C1", "remoteDeleted:crypto:C2"]);
  });
  it("A 되돌리기 → push → B pull: B 복원, 코인 4.49 스키마 키만", async () => {
    await setup();
    const { before, after } = doCryptoResync(A, items(), ["C2"]);
    const entries = buildUndoEntries(before, after, "crypto");
    expect((await push(A)).status).toBe("ok");
    expect((await pull(B)).r.status).toBe("ok");
    switchTo(A);
    const known = new Set(Object.keys(cryptoSchema.shape));
    for (const c of getAssetData().crypto) for (const k of Object.keys(c)) expect(known.has(k), k).toBe(true);
    saveAssetData(planUndo(entries, getAssetData()).data);
    expect((await push(A)).status).toBe("ok");
    expect((await pull(B)).r.status).toBe("ok");
    expect(cryptoOf(B)).toEqual(cryptoOf(A));
    expect(cryptoOf(B).map((c) => c.id)).toEqual(["C1", "C3", "C2"]);
    expect(cryptoOf(B).find((c) => c.id === "C1")).toEqual(C1);
    expect(cryptoOf(B).some((c) => c.symbol === "SOL")).toBe(false);
  });
});

describe("되돌리기 순수 동작", () => {
  const base = (stocks: Stock[]): AssetData => ({
    realEstate: [], stocks, crypto: [], cash: [], loans: [], yearlyNetAssets: [],
    transactions: [], cashTransactions: [], loanTransactions: [], cryptoTransactions: [],
    lastUpdated: "x", nickname: "",
  });
  const apply = (before: Stock[], items: ReturnType<typeof row>[], remove: string[]) => {
    const sc = resolveScreens([screen(0, items)], before, { usdRate: 1400 });
    const diff = computeDiff(before, mergeScreens(sc), sc);
    const sel = { ...emptySel(), remove: new Set(remove) };
    return applyResync(before, diff, sel, { today: "2026-11-08", usdRate: 1400, now: 9 }).stocks;
  };
  it("적용 → 되돌리기 후 stocks가 이전과 같다(변경·추가·삭제 혼합), 거래 배열 참조 불변", () => {
    const before = [S1, S2, S3];
    const after = apply(before, screenItems(), ["S2"]);
    const entries = buildUndoEntries(before, after);
    expect(entries.map((e) => e.kind).sort()).toEqual(["modified", "remoteDeleted", "resurrected"]);
    const d = base(after);
    const undo = planUndo(entries, d);
    expect(undo.restored).toBe(3);
    expect(undo.data.stocks.find((s) => s.id === "S1")).toEqual(S1);
    expect(undo.data.stocks.map((s) => s.id)).toEqual(["S1", "S3", "S2"]);
    expect(undo.data.transactions).toBe(d.transactions);
  });
  it("R1: 맞춘 뒤 직접 고친 항목은 그대로 두고 건수를 센다", () => {
    const before = [S1, S2, S3];
    const after = apply(before, screenItems(), []);
    const entries = buildUndoEntries(before, after);
    const edited = after.map((s) => (s.id === "S1" ? { ...s, quantity: 50 } : s));
    const undo = planUndo(entries, base(edited));
    expect(undo.skipped).toBe(1);
    expect(undo.data.stocks.find((s) => s.id === "S1")!.quantity).toBe(50);
  });
  it("R2: 현재가 같은 자동 필드는 유지하고 되돌린다", () => {
    const before = [S1];
    const after = apply(before, [row("005930", 12, 70000, hint)], []);
    const entries = buildUndoEntries(before, after);
    const refreshed = after.map((s) => ({ ...s, currentPrice: 99999 }));
    const undo = planUndo(entries, base(refreshed));
    expect(undo.data.stocks[0]).toMatchObject({ quantity: 10, currentPrice: 99999 });
  });
  it("변경 없는 항목은 entries에 없다", () => {
    const before = [S1, S3];
    const after = apply(before, [row("005930", 10, 70000, hint)], []);
    expect(buildUndoEntries(before, after)).toEqual([]);
  });
});

describe("정적 규칙 (C11·C16·S6)", () => {
  const dir = join(__dirname, "..", "asset", "resync");
  const files = ["types.ts", "match.ts", "merge.ts", "diff.ts", "apply.ts", "undo.ts", "index.ts"];
  it("순수 함수 모듈은 저장·push·notify·모듈 상태·저장 키를 쓰지 않는다", () => {
    for (const f of files) {
      const src = readFileSync(join(dir, f), "utf8").replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
      expect(src, f).not.toMatch(/localStorage|sessionStorage|STORAGE_KEYS|saveAssetData|saveData|notifyAssetUserEdit|pushAsset|pullAsset|applyImportedPayload|clearAssetData|setEntries|setBaseline|"use client"|from "react"/);
    }
  });
});

describe("정적 규칙 — 대화상자·서버 (C16·C26·GA)", () => {
  const root = join(__dirname, "..", "..");
  const dialog = readFileSync(join(root, "app/(main)/_components/forms/asset-update/screenshot/holdings-resync-dialog.tsx"), "utf8");
  // `accept="image/*"` 같은 문자열이 블록 주석으로 오인되지 않게, 공백·`{` 뒤의 `/*`만 주석으로 본다
  const code = dialog.replace(/^\s*\/\/.*$/gm, "").replace(/(^|[\s{])\/\*[\s\S]*?\*\//g, "$1");
  it("맞추기·되돌리기 경로에 asset_save·가져오기 저장·초기화가 없다", () => {
    expect(code).not.toMatch(/trackAssetSave|asset_save|applyImportedPayload|clearAssetData|saveAssetDataRaw|refreshData|STORAGE_KEYS|localStorage/);
  });
  it("saveData 호출은 적용·되돌리기 핸들러 2곳뿐이고 effect 안에 없다", () => {
    expect(code.match(/saveData\(/g)).toHaveLength(2);
    for (const m of code.matchAll(/useEffect\(\(\) => \{[\s\S]*?\n {2}\}, \[/g)) expect(m[0]).not.toMatch(/saveData\(/);
  });
  it("보안 문구는 SCREENSHOT_UPLOAD_NOTICE 하나뿐이고 금지 문구가 없다", () => {
    expect(code).toMatch(/SCREENSHOT_UPLOAD_NOTICE/);
    expect(dialog).not.toMatch(/덮어쓰기|초기화 후 등록|앱을 닫기 전까지|공통 적용|개별 선택/);
    expect(code).not.toMatch(/서버|안전하게|암호화|보안/);
  });
  it("GA는 시작·적용·되돌리기 3개 category만 쓴다", () => {
    expect([...code.matchAll(/category: "(\w+)"/g)].map((m) => m[1]).sort()).toEqual(["resync_apply", "resync_start", "resync_undo"]);
  });
  it("기존 첫 등록 컴포넌트·보유 충돌 모듈은 맞추기를 모른다", () => {
    for (const f of ["app/(main)/_components/forms/asset-update/screenshot/stock-screenshot-import.tsx", "app/(main)/_components/forms/asset-update/screenshot/crypto-screenshot-import.tsx", "lib/asset/holdings-conflict.ts"]) {
      expect(readFileSync(join(root, f), "utf8")).not.toMatch(/resync/i);
    }
  });
  it("UI 검수 P0: after 가상요소로 히트영역을 넓히는 요소는 반드시 위치 기준(relative/absolute)을 가진다(푸터 클릭 가로채기 회귀)", () => {
    const classes = [...dialog.matchAll(/className=(?:"([^"]*)"|\{`([^`]*)`\})/g)].map((m) => m[1] ?? m[2]);
    const withAfter = classes.filter((c) => /after:absolute/.test(c));
    expect(withAfter.length).toBeGreaterThanOrEqual(3);
    for (const c of withAfter) expect(c, c).toMatch(/(^|\s)(relative|absolute)(\s|$)/);
  });
  it("UI 검수 문구: 삭제 해제 이유 2종·유지 묶음 제목·거래정지 안내·토스트 액션 40px", () => {
    expect(dialog).toMatch(/를 못 정한 장이 있어서 삭제는 모두 꺼 뒀어요/);
    expect(dialog).toMatch(/인식 못 한 장이 있어서 삭제는 모두 꺼 둘게요\. 다시 시도가 성공하면 다시 계산해요/);
    expect(dialog).toMatch(/스크린샷에 없는 다른 /);
    expect(dialog).toMatch(/거래정지·상장폐지 종목은 기본으로 그대로 둬요/);
    expect(dialog).toMatch(/actionButtonStyle: \{ minHeight: 40 \}/);
  });
  it("UI 권고 R1~R4: 유지 묶음 nowrap·Select 40px·코인 문구 분기·자동 포함·다크 구분선", () => {
    expect(dialog).toMatch(/스크린샷에 없는 다른 <NR>/);
    expect((dialog.match(/data-\[size=default\]:h-10/g) ?? []).length).toBe(3);
    expect(dialog).toMatch(/보이는 코인 화면과 똑같이 맞춰요\. 평단가가 화면에 없으면/);
    expect(dialog).toMatch(/\{T\.item\} \{shot\.items\.length\}개/);
    expect((dialog.match(/onInclude\(true\)/g) ?? []).length).toBe(3);
    expect(dialog).toMatch(/dark:border-white\/10/);
  });
  it("qa D1: 토스트 되돌리기는 대화상자 상태를 건드리지 않고, 재적용 시 되돌림 상태를 초기화한다", () => {
    expect(dialog).toMatch(/onClick: \(\) => void doUndo\(u, true\)/);
    expect(dialog).not.toMatch(/fromToast = u !== undoRef\.current/);
    const doUndo = dialog.slice(dialog.indexOf("const doUndo"), dialog.indexOf("const parsedOk"));
    expect(doUndo.match(/if \(!fromToast\)/g)).toHaveLength(3); // 시작·실패·성공의 상태 갱신 모두 토스트 경로에서 제외
    const apply = dialog.slice(dialog.indexOf("const handleApply"), dialog.indexOf("const doUndo"));
    expect(apply).toMatch(/setUndoInfo\(null\)/);
  });
  it("qa D2: 확인 필요 행에도 증권사 채움 화살표와 연결 문구가 있다(수량 감소 연결 행)", () => {
    const needsRow = dialog.slice(dialog.indexOf("function NeedsRow"), dialog.indexOf("function CheckRow"));
    expect(needsRow).toMatch(/row\.change\?\.brokerFill &&/);
    expect(needsRow).toMatch(/row\.linkedBy === "unassigned" && <p[^>]*>\{T\.broker\} 미지정 줄과 연결/);
    expect(needsRow).toMatch(/tickerMissing/);
  });
  it("qa 기록: 코인 수량 충돌 단위는 코인에서 '개'", () => {
    expect(dialog).toMatch(/qty: "개"/);
    expect(dialog).not.toMatch(/\$\{fmt\(q\)\}주/);
  });
  it("서버 라우트: 잘림은 422 + code truncated, 수량 미인식·평단 역산 플래그를 덧붙인다", () => {
    const route = readFileSync(join(root, "app/api/parse-screenshot/route.ts"), "utf8");
    expect(route).toMatch(/MAX_TOKENS[\s\S]{0,200}code: "truncated"[\s\S]{0,60}status: 422/);
    expect(route).toMatch(/quantityMissing: !!s\.quantityMissing/);
    expect(route).toMatch(/averagePriceEstimated,/);
  });
});
