// #239 [5.125] 이름표 저장 동작 — 저장 직후 push 신호(AC-18), GA 0→1 1회·점검마다 1회(AC-15), 손상 값 교체(AC-19 ⑥)
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/contexts/asset-data-context", () => ({ notifyAssetUserEdit: vi.fn(), useAssetData: vi.fn() }));
vi.mock("@/lib/analytics/ga", () => ({ track: vi.fn() }));

import { stockLabelActions } from "../use-stock-labels";
import { readStockLabels, readStockLabelsState } from "@/lib/asset/stock-labels";
import { STORAGE_KEYS } from "@/lib/local-storage";
import { g, memoryStorage } from "@/lib/__tests__/physical-fixtures";

const notify = vi.fn();
const send = vi.fn();
let clock = Date.parse("2026-11-17T03:00:00Z");
const SNAP = { price: 205, rate: 10.84 };
const actions = () => stockLabelActions({ notify, track: send, now: () => new Date((clock += 1000)).toISOString() });

beforeEach(() => {
  g.window = globalThis;
  g.localStorage = memoryStorage();
  notify.mockClear(); send.mockClear();
});
afterEach(() => { delete g.window; delete g.localStorage; });

describe("stockLabelActions", () => {
  it("이름표·점검·주기 저장마다 push 신호 1회, 바뀐 게 없으면 신호도 쓰기도 없다", () => {
    const a = actions();
    expect(a.setLabel("AAPL", "check")?.items.AAPL.label).toBe("check");
    expect(a.record("AAPL", "same", SNAP)?.items.AAPL.checkedAt).toBeTruthy();
    expect(a.setCycle(3)?.cycle.months).toBe(3);
    expect(notify).toHaveBeenCalledTimes(3);
    const raw = localStorage.getItem(STORAGE_KEYS.stockLabels);
    expect(a.setLabel("AAPL", "check")).toBeNull();
    expect(a.setCycle(3)).toBeNull();
    expect(a.record("NVDA", "same", SNAP)).toBeNull(); // 정하지 않은 종목은 '그대로 둠'이 없다
    expect(notify).toHaveBeenCalledTimes(3);
    expect(localStorage.getItem(STORAGE_KEYS.stockLabels)).toBe(raw);
  });
  it("이름표를 붙일 때 넘긴 기준값이 함께 저장되고, 점검·주기로는 바뀌지 않는다(AC-28)", () => {
    const a = actions();
    const base = { qty: 12, price: 185.5, priceAt: "2026-11-14", weight: 20.5 };
    expect(a.setLabel("AAPL", "check", base)?.items.AAPL.base).toEqual(base);
    a.record("AAPL", "same", SNAP); a.setCycle(6);
    expect(readStockLabels().items.AAPL.base).toEqual(base);
    const first = readStockLabels().items.AAPL.labeledAt;
    // 다른 이름표로 바꾸면 labeledAt·base가 함께 새 값
    const next = a.setLabel("AAPL", "keep", { qty: 15 })!;
    expect(next.items.AAPL.base).toEqual({ qty: 15 });
    expect(next.items.AAPL.labeledAt).not.toBe(first);
    // '정하지 않음' 표식에는 base가 없다
    expect("base" in a.setLabel("AAPL", null, { qty: 99 })!.items.AAPL).toBe(false);
  });
  it("grow_label: 유효 이름표 0→1일 때만 1회. 둘째 이름표·'정하지 않음' 표식·주기는 보내지 않는다", () => {
    const a = actions();
    a.setCycle(6);
    a.setLabel("NVDA", null); // 표식만 — 유효 이름표 0
    expect(send).not.toHaveBeenCalled();
    a.setLabel("AAPL", "keep");
    expect(send.mock.calls).toEqual([["grow_label"]]);
    a.setLabel("005930", "check");
    a.setLabel("AAPL", "check");
    expect(send).toHaveBeenCalledTimes(1);
    // 전부 되돌린 뒤 다시 붙이면 다시 0→1(플래그 키 없음 — 저장소 값이 기준)
    a.setLabel("AAPL", null); a.setLabel("005930", null);
    a.setLabel("AAPL", "keep");
    expect(send.mock.calls).toEqual([["grow_label"], ["grow_label"]]);
  });
  it("grow_check(·점검): 점검 기록이 1건 생길 때마다 1회 — 그대로 둠·옮김·정하지 않음 모두. 첫 결정은 기록이 없어 보내지 않는다", () => {
    const a = actions();
    a.record("AAPL", "check", SNAP); // 첫 결정 — 기록 없음
    expect(send.mock.calls).toEqual([["grow_label"]]);
    send.mockClear();
    a.record("AAPL", "same", SNAP);
    a.record("AAPL", "keep", SNAP);
    a.record("AAPL", "none", SNAP);
    expect(send.mock.calls).toEqual([["grow_check"], ["grow_check"], ["grow_check"]]);
    expect(readStockLabels().reviews!.map((r) => r.choice)).toEqual(["none", "keep", "same"]);
  });
  it("GA로 나가는 값은 category 이름뿐이다(종목·개수·종류·주기·조건 값·메모 없음)", () => {
    const a = actions();
    a.setLabel("AAPL", "check"); a.record("AAPL", "same", SNAP);
    a.setPlan("AAPL", { down: 10, memo: "실적 발표 뒤 다시 보기" });
    for (const call of send.mock.calls) expect(call).toHaveLength(1);
    expect(send.mock.calls.flat()).toEqual(["grow_label", "grow_check", "grow_plan"]);
  });
  it("recordReview: 기록·이름표·점검 시각이 쓰기 1회·push 신호 1회로 저장된다", () => {
    const a = actions();
    a.setLabel("AAPL", "check", { qty: 10, price: 190 });
    const spy = vi.spyOn(localStorage, "setItem");
    notify.mockClear();
    const after = a.record("AAPL", "same", SNAP)!;
    expect(spy).toHaveBeenCalledTimes(1);
    expect(notify).toHaveBeenCalledTimes(1);
    expect(after.items.AAPL.checkedAt).toBe(after.reviews![0].at);
    expect(after.reviews![0]).toEqual({ t: "AAPL", at: after.items.AAPL.at, from: "check", choice: "same", price: 205, rate: 10.8 });
    expect(Object.keys(after.reviews![0]).sort()).toEqual(["at", "choice", "from", "price", "rate", "t"]); // pnl·qty·score·id 없음
  });
  it("오래 둘도 '그대로 오래 둠'이 checkedAt을 쓴다(12개월 재확인 기준일)", () => {
    const a = actions();
    a.setLabel("005930", "keep");
    expect(a.record("005930", "same", SNAP)!.items["005930"].checkedAt).toBeTruthy();
  });
  it("grow_plan(·조건): 조건이 0개 → 1개가 된 저장 직후 1회. 고치기·두 번째 종목·지우고 다시는 0→1일 때만", () => {
    const a = actions();
    a.setLabel("AAPL", "check"); a.setLabel("000660", "check");
    send.mockClear();
    a.setPlan("AAPL", { down: 10 });
    a.setPlan("AAPL", { down: 12 });
    a.setPlan("000660", { up: 25 });
    expect(send.mock.calls).toEqual([["grow_plan"]]);
    expect(a.setPlan("AAPL", { down: 12 })).toBeNull(); // 같은 값 — 쓰기 없음
    a.setPlan("AAPL", {}); a.setPlan("000660", {});
    a.setPlan("AAPL", { memo: "다시" });
    expect(send.mock.calls).toEqual([["grow_plan"], ["grow_plan"]]);
  });
  it("다른 탭·pull이 바꾼 저장소 값 위에 편집을 얹는다", () => {
    const a = actions();
    a.setLabel("AAPL", "keep");
    const other = readStockLabels();
    other.items.TSLA = { label: "check", labeledAt: "2026-11-17T04:00:00.000Z", at: "2026-11-17T04:00:00.000Z" };
    localStorage.setItem(STORAGE_KEYS.stockLabels, JSON.stringify(other));
    const after = a.setLabel("NVDA", "keep")!;
    expect(Object.keys(after.items).sort()).toEqual(["AAPL", "NVDA", "TSLA"]);
  });
  it("손상 값이 있어도 사용자가 저장하면 새 값으로 교체된다", () => {
    localStorage.setItem(STORAGE_KEYS.stockLabels, "{oops");
    actions().setLabel("AAPL", "keep");
    expect(readStockLabelsState().state).toBe("ok");
    expect(send.mock.calls).toEqual([["grow_label"]]);
  });
  it("쓰기 실패(용량 초과)면 신호·GA 없이 null", () => {
    vi.spyOn(localStorage, "setItem").mockImplementation(() => { throw new Error("quota"); });
    expect(actions().setLabel("AAPL", "keep")).toBeNull();
    expect(notify).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });
});
