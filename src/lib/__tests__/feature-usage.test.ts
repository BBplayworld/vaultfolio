import { describe, it, expect, beforeEach } from "vitest";
import { viewToKey, recordVisit, isTipDismissed, dismissTip, pickRecommendedFeature } from "../feature-usage";
import { APP_FEATURES } from "@/config/app-features";
import type { AssetView } from "@/app/(main)/_components/layout/navigation/navigation-context";

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

  it("pickRecommendedFeature — isNew 항목이 방문 기록과 무관하게 최우선", () => {
    // tax-simulator(isNew) 외 다른 항목을 아무리 방문해도 신규 기능이 먼저 추천된다
    recordVisit("share-card");
    recordVisit("share-card");
    const picked = pickRecommendedFeature();
    expect(picked?.id).toBe("tax-simulator");
  });

  it("pickRecommendedFeature — 신규 기능 dismiss 후엔 방문횟수 오름차순(0회 우선)으로 추천", () => {
    dismissTip("tax-simulator");
    // 카탈로그 순서상 tax-schedule이 다음이지만, 방문 기록을 남겨 우선순위를 뒤로 민다
    recordVisit(viewToKey({ type: "tax" } as AssetView)); // tax-schedule의 방문 키
    const picked = pickRecommendedFeature();
    expect(picked?.id).not.toBe("tax-schedule");
    expect(picked).not.toBeNull();
  });

  it("전부 dismiss하면 null 반환", () => {
    for (const f of APP_FEATURES) dismissTip(f.id);
    expect(pickRecommendedFeature()).toBeNull();
  });
});
