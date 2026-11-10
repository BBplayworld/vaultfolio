import { describe, it, expect, afterEach, vi } from "vitest";
import {
  getTodayChipSession,
  getStockChipQuote,
  computeTodayChip,
  todayChipLabel,
  type ChipMarket,
} from "../today-chip";
import { computeDailyStockProfit, getDailyClosingRefDates, getProfitBasis, type ProfitBasis } from "../profit-utils";
import { isKrBusinessDay, rollbackToBusinessDay } from "../kr-holidays";
import { isUsBusinessDay, rollbackToUsBusinessDay } from "../us-holidays";
import { STORAGE_KEYS } from "@/lib/local-storage";
import type { Stock } from "@/types/asset";
import type { ProfitRefResponse } from "@/app/api/finance/profit/route";

// ── 가짜 시세 ─────────────────────────────────────────────
// 거래일마다 값이 달라지는 결정적 종가(종목마다 기울기가 달라 AAPL·NVDA 등락이 서로 다르다)
const DAY0 = Date.parse("2026-01-01T00:00:00Z");
const SLOPE: Record<string, [number, number]> = { "005930": [50000, 37], AAPL: [200, 0.9], NVDA: [900, -1.1] };
const MARKET: Record<string, ChipMarket> = { "005930": "domestic", AAPL: "foreign", NVDA: "foreign" };
function close(ticker: string, date: string): number {
  const n = Math.round((Date.parse(`${date}T00:00:00Z`) - DAY0) / 86400000);
  const [base, step] = SLOPE[ticker];
  // 요일마다 들쭉날쭉하게(같은 값 반복 방지)
  return base + step * n + (n % 3) * step * 0.5;
}
const ymd = (d: Date) => d.toISOString().slice(0, 10);
const lastTradeOnOrBefore = (date: string, market: ChipMarket) =>
  ymd((market === "domestic" ? rollbackToBusinessDay : rollbackToUsBusinessDay)(new Date(`${date}T00:00:00Z`)));
const isBiz = (date: string, market: ChipMarket) =>
  (market === "domestic" ? isKrBusinessDay : isUsBusinessDay)(new Date(`${date}T00:00:00Z`));

// /api/finance/profit?period=daily 응답 재현(route.ts 47~ 동작: 휴장 명목일 유지, KIS 직전 거래일 폴백)
function serverDaily(tickers: string[], basis: ProfitBasis = "kstAccessDay"): ProfitRefResponse {
  const usDates = getDailyClosingRefDates("foreign");
  const krDates = basis === "sameBusinessDay" ? usDates : getDailyClosingRefDates("domestic");
  const out: ProfitRefResponse = {};
  for (const t of tickers) {
    const m = MARKET[t];
    const dates = m === "domestic" ? krDates : usDates;
    const refActual = lastTradeOnOrBefore(dates.refDate, m);
    const prevActual = lastTradeOnOrBefore(dates.prevDate, m);
    out[t] = {
      refPrice: close(t, refActual),
      refDate: isBiz(dates.refDate, m) ? refActual : dates.refDate,
      prevPrice: close(t, prevActual),
      prevDate: prevActual,
    };
  }
  return out;
}

const RATES = { USD: 1400, JPY: 900 };
const kr = (o: Partial<Stock> = {}): Stock =>
  ({ id: "kr", ticker: "005930", category: "domestic", name: "삼성전자", quantity: 10, averagePrice: 1, currentPrice: 1, currency: "KRW", purchaseDate: "2026-01-01", ...o }) as Stock;
const us = (ticker: "AAPL" | "NVDA", o: Partial<Stock> = {}): Stock =>
  ({ id: ticker, ticker, category: "foreign", name: ticker, quantity: 3, averagePrice: 1, currentPrice: 1, currency: "USD", purchaseDate: "2026-01-01", ...o }) as Stock;

// 장 종료 후 현재가에 일부러 엉뚱한 값(프리·애프터마켓 가정)을 넣어 '현재가 미사용'까지 확인
const LIVE_UP = 1.03;
function at(kst: string) {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(`${kst}+09:00`));
  return new Date(`${kst}+09:00`);
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

