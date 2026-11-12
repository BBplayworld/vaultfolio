// 4.90 #175 홈 지수 종가 줄 — 라벨·진리표·휴장·C69 시각 경계 4종(setSystemTime 으로 resolveRefDates → 실제 지수 구간 → 라벨 전 과정 호출)·C65(도착 표 값 = 홈 값)
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MarketIndexResponse } from "@/app/api/finance/market-index/route";
import {
  computeIndexSpan,
  computePeriodCell,
  formatCompareRate,
  isDailyIndexHoliday,
  marketLineLabel,
  marketLineState,
  type CompareMarket,
  type MarketLineValue,
  type PeriodRefs,
} from "../market-compare";
import { resolveRefDates, buildRefEntryFromSeries } from "../profit-dates";
import type { ProfitBasis } from "../profit-utils";

const v = (m: CompareMarket, rate: number, endDate: string, holiday = false): MarketLineValue => ({ m, rate, endDate, holiday });

describe("marketLineLabel — 문구 확정표(spec 5절)", () => {
  it("두 시장 날짜 같음: 날짜·종가 1번", () => {
    expect(marketLineLabel([v("kr", 0.8, "2026-11-11"), v("us", -0.3, "2026-11-11")])).toBe("11/11 종가 코스피 +0.8% · S&P 500 -0.3%");
  });
  it("날짜 다름: 시장마다 날짜·종가(결정 ① — 종가 생략 없음), 좁은 폭은 둘째 시장 숨김", () => {
    const vals = [v("kr", 0.8, "2026-11-12"), v("us", -0.3, "2026-11-11")];
    expect(marketLineLabel(vals)).toBe("11/12 종가 코스피 +0.8% · 11/11 종가 S&P 500 -0.3%");
    expect(marketLineLabel(vals, true)).toBe("11/12 종가 코스피 +0.8%");
  });
  it("한 시장만", () => {
    expect(marketLineLabel([v("us", -0.3, "2026-11-11")])).toBe("11/11 종가 S&P 500 -0.3%");
  });
  it("휴장: 값 대신 휴장, 묶음 전부 휴장이면 종가 생략", () => {
    expect(marketLineLabel([v("kr", 0.4, "2026-11-26"), v("us", 0, "2026-11-26", true)])).toBe("11/26 종가 코스피 +0.4% · S&P 500 휴장");
    expect(marketLineLabel([v("us", 0, "2026-11-26", true)])).toBe("11/26 S&P 500 휴장");
  });
  it("0.0%는 부호 없이(휴장 아님), 오늘·실시간 문구 없음", () => {
    const t = marketLineLabel([v("kr", 0.04, "2026-11-11"), v("us", -0.04, "2026-11-11")]);
    expect(t).toBe("11/11 종가 코스피 0.0% · S&P 500 0.0%");
    expect(t).not.toMatch(/오늘|실시간/);
  });
  it("값 0개면 빈 문자열", () => {
    expect(marketLineLabel([])).toBe("");
  });
});

describe("marketLineState 진리표(spec 6절)", () => {
  const base = { hasHeaderChange: true, hasTickerStock: true, markets: ["kr"] as CompareMarket[] | null };
  it.each([
    ["캡처 모드", { ...base, screenshotMode: true }, "off"],
    ["첫 저장 당일(headerChange null)", { ...base, hasHeaderChange: false }, "off"],
    ["주식 없음", { ...base, hasTickerStock: false, markets: null }, "off"],
    ["분류 전", { ...base, markets: null }, "pending"],
    ["분류 후 시장 0개", { ...base, markets: [] }, "off"],
    ["국내만", { ...base, markets: ["kr"] as CompareMarket[] }, "on"],
    ["국내+미국", { ...base, markets: ["kr", "us"] as CompareMarket[] }, "on"],
  ])("%s → %s", (_n, input, want) => {
    expect(marketLineState(input)).toBe(want);
  });
});

describe("isDailyIndexHoliday", () => {
  it("끝 종가일이 비영업일(미국 추수감사절)이면 휴장, 하루만 해당", () => {
    expect(isDailyIndexHoliday("us", "daily", "2026-11-25", "2026-11-26")).toBe(true);
    expect(isDailyIndexHoliday("kr", "daily", "2026-11-25", "2026-11-26")).toBe(false);
    expect(isDailyIndexHoliday("us", "weekly", "2026-11-25", "2026-11-26")).toBe(false);
  });
  it("시작·끝이 같은 날이면 휴장", () => {
    expect(isDailyIndexHoliday("kr", "daily", "2026-11-11", "2026-11-11")).toBe(true);
  });
});

// ── C69 시각 경계 4종: 시스템 시각 → resolveRefDates → 지수 시계열 → entry → computeIndexSpan → 라벨 ──
const ymd = (d: Date) => d.toISOString().slice(0, 10);
// 2026-10-01 ~ 2026-11-30 평일 종가(미국 추수감사절 11/26은 시계열에 없음), 날짜마다 0.1%씩 오르는 값
function series(skip: string[] = []) {
  const rows: { date: string; price: number }[] = [];
  let p = 100;
  for (let d = new Date("2026-10-01T00:00:00Z"); ymd(d) <= "2026-11-30"; d.setUTCDate(d.getUTCDate() + 1)) {
    if (d.getUTCDay() === 0 || d.getUTCDay() === 6 || skip.includes(ymd(d))) continue;
    p *= 1.001 + (d.getUTCDate() % 3) * 0.001;
    rows.push({ date: ymd(d), price: p });
  }
  return rows;
}
function lineAt(kstIso: string, basis: ProfitBasis) {
  vi.setSystemTime(new Date(`${kstIso}+09:00`));
  const dates = resolveRefDates("daily", basis);
  const kr = series(); const us = series(["2026-11-26"]);
  const refs: PeriodRefs<MarketIndexResponse> = {
    daily: { KOSPI: buildRefEntryFromSeries(kr, dates.kr), SPX: buildRefEntryFromSeries(us, dates.us) },
  };
  const values: MarketLineValue[] = (["kr", "us"] as const).map((m) => {
    const s = computeIndexSpan(m, "daily", refs);
    return { m, rate: s.rate!, endDate: s.endDate!, holiday: isDailyIndexHoliday(m, "daily", s.startDate!, s.endDate!) };
  });
  return { values, refs, label: marketLineLabel(values), dates };
}
const R = (values: MarketLineValue[], m: CompareMarket) => formatCompareRate(values.find((x) => x.m === m)!.rate);

