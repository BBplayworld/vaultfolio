// #239 [5.125] 내 자산 불리기 — 분리 키 저장·백업·복원(AC-19 ①②④⑥⑧, AC-17·AC-20). 동기화 순환은 stock-labels-sync.test.ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  applyImportedPayload, buildExportPayload, clearAssetData, clearUserCaches, getAssetData, saveAssetData,
} from "../asset/asset-storage";
import {
  applyIncomingStockLabels, clearStockLabels, markStockChecked, readStockLabels, readStockLabelsForExport, readStockLabelsState,
  setStockLabel, setStockLabelCycle, writeStockLabels, emptyStockLabels, type StockLabels,
} from "../asset/stock-labels";
import { buildGrowRows, growTotals, sortGrowRowKeys, summarizeGrowRows } from "../asset/grow-rows";
import { materializeDemo } from "../preview/demo-payload";
import { migrateStorageKeys, STORAGE_KEYS } from "../local-storage";
import { assetDataSchema } from "@/types/asset";
import { cashItem, emptyData, g, legacy, memoryStorage } from "./physical-fixtures";

// 데모 JSON은 정적 import 금지(preview-safety 9번) — 파일로 읽는다
const demoRaw = JSON.parse(readFileSync(path.resolve(__dirname, "../preview/demo-data.json"), "utf8")) as { stockLabels: unknown };

const KEY = STORAGE_KEYS.stockLabels;
const T = (d: string) => `${d}T03:00:00.000Z`;
const raw = () => localStorage.getItem(KEY);
// 공용 픽스처 두 벌 — ①~⑧을 둘 다로 돌린다(AC-31): 기존 형태 / base + 미래 필드(4곳) 포함
const plainSeed = (): StockLabels => {
  let s = setStockLabel(emptyStockLabels(), "005930", "keep", T("2026-09-01"));
  s = setStockLabel(s, "AAPL", "check", T("2026-09-02"));
  s = markStockChecked(s, "AAPL", T("2026-10-02"));
  s = setStockLabel(s, "NVDA", null, T("2026-10-03"));
  return setStockLabelCycle(s, 3, T("2026-09-01"));
};
const BASE = { qty: 12.5, price: 185.5, priceAt: "2026-09-02", weight: 21.84 };
const richSeed = (): StockLabels => {
  let s = setStockLabel(emptyStockLabels(), "005930", "keep", T("2026-09-01"), { qty: 65, price: 61000 });
  s = setStockLabel(s, "AAPL", "check", T("2026-09-02"), { ...BASE, futureBase: { lots: [3, 9.5] } });
  s = markStockChecked(s, "AAPL", T("2026-10-02"));
  s = setStockLabel(s, "NVDA", null, T("2026-10-03"));
  s = setStockLabelCycle(s, 3, T("2026-09-01"));
  return {
    ...s,
    futureTop: { goals: ["a"], n: 1 },
    cycle: { ...s.cycle, futureCycle: "주기에 딸린 값" },
    items: { ...s.items, AAPL: { ...s.items.AAPL, futureItem: [1, { two: 2 }] } },
  };
};
const withAssets = () => saveAssetData({ ...emptyData(), cash: [cashItem("c1", 1_000_000)], nickname: "홍" });

beforeEach(() => {
  g.window = Object.assign(globalThis, { dispatchEvent: () => true }) as never;
  g.localStorage = memoryStorage();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-17T03:00:00Z"));
});
afterEach(() => {
  vi.useRealTimers();
  delete g.window; delete g.localStorage;
});

