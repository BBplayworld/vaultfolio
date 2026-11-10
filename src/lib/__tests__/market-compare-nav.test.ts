// #132 U4 시장과 비교 이동·뒤로(K3)·GA title
import { describe, expect, it } from "vitest";
import {
  getBackLabel,
  marketCompareBackAction,
  parseHash,
  toHash,
  withRestoredChangeInit,
} from "@/app/(main)/_components/layout/navigation/navigation-context";
import { viewToKey } from "../feature-usage";
import { featureTitleOf } from "../analytics/ga";

describe("#activity/change-market 해시", () => {
  it("해시 ↔ view ↔ 화면키", () => {
    const v = parseHash("#activity/change-market");
    expect(v).toEqual({ type: "activity", tab: "change-market" });
    expect(toHash(v)).toBe("#activity/change-market");
    expect(viewToKey(v)).toBe("activity:change-market");
  });

  it("뒤로 라벨은 중립 '뒤로'(진입로 2곳), 자산 변화는 그대로 '성과'", () => {
    expect(getBackLabel({ type: "activity", tab: "change-market" })).toBe("뒤로");
    expect(getBackLabel({ type: "activity", tab: "change" })).toBe("성과");
  });
});

describe("K3 뒤로 복원", () => {
  it("앱 안 진입이면 pop, 주소 진입·새로고침(메모리 false)이나 history 1개면 자산 변화(주식·주)", () => {
    expect(marketCompareBackAction(true, 5)).toBe("pop");
    expect(marketCompareBackAction(false, 5)).toBe("change");
    expect(marketCompareBackAction(true, 1)).toBe("change");
  });

  const market = parseHash("#activity/change-market");
  const remembered = { scope: "stock" as const, period: "day" as const };

  it("비교 화면에서 pop으로 자산 변화에 돌아오면 기억한 범위·기간을 init으로 입힌다", () => {
    expect(withRestoredChangeInit(parseHash("#activity/change"), market, remembered)).toEqual({ type: "activity", tab: "change", init: { scope: "stock", period: "day" } });
  });

  it("기억이 없거나(새로고침) 비교 화면에서 온 게 아니면 그대로, 해시 리다이렉트 init·다른 화면은 건드리지 않는다", () => {
    expect(withRestoredChangeInit(parseHash("#activity/change"), market, null)).toEqual({ type: "activity", tab: "change" });
    expect(withRestoredChangeInit(parseHash("#activity/change"), { type: "activity", tab: "hub" }, remembered)).toEqual({ type: "activity", tab: "change" });
    expect(withRestoredChangeInit(parseHash("#detail/stocks"), market, remembered)).toEqual({ type: "detail", tab: "stocks" });
    expect(withRestoredChangeInit(parseHash("#activity/profit"), market, remembered)).toEqual({ type: "activity", tab: "change", init: { scope: "stock", period: "day" } });
  });
});

describe("GA title(맞춤 정의 0)", () => {
  it("비교 페이지 page_view title, 주식 범위 전환 이벤트 title", () => {
    expect(featureTitleOf("asset_delete", {}, "activity:change-market")).toBe("성과·자산 변화·시장 비교");
    expect(featureTitleOf("feature_use", { category: "change_scope_stock" }, "activity:change")).toBe("성과·자산 변화·주식");
  });
});