type Expect = { label: "오늘"; base: string } | { label: string; last: string; prev: string } | null;
function check(ticker: "005930" | "AAPL" | "NVDA", now: Date, refData: ProfitRefResponse, exp: Expect, gapConfirmed?: Record<ChipMarket, boolean>) {
  const s = ticker === "005930" ? kr() : us(ticker);
  if (exp && exp.label === "오늘") {
    const cur = close(ticker, (exp as { base: string }).base) * LIVE_UP;
    const chip = computeTodayChip([{ ...s, currentPrice: cur }], refData, RATES, now, gapConfirmed);
    expect(chip).not.toBeNull();
    expect(todayChipLabel(chip!, "row")).toBe("오늘");
    expect(chip!.rate).toBeCloseTo((LIVE_UP - 1) * 100, 6);
    return;
  }
  const chip = computeTodayChip([{ ...s, currentPrice: 123456 }], refData, RATES, now, gapConfirmed);
  if (exp === null) {
    expect(chip).toBeNull();
    return;
  }
  const e = exp as { label: string; last: string; prev: string };
  expect(chip).not.toBeNull();
  expect(todayChipLabel(chip!, "row")).toBe(e.label);
  expect(chip!.closeDates).toEqual([e.last]);
  expect(chip!.rate).toBeCloseTo((close(ticker, e.last) / close(ticker, e.prev) - 1) * 100, 6);
  expect(chip!.rate).not.toBe(0);
}

// spec 3-5 기준 시각표 앞 8행(2026-11 미국 표준시 + 한글날·추수감사절)
const TABLE: { kst: string; kr: Expect; us: Expect }[] = [
  { kst: "2026-11-10T08:00:00", kr: { label: "11/9 종가", last: "2026-11-09", prev: "2026-11-06" }, us: { label: "11/9 종가", last: "2026-11-09", prev: "2026-11-06" } },
  { kst: "2026-11-10T10:00:00", kr: { label: "오늘", base: "2026-11-09" }, us: { label: "11/9 종가", last: "2026-11-09", prev: "2026-11-06" } },
  { kst: "2026-11-10T17:00:00", kr: { label: "11/10 종가", last: "2026-11-10", prev: "2026-11-09" }, us: { label: "11/9 종가", last: "2026-11-09", prev: "2026-11-06" } },
  { kst: "2026-11-10T23:45:00", kr: { label: "11/10 종가", last: "2026-11-10", prev: "2026-11-09" }, us: { label: "오늘", base: "2026-11-09" } },
  { kst: "2026-11-11T00:30:00", kr: { label: "11/10 종가", last: "2026-11-10", prev: "2026-11-09" }, us: { label: "오늘", base: "2026-11-09" } },
  { kst: "2026-11-11T07:30:00", kr: { label: "11/10 종가", last: "2026-11-10", prev: "2026-11-09" }, us: { label: "11/10 종가", last: "2026-11-10", prev: "2026-11-09" } },
  { kst: "2026-11-14T12:00:00", kr: { label: "11/13 종가", last: "2026-11-13", prev: "2026-11-12" }, us: { label: "11/13 종가", last: "2026-11-13", prev: "2026-11-12" } },
  { kst: "2026-11-16T08:00:00", kr: { label: "11/13 종가", last: "2026-11-13", prev: "2026-11-12" }, us: { label: "11/13 종가", last: "2026-11-13", prev: "2026-11-12" } },
  { kst: "2026-10-09T10:00:00", kr: { label: "10/8 종가", last: "2026-10-08", prev: "2026-10-07" }, us: { label: "10/8 종가", last: "2026-10-08", prev: "2026-10-07" } },
  // 추수감사절(11/26) 다음 날: 미국 마지막 거래일 11/25지만 서버 응답이 명목 휴장일(11/26) 종가쌍이라 두 종가를 못 구함 → 숨김
  { kst: "2026-11-27T10:00:00", kr: { label: "오늘", base: "2026-11-26" }, us: null },
];

