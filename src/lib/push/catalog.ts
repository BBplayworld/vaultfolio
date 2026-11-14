// 알림 종류 카탈로그(#179, 4.91 'A 교체') — 서버·클라이언트 공용 고정 2개.
// 사용자 보유와 무관한 날짜표 기반 공통 알림이라 서버에는 이 ID만 저장한다. 지수·종목 시세 알림은 없다.
// 이전(지수) ID는 저장돼 있어도 normalize가 제거하고, 서버는 발송 시 알 수 없는 ID를 무시한다.
import type { PushKind } from "./types";

export interface PushTopic {
  id: PushKind;
  label: string;
  desc: string;
}

export const PUSH_CATALOG: readonly PushTopic[] = [
  { id: "settle", label: "월 결산 열림", desc: "매월 결산이 열리는 날 1번" },
  { id: "tax", label: "세금 마감", desc: "5월 신고 기간·12월 연금저축·IRP 납입 마감, 연 2번" },
];

export const PUSH_TOPIC_IDS: readonly string[] = PUSH_CATALOG.map((t) => t.id);
export const PUSH_MAX_TOPICS = PUSH_CATALOG.length;

export function getPushTopic(id: string): PushTopic | undefined {
  return PUSH_CATALOG.find((t) => t.id === id);
}

/** 알 수 없는 ID 제거 + 중복 제거 + 카탈로그 순서로 정렬 */
export function normalizePushTopics(ids: readonly unknown[]): string[] {
  const set = new Set(ids.filter((x): x is string => typeof x === "string"));
  return PUSH_CATALOG.filter((t) => set.has(t.id)).map((t) => t.id);
}
