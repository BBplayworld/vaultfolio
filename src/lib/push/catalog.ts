// 시장 알림 대상 카탈로그(#179) — 서버·클라이언트 공용 고정 목록(14개).
// 대상은 보유와 무관한 공개 시장 항목이라 서버에는 이 ID만 저장한다.
// 시가총액 상위 6개는 분기 1회 수동 확인 후 이 상수만 바꾼다(자동 갱신 없음). 기준: 구현 시점 공개 순위 추정, 갱신 시 출처·기준일을 아래에 적는다.
// ID는 슬롯이 아니라 코드 기반 — 갱신으로 사라진 ID는 서버가 발송 시 무시하고 설정 화면이 열 때 정리한다.
// 지수·ETF 코드는 KIS 실호출 미검증 항목이 있다(dev-notes 참조) — 조회 실패 항목은 알림에서 조용히 빠진다.
import type { PushMarket } from "./types";

export type PushGroup = "kr-index" | "us-index" | "watch" | "etf" | "cap";

export type PushSource =
  | { kind: "kr-index"; code: string }
  | { kind: "us-index"; code: string }
  | { kind: "kr-stock"; code: string }
  | { kind: "us-stock"; excd: string; symbol: string };

export interface PushTopic {
  id: string;
  label: string;
  group: PushGroup;
  market: PushMarket; // 도착 회차(국내 장 마감 후 / 미국 장 마감 후)
  source: PushSource;
}

export const PUSH_GROUPS: { id: PushGroup; label: string }[] = [
  { id: "kr-index", label: "국내 지수" },
  { id: "us-index", label: "해외 지수" },
  { id: "watch", label: "관심 지수" },
  { id: "etf", label: "관심 ETF" },
  { id: "cap", label: "시가총액 상위" },
];

export const PUSH_CATALOG: readonly PushTopic[] = [
  { id: "kospi", label: "코스피", group: "kr-index", market: "kr", source: { kind: "kr-index", code: "0001" } },
  { id: "kosdaq", label: "코스닥", group: "kr-index", market: "kr", source: { kind: "kr-index", code: "1001" } },
  { id: "spx", label: "S&P 500", group: "us-index", market: "us", source: { kind: "us-index", code: "SPX" } },
  { id: "comp", label: "나스닥 종합", group: "us-index", market: "us", source: { kind: "us-index", code: "COMP" } },
  { id: "ndx", label: "나스닥100", group: "watch", market: "us", source: { kind: "us-index", code: "NDX" } },
  { id: "sox", label: "필라델피아 반도체", group: "watch", market: "us", source: { kind: "us-index", code: "SOX" } },
  { id: "etf-396500", label: "TIGER 반도체TOP10", group: "etf", market: "kr", source: { kind: "kr-stock", code: "396500" } },
  { id: "etf-472150", label: "TIGER 배당커버드콜액티브", group: "etf", market: "kr", source: { kind: "kr-stock", code: "472150" } },
  { id: "kr-005930", label: "삼성전자", group: "cap", market: "kr", source: { kind: "kr-stock", code: "005930" } },
  { id: "kr-000660", label: "SK하이닉스", group: "cap", market: "kr", source: { kind: "kr-stock", code: "000660" } },
  { id: "kr-373220", label: "LG에너지솔루션", group: "cap", market: "kr", source: { kind: "kr-stock", code: "373220" } },
  { id: "us-NVDA", label: "엔비디아", group: "cap", market: "us", source: { kind: "us-stock", excd: "NAS", symbol: "NVDA" } },
  { id: "us-MSFT", label: "마이크로소프트", group: "cap", market: "us", source: { kind: "us-stock", excd: "NAS", symbol: "MSFT" } },
  { id: "us-AAPL", label: "애플", group: "cap", market: "us", source: { kind: "us-stock", excd: "NAS", symbol: "AAPL" } },
];

export const PUSH_TOPIC_IDS: readonly string[] = PUSH_CATALOG.map((t) => t.id);
export const PUSH_DEFAULT_TOPICS: readonly string[] = ["kospi", "spx"];
export const PUSH_MAX_TOPICS = PUSH_CATALOG.length;

export function getPushTopic(id: string): PushTopic | undefined {
  return PUSH_CATALOG.find((t) => t.id === id);
}

/** 알 수 없는 ID 제거 + 중복 제거 + 카탈로그 순서로 정렬 */
export function normalizePushTopics(ids: readonly unknown[]): string[] {
  const set = new Set(ids.filter((x): x is string => typeof x === "string"));
  return PUSH_CATALOG.filter((t) => set.has(t.id)).map((t) => t.id);
}

/** 한 시장 회차에 해당하는 대상만 */
export function topicsOfMarket(ids: readonly string[], market: PushMarket): PushTopic[] {
  return PUSH_CATALOG.filter((t) => t.market === market && ids.includes(t.id));
}
