// #58 실물 자산 — 분리 키 저장 계층·복원·왕복·가져오기·병합·체험 거부 (spec 10절 1·2·3·5·8·9·11, tech-review 8절)
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  applyImportedPayload, buildExportPayload, clearAssetData, clearPhysicalAssets, collectAssetIds, getAssetData, hasAnyAssets,
  mergeMonthlySnapshots, readPhysicalAssets, reconcileAdditiveMerge, saveAssetData, saveAssetDataRaw,
} from "../asset/asset-storage";
import { trialRejectReason } from "../trial/trial-boot";
import { STORAGE_KEYS } from "../local-storage";
import type { AssetData, MonthlyAssetSnapshot } from "@/types/asset";
import { cashItem, emptyData, g, gold, legacy, memoryStorage } from "./physical-fixtures";

const PK = STORAGE_KEYS.physicalAssets;
const MAIN = STORAGE_KEYS.assetData;
const rawMain = () => JSON.parse(localStorage.getItem(MAIN) ?? "{}");
const rawPhys = () => JSON.parse(localStorage.getItem(PK) ?? "null");

beforeEach(() => {
  g.window = globalThis;
  g.localStorage = memoryStorage();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-08T03:00:00Z"));
});
afterEach(() => {
  vi.useRealTimers();
  delete g.window; delete g.localStorage;
});

describe("분리 키 이름", () => {
  it("secretasset_ 접두·알려진 정리 접두에 걸리지 않는다", () => {
    expect(PK).toBe("secretasset.physical_assets");
    expect(PK.startsWith("secretasset_")).toBe(false);
    expect(PK.startsWith("secretasset-gemini-")).toBe(false);
    expect(PK.startsWith("profit:")).toBe(false);
  });
});

describe("복원: 4.53 형식(실물 키 없음) → 신버전", () => {
  it("기존 5종·스냅샷이 그대로 읽히고 실물은 undefined다", () => {
    const old = { ...emptyData(), cash: [cashItem("c1", 1_000_000)], nickname: "홍" };
    localStorage.setItem(MAIN, JSON.stringify(old));
    const d = getAssetData();
    expect(d.cash).toEqual(old.cash);
    expect(d.nickname).toBe("홍");
    expect(d.physicalAssets).toBeUndefined();
    expect(readPhysicalAssets()).toBeUndefined();
    expect(localStorage.getItem(PK)).toBeNull(); // 읽기만으로 키가 생기지 않는다
  });
  it("키 없는 payload의 buildExportPayload는 physicalAssets 필드를 만들지 않는다", () => {
    localStorage.setItem(MAIN, JSON.stringify(emptyData()));
    expect("physicalAssets" in (buildExportPayload().assetData as object)).toBe(false);
  });
});

describe("저장: 분리 키에만 쓴다", () => {
  it("saveAssetData: 분리 키에 배열, 본 키에는 physicalAssets가 없다", () => {
    expect(saveAssetData({ ...emptyData(), physicalAssets: [gold()] })).toBe(true);
    expect(rawPhys()).toEqual([gold()]);
    expect("physicalAssets" in rawMain()).toBe(false);
    expect(getAssetData().physicalAssets).toEqual([gold()]);
  });
  it("saveAssetDataRaw도 분리 키로 분기하고 본 키에 섞지 않는다", () => {
    expect(saveAssetDataRaw({ ...emptyData(), physicalAssets: [gold("P2")] })).toBe(true);
    expect(rawPhys()).toEqual([gold("P2")]);
    expect("physicalAssets" in rawMain()).toBe(false);
  });
  it("undefined 저장은 분리 키를 지우지 않는다(전개 누락·EMPTY 객체 방어)", () => {
    saveAssetData({ ...emptyData(), physicalAssets: [gold()] });
    saveAssetData(emptyData());
    saveAssetDataRaw(emptyData());
    expect(rawPhys()).toEqual([gold()]);
    expect(getAssetData().physicalAssets).toEqual([gold()]);
  });
  it("명시적 []는 삭제 의도로 기록되고, 키 없음과 구분된다", () => {
    saveAssetData({ ...emptyData(), physicalAssets: [gold()] });
    saveAssetData({ ...emptyData(), physicalAssets: [] });
    expect(rawPhys()).toEqual([]);
    expect(getAssetData().physicalAssets).toEqual([]);
    expect((buildExportPayload().assetData as AssetData).physicalAssets).toEqual([]);
  });
  it("본 키에 (오염으로) 실물이 있어도 분리 키가 정본이다", () => {
    localStorage.setItem(MAIN, JSON.stringify({ ...emptyData(), physicalAssets: [gold("X")] }));
    expect(getAssetData().physicalAssets).toBeUndefined();
    saveAssetData({ ...getAssetData(), physicalAssets: [gold("Y")] });
    expect("physicalAssets" in rawMain()).toBe(false);
  });
  it("닉네임 마이그레이션이 본 키를 다시 써도 분리 키 값이 본 키로 새지 않는다", () => {
    saveAssetData({ ...emptyData(), physicalAssets: [gold()] });
    localStorage.setItem(STORAGE_KEYS.nickname, "옛닉");
    const d = getAssetData();
    expect(d.nickname).toBe("옛닉");
    expect("physicalAssets" in rawMain()).toBe(false);
    expect(d.physicalAssets).toEqual([gold()]);
  });
  it("분리 키 쓰기 실패 시 false이고 본 키는 바뀌지 않는다", () => {
    saveAssetData({ ...emptyData(), nickname: "전" });
    const st = g.localStorage!;
    const orig = st.setItem.bind(st);
    st.setItem = (k: string, v: string) => { if (k === PK) throw new Error("quota"); orig(k, v); };
    expect(saveAssetData({ ...emptyData(), nickname: "후", physicalAssets: [gold()] })).toBe(false);
    expect(rawMain().nickname).toBe("전");
  });
});