describe.each([
  ["기존 형태", plainSeed],
  ["base + 미래 필드 포함", richSeed],
])("복원 ①②④⑥⑧ — %s", (_name, seed) => {

describe("키 이름(AC-17·AC-19 ⑧)", () => {
  it("secretasset_ 접두가 아니고 정리 접두에도 걸리지 않는다", () => {
    expect(KEY).toBe("secretasset.stock_labels");
    expect(KEY.startsWith("secretasset_")).toBe(false);
    expect(KEY.startsWith("secretasset-gemini-")).toBe(false);
    expect(KEY.startsWith("profit:")).toBe(false);
  });
  it("⑧ 구버전 코드가 도는 경로(clearAssetData·migrateStorageKeys·clearUserCaches·4.53 가져오기) 뒤에도 값이 그대로다", () => {
    withAssets();
    writeStockLabels(seed());
    const before = raw();
    clearAssetData();
    migrateStorageKeys();
    clearUserCaches();
    legacy.clear();
    legacy.applyImport({ assetData: emptyData() });
    expect(raw()).toBe(before);
  });
});

describe("① 구 백업(필드 없음) 가져오기 → 로컬 이름표 보존", () => {
  it("키 원문 문자열이 그대로다(쓰기 호출 없음)", () => {
    withAssets();
    writeStockLabels(seed());
    const before = raw();
    const setItem = vi.spyOn(localStorage, "setItem");
    const oldBackup = { assetData: { ...emptyData(), cash: [cashItem("c9", 5)] }, profitBasis: "kstAccessDay", nickname: "옛 백업" };
    const r = applyImportedPayload(oldBackup);
    expect(r.stockLabelsRepush).toBe(false);
    expect(raw()).toBe(before);
    expect(setItem.mock.calls.some(([k]) => k === KEY)).toBe(false);
    expect(getAssetData().cash[0].id).toBe("c9"); // 자산은 정상 교체
  });
  it("assetData만 있는 아주 옛 형식(최상위가 곧 자산)도 같다", () => {
    writeStockLabels(seed());
    const before = raw();
    applyImportedPayload({ ...emptyData(), cash: [cashItem("c9", 5)] });
    expect(raw()).toBe(before);
  });
});

describe("② 새 payload를 직전 스키마로 파싱 → 자산 동일(AC-20)", () => {
  it("이름표는 assetData 밖 최상위 필드이고, assetData는 이름표 유무와 무관하게 같다", () => {
    withAssets();
    const without = buildExportPayload();
    expect("stockLabels" in without).toBe(false); // 키 없음 = 필드 없음
    writeStockLabels(seed());
    const withLabels = buildExportPayload();
    expect(withLabels.stockLabels).toEqual(seed());
    expect("stockLabels" in (withLabels.assetData as object)).toBe(false);
    const strip = (p: Record<string, unknown>) => ({ ...(p.assetData as Record<string, unknown>), lastUpdated: "" });
    expect(strip(withLabels)).toEqual(strip(without));
    expect(assetDataSchema.parse(withLabels.assetData)).toEqual(assetDataSchema.parse(without.assetData));
  });
  it("4.53 로직 사본(구버전 기기)이 새 payload를 오류 없이 가져오고 자산이 같다", () => {
    withAssets();
    writeStockLabels(seed());
    const payload = buildExportPayload();
    g.localStorage = memoryStorage();
    expect(() => legacy.applyImport(payload)).not.toThrow();
    expect(legacy.read().cash).toEqual([cashItem("c1", 1_000_000)]);
    expect(localStorage.getItem(KEY)).toBeNull(); // 구버전은 이름표를 모른다(버릴 뿐 오류 없음)
  });
  it("공유 토큰 입력(AssetData)에 이름표가 없다 — 토큰은 이름표 유무와 무관(AC-17)", () => {
    withAssets();
    const a = JSON.stringify({ ...getAssetData(), lastUpdated: "" });
    writeStockLabels(seed());
    expect(JSON.stringify({ ...getAssetData(), lastUpdated: "" })).toBe(a);
    expect(a).not.toContain("stockLabels");
  });
});

describe("④ 백업 → 모든 데이터 삭제 → 복원 왕복", () => {
  it("이름표·주기·점검일·삭제 표식이 그대로 돌아온다", () => {
    withAssets();
    writeStockLabels(seed());
    const file = JSON.parse(JSON.stringify(buildExportPayload())); // 파일 왕복
    clearAssetData();
    clearStockLabels(); // 설정 › 모든 데이터 삭제 경로
    expect(raw()).toBeNull();
    expect(readStockLabels()).toEqual(emptyStockLabels());
    applyImportedPayload(file);
    expect(readStockLabels()).toEqual(seed());
    expect(getAssetData().cash).toEqual([cashItem("c1", 1_000_000)]);
  });
  it("파일 가져오기는 병합이 아니라 교체다(필드가 있을 때)", () => {
    writeStockLabels(setStockLabel(emptyStockLabels(), "TSLA", "keep", T("2026-11-16")));
    applyImportedPayload({ assetData: emptyData(), stockLabels: seed() });
    expect(readStockLabels()).toEqual(seed());
    expect(readStockLabels().items.TSLA).toBeUndefined();
  });
  it("읽을 수 없는 stockLabels 필드는 없음으로 취급하고 자산 복원을 막지 않는다", () => {
    writeStockLabels(seed());
    const before = raw();
    for (const bad of [null, "x", [], { v: 9, items: {} }, { v: 1 }]) {
      expect(() => applyImportedPayload({ assetData: { ...emptyData(), cash: [cashItem("c2", 1)] }, stockLabels: bad })).not.toThrow();
      expect(raw()).toBe(before);
      expect(getAssetData().cash[0].id).toBe("c2");
    }
  });
  it("이름표 쓰기가 실패해도 자산은 복원된다", () => {
    const orig = localStorage.setItem.bind(localStorage);
    vi.spyOn(localStorage, "setItem").mockImplementation((k: string, v: string) => {
      if (k === KEY) throw new Error("quota");
      orig(k, v);
    });
    expect(() => applyImportedPayload({ assetData: { ...emptyData(), cash: [cashItem("c3", 1)] }, stockLabels: seed() })).not.toThrow();
    expect(getAssetData().cash[0].id).toBe("c3");
  });
});

describe("⑥ 손상 값 → 빈 상태, 자동 경로는 원문을 덮지 않는다", () => {
  it.each([
    ["깨진 JSON", "{oops"],
    ["v 불일치", JSON.stringify({ v: 2, items: {} })],
    ["items 비객체", JSON.stringify({ v: 1, items: "x" })],
    ["객체 아님", "[]"],
  ])("%s: 읽기·내보내기·가져오기·pull 병합 뒤 원문 그대로", (_n, broken) => {
    withAssets();
    localStorage.setItem(KEY, broken);
    expect(readStockLabelsState().state).toBe("corrupt");
    expect(readStockLabels()).toEqual(emptyStockLabels());
    expect(readStockLabelsForExport()).toBeUndefined();
    expect("stockLabels" in buildExportPayload()).toBe(false);
    applyImportedPayload({ assetData: emptyData() });                                  // 필드 없는 가져오기
    expect(applyIncomingStockLabels(seed(), { merge: true })).toEqual({ repush: false }); // pull 병합
    expect(applyIncomingStockLabels(undefined, { merge: true })).toEqual({ repush: false });
    expect(raw()).toBe(broken);
  });
  it("잘못된 티커 키 항목은 읽을 때만 빠진다(읽기는 원문을 바꾸지 않는다)", () => {
    const v = JSON.stringify({ v: 1, cycle: { months: null, at: "" }, items: { "bad key": { label: "keep", labeledAt: T("2026-01-01"), at: T("2026-01-01") } } });
    localStorage.setItem(KEY, v);
    expect(readStockLabels().items).toEqual({});
    expect(raw()).toBe(v);
  });
  it("사용자가 직접 저장하면 새 값으로 교체된다(손상 기기에서도 기능을 다시 쓸 수 있다)", () => {
    localStorage.setItem(KEY, "{oops");
    const next = setStockLabel(readStockLabels(), "AAPL", "keep", T("2026-11-17")); // 훅의 저장 경로와 같은 순서
    writeStockLabels(next);
    expect(readStockLabelsState()).toEqual({ state: "ok", value: next });
  });
  it("키가 없으면 읽기만으로 키가 생기지 않는다(마이그레이션 없음)", () => {
    expect(readStockLabelsState().state).toBe("none");
    readStockLabels(); buildExportPayload(); applyImportedPayload({ assetData: emptyData() });
    expect(raw()).toBeNull();
  });
});

}); // describe.each 끝

