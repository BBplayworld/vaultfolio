import { it } from "vitest";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { getAssetData, saveAssetData, buildExportPayload, applyImportedPayload, collectAssetIds, generateShareToken, parseShareToken } from "@/lib/asset/asset-storage";
import { deriveKeys, decryptPayload } from "@/lib/cloud-sync/crypto";
import { pullAsset, pushAsset } from "@/lib/cloud-sync/sync-client";
const AID = "qa-asset-id-abcdef012345";
function mem(init: Record<string,string>): Storage {
  const s: any = { ...init };
  const d = (k: string, v: unknown) => Object.defineProperty(s, k, { value: v, enumerable: false, writable: true, configurable: true });
  d("getItem", (k: string) => (k in s ? s[k] : null)); d("setItem", (k: string, v: string) => { s[k] = String(v); });
  d("removeItem", (k: string) => { delete s[k]; }); d("clear", () => { for (const k of Object.keys(s)) delete s[k]; });
  d("key", (i: number) => Object.keys(s)[i] ?? null); Object.defineProperty(s, "length", { get: () => Object.keys(s).length, enumerable: false });
  return s;
}
const g = globalThis as any;
it("dev", async () => {
  const st = JSON.parse(readFileSync(process.env.QA_STEP!, "utf8"));
  g.window = Object.assign(globalThis, { dispatchEvent: () => true });
  g.localStorage = mem(existsSync(st.inp) ? JSON.parse(readFileSync(st.inp, "utf8")) : {});
  g.fetch = async (_u: string, init?: any) => {
    const sv = JSON.parse(readFileSync(st.server, "utf8")); const j = (s: number, b: unknown) => ({ ok: s < 400, status: s, json: async () => b });
    if (init?.method === "PUT") { const b = JSON.parse(init.body); if (b.baseVersion !== sv.version) return j(409, { asset: { version: sv.version } });
      writeFileSync(st.server, JSON.stringify({ version: sv.version + 1, iv: b.iv, ciphertext: b.ciphertext })); return j(200, { version: sv.version + 1 }); }
    if (!sv.iv) return j(404, {}); return j(200, { asset: { iv: sv.iv, ciphertext: sv.ciphertext, version: sv.version } });
  };
  const keys = await deriveKeys("qa-pass-123!", AID); const a = st.args ?? {}; let result: any = null;
  switch (st.op) {
    case "seed": saveAssetData(a.data); break;
    case "link": { const L = await import("@/lib/trade/linked-record"); let data: any = getAssetData();
      for (const t of a.trades) { if (t.kind === "stock") data = { ...data, transactions: [...data.transactions, t.tx] }; else data = { ...data, cryptoTransactions: [...(data.cryptoTransactions ?? []), t.tx] };
        const b = L.buildLink(data, t.kind === "stock" ? L.stockLinkTrade(t.tx) : L.cryptoLinkTrade(t.tx), t.link, a.today); if (!b.ok) throw new Error("link " + b.reason); data = b.data; }
      result = { saved: saveAssetData(data) }; break; }
    case "mutate": { const x: any = getAssetData(); const f = new Function("x", a.code); f(x); result = { saved: saveAssetData(x) }; break; }
    case "revert": { const L = await import("@/lib/trade/linked-record"); const x: any = getAssetData(); x.transactions = x.transactions.filter((t: any) => t.id !== a.txId); x.cryptoTransactions = (x.cryptoTransactions ?? []).filter((t: any) => t.id !== a.txId);
      const r = L.removeLink(x, a.txId); saveAssetData(r.data); result = { plan: r.plan }; break; }
    case "push": result = await pushAsset(AID, keys); break;
    case "pull": result = await pullAsset(AID, keys); break;
    case "srv": { const sv = JSON.parse(readFileSync(st.server, "utf8")); const p: any = await decryptPayload({ iv: sv.iv, ciphertext: sv.ciphertext }, keys.encKey); const ad = p.assetData ?? p.data ?? p; result = { keys: Object.keys(p), cashTx: (ad.cashTransactions ?? []).map((t: any) => t.id), loanTx: (ad.loanTransactions ?? []).map((t: any) => t.id), tx: (ad.transactions ?? []).map((t: any) => t.id), cryptoTx: (ad.cryptoTransactions ?? []).map((t: any) => t.id), cash: (ad.cash ?? []).map((c: any) => [c.id, c.balance]), loans: (ad.loans ?? []).map((c: any) => [c.id, c.balance]) }; break; }
    case "export": writeFileSync(a.out, JSON.stringify(buildExportPayload())); break;
    case "importReplace": applyImportedPayload(JSON.parse(readFileSync(a.file, "utf8"))); break;
    case "importMerge": applyImportedPayload(JSON.parse(readFileSync(a.file, "utf8")), { syncedIds: new Set(collectAssetIds(getAssetData())) }); break;
    case "token": { const tok = generateShareToken(getAssetData()); const p: any = parseShareToken(tok); result = { cashTx: p.data.cashTransactions.map((c: any) => c.id), loanTx: p.data.loanTransactions.map((c: any) => c.id), cash: p.data.cash.map((c: any) => c.balance), loans: p.data.loans.map((c: any) => c.balance), tx: p.data.transactions.length }; break; }
    case "rawkey": result = { raw: g.localStorage.getItem(a.key) }; break;
    case "dump": break;
  }
  const x: any = getAssetData();
  writeFileSync(st.outp, JSON.stringify(Object.fromEntries(Object.keys(g.localStorage).map((k) => [k, g.localStorage.getItem(k)]))));
  writeFileSync(st.out, JSON.stringify({ result, sum: { tx: x.transactions.map((t: any) => t.id).sort(), ctx: (x.cryptoTransactions ?? []).map((t: any) => t.id).sort(), cashTx: x.cashTransactions.map((t: any) => t.id).sort(), loanTx: x.loanTransactions.map((t: any) => t.id).sort(), cash: x.cash.map((c: any) => [c.id, c.balance]), loans: x.loans.map((l: any) => [l.id, l.balance]) }, full: x }));
});