describe("읽기 완화: 모르는 type·미래 필드·제약 위반", () => {
  const weird = [
    { id: "F1", type: "platinum", name: "백금", currentValue: 5, purchasePrice: 1, purchaseDate: "2025-01-01", grams: 31.1, nested: { a: 1 } },
    { id: "F2", type: "gold", name: "", currentValue: 0, purchasePrice: 0, purchaseDate: "" },
  ];
  it("type은 other로 읽고 미래 필드는 보존, 제약 위반 항목도 탈락하지 않는다", () => {
    localStorage.setItem(PK, JSON.stringify(weird));
    const d = getAssetData();
    expect(d.physicalAssets).toHaveLength(2);
    expect(d.physicalAssets![0]).toMatchObject({ id: "F1", type: "other", grams: 31.1, nested: { a: 1 } });
    expect(d.physicalAssets![1]).toMatchObject({ id: "F2", type: "gold", currentValue: 0 });
  });
  it("읽기→저장 왕복 후에도 미래 필드가 남는다", () => {
    localStorage.setItem(PK, JSON.stringify(weird));
    saveAssetData(getAssetData());
    expect(rawPhys()[0]).toMatchObject({ id: "F1", grams: 31.1, nested: { a: 1 } });
    expect(rawPhys()).toHaveLength(2);
  });
  it("pull payload(applyImportedPayload)에 모르는 type·미래 필드가 있어도 오류가 없다", () => {
    const payload = { assetData: { ...emptyData(), physicalAssets: weird } };
    expect(() => applyImportedPayload(payload)).not.toThrow();
    expect(getAssetData().physicalAssets![0]).toMatchObject({ type: "other", grams: 31.1 });
  });
  it("배열이 아닌 분리 키 값은 undefined로 읽는다", () => {
    localStorage.setItem(PK, JSON.stringify({ a: 1 }));
    expect(readPhysicalAssets()).toBeUndefined();
  });
});

describe("신 → 구 왕복 (롤백·4.53 이하 기기): 실물이 남는다", () => {
  it("구버전 저장 1회·pull(clearAssetData) 1회·가져오기 1회 후 신버전으로 열면 실물이 그대로다", () => {
    saveAssetData({ ...emptyData(), cash: [cashItem("c1", 5)], physicalAssets: [gold(), gold("P2", { type: "silver" })] });
    const before = rawPhys();
    // 구버전: 저장
    legacy.save(legacy.read());
    expect(rawPhys()).toEqual(before);
    // 구버전: pull(= applyImportedPayload → clearAssetData 후 저장)
    legacy.applyImport({ assetData: legacy.read() });
    expect(rawPhys()).toEqual(before);
    // 구버전: 백업 가져오기
    legacy.applyImport({ assetData: { ...emptyData(), cash: [cashItem("c2", 9)] } });
    expect(rawPhys()).toEqual(before);
    // 신버전으로 복귀
    const d = getAssetData();
    expect(d.physicalAssets).toEqual(before);
    expect(d.cash).toEqual([cashItem("c2", 9)]);
    // 구버전: clearAssetData(모든 secretasset_ 키 삭제) 후에도 분리 키는 남는다
    legacy.clear();
    expect(rawPhys()).toEqual(before);
  });
  it("신버전 clearAssetData도 분리 키를 건드리지 않는다(명시 삭제 경로만 지운다)", () => {
    saveAssetData({ ...emptyData(), physicalAssets: [gold()] });
    clearAssetData();
    expect(rawPhys()).toEqual([gold()]);
    clearPhysicalAssets();
    expect(localStorage.getItem(PK)).toBeNull();
  });
});