describe("today-chip · 기준 시각표(T1) — 종가 기준 설정 2종 모두 같은 결과", () => {
  for (const basis of ["sameBusinessDay", "kstAccessDay"] as const) {
    for (const row of TABLE) {
      it(`[설정 ${basis}] KST ${row.kst} 국내·미국`, () => {
        const now = at(row.kst);
        // 설정값을 실제로 바꿔 둔 기기를 흉내 — 칩은 설정을 읽지 않는다
        const store = new Map<string, string>([[STORAGE_KEYS.profitBasis, basis]]);
        vi.stubGlobal("window", {});
        vi.stubGlobal("localStorage", { getItem: (k: string) => store.get(k) ?? null, setItem: () => {} });
        expect(getProfitBasis()).toBe(basis);
        const refData = serverDaily(["005930", "AAPL", "NVDA"]); // stock-tab 칩 쿼리는 항상 kstAccessDay
        check("005930", now, refData, row.kr);
        check("AAPL", now, refData, row.us);
        check("NVDA", now, refData, row.us);
      });
    }
  }
});

describe("today-chip · 예외 구간(Q6, T2)", () => {
  it("화 15:45 국내 — 미확인이면 오늘(현재가 vs 11/9, main 값과 동일), 확인되면 11/10 종가", () => {
    const now = at("2026-11-10T15:45:00");
    const refData = serverDaily(["005930", "AAPL"]);
    expect(getTodayChipSession("domestic", now).phase).toBe("afterCloseGap");
    check("005930", now, refData, { label: "오늘", base: "2026-11-09" });
    const cur = close("005930", "2026-11-09") * 1.02;
    const st = [kr({ currentPrice: cur })];
    const fallback = computeTodayChip(st, refData, RATES, now)!;
    expect(todayChipLabel(fallback, "row")).toBe("오늘");
    expect(todayChipLabel(fallback, "header")).toBe("오늘");
    const main = computeDailyStockProfit(st, refData, RATES, { useLivePrice: true }).dailyProfitRate!;
    expect(fallback.rate).toBeCloseTo(main, 9);
    const chip = computeTodayChip(st, refData, RATES, now, { domestic: true, foreign: false })!;
    expect(todayChipLabel(chip, "row")).toBe("11/10 종가");
    expect(chip.rate).toBeCloseTo(2, 6);
    check("AAPL", now, refData, { label: "11/9 종가", last: "2026-11-09", prev: "2026-11-06" });
  });

  it("수 06:30 미국 — 미확인이면 숨김, 확인되면 11/10 종가 = 현재가 vs 11/9. 국내는 11/10 종가", () => {
    const now = at("2026-11-11T06:30:00");
    const refData = serverDaily(["005930", "AAPL"]);
    expect(getTodayChipSession("foreign", now)).toEqual({ phase: "afterCloseGap", tradeDate: "2026-11-10", baseDate: "2026-11-09" });
    check("AAPL", now, refData, null);
    const cur = close("AAPL", "2026-11-09") * 0.99;
    const chip = computeTodayChip([us("AAPL", { currentPrice: cur })], refData, RATES, now, { domestic: false, foreign: true })!;
    expect(todayChipLabel(chip, "row")).toBe("11/10 종가");
    expect(chip.rate).toBeCloseTo(-1, 6);
    check("005930", now, refData, { label: "11/10 종가", last: "2026-11-10", prev: "2026-11-09" });
  });
});

