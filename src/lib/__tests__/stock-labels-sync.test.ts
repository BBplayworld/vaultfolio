// #239 [5.125] 내 자산 불리기 — 동기화 순환(AC-18, AC-19 ③⑤). A·C = 신버전(실제 pushAsset/pullAsset), B = 구버전(4.53 로직 사본)
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getAssetData, saveAssetData } from "../asset/asset-storage";
import {
  applyIncomingStockLabels, emptyStockLabels, markStockChecked, readStockLabels, setStockLabel, setStockLabelCycle, writeStockLabels,
  type StockLabelCycleMonths, type StockLabelKind,
} from "../asset/stock-labels";
import { decryptPayload, deriveKeys, encryptPayload, type AssetKeys } from "../cloud-sync/crypto";
import { pullAsset, pushAsset } from "../cloud-sync/sync-client";
import { getVersion, markSynced } from "../cloud-sync/sync-state";
import { STORAGE_KEYS } from "../local-storage";
import { cashItem, g, legacy, memoryStorage } from "./physical-fixtures";

const AID = "test-asset-id-1234567890";
interface Server { version: number; iv?: string; ciphertext?: string }
let server: Server;
let keys: AssetKeys;
let putBodies: string[];
const dev = { A: memoryStorage(), B: memoryStorage(), C: memoryStorage() };
type Name = keyof typeof dev;
const on = (n: Name) => { g.localStorage = dev[n]; };
const at = (iso: string) => vi.setSystemTime(new Date(iso));
const now = () => new Date().toISOString();
const labelsOf = (n: Name) => { on(n); return readStockLabels(); };
const rawOf = (n: Name) => { on(n); return localStorage.getItem(STORAGE_KEYS.stockLabels); };

// 훅(use-stock-labels)의 저장 경로와 같은 순서: 저장소의 지금 값을 읽어 편집을 얹어 쓴다
// rich = 'base + 미래 필드' 픽스처로 같은 순환을 다시 돌린다(AC-31). 미래 필드는 그 항목과 최상위에 얹는다
let rich = false;
const RICH_BASE = { qty: 7.5, price: 123.4, priceAt: "2026-11-14", weight: 12.34, futureBase: { lots: [1] } };
const label = (n: Name, ticker: string, kind: StockLabelKind | null) => {
  on(n);
  let next = setStockLabel(readStockLabels(), ticker, kind, now(), rich ? RICH_BASE : undefined);
  if (rich && next.items[ticker]) {
    next = { ...next, futureTop: { from: "다음 버전" }, items: { ...next.items, [ticker]: { ...next.items[ticker], futureItem: ["x", 1] } } };
  }
  writeStockLabels(next);
};
const checked = (n: Name, ticker: string) => { on(n); writeStockLabels(markStockChecked(readStockLabels(), ticker, now())); };
const cycle = (n: Name, m: StockLabelCycleMonths) => { on(n); writeStockLabels(setStockLabelCycle(readStockLabels(), m, now())); };

const push = async (n: Name) => { on(n); return pushAsset(AID, keys); };
const pull = async (n: Name) => { on(n); return pullAsset(AID, keys); };
// provider(cloud-sync-provider.tsx)가 하는 일: pull 뒤 mergedAdditions면 즉시 재-push
const pullLikeProvider = async (n: Name) => {
  const r = await pull(n);
  const repushed = r.status === "ok" && r.mergedAdditions;
  if (repushed) expect((await push(n)).status).toBe("ok");
  return { r, repushed };
};
async function oldPull() {
  on("B");
  legacy.applyImport(await decryptPayload({ iv: server.iv!, ciphertext: server.ciphertext! }, keys.encKey));
  markSynced(server.version);
}
async function oldPush() {
  on("B");
  const blob = await encryptPayload(legacy.buildPayload(), keys.encKey);
  if (getVersion() !== server.version) return "conflict" as const;
  server = { version: server.version + 1, iv: blob.iv, ciphertext: blob.ciphertext };
  markSynced(server.version);
  return "ok" as const;
}
const serverPayload = async () => (await decryptPayload({ iv: server.iv!, ciphertext: server.ciphertext! }, keys.encKey)) as Record<string, unknown>;

