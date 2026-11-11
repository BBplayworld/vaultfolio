// #147 A3 — clearAssetData(동기화 pull·백업 복원 경로)가 기능 팁 해제 기록(`relink-offer` 포함)을 지우지 않는다. 다른 secretasset_ 키는 그대로 지운다.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { clearAssetData } from "../asset/asset-storage";
import { dismissTip, isTipDismissed } from "../feature-usage";
import { RELINK_OFFER_ID } from "../asset/resync";
import { STORAGE_KEYS } from "../local-storage";
import { g, memoryStorage } from "./physical-fixtures";

beforeEach(() => {
  g.window = globalThis;
  g.localStorage = memoryStorage();
});
afterEach(() => {
  delete g.window; delete g.localStorage;
});

describe("'그대로 두기' 유지(A3)", () => {
  it("dismissTip(relink-offer) 후 clearAssetData(pull·복원)를 거쳐도 해제 상태가 남는다", () => {
    dismissTip(RELINK_OFFER_ID);
    localStorage.setItem(STORAGE_KEYS.assetData, "{}");
    localStorage.setItem("secretasset_some_cache", "x");
    expect(clearAssetData()).toBe(true);
    expect(isTipDismissed(RELINK_OFFER_ID)).toBe(true);
    expect(localStorage.getItem(STORAGE_KEYS.assetData)).toBeNull();
    expect(localStorage.getItem("secretasset_some_cache")).toBeNull();
  });
  it("해제하지 않았다면 기본은 미해제, 키 형식은 기존 dismissedTipIds 그대로(새 키 0)", () => {
    expect(isTipDismissed(RELINK_OFFER_ID)).toBe(false);
    dismissTip(RELINK_OFFER_ID);
    expect(JSON.parse(localStorage.getItem(STORAGE_KEYS.featureUsage)!)).toEqual({ visits: {}, dismissedTipIds: [RELINK_OFFER_ID] });
    expect(STORAGE_KEYS.featureUsage).toBe("secretasset_feature_usage");
  });
});