describe("today-chip · 상태 판정 순수 함수(서머타임·휴장·조기 폐장)", () => {
  const S = (m: ChipMarket, kst: string) => getTodayChipSession(m, new Date(`${kst}+09:00`));
  it("국내 경계: 08:59 장 전 / 09:00 장중 / 15:29 장중 / 15:30 마감 직후 / 16:00 장 종료 후", () => {
    expect(S("domestic", "2026-11-10T08:59:00")).toEqual({ phase: "closed", tradeDate: "2026-11-09", baseDate: "2026-11-06" });
    expect(S("domestic", "2026-11-10T09:00:00")).toEqual({ phase: "live", tradeDate: "2026-11-10", baseDate: "2026-11-09" });
    expect(S("domestic", "2026-11-10T15:29:00").phase).toBe("live");
    expect(S("domestic", "2026-11-10T15:30:00").phase).toBe("afterCloseGap");
    expect(S("domestic", "2026-11-10T16:00:00")).toEqual({ phase: "closed", tradeDate: "2026-11-10", baseDate: "2026-11-09" });
  });
  it("미국 표준시(11월): KST 23:30 장중 시작, 06:00 마감 직후, 07:00 장 종료 후", () => {
    expect(S("foreign", "2026-11-10T23:29:00")).toEqual({ phase: "closed", tradeDate: "2026-11-09", baseDate: "2026-11-06" });
    expect(S("foreign", "2026-11-10T23:30:00")).toEqual({ phase: "live", tradeDate: "2026-11-10", baseDate: "2026-11-09" });
    expect(S("foreign", "2026-11-11T05:59:00").phase).toBe("live");
    expect(S("foreign", "2026-11-11T06:00:00").phase).toBe("afterCloseGap");
    expect(S("foreign", "2026-11-11T07:00:00")).toEqual({ phase: "closed", tradeDate: "2026-11-10", baseDate: "2026-11-09" });
  });
  it("미국 서머타임(7월): KST 22:30 장중, 05:00 마감 직후, 06:00 장 종료 후", () => {
    expect(S("foreign", "2026-07-14T22:29:00").phase).toBe("closed");
    expect(S("foreign", "2026-07-14T22:30:00")).toEqual({ phase: "live", tradeDate: "2026-07-14", baseDate: "2026-07-13" });
    expect(S("foreign", "2026-07-15T04:59:00").phase).toBe("live");
    expect(S("foreign", "2026-07-15T05:00:00").phase).toBe("afterCloseGap");
    expect(S("foreign", "2026-07-15T06:00:00")).toEqual({ phase: "closed", tradeDate: "2026-07-14", baseDate: "2026-07-13" });
  });
  it("서머타임 해제 주(11/1): 금 10/30은 EDT, 월 11/2는 EST로 판정", () => {
    expect(S("foreign", "2026-10-30T22:45:00").phase).toBe("live"); // ET 09:45 EDT
    expect(S("foreign", "2026-10-31T05:30:00")).toEqual({ phase: "afterCloseGap", tradeDate: "2026-10-30", baseDate: "2026-10-29" });
    expect(S("foreign", "2026-11-02T22:45:00").phase).toBe("closed"); // ET 08:45 EST → 개장 전
    expect(S("foreign", "2026-11-03T05:30:00")).toEqual({ phase: "live", tradeDate: "2026-11-02", baseDate: "2026-10-30" });
  });
  it("미국 휴장·조기 폐장: 추수감사절(11/26) 전후 종가일, 조기 폐장일(11/27) 종가쌍은 11/25→11/27", () => {
    expect(S("foreign", "2026-11-27T10:00:00")).toEqual({ phase: "closed", tradeDate: "2026-11-25", baseDate: "2026-11-24" });
    expect(S("foreign", "2026-11-27T23:45:00")).toEqual({ phase: "live", tradeDate: "2026-11-27", baseDate: "2026-11-25" });
    expect(S("foreign", "2026-11-28T07:30:00")).toEqual({ phase: "closed", tradeDate: "2026-11-27", baseDate: "2026-11-25" });
  });
  it("국내 한글날(10/9 금) 연휴: 다음 개장일 장중 기준 종가는 10/8", () => {
    expect(S("domestic", "2026-10-09T17:00:00")).toEqual({ phase: "closed", tradeDate: "2026-10-08", baseDate: "2026-10-07" });
    expect(S("domestic", "2026-10-12T10:00:00")).toEqual({ phase: "live", tradeDate: "2026-10-12", baseDate: "2026-10-08" });
  });
});

