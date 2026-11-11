import { describe, it, expect, afterEach, vi } from "vitest";
import { resolveRefDates } from "../profit-dates";
import { getDailyClosingRefDates, type ProfitBasis } from "../profit-utils";
import { isUsEasternDST } from "../stock-cache-slot";
import { isKrBusinessDay } from "../kr-holidays";
import { isUsBusinessDay } from "../us-holidays";
import type { ProfitPeriod } from "@/app/api/finance/profit/route";

// isUsEasternDST는 호출마다 Intl.DateTimeFormat을 새로 만들어 격자 대조가 느리다 → 같은 원 함수를 시(時) 단위로 메모해 쓴다.
// 새 구현·기준 구현 모두 이 같은 함수를 거치므로 대조의 공정성은 그대로다(DST 판정 값 자체는 원 함수 결과).
vi.mock("../stock-cache-slot", async (importOriginal) => {
  const mod = await importOriginal<typeof import("../stock-cache-slot")>();
  const memo = new Map<number, boolean>();
  return {
    ...mod,
    isUsEasternDST: (date: Date) => {
      const key = Math.floor(date.getTime() / 3_600_000);
      let v = memo.get(key);
      if (v === undefined) {
        v = mod.isUsEasternDST(date);
        memo.set(key, v);
      }
      return v;
    },
  };
});

// ── 기준 구현: 추출 전 main(6cf9785) profit/route.ts의 getDates·휴장 명목일 판정 그대로 복사 ──
function refGetKSTNow(): Date {
  return new Date(Date.now() + 9 * 60 * 60 * 1000);
}
function refToDateStr(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}
function refSubtractWeekdays(from: Date, n: number): Date {
  const d = new Date(from);
  let count = 0;
  while (count < n) {
    d.setUTCDate(d.getUTCDate() - 1);
    const day = d.getUTCDay();
    if (day !== 0 && day !== 6) count++;
  }
  return d;
}
function refSubtractCalendarMonths(from: Date, months: number): Date {
  const d = new Date(from);
  d.setUTCMonth(d.getUTCMonth() - months);
  while (d.getUTCDay() === 0 || d.getUTCDay() === 6) d.setUTCDate(d.getUTCDate() - 1);
  return d;
}
function refSubtractCalendarYears(from: Date, years: number): Date {
  const d = new Date(from);
  d.setUTCFullYear(d.getUTCFullYear() - years);
  while (d.getUTCDay() === 0 || d.getUTCDay() === 6) d.setUTCDate(d.getUTCDate() - 1);
  return d;
}
function refGetDates(period: ProfitPeriod, market: "domestic" | "foreign"): { refDate: string; prevDate?: string } {
  const now = refGetKSTNow();
  if (period === "daily") return getDailyClosingRefDates(market);
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
  if (period === "weekly") return { refDate: refToDateStr(shiftForeign(refSubtractWeekdays(now, 5))) };
  if (period === "monthly") return { refDate: refToDateStr(shiftForeign(refSubtractCalendarMonths(now, 1))) };
  return { refDate: refToDateStr(shiftForeign(refSubtractCalendarYears(now, 1))) };
}
function referenceResolve(period: ProfitPeriod, basis: ProfitBasis) {
  const usDates = refGetDates(period, "foreign");
  const krDates = basis === "sameBusinessDay" ? usDates : refGetDates(period, "domestic");
  const krRefHoliday = period === "daily" && !isKrBusinessDay(new Date(`${krDates.refDate}T00:00:00.000Z`));
  const usRefHoliday = period === "daily" && !isUsBusinessDay(new Date(`${usDates.refDate}T00:00:00.000Z`));
  return { kr: { ...krDates, refHoliday: krRefHoliday }, us: { ...usDates, refHoliday: usRefHoliday } };
}

const PERIODS: ProfitPeriod[] = ["daily", "weekly", "monthly", "yearly"];
const BASES: ProfitBasis[] = ["sameBusinessDay", "kstAccessDay"];

// KST 시각 → UTC epoch
const kst = (iso: string) => new Date(`${iso}+09:00`).getTime();

afterEach(() => {
  vi.useRealTimers();
});

describe("resolveRefDates — 추출 전 main getDates와 출력 동일(A14·K4①)", () => {
  it("2026-01 ~ 2027-03 30분 격자 × 기간 4 × 종가 기준 2 전 구간에서 같다(DST 전환·한글날·추수감사절·설 포함)", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    let mismatches = 0;
    let checked = 0;
    for (let t = kst("2026-01-01T00:00:00"); t <= kst("2027-03-31T23:30:00"); t += 30 * 60 * 1000) {
      vi.setSystemTime(t);
      const at = new Date(t + 9 * 3_600_000).toISOString().slice(0, 16);
      for (const period of PERIODS) {
        for (const basis of BASES) {
          const got = resolveRefDates(period, basis);
          const want = referenceResolve(period, basis);
          checked++;
          if (JSON.stringify(got) !== JSON.stringify(want)) {
            mismatches++;
            if (mismatches < 5) expect({ at, period, basis, got }).toEqual({ at, period, basis, got: want });
          }
        }
      }
    }
    expect(checked).toBeGreaterThan(170_000);
    expect(mismatches).toBe(0);
  }, 60_000);
});

