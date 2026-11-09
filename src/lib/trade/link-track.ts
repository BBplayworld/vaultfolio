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
