// 알림 문구·발송일 판정(#179, 4.91) — 순수 함수. 날짜표·공개 시세만 쓰고 사용자 정보는 보지 않는다. 평가어·조언·뉴스·AI 문장 0.
// 문구는 상태 안내('열렸어요')만 — 요청형·조언·금액·'내'·'보유' 0. 결산 창 첫날은 앱의 결산 창 로직(isSettlementWindowOpenDay)을 재사용한다.
import { formatCompareRate, rateTenths } from "@/lib/finance/market-compare";
import { isKrHoliday, rollbackToBusinessDay } from "@/lib/finance/kr-holidays";
import { isUsHoliday, rollbackToUsBusinessDay } from "@/lib/finance/us-holidays";
import { CARD_UNTIL_DAY, isSettlementWindowOpenDay } from "@/lib/report/settlement";
import type { PushCond, PushKind, PushPayload } from "./types";
import type { PushQuote } from "./quotes";

export const PUSH_FALLBACK_TITLE = "시크릿에셋";
export const PUSH_FALLBACK_BODY = "새 알림이 도착했어요";

/** 세금 마감 알림 날짜표(KST MM-DD). 근거 일정: tax-calendar.ts capital-gains-final·income-tax-final(~5/31), pension-contribution-deadline(~12/31) */
export const TAX_PUSH_DATES = {
  "05-01": { t: "5월은 세금 신고 기간이에요", b: "해외주식 양도소득세·종합소득세 신고는 5월 31일까지예요" },
  "12-24": { t: "연금저축·IRP 세액공제", b: "12/31 납입분까지예요" },
} as const satisfies Record<string, { t: string; b: string }>;

/** '2026-11-12' → '11/12' */
export function formatMonthDay(date: string): string {
  const [, m, d] = date.split("-");
  return `${Number(m)}/${Number(d)}`;
}

export function buildSettleMessage(today: string): PushPayload {
  const month = Number(today.slice(5, 7));
  const next = month === 12 ? 1 : month + 1;
  return { m: "settle", t: `${month}월 결산이 열렸어요`, b: `${next}월 ${CARD_UNTIL_DAY}일까지 이번 달 자산 변화를 볼 수 있어요` };
}

/** 오늘(KST YYYY-MM-DD) 보낼 알림 목록 — 없으면 빈 배열 */
export function pushDueOn(today: string): { kind: PushKind; payload: PushPayload }[] {
  const due: { kind: PushKind; payload: PushPayload }[] = [];
  if (isSettlementWindowOpenDay(today)) due.push({ kind: "settle", payload: buildSettleMessage(today) });
  const tax = (TAX_PUSH_DATES as Record<string, { t: string; b: string }>)[today.slice(5)];
  if (tax) due.push({ kind: "tax", payload: { m: "tax", ...tax } });
  return due;
}

// ── 시장 알림(① 아침 시장 요약·② 국내 장 마감) ────────────────────────────

export const PUSH_BIG_INDEX_TENTHS = 20; // 지수 ±2.0% 이상 = 큰 움직임(조건 pm2의 발송 기준)
export const PUSH_BIG_FX_TENTHS = 10; // 환율 ±1.0% 이상 — 본문 맨 앞으로, 조건 pm2의 발송 기준에도 포함

/** 합치기 우선순위(09시 회차) — 앞이 제목·도착 화면을 정한다. 국내 장 마감은 16시 단독 회차 */
export const PUSH_MERGE_ORDER: readonly PushKind[] = ["settle", "tax", "morning", "kr"];

const isBig = (q: PushQuote) => Math.abs(rateTenths(q.rate)) >= (q.kind === "fx" ? PUSH_BIG_FX_TENTHS : PUSH_BIG_INDEX_TENTHS);
// 조건 pm2 판정 — 지수 ±2% 또는 환율 ±1%(환율은 날짜 검증을 통과해 quotes에 들어온 경우만)
const hasBig = (qs: readonly PushQuote[]) => qs.some(isBig);

function formatQuote(q: PushQuote): string {
  return q.kind === "fx" ? `환율 ${Math.round(q.price).toLocaleString("en-US")}원(${formatCompareRate(q.rate)})` : `${q.label} ${formatCompareRate(q.rate)}`;
}

/** 큰 움직임 항목을 앞으로(나머지는 원래 순서 유지) */
function bigFirst(qs: readonly PushQuote[]): PushQuote[] {
  return [...qs.filter(isBig), ...qs.filter((q) => !isBig(q))];
}

/** 오늘(KST 날짜) 휴장하는 시장 이름 — kr/us-holidays 상수. 없으면 빈 배열 */
export function holidayMarketsOn(today: string): string[] {
  const out: string[] = [];
  if (isUsHoliday(today)) out.push("미국");
  if (isKrHoliday(today)) out.push("국내");
  return out;
}