describe("today-chip · 서버 응답과의 결합(휴장 명목일·조기 폐장)", () => {
  it("한글날 다음 개장일 장중: 명목 휴장일 refDate(10/9)여도 기준 종가 = 10/8 종가", () => {
    const now = at("2026-10-12T10:00:00");
    const refData = serverDaily(["005930"]);
    expect(refData["005930"]!.refDate).toBe("2026-10-09");
    check("005930", now, refData, { label: "오늘", base: "2026-10-08" });
  });
  it("한글날 이튿날 개장 전(10/13 08:00): 10/12 종가 = 10/8→10/12", () => {
    const now = at("2026-10-13T08:00:00");
    check("005930", now, serverDaily(["005930"]), { label: "10/12 종가", last: "2026-10-12", prev: "2026-10-08" });
  });
  it("한글날 16시 이후 ~ 다음 개장 전: 응답이 같은 종가쌍 → 숨김(0.0% 금지, 알려진 한계)", () => {
    for (const kst of ["2026-10-09T17:00:00", "2026-10-10T12:00:00", "2026-10-12T08:00:00"]) {
      const now = at(kst);
      check("005930", now, serverDaily(["005930"]), null);
    }
  });
  it("조기 폐장일(11/27) 마감 뒤: 11/27 종가 = 11/25→11/27", () => {
    const now = at("2026-11-28T07:30:00");
    check("AAPL", now, serverDaily(["AAPL"]), { label: "11/27 종가", last: "2026-11-27", prev: "2026-11-25" });
  });
  it("미국 종목 일·월 KST 00~07시: 서버 응답이 한 칸 이전 쌍(목/수) → 숨김(알려진 한계)", () => {
    for (const kst of ["2026-11-15T06:00:00", "2026-11-16T03:00:00"]) {
      const now = at(kst);
      check("AAPL", now, serverDaily(["AAPL"]), null);
    }
  });
  it("응답이 없거나 prev가 없거나 종가가 0이면 칩 없음", () => {
    const now = at("2026-11-10T17:00:00");
    expect(computeTodayChip([kr({ currentPrice: 1 })], undefined, RATES, now)).toBeNull();
    expect(computeTodayChip([kr({ currentPrice: 1 })], { "005930": null }, RATES, now)).toBeNull();
    expect(computeTodayChip([kr({ currentPrice: 1 })], { "005930": { refPrice: 10, refDate: "2026-11-10" } }, RATES, now)).toBeNull();
    expect(computeTodayChip([kr({ currentPrice: 1 })], { "005930": { refPrice: 10, refDate: "2026-11-10", prevPrice: 0, prevDate: "2026-11-09" } }, RATES, now)).toBeNull();
    expect(computeTodayChip([kr({ currentPrice: 1, category: "unlisted" })], serverDaily(["005930"]), RATES, now)).toBeNull();
  });
  it("실제 등락 0인 종목은 ▲0.0%(0)로 보인다 — 숨기지 않음", () => {
    const now = at("2026-11-10T17:00:00");
    const r = { "005930": { refPrice: 100, refDate: "2026-11-10", prevPrice: 100, prevDate: "2026-11-09" } };
    expect(computeTodayChip([kr()], r, RATES, now)!.rate).toBe(0);
  });
});

