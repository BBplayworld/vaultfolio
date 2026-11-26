// #309 '언제 시세' — slot → 실제 KST 시각(getStockCacheSlot 역함수)·라벨·대표값
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Stock } from "@/types/asset";
import { getStockCacheSlot } from "../stock-cache-slot";
import { priceAsOf, priceAsOfLine, priceAsOfText } from "../price-freshness";

afterEach(() => vi.useRealTimers());

/** KST 시각 문자열 → 그 시각의 slot */
function slotAt(kst: string, market: "domestic" | "foreign"): string {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(`${kst}+09:00`));
  const slot = getStockCacheSlot(market);
  vi.useRealTimers();
  return slot;
}
const label = (kst: string, market: "domestic" | "foreign", today = kst.slice(0, 10)) => {
  const a = priceAsOf(slotAt(kst, market), market);
  return a ? priceAsOfText(a, today) : null;
};

describe("국내 — 장중 칸 날짜는 effectiveDate(16시 전 = 어제 날짜)", () => {
  it("10시: slot은 어제 날짜지만 오늘 10시로 읽는다", () => {
    expect(slotAt("2026-11-24T10:20:00", "domestic")).toBe("2026-11-23-H10");
    expect(label("2026-11-24T10:20:00", "domestic")).toBe("10시 시세");
    expect(label("2026-11-24T10:20:00", "domestic", "2026-11-25")).toBe("11/24 10시 시세");
  });
  it("16시·20시·개장 전 경계", () => {
    expect(label("2026-11-24T16:05:00", "domestic")).toBe("16시 시세");
    expect(label("2026-11-24T19:59:00", "domestic")).toBe("19시 시세");
    expect(label("2026-11-24T20:00:00", "domestic")).toBe("11/24 종가");
    expect(label("2026-11-24T08:59:00", "domestic")).toBe("11/23 종가");
    expect(label("2026-11-24T09:00:00", "domestic")).toBe("9시 시세");
  });
  it("토·일·공휴일은 직전 영업일 종가", () => {
    expect(label("2026-11-28T12:00:00", "domestic")).toBe("11/27 종가");
    expect(label("2026-11-29T12:00:00", "domestic")).toBe("11/27 종가");
    expect(label("2026-12-25T12:00:00", "domestic")).toBe("12/24 종가");
  });
});

describe("해외 — 07시 전 장중 칸은 전날 날짜, 날짜 칸 = 미국 거래일", () => {
  it("표준시(11월) 05·06·17·18시", () => {
    expect(label("2026-11-25T05:30:00", "foreign")).toBe("5시 시세");
    expect(slotAt("2026-11-25T05:30:00", "foreign")).toBe("2026-11-24-H05");
    expect(label("2026-11-25T06:30:00", "foreign")).toBe("미국 11/24 종가");
    expect(label("2026-11-24T17:30:00", "foreign")).toBe("미국 11/23 종가");
    expect(label("2026-11-24T18:30:00", "foreign")).toBe("18시 시세");
  });
  it("서머타임(7월) 04·05·16·17시", () => {
    expect(label("2026-07-15T04:30:00", "foreign")).toBe("4시 시세");
    expect(label("2026-07-15T05:30:00", "foreign")).toBe("미국 7/14 종가");
    expect(label("2026-07-15T16:30:00", "foreign")).toBe("미국 7/14 종가");
    expect(label("2026-07-15T17:30:00", "foreign")).toBe("17시 시세");
  });
  it("미국 휴장(추수감사절)은 직전 거래일", () => {
    expect(label("2026-11-26T20:00:00", "foreign")).toBe("미국 11/25 종가");
  });
  it("미국 종가 실제 시각 = KST 다음 날 06시(표준)·05시(서머타임)", () => {
    expect(priceAsOf("2026-11-24", "foreign")!.at).toBe(Date.parse("2026-11-25T06:00:00+09:00"));
    expect(priceAsOf("2026-07-14", "foreign")!.at).toBe(Date.parse("2026-07-15T05:00:00+09:00"));
    expect(priceAsOf("2026-11-24", "domestic")!.at).toBe(Date.parse("2026-11-24T15:30:00+09:00"));
  });
});