const shiftDay = (date: string, days: number): string => {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};
/** 아침 회차(월~금)의 기대 거래일 — 전날 기준 직전 영업일 */
const expectedCloseDate = (today: string, market: "us" | "kr"): string => {
  const y = new Date(`${shiftDay(today, -1)}T00:00:00Z`);
  return (market === "us" ? rollbackToUsBusinessDay(y) : rollbackToBusinessDay(y)).toISOString().slice(0, 10);
};
/** 직전 발송일(월~금 직전 평일)의 아침 요약이 이미 쓴 거래일과 오늘 기대 거래일이 같으면 true — 같은 종가 반복 방지. 날짜 계산만 사용 */
export function isRepeatedClose(today: string, market: "us" | "kr"): boolean {
  let prev = shiftDay(today, -1);
  while ([0, 6].includes(new Date(`${prev}T00:00:00Z`).getUTCDay())) prev = shiftDay(prev, -1);
  return expectedCloseDate(today, market) === expectedCloseDate(prev, market);
}

/** 오늘 직전에 쉰 평일(주말 제외) 중 가장 최근 날짜 — 최대 10일 전까지 */
function lastRestDate(today: string, market: "us" | "kr"): string | null {
  const isHoliday = market === "us" ? isUsHoliday : isKrHoliday;
  for (let i = 1; i <= 10; i++) {
    const d = shiftDay(today, -i);
    if (![0, 6].includes(new Date(`${d}T00:00:00Z`).getUTCDay()) && isHoliday(d)) return d;
  }
  return null;
}

/** 아침 시장 요약 — `미국 … | 국내 … | 오늘 미국 휴장`. 날짜 검증에 실패한 구간은 호출부가 빈 배열로 넘기고, 둘 다 비면 null */
export function buildMorningMessage(today: string, us: readonly PushQuote[], kr: readonly PushQuote[], cond: PushCond): PushPayload | null {
  if (us.length === 0 && kr.length === 0) return null;
  if (cond === "pm2" && !hasBig(us) && !hasBig(kr)) return null;
  const segs: { text: string; big: boolean }[] = [];
  if (us.length > 0) segs.push({ text: `미국 ${bigFirst(us).map(formatQuote).join(" · ")}`, big: us.some(isBig) });
  if (kr.length > 0) segs.push({ text: `국내 ${bigFirst(kr).map(formatQuote).join(" · ")}`, big: kr.some(isBig) });
  const ordered = [...segs.filter((x) => x.big), ...segs.filter((x) => !x.big)].map((x) => x.text);
  // 직전 아침 요약과 같은 거래일이라 시세를 비운 구간은 같은 수치를 반복하지 않고 표시만
  // 쉰 날짜를 적는다(예: '미국 11/26 휴장'). 같은 시장이 오늘도 휴장이면 '오늘 ○ 휴장'만 남겨 중복을 피한다
  const holidays = holidayMarketsOn(today);
  for (const [market, name, list] of [["us", "미국", us], ["kr", "국내", kr]] as const) {
    if (list.length > 0 || holidays.includes(name) || !isRepeatedClose(today, market)) continue;
    const rest = lastRestDate(today, market);
    if (rest) ordered.push(`${name} ${formatMonthDay(rest)} 휴장`);
  }
  if (holidays.length > 0) ordered.push(`오늘 ${holidays.join("·")} 휴장`);
  return { m: "morning", t: `${formatMonthDay(today)} 아침 시장`, b: ordered.join(" | ") };
}

/** 국내 장 마감(16시) — `코스피 +0.5% · 코스닥 -0.3% · 환율 1,385원(+0.4%)` */
export function buildKrCloseMessage(today: string, kr: readonly PushQuote[], cond: PushCond): PushPayload | null {
  if (kr.length === 0) return null;
  if (cond === "pm2" && !hasBig(kr)) return null;
  return { m: "kr", t: `${formatMonthDay(today)} 국내 종가`, b: bigFirst(kr).map(formatQuote).join(" · ") };
}

/** 09시 회차 합치기 — 우선순위 높은 종류가 제목·도착 화면, 나머지는 본문 둘째 줄에 제목만. 하루 1건 */
export function mergePushPayloads(list: readonly PushPayload[]): PushPayload | null {
  const sorted = [...list].sort((a, b) => PUSH_MERGE_ORDER.indexOf(a.m as PushKind) - PUSH_MERGE_ORDER.indexOf(b.m as PushKind));
  if (sorted.length === 0) return null;
  const [head, ...rest] = sorted;
  return rest.length === 0 ? head : { ...head, b: `${head.b}\n${rest.map((r) => r.t).join(" · ")}` };
}
