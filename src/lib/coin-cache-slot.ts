/**
 * coin-cache-slot.ts
 * 암호화폐 캐시 슬롯 유틸리티 (서버·클라이언트 공용).
 *
 * 주식(stock-cache-slot.ts)과 달리 코인은 24시간 무휴장이라
 * 장중/장외·영업일·서머타임 판정이 전부 무의미하다.
 * 따라서 항상 1시간 단위 슬롯만 반환한다.
 *
 * 순수 함수: Node.js / 브라우저 양쪽에서 동작
 */

/**
 * 코인 캐시 슬롯 식별자 — 항상 "{YYYY-MM-DD}-H{HH}" (KST 기준)
 * 예: "2026-07-20-H14"
 */
export function getCoinCacheSlot(): string {
  const nowKST = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const date = nowKST.toISOString().split("T")[0];
  const hour = String(nowKST.getUTCHours()).padStart(2, "0");
  return `${date}-H${hour}`;
}