describe("⑩ base 왕복(AC-31) — 백업 → 모든 데이터 삭제 → 복원", () => {
  it("base 4필드와 4곳의 미래 필드가 깊은 비교로 같다", () => {
    withAssets();
    writeStockLabels(richSeed());
    const file = JSON.parse(JSON.stringify(buildExportPayload()));
    expect(file.stockLabels.items.AAPL.base).toEqual({ ...BASE, futureBase: { lots: [3, 9.5] } });
    clearAssetData();
    clearStockLabels();
    applyImportedPayload(file);
    const back = readStockLabels();
    expect(back).toEqual(richSeed());
    expect(back.items.AAPL.base).toMatchObject(BASE);
    expect(back.items["005930"].base).toEqual({ qty: 65, price: 61000 });
    expect("base" in back.items.NVDA).toBe(false); // '정하지 않음' 표식에는 base가 없다
    expect([back.futureTop, back.cycle.futureCycle, back.items.AAPL.futureItem]).toEqual([{ goals: ["a"], n: 1 }, "주기에 딸린 값", [1, { two: 2 }]]);
  });
  it("⑨ 미래 필드가 든 저장소를 읽기만 해서는 원문이 바뀌지 않고, 내보내기에 값 그대로 실린다", () => {
    withAssets();
    const text = JSON.stringify(richSeed());
    localStorage.setItem(KEY, text);
    readStockLabels(); readStockLabelsForExport();
    expect(raw()).toBe(text);
    expect(buildExportPayload().stockLabels).toEqual(richSeed());
  });
  it("⑨ pull 병합에서 수신 쪽 미래 필드를 받아 저장한다(이긴 항목 통째로)", () => {
    writeStockLabels(plainSeed());
    const incoming = richSeed();
    incoming.items.AAPL = { ...incoming.items.AAPL, at: T("2026-11-01") }; // 수신 쪽이 더 새 값
    expect(applyIncomingStockLabels(JSON.parse(JSON.stringify(incoming)), { merge: true }).repush).toBe(false); // 병합 결과 = 수신값
    const merged = readStockLabels();
    expect(merged.items.AAPL).toEqual(incoming.items.AAPL);
    expect(merged.futureTop).toEqual({ goals: ["a"], n: 1 });
    expect(merged.cycle.futureCycle).toBe("주기에 딸린 값"); // at 같음 → 직렬화가 긴 쪽
    expect(merged.items["005930"].base).toEqual({ qty: 65, price: 61000 }); // at 같음 → base 있는 쪽
  });
  it("base가 든 payload도 assetData 밖 최상위에만 있고 자산·공유 토큰 입력은 같다(AC-32)", () => {
    withAssets();
    const a = JSON.stringify({ ...getAssetData(), lastUpdated: "" });
    writeStockLabels(richSeed());
    const payload = buildExportPayload();
    expect(JSON.stringify(payload.assetData)).not.toMatch(/stockLabels|"base"|futureTop/);
    expect(JSON.stringify({ ...getAssetData(), lastUpdated: "" })).toBe(a);
  });
});

