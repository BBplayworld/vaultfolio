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
    // 4.79(#153)부터 '주간 변화 원인'이 카탈로그 앞쪽 isNew — 방문 기록이 있어도 그 항목이 최우선이고,
    // 닫으면(dismiss) 4.72(#132)부터 isNew인 '시장과 비교'가 이어서 뜬다.
    const target = APP_FEATURES.find((f) => f.isNew)!;
    expect(target.id).toBe("week-causes");
    recordVisit("activity:change-market");
    recordVisit("activity:change-market");
    const picked = pickRecommendedFeature();
    expect(picked?.isNew).toBe(true);
    expect(picked?.id).toBe(target.id);
    dismissTip("week-causes");
    expect(pickRecommendedFeature()?.id).toBe("market-compare");
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