beforeEach(async () => {
  g.window = Object.assign(globalThis, { dispatchEvent: () => true }) as never;
  dev.A = memoryStorage(); dev.B = memoryStorage(); dev.C = memoryStorage();
  server = { version: 0 };
  putBodies = [];
  vi.useFakeTimers({ toFake: ["Date"] });
  at("2026-11-17T03:00:00Z");
  g.fetch = vi.fn(async (_url: string, init?: { method?: string; body?: string }) => {
    const json = (status: number, body: unknown) => ({ ok: status < 400, status, json: async () => body });
    if (init?.method === "PUT") {
      putBodies.push(init.body as string);
      const b = JSON.parse(init.body as string) as { baseVersion: number; iv: string; ciphertext: string };
      if (b.baseVersion !== server.version) return json(409, { asset: { version: server.version } });
      server = { version: server.version + 1, iv: b.iv, ciphertext: b.ciphertext };
      return json(200, { version: server.version });
    }
    if (!server.iv) return json(404, {});
    return json(200, { asset: { iv: server.iv, ciphertext: server.ciphertext, version: server.version } });
  });
  keys = await deriveKeys("test-pass-123!", AID);
  on("A");
  saveAssetData({ ...getAssetData(), cash: [cashItem("c1", 1_000_000)] });
});
afterEach(() => {
  vi.useRealTimers();
  delete g.window; delete g.localStorage; delete g.fetch;
});

