// #110 이어서 맞추기 — 저장 신호·오늘 맞춤(KST)·정렬·복귀 판정·정적 검사
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isRefreshedToday, markCategoryRefreshed, CATEGORY_REFRESHED_EVENT } from "../asset-refresh-status";
import { consumeResyncSignal, resyncNoticeText, shouldTrackResyncContinue, sortHoldingsRows } from "../resync-return";

const store = new Map<string, string>();
const events: Array<{ type: string; detail: unknown }> = [];
beforeEach(() => {
  store.clear();
  events.length = 0;
  vi.stubGlobal("window", { dispatchEvent: (e: CustomEvent) => { events.push({ type: e.type, detail: e.detail }); return true; } });
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  });
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("markCategoryRefreshed 신호", () => {
  it("기본은 이벤트 1회(detail.category), notify:false는 미발행", () => {
    markCategoryRefreshed("stock");
    expect(events).toEqual([{ type: CATEGORY_REFRESHED_EVENT, detail: { category: "stock" } }]);
    markCategoryRefreshed("crypto", { notify: false });
    expect(events).toHaveLength(1);
  });
});

describe("isRefreshedToday (KST)", () => {
  it("KST 날짜 경계", () => {
    vi.setSystemTime(new Date("2026-11-09T03:00:00Z")); // KST 11-09
    vi.stubGlobal("localStorage", { getItem: () => JSON.stringify({ categories: { cash: "2026-11-08T14:59:00Z" } }), setItem: () => {} });
    expect(isRefreshedToday("cash")).toBe(false); // KST 11-08 23:59
    vi.stubGlobal("localStorage", { getItem: () => JSON.stringify({ categories: { cash: "2026-11-08T15:00:00Z" } }), setItem: () => {} });
    expect(isRefreshedToday("cash")).toBe(true); // KST 11-09 00:00
    vi.stubGlobal("localStorage", { getItem: () => null, setItem: () => {} });
    expect(isRefreshedToday("cash")).toBe(false);
  });
});

const ROWS = ["real-estate", "stock", "crypto", "cash", "physical", "loan", "yearly-net-asset"].map((type) => ({ type }));
describe("sortHoldingsRows", () => {
  it("주식·현금 보유 → 보유 먼저, 미보유는 기존 순서, 과거 순자산 맨 아래", () => {
    const out = sortHoldingsRows(ROWS, (t) => t === "stock" || t === "cash").map((r) => r.type);
    expect(out).toEqual(["stock", "cash", "real-estate", "crypto", "physical", "loan", "yearly-net-asset"]);
  });
  it("보유 0이면 현행 순서", () => {
    expect(sortHoldingsRows(ROWS, () => false).map((r) => r.type)).toEqual(ROWS.map((r) => r.type));
  });
});

describe("resyncNoticeText", () => {
  const today = () => true;
  it("보유 4종 모두 맞춤 + 부동산·실물 미보유 = 모두 맞췄어요", () => {
    expect(resyncNoticeText("cash", { held: ["stock", "cash"], refreshedToday: today, hasRealEstateOrPhysical: false })).toBe("보유한 자산을 모두 맞췄어요");
  });
  it("부동산·실물 보유면 자산군 문구", () => {
    expect(resyncNoticeText("cash", { held: ["stock", "cash"], refreshedToday: today, hasRealEstateOrPhysical: true })).toBe("현금성 자산 맞췄어요");
  });
  it("일부만 맞춤이면 자산군 문구", () => {
    expect(resyncNoticeText("stock", { held: ["stock", "cash"], refreshedToday: (c) => c === "stock", hasRealEstateOrPhysical: false })).toBe("주식 맞췄어요");
  });
});

describe("consumeResyncSignal", () => {
  it("같은 자산군만 복귀하고 대기를 비운다(중복 신호 무시)", () => {
    const a = consumeResyncSignal("stock", "stock");
    expect(a).toEqual({ resume: true, armed: null });
    expect(consumeResyncSignal(a.armed, "stock").resume).toBe(false);
  });
  it("대기 없음·다른 자산군 신호는 무시", () => {
    expect(consumeResyncSignal(null, "stock").resume).toBe(false);
    expect(consumeResyncSignal("stock", "crypto")).toEqual({ resume: false, armed: "stock" });
  });
});

describe("shouldTrackResyncContinue", () => {
  it("복귀 목록의 다른 최신화 행 = 1, 같은 행·일반 진입·보유 외 행 = 0", () => {
    expect(shouldTrackResyncContinue("stock", "cash")).toBe(true);
    expect(shouldTrackResyncContinue("stock", "stock")).toBe(false);
    expect(shouldTrackResyncContinue(null, "cash")).toBe(false);
    expect(shouldTrackResyncContinue("stock", "yearly-net-asset")).toBe(false);
  });
});

describe("정적 검사", () => {
  const root = path.resolve(__dirname, "../../..");
  const read = (f: string) => readFileSync(path.join(root, f), "utf8");
  it("거래 스크린샷 2곳·보유 현황 맞추기 적용은 notify:false, 닫을 때 신호", () => {
    const trade = read("app/(main)/_components/forms/trade/crypto-trade-screenshot-import.tsx");
    expect(trade.match(/markCategoryRefreshed\("crypto", \{ notify: false \}\)/g)).toHaveLength(2);
    const dlg = read("app/(main)/_components/forms/asset-update/screenshot/holdings-resync-dialog.tsx");
    expect(dlg).toMatch(/markCategoryRefreshed\(kind, \{ notify: false \}\)/);
    expect(dlg).toMatch(/notifyCategoryRefreshed\(kind\)/);
  });
  it("FAB는 이어서 맞추기 GA category 1개만 추가하고 새 저장 키를 쓰지 않는다", () => {
    const fab = read("app/(main)/_components/layout/floating/floating-add-button.tsx");
    expect(fab.match(/category: "resync_continue"/g)).toHaveLength(1);
    expect(fab).not.toMatch(/localStorage|STORAGE_KEYS/);
  });
});
