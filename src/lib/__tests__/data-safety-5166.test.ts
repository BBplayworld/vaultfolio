// #329 [5.166] 받은 배당 기록 — 데이터 안전 T1~T11(spec 9장 7번, CHECKLIST C151).
// 새 저장 키 `secretasset.cash_tx_tags` + payload 최상위 `cashTxTags`. 현금 거래 레코드·스키마·enum 변경 0.
//
// 마이그레이션 코드가 없는 근거(CLAUDE.md 절대 규칙 — 이전 버전 데이터 복원 테스트로 충족):
//  ① 새 키가 없으면 빈 맵으로 읽는다(T1) ② 기존 레코드를 다시 쓰지 않는다(T1: 구 백업·구 저장소를 읽어도 새 키 쓰기 0)
//  ③ 새 버전이 쓴 데이터를 이전 버전이 그대로 읽는다(T2: 금액·잔액·건수 동일, 레코드 키 집합 동일) ④ 형식 버전은 맵 안의 v:1뿐이다.
//
// 구버전 기기는 동결 사본(fixtures/frozen-schema-5160, main 9c13292)으로 재현한다 — 살아 있는 `src/types` 스키마를 import하지 않는다.
// (타입만 쓰는 `import type`은 런타임 import가 아니다. 사본을 뜬 뒤 main의 스키마 파일은 바뀌지 않았다: 9c13292..3bc97a2 diff 0)
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { applyImportedPayload, buildExportPayload, clearAssetData, generateShareToken, getAssetData, saveAssetData } from "../asset/asset-storage";
import {
  applyIncomingCashTxTags, clearCashTxTags, mergeCashTxTags, parseCashTxTags, putDividendTag, readCashTxTagsForExport, readCashTxTagsState,
  readDividendTags, removeCashTxTags, sameCashTxTags, serializeCashTxTags,
} from "../asset/cash-tx-tags";
import { sumReceivedDividend } from "../finance/received-dividend";
import { decryptPayload, deriveKeys, encryptPayload, type AssetKeys } from "../cloud-sync/crypto";
import { applyRevert, type OverwriteEntry } from "../cloud-sync/overwrite-guard";
import { pullAsset, pushAsset } from "../cloud-sync/sync-client";
import { getVersion, markSynced } from "../cloud-sync/sync-state";
import { pruneCashTransactions } from "../trade/cash-tx-utils";
import { createMemoryStorage } from "../trial/trial-boot";
import { injectDemoPayload } from "../preview/demo-inject";
import { track } from "../analytics/ga";
import { computeSettlementCauses } from "@/app/(main)/_components/views/activity/change-hero";
import { groupYearSettlement } from "../report/year-settlement";
import { frozenAssetDataSchema, frozenDevice } from "./fixtures/frozen-schema-5160/loose";
import { g, memoryStorage } from "./physical-fixtures";
import type { AssetData, MonthlyAssetSnapshot } from "@/types/asset";

const KEY = "secretasset.cash_tx_tags";
const MAIN = "secretasset_asset_data";
const AID = "test-asset-id-1234567890";
const RATES = { USD: 1400, JPY: 900 };
const mul = (c: string | undefined) => (c === "USD" ? RATES.USD : c === "JPY" ? RATES.JPY / 100 : 1);

let server: { version: number; iv?: string; ciphertext?: string };
let keys: AssetKeys;
// A·C = 새 버전(5.166) 기기, B = 구버전(5.160 동결 사본) 기기
const dev = { A: memoryStorage(), B: memoryStorage(), C: memoryStorage() };
type Name = keyof typeof dev;
const on = (n: Name) => { g.localStorage = dev[n]; };
const raw = (n: Name) => { on(n); return localStorage.getItem(KEY); };
const tagsOf = (n: Name) => { on(n); return readDividendTags(getAssetData().cashTransactions); };
const push = async (n: Name) => { on(n); return pushAsset(AID, keys); };
const pull = async (n: Name) => { on(n); return pullAsset(AID, keys); };
const serverPayload = async () => (await decryptPayload({ iv: server.iv!, ciphertext: server.ciphertext! }, keys.encKey)) as Record<string, unknown>;
async function oldPull() {
  on("B");
  frozenDevice.applyImport(await serverPayload());
  markSynced(server.version);
}
async function oldPush() {
  on("B");
  const blob = await encryptPayload(frozenDevice.buildPayload(), keys.encKey);
  if (getVersion() !== server.version) return "conflict" as const;
  server = { version: server.version + 1, iv: blob.iv, ciphertext: blob.ciphertext };
  markSynced(server.version);
  return "ok" as const;
}

beforeEach(async () => {
  g.window = Object.assign(globalThis, { dispatchEvent: () => true }) as never;
  dev.A = memoryStorage(); dev.B = memoryStorage(); dev.C = memoryStorage();
  on("A");
  server = { version: 0 };
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-27T03:00:00Z"));
  g.fetch = vi.fn(async (_url: string, init?: { method?: string; body?: string }) => {
    const json = (status: number, body: unknown) => ({ ok: status < 400, status, json: async () => body });
    if (init?.method === "PUT") {
      const b = JSON.parse(init.body as string) as { baseVersion: number; iv: string; ciphertext: string };
      if (b.baseVersion !== server.version) return json(409, { asset: { version: server.version } });
      server = { version: server.version + 1, iv: b.iv, ciphertext: b.ciphertext };
      return json(200, { version: server.version });
    }
    if (!server.iv) return json(404, {});
    return json(200, { asset: { iv: server.iv, ciphertext: server.ciphertext, version: server.version } });
  });
  keys = await deriveKeys("test-pass-123!", AID);
});
afterEach(() => {
  vi.useRealTimers();
  delete g.window; delete g.localStorage; delete g.fetch;
});