describe.each([
  ["기존 형태", false],
  ["base + 미래 필드 포함", true],
])("동기화 순환 ③⑤·AC-18 — %s", (_name, useRich) => {
beforeEach(() => { rich = useRich; });
afterEach(() => { rich = false; });

describe("AC-18 — 저장 뒤 push하면 다른 기기 pull에서 같은 값", () => {
  it("이름표·점검·주기가 그대로 건너가고, 변화가 없으면 재-push가 없다", async () => {
    label("A", "005930", "keep");
    label("A", "AAPL", "check");
    at("2026-11-18T03:00:00Z");
    checked("A", "AAPL");
    cycle("A", 6);
    expect((await push("A")).status).toBe("ok");
    const { repushed } = await pullLikeProvider("C");
    expect(repushed).toBe(false);
    expect(labelsOf("C")).toEqual(labelsOf("A"));
    expect(labelsOf("C").items.AAPL.checkedAt).toBe("2026-11-18T03:00:00.000Z");
    // 다시 pull해도 그대로(핑퐁 없음)
    expect((await pullLikeProvider("A")).repushed).toBe(false);
    expect((await pullLikeProvider("C")).repushed).toBe(false);
  });
  it("서버로 나가는 본문은 암호문뿐이다 — 티커·이름표 낱말이 평문으로 없다(AC-17)", async () => {
    label("A", "AAPL", "check");
    await push("A");
    expect(putBodies).toHaveLength(1);
    expect(Object.keys(JSON.parse(putBodies[0])).sort()).toEqual(["baseVersion", "ciphertext", "iv", "pubKey"]); // main과 같은 필드(추가 0)
    // 5.167 견고화: 무작위 암호문(base64)에 'qty' 같은 짧은 낱말이 우연히 들어가 간헐 실패하던 것을 없앤다.
    // ① 암호문·iv·pubKey 값은 base64 글자만(평문이 섞이면 실패) ② 낱말 검사는 세 값을 뺀 나머지 본문(키 이름·baseVersion)에 한다.
    const body = JSON.parse(putBodies[0]) as Record<string, unknown>;
    for (const k of ["ciphertext", "iv", "pubKey"] as const) expect(body[k]).toMatch(/^[A-Za-z0-9+/]+=*$/);
    const rest = JSON.stringify({ ...body, ciphertext: "", iv: "", pubKey: "" });
    for (const word of ["AAPL", "stockLabels", "check", "labeledAt", "qty", "weight", "price", "\"base\"", "futureTop"]) expect(rest).not.toContain(word);
    expect((await serverPayload()).stockLabels).toEqual(labelsOf("A")); // 복호화하면 최상위 필드
  });
  it("이름표가 없는 기기의 push에는 필드가 없고, 받는 기기의 이름표를 지우지 않는다", async () => {
    await push("A");
    expect("stockLabels" in (await serverPayload())).toBe(false);
    await pull("C");
    label("C", "NVDA", "keep");
    on("A"); saveAssetData({ ...getAssetData(), nickname: "A 편집" });
    await push("A"); // 여전히 필드 없음
    const { repushed } = await pullLikeProvider("C");
    expect(labelsOf("C").items.NVDA.label).toBe("keep");
    expect(repushed).toBe(true); // 수신에 필드가 없는데 로컬에 이름표가 있다 → 다시 올린다
    expect((await serverPayload()).stockLabels).toEqual(labelsOf("C"));
  });
});

describe("③ 구버전 기기 pull→push 뒤 신버전 pull → 이름표 보존", () => {
  it("B가 필드를 뺀 payload로 덮어도 A는 이름표를 지키고 재-push하며, 새 기기 C가 복원한다", async () => {
    label("A", "005930", "keep");
    label("A", "AAPL", "check");
    cycle("A", 3);
    const before = rawOf("A");
    await push("A");
    await oldPull();                               // B: 오류 없이 이름표를 버린다
    on("B"); legacy.save({ ...legacy.read(), nickname: "B 편집" });
    expect(await oldPush()).toBe("ok");            // 클라우드 사본에서 stockLabels 소실
    expect("stockLabels" in (await serverPayload())).toBe(false);
    const { r, repushed } = await pullLikeProvider("A");
    expect(r.status === "ok" && r.mergedAdditions).toBe(true);
    expect(repushed).toBe(true);
    expect(rawOf("A")).toBe(before);               // 로컬 원문 그대로
    on("A"); expect(getAssetData().nickname).toBe("B 편집"); // 나머지는 정상 반영
    expect((await pullLikeProvider("C")).repushed).toBe(false);
    expect(labelsOf("C")).toEqual(labelsOf("A"));
  });
  it("B가 여러 번 편집·push해도 매번 복구되고, 변화가 없으면 재-push 연쇄가 없다", async () => {
    label("A", "AAPL", "keep");
    await push("A");
    for (let round = 0; round < 3; round++) {
      await oldPull();
      on("B"); legacy.save({ ...legacy.read(), nickname: `B ${round}` });
      expect(await oldPush()).toBe("ok");
      expect((await pullLikeProvider("A")).repushed).toBe(true);
      expect((await pullLikeProvider("A")).repushed).toBe(false);
    }
    expect(labelsOf("A").items.AAPL.label).toBe("keep");
  });
  it("B 기기 자신의 이름표(신버전이던 때 붙인 것)는 롤백 중 pull이 와도 남는다", async () => {
    label("B", "TSLA", "keep");
    const before = rawOf("B");
    label("A", "AAPL", "check");
    await push("A");
    await oldPull();
    expect(rawOf("B")).toBe(before);
  });
});

describe("⑤ 두 기기 동시 수정 — 티커별 병합·삭제 표식", () => {
  const setup = async () => {
    label("A", "005930", "keep");
    label("A", "AAPL", "keep");
    await push("A");
    await pull("C");
  };
  it("다른 티커를 각각 수정하면 양쪽이 같은 값으로 수렴한다", async () => {
    await setup();
    at("2026-11-18T01:00:00Z"); label("A", "NVDA", "check");
    at("2026-11-18T02:00:00Z"); label("C", "TSLA", "keep");
    expect((await push("A")).status).toBe("ok");
    const c = await pullLikeProvider("C");
    expect(c.repushed).toBe(true); // C 쪽에만 있던 TSLA를 올린다
    expect(Object.keys(labelsOf("C").items).sort()).toEqual(["005930", "AAPL", "NVDA", "TSLA"]);
    expect((await pullLikeProvider("A")).repushed).toBe(false);
    expect(labelsOf("A")).toEqual(labelsOf("C"));
  });
  it("같은 티커는 늦게 저장한 쪽이 남는다(어느 기기가 먼저 push해도 같다)", async () => {
    await setup();
    at("2026-11-18T01:00:00Z"); label("A", "AAPL", "check");
    at("2026-11-18T02:00:00Z"); label("C", "AAPL", null); // 더 늦게 '정하지 않음'
    await push("A");
    await pullLikeProvider("C");
    await pullLikeProvider("A");
    expect(labelsOf("A").items.AAPL.label).toBeNull();
    expect(labelsOf("C").items.AAPL.label).toBeNull();
  });
  it("'정하지 않음'으로 되돌린 것이 다른 기기의 예전 이름표로 되살아나지 않는다", async () => {
    await setup();
    at("2026-11-18T01:00:00Z"); label("C", "005930", null);
    // A는 그 사실을 모른 채 다른 편집을 push한다(A의 005930은 예전 keep 그대로)
    at("2026-11-18T02:00:00Z"); cycle("A", 12);
    expect((await push("A")).status).toBe("ok");
    const c = await pullLikeProvider("C");
    expect(labelsOf("C").items["005930"].label).toBeNull();
    expect(c.repushed).toBe(true);
    await pullLikeProvider("A");
    expect(labelsOf("A").items["005930"].label).toBeNull();
    expect(labelsOf("A").cycle.months).toBe(12);
    expect(labelsOf("C").cycle.months).toBe(12);
  });
  it("주기도 늦은 쪽, 한쪽의 점검과 다른 쪽의 이름표 변경은 늦은 쪽만 남는다(알려진 한계)", async () => {
    await setup();
    at("2026-11-18T03:00:00Z"); label("A", "AAPL", "check"); await push("A"); await pull("C");
    at("2026-11-19T01:00:00Z"); checked("A", "AAPL"); cycle("A", 3);
    at("2026-11-19T02:00:00Z"); label("C", "AAPL", "keep"); cycle("C", 6);
    await push("A");
    await pullLikeProvider("C");
    await pullLikeProvider("A");
    expect(labelsOf("A")).toEqual(labelsOf("C"));
    expect(labelsOf("A").items.AAPL).toMatchObject({ label: "keep" });
    expect(labelsOf("A").items.AAPL.checkedAt).toBeUndefined(); // A의 점검은 항목째 밀린다
    expect(labelsOf("A").cycle.months).toBe(6);
  });
  it("이름표가 없던 새 기기는 받은 값을 그대로 쓰고 재-push하지 않는다", async () => {
    await setup();
    dev.B = memoryStorage();
    const fresh = await pull("B");
    expect(fresh.status === "ok" && fresh.mergedAdditions).toBe(false);
    expect(labelsOf("B")).toEqual(labelsOf("A"));
    expect(labelsOf("B")).not.toEqual(emptyStockLabels());
  });
});
}); // describe.each 끝

