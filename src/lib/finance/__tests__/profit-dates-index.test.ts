// #132 U2 지수 시계열 → 기준 종가(종목 경로와 같은 규칙) 순수 함수
import { describe, expect, it } from "vitest";
import { buildRefEntryFromSeries, getSeriesRange, pickCloseOnOrBefore } from "../profit-dates";
import { parseIndexSeries } from "../finance-service";

const S = [
  { date: "2026-10-01", price: 100 },
  { date: "2026-10-02", price: 101 },
  { date: "2026-10-05", price: 102 },
  { date: "2026-10-06", price: 0 }, // 무효 행
  { date: "2026-10-08", price: 104 },
];

describe("pickCloseOnOrBefore", () => {
  it("요청일 행이 있으면 그 행", () => {
    expect(pickCloseOnOrBefore(S, "2026-10-05")).toEqual({ date: "2026-10-05", price: 102 });
  });
  it("요청일이 비거래일이면 직전 거래일(무효 행 건너뜀)", () => {
    expect(pickCloseOnOrBefore(S, "2026-10-07")).toEqual({ date: "2026-10-05", price: 102 });
    expect(pickCloseOnOrBefore(S, "2026-10-04")).toEqual({ date: "2026-10-02", price: 101 });
  });
  it("lookback 5일: 요청일-4일까지만 거슬러 간다(국내 종목 5일 롤백과 같다)", () => {
    expect(pickCloseOnOrBefore(S, "2026-10-06", 5)).toEqual({ date: "2026-10-05", price: 102 });
    expect(pickCloseOnOrBefore(S, "2026-10-09", 5)).toEqual({ date: "2026-10-08", price: 104 });
    // 10/13 요청: 10/9~10/13 범위에 행 없음 → null
    expect(pickCloseOnOrBefore(S, "2026-10-13", 5)).toBeNull();
    expect(pickCloseOnOrBefore(S, "2026-10-13")).toEqual({ date: "2026-10-08", price: 104 });
  });
  it("요청일보다 이른 행이 없으면 null", () => {
    expect(pickCloseOnOrBefore(S, "2026-09-30")).toBeNull();
  });
});

describe("buildRefEntryFromSeries", () => {
  it("일별: ref·prev 모두 실제 거래일", () => {
    expect(buildRefEntryFromSeries(S, { refDate: "2026-10-05", prevDate: "2026-10-02", refHoliday: false })).toEqual({
      refPrice: 102, refDate: "2026-10-05", prevPrice: 101, prevDate: "2026-10-02",
    });
  });
  it("일별 종료일이 휴장(refHoliday)이면 refDate는 명목일, 값은 직전 종가 — profit 라우트와 같다", () => {
    expect(buildRefEntryFromSeries(S, { refDate: "2026-10-09", prevDate: "2026-10-08", refHoliday: true }, 5)).toEqual({
      refPrice: 104, refDate: "2026-10-09", prevPrice: 104, prevDate: "2026-10-08",
    });
  });
  it("주간·월간(ref만): 비거래일이면 실제 거래일로 바뀐다", () => {
    expect(buildRefEntryFromSeries(S, { refDate: "2026-10-04", refHoliday: false })).toEqual({ refPrice: 101, refDate: "2026-10-02" });
  });
  it("끝 종가가 없으면 null(0%를 만들지 않는다)", () => {
    expect(buildRefEntryFromSeries([], { refDate: "2026-10-05", refHoliday: false })).toBeNull();
  });
});

describe("getSeriesRange", () => {
  it("가장 이른 필요일 - 10일 ~ 끝 종가일", () => {
    expect(getSeriesRange({ refDate: "2026-11-10", prevDate: "2026-11-09" })).toEqual({ start: "2026-10-30", end: "2026-11-10" });
    expect(getSeriesRange({ refDate: "2026-10-10" })).toEqual({ start: "2026-09-30", end: "2026-10-10" });
  });
});

describe("parseIndexSeries", () => {
  it("KIS output2(내림차순·문자열) → 오름차순 종가, 무효 행 제외", () => {
    const out = [
      { stck_bsop_date: "20261110", bstp_nmix_prpr: "3160.25" },
      { stck_bsop_date: "20261109", bstp_nmix_prpr: "3150.10" },
      { stck_bsop_date: "", bstp_nmix_prpr: "1" },
      { stck_bsop_date: "20261106", bstp_nmix_prpr: "0" },
    ];
    expect(parseIndexSeries(out, "bstp_nmix_prpr")).toEqual([
      { date: "2026-11-09", price: 3150.1 },
      { date: "2026-11-10", price: 3160.25 },
    ]);
    expect(parseIndexSeries(undefined, "x")).toEqual([]);
  });
});