describe("resolveRefDates — 대표 시각 고정값(F8)", () => {
  const at = (iso: string) => {
    vi.useFakeTimers();
    vi.setSystemTime(kst(iso));
  };

  it("화 15:59 kstAccessDay 일별: 국내 ref=월, prev=금(컷오프 전)", () => {
    at("2026-11-10T15:59:00");
    const { kr } = resolveRefDates("daily", "kstAccessDay");
    expect(kr).toEqual({ refDate: "2026-11-09", prevDate: "2026-11-06", refHoliday: false });
  });

  it("화 16:00 kstAccessDay 일별: 국내 ref=화(오늘), prev=월", () => {
    at("2026-11-10T16:00:00");
    const { kr } = resolveRefDates("daily", "kstAccessDay");
    expect(kr).toEqual({ refDate: "2026-11-10", prevDate: "2026-11-09", refHoliday: false });
  });

  it("sameBusinessDay는 국내가 해외 날짜를 그대로 쓴다", () => {
    at("2026-11-10T20:00:00");
    const { kr, us } = resolveRefDates("weekly", "sameBusinessDay");
    expect(kr.refDate).toBe(us.refDate);
    expect(kr.prevDate).toBe(us.prevDate);
  });

  it("미국 컷오프(STD 07:00) 앞뒤로 해외 주간 기준일이 하루 바뀐다", () => {
    at("2026-11-11T06:59:00");
    const before = resolveRefDates("weekly", "kstAccessDay").us.refDate;
    at("2026-11-11T07:00:00");
    const after = resolveRefDates("weekly", "kstAccessDay").us.refDate;
    expect(before).toBe("2026-11-03");
    expect(after).toBe("2026-11-04");
  });

  it("국내 휴장일(2026-10-09 한글날, 금) 16시 이후 일별: refDate는 명목일, refHoliday=true", () => {
    at("2026-10-09T17:00:00");
    const { kr } = resolveRefDates("daily", "kstAccessDay");
    expect(kr.refDate).toBe("2026-10-09");
    expect(kr.refHoliday).toBe(true);
  });

  it("미국 휴장일(2026-11-26 추수감사절) 다음 날 08시 일별: 해외 refHoliday=true", () => {
    at("2026-11-27T08:00:00");
    const { us } = resolveRefDates("daily", "kstAccessDay");
    expect(us.refDate).toBe("2026-11-26");
    expect(us.refHoliday).toBe(true);
  });

  it("일별이 아니면 refHoliday는 항상 false", () => {
    at("2026-10-09T17:00:00");
    const { kr, us } = resolveRefDates("weekly", "kstAccessDay");
    expect(kr.refHoliday).toBe(false);
    expect(us.refHoliday).toBe(false);
  });
});

// #150 올해(ytd) 기준일 — 작년 마지막 거래일 종가의 명목일 (Y-1)-12-31(컷오프 shift 없음)
describe("ytd 기준일", () => {
  afterEach(() => { vi.useRealTimers(); });
  const at = (iso: string) => { vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date(`${iso}+09:00`)); };

  it.each([
    ["2026-11-11T12:00:00", "2025-12-31"],
    ["2027-01-01T00:30:00", "2026-12-31"],
    ["2027-01-04T15:00:00", "2026-12-31"],
    ["2027-01-04T16:30:00", "2026-12-31"],
    ["2027-12-31T23:59:00", "2026-12-31"],
    ["2029-01-02T12:00:00", "2028-12-31"],
  ])("%s → 명목 시작일 %s(국내·미국 같음, 휴장 아님)", (iso, expected) => {
    at(iso);
    for (const basis of ["sameBusinessDay", "kstAccessDay"] as const) {
      const { kr, us } = resolveRefDates("ytd", basis);
      expect(kr.refDate).toBe(expected);
      expect(us.refDate).toBe(expected);
      expect(kr.prevDate).toBeUndefined();
      expect(kr.refHoliday).toBe(false);
      expect(us.refHoliday).toBe(false);
    }
  });

  it("2029-01-02 기준 실제 종가일: 국내 2028-12-28(12/29 연말 휴장·12/30~31 주말), 미국 2028-12-29", () => {
    // 명목일 2028-12-31(일)에서 영업일 이하 최근 종가로 롤백한 날 — 규칙(이하 최근 종가)의 고정값
    const rollback = (isBiz: (d: Date) => boolean) => {
      const d = new Date("2028-12-31T00:00:00.000Z");
      while (!isBiz(d)) d.setUTCDate(d.getUTCDate() - 1);
      return d.toISOString().slice(0, 10);
    };
    expect(rollback(isKrBusinessDay)).toBe("2028-12-28");
    expect(rollback(isUsBusinessDay)).toBe("2028-12-29");
  });

  it("기존 기간 출력 불변(yearly=1년 전)", () => {
    at("2026-11-11T12:00:00");
    expect(resolveRefDates("yearly", "sameBusinessDay").us.refDate).toBe("2025-11-11");
  });
});
