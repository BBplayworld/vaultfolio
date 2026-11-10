// #132 U4 블록 N·제외 셈(cto 판정 2 ④), 기준 종가 구간 표기(①-1)
import { describe, expect, it } from "vitest";
import type { Stock } from "@/types/asset";
import type { ProfitRefResponse } from "@/app/api/finance/profit/route";
import type { MarketIndexResponse } from "@/app/api/finance/market-index/route";
import { cellRange, classifyHoldings, computeMarketCompare, refRangeParts, summarizeCompare, type PeriodRefs } from "../market-compare";

let seq = 0;
const stock = (o: Partial<Stock>): Stock => ({
  id: `s${++seq}`, category: "domestic", name: "종목", ticker: "005930", quantity: 10,
  averagePrice: 100, currentPrice: 100, currency: "KRW", purchaseDate: "2026-11-10", ...o,
} as Stock);
const PEERS = new Set(["005930", "000660", "069500", "035720"]);

const d = (prev: number, ref: number, prevDate = "2026-11-06", refDate = "2026-11-09") => ({ refPrice: ref, refDate, prevPrice: prev, prevDate });
const IDX: PeriodRefs<MarketIndexResponse> = {
  daily: { KOSPI: d(100, 101), SPX: d(100, 101) },
  weekly: { KOSPI: { refPrice: 99, refDate: "2026-11-03" }, SPX: { refPrice: 99, refDate: "2026-11-03" } },
  monthly: { KOSPI: { refPrice: 98, refDate: "2026-10-08" }, SPX: { refPrice: 98, refDate: "2026-10-09" } },
};

describe("summarizeCompare — 블록 N·제외 셈", () => {
  const stocks = [
    stock({ name: "삼성전자", ticker: "005930" }),
    stock({ name: "SK하이닉스", ticker: "000660" }),
    stock({ name: "공모주", ticker: "035720" }), // 1개월 기준가 없음(기간 중 상장)
    stock({ name: "KODEX 200", ticker: "069500" }), // 세 기간 모두 기준가 없음
    stock({ name: "폐지", ticker: "999999", inactiveStatus: "delisted" }),
    stock({ name: "비상장A", ticker: undefined, category: "unlisted" }),
    stock({ name: "비상장A", ticker: undefined, category: "unlisted" }), // 같은 이름 다른 계좌 = 1
    stock({ name: "토요타", ticker: "7203", category: "foreign", currency: "JPY" }),
  ];
  const daily: ProfitRefResponse = { "005930": d(100, 102), "000660": d(100, 98), "035720": d(100, 101), "069500": null, "7203": d(100, 100) };
  const weekly: ProfitRefResponse = {
    "005930": { refPrice: 95, refDate: "2026-11-03" }, "000660": { refPrice: 97, refDate: "2026-11-03" },
    "035720": { refPrice: 99, refDate: "2026-11-03" }, "069500": null, "7203": { refPrice: 99, refDate: "2026-11-03" },
  };
  const monthly: ProfitRefResponse = {
    "005930": { refPrice: 90, refDate: "2026-10-08" }, "000660": { refPrice: 90, refDate: "2026-10-08" },
    "035720": null, "069500": null, "7203": { refPrice: 99, refDate: "2026-10-08" },
  };
  const classified = classifyHoldings(stocks, PEERS);
  const blocks = computeMarketCompare(classified, { daily, weekly, monthly }, IDX);
  const s = summarizeCompare(classified, blocks)!;

  it("N종목 = 세 기간 중 하나 이상 합산된 종목(공모주 포함, 전 기간 기준가 없음 제외)", () => {
    expect(s.blockCounts).toEqual({ kr: 3 });
  });

  it("제외 = 한 기간이라도 빠진 고유 종목 + 비상장(이름 중복 1). 일부 기간만 빠지면 기간 접두", () => {
    expect(s.excluded.count).toBe(3);
    expect(s.excluded.reasons).toEqual([
      { label: "1개월 기준가 없음", count: 1 },
      { label: "기준가 없음", count: 1 },
      { label: "비상장·티커 없음", count: 1 },
    ]);
  });

  it("상장폐지는 블록·제외·비교하지 않은 종목 어디에도 세지 않는다", () => {
    expect(JSON.stringify(s)).not.toContain("999999");
    expect(s.notCompared).toEqual({ count: 1, reasons: ["foreignNonUs"] });
    expect(blocks.flatMap((b) => Object.values(b.periods).flatMap((c) => c.rows.map((r) => r.ticker)))).not.toContain("999999");
  });

  it("기간마다 사유가 다르면 기준가 없음 우선, 기준일 다름만 있으면 그 사유", () => {
    const c2 = classifyHoldings([stock({ ticker: "005930" }), stock({ ticker: "000660" }), stock({ ticker: "035720" })], PEERS);
    const b2 = computeMarketCompare(c2, {
      daily: { "005930": d(100, 101), "000660": d(100, 101), "035720": d(100, 101, "2026-11-05", "2026-11-06") },
      weekly: { "005930": { refPrice: 99, refDate: "2026-11-03" }, "000660": { refPrice: 99, refDate: "2026-11-03" }, "035720": null },
      monthly: { "005930": { refPrice: 99, refDate: "2026-10-08" }, "000660": { refPrice: 99, refDate: "2026-10-08" }, "035720": { refPrice: 99, refDate: "2026-10-08" } },
    }, IDX);
    // 035720: 하루 = 기준일 다름(끝 11/6), 1주 = 기준가 없음, 1개월 = 끝이 일별 ref(11/6)라 기준일 다름 → 세 기간 모두 빠짐, 기준가 없음 우선
    expect(summarizeCompare(c2, b2)!.excluded.reasons).toEqual([{ label: "기준가 없음", count: 1 }]);
    expect(summarizeCompare(c2, b2)!.blockCounts).toEqual({ kr: 2 });
  });

  it("조회 중(키 없음) 칸이 있으면 셈하지 않는다(A8)", () => {
    const b3 = computeMarketCompare(classified, { daily, weekly }, IDX);
    expect(summarizeCompare(classified, b3)).toBeNull();
  });
});

describe("기준 종가 구간 표기 M/D→M/D", () => {
  it("공백·연도 없음, 열 머리용으로 [시작→, 끝] 분리", () => {
    expect(refRangeParts("2026-11-03", "2026-11-10")).toEqual(["11/3→", "11/10"]);
    expect(refRangeParts("2026-12-10", "2027-01-09").join("")).toBe("12/10→1/9");
  });

  it("휴장 칸은 '휴장', 조회 중은 표기 없음, 지수만 날짜가 달라도 종목 기준쌍", () => {
    const c = classifyHoldings([stock({ ticker: "005930" })], PEERS);
    const sat = computeMarketCompare(c, {
      daily: { "005930": d(100, 100, "2026-11-06", "2026-11-06") },
      weekly: { "005930": { refPrice: 99, refDate: "2026-11-03" } },
      monthly: { "005930": { refPrice: 99, refDate: "2026-10-08" } },
    }, { ...IDX, weekly: { KOSPI: { refPrice: 99, refDate: "2026-11-02" }, SPX: null } })[0];
    expect(cellRange(sat.periods.daily)).toEqual({ kind: "holiday" });
    expect(sat.periods.weekly.indexState).toBe("dateMismatch");
    expect(cellRange(sat.periods.weekly)).toEqual({ kind: "range", parts: ["11/3→", "11/6"] });
    const loading = computeMarketCompare(c, {}, IDX)[0];
    expect(cellRange(loading.periods.daily)).toBeNull();
  });
});
