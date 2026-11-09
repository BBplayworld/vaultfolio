// 일회성 하네스 장치 러너 — 구/신 트리 공통. 저장소에 커밋하지 않음. env H_STEP = step JSON 경로
import { it } from "vitest";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { getAssetData, saveAssetData, buildExportPayload, applyImportedPayload, collectAssetIds } from "@/lib/asset/asset-storage";
import { deriveKeys } from "@/lib/cloud-sync/crypto";
import { pullAsset, pushAsset } from "@/lib/cloud-sync/sync-client";

const AID = "test-asset-id-1234567890";
function memoryStorage(init: Record<string, string>): Storage {
  const s = { ...init } as Record<string, string>;
  const def = (k: string, value: unknown) => Object.defineProperty(s, k, { value, enumerable: false, writable: true, configurable: true });
  def("getItem", (k: string) => (Object.prototype.hasOwnProperty.call(s, k) ? s[k] : null));
  def("setItem", (k: string, v: string) => { s[k] = String(v); });
  def("removeItem", (k: string) => { delete s[k]; });
  def("clear", () => { for (const k of Object.keys(s)) delete s[k]; });
  def("key", (i: number) => Object.keys(s)[i] ?? null);
  Object.defineProperty(s, "length", { get: () => Object.keys(s).length, enumerable: false });
  return s as unknown as Storage;
}
const g = globalThis as any;

it("device", async () => {
  const step = JSON.parse(readFileSync(process.env.H_STEP!, "utf8"));
  g.window = Object.assign(globalThis, { dispatchEvent: () => true });
  g.localStorage = memoryStorage(existsSync(step.storageIn) ? JSON.parse(readFileSync(step.storageIn, "utf8")) : {});
  const serverPath: string = step.server;
  g.fetch = async (_url: string, init?: { method?: string; body?: string }) => {
    const server = JSON.parse(readFileSync(serverPath, "utf8"));
    const json = (status: number, body: unknown) => ({ ok: status < 400, status, json: async () => body });
    if (init?.method === "PUT") {
      const b = JSON.parse(init.body as string);
      if (b.baseVersion !== server.version) return json(409, { asset: { version: server.version } });
      writeFileSync(serverPath, JSON.stringify({ version: server.version + 1, iv: b.iv, ciphertext: b.ciphertext }));
      return json(200, { version: server.version + 1 });
    }
    if (!server.iv) return json(404, {});
    return json(200, { asset: { iv: server.iv, ciphertext: server.ciphertext, version: server.version } });
  };
  const keys = await deriveKeys("test-pass-123!", AID);
  const a = step.args ?? {};
  let result: unknown = null;
  const d = () => getAssetData();
  switch (step.op) {
    case "seed": saveAssetData(a.data); break;
    case "newLinked": {
      const L = await import("@/lib/trade/linked-record");
      let data = d();
      for (const t of a.trades) {
        if (t.kind === "stock") data = { ...data, transactions: [...data.transactions, t.tx] };
        else data = { ...data, cryptoTransactions: [...(data.cryptoTransactions ?? []), t.tx] };
        const lt = t.kind === "stock" ? L.stockLinkTrade(t.tx) : L.cryptoLinkTrade(t.tx);
        const b = L.buildLink(data, lt, t.link, a.today);
        if (!b.ok) throw new Error(b.reason);
        data = b.data;
      }
      result = { saved: saveAssetData(data) };
      break;
    }
    case "push": result = await pushAsset(AID, keys); break;
    case "pull": result = await pullAsset(AID, keys); break;
    case "editOther": { const x = d(); x.stocks[0].description = a.text; saveAssetData(x); break; }
    case "editBalance": { const x = d(); x.cash[0].balance = a.balance; saveAssetData(x); break; }
    case "deleteTradeOnly": { // 구 deleteTransactionWithPosition: 거래 filter + 보유 롤백 patch (되돌림 없음)
      const x = d(); x.transactions = x.transactions.filter((t: any) => t.id !== a.txId); saveAssetData(x); break;
    }
    case "deleteLinkRecOnly": { // 구 deleteCashTransactionWithBalance: 기록 filter + 잔액 역가감(Math.max 0)
      const x = d(); const rec = x.cashTransactions.find((c: any) => c.id === a.recId);
      x.cashTransactions = x.cashTransactions.filter((c: any) => c.id !== a.recId);
      x.cash = x.cash.map((c: any) => c.id === rec.cashId ? { ...c, balance: Math.max(0, c.balance + (rec.type === "deposit" ? -rec.amount : rec.amount)) } : c);
      saveAssetData(x); break;
    }
    case "newDeleteRevert": {
      const L = await import("@/lib/trade/linked-record");
      const x = d(); x.transactions = x.transactions.filter((t: any) => t.id !== a.txId);
      const r = L.removeLink(x, a.txId); saveAssetData(r.data); result = { plan: r.plan }; break;
    }
    case "export": writeFileSync(a.out, JSON.stringify(buildExportPayload())); break;
    case "importReplace": applyImportedPayload(JSON.parse(readFileSync(a.file, "utf8"))); break;
    case "importMerge": applyImportedPayload(JSON.parse(readFileSync(a.file, "utf8")), { syncedIds: new Set(collectAssetIds(d())) }); break;
    case "reserialize": saveAssetData(d()); break; // 롤백 코드가 짝 기록을 재저장
    case "token": {
      const S = await import("@/lib/asset/asset-storage");
      const tok = S.generateShareToken(d()); const parsed: any = S.parseShareToken(tok); result = { data: parsed?.data ? { cashTx: parsed.data.cashTransactions, loanTx: parsed.data.loanTransactions, cash: parsed.data.cash, loans: parsed.data.loans, tx: parsed.data.transactions } : null }; break;
    }
    case "dump": break;
  }
  const x = d();
  writeFileSync(step.storageOut, JSON.stringify(Object.fromEntries(Object.keys(g.localStorage).map((k) => [k, g.localStorage.getItem(k)]))));
  writeFileSync(step.out, JSON.stringify({ result, summary: {
    tx: x.transactions.map((t: any) => t.id), cryptoTx: (x.cryptoTransactions ?? []).map((t: any) => t.id),
    cashTx: x.cashTransactions.map((t: any) => t.id), loanTx: x.loanTransactions.map((t: any) => t.id),
    cash: x.cash.map((c: any) => [c.id, c.balance]), loans: x.loans.map((l: any) => [l.id, l.balance]),
  } }));
});
