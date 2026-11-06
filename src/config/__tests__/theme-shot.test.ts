import { describe, it, expect } from "vitest";
import { ASSET_THEME_SHOT, ASSET_THEME_SHOT_BIG, ASSET_THEME } from "../theme";

// 인증카드 토큰 고정(#4.44): 상세 다크 개편이 인증카드 클래스를 바꾸지 않았음을 보장한다.
describe("인증카드 토큰 고정", () => {
  it("ASSET_THEME_SHOT", () => { expect(ASSET_THEME_SHOT).toMatchInlineSnapshot(`
    {
      "badge": "text-[9px] px-1 py-0 ml-1 leading-tight",
      "bodyText": "text-xs sm:text-sm",
      "cardAmountMain": "text-xs sm:text-sm font-bold tabular-nums leading-tight",
      "cardHeader": "flex flex-wrap items-center gap-4 py-2 transition-colors",
      "cardInfoName": "font-semibold text-xs sm:text-sm leading-tight",
      "cardTriggerButton": "flex items-center gap-4 flex-1 min-w-0 text-left",
      "icon": "size-5",
      "iconInitial": "text-[8px]",
      "legendGrid": "grid grid-cols-2 gap-x-4 gap-y-2 px-2",
      "legendText": "text-xs sm:text-sm",
      "profitAmount": "text-sm font-bold tabular-nums whitespace-nowrap",
      "profitRate": "text-xs sm:text-sm font-bold tabular-nums whitespace-nowrap",
      "summaryValue": "text-[17px] font-bold tabular-nums break-all leading-tight",
    }
  `); });
  it("ASSET_THEME_SHOT_BIG", () => { expect(ASSET_THEME_SHOT_BIG).toMatchInlineSnapshot(`
    {
      "badge": "text-[15px] px-1 py-0 ml-1 leading-tight",
      "bodyText": "text-[20px]",
      "cardAmountMain": "text-[20px] font-bold tabular-nums leading-tight",
      "cardHeader": "flex flex-wrap items-center gap-4 py-2 transition-colors",
      "cardInfoName": "font-semibold text-[20px] leading-tight",
      "cardTriggerButton": "flex items-center gap-4 flex-1 min-w-0 text-left",
      "icon": "size-[35px]",
      "iconInitial": "text-[13px]",
      "legendGrid": "grid grid-cols-2 gap-x-4 gap-y-2 px-2",
      "legendText": "text-[20px]",
      "profitAmount": "text-[23px] font-bold tabular-nums whitespace-nowrap",
      "profitRate": "text-[20px] font-bold tabular-nums whitespace-nowrap",
      "summaryValue": "text-[29px] font-bold tabular-nums break-all leading-tight",
    }
  `); });
  it("cardWrapper는 투명 유지(인증카드 공유)", () => { expect(ASSET_THEME.cardWrapper).toBe("rounded-lg overflow-hidden border-0 bg-transparent"); });
});