describe("⑨ 모르는 필드 보존 — push·pull 순환(AC-31)", () => {
  // 다음 버전 기기가 4곳에 필드를 더해 둔 값
  const futurePayload = () => ({
    futureTop: { goals: [1, 2] },
    v: 1,
    cycle: { months: 3, at: "2026-11-10T03:00:00.000Z", futureCycle: "주기에 딸린 값" },
    items: {
      AAPL: { label: "check", labeledAt: "2026-11-10T03:00:00.000Z", base: { qty: 12, price: 185.5, priceAt: "2026-11-10", weight: 20.5, futureBase: [9] }, futureItem: { a: 1 }, at: "2026-11-10T03:00:00.000Z" },
    },
  });
  const seedA = () => { on("A"); writeStockLabels(futurePayload() as never); };
  it("읽기 → 다른 종목 이름표 저장 → 같은 항목 점검 → push → 다른 기기 pull 결과에 값 그대로", async () => {
    seedA();
    at("2026-11-18T03:00:00Z");
    label("A", "NVDA", "keep");
    checked("A", "AAPL");
    expect((await push("A")).status).toBe("ok");
    const sent = (await serverPayload()).stockLabels as ReturnType<typeof futurePayload>;
    expect(sent.futureTop).toEqual({ goals: [1, 2] });
    expect(sent.cycle).toEqual(futurePayload().cycle);
    expect(sent.items.AAPL).toEqual({ ...futurePayload().items.AAPL, checkedAt: "2026-11-18T03:00:00.000Z", at: "2026-11-18T03:00:00.000Z" });
    expect((await pullLikeProvider("C")).repushed).toBe(false);
    expect(labelsOf("C")).toEqual(labelsOf("A"));
    expect(labelsOf("C").items.AAPL.futureItem).toEqual({ a: 1 });
    expect(labelsOf("C").items.AAPL.base).toEqual(futurePayload().items.AAPL.base);
    expect((await pullLikeProvider("A")).repushed).toBe(false); // 같은 값이면 재-push 연쇄 없음
  });
  it("이름표를 바꾼 항목만 미래 필드와 옛 base가 사라지고, 최상위·cycle은 남는다", async () => {
    seedA();
    at("2026-11-18T03:00:00Z");
    label("A", "AAPL", "keep");
    await push("A");
    await pull("C");
    const c = labelsOf("C");
    expect(c.items.AAPL).toEqual({ label: "keep", labeledAt: "2026-11-18T03:00:00.000Z", at: "2026-11-18T03:00:00.000Z" });
    expect([c.futureTop, c.cycle.futureCycle]).toEqual([{ goals: [1, 2] }, "주기에 딸린 값"]);
  });
  it("구버전(4.53) 기기가 덮어도 미래 필드째 복구된다", async () => {
    seedA();
    await push("A");
    await oldPull();
    on("B"); legacy.save({ ...legacy.read(), nickname: "B 편집" });
    expect(await oldPush()).toBe("ok");
    expect((await pullLikeProvider("A")).repushed).toBe(true);
    expect((await serverPayload()).stockLabels).toEqual(futurePayload());
  });
});