describe("데모 시드(@D-125) — 체험·데모가 같은 payload를 쓴다", () => {
  it.each(["2026-11-17", "2026-03-01", "2027-01-31", "2028-02-29"])("기준일 %s: 오래 둘 2·점검할 2, 주기 3개월, 경과 1건이 1행째·4개월 전", (today) => {
    const payload = materializeDemo(demoRaw, today);
    const now = Date.parse(`${today}T03:00:00Z`);
    applyImportedPayload(payload);
    const labels = readStockLabels();
    expect(labels.cycle.months).toBe(3);
    const data = getAssetData();
    const rows = buildGrowRows(data.stocks, { USD: 1400, JPY: 9 }, labels, now);
    const s = summarizeGrowRows(rows, labels, now, growTotals(data.stocks, { USD: 1400, JPY: 9 }));
    expect([s.keep, s.check, s.none]).toEqual([2, 2, rows.length - 4]);
    expect(s.lastCheckText).toBe("마지막 점검 4개월 전");
    const overdue = rows.filter((r) => r.overdueFact);
    expect(overdue.map((r) => [r.ticker, r.labelFact, r.overdueFact])).toEqual([["AAPL", "마지막 점검 4개월 전", "내가 정한 주기 3개월이 지났어요"]]);
    expect(sortGrowRowKeys(rows)[0]).toBe(overdue[0].key);
    expect(rows.find((r) => r.ticker === "360750")!.labelFact).toBe("오래 두기로 한 지 1년 2개월");
    // AC-33: 조작 없이 무게 줄(합 100.0)과 수량 비교 두 문장이 처음 보이는 3행 안에 있다
    const w = s.weights;
    expect(w.keep.pct! + w.check.pct! + w.none.pct!).toBeCloseTo(100, 6);
    expect(w.keep.pctText).toMatch(/^\d+\.\d%$/);
    const by = new Map(rows.map((r) => [r.key, r]));
    const top3 = sortGrowRowKeys(rows).slice(0, 3).map((k) => by.get(k)!.qtyFact?.text);
    expect(top3).toContain("정한 날 10주 → 지금 12주");
    expect(top3).toContain("정한 뒤 수량 그대로");
    expect(rows.filter((r) => r.labelState === "keep" || r.labelState === "check").every((r) => r.qtyFact !== null)).toBe(true);
  });
  it("시드에 고정 날짜가 없다(전부 날짜 토큰)", () => {
    const seedText = JSON.stringify(demoRaw.stockLabels);
    expect(seedText).not.toMatch(/20\d\d-\d\d/);
    expect(seedText).toContain("@D-125");
  });
  it("데모를 다시 주입하면 조작한 이름표가 시드로 돌아간다(필드 있으면 교체)", () => {
    const payload = materializeDemo(demoRaw, "2026-11-17");
    applyImportedPayload(payload);
    writeStockLabels(setStockLabel(readStockLabels(), "000660", "check", T("2026-11-17")));
    applyImportedPayload(payload);
    expect(readStockLabels().items["000660"]).toBeUndefined();
  });
});

