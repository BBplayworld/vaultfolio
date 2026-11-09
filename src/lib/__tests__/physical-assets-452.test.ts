// #58 × 4.52(#93) — 완료 기준 22(잔액 맞추기 일괄 저장·saveAssetDataNotify 뒤 실물 보존)·26(맞추기·이중 반영 경고 공존)
// 이 파일은 4.52 코드(balance-edits·save-failure)가 있는 브랜치에서만 실행된다.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { applyBalanceEdits, resyncWarningText, shouldWarnTxAfterResync } from "../asset/balance-edits";
import { __resetSaveFailureForTest, saveAssetDataNotify } from "../asset/save-failure";
import { REFRESH_CATEGORIES, lastRefreshedAt, markCategoryRefreshed } from "../asset/asset-refresh-status";
import { getAssetData, saveAssetData } from "../asset/asset-storage";
import { STORAGE_KEYS } from "../local-storage";
import { computeNetAsset } from "@/contexts/asset-data-context";
import type { AssetData, PhysicalAsset } from "@/types/asset";
import { cashItem, emptyData, g, gold, memoryStorage } from "./physical-fixtures";

const RATES = { USD: 1400, JPY: 900 };
const PHYS = (): PhysicalAsset[] => [gold("P1", { grams: 37.5, nested: { a: 1 } } as Partial<PhysicalAsset>), gold("P2", { type: "silver" })];
const rawPhys = () => localStorage.getItem(STORAGE_KEYS.physicalAssets);
const loan = (id: string, balance: number) => ({ id, type: "credit", name: "신용", balance, interestRate: 5, startDate: "2025-01-01" }) as AssetData["loans"][number];

beforeEach(() => {
  g.window = globalThis;
  g.localStorage = memoryStorage();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-09T03:00:00Z"));
  __resetSaveFailureForTest();
  saveAssetData({ ...emptyData(), cash: [cashItem("c1", 10_000_000)], loans: [loan("l1", 30_000_000)], physicalAssets: PHYS() });
});
afterEach(() => { vi.useRealTimers(); delete g.window; delete g.localStorage; });

describe("22. 4.52 일괄 저장·자동 저장 경로 × 실물", () => {
  it("balance-resync-dialog와 같은 형태(getAssetData → applyBalanceEdits → 저장 1회) 뒤 실물 배열이 같다(미래 필드 포함)", () => {
    const before = rawPhys();
    const fresh = getAssetData();
    const cashRes = applyBalanceEdits(fresh.cash, { c1: 9_000_000 });
    const loanRes = applyBalanceEdits(fresh.loans, { l1: 29_000_000 });
    expect(saveAssetData({ ...fresh, cash: cashRes.list, loans: loanRes.list })).toBe(true);
    expect(rawPhys()).toBe(before);
    expect(getAssetData().cash[0].balance).toBe(9_000_000);
    expect("physicalAssets" in JSON.parse(localStorage.getItem(STORAGE_KEYS.assetData)!)).toBe(false);
  });
  it("saveAssetDataNotify(시세 갱신·닉네임 등 비편집 저장)도 실물을 분리 키에 그대로 두고 본 키에 섞지 않는다", () => {
    const before = rawPhys();
    const fresh = getAssetData();
    expect(saveAssetDataNotify({ ...fresh, nickname: "닉" })).toBe(true);
    expect(rawPhys()).toBe(before);
    // 전개 누락(실물 필드 없는 객체)으로 저장해도 실물은 지워지지 않는다
    const { physicalAssets: _omit, ...withoutPhysical } = fresh; void _omit;
    expect(saveAssetDataNotify(withoutPhysical as AssetData)).toBe(true);
    expect(rawPhys()).toBe(before);
    expect("physicalAssets" in JSON.parse(localStorage.getItem(STORAGE_KEYS.assetData)!)).toBe(false);
  });
  it("실물 저장은 markCategoryRefreshed를 호출하지 않고 RefreshCategory는 4종 그대로다", () => {
    expect(REFRESH_CATEGORIES).toEqual(["stock", "crypto", "cash", "loan"]);
    saveAssetData({ ...getAssetData(), physicalAssets: [...(getAssetData().physicalAssets ?? []), gold("P3")] });
    expect(lastRefreshedAt("cash")).toBeNull();
    expect(lastRefreshedAt("loan")).toBeNull();
  });
});

describe("26. 4.52 잔액 맞추기·이중 반영 경고 공존", () => {
  it("맞추기 저장은 실물 배열과 순자산의 실물 몫을 바꾸지 않는다", () => {
    const before = computeNetAsset(getAssetData(), RATES);
    const fresh = getAssetData();
    saveAssetData({ ...fresh, cash: applyBalanceEdits(fresh.cash, { c1: 8_000_000 }).list });
    markCategoryRefreshed("cash");
    const after = computeNetAsset(getAssetData(), RATES);
    expect(after.physicalValue).toBe(before.physicalValue);
    expect(after.cashValue).toBe(8_000_000);
    expect(JSON.parse(rawPhys()!)).toHaveLength(2);
  });
  it("현금 거래 이중 반영 경고 판정은 실물 보유와 무관하다(거래일 이후 맞춘 경우만 true)", () => {
    markCategoryRefreshed("cash"); // 오늘(2026-11-09 KST) 맞춤
    const at = lastRefreshedAt("cash");
    expect(shouldWarnTxAfterResync({ txDate: "2026-11-09", reflected: true, refreshedAtIso: at })).toBe(true);
    expect(shouldWarnTxAfterResync({ txDate: "2026-11-10", reflected: true, refreshedAtIso: at })).toBe(false);
    expect(shouldWarnTxAfterResync({ txDate: "2026-11-09", reflected: false, refreshedAtIso: at })).toBe(false);
    expect(resyncWarningText("cash", at!, "2026-11-09")).toContain("오늘 맞춘 현금 잔액");
    // 실물이 없어도 같은 판정
    saveAssetData({ ...getAssetData(), physicalAssets: [] });
    expect(shouldWarnTxAfterResync({ txDate: "2026-11-09", reflected: true, refreshedAtIso: at })).toBe(true);
  });
  it("경고가 떠도 실물 저장·결산 실물 항목은 바뀌지 않는다(경고는 표시 판정뿐, 저장 경로 호출 0)", () => {
    const before = rawPhys();
    markCategoryRefreshed("loan");
    shouldWarnTxAfterResync({ txDate: "2026-11-09", reflected: true, refreshedAtIso: lastRefreshedAt("loan") });
    expect(rawPhys()).toBe(before);
  });
});
