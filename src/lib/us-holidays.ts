// 미국 NYSE/NASDAQ 휴장일 (2026~2030)
// 토 → 직전 금, 일 → 다음 월요일로 이동 (Observed)
// Good Friday는 부활절 -2일 (매년 변동, 검수 필요)
// 조기 폐장일(반장)은 종가가 정상 산출되므로 휴장으로 취급하지 않음
export const US_HOLIDAYS: ReadonlySet<string> = new Set([
  // 2026
  "2026-01-01", // New Year's Day
  "2026-01-19", // MLK Day
  "2026-02-16", // Presidents Day
  "2026-04-03", // Good Friday
  "2026-05-25", // Memorial Day
  "2026-06-19", // Juneteenth
  "2026-07-03", // Independence Day Observed (7/4 토)
  "2026-09-07", // Labor Day
  "2026-11-26", // Thanksgiving
  "2026-12-25", // Christmas

  // 2027
  "2027-01-01", // New Year's Day
  "2027-01-18", // MLK Day
  "2027-02-15", // Presidents Day
  "2027-03-26", // Good Friday
  "2027-05-31", // Memorial Day
  "2027-06-18", // Juneteenth Observed (6/19 토)
  "2027-07-05", // Independence Day Observed (7/4 일)
  "2027-09-06", // Labor Day
  "2027-11-25", // Thanksgiving
  "2027-12-24", // Christmas Observed (12/25 토)

  // 2028
  "2028-01-17", // MLK Day
  "2028-02-21", // Presidents Day
  "2028-04-14", // Good Friday
  "2028-05-29", // Memorial Day
  "2028-06-19", // Juneteenth
  "2028-07-04", // Independence Day
  "2028-09-04", // Labor Day
  "2028-11-23", // Thanksgiving
  "2028-12-25", // Christmas

  // 2029
  "2029-01-01", // New Year's Day
  "2029-01-15", // MLK Day
  "2029-02-19", // Presidents Day
  "2029-03-30", // Good Friday
  "2029-05-28", // Memorial Day
  "2029-06-19", // Juneteenth
  "2029-07-04", // Independence Day
  "2029-09-03", // Labor Day
  "2029-11-22", // Thanksgiving
  "2029-12-25", // Christmas

  // 2030
  "2030-01-01", // New Year's Day
  "2030-01-21", // MLK Day
  "2030-02-18", // Presidents Day
  "2030-04-19", // Good Friday
  "2030-05-27", // Memorial Day
  "2030-06-19", // Juneteenth
  "2030-07-04", // Independence Day
  "2030-09-02", // Labor Day
  "2030-11-28", // Thanksgiving
  "2030-12-25", // Christmas
]);

export function isUsHoliday(dateStr: string): boolean {
  return US_HOLIDAYS.has(dateStr);
}

export function isUsBusinessDay(d: Date): boolean {
  const day = d.getUTCDay();
  if (day === 0 || day === 6) return false;
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return !isUsHoliday(`${yyyy}-${mm}-${dd}`);
}

export function rollbackToUsBusinessDay(d: Date): Date {
  const r = new Date(d);
  for (let i = 0; i < 10; i++) {
    if (isUsBusinessDay(r)) return r;
    r.setUTCDate(r.getUTCDate() - 1);
  }
  return r;
}

export function forwardToUsBusinessDay(d: Date): Date {
  const r = new Date(d);
  for (let i = 0; i < 10; i++) {
    if (isUsBusinessDay(r)) return r;
    r.setUTCDate(r.getUTCDate() + 1);
  }
  return r;
}
