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

import { isKrBusinessDay } from "./kr-holidays";
import { isUsBusinessDay } from "./us-holidays";

// 미국 동부 서머타임(EDT) 여부 (Intl로 정확 판정)
function isUsEasternDST(date: Date): boolean {
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

  // 자정 넘김 케이스(해외) 포함 장중 판정
  const isInSession = openHHMM < closeHHMM
    ? hhmm >= openHHMM && hhmm < closeHHMM
    : hhmm >= openHHMM || hhmm < closeHHMM;
  if (!isInSession) return effectiveDate;

  // 영업일 판정: 휴장일에는 1시간 슬롯 사용하지 않음 (일 단위 캐시만 유지)
  // - domestic: KST 오늘 = 한국 영업일
  // - foreign: 미국 장 운영 기준일 — KST 새벽(<closeHHMM)은 ET 전일, KST 오후(>=openHHMM)는 ET 당일
  let isBusinessDay: boolean;
  if (type === "domestic") {
    isBusinessDay = isKrBusinessDay(nowKST);
  } else {
    const etRefDate = new Date(nowKST);
    if (hhmm < closeHHMM) etRefDate.setUTCDate(etRefDate.getUTCDate() - 1);
    isBusinessDay = isUsBusinessDay(etRefDate);
  }
  if (!isBusinessDay) return effectiveDate;

  const hour = String(nowKST.getUTCHours()).padStart(2, "0");
  return `${effectiveDate}-H${hour}`;
}