describe("역함수 불변식 — 30분 간격 1주(11월·7월)", () => {
  for (const start of ["2026-11-21T00:00:00", "2026-07-11T00:00:00"]) {
    it(`${start} 주간: 장중 칸 = 지금 KST 날짜·시, 날짜 칸 시각 ≤ 지금`, () => {
      const t0 = Date.parse(`${start}+09:00`);
      for (let k = 0; k < 7 * 48; k++) {
        const now = t0 + k * 30 * 60 * 1000;
        const kst = new Date(now + 9 * 3600 * 1000).toISOString();
        for (const market of ["domestic", "foreign"] as const) {
          vi.useFakeTimers();
          vi.setSystemTime(new Date(now));
          const slot = getStockCacheSlot(market);
          vi.useRealTimers();
          const a = priceAsOf(slot, market)!;
          expect(a, `${market} ${slot}`).not.toBeNull();
          expect(a.at <= now, `${market} ${slot} @${kst}`).toBe(true);
          if (a.kind === "intraday") {
            expect(a.date).toBe(kst.slice(0, 10));
            expect(a.hour).toBe(Number(kst.slice(11, 13)));
          }
        }
      }
    });
  }
});

describe("priceAsOfLine", () => {
  const s = (ticker: string, baseDate: string | undefined, p: Partial<Stock> = {}) =>
    ({ id: `${ticker}-${p.broker ?? ""}`, ticker, category: "domestic", baseDate, ...p }) as Stock;
  const today = "2026-11-25";

  it("문자열 최솟값 함정: 오늘 14시(2026-11-24-H14)보다 어제 17시(2026-11-24-H17)가 더 오래됐다", () => {
    const v = priceAsOfLine([s("005930", "2026-11-24-H14"), s("000660", "2026-11-24-H17")], [], { today, prefix: "주식 " });
    expect(v).toEqual({ main: "주식 11/24 17시 시세", failedText: "" });
  });
  it("국내·해외 혼재는 오래된 쪽 1개", () => {
    const v = priceAsOfLine([s("005930", "2026-11-24-H14"), s("AAPL", "2026-11-24", { category: "foreign" })], [], { today });
    expect(v?.main).toBe("미국 11/24 종가");
  });
  it("실패 종목은 대표값에서 빼고 꼬리에 수(같은 티커 여러 증권사 = 1)", () => {
    const stocks = [s("005930", "2026-11-25-H14"), s("000660", "2026-11-21", { broker: "a" }), s("000660", "2026-11-21", { broker: "b" })];
    expect(priceAsOfLine(stocks, ["000660"], { today: "2026-11-26", prefix: "주식 " })).toEqual({ main: "주식 14시 시세", failedText: "1종목 이전 시세" });
  });
  it("전부 실패면 꼬리만", () => {
    expect(priceAsOfLine([s("005930", "2026-11-21"), s("000660", undefined)], ["005930", "000660"], { today })).toEqual({ main: "", failedText: "2종목 이전 시세" });
  });
  it("새 세션(실패 0)은 전체 최솟값", () => {
    expect(priceAsOfLine([s("005930", "2026-11-25-H14"), s("000660", "2026-11-21")], [], { today })?.main).toBe("11/21 종가");
  });
  it("대상 0·baseDate 없음만·비상장·상장폐지 → null, 대상 밖 실패 티커는 세지 않음", () => {
    expect(priceAsOfLine([], [], { today })).toBeNull();
    expect(priceAsOfLine([s("005930", undefined)], [], { today })).toBeNull();
    expect(priceAsOfLine([s("X1", "2026-11-21", { category: "unlisted" }), s("Y1", "2026-11-21", { inactiveStatus: "delisted" })], ["X1", "Y1"], { today })).toBeNull();
    expect(priceAsOfLine([s("005930", "2026-11-24-H14")], ["AAPL"], { today })).toEqual({ main: "14시 시세", failedText: "" });
  });
  it("알 수 없는 baseDate 형식은 무시", () => {
    expect(priceAsOf("garbage", "domestic")).toBeNull();
    expect(priceAsOf(undefined, "domestic")).toBeNull();
  });
});
