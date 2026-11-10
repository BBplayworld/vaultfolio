// #132 U4 시장과 비교 이동·뒤로(K3)·GA title
import { describe, expect, it } from "vitest";
import {
  changeInitFromHistoryState,
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

  it("pop으로 자산 변화에 돌아오면 history.state의 범위·기간을 init으로 입힌다", () => {
    const state = { __NA: true, changeInit: { scope: "stock", period: "day" } };
    expect(withRestoredChangeInit(parseHash("#activity/change"), state)).toEqual({ type: "activity", tab: "change", init: { scope: "stock", period: "day" } });
  });

  it("상태가 없거나 모양이 틀리면 그대로(기본값), 다른 화면·리다이렉트 init은 건드리지 않는다", () => {
    expect(withRestoredChangeInit(parseHash("#activity/change"), null)).toEqual({ type: "activity", tab: "change" });
    expect(changeInitFromHistoryState({ changeInit: { scope: "stock", period: "decade" } })).toBeUndefined();
    expect(changeInitFromHistoryState({ changeInit: { scope: "x", period: "day" } })).toBeUndefined();
    expect(changeInitFromHistoryState("str")).toBeUndefined();
    const st = { changeInit: { scope: "stock", period: "month" } };
    expect(withRestoredChangeInit(parseHash("#detail/stocks"), st)).toEqual({ type: "detail", tab: "stocks" });
    expect(withRestoredChangeInit(parseHash("#activity/profit"), st)).toEqual({ type: "activity", tab: "change", init: { scope: "stock", period: "day" } });
  });
});

describe("GA title(맞춤 정의 0)", () => {
  it("비교 페이지 page_view title, 주식 범위 전환 이벤트 title", () => {
    expect(featureTitleOf("asset_delete", {}, "activity:change-market")).toBe("성과·자산 변화·시장 비교");
    expect(featureTitleOf("feature_use", { category: "change_scope_stock" }, "activity:change")).toBe("성과·자산 변화·주식");
  });
});