describe("C69 시각 경계 — 홈 종가 줄 라벨이 계산 기준일과 일치", () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it("① 국내 16:00(kstAccessDay): 11/12(목) 15:59 → 두 시장 11/11 같은 날짜, 16:00 → 코스피 11/12·S&P 11/11 날짜 다름, sameBusinessDay는 16:00도 둘 다 11/11", () => {
    const a = lineAt("2026-11-12T15:59:00", "kstAccessDay");
    expect(a.label).toBe(`11/11 종가 코스피 ${R(a.values, "kr")} · S&P 500 ${R(a.values, "us")}`);
    const b = lineAt("2026-11-12T16:00:00", "kstAccessDay");
    expect(b.label).toBe(`11/12 종가 코스피 ${R(b.values, "kr")} · 11/11 종가 S&P 500 ${R(b.values, "us")}`);
    expect(marketLineLabel(b.values, true)).toBe(`11/12 종가 코스피 ${R(b.values, "kr")}`);
    const c = lineAt("2026-11-12T16:00:00", "sameBusinessDay");
    expect(c.label).toMatch(/^11\/11 종가 코스피 .* · S&P 500 /);
    expect(c.values.map((x) => x.endDate)).toEqual(["2026-11-11", "2026-11-11"]);
  });

  it("② 미국 컷오프: STD 11/12 06:59 → 11/10, 07:00 → 11/11 / DST 10/15 05:59 → 10/13, 06:00 → 10/14", () => {
    expect(lineAt("2026-11-12T06:59:00", "sameBusinessDay").label).toMatch(/^11\/10 종가 /);
    expect(lineAt("2026-11-12T07:00:00", "sameBusinessDay").label).toMatch(/^11\/11 종가 /);
    expect(lineAt("2026-10-15T05:59:00", "sameBusinessDay").label).toMatch(/^10\/13 종가 /);
    expect(lineAt("2026-10-15T06:00:00", "sameBusinessDay").label).toMatch(/^10\/14 종가 /);
  });

  it("③ 주말·월요일: 11/14(토) 10:00 → 11/13, 11/16(월) 06:30 → 11/12, 11/16(월) 10:00 → 11/13", () => {
    expect(lineAt("2026-11-14T10:00:00", "sameBusinessDay").label).toMatch(/^11\/13 종가 /);
    expect(lineAt("2026-11-16T06:30:00", "sameBusinessDay").label).toMatch(/^11\/12 종가 /);
    expect(lineAt("2026-11-16T10:00:00", "sameBusinessDay").label).toMatch(/^11\/13 종가 /);
  });

  it("④ 휴장: 11/27(금) 10:00 기본 기준 → `11/26 종가 코스피 … · S&P 500 휴장`(추수감사절), 홈 휴장 = 도착 표 휴장(C65)", () => {
    const a = lineAt("2026-11-27T10:00:00", "sameBusinessDay");
    expect(a.label).toBe(`11/26 종가 코스피 ${R(a.values, "kr")} · S&P 500 휴장`);
    expect(a.label).not.toMatch(/오늘|실시간/);
    const hold = { ticker: "AAPL", name: "애플", quantity: 1 };
    // 도착 화면 표: 미국 하루 칸이 holiday, 국내 칸 지수 열 값 = 홈 코스피 값
    const usCell = computePeriodCell("us", "daily", [hold], { daily: { AAPL: { refPrice: 10, refDate: "2026-11-26", prevPrice: 10, prevDate: "2026-11-25" } } }, a.refs);
    expect(usCell.state).toBe("holiday");
    const krCell = computePeriodCell("kr", "daily", [{ ...hold, ticker: "005930" }], { daily: { "005930": { refPrice: 11, refDate: a.values[0].endDate, prevPrice: 10, prevDate: a.refs.daily!.KOSPI!.prevDate! } } }, a.refs);
    expect(krCell.state).toBe("ok");
    expect(formatCompareRate(krCell.indexRate!)).toBe(R(a.values, "kr"));
  });

  it("C65 기본 경로(평일 오전): 홈 두 시장 값 = 도착 표 '하루' 행 지수 열", () => {
    const a = lineAt("2026-11-12T10:00:00", "sameBusinessDay");
    const hold = (ticker: string) => [{ ticker, name: "종목", quantity: 1 }];
    const kr = computePeriodCell("kr", "daily", hold("005930"), { daily: { "005930": { refPrice: 11, refDate: a.values[0].endDate, prevPrice: 10, prevDate: a.refs.daily!.KOSPI!.prevDate! } } }, a.refs);
    const us = computePeriodCell("us", "daily", hold("AAPL"), { daily: { AAPL: { refPrice: 11, refDate: a.values[1].endDate, prevPrice: 10, prevDate: a.refs.daily!.SPX!.prevDate! } } }, a.refs);
    expect(formatCompareRate(kr.indexRate!)).toBe(R(a.values, "kr"));
    expect(formatCompareRate(us.indexRate!)).toBe(R(a.values, "us"));
  });
});
