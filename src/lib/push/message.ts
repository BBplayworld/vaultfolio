// 알림 문구·발송일 판정(#179, 4.91 'A 교체') — 순수 함수. 날짜표만 쓰고 시세·사용자 정보는 보지 않는다.
// 문구는 상태 안내('열렸어요')만 — 요청형·조언·금액·'내'·'보유' 0. 결산 창 첫날은 앱의 결산 창 로직(isSettlementWindowOpenDay)을 재사용한다.
import { CARD_UNTIL_DAY, isSettlementWindowOpenDay } from "@/lib/report/settlement";
import type { PushKind, PushPayload } from "./types";

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