// ── 픽스처 ──
const empty = (): AssetData => ({
  realEstate: [], stocks: [], crypto: [], cash: [], loans: [],
  yearlyNetAssets: [], transactions: [], cashTransactions: [], loanTransactions: [], cryptoTransactions: [],
  lastUpdated: "2026-01-01T00:00:00.000Z", nickname: "",
});
const acct = (id = "k1", balance = 3_000_000, currency: "KRW" | "USD" | "JPY" = "KRW") => ({ id, type: "bank" as const, name: "예금", balance, currency });
type Tx = AssetData["cashTransactions"][number];
const dep = (id: string, amount: number, date: string, over: Partial<Tx> = {}): Tx => ({
  id, cashId: "k1", type: "deposit", amount, currency: "KRW", recurring: false, date, reflected: true,
  reflectedAt: `${date}T00:00:00.000Z`, reflectionId: `ref_${id}`, createdAt: `${date}T00:00:00.000Z`, ...over,
});
const T1 = "ctx_1764200000001_aaaaa";
const T2 = "ctx_1764200000002_bbbbb";
const T3 = "ctx_1764200000003_ccccc";
/** 폼 저장과 같은 순서 — 표시 먼저 → 거래 저장(asset-data-context.saveTaggedCashTx) */
function addDividend(n: Name, tx: Tx, stock?: { ticker?: string; name?: string }) {
  on(n);
  putDividendTag(tx.id, stock);
  const d = getAssetData();
  expect(saveAssetData({ ...d, cashTransactions: [...d.cashTransactions, tx] })).toBe(true);
}
/** 거래 삭제 경로(asset-data-context.deleteCashTransaction*) — 거래 저장 → 표시 제거 */
function deleteTx(n: Name, id: string) {
  on(n);
  const d = getAssetData();
  expect(saveAssetData({ ...d, cashTransactions: d.cashTransactions.filter((t) => t.id !== id) })).toBe(true);
  removeCashTxTags([id]);
}
const seed = (n: Name, data: Partial<AssetData> = {}) => { on(n); saveAssetData({ ...empty(), cash: [acct()], ...data }); };
const sumOf = (n: Name) => { on(n); const d = getAssetData(); return sumReceivedDividend(d.cashTransactions, readDividendTags(d.cashTransactions), 2026, mul); };

// 4.x 초기 백업(래퍼 없는 assetData 단독) / 중간 버전 백업(래퍼 + 현금·거래) — 둘 다 cashTxTags를 모른다
const oldBareBackup = () => ({
  realEstate: [{ id: "re1", name: "아파트", type: "apartment", purchasePrice: 500_000_000, currentValue: 700_000_000, purchaseDate: "2020-01-01" }],
  stocks: [{ id: "s1", category: "domestic", name: "삼성전자", ticker: "005930", quantity: 10, averagePrice: 60000, currentPrice: 70000, purchaseDate: "2023-01-02" }],
  crypto: [],
  lastUpdated: "2024-02-01T00:00:00.000Z",
});
const oldWrappedBackup = () => ({
  assetData: {
    ...oldBareBackup(),
    cash: [{ id: "k1", type: "bank", name: "예금", balance: 3_000_000 }],
    cashTransactions: [
      { id: "ctx_1", cashId: "k1", type: "deposit", amount: 500_000, date: "2026-01-05", reflected: true, createdAt: "2026-01-05T00:00:00.000Z" },
      { id: "ctx_2", cashId: "k1", type: "withdrawal", amount: 120_000, date: "2026-02-05", reflected: false, createdAt: "2026-02-05T00:00:00.000Z" },
    ],
    nickname: "홍",
  },
  snapshots: { daily: [{ date: "2026-01-31", netAsset: 100 }], monthly: [{ month: "2026-01", netAsset: 100 }] },
  profitBasis: "sameBusinessDay",
});

describe("T1 이전 → 새: 구버전 데이터 복원 값 불변, 새 키 쓰기 0", () => {
  it("구 백업 2종(래퍼 없음·래퍼 있음)을 복원해도 금액·잔액·건수가 그대로이고 새 키를 만들지 않는다", () => {
    applyImportedPayload(oldBareBackup());
    let d = getAssetData();
    expect(d.realEstate[0].currentValue).toBe(700_000_000);
    expect(d.stocks[0]).toMatchObject({ quantity: 10, averagePrice: 60000 });
    expect(d.cashTransactions).toEqual([]);
    expect(localStorage.getItem(KEY)).toBeNull();

    applyImportedPayload(oldWrappedBackup());
    d = getAssetData();
    expect(d.cash[0]).toMatchObject({ balance: 3_000_000, currency: "KRW" });
    expect(d.cashTransactions.map((t) => [t.id, t.type, t.amount, t.reflected])).toEqual([["ctx_1", "deposit", 500_000, true], ["ctx_2", "withdrawal", 120_000, false]]);
    expect(localStorage.getItem(KEY)).toBeNull();
    // 키 없음 = 빈 맵: 읽기·합계·내보내기 모두 '기록 없음'
    expect(readCashTxTagsState().state).toBe("none");
    expect(readDividendTags(d.cashTransactions)).toEqual({});
    expect(sumReceivedDividend(d.cashTransactions, readDividendTags(d.cashTransactions), 2026, mul).annual).toBe(0);
    expect(buildExportPayload()).not.toHaveProperty("cashTxTags");
  });

  it("구버전 기기가 쓰던 저장소를 새 버전이 그대로 읽는다(업데이트 직후) — 본 키 원문을 다시 쓰지 않고 새 키도 만들지 않는다", () => {
    on("B");
    frozenDevice.save(frozenAssetDataSchema.parse(oldWrappedBackup().assetData));
    const before = localStorage.getItem(MAIN);
    const old = frozenDevice.read();
    const d = getAssetData(); // 같은 저장소를 새 버전 코드로 읽는다
    expect(d.cashTransactions).toEqual(old.cashTransactions);
    expect(d.cash).toEqual(old.cash);
    expect(localStorage.getItem(MAIN)).toBe(before);
    expect(localStorage.getItem(KEY)).toBeNull();
  });
});

