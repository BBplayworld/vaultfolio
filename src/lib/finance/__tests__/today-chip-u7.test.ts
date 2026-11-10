// #132 U7 '오늘' 칩 휴장 구간 보강(chipPair)·헤더 시장 단위 숨김(cto 판정 2 ②③)
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ProfitRefResponse } from "@/app/api/finance/profit/route";
import type { Stock } from "@/types/asset";
import { computeTodayChip, getTodayChipSession, todayChipLabel } from "../today-chip";
import * as mainChip from "./fixtures/today-chip-main";

const RATES = { USD: 1400, JPY: 900 };
const kr = (o: Partial<Stock> = {}): Stock =>
  ({ id: "kr", ticker: "005930", category: "domestic", name: "삼성전자", quantity: 10, averagePrice: 1, currentPrice: 70000, currency: "KRW", purchaseDate: "2026-01-01", ...o }) as Stock;
const us = (ticker: string, o: Partial<Stock> = {}): Stock =>
  ({ id: ticker, ticker, category: "foreign", name: ticker, quantity: 3, averagePrice: 1, currentPrice: 200, currency: "USD", purchaseDate: "2026-01-01", ...o }) as Stock;
const at = (kst: string) => new Date(`${kst}+09:00`);
afterEach(() => { vi.useRealTimers(); });

describe("U7 클라이언트 — chipPair는 장 종료 후 세션 쌍과 같을 때만", () => {
  // 한글날(10/9 금) 17:00 — 서버 일별은 명목 휴장일 10/9(종가 = 10/8 폴백), 칩 세션은 10/8 종가(10/7→10/8)
  const now = at("2026-10-09T17:00:00");
  const oldCache: ProfitRefResponse = { "005930": { refPrice: 70000, refDate: "2026-10-09", prevPrice: 70000, prevDate: "2026-10-08" } };
  const newCache: ProfitRefResponse = { "005930": { ...oldCache["005930"]!, chipPair: { closeDate: "2026-10-08", closePrice: 70000, baseDate: "2026-10-07", basePrice: 68600 } } };

  it("세션 확인: 10/9 17:00 국내 closed, 10/7→10/8", () => {
    expect(getTodayChipSession("domestic", now)).toEqual({ phase: "closed", tradeDate: "2026-10-08", baseDate: "2026-10-07" });
  });

  it("ⓐ 구 캐시(필드 없음) → 새 코드 = 숨김(지금과 같음)", () => {
    expect(computeTodayChip([kr()], oldCache, RATES, now)).toBeNull();
  });

  it("새 응답 → 10/8 종가 칩 = 70000/68600 − 1", () => {
    const chip = computeTodayChip([kr()], newCache, RATES, now)!;
    expect(chip.rate).toBeCloseTo((70000 / 68600 - 1) * 100, 9);
    expect(todayChipLabel(chip, "row")).toBe("10/8 종가");
  });

  it("세션 경계를 넘은 응답(쌍이 다름)은 쓰지 않는다 — 서버 시각·CDN·로컬 캐시", () => {
    const stale: ProfitRefResponse = { "005930": { ...oldCache["005930"]!, chipPair: { closeDate: "2026-10-07", closePrice: 68600, baseDate: "2026-10-06", basePrice: 68000 } } };
    expect(computeTodayChip([kr()], stale, RATES, now)).toBeNull();
    const zero: ProfitRefResponse = { "005930": { ...oldCache["005930"]!, chipPair: { closeDate: "2026-10-08", closePrice: 70000, baseDate: "2026-10-07", basePrice: 0 } } };
    expect(computeTodayChip([kr()], zero, RATES, now)).toBeNull();
  });

  it("장중·마감 직후 분기는 chipPair가 있어도 값이 같다(diff 0)", () => {
    const live = at("2026-11-10T10:00:00");
    const base: ProfitRefResponse = { "005930": { refPrice: 69000, refDate: "2026-11-09", prevPrice: 68000, prevDate: "2026-11-06" } };
    const withPair: ProfitRefResponse = { "005930": { ...base["005930"]!, chipPair: { closeDate: "2026-11-09", closePrice: 1, baseDate: "2026-11-06", basePrice: 2 } } };
    for (const t of [live, at("2026-11-10T15:45:00")]) {
      expect(computeTodayChip([kr()], withPair, RATES, t)).toEqual(computeTodayChip([kr()], base, RATES, t));
    }
  });

  it("미국 KST 일 06:00(서버 일별이 목/수) → chipPair 금/목으로 11/13 종가", () => {
    const sun = at("2026-11-15T06:00:00");
    expect(getTodayChipSession("foreign", sun)).toMatchObject({ phase: "closed", tradeDate: "2026-11-13", baseDate: "2026-11-12" });
    const r: ProfitRefResponse = { AAPL: { refPrice: 210, refDate: "2026-11-12", prevPrice: 205, prevDate: "2026-11-11", chipPair: { closeDate: "2026-11-13", closePrice: 220, baseDate: "2026-11-12", basePrice: 210 } } };
    const chip = computeTodayChip([us("AAPL")], r, RATES, sun)!;
    expect(chip.rate).toBeCloseTo((220 / 210 - 1) * 100, 9);
    expect(todayChipLabel(chip, "row")).toBe("11/13 종가");
  });

  it("ⓑ 새 캐시(chipPair 포함) → 롤백 코드(main 962830d) = 필드 무시·오류 0, 지금과 같은 값", () => {
    expect(() => mainChip.computeTodayChip([kr()], newCache, RATES, now)).not.toThrow();
    expect(mainChip.computeTodayChip([kr()], newCache, RATES, now)).toEqual(mainChip.computeTodayChip([kr()], oldCache, RATES, now));
    const t = at("2026-11-10T17:00:00");
    const r: ProfitRefResponse = { "005930": { refPrice: 70000, refDate: "2026-11-10", prevPrice: 69000, prevDate: "2026-11-09", chipPair: { closeDate: "2026-11-10", closePrice: 1, baseDate: "2026-11-09", basePrice: 1 } } };
    expect(mainChip.computeTodayChip([kr()], r, RATES, t)!.rate).toBeCloseTo((70000 / 69000 - 1) * 100, 9);
  });
});

