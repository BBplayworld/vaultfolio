import { track } from "@/lib/analytics/ga";
import type { LinkChoice } from "./linked-record";

/**
 * 연결 저장 성공 1회 = feature_use `거래 저장·계좌 함께 반영` 1건(#103). 호출부는 저장이 성공한 뒤에만 부른다.
 * 연결 안 함(link 없음)이면 0건. 현금/대출·매수/매도·금액·계좌명은 보내지 않는다(category 1개만).
 */
export function trackLinkedTrade(link: LinkChoice | undefined): void {
  if (!link) return;
  track("feature_use", { category: "linked_trade" });
}

/**
 * 검색으로 고른 처음 사는 종목의 거래 저장 성공 뒤 1회(#258). 연결 계좌까지 저장했으면 `_linked` 1건 더.
 * 호출부는 저장 성공 뒤에만, 새 종목을 만든 경우에만 부른다(기존 종목 전환·같은 종목 다른 증권사는 0건). 종목·금액·계좌 미전송.
 */
export function trackTradeNewStock(link: LinkChoice | undefined): void {
  track("feature_use", { category: "trade_new_stock" });
  if (link) track("feature_use", { category: "trade_new_stock_linked" });
}
