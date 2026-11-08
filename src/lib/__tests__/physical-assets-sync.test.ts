// #58 실물 자산 — A(신)/B(구, 4.53 로직 사본) 동기화 순환 하네스: push → pull → 저장 → push (spec 10절 4, 13절 24-①)
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getAssetData, saveAssetData } from "../asset/asset-storage";
import { decryptPayload, deriveKeys, encryptPayload, type AssetKeys } from "../cloud-sync/crypto";
import { pullAsset, pushAsset } from "../cloud-sync/sync-client";
import { getVersion, markSynced } from "../cloud-sync/sync-state";
import { STORAGE_KEYS } from "../local-storage";
import { emptyData, g, gold, legacy, memoryStorage } from "./physical-fixtures";

const AID = "test-asset-id-1234567890";
interface Server { version: number; iv?: string; ciphertext?: string }
let server: Server;
let keys: AssetKeys;
const dev = { A: memoryStorage(), B: memoryStorage(), C: memoryStorage() };
type Name = keyof typeof dev;
const on = (n: Name) => { g.localStorage = dev[n]; };
const phys = (n: Name) => { on(n); return JSON.parse(localStorage.getItem(STORAGE_KEYS.physicalAssets) ?? "null"); };
const ids = (n: Name) => { const v = phys(n); return v ? v.map((p: { id: string }) => p.id).sort() : v; };

// 신버전 기기(A·C)는 실제 pushAsset/pullAsset, 구버전 기기(B)는 4.53 로직 사본 + 같은 서버 모의
const push = async (n: Name) => { on(n); return pushAsset(AID, keys); };
const pull = async (n: Name) => { on(n); return pullAsset(AID, keys); };
async function oldPush() {
  on("B");
  const blob = await encryptPayload(legacy.buildPayload(), keys.encKey);
  const baseVersion = getVersion();
  if (baseVersion !== server.version) return "conflict" as const;
  server = { version: server.version + 1, iv: blob.iv, ciphertext: blob.ciphertext };
  markSynced(server.version);
  return "ok" as const;
}
async function oldPull() {
  on("B");
  const payload = await decryptPayload({ iv: server.iv!, ciphertext: server.ciphertext! }, keys.encKey);
  legacy.applyImport(payload);
  markSynced(server.version);
}

beforeEach(async () => {
  g.window = globalThis;
  dev.A = memoryStorage(); dev.B = memoryStorage(); dev.C = memoryStorage();
  server = { version: 0 };
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-08T03:00:00Z"));
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

const addPhys = (n: Name, ...items: ReturnType<typeof gold>[]) => {
  on(n);
  const d = getAssetData();
  saveAssetData({ ...d, physicalAssets: [...(d.physicalAssets ?? []), ...items] });
};
const delPhys = (n: Name, id: string) => {
  on(n);
  const d = getAssetData();
  saveAssetData({ ...d, physicalAssets: (d.physicalAssets ?? []).filter((p) => p.id !== id) });
};

describe("A(신) / B(구) 순환", () => {
  it("구버전 기기가 pull·저장·push해도(payload에 실물 키 없음) A의 실물은 유지된다", async () => {
    addPhys("A", gold("P1"));
    expect((await push("A")).status).toBe("ok");
    await oldPull();                       // B: 오류 없이 실물만 버린다(strip)
    on("B");
    expect(legacy.read()).not.toHaveProperty("physicalAssets");
    legacy.save({ ...legacy.read(), nickname: "B가 수정" });
    expect(await oldPush()).toBe("ok");   // 키 없는 payload
    expect((await pull("A")).status).toBe("ok");
    expect(ids("A")).toEqual(["P1"]);     // 로컬 유지
    expect(getAssetData().nickname).toBe("B가 수정"); // 나머지는 정상 반영
  });
  it("B 기기에서 실물이 남는다(분리 키): 롤백 중 pull이 와도 지워지지 않고, 신버전 복귀 시 보인다", async () => {
    addPhys("B", gold("PB"));              // 신버전이던 B가 실물을 가졌다가
    legacy.save(legacy.read());            // 롤백(구버전)
    await (async () => { addPhys("A", gold("P1")); await push("A"); })();
    await oldPull();                       // 구버전 pull = clearAssetData
    expect(ids("B")).toEqual(["PB"]);
  });
  it("동시 추가: 두 신버전 기기의 항목이 모두 남는다", async () => {
    addPhys("A", gold("P0"));
    expect((await push("A")).status).toBe("ok");
    expect((await pull("C")).status).toBe("ok");
    addPhys("A", gold("PA"));
    addPhys("C", gold("PC"));
    expect((await push("A")).status).toBe("ok");
    expect((await push("C")).status).toBe("conflict");
    expect((await pull("C")).status).toBe("ok"); // 병합: PC 보존
    expect(ids("C")).toEqual(["P0", "PA", "PC"]);
    expect((await push("C")).status).toBe("ok");
    expect((await pull("A")).status).toBe("ok");
    expect(ids("A")).toEqual(["P0", "PA", "PC"]);
  });
  it("삭제 전파: 한 기기에서 지우면 다른 기기 pull 후 반영된다(되살아나지 않음)", async () => {
    addPhys("A", gold("P1"), gold("P2"));
    await push("A");
    await pull("C");
    expect(ids("C")).toEqual(["P1", "P2"]);
    delPhys("A", "P1");
    expect((await push("A")).status).toBe("ok");
    expect((await pull("C")).status).toBe("ok");
    expect(ids("C")).toEqual(["P2"]);
  });
  it("[] 와 키 없음의 구분: 전부 지운 [] 는 전파되고, 키 없는 payload는 로컬을 지우지 않는다", async () => {
    addPhys("A", gold("P1"));
    await push("A");
    await pull("C");
    delPhys("A", "P1");
    await push("A");
    await pull("C");
    expect(phys("C")).toEqual([]);
    // 키 없는 payload(구버전 B가 push) → 신버전 기기는 [] 그대로, 새 항목을 만들지 않음
    await oldPull();
    await oldPush();
    await pull("C");
    expect(phys("C")).toEqual([]);
  });
  it("실물을 한 번도 안 가진 기기끼리는 분리 키가 생기지 않는다", async () => {
    saveAssetData({ ...emptyData(), nickname: "x" });
    await push("A");
    await pull("C");
    expect(phys("C")).toBeNull();
    expect(phys("A")).toBeNull();
  });
  it("서버 요청 body의 평문 키는 iv·ciphertext·baseVersion·pubKey뿐이다(실물 값이 평문으로 나가지 않는다)", async () => {
    addPhys("A", gold("P1", { name: "비밀금괴", currentValue: 123456789 }));
    await push("A");
    const call = (g.fetch as ReturnType<typeof vi.fn>).mock.calls.find((c) => c[1]?.method === "PUT")!;
    expect(Object.keys(JSON.parse(call[1].body)).sort()).toEqual(["baseVersion", "ciphertext", "iv", "pubKey"]);
    expect(call[1].body).not.toContain("비밀금괴");
    expect(call[1].body).not.toContain("123456789");
  });
});