describe("U7 헤더 칩 숨김 구간 표(main 열 포함, C70)", () => {
  it("ⓐ 미국 마감 직후 1h·국내+미국 보유: main 국내만 값 → 새 코드 숨김", () => {
    const t = at("2026-11-11T06:30:00"); // EST 16:30 = 마감 직후(미확인 → 미국 칩 숨김), 국내 장 전 = 11/10 종가
    expect(getTodayChipSession("foreign", t).phase).toBe("afterCloseGap");
    const r: ProfitRefResponse = {
      "005930": { refPrice: 70000, refDate: "2026-11-10", prevPrice: 69000, prevDate: "2026-11-09" },
      AAPL: { refPrice: 200, refDate: "2026-11-09", prevPrice: 198, prevDate: "2026-11-06" },
    };
    const main = mainChip.computeTodayChip([kr(), us("AAPL")], r, RATES, t);
    expect(main!.rate).toBeCloseTo((70000 / 69000 - 1) * 100, 9); // 국내만의 값(오표시)
    expect(computeTodayChip([kr(), us("AAPL")], r, RATES, t)).toBeNull();
    // 종목 줄 칩(단일 종목)은 그대로
    expect(computeTodayChip([kr()], r, RATES, t)!.rate).toBeCloseTo(main!.rate, 9);
  });

  it("ⓑ 응답 일부 누락(429·조회 중): main 부분 합 → 새 코드 숨김", () => {
    const t = at("2026-11-10T17:00:00");
    const r: ProfitRefResponse = {
      "005930": { refPrice: 70000, refDate: "2026-11-10", prevPrice: 69000, prevDate: "2026-11-09" },
      AAPL: { refPrice: 200, refDate: "2026-11-09", prevPrice: 198, prevDate: "2026-11-06" },
    };
    const stocks = [kr(), us("AAPL"), kr({ id: "k2", ticker: "000660", currentPrice: 500000 })];
    expect(mainChip.computeTodayChip(stocks, r, RATES, t)).not.toBeNull();
    expect(computeTodayChip(stocks, r, RATES, t)).toBeNull();
    expect(computeTodayChip(stocks, { ...r, "000660": { refPrice: 500000, refDate: "2026-11-10", prevPrice: 490000, prevDate: "2026-11-09" } }, RATES, t)).not.toBeNull();
  });

  it("ⓒ 거래정지·일본·기준가 null 종목 섞임: main 표시 → 새 코드 표시(값 같음)", () => {
    const t = at("2026-11-10T17:00:00");
    const r: ProfitRefResponse = {
      "005930": { refPrice: 70000, refDate: "2026-11-10", prevPrice: 69000, prevDate: "2026-11-09" },
      AAPL: { refPrice: 200, refDate: "2026-11-09", prevPrice: 198, prevDate: "2026-11-06" },
      "035720": null, // 기준가 없음
      NEWCO: null, // 미국 기준가 없음
    };
    const stocks = [
      kr(), us("AAPL"),
      kr({ id: "halt", ticker: "123450", inactiveStatus: "halted" }), // 응답 키 없음이어도 대상 아님
      us("7203", { id: "jp", currency: "JPY" }), // 일본: 대상 아님
      kr({ id: "nul", ticker: "035720" }),
      us("NEWCO", { id: "nc" }),
    ];
    const main = mainChip.computeTodayChip(stocks, r, RATES, t);
    const now = computeTodayChip(stocks, r, RATES, t);
    expect(now).not.toBeNull();
    expect(now!.rate).toBeCloseTo(main!.rate, 9);
  });

  it("한 시장만 보유하면 그 시장 기준가가 모두 null일 때만 없음(지금과 같음)", () => {
    const t = at("2026-11-10T17:00:00");
    expect(computeTodayChip([kr()], { "005930": null }, RATES, t)).toBeNull();
  });
});

describe("U7 ⓒ 요청 URL 불변", () => {
  it("fetchProfitRef 요청은 tickers·period·basis 3개뿐(main과 같음) — chipPair는 응답에만", async () => {
    const { fetchProfitRef } = await import("../profit-utils");
    const urls: string[] = [];
    const store = new Map<string, string>();
    vi.stubGlobal("localStorage", { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => { store.set(k, v); } });
    vi.stubGlobal("fetch", async (u: string) => {
      urls.push(u);
      return new Response(JSON.stringify({ "005930": { refPrice: 1, refDate: "2026-10-09", prevPrice: 1, prevDate: "2026-10-08", chipPair: { closeDate: "2026-10-08", closePrice: 1, baseDate: "2026-10-07", basePrice: 1 } } }), { status: 200 });
    });
    const data = await fetchProfitRef("005930", "daily", { basis: "kstAccessDay", signal: new AbortController().signal });
    expect(urls).toEqual(["/api/finance/profit?tickers=005930&period=daily&basis=kstAccessDay"]);
    expect(data["005930"]!.chipPair).toBeDefined();
    vi.unstubAllGlobals();
  });
});