describe("T2 새 → 이전: 새 버전 payload를 구버전(동결 사본)이 읽어 금액·잔액·건수 동일", () => {
  it("배당으로 적은 입금이 구버전에서는 일반 입금으로 보이고 레코드가 한 글자도 다르지 않다", async () => {
    seed("A");
    addDividend("A", dep(T1, 50_000, "2026-11-20"), { ticker: "005930", name: "삼성전자" });
    addDividend("A", dep(T2, 30_000, "2026-10-15", { reflected: false, reflectedAt: undefined, reflectionId: undefined }));
    const newData = getAssetData();
    const payload = JSON.parse(JSON.stringify(buildExportPayload()));
    expect(payload.cashTxTags).toEqual({ v: 1, [T1]: { kind: "dividend", ticker: "005930", stockName: "삼성전자" }, [T2]: { kind: "dividend" } });

    on("B");
    frozenDevice.applyImport(payload);
    const old = frozenDevice.read();
    expect(old.cashTransactions).toEqual(JSON.parse(JSON.stringify(newData.cashTransactions))); // 레코드 키·값 동일(새 필드 0)
    expect(old.cashTransactions).toHaveLength(2);
    expect(old.cash).toEqual(newData.cash);
    expect(old.cashTransactions.reduce((s, t) => s + t.amount, 0)).toBe(80_000);
    expect(localStorage.getItem(KEY)).toBeNull(); // 구버전은 새 키를 쓰지 않는다
  });

  it("동결 사본은 모르는 키를 strip한다(구버전 재현이 실제로 '구버전'임을 고정) — 그래서 표시를 레코드 안에 두지 않았다", () => {
    const parsed = frozenAssetDataSchema.parse({
      ...empty(), cash: [acct()],
      cashTransactions: [{ ...dep(T1, 50_000, "2026-11-20"), kind: "dividend", dividendTicker: "005930" }],
      cashTxTags: { v: 1 },
    });
    expect(parsed.cashTransactions[0]).not.toHaveProperty("kind");
    expect(parsed.cashTransactions[0]).not.toHaveProperty("dividendTicker");
    expect(parsed).not.toHaveProperty("cashTxTags");
    expect(parsed.cashTransactions[0].amount).toBe(50_000);
  });

  it("새 버전에서 구버전으로 롤백해도 새 키는 남는다(점 구분 — 구버전 clearAssetData에 안 걸림) → 재배포 뒤 표시 복귀", () => {
    seed("A");
    addDividend("A", dep(T1, 50_000, "2026-11-20"));
    const before = localStorage.getItem(KEY);
    frozenDevice.save(frozenDevice.read()); // 롤백한 구버전이 읽고 저장
    frozenDevice.clear();                   // 구버전 pull·가져오기의 clearAssetData
    expect(localStorage.getItem(KEY)).toBe(before);
  });
});

describe("T3 신 push → 구 pull·편집·push → 신 pull: 로컬 맵 유지, repush true, 다음 payload에 필드 복귀", () => {
  it("구버전 기기가 필드 없는 payload로 클라우드를 덮어도 신 기기가 다시 올려 복구한다", async () => {
    seed("A");
    addDividend("A", dep(T1, 50_000, "2026-11-20"), { ticker: "005930", name: "삼성전자" });
    expect((await push("A")).status).toBe("ok");
    expect((await serverPayload()).cashTxTags).toBeDefined();

    await oldPull(); // B: 일반 입금으로 읽는다
    on("B");
    expect(frozenDevice.read().cashTransactions.map((t) => t.amount)).toEqual([50_000]);
    frozenDevice.save({ ...frozenDevice.read(), nickname: "B가 수정" });
    expect(await oldPush()).toBe("ok");
    expect(await serverPayload()).not.toHaveProperty("cashTxTags"); // 클라우드에서 필드가 빠졌다

    const before = raw("A");
    const r = await pull("A");
    expect(r).toMatchObject({ status: "ok", mergedAdditions: true }); // repush
    expect(raw("A")).toBe(before);                                    // 로컬 맵 유지(쓰기 0)
    expect(getAssetData().nickname).toBe("B가 수정");                  // 나머지는 정상 반영
    expect(tagsOf("A")).toEqual({ [T1]: { kind: "dividend", ticker: "005930", stockName: "삼성전자" } });

    expect((await push("A")).status).toBe("ok");
    expect((await serverPayload()).cashTxTags).toEqual({ v: 1, [T1]: { kind: "dividend", ticker: "005930", stockName: "삼성전자" } });
    // 새 신 기기 C가 표시를 복원하고, 더 올릴 것이 없다
    expect(await pull("C")).toMatchObject({ status: "ok", mergedAdditions: false });
    expect(tagsOf("C")).toEqual(tagsOf("A"));
    // 다시 pull해도 반복되지 않는다
    expect(await pull("A")).toMatchObject({ status: "ok", mergedAdditions: false });
  });
});

