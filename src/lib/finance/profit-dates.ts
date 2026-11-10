// 기간 수익 기준 종가일 산출 — profit 라우트(종목)와 market-index 라우트(지수)가 같은 함수를 써서
// 지수·종목의 시작·끝 종가일이 항상 같은 규칙으로 정해지게 한다(#132 조건 5).
// profit/route.ts의 getDates·휴장 명목일 판정을 그대로 옮긴 것이며 출력은 이전과 같다(profit-dates.test.ts 대조).
import type { ProfitPeriod, ProfitRefEntry } from "@/app/api/finance/profit/route";
import type { IndexCloseRow as DailyClose } from "@/lib/finance/finance-service";
import { getDailyClosingRefDates, type ProfitBasis } from "@/lib/finance/profit-utils";
import { isUsEasternDST } from "@/lib/finance/stock-cache-slot";
import { isKrBusinessDay } from "@/lib/finance/kr-holidays";
import { isUsBusinessDay } from "@/lib/finance/us-holidays";

export type RefMarket = "domestic" | "foreign";

export interface PeriodRefDates {
  refDate: string;
  prevDate?: string;
}

export interface MarketRefDates extends PeriodRefDates {
  // 일별 종료일(refDate)이 그 시장 휴장일 — refDate는 명목 종료일로 유지한다(직전 영업일로 덮지 않음)
  refHoliday: boolean;
}

function getKSTNow(): Date {
  return new Date(Date.now() + 9 * 60 * 60 * 1000);
}

function toDateStr(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

// 토/일만 건너뛰는 단순 rollback (N 영업일 전)
function subtractWeekdays(from: Date, n: number): Date {
  const d = new Date(from);
  let count = 0;
  while (count < n) {
    d.setUTCDate(d.getUTCDate() - 1);
    const day = d.getUTCDay();
    if (day !== 0 && day !== 6) count++;
  }
  return d;
}

// 달력 기준 N개월 전, 토/일이면 금요일로 rollback
function subtractCalendarMonths(from: Date, months: number): Date {
  const d = new Date(from);
  d.setUTCMonth(d.getUTCMonth() - months);
  while (d.getUTCDay() === 0 || d.getUTCDay() === 6) {
    d.setUTCDate(d.getUTCDate() - 1);
  }
  return d;
}

// 달력 기준 N년 전, 토/일이면 금요일로 rollback
function subtractCalendarYears(from: Date, years: number): Date {
  const d = new Date(from);
  d.setUTCFullYear(d.getUTCFullYear() - years);
  while (d.getUTCDay() === 0 || d.getUTCDay() === 6) {
    d.setUTCDate(d.getUTCDate() - 1);
  }
  return d;
}

// daily만 두 날짜(prev, ref) 반환, 나머지는 단일 ref만 (요청 시각 = 현재 시각)
export function getPeriodRefDates(period: ProfitPeriod, market: RefMarket): PeriodRefDates {
  const now = getKSTNow();
  if (period === "daily") return getDailyClosingRefDates(market);
  // 해외 weekly/monthly/yearly도 일별과 동일한 컷오프(DST 06:00 / STD 07:00 KST) 적용
  // 새벽 ET 장중 시점의 stale 응답 방지 — daily보다 TTL이 길어 영향이 더 큼
  const shiftForeign = (d: Date): Date => {
    if (market !== "foreign") return d;
    const hhmm = now.getUTCHours() * 100 + now.getUTCMinutes();
    const cutoff = isUsEasternDST(new Date()) ? 600 : 700;
    if (hhmm >= cutoff) return d;
    const r = new Date(d);
    r.setUTCDate(r.getUTCDate() - 1);
    while (r.getUTCDay() === 0 || r.getUTCDay() === 6) r.setUTCDate(r.getUTCDate() - 1);
    return r;
  };
  if (period === "weekly") return { refDate: toDateStr(shiftForeign(subtractWeekdays(now, 5))) };
  if (period === "monthly") return { refDate: toDateStr(shiftForeign(subtractCalendarMonths(now, 1))) };
  return { refDate: toDateStr(shiftForeign(subtractCalendarYears(now, 1))) };
}

// 시장별 기준일 + 휴장 명목일 여부.
// sameBusinessDay: 국내·해외 모두 해외 영업일 계산을 사용해 같은 영업일로 정렬
// kstAccessDay: 국내=domestic, 해외=foreign 독립 산출
export function resolveRefDates(
  period: ProfitPeriod,
  basis: ProfitBasis,
): { kr: MarketRefDates; us: MarketRefDates } {
  const usDates = getPeriodRefDates(period, "foreign");
  const krDates = basis === "sameBusinessDay" ? usDates : getPeriodRefDates(period, "domestic");
  return {
    kr: { ...krDates, refHoliday: period === "daily" && !isKrBusinessDay(new Date(`${krDates.refDate}T00:00:00.000Z`)) },
    us: { ...usDates, refHoliday: period === "daily" && !isUsBusinessDay(new Date(`${usDates.refDate}T00:00:00.000Z`)) },
  };
}

// ── 지수 시계열 → 기준 종가 (#132 U2) ──
// 지수는 기간 전체 종가 시계열을 1회로 받는다. 종목 경로와 같은 '요청일 이하 가장 최근 종가' 규칙으로 고른다.

// 요청일 이하 가장 최근 종가. lookbackDays를 주면 요청일 - (lookbackDays-1)일까지만 거슬러 간다
// (국내 종목 fetchDomesticHistoricalPrice의 5일 롤백과 같은 범위).
export function pickCloseOnOrBefore(series: DailyClose[], date: string, lookbackDays?: number): DailyClose | null {
  let floor = "";
  if (lookbackDays !== undefined) {
    const d = new Date(`${date}T00:00:00.000Z`);
    d.setUTCDate(d.getUTCDate() - (lookbackDays - 1));
    floor = toDateStr(d);
  }
  let best: DailyClose | null = null;
  for (const row of series) {
    if (!(row.price > 0) || row.date > date || row.date < floor) continue;
    if (!best || row.date > best.date) best = row;
  }
  return best;
}

// 시계열 → ProfitRefEntry 모양(종목 응답과 같은 날짜 규칙). 끝 종가가 없으면 null.
// 일별 종료일이 휴장(refHoliday)이면 refDate는 명목 종료일로 둔다 — profit 라우트와 같다.
export function buildRefEntryFromSeries(
  series: DailyClose[],
  dates: MarketRefDates,
  lookbackDays?: number,
): ProfitRefEntry | null {
  const ref = pickCloseOnOrBefore(series, dates.refDate, lookbackDays);
  if (!ref) return null;
  const entry: ProfitRefEntry = {
    refPrice: ref.price,
    refDate: dates.refHoliday ? dates.refDate : ref.date,
  };
  if (dates.prevDate) {
    const prev = pickCloseOnOrBefore(series, dates.prevDate, lookbackDays);
    if (prev) {
      entry.prevPrice = prev.price;
      entry.prevDate = prev.date;
    }
  }
  return entry;
}

// 시계열 요청 구간: 가장 이른 필요일 - 여유 10일 ~ 가장 늦은 필요일(진행 중인 거래일 행은 받지 않는다)
export function getSeriesRange(dates: PeriodRefDates): { start: string; end: string } {
  const earliest = dates.prevDate && dates.prevDate < dates.refDate ? dates.prevDate : dates.refDate;
  const s = new Date(`${earliest}T00:00:00.000Z`);
  s.setUTCDate(s.getUTCDate() - 10);
  return { start: toDateStr(s), end: dates.refDate };
}
