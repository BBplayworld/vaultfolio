/**
 * stock-cache-slot.ts
 * 서버(Redis/파일 캐시)와 클라이언트(localStorage) 모두에서 사용하는
 * 주식 캐시 슬롯 유틸리티.
 *
 * 장중에는 1시간 단위 슬롯을 반환하여 캐시 갱신 주기를 제어합니다.
 * 장외에는 유효 날짜만 반환하여 다음 개장까지 캐시를 유지합니다.
 *
 * 순수 함수: Node.js / 브라우저 양쪽에서 동작 (fs, Redis 의존 없음)
 */

import { isKrBusinessDay, rollbackToBusinessDay } from "./kr-holidays";
import { isUsBusinessDay, rollbackToUsBusinessDay } from "./us-holidays";

// 미국 동부 서머타임(EDT) 여부 (Intl로 정확 판정)
export function isUsEasternDST(date: Date): boolean {
  const tz = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", timeZoneName: "short" })
    .formatToParts(date).find((p) => p.type === "timeZoneName")?.value ?? "";
  return tz === "EDT";
}

/**
 * 시장 마감 시간 기준 유효 캐시 날짜 반환 (KST)
 * - foreign: 미국 장 마감 후 오전 07:00 KST 이후 → 오늘 날짜 유효
 * - domestic: 국내 장 마감 오후 16:00 KST 이후 → 오늘 날짜 유효
 * - exchange: 서울외국환중개 기준 오전 09:00 KST 이후 → 오늘 날짜 유효
 * 마감 전이면 어제 날짜를 반환 (전일 종가/환율이 최신)
 */
export function getEffectiveDateStr(type: "domestic" | "foreign" | "exchange"): string {
  const nowKST = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const hhmm = nowKST.getUTCHours() * 100 + nowKST.getUTCMinutes();

  const cutoff = type === "foreign" ? 700 : type === "domestic" ? 1600 : 900;
  const todayStr = nowKST.toISOString().split("T")[0];
  if (hhmm >= cutoff) return todayStr;

  const yesterday = new Date(nowKST);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  return yesterday.toISOString().split("T")[0];
}

/**
 * 시장별 주식 캐시 슬롯 식별자.
 * - 장중: "{effectiveDate}-H{HH}"  (KST 기준 1시간 단위로 갱신)
 * - 장외: effectiveDate 그대로 (다음 장 개장 전까지 캐시 유효)
 *
 * 장중 시간 (KST):
 * - domestic: 09:00 ~ 20:00
 * - foreign DST: 17:00 (프리마켓) ~ 익일 05:00
 * - foreign STD: 18:00 (프리마켓) ~ 익일 06:00
 */
export function getStockCacheSlot(type: "domestic" | "foreign"): string {
  const effectiveDate = getEffectiveDateStr(type);
  const nowKST = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const hhmm = nowKST.getUTCHours() * 100 + nowKST.getUTCMinutes();

  let openHHMM: number;
  let closeHHMM: number;
  if (type === "domestic") {
    openHHMM = 900;
    closeHHMM = 2000;
  } else {
    const isDST = isUsEasternDST(new Date());
    openHHMM = isDST ? 1700 : 1800; // 프리마켓 기준 (ET 04:00 AM)
    closeHHMM = isDST ? 500 : 600;
  }

  // 영업일 판정 기준일 — foreign은 KST 새벽(<closeHHMM)이면 ET 전일, KST 오후(>=openHHMM)면 ET 당일
  let bizRefDate: Date;
  if (type === "domestic") {
    bizRefDate = nowKST;
  } else {
    bizRefDate = new Date(nowKST);
    if (hhmm < closeHHMM) bizRefDate.setUTCDate(bizRefDate.getUTCDate() - 1);
  }
  const isBusinessDay = type === "domestic" ? isKrBusinessDay(bizRefDate) : isUsBusinessDay(bizRefDate);

  // 휴장일(주말·공휴일)은 시간대와 무관하게 직전 영업일로 slot을 고정한다.
  // effectiveDate는 달력 날짜라 휴장일에도 매일 바뀌어, 예전엔 주말 내내 매일 재조회(currentPrice 흔들림)가 발생했다
  // → 원인분해가 "휴장일 시세 변동"으로 오인하는 원인이었음(실측 종가는 안 바뀌었는데 실시간 quote만 흔들림).
  if (!isBusinessDay) {
    const lastBizDate = type === "domestic" ? rollbackToBusinessDay(bizRefDate) : rollbackToUsBusinessDay(bizRefDate);
    return lastBizDate.toISOString().split("T")[0];
  }

  // 자정 넘김 케이스(해외) 포함 장중 판정
  const isInSession = openHHMM < closeHHMM
    ? hhmm >= openHHMM && hhmm < closeHHMM
    : hhmm >= openHHMM || hhmm < closeHHMM;
  if (!isInSession) {
    // 오늘(bizRefDate)이 영업일이어도 "오늘 세션 개장 전" 구간이면 유효 데이터는 여전히 어제 종가다.
    // effectiveDate만 쓰면(해외는 마감 컷오프 07:00이 개장 17:00/18:00보다 훨씬 일러) 07:00~개장 전
    // 구간에서 "오늘" 라벨에 어제 종가가 캐싱되고, 이 라벨이 이후 휴장일 롤백 결과(81~84행)와
    // 동일해져 어제 종가로 정상 교체돼야 할 캐시가 갱신되지 않는 버그가 있었다.
    const beforeTodaysOpen = openHHMM < closeHHMM
      ? hhmm < openHHMM
      : hhmm >= closeHHMM && hhmm < openHHMM;
    if (beforeTodaysOpen) {
      const prevDay = new Date(bizRefDate);
      prevDay.setUTCDate(prevDay.getUTCDate() - 1);
      const lastBizDate = type === "domestic" ? rollbackToBusinessDay(prevDay) : rollbackToUsBusinessDay(prevDay);
      return lastBizDate.toISOString().split("T")[0];
    }
    return effectiveDate;
  }

  const hour = String(nowKST.getUTCHours()).padStart(2, "0");
  return `${effectiveDate}-H${hour}`;
}
