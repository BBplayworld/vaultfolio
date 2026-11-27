// QA 임시 — 실제 main(1d015dfa) 코드와 실제 5.166 코드를 번갈아 실행하는 혼재 동기화·백업·롤백 재현. 상태는 파일로 넘긴다.
import { appendFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { expect, it, vi } from "vitest";
import { applyImportedPayload, buildExportPayload, clearAssetData, getAssetData, saveAssetData } from "../asset/asset-storage";
import { decryptPayload, deriveKeys } from "../cloud-sync/crypto";
import { pullAsset, pushAsset } from "../cloud-sync/sync-client";
import { g, memoryStorage } from "./physical-fixtures";

const DIR = process.env.QA_STATE!;
const STEP = process.env.QA_STEP!;
const KEY = "secretasset.cash_tx_tags";
const AID = "qa-asset-id-1234567890";
const f = (n: string) => `${DIR}/${n}.json`;
const rd = (n: string) => (existsSync(f(n)) ? JSON.parse(readFileSync(f(n), "utf8")) : null);
const wr = (n: string, v: unknown) => writeFileSync(f(n), JSON.stringify(v, null, 1));
let server: { version: number; iv?: string; ciphertext?: string } = rd("server") ?? { version: 0 };
const bodies: string[] = [];
function load(dev: string) { const s = memoryStorage(); const d = rd(`dev-${dev}`) ?? {}; for (const [k, v] of Object.entries(d)) s.setItem(k, v as string); g.localStorage = s; }
function save(dev: string) { const o: Record<string, string> = {}; for (const k of Object.keys(localStorage)) o[k] = localStorage.getItem(k)!; wr(`dev-${dev}`, o); wr("server", server); }
const out = (k: string, v: unknown) => appendFileSync(`${DIR}/log.txt`, `QA ${STEP} | ${k} | ${JSON.stringify(v)}\n`);
const tx = (id: string, amount: number, date: string, over = {}) => ({ id, cashId: "k1", type: "deposit" as const, amount, currency: "KRW" as const, recurring: false, date, reflected: true, reflectedAt: `${date}T00:00:00.000Z`, reflectionId: `ref_${id}`, createdAt: `${date}T00:00:00.000Z`, ...over });
const T1 = "ctx_1764200000001_aaaaa", T2 = "ctx_1764200000002_bbbbb", T3 = "ctx_1764200000003_ccccc", TB = "ctx_1764200000009_oldbb";
const summary = () => { const d = getAssetData(); return { n: d.cashTransactions.length, ids: d.cashTransactions.map((t) => t.id).sort(), amt: d.cashTransactions.reduce((a, t) => a + t.amount, 0), bal: d.cash.map((c) => c.balance), nick: d.nickname, tagsRaw: localStorage.getItem(KEY) }; };
const serverPayload = async (keys: Awaited<ReturnType<typeof deriveKeys>>) => (await decryptPayload({ iv: server.iv!, ciphertext: server.ciphertext! }, keys.encKey)) as Record<string, unknown>;

it(`mixed step ${STEP}`, async () => {
  g.window = Object.assign(globalThis, { dispatchEvent: () => true }) as never;
  g.fetch = vi.fn(async (_u: string, init?: { method?: string; body?: string }) => {
    const json = (status: number, body: unknown) => ({ ok: status < 400, status, json: async () => body });
    if (init?.method === "PUT") { bodies.push(init.body as string); const b = JSON.parse(init.body as string); if (b.baseVersion !== server.version) return json(409, { asset: { version: server.version } }); server = { version: server.version + 1, iv: b.iv, ciphertext: b.ciphertext }; return json(200, { version: server.version }); }
    if (!server.iv) return json(404, {});
    return json(200, { asset: { iv: server.iv, ciphertext: server.ciphertext, version: server.version } });
  });
  const keys = await deriveKeys("qa-pass-123!", AID);
  const isNew = existsSync(`${__dirname}/../asset/cash-tx-tags.ts`);
  const modPath = "../asset/cash-tx-tags";
  const tags = isNew ? await import(/* @vite-ignore */ modPath) : null;
  const sumMod = isNew ? await import(/* @vite-ignore */ "../finance/received-dividend") : null;
  const divSum = () => { if (!tags || !sumMod) return null; const d = getAssetData(); const r = sumMod.sumReceivedDividend(d.cashTransactions, tags.readDividendTags(d.cashTransactions), 2026, () => 1); return { annual: r.annual, count: r.count, live: Object.keys(tags.readDividendTags(d.cashTransactions)).sort() }; };
  out("codebase", isNew ? "NEW(5.166)" : "OLD(main)");
  switch (STEP) {
    case "1-newA-create-push": {
      expect(isNew).toBe(true); load("A");
      saveAssetData({ ...getAssetData(), cash: [{ id: "k1", type: "bank", name: "예금", balance: 3_000_000, currency: "KRW" }] } as never);
      for (const [t, stock] of [[tx(T1, 50_000, "2026-11-20"), { ticker: "005930", name: "삼성전자" }], [tx(T2, 7_000, "2026-03-10", { reflected: false, reflectedAt: undefined, reflectionId: undefined }), undefined]] as const) {
        tags!.putDividendTag(t.id, stock as never); const d = getAssetData(); expect(saveAssetData({ ...d, cashTransactions: [...d.cashTransactions, t] } as never)).toBe(true);
      }
      { const d = getAssetData(); saveAssetData({ ...d, cashTransactions: [...d.cashTransactions, tx(T3, 999, "2026-11-21")] } as never); }
      const r = await pushAsset(AID, keys); out("push", r); expect(r.status).toBe("ok");
      const p = await serverPayload(keys); out("serverTopKeys", Object.keys(p)); out("serverTags", p.cashTxTags);
      const body = JSON.parse(bodies[0]); out("bodyKeys", Object.keys(body)); expect(Object.keys(body).sort()).toEqual(["baseVersion", "ciphertext", "iv", "pubKey"]);
      for (const needle of ["dividend", "cashTxTags", "005930", "삼성전자", "50000", "ctx_"]) expect(bodies[0].includes(needle)).toBe(false);
      out("A", summary()); out("A sum", divSum()); save("A"); break;
    }
    case "2-oldB-pull-edit-push": {
      expect(isNew).toBe(false); load("B");
      const r = await pullAsset(AID, keys); out("pull", r); expect(r.status).toBe("ok");
      out("B after pull", summary()); expect(localStorage.getItem(KEY)).toBeNull();
      const d = getAssetData(); expect(d.cashTransactions.map((t) => [t.id, t.amount, t.type, t.reflected])).toEqual([[T1, 50_000, "deposit", true], [T2, 7_000, "deposit", false], [T3, 999, "deposit", true]]);
      out("B record keys", d.cashTransactions.map((t) => Object.keys(t).sort().join(",")));
      saveAssetData({ ...d, nickname: "구기기B", cashTransactions: [...d.cashTransactions, tx(TB, 1234, "2026-11-22")] } as never);
      const p = await pushAsset(AID, keys); out("push", p); expect(p.status).toBe("ok");
      const sp = await serverPayload(keys); out("serverTopKeys", Object.keys(sp)); expect(sp).not.toHaveProperty("cashTxTags");
      save("B"); break;
    }
    case "3-newA-pull-repush": {
      expect(isNew).toBe(true); load("A"); const before = localStorage.getItem(KEY);
      const r = await pullAsset(AID, keys); out("pull", r); expect(r).toMatchObject({ status: "ok", mergedAdditions: true });
      expect(localStorage.getItem(KEY)).toBe(before); out("A", summary()); out("A sum", divSum());
      expect(getAssetData().cashTransactions.map((t) => t.id).sort()).toEqual([T1, T2, T3, TB].sort());
      expect(divSum()).toEqual({ annual: 57_000, count: 2, live: [T1, T2] });
      const p = await pushAsset(AID, keys); out("repush", p); expect(p.status).toBe("ok");
      const sp = await serverPayload(keys); out("serverTags", sp.cashTxTags); expect(sp.cashTxTags).toEqual({ v: 1, [T1]: { kind: "dividend", ticker: "005930", stockName: "삼성전자" }, [T2]: { kind: "dividend" } });
      const again = await pullAsset(AID, keys); out("pull again", again); expect(again).toMatchObject({ status: "ok", mergedAdditions: false });
      save("A");
      load("C"); const c = await pullAsset(AID, keys); out("C fresh pull", c); expect(c).toMatchObject({ status: "ok", mergedAdditions: false }); out("C sum", divSum()); expect(divSum()).toEqual({ annual: 57_000, count: 2, live: [T1, T2] }); save("C"); break;
    }
    case "4-oldB-pull-delete-tagged-push": {
      expect(isNew).toBe(false); load("B");
      const r = await pullAsset(AID, keys); out("pull", r); expect(r.status).toBe("ok"); out("B", summary());
      expect(getAssetData().cashTransactions.length).toBe(4);
      const d = getAssetData(); saveAssetData({ ...d, cashTransactions: d.cashTransactions.filter((t) => t.id !== T2) } as never);
      const p = await pushAsset(AID, keys); out("push", p); expect(p.status).toBe("ok"); save("B"); break;
    }
    case "5-newA-pull-after-old-delete": {
      expect(isNew).toBe(true); load("A");
      const r = await pullAsset(AID, keys); out("pull", r); out("A", summary()); out("A sum", divSum());
      expect(getAssetData().cashTransactions.map((t) => t.id).sort()).toEqual([T1, T3, TB].sort());
      expect(divSum()).toEqual({ annual: 50_000, count: 1, live: [T1] });
      expect(JSON.parse(localStorage.getItem(KEY)!)[T2]).toEqual({ kind: "dividend" }); // 고아는 남는다
      if (r.status === "ok" && r.mergedAdditions) { const p = await pushAsset(AID, keys); out("repush", p); }
      const sp = await serverPayload(keys); out("serverTags", sp.cashTxTags); expect(sp.cashTxTags).toEqual({ v: 1, [T1]: { kind: "dividend", ticker: "005930", stockName: "삼성전자" } });
      const again = await pullAsset(AID, keys); expect(again).toMatchObject({ status: "ok", mergedAdditions: false });
      save("A");
      load("C"); const c = await pullAsset(AID, keys); out("C pull", c); out("C", summary()); out("C sum", divSum()); expect(divSum()).toEqual({ annual: 50_000, count: 1, live: [T1] });
      expect(c).toMatchObject({ status: "ok", mergedAdditions: false }); // 고아 차이로 반복하지 않는다
      save("C"); break;
    }
    case "6-old-rollback-on-A": {
      expect(isNew).toBe(false); load("A"); const before = localStorage.getItem(KEY);
      out("A read by OLD", summary()); expect(getAssetData().cashTransactions.length).toBe(3);
      const r = await pullAsset(AID, keys); out("old pull on A", r);
      clearAssetData(); expect(localStorage.getItem(KEY)).toBe(before); // 구버전 clearAssetData가 새 키를 지우지 않는다
      await pullAsset(AID, keys).catch(() => null);
      const sp = await serverPayload(keys); applyImportedPayload(sp); out("A after old import", summary());
      const d = getAssetData(); saveAssetData({ ...d, nickname: "롤백 중 편집" } as never);
      const p = await pushAsset(AID, keys); out("old push from rolled-back A", p);
      expect(localStorage.getItem(KEY)).toBe(before); save("A"); break;
    }
    case "7-new-redeploy-on-A": {
      expect(isNew).toBe(true); load("A");
      out("A read by NEW after rollback", summary()); out("A sum", divSum()); expect(divSum()).toEqual({ annual: 50_000, count: 1, live: [T1] });
      const r = await pullAsset(AID, keys); out("pull", r);
      if (r.status === "ok" && r.mergedAdditions) { const p = await pushAsset(AID, keys); out("repush", p); }
      const sp = await serverPayload(keys); out("serverTags", sp.cashTxTags); expect(sp.cashTxTags).toBeDefined();
      wr("backup-new", buildExportPayload()); out("backup-new top keys", Object.keys(buildExportPayload())); save("A"); break;
    }
    case "8-old-import-new-backup-export": {
      expect(isNew).toBe(false); load("D");
      applyImportedPayload(rd("backup-new")); out("D(old) after import of new backup", summary());
      expect(getAssetData().cashTransactions.map((t) => [t.id, t.amount])).toEqual(rd("backup-new").assetData.cashTransactions.map((t: { id: string; amount: number }) => [t.id, t.amount]));
      wr("backup-old", buildExportPayload()); out("backup-old top keys", Object.keys(buildExportPayload())); save("D"); break;
    }
    case "9-new-import-old-backup": {
      expect(isNew).toBe(true);
      load("A"); const before = localStorage.getItem(KEY); applyImportedPayload(rd("backup-old")); out("A after importing old backup", summary()); out("A sum", divSum());
      expect(localStorage.getItem(KEY)).toBe(before); expect(divSum()).toEqual({ annual: 50_000, count: 1, live: [T1] });
      load("E"); applyImportedPayload(rd("backup-old")); out("E(fresh) after old backup", summary()); out("E sum", divSum()); expect(divSum()).toEqual({ annual: 0, count: 0, live: [] }); expect(summary().amt).toBe(rd("backup-new").assetData.cashTransactions.reduce((a: number, t: { amount: number }) => a + t.amount, 0));
      load("F"); applyImportedPayload(rd("backup-new")); out("F(fresh) after new backup", summary()); expect(divSum()).toEqual({ annual: 50_000, count: 1, live: [T1] }); expect(buildExportPayload().cashTxTags).toEqual(rd("backup-new").cashTxTags);
      // id 합집합: 로컬에만 있는 표시 + 백업의 표시
      load("G"); localStorage.setItem(KEY, JSON.stringify({ v: 1, ctx_local_only_1: { kind: "dividend", stockName: "로컬" }, [T1]: { kind: "dividend" } }));
      applyImportedPayload(rd("backup-new")); out("G union raw", localStorage.getItem(KEY));
      const gk = JSON.parse(localStorage.getItem(KEY)!); expect(Object.keys(gk).sort()).toEqual(["ctx_local_only_1", T1, "v"].sort()); expect(gk[T1]).toEqual({ kind: "dividend", ticker: "005930", stockName: "삼성전자" });
      break;
    }
    default: return;
  }
});