describe("추천 아님 조건 4·5 — 이름표가 닿지 않는 곳(AC-11·AC-12)", () => {
  const src = (p: string) => readFileSync(path.resolve(__dirname, "../..", p), "utf8");
  it("AI 프롬프트·홈 팁·알림·공유 반영 코드는 이름표 모듈을 쓰지 않는다", () => {
    for (const f of ["lib/ai-prompts.ts", "lib/home-tip.ts", "lib/cloud-sync/overwrite-guard.ts", "lib/trial/trial-boot.ts", "lib/preview/demo-inject.ts"]) {
      expect(src(f), f).not.toMatch(/stock-labels|stockLabels|stock_labels/);
    }
  });
  it("이 버전이 쓰는 필드는 허용 목록뿐이다 — 메모·평가금액·매입단가 없음. 수량·시세·비중은 base 안에만", () => {
    const written = setStockLabel(plainSeed(), "TSLA", "keep", T("2026-11-01"), BASE);
    expect(Object.keys(written).sort()).toEqual(["cycle", "items", "v"]);
    expect(Object.keys(written.cycle).sort()).toEqual(["at", "months"]);
    for (const item of Object.values(written.items)) {
      for (const k of Object.keys(item)) expect(["label", "labeledAt", "checkedAt", "base", "at"]).toContain(k);
      for (const k of Object.keys(item.base ?? {})) expect(["qty", "price", "priceAt", "weight"]).toContain(k);
    }
    expect(JSON.stringify(written)).not.toMatch(/memo|amount|value|averagePrice|cost/);
  });
});
