import { describe, it, expect } from "vitest";
import { parseHash, toHash } from "@/app/(main)/_components/layout/navigation/navigation-context";
import { viewToKey } from "../feature-usage";
import { APP_FEATURES } from "@/config/app-features";

// #32 성과 메뉴 정리 — 옛 해시 리다이렉트·화면키·기능 카탈로그 회귀
describe("성과 자산 변화 해시", () => {
  it("#activity/netasset → 자산 변화(전체·연), #activity/profit → 자산 변화(주식·일)", () => {
    expect(parseHash("#activity/netasset")).toEqual({ type: "activity", tab: "change", init: { scope: "all", period: "year" } });
    expect(parseHash("#activity/profit")).toEqual({ type: "activity", tab: "change", init: { scope: "stock", period: "day" } });
  });

  it("리다이렉트 결과의 해시·화면키는 새 값", () => {
    const v = parseHash("#activity/netasset");
    expect(toHash(v)).toBe("#activity/change");
    expect(viewToKey(v)).toBe("activity:change");
    expect(parseHash("#activity/change")).toEqual({ type: "activity", tab: "change" });
  });

  it("사전 밖·프로토타입 키는 홈으로", () => {
    expect(parseHash("#activity/constructor")).toEqual({ type: "home" });
    expect(parseHash("#activity/unknown")).toEqual({ type: "home" });
  });

  it("기능 카탈로그에서 순자산·수익 카드가 자산 변화 1개로 합쳐졌다", () => {
    const ids = APP_FEATURES.map((f) => f.id);
    expect(ids).toContain("change");
    expect(ids).not.toContain("netasset");
    expect(ids).not.toContain("profit");
  });
});