describe("백업 가져오기 (applyImportedPayload, 동기화 기준점 없음)", () => {
  beforeEach(() => saveAssetData({ ...emptyData(), physicalAssets: [gold("L1")] }));
  it("구 백업(키 없음): 로컬 실물 유지 + physicalKept, 반환 assetData에도 로컬 실물이 합쳐진다", () => {
    const r = applyImportedPayload({ assetData: { ...emptyData(), nickname: "구백업" } });
    expect(r.physicalKept).toBe(true);
    expect(rawPhys()).toEqual([gold("L1")]);
    expect(r.assetData.physicalAssets).toEqual([gold("L1")]);
  });
  it("키가 있는 백업: 교체하고 physicalKept는 false", () => {
    const r = applyImportedPayload({ assetData: { ...emptyData(), physicalAssets: [gold("N1")] } });
    expect(r.physicalKept).toBe(false);
    expect(rawPhys().map((p: { id: string }) => p.id)).toEqual(["N1"]);
  });
  it("빈 배열 백업: 실물을 비운다", () => {
    applyImportedPayload({ assetData: { ...emptyData(), physicalAssets: [] } });
    expect(rawPhys()).toEqual([]);
  });
  it("로컬에 실물이 없으면 구 백업이어도 physicalKept는 false", () => {
    clearPhysicalAssets();
    expect(applyImportedPayload({ assetData: emptyData() }).physicalKept).toBe(false);
  });
});

describe("동기화 병합 단위 (collectAssetIds·reconcileAdditiveMerge)", () => {
  it("collectAssetIds: 실물 id 포함, 키 없는 payload는 실물 id 없음", () => {
    expect(collectAssetIds({ ...emptyData(), physicalAssets: [gold("P1")] })).toContain("P1");
    expect(collectAssetIds(emptyData())).toEqual([]);
  });
  it("원격에 키가 없으면 병합하지 않는다(changed=false, 원격 그대로)", () => {
    const before = { ...emptyData(), physicalAssets: [gold("P1")] };
    const r = reconcileAdditiveMerge(before, emptyData(), new Set());
    expect(r.changed).toBe(false);
    expect(r.data.physicalAssets).toBeUndefined();
  });
  it("원격에 키가 있으면: 로컬 신규는 되살리고, 기준점에 있던 항목은 삭제로 존중", () => {
    const before = { ...emptyData(), physicalAssets: [gold("NEW"), gold("OLD")] };
    const after = { ...emptyData(), physicalAssets: [] };
    const r = reconcileAdditiveMerge(before, after, new Set(["OLD"]));
    expect(r.changed).toBe(true);
    expect(r.data.physicalAssets!.map((p) => p.id)).toEqual(["NEW"]);
  });
});

describe("월 스냅샷 병합", () => {
  const snap = (physical?: number): MonthlyAssetSnapshot => ({
    month: "2026-11", date: "2026-11-08", netAsset: 100, financialAsset: 100,
    breakdown: { realEstate: 0, stocks: 0, crypto: 0, cash: 100, loans: 0, ...(physical === undefined ? {} : { physical }) },
  });
  it("구버전 기기가 쓴 같은 달(physical 필드 없음)이 로컬의 실물 포함 스냅샷을 덮지 않는다", () => {
    const m = mergeMonthlySnapshots([snap(500)], [snap(undefined)], "2026-11");
    expect(m[0].breakdown?.physical).toBe(500);
  });
  it("수신값에 physical 필드가 있으면(0 포함) 수신값을 쓴다", () => {
    expect(mergeMonthlySnapshots([snap(500)], [snap(0)], "2026-11")[0].breakdown?.physical).toBe(0);
    expect(mergeMonthlySnapshots([snap(500)], [snap(700)], "2026-11")[0].breakdown?.physical).toBe(700);
  });
  it("로컬 실물이 0·없음이면 기존 규칙대로 수신값", () => {
    expect(mergeMonthlySnapshots([snap(0)], [snap(undefined)], "2026-11")[0].breakdown?.physical).toBeUndefined();
  });
});

describe("체험(trial) 거부와 자산 보유 판정", () => {
  const orig = (entries: Record<string, string>) => ({ getItem: (k: string) => entries[k] ?? null });
  it("실물 분리 키가 1건 이상이면 asset_data로 거부한다", () => {
    expect(trialRejectReason(orig({ [PK]: JSON.stringify([gold()]) }), "")).toBe("asset_data");
  });
  it("실물 키가 [] 이면 진입 가능, 해석 불가·비배열이면 거부", () => {
    expect(trialRejectReason(orig({ [PK]: "[]" }), "")).toBeNull();
    expect(trialRejectReason(orig({ [PK]: "{" }), "")).toBe("asset_data");
    expect(trialRejectReason(orig({ [PK]: "{}" }), "")).toBe("asset_data");
  });
  it("키가 없으면 기존 판정과 같다", () => {
    expect(trialRejectReason(orig({}), "")).toBeNull();
  });
  it("hasAnyAssets 픽스처 3종: 0건 / 실물만 / 기존 5종", () => {
    expect(hasAnyAssets(emptyData())).toBe(false);
    expect(hasAnyAssets({ ...emptyData(), physicalAssets: [] })).toBe(false);
    expect(hasAnyAssets({ ...emptyData(), physicalAssets: [gold()] })).toBe(true);
    expect(hasAnyAssets({ ...emptyData(), cash: [cashItem("c", 1)] })).toBe(true);
  });
});