describe("today-chip · 값 정의(T3·T5·T6·T7)", () => {
  it("T3 국내 장중 값은 main(useLivePrice)과 같다 — 종가 기준 응답 2종 모두", () => {
    const now = at("2026-11-10T10:00:00");
    for (const basis of ["sameBusinessDay", "kstAccessDay"] as const) {
      const refData = serverDaily(["005930"], basis);
      const st = [kr({ currentPrice: 51234 })];
      const main = computeDailyStockProfit(st, refData, RATES, { useLivePrice: true }).dailyProfitRate!;
      expect(computeTodayChip(st, refData, RATES, now)!.rate).toBeCloseTo(main, 9);
    }
  });

  it("T5 미국 종목 = 달러 가격 등락률. 현재 환율·기기 환율 이력과 무관, AAPL·NVDA는 서로 다른 값", () => {
    const now = at("2026-11-10T10:00:00"); // 한국 낮 = 미국 장 종료 후
    const refData = serverDaily(["AAPL", "NVDA"]);
    const a1 = computeTodayChip([us("AAPL")], refData, RATES, now)!.rate;
    const n1 = computeTodayChip([us("NVDA")], refData, RATES, now)!.rate;
    expect(a1).toBeCloseTo((close("AAPL", "2026-11-09") / close("AAPL", "2026-11-06") - 1) * 100, 9);
    expect(a1).not.toBeCloseTo(n1, 3);
    // 환율 이력이 날짜마다 달라도(main 계산은 이 값에 흔들림) 칩은 그대로
    const hist = { "2026-11-06": { USD: 1300, JPY: 900 }, "2026-11-09": { USD: 1500, JPY: 900 } };
    const store = new Map<string, string>([[STORAGE_KEYS.exchangeHistory, JSON.stringify(hist)]]);
    vi.stubGlobal("window", {});
    vi.stubGlobal("localStorage", { getItem: (k: string) => store.get(k) ?? null, setItem: () => {} });
    expect(computeTodayChip([us("AAPL")], refData, { USD: 1000, JPY: 500 }, now)!.rate).toBeCloseTo(a1, 9);
  });

  it("T6 헤더 = 종목 칩 등락률의 원화 평가액(현재 환율) 가중, 하나라도 장중이면 `오늘` 아니면 `종가`", () => {
    // 화 10:00 — 국내 장중 + 미국 장 종료 후 → 헤더 `오늘`
    let now = at("2026-11-10T10:00:00");
    let refData = serverDaily(["005930", "AAPL", "NVDA"]);
    const k = kr({ currentPrice: close("005930", "2026-11-09") * 1.01 });
    const a = us("AAPL");
    const n = us("NVDA", { quantity: 5 });
    const w = (s: Stock, num: number, den: number) => {
      const fx = s.currency === "USD" ? RATES.USD : 1;
      return [s.quantity * num * fx, s.quantity * den * fx];
    };
    const parts = [
      w(k, k.currentPrice, close("005930", "2026-11-09")),
      w(a, close("AAPL", "2026-11-09"), close("AAPL", "2026-11-06")),
      w(n, close("NVDA", "2026-11-09"), close("NVDA", "2026-11-06")),
    ];
    const expected = (parts.reduce((s, p) => s + p[0], 0) / parts.reduce((s, p) => s + p[1], 0) - 1) * 100;
    const h = computeTodayChip([k, a, n], refData, RATES, now)!;
    expect(h.rate).toBeCloseTo(expected, 9);
    expect(todayChipLabel(h, "header")).toBe("오늘");
    // 칩 없는 종목(기준가 없음 = 응답 null)은 합산에서 빠진다. 응답 키가 아예 없으면(조회 중)은 U7 숨김 규칙 — today-chip-u7.test.ts
    const withMissing = computeTodayChip([k, a, n, us("AAPL", { ticker: "ZZZZ", id: "z" })], { ...refData, ZZZZ: null }, RATES, now)!;
    expect(withMissing.rate).toBeCloseTo(expected, 9);
    // 화 17:00 — 모두 장 종료 후(국내 11/10, 미국 11/9) → `종가`
    now = at("2026-11-10T17:00:00");
    refData = serverDaily(["005930", "AAPL"]);
    const h2 = computeTodayChip([kr(), a], refData, RATES, now)!;
    expect(todayChipLabel(h2, "header")).toBe("종가");
    expect(h2.closeDates).toEqual(["2026-11-09", "2026-11-10"]);
    // 같은 종목을 여러 증권사에 나눠 가져도 한 값(가중해도 같은 가격비)
    const split = computeTodayChip([a, { ...a, id: "a2", quantity: 7, broker: "다른 증권사" } as Stock], refData, RATES, now)!;
    expect(split.rate).toBeCloseTo(computeTodayChip([a], refData, RATES, now)!.rate, 9);
  });

  it("T7 국내: 칩 종가일 = 자산 변화 › 주식 › 일 끝 종가일이면 같은 %", () => {
    const now = at("2026-11-10T17:00:00");
    const refData = serverDaily(["005930"], "kstAccessDay");
    const st = [kr()];
    const chip = computeTodayChip(st, refData, RATES, now)!;
    expect(chip.closeDates).toEqual([refData["005930"]!.refDate]);
    expect(chip.rate).toBeCloseTo(computeDailyStockProfit(st, refData, RATES).dailyProfitRate!, 9);
  });

  it("단일 종목 시세 함수: 장 종료 후에는 현재가를 쓰지 않는다", () => {
    const now = at("2026-11-10T17:00:00");
    const refData = serverDaily(["005930"]);
    const q1 = getStockChipQuote(kr({ currentPrice: 1 }), refData, now)!;
    const q2 = getStockChipQuote(kr({ currentPrice: 999999 }), refData, now)!;
    expect(q1).toEqual(q2);
    expect(q1.live).toBe(false);
  });

  it("데모 종목(demo_st_)은 장중 칩을 숨기고 장 종료 후 종가 쌍 칩은 유지(#142)", () => {
    const live = at("2026-11-10T11:00:00");
    const rl = serverDaily(["005930"]);
    expect(getStockChipQuote(kr(), rl, live)).not.toBeNull();
    expect(getStockChipQuote(kr({ id: "demo_st_1" }), rl, live)).toBeNull();
    const after = at("2026-11-10T17:00:00");
    expect(getStockChipQuote(kr({ id: "demo_st_1" }), serverDaily(["005930"]), after)?.live).toBe(false);
  });
});
