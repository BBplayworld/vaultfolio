// #309 복귀 재조회 사전 판정 — 칸이 같으면 아무것도 부르지 않는다
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Crypto, Stock } from "@/types/asset";
import { EMPTY_PRICE_ATTEMPTS, currentPriceSlots, hasResyncWork, planPriceResync, type PriceSlots } from "../price-freshness";

const stock = (p: Partial<Stock>): Stock => ({ id: p.ticker ?? "x", name: "n", ticker: "005930", category: "domestic", quantity: 1, averagePrice: 1, currentPrice: 1, currency: "KRW", ...p }) as Stock;
const coin = (p: Partial<Crypto>): Crypto => ({ id: "c", name: "비트코인", symbol: "BTC", quantity: 1, averagePrice: 1, currentPrice: 1, ...p }) as Crypto;

const slots: PriceSlots = { domestic: "2026-11-25-H14", foreign: "2026-11-25", coin: "2026-11-26-H14", today: "2026-11-26", exchangeEffective: "2026-11-26" };
const fresh = {
  stocks: [stock({ baseDate: slots.domestic }), stock({ ticker: "AAPL", category: "foreign", currency: "USD", baseDate: slots.foreign })],
  crypto: [coin({ baseDate: slots.coin })],
  exchangeSyncDate: "2026-11-26",
  slots,
  attempts: EMPTY_PRICE_ATTEMPTS,
};

afterEach(() => vi.useRealTimers());

describe("planPriceResync", () => {
  it("모든 칸이 같으면 할 일 0", () => {
    const plan = planPriceResync(fresh);
    expect(plan).toEqual({ exchange: false, stock: false, coin: false });
    expect(hasResyncWork(plan)).toBe(false);
  });

  it("국내 장중 정시가 지나면 주식만", () => {
    const plan = planPriceResync({ ...fresh, slots: { ...slots, domestic: "2026-11-25-H15" } });
    expect(plan).toEqual({ exchange: false, stock: true, coin: false });
  });

  it("해외 칸만 바뀌어도 주식", () => {
    expect(planPriceResync({ ...fresh, slots: { ...slots, foreign: "2026-11-26-H18" } }).stock).toBe(true);
  });

  it("코인 칸·환율 날짜", () => {
    expect(planPriceResync({ ...fresh, slots: { ...slots, coin: "2026-11-26-H15" } })).toEqual({ exchange: false, stock: false, coin: true });
    expect(planPriceResync({ ...fresh, exchangeSyncDate: "2026-11-25" }).exchange).toBe(true);
    expect(planPriceResync({ ...fresh, exchangeSyncDate: null }).exchange).toBe(true);
  });

  it("09시 전: 서버 환율 날짜(어제) = 유효 날짜면 최신으로 본다(복귀마다 재조회 금지)", () => {
    const early = { ...slots, exchangeEffective: "2026-11-25" };
    expect(planPriceResync({ ...fresh, slots: early, exchangeSyncDate: "2026-11-25" }).exchange).toBe(false);
  });

  it("같은 칸으로 이미 시도했으면 빠진 종목·서킷이 있어도 다시 부르지 않는다", () => {
    const input = { ...fresh, stocks: [stock({ baseDate: "2026-11-24" })], crypto: [coin({ baseDate: "old" })], exchangeSyncDate: "2026-11-24" };
    expect(planPriceResync(input)).toEqual({ exchange: true, stock: true, coin: true });
    const tried = { domestic: slots.domestic, foreign: slots.foreign, coin: slots.coin, exchange: slots.today };
    expect(planPriceResync({ ...input, attempts: tried })).toEqual({ exchange: false, stock: false, coin: false });
    // 다음 정시 칸이면 다시 시도
    expect(planPriceResync({ ...input, attempts: tried, slots: { ...slots, domestic: "2026-11-25-H15" } }).stock).toBe(true);
  });

  it("티커 없는 종목·심볼 없는 코인은 판정에서 뺀다, 빈 데이터는 0", () => {
    expect(hasResyncWork(planPriceResync({ ...fresh, stocks: [stock({ ticker: "", baseDate: undefined })], crypto: [coin({ symbol: "", baseDate: undefined })] }))).toBe(false);
    expect(hasResyncWork(planPriceResync({ ...fresh, stocks: [], crypto: [] }))).toBe(false);
  });

  it("baseDate 없는 종목(방금 추가)은 칸이 다르다", () => {
    expect(planPriceResync({ ...fresh, stocks: [stock({ baseDate: undefined })] }).stock).toBe(true);
  });

  it("currentPriceSlots = 각 캐시 칸 함수 결과", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-24T05:10:00Z")); // KST 11/24(화) 14:10
    const s = currentPriceSlots();
    expect(s.domestic).toBe("2026-11-23-H14");
    expect(s.coin).toBe("2026-11-24-H14");
    expect(s.today).toBe("2026-11-24");
    expect(s.exchangeEffective).toBe("2026-11-24");
  });
});
