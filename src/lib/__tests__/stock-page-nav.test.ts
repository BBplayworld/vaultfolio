// #157 종목 한 장 이동·뒤로·GA — 해시 고정(종목명·티커 없음), 새로고침 가드, 뒤로 분기
import { describe, expect, it } from "vitest";
import {
  getBackLabel,
  guardStockPageView,
  parseHash,
  stockPageBackAction,
  toHash,
  tradesBackAction,
} from "@/app/(main)/_components/layout/navigation/navigation-context";
import { viewToKey } from "../feature-usage";
import { featureTitleOf } from "../analytics/ga";

describe("#detail/stocks-item", () => {
  it("해시 ↔ view ↔ 화면키·title, 해시에 종목명·티커가 없다", () => {
    const v = parseHash("#detail/stocks-item");
    expect(v).toEqual({ type: "detail", tab: "stocks-item" });
    expect(toHash(v)).toBe("#detail/stocks-item");
    expect(viewToKey(v)).toBe("detail:stocks-item");
    expect(featureTitleOf("asset_delete", {}, "detail:stocks-item")).toBe("상세·주식·종목");
  });

  it("뒤로 라벨: 상세·주식 진입 '주식', 시장 비교 진입 '뒤로'", () => {
    const v = { type: "detail", tab: "stocks-item" } as const;
    expect(getBackLabel(v)).toBe("주식");
    expect(getBackLabel(v, "stocks")).toBe("주식");
    expect(getBackLabel(v, "market-compare")).toBe("뒤로");
  });
});

describe("새로고침·직접 URL 가드", () => {
  const item = { type: "detail", tab: "stocks-item" } as const;
  it("대상 store가 비면 상세·주식으로, 있으면 그대로", () => {
    expect(guardStockPageView(item, false)).toEqual({ type: "detail", tab: "stocks" });
    expect(guardStockPageView(item, true)).toBe(item);
  });
  it("다른 화면은 건드리지 않는다", () => {
    const h = { type: "detail", tab: "stocks-trades" } as const;
    expect(guardStockPageView(h, false)).toBe(h);
    expect(guardStockPageView({ type: "home" }, false)).toEqual({ type: "home" });
  });
});

describe("뒤로 분기", () => {
  it("거래내역: 종목 한 장에서 열고 대상이 살아 있을 때만 종목 한 장, 그 밖은 상세·주식", () => {
    expect(tradesBackAction(true, true)).toBe("stock-page");
    expect(tradesBackAction(false, true)).toBe("stocks");
    expect(tradesBackAction(true, false)).toBe("stocks");
  });
  it("종목 한 장: 시장 비교 진입 + history 있음 → pop, 그 밖 → 상세·주식", () => {
    expect(stockPageBackAction("market-compare", 4)).toBe("pop");
    expect(stockPageBackAction("market-compare", 1)).toBe("stocks");
    expect(stockPageBackAction("stocks", 4)).toBe("stocks");
    expect(stockPageBackAction(undefined, 4)).toBe("stocks");
  });
});
