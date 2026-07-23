// 기록 스트릭·기록률 — daily 스냅샷(+장기 아카이브) 날짜에서 파생 계산.
// 별도 누적 카운터를 저장하지 않음: 스냅샷은 기기 간 동기화되므로 파생값이 자동 일치한다.
// 저장 규칙 정합: 일요일은 기록되지 않으므로 스트릭에서 중립(건너뜀·카운트 제외).

export interface RecordStats {
  streakDays: number;    // 연속 기록일 (일요일 제외)
  monthRecorded: number; // 이번 달 기록일 수
  monthEligible: number; // 이번 달 1일~오늘 중 일요일 제외 일수
  monthRate: number;     // 0~1
}

const DAY_MS = 24 * 60 * 60 * 1000;
const toUtc = (dateStr: string): Date => new Date(`${dateStr}T00:00:00Z`);
const toStr = (d: Date): string => d.toISOString().split("T")[0];

export function computeRecordStats(
  dailyDates: string[],
  todayStr: string,
  archivedDates: string[] = [],
): RecordStats {
  const recorded = new Set([...dailyDates, ...archivedDates]);

  // 이번 달 기록률: 1일~오늘 중 일요일 제외.
  // 이번 달 중간에 기록을 시작한 사용자(이전 달 기록 없음)는 첫 기록일부터 산정 — 시작 전 날짜로 불이익 방지
  const currentMonth = todayStr.substring(0, 7);
  const todayDay = parseInt(todayStr.substring(8), 10);
  const firstRecorded = [...recorded].sort()[0];
  const startDay = firstRecorded && firstRecorded.startsWith(currentMonth)
    ? parseInt(firstRecorded.substring(8), 10)
    : 1;
  let monthRecorded = 0;
  let monthEligible = 0;
  for (let day = startDay; day <= todayDay; day++) {
    const dateStr = `${currentMonth}-${String(day).padStart(2, "0")}`;
    if (toUtc(dateStr).getUTCDay() === 0) continue;
    monthEligible++;
    if (recorded.has(dateStr)) monthRecorded++;
  }

  // 연속 기록일: 오늘(미기록이면 어제)부터 역방향, 일요일은 중립, 비일요일 결측에서 종료
  let streakDays = 0;
  let cursor = toUtc(todayStr);
  if (!recorded.has(todayStr)) cursor = new Date(cursor.getTime() - DAY_MS);
  while (true) {
    const dateStr = toStr(cursor);
    if (cursor.getUTCDay() === 0) {
      cursor = new Date(cursor.getTime() - DAY_MS);
      continue;
    }
    if (!recorded.has(dateStr)) break;
    streakDays++;
    cursor = new Date(cursor.getTime() - DAY_MS);
  }

  return {
    streakDays,
    monthRecorded,
    monthEligible,
    monthRate: monthEligible > 0 ? monthRecorded / monthEligible : 0,
  };
}