describe("T4 병합: 교환·멱등, 손상 로컬 쓰기 0, 못 읽는 수신은 덮지 않음, 고아 차이는 repush false", () => {
  const P = (v: unknown) => parseCashTxTags(v)!;
  it("id 합집합 — 교환·결합·멱등. 같은 id가 다르면 어느 쪽에서 합쳐도 같은 값", () => {
    const a = P({ v: 1, [T1]: { kind: "dividend" }, [T2]: { kind: "dividend", ticker: "AAPL", stockName: "애플" } });
    const b = P({ v: 1, [T1]: { kind: "dividend", ticker: "005930", stockName: "삼성전자" }, [T3]: { kind: "dividend" } });
    const c = P({ v: 1, [T3]: { kind: "dividend", stockName: "코카콜라" } });
    expect(sameCashTxTags(mergeCashTxTags(a, b), mergeCashTxTags(b, a))).toBe(true);
    expect(sameCashTxTags(mergeCashTxTags(mergeCashTxTags(a, b), c), mergeCashTxTags(a, mergeCashTxTags(b, c)))).toBe(true);
    expect(sameCashTxTags(mergeCashTxTags(a, a), a)).toBe(true);
    expect(Object.keys(mergeCashTxTags(a, b).items).sort()).toEqual([T1, T2, T3]);
    expect(mergeCashTxTags(a, b).items[T1]).toEqual({ kind: "dividend", ticker: "005930", stockName: "삼성전자" });
  });

  it("손상 로컬: 동기화 pull은 원문을 덮지 않고 repush false. 삭제 경로도 쓰지 않는다", () => {
    for (const broken of ["{{{", JSON.stringify({ v: 2, [T1]: { kind: "dividend" } }), JSON.stringify([1])]) {
      localStorage.setItem(KEY, broken);
      const r = applyIncomingCashTxTags({ v: 1, [T2]: { kind: "dividend" } }, { merge: true, live: new Set([T1, T2]) });
      expect(r.repush).toBe(false);
      expect(applyIncomingCashTxTags(undefined, { merge: true, live: new Set([T1]) }).repush).toBe(false);
      removeCashTxTags([T1]);
      expect(localStorage.getItem(KEY)).toBe(broken);
      expect(readCashTxTagsForExport(new Set([T1]))).toBeUndefined(); // 손상이면 필드를 싣지 않는다
    }
  });

  it("못 읽는 수신(v:2·배열·문자열)은 로컬을 덮지 않고 repush false", () => {
    putDividendTag(T1);
    const before = localStorage.getItem(KEY);
    for (const field of [{ v: 2, [T2]: { kind: "dividend" } }, [1, 2], "x", null, 3]) {
      expect(applyIncomingCashTxTags(field, { merge: true, live: new Set([T1, T2]) }).repush).toBe(false);
      expect(localStorage.getItem(KEY)).toBe(before);
    }
  });

  it("필드 없는 수신: 살아 있는 로컬 표시가 있을 때만 repush(고아만 있으면 false)", () => {
    putDividendTag(T1);
    expect(applyIncomingCashTxTags(undefined, { merge: true, live: new Set([T1]) }).repush).toBe(true);
    expect(applyIncomingCashTxTags(undefined, { merge: true, live: new Set([T2]) }).repush).toBe(false);
    expect(applyIncomingCashTxTags(undefined, { merge: false, live: new Set([T1]) }).repush).toBe(false); // 파일 가져오기는 push 판정을 하지 않는다
  });

  it("고아만 다른 두 신 기기는 서로 재-push하지 않는다(반복 0)", async () => {
    seed("A");
    addDividend("A", dep(T1, 50_000, "2026-11-20"));
    await push("A");
    await pull("C");
    // A에만 고아 항목(거래가 원격 삭제·정리로 사라진 표시)이 남아 있다
    on("A");
    putDividendTag(T3);
    expect(Object.keys(JSON.parse(raw("A")!)).sort()).toEqual([T1, T3, "v"].sort());
    await push("A");
    expect((await serverPayload()).cashTxTags).toEqual({ v: 1, [T1]: { kind: "dividend" } }); // 고아는 나가지 않는다
    for (let i = 0; i < 3; i++) {
      expect(await pull("C")).toMatchObject({ status: "ok", mergedAdditions: false });
      await push("C");
      expect(await pull("A")).toMatchObject({ status: "ok", mergedAdditions: false });
      await push("A");
    }
    expect(JSON.parse(raw("A")!)[T3]).toEqual({ kind: "dividend" }); // 고아는 저장소에 남는다(지우는 코드가 손실 경로라 압축하지 않는다)
    expect(tagsOf("C")).toEqual({ [T1]: { kind: "dividend" } });
  });

  it("두 신 기기가 서로 다른 표시를 가졌으면 한 번씩 오간 뒤 같아지고 멈춘다", async () => {
    seed("A", { cashTransactions: [dep(T1, 50_000, "2026-11-20"), dep(T2, 30_000, "2026-10-15")] });
    await push("A");
    await pull("C");
    on("A"); putDividendTag(T1);
    on("C"); putDividendTag(T2, { name: "코카콜라" });
    await push("A");
    expect(await pull("C")).toMatchObject({ mergedAdditions: true });  // C의 T2가 수신에 없다
    await push("C");
    expect(await pull("A")).toMatchObject({ mergedAdditions: false }); // 합쳐진 값을 받았다
    expect(tagsOf("A")).toEqual(tagsOf("C"));
    expect(Object.keys(tagsOf("A")).sort()).toEqual([T1, T2]);
  });
});

