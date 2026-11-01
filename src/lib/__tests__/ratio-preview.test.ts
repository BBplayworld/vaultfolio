import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { buildRatioList, largestRemainderTenths, stockValueKrw } from "@/lib/ratio-preview/ratio-list";
import { canOpenHandoff, HANDOFF_TTL_MS, peekHandoff, setHandoff, takeHandoff } from "@/lib/ratio-preview/handoff";
import type { ParsedStock } from "@/lib/asset/screenshot-stock-map";

const RATES = { USD: 1400, JPY: 900 };

function st(name: string, section: ParsedStock["section"], quantity: number, currentPrice: number, cur?: "KRW" | "USD" | "JPY"): ParsedStock {
  return { id: name, name, ticker: name, category: "domestic", quantity, averagePrice: currentPrice, currentPrice, section, originalCurrency: cur } as unknown as ParsedStock;
}

describe("largestRemainderTenths", () => {
  it("3종목 동일 비중은 333/333/334로 합 1000", () => {
    const t = largestRemainderTenths([1, 1, 1]);
    expect(t.reduce((a, b) => a + b, 0)).toBe(1000);
    expect([...t].sort()).toEqual([333, 333, 334]);
  });
  it("동률이면 원래 값이 큰 쪽이 받는다", () => {
    expect(largestRemainderTenths([3, 3, 4])).toEqual([300, 300, 400]);
    const t = largestRemainderTenths([5, 5, 5, 5, 5, 5, 5, 5, 5]);
    expect(t.reduce((a, b) => a + b, 0)).toBe(1000);
  });
  it("합 0이면 전부 0", () => {
    expect(largestRemainderTenths([0, 0])).toEqual([0, 0]);
  });
});

describe("stockValueKrw", () => {
  it("해외 USD ×환율, JPY ×(JPY/100), KRW·없음은 그대로, 국내는 그대로", () => {
    expect(stockValueKrw(st("a", "해외", 2, 10, "USD"), RATES)).toBe(2 * 10 * 1400);
    expect(stockValueKrw(st("a", "해외", 2, 1000, "JPY"), RATES)).toBe(2 * 1000 * 9);
    expect(stockValueKrw(st("a", "해외", 2, 10, "KRW"), RATES)).toBe(20);
    expect(stockValueKrw(st("a", "해외", 2, 10), RATES)).toBe(20);
    expect(stockValueKrw(st("a", "국내", 2, 10), RATES)).toBe(20);
  });
});

describe("buildRatioList", () => {
  it("3종목 균등: 표시 합 100.0", () => {
    const r = buildRatioList([st("a", "국내", 1, 100), st("b", "국내", 1, 100), st("c", "국내", 1, 100)], RATES);
    expect(r.rows.map((x) => x.pct).sort()).toEqual([33.3, 33.3, 33.4]);
    expect(r.rows.reduce((a, x) => a + x.pct, 0)).toBeCloseTo(100, 5);
  });
  it("8종목 이상: 상위 7 + 그 외, 합 100.0, 국내/해외 막대 합 100.0", () => {
    const raw = Array.from({ length: 12 }, (_, i) => st(`s${i}`, i % 3 === 0 ? "해외" : "국내", 1 + i, 1000 + i * 37, i % 3 === 0 ? "USD" : undefined));
    const r = buildRatioList(raw, RATES);
    expect(r.rows).toHaveLength(8);
    expect(r.rows[7]).toMatchObject({ isEtc: true, etcCount: 5, name: "그 외 5종목" });
    expect(r.rows.reduce((a, x) => a + x.pct * 10, 0)).toBe(1000);
    expect(r.split.reduce((a, x) => a + x.pct * 10, 0)).toBe(1000);
    expect(r.totalCount).toBe(12);
    expect(r.domesticCount + r.foreignCount + r.otherCount).toBe(12);
    const pcts = r.rows.slice(0, 7).map((x) => x.pct);
    expect([...pcts].sort((a, b) => b - a)).toEqual(pcts);
  });
  it("가격 0 종목은 비중에서 빼되 종목 수에는 포함", () => {
    const r = buildRatioList([st("a", "국내", 1, 100), st("z", "해외", 1, 0, "USD")], RATES);
    expect(r.zeroPriceCount).toBe(1);
    expect(r.totalCount).toBe(2);
    expect(r.foreignCount).toBe(1);
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0].pct).toBe(100);
    expect(r.split).toEqual([{ kind: "domestic", pct: 100, count: 1 }]);
  });
  it("전 종목 가격 0이면 allZero", () => {
    const r = buildRatioList([st("a", "국내", 1, 0)], RATES);
    expect(r.allZero).toBe(true);
    expect(r.rows).toEqual([]);
  });
  it("결과 객체에 금액 필드가 없다", () => {
    const r = buildRatioList([st("a", "국내", 3, 777)], RATES);
    expect(JSON.stringify(r)).not.toContain("2331");
    expect(Object.keys(r.rows[0]).sort()).toEqual(["isEtc", "key", "name", "pct", "ticker"]);
  });
  it("국내만·해외만은 단일 구간 100%", () => {
    expect(buildRatioList([st("a", "해외", 1, 1, "USD")], RATES).split).toEqual([{ kind: "foreign", pct: 100, count: 1 }]);
  });
});

describe("handoff", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    takeHandoff();
    vi.useRealTimers();
  });
  const raw = [st("a", "국내", 1, 1)];

  it("1회 소비", () => {
    setHandoff(raw);
    expect(peekHandoff()).toBe(raw);
    expect(takeHandoff()).toBe(raw);
    expect(takeHandoff()).toBeNull();
    expect(peekHandoff()).toBeNull();
  });
  it("10분 만료 시 참조가 실제로 지워진다", () => {
    setHandoff(raw);
    vi.advanceTimersByTime(HANDOFF_TTL_MS - 1);
    expect(peekHandoff()).toBe(raw);
    vi.advanceTimersByTime(2);
    expect(peekHandoff()).toBeNull();
  });
  it("재설정 시 타이머 교체", () => {
    setHandoff(raw);
    vi.advanceTimersByTime(HANDOFF_TTL_MS - 1000);
    const raw2 = [st("b", "국내", 1, 1)];
    setHandoff(raw2);
    vi.advanceTimersByTime(2000);
    expect(peekHandoff()).toBe(raw2);
  });
});

describe("canOpenHandoff", () => {
  const ok = { isDataLoaded: true, pwaLocked: false, isSharePending: false, wizardIsOpen: false, isTrialMode: false };
  it("모두 만족할 때만 연다", () => {
    expect(canOpenHandoff(ok)).toBe(true);
    expect(canOpenHandoff({ ...ok, isDataLoaded: false })).toBe(false);
    expect(canOpenHandoff({ ...ok, pwaLocked: true })).toBe(false);
    expect(canOpenHandoff({ ...ok, isSharePending: true })).toBe(false);
    expect(canOpenHandoff({ ...ok, wizardIsOpen: true })).toBe(false);
    expect(canOpenHandoff({ ...ok, isTrialMode: true })).toBe(false);
  });
});
