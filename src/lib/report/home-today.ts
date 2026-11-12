// 홈 '오늘'(4.90 #175) 순수 함수 — 가장 큰 원인 1개 선택, 7일 카드 제목. 저장·서버 호출 0.
import type { AttributionDisplayItem } from "./asset-report";

// 원인 중 |amount| 최대 1개. 동률은 앞 항목(= sortCausesByDate 순서) 유지. 비면 null
export function pickTopCause(causes: readonly AttributionDisplayItem[]): AttributionDisplayItem | null {
  let top: AttributionDisplayItem | null = null;
  for (const c of causes) if (!top || Math.abs(c.amount) > Math.abs(top.amount)) top = c;
  return top;
}

const dayNumber = (ymd: string) => Math.round(Date.parse(`${ymd}T00:00:00.000Z`) / 86_400_000);

// 7일 카드 제목 — N개 기록이 연속된 날짜(첫~끝 = N-1일)면 `최근 N일`, 띄엄띄엄이면 `최근 기록 N일`(N은 기록 개수, C84). 날짜 오름차순 입력
export function weekTrendTitle(snapshots: readonly { date: string }[]): string {
  const n = snapshots.length;
  const consecutive = n < 2 || dayNumber(snapshots[n - 1].date) - dayNumber(snapshots[0].date) === n - 1;
  return `순자산 추이 (최근 ${consecutive ? "" : "기록 "}${n}일)`;
}
