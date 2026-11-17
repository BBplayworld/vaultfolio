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
    expect(a.markChecked("AAPL")?.items.AAPL.checkedAt).toBeTruthy();
    expect(a.setCycle(3)?.cycle.months).toBe(3);
    expect(notify).toHaveBeenCalledTimes(3);
    const raw = localStorage.getItem(STORAGE_KEYS.stockLabels);
    expect(a.setLabel("AAPL", "check")).toBeNull();
    expect(a.setCycle(3)).toBeNull();
    expect(a.markChecked("NVDA")).toBeNull(); // '점검할 자산'이 아닌 종목
    expect(notify).toHaveBeenCalledTimes(3);
    expect(localStorage.getItem(STORAGE_KEYS.stockLabels)).toBe(raw);
  });
  it("이름표를 붙일 때 넘긴 기준값이 함께 저장되고, 점검·주기로는 바뀌지 않는다(AC-28)", () => {
    const a = actions();
    const base = { qty: 12, price: 185.5, priceAt: "2026-11-14", weight: 20.5 };
    expect(a.setLabel("AAPL", "check", base)?.items.AAPL.base).toEqual(base);
    a.markChecked("AAPL"); a.setCycle(6);
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
  it("grow_check: 점검을 저장할 때마다 1회", () => {
    const a = actions();
    a.setLabel("AAPL", "check");
    send.mockClear();
    a.markChecked("AAPL");
    a.markChecked("AAPL");
    expect(send.mock.calls).toEqual([["grow_check"], ["grow_check"]]);
  });
  it("GA로 나가는 값은 category 이름뿐이다(종목·개수·종류·주기 없음)", () => {
    const a = actions();
    a.setLabel("AAPL", "check"); a.markChecked("AAPL");
    for (const call of send.mock.calls) expect(call).toHaveLength(1);
    expect(send.mock.calls.flat()).toEqual(["grow_label", "grow_check"]);
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