describe("⑩ base 왕복 — 두 기기 push → pull(AC-31)", () => {
  const BASE = { qty: 12, price: 185.5, priceAt: "2026-11-14", weight: 20.5 };
  const labelWith = (n: Name, ticker: string, kind: StockLabelKind, base: { qty: number; price?: number; priceAt?: string; weight?: number }) => {
    on(n); writeStockLabels(setStockLabel(readStockLabels(), ticker, kind, now(), base));
  };
  it("A가 붙인 base 4필드가 C에서 같고, 점검·주기 변경 뒤에도 그대로 건너간다", async () => {
    labelWith("A", "AAPL", "check", BASE);
    await push("A");
    await pull("C");
    expect(labelsOf("C").items.AAPL.base).toEqual(BASE);
    at("2026-11-18T03:00:00Z");
    checked("C", "AAPL"); cycle("C", 6);
    await push("C");
    expect((await pullLikeProvider("A")).repushed).toBe(false);
    expect(labelsOf("A").items.AAPL).toMatchObject({ base: BASE, checkedAt: "2026-11-18T03:00:00.000Z", labeledAt: "2026-11-17T03:00:00.000Z" });
  });
  it("같은 티커를 두 기기가 다른 base로 저장 → 늦은 쪽 값만 남고 진 쪽 필드가 섞이지 않는다", async () => {
    labelWith("A", "AAPL", "keep", BASE);
    await push("A");
    await pull("C");
    at("2026-11-18T01:00:00Z"); labelWith("A", "AAPL", "check", { qty: 30, price: 1, priceAt: "2026-11-18", weight: 1 });
    at("2026-11-18T02:00:00Z"); labelWith("C", "AAPL", "check", { qty: 5 });
    await push("A");
    await pullLikeProvider("C");
    await pullLikeProvider("A");
    expect(labelsOf("A").items.AAPL.base).toEqual({ qty: 5 });
    expect(labelsOf("C").items.AAPL.base).toEqual({ qty: 5 });
  });
  it("base만 다른 같은 시각 값: base 있는 쪽이 남고, base 없는 값이 와도 잃지 않고 다시 올린다", async () => {
    label("A", "AAPL", "keep"); // base 없는 항목(보강 이전 내부 빌드 형태)
    await push("A");
    await pull("C");
    on("C"); const cur = readStockLabels();
    writeStockLabels({ ...cur, items: { ...cur.items, AAPL: { ...cur.items.AAPL, base: BASE } } });
    await push("C");
    await pullLikeProvider("A");
    expect(labelsOf("A").items.AAPL.base).toEqual(BASE);
    on("A");
    expect(applyIncomingStockLabels(cur, { merge: true })).toEqual({ repush: true }); // base를 버린 값이 되돌아온 경우
    expect(labelsOf("A").items.AAPL.base).toEqual(BASE);
  });
});