describe("T5 삭제: 3경로는 항목 제거, 원격 삭제·3년 정리는 조인으로 제외, #84 되돌리기 뒤 표시 복귀", () => {
  it("거래 삭제 → 항목 제거(다른 항목은 그대로). 지울 것이 없으면 쓰지 않는다", () => {
    seed("A");
    addDividend("A", dep(T1, 50_000, "2026-11-20"));
    addDividend("A", dep(T2, 30_000, "2026-10-15"));
    deleteTx("A", T1);
    expect(JSON.parse(raw("A")!)).toEqual({ v: 1, [T2]: { kind: "dividend" } });
    expect(sumOf("A").annual).toBe(30_000);
    const before = raw("A");
    removeCashTxTags(["ctx_없는거래", T3]);
    expect(raw("A")).toBe(before);
  });

  it("컨텍스트의 삭제 3경로(거래 삭제 2·계좌 삭제 1)가 저장 성공 뒤 항목을 제거한다(소스 고정)", () => {
    const src = readFileSync(path.resolve(__dirname, "../../contexts/asset-data-context.tsx"), "utf8");
    const body = (name: string) => { const i = src.indexOf(`const ${name} = useCallback(`); return src.slice(i, src.indexOf("\n  );", i)); };
    for (const name of ["deleteCashTransactionWithBalance", "deleteCashTransaction"]) {
      expect(body(name)).toMatch(/const ok = saveData\(newData\);\s+if \(ok\) removeCashTxTags\(\[txId\]\);/);
    }
    expect(body("deleteCash")).toMatch(/if \(ok\) removeCashTxTags\(\(assetData\.cashTransactions \|\| \[\]\)\.filter\(\(t\) => t\.cashId === id\)\.map\(\(t\) => t\.id\)\);/);
    // 저장 순서: 표시 먼저 → 거래 저장, 거래 저장 실패 = 표시 회수
    expect(body("saveTaggedCashTx")).toMatch(/putDividendTag\(tx\.id, tag\.stock\);[\s\S]*return false;[\s\S]*const ok = saveData\(newData\);\s+if \(!ok\) removeCashTxTags\(\[tx\.id\]\);/);
    // 그 밖의 경로는 표시를 지우지 않는다 — 호출 수 고정(삭제 3 + 회수 1)
    expect(src.match(/removeCashTxTags\(/g)).toHaveLength(4);
  });

  it("원격 삭제: 저장소 항목은 남기고 합계·배지·내보내기에서 빠진다. 덮임 되돌리기(#84)가 같은 id로 되살리면 표시가 돌아온다", async () => {
    seed("A");
    const tx = dep(T1, 50_000, "2026-11-20");
    addDividend("A", tx, { ticker: "005930", name: "삼성전자" });
    await push("A");
    await pull("C");
    deleteTx("C", T1); // 다른 신 기기가 거래를 지웠다
    await push("C");
    expect(await pull("A")).toMatchObject({ status: "ok", mergedAdditions: false });
    on("A");
    expect(getAssetData().cashTransactions).toEqual([]);
    expect(JSON.parse(raw("A")!)[T1]).toBeDefined();      // 고아로 남는다
    expect(tagsOf("A")).toEqual({});                       // 배지
    expect(sumOf("A").annual).toBe(0);                     // 합계
    expect(buildExportPayload()).not.toHaveProperty("cashTxTags"); // 내보내기

    // #84 되돌리기 — applyRevert가 내 값(같은 id)을 다시 넣는다
    const entry: OverwriteEntry = { key: `cashTransactions:${T1}`, coll: "cashTransactions", kind: "remoteDeleted", label: "", mine: tx as unknown as Record<string, unknown>, landed: null };
    saveAssetData(applyRevert(getAssetData(), [entry]));
    expect(tagsOf("A")).toEqual({ [T1]: { kind: "dividend", ticker: "005930", stockName: "삼성전자" } });
    expect(sumOf("A").annual).toBe(50_000);
    expect(buildExportPayload().cashTxTags).toEqual({ v: 1, [T1]: { kind: "dividend", ticker: "005930", stockName: "삼성전자" } });
  });

  it("3년 정리(pruneCashTransactions)로 사라진 거래의 표시는 지우지 않고 조인으로 무시한다", () => {
    seed("A");
    addDividend("A", dep(T1, 50_000, "2023-01-10"));
    addDividend("A", dep(T2, 30_000, "2026-10-15"));
    const d = getAssetData();
    saveAssetData({ ...d, cashTransactions: pruneCashTransactions(d.cashTransactions) });
    expect(getAssetData().cashTransactions.map((t) => t.id)).toEqual([T2]);
    expect(Object.keys(tagsOf("A"))).toEqual([T2]);
    expect(buildExportPayload().cashTxTags).toEqual({ v: 1, [T2]: { kind: "dividend" } });
    expect(JSON.parse(raw("A")!)[T1]).toBeDefined();
  });
});

describe("T6 clear 4곳은 키 제거, clearAssetData(pull·복원)는 보존", () => {
  it("clearAssetData는 새 키를 지우지 않는다", () => {
    seed("A");
    addDividend("A", dep(T1, 50_000, "2026-11-20"));
    const before = raw("A");
    clearAssetData();
    expect(localStorage.getItem(MAIN)).toBeNull();
    expect(raw("A")).toBe(before);
  });

  it("clearCashTxTags는 키를 없앤다(값을 비우는 것이 아니라 제거)", () => {
    putDividendTag(T1);
    clearCashTxTags();
    expect(localStorage.getItem(KEY)).toBeNull();
    expect(readCashTxTagsState().state).toBe("none");
  });

  it("데모 주입은 키를 비운다(앞선 데이터의 표시가 데모 화면에 남지 않는다)", async () => {
    seed("A");
    addDividend("A", dep(T1, 50_000, "2026-11-20"));
    await injectDemoPayload();
    expect(localStorage.getItem(KEY)).toBeNull();
    expect(getAssetData().cash.length).toBeGreaterThan(0); // 데모 현금 계좌는 있다 → 배당 화면에 '받은 배당 적기' 칩
  });

  it("명시 초기화 4곳에 clear 호출이 있다(소스 고정): 모든 데이터 삭제·?demo=empty·공유 링크 반영·데모 주입", () => {
    const read = (p: string) => readFileSync(path.resolve(__dirname, "../..", p), "utf8");
    const settings = read("app/(main)/_components/header-menu/settings-page.tsx");
    expect(settings).toMatch(/clearStockLabels\(\);[^\n]*\n\s+clearCashTxTags\(\);/);
    const gate = read("app/(main)/_components/preview/preview-gate.tsx");
    expect(gate.slice(gate.indexOf('action === "empty"'))).toMatch(/clearPhysicalAssets\(\);\s+clearStockLabels\(\);[^\n]*\n\s+clearCashTxTags\(\);/);
    const ctx = read("contexts/asset-data-context.tsx");
    const shared = ctx.slice(ctx.indexOf("const applySharedData = useCallback("));
    expect(shared.slice(0, shared.indexOf("saveAssetDataNotify(data);"))).toContain("clearCashTxTags();");
    expect(read("lib/preview/demo-inject.ts")).toMatch(/clearCashTxTags\(\);\s+applyImportedPayload\(next\);/);
    // 그 밖의 곳에서는 키를 지우지 않는다 — 호출 파일 전수(정의 파일 제외)
    expect(ctx.match(/clearCashTxTags\(\)/g)).toHaveLength(1);
    for (const f of ["lib/asset/asset-storage.ts", "lib/cloud-sync/sync-client.ts", "lib/cloud-sync/cloud-sync-provider.tsx", "lib/one-time-migrations.ts", "lib/trade/cash-tx-utils.ts"]) {
      expect(read(f)).not.toContain("clearCashTxTags");
      expect(read(f)).not.toContain("removeCashTxTags");
    }
  });
});

describe("T7 백업 왕복 deepEqual, 필드 없는 구 백업은 로컬 유지", () => {
  it("내보내기 → 새 기기에서 복원 → 다시 내보내기가 같다", () => {
    seed("A");
    addDividend("A", dep(T1, 50_000, "2026-11-20"), { ticker: "005930", name: "삼성전자" });
    addDividend("A", dep(T2, 1_000, "2026-10-15", { currency: "USD" }));
    const file = JSON.parse(JSON.stringify(buildExportPayload()));
    expect(file.cashTxTags).toBeDefined();
    on("C");
    applyImportedPayload(file);
    expect(JSON.parse(JSON.stringify(buildExportPayload()))).toEqual(file);
    expect(tagsOf("C")).toEqual(tagsOf("A"));
    // 같은 파일을 한 번 더 복원해도 같다(멱등)
    on("C");
    applyImportedPayload(file);
    expect(JSON.parse(JSON.stringify(buildExportPayload()))).toEqual(file);
  });

  it("필드 없는 구 백업을 같은 기기에 복원하면 로컬 맵을 건드리지 않는다(같은 id → 표시 유지)", () => {
    seed("A");
    addDividend("A", dep(T1, 50_000, "2026-11-20"));
    const { cashTxTags: _t, ...oldFile } = JSON.parse(JSON.stringify(buildExportPayload()));
    const before = raw("A");
    applyImportedPayload(oldFile);
    expect(raw("A")).toBe(before);
    expect(tagsOf("A")).toEqual({ [T1]: { kind: "dividend" } });
  });

  it("새 백업 → 구버전 복원 → 구버전이 다시 내보낸 파일에는 표시가 없지만 금액·건수는 같다(그 파일만 분류 소실)", () => {
    seed("A");
    addDividend("A", dep(T1, 50_000, "2026-11-20"));
    const file = JSON.parse(JSON.stringify(buildExportPayload()));
    on("B");
    frozenDevice.applyImport(file);
    const oldFile = frozenDevice.buildPayload();
    expect(oldFile).not.toHaveProperty("cashTxTags");
    expect((oldFile.assetData as AssetData).cashTransactions).toEqual(file.assetData.cashTransactions);
  });
});

describe("T8 관대 읽기", () => {
  it("손상 JSON·모르는 v·배열 → 빈 상태(읽기는 죽지 않는다), assetData 읽기에 영향 0", () => {
    seed("A", { cashTransactions: [dep(T1, 50_000, "2026-11-20")] });
    const base = getAssetData();
    for (const broken of ["{{{", "null", "[]", JSON.stringify({ v: 2 }), JSON.stringify({ [T1]: { kind: "dividend" } })]) {
      localStorage.setItem(KEY, broken);
      expect(readDividendTags(base.cashTransactions)).toEqual({});
      expect(getAssetData()).toEqual(base);
      expect(buildExportPayload()).not.toHaveProperty("cashTxTags");
    }
  });

  it("항목 단위로 건너뛴다: 위험 키·ctx_ 접두가 아닌 id·틀린 타입은 그 항목만 빠지고 나머지는 읽힌다", () => {
    const rawText = `{"v":1,"__proto__":{"kind":"dividend"},"constructor":{"kind":"dividend"},"prototype":{"kind":"dividend"},`
      + `"${T1}":{"kind":"dividend","ticker":"005930","stockName":"삼성전자"},`
      + `"${T2}":{"kind":7},"${T3}":"dividend","ctx_":{"kind":"dividend"},"ctx_bad id":{"kind":"dividend"},`
      + `"ctx_4":{"kind":"dividend","ticker":123,"stockName":["x"]},"ctx_5":null,"ctx_6":[]}`;
    const parsed = parseCashTxTags(JSON.parse(rawText))!;
    expect(Object.keys(parsed.items).sort()).toEqual([T1, "ctx_4"].sort());
    expect(parsed.items.ctx_4).toEqual({ kind: "dividend" }); // 틀린 타입 필드만 뺀다
    expect(Object.keys(parsed.extras)).toEqual([]);           // 위험 키는 모르는 필드로도 싣지 않는다
    expect(({} as Record<string, unknown>).kind).toBeUndefined(); // 프로토타입 오염 0
    expect(Object.getPrototypeOf(parsed.items)).toBe(Object.prototype);
  });

  it("모르는 kind는 화면·합계에서 빠지지만 저장·병합·내보내기에서는 그대로 실린다(다음 버전 분류를 지우지 않는다)", () => {
    seed("A", { cashTransactions: [dep(T1, 50_000, "2026-11-20"), dep(T2, 30_000, "2026-10-15")] });
    localStorage.setItem(KEY, JSON.stringify({ v: 1, [T1]: { kind: "interest", rate: 3 }, [T2]: { kind: "dividend" } }));
    expect(tagsOf("A")).toEqual({ [T2]: { kind: "dividend" } });
    expect(sumOf("A").annual).toBe(30_000);
    expect(buildExportPayload().cashTxTags).toEqual({ v: 1, [T1]: { kind: "interest", rate: 3 }, [T2]: { kind: "dividend" } });
    putDividendTag(T3); // 사용자가 새로 저장해도 모르는 항목이 남는다
    expect(JSON.parse(raw("A")!)[T1]).toEqual({ kind: "interest", rate: 3 });
  });

  it("모르는 필드 보존: 항목 안·최상위 모두 읽기 → 병합 → 쓰기 → 내보내기를 지나도 남는다", () => {
    seed("A", { cashTransactions: [dep(T1, 50_000, "2026-11-20")] });
    localStorage.setItem(KEY, JSON.stringify({ v: 1, meta: { from: "5.2" }, [T1]: { kind: "dividend", taxWithheld: true } }));
    applyIncomingCashTxTags({ v: 1, [T2]: { kind: "dividend" } }, { merge: true, live: new Set([T1]) });
    const stored = JSON.parse(raw("A")!);
    expect(stored.meta).toEqual({ from: "5.2" });
    expect(stored[T1]).toEqual({ kind: "dividend", taxWithheld: true });
    expect(stored[T2]).toEqual({ kind: "dividend" });
    expect(buildExportPayload().cashTxTags).toEqual({ v: 1, meta: { from: "5.2" }, [T1]: { kind: "dividend", taxWithheld: true } });
    expect(tagsOf("A")).toEqual({ [T1]: { kind: "dividend" } }); // 화면에는 아는 필드만
  });

  it("맵에 금액·날짜·수량이 들어가지 않는다(쓰기 함수가 받지 않는다)", () => {
    seed("A");
    addDividend("A", dep(T1, 123_456_789, "2026-11-20", { memo: "비밀메모" }), { ticker: "005930", name: "삼성전자" });
    const text = raw("A")!;
    expect(JSON.parse(text)).toEqual({ v: 1, [T1]: { kind: "dividend", ticker: "005930", stockName: "삼성전자" } });
    for (const leak of ["123456789", "2026-11-20", "비밀메모", "amount", "date", "k1"]) expect(text).not.toContain(leak);
    expect(Object.keys(serializeCashTxTags(parseCashTxTags(JSON.parse(text))!)[T1] as object).sort()).toEqual(["kind", "stockName", "ticker"]);
  });

  it("쓰기 실패는 throw(호출측이 거래 저장을 중단한다), id가 ctx_ 접두가 아니면 쓰지 않는다", () => {
    expect(() => putDividendTag("__proto__")).toThrow();
    expect(() => putDividendTag("tx_1")).toThrow();
    expect(localStorage.getItem(KEY)).toBeNull();
    const full = memoryStorage();
    Object.defineProperty(full, "setItem", { value: () => { throw new Error("QuotaExceededError"); } });
    g.localStorage = full;
    expect(() => putDividendTag(T1)).toThrow();
  });
});

describe("T9 엔진 불변: 표시 유무로 원인 전 행·순자산·공유 토큰 동일", () => {
  const snap = (month: string, date: string, cash: number): MonthlyAssetSnapshot => ({
    month, date, netAsset: cash, financialAsset: cash,
    breakdown: { realEstate: 0, stocks: 0, crypto: 0, cash, loans: 0, tenantDeposit: 0 },
    fx: { ...RATES }, fxBase: { USD: 0, JPY: 0 },
    cost: { total: cash, stock: 0, crypto: 0, realEstate: 0 },
  });
  const LIVE = { date: "2026-10-28", _date: "2026-10-28", _display: "2026-10-28", netAsset: 0, financialAsset: 0 } as unknown as Parameters<typeof computeSettlementCauses>[0]["live"];
  const S = snap("2026-09", "2026-09-30", 10_000_000);
  const E = snap("2026-10", "2026-10-28", 13_000_000);
  // #293 기록만(미반영) 입금 + 반영 입금 + 출금 — 배당으로 적는 대상이 기록만일 때도 income 이동 한도가 같아야 한다
  const txs = () => [
    dep(T1, 2_000_000, "2026-10-10", { reflected: false, reflectedAt: undefined, reflectionId: undefined }),
    dep(T2, 1_000_000, "2026-10-12"),
    dep(T3, 400_000, "2026-10-20", { type: "withdrawal" }),
  ];
  const run = () => {
    const assetData = getAssetData();
    const { mapped, estimatedLabel, cashTracked } = computeSettlementCauses({
      start: S, end: E, live: LIVE, deltaNet: E.netAsset - S.netAsset, startDate: S.date!, endDate: E.date!,
      liveCash: 0, exchangeHistory: {}, assetData, rates: RATES,
    });
    return { assetData, mapped, estimatedLabel, cashTracked, year: groupYearSettlement(mapped), net: assetData.cash.reduce((s, c) => s + c.balance, 0) };
  };

  it("배당 표시를 붙이기 전·후로 엔진 입력(assetData)과 원인 행(홈·월·연 공용)·연 묶음·순자산이 한 값도 다르지 않다", async () => {
    seed("A", { cash: [acct("k1", 13_000_000)], cashTransactions: txs() });
    const plain = run();
    const plainToken = await generateShareToken(plain.assetData, RATES);
    expect(plain.mapped.causes.length).toBeGreaterThan(0);

    putDividendTag(T1, { ticker: "005930", name: "삼성전자" }); // 기록만 입금을 배당으로
    putDividendTag(T2);
    const tagged = run();
    expect(tagged.assetData).toEqual(plain.assetData);
    expect(tagged.mapped).toEqual(plain.mapped);
    expect(tagged.year).toEqual(plain.year);
    expect(tagged.estimatedLabel).toBe(plain.estimatedLabel);
    expect(tagged.cashTracked).toBe(plain.cashTracked);
    expect(tagged.net).toBe(plain.net);
    expect(await generateShareToken(tagged.assetData, RATES)).toBe(plainToken);
    expect(plainToken.length).toBeGreaterThan(10);
    expect(sumOf("A").annual).toBe(3_000_000); // 표시는 읽히고 있다(빈 비교가 아님)
  });

  it("결산·성적표·스냅샷·공유 토큰 모듈은 분류 표시를 읽지 않는다(import 0)", () => {
    const read = (p: string) => readFileSync(path.resolve(__dirname, "../..", p), "utf8");
    for (const f of [
      "lib/report/settlement.ts", "lib/report/year-settlement.ts", "lib/report/asset-report.ts", "lib/report/home-today.ts", "lib/report/asset-grade.ts",
      "lib/asset/snapshot-storage.ts", "lib/finance/dividend-calc.ts", "lib/trade/cash-tx-utils.ts", "types/transaction.ts", "types/asset.ts",
      "app/(main)/_components/views/activity/change-hero.tsx",
    ]) {
      expect(read(f)).not.toMatch(/cash-tx-tags|cashTxTags|received-dividend/);
    }
    // 공유 토큰(packV7·unpackV7)은 asset-storage 안 — 표시를 다루는 곳은 내보내기·수신 2곳뿐
    expect(read("lib/asset/asset-storage.ts").match(/CashTxTags/g)).toHaveLength(4);
  });
});

describe("T10 서버 평문 body 키 4개 불변, GA에 금액·종목 0", () => {
  it("push 요청 body의 평문 키는 iv·ciphertext·baseVersion·pubKey뿐이고 표시·종목·금액이 평문으로 나가지 않는다", async () => {
    seed("A");
    addDividend("A", dep(T1, 123_456_789, "2026-11-20"), { ticker: "SCHD", name: "비밀배당주" });
    await push("A");
    const call = (g.fetch as ReturnType<typeof vi.fn>).mock.calls.find((c) => c[1]?.method === "PUT")!;
    expect(Object.keys(JSON.parse(call[1].body)).sort()).toEqual(["baseVersion", "ciphertext", "iv", "pubKey"]);
    for (const leak of ["비밀배당주", "SCHD", "123456789", "cashTxTags", "dividend", T1]) expect(call[1].body).not.toContain(leak);
    expect(JSON.stringify(call[1].headers ?? {})).not.toContain("dividend");
    // 암호문 안에는 실려 있다(E2EE)
    expect((await serverPayload()).cashTxTags).toEqual({ v: 1, [T1]: { kind: "dividend", ticker: "SCHD", stockName: "비밀배당주" } });
  });

  it("GA는 category 1개만 보낸다(금액·종목·계좌 없음)", () => {
    const gtag = vi.fn();
    const w = globalThis as unknown as { gtag?: unknown; location?: unknown };
    w.gtag = gtag;
    w.location = { origin: "https://secretasset.test", pathname: "/", search: "" };
    try {
      track("feature_use", { category: "cash_dividend" });
      expect(gtag).toHaveBeenCalledTimes(1);
      const [, name, payload] = gtag.mock.calls[0] as [string, string, Record<string, unknown>];
      expect(name).toBe("feature_use");
      expect(Object.keys(payload).sort()).toEqual(["page_location", "page_title"]);
      expect(payload.page_title).toBe("현금·배당 입금 기록");
    } finally {
      delete w.gtag; delete w.location;
    }
  });
});

describe("T11 체험 모드 격리, 모듈 캐시 0", () => {
  it("저장소를 메모리로 바꾸면 원본 표시가 보이지 않고, 체험 안의 기록은 원본에 쓰이지 않는다", () => {
    seed("A");
    addDividend("A", dep(T1, 50_000, "2026-11-20"));
    const original = dev.A;
    const originalText = original.getItem(KEY);
    expect(sumOf("A").annual).toBe(50_000);

    // 체험 진입 = 전역 localStorage 교체(trial-boot의 메모리 Storage)
    g.localStorage = createMemoryStorage();
    expect(readCashTxTagsState().state).toBe("none"); // 직전에 읽은 값을 모듈이 들고 있지 않다
    saveAssetData({ ...empty(), cash: [acct()] });
    putDividendTag(T2, { name: "체험 종목" });
    const d = getAssetData();
    saveAssetData({ ...d, cashTransactions: [dep(T2, 7_000, "2026-11-21")] });
    expect(sumReceivedDividend(getAssetData().cashTransactions, readDividendTags(getAssetData().cashTransactions), 2026, mul).annual).toBe(7_000);
    expect(original.getItem(KEY)).toBe(originalText); // 원본 쓰기 0

    // 체험 종료 = 원본 저장소로 복귀 — 체험 기록은 따라오지 않는다
    g.localStorage = original;
    expect(readDividendTags(getAssetData().cashTransactions)).toEqual({ [T1]: { kind: "dividend" } });
    expect(sumOf("A").annual).toBe(50_000);
  });

  it("저장 모듈에 모듈 수준 상태가 없다(소스 고정: let·캐시 Map 0)", () => {
    const src = readFileSync(path.resolve(__dirname, "../asset/cash-tx-tags.ts"), "utf8");
    expect(src).not.toMatch(/^let /m);
    expect(src).not.toMatch(/^const \w+ = new (Map|WeakMap)\(/m);
    expect(readFileSync(path.resolve(__dirname, "../../hooks/use-cash-tx-tags.ts"), "utf8")).not.toMatch(/^(let|const \w+ = new Map)/m);
  });
});

describe("받은 배당 합계(C150) — 달별 반올림 합 = 연 합계, 반영·기록만 모두, 외화는 지금 환율", () => {
  it("12개 달 값의 합이 연 합계와 같고, 작년 기록·출금·표시 없는 입금은 빠진다", () => {
    const txs = [
      dep("ctx_a", 50_000, "2026-11-20"),
      dep("ctx_b", 30_000, "2026-10-15", { reflected: false }),
      dep("ctx_c", 10.25, "2026-10-20", { currency: "USD" }),  // 14,350원
      dep("ctx_d", 1_234, "2026-03-02", { currency: "JPY" }),   // 11,106원
      dep("ctx_e", 0.333, "2026-03-05", { currency: "USD" }),   // 466.2원 — 달 합에서 한 번만 반올림
      dep("ctx_f", 99_999, "2025-12-30"),                       // 작년
      dep("ctx_g", 70_000, "2026-11-21", { type: "withdrawal" }),
      dep("ctx_h", 80_000, "2026-11-22"),                       // 표시 없음
    ];
    const tagged = Object.fromEntries(["ctx_a", "ctx_b", "ctx_c", "ctx_d", "ctx_e", "ctx_f", "ctx_g"].map((id) => [id, { kind: "dividend" }]));
    const r = sumReceivedDividend(txs, tagged, 2026, mul);
    expect(r.months[10]).toBe(50_000);
    expect(r.months[9]).toBe(44_350);
    expect(r.months[2]).toBe(Math.round(11_106 + 466.2));
    expect(r.months.reduce((s, v) => s + v, 0)).toBe(r.annual);
    expect(r.annual).toBe(50_000 + 44_350 + 11_572);
    expect(r.count).toBe(5);
    expect(r.months.every(Number.isInteger)).toBe(true);
  });
});
