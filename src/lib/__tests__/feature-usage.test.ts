import { describe, it, expect, beforeEach } from "vitest";
import type { AssetData } from "@/types/asset";
import { viewToKey, recordVisit, isTipDismissed, dismissTip, pickRecommendedFeature } from "../feature-usage";
import { APP_FEATURES } from "@/config/app-features";
import type { AssetView } from "@/app/(main)/_components/layout/navigation/navigation-context";

// 전 자산군 보유 픽스처 — 필터 영향 없는 main 동일 기대값용
const ALL = {
  stocks: [{ category: "foreign", currency: "USD", quantity: 1 }],
  realEstate: [{}],
  crypto: [{}],
  cash: [{}],
  loans: [{}],
} as unknown as AssetData;

describe("feature-usage", () => {
  const store = new Map<string, string>();
  const shim = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => { store.set(k, v); },
    removeItem: (k: string) => { store.delete(k); },
  };

  beforeEach(() => {
    store.clear();
    (globalThis as Record<string, unknown>).window = globalThis;
    (globalThis as Record<string, unknown>).localStorage = shim;
  });

  it("viewToKey — detail/activity는 type:tab, 그 외는 type", () => {
    expect(viewToKey({ type: "home" } as AssetView)).toBe("home");
    expect(viewToKey({ type: "tax" } as AssetView)).toBe("tax");
    expect(viewToKey({ type: "detail", tab: "stocks" } as AssetView)).toBe("detail:stocks");
    expect(viewToKey({ type: "activity", tab: "report" } as AssetView)).toBe("activity:report");
  });

  it("dismissTip 이후 isTipDismissed는 true, 재호출해도 중복 저장 안 됨", () => {
    expect(isTipDismissed("tax-simulator")).toBe(false);
    dismissTip("tax-simulator");
    dismissTip("tax-simulator");
    expect(isTipDismissed("tax-simulator")).toBe(true);
  });

  it("pickRecommendedFeature — isNew 없이 방문횟수가 가장 적은 항목(동률은 카탈로그 순서)을 추천", () => {
    expect(pickRecommendedFeature(ALL)?.id).toBe(APP_FEATURES[0].id);
    recordVisit("tax"); // tax-simulator 방문 → 다음 카탈로그 항목으로
    expect(pickRecommendedFeature(ALL)?.id).not.toBe("tax-simulator");
    expect(APP_FEATURES.some((f) => "isNew" in f)).toBe(false);
  });

  it("pickRecommendedFeature — 신규 기능 dismiss 후엔 방문횟수 오름차순(0회 우선)으로 추천", () => {
    dismissTip("tax-simulator");
    // 카탈로그 순서상 tax-schedule이 다음이지만, 방문 기록을 남겨 우선순위를 뒤로 민다
    recordVisit(viewToKey({ type: "tax" } as AssetView)); // tax-schedule의 방문 키
    const picked = pickRecommendedFeature(ALL);
    expect(picked?.id).not.toBe("tax-schedule");
    expect(picked).not.toBeNull();
  });

  it("전부 dismiss하면 null 반환", () => {
    for (const f of APP_FEATURES) dismissTip(f.id);
    expect(pickRecommendedFeature(ALL)).toBeNull();
  });
});
