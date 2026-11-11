// 4.84 C — 매도 점 순수 로직: 거래 추출(type 인자), 창 밖, 5년 주봉, 같은 봉 매수+매도 ±6px 벌림·히트 반경·Tab 순서
import { describe, expect, it } from "vitest";
import type { Transaction } from "@/types/transaction";
import { buildTradeMarkers, layoutMarkers, markerHitRadius, pickBuyTransactions, placeBuyDots } from "../stock-page";
import type { PricePoint } from "../price-history";

let seq = 0;
const tx = (o: Partial<Transaction>): Transaction => ({
  id: `t${++seq}`, stockId: "a", ticker: "005930", stockName: "삼성전자", type: "buy", quantity: 1, price: 1000,
  currency: "KRW", date: "2026-03-04", reflected: true, createdAt: "2026-03-04T00:00:00Z", ...o,
} as Transaction);
const DAILY: PricePoint[] = ["2026-03-02", "2026-03-03", "2026-03-04", "2026-03-05", "2026-03-06"].map((d, i) => ({ d, c: 100 + i }));

describe("pickBuyTransactions type 인자", () => {
  const list = [tx({ date: "2026-03-05", type: "sell" }), tx({ date: "2026-03-03" }), tx({ date: "2026-03-01", type: "sell" }), tx({ stockId: "z", type: "sell" })];
  it("기본(buy)은 기존과 같다, sell은 매도만·그룹 id 필터·날짜 오름차순", () => {
    expect(pickBuyTransactions(list, ["a"]).map((x) => x.date)).toEqual(["2026-03-03"]);
    expect(pickBuyTransactions(list, ["a"], "sell").map((x) => x.date)).toEqual(["2026-03-01", "2026-03-05"]);
  });
});

describe("매도 점 위치·창 밖", () => {
  it("창 안 매도는 점, 창 밖은 건수만(매수와 같은 규칙)", () => {
    const sells = pickBuyTransactions([tx({ type: "sell", date: "2026-03-04" }), tx({ type: "sell", date: "2024-01-01" })], ["a"], "sell");
    const r = placeBuyDots(DAILY, sells, "2025-11-11");
    expect(r.dots).toHaveLength(1);
    expect(r.dots[0].d).toBe("2026-03-04");
    expect(r.outsideCount).toBe(1);
  });
  it("휴일 매도 → 다음 영업일 봉, 5년 주봉은 그 주 봉", () => {
    const sells = pickBuyTransactions([tx({ type: "sell", date: "2026-03-07" })], ["a"], "sell"); // 토요일 → 마지막 봉
    expect(placeBuyDots(DAILY, sells, "2025-11-11").dots[0].d).toBe("2026-03-06");
    const weekly: PricePoint[] = [{ d: "2026-03-02", c: 1 }, { d: "2026-03-09", c: 2 }, { d: "2026-03-16", c: 3 }];
    expect(placeBuyDots(weekly, pickBuyTransactions([tx({ type: "sell", date: "2026-03-12" })], ["a"], "sell"), "2021-11-11", "W").dots[0].d).toBe("2026-03-09");
  });
});

describe("마커 합치기·배치", () => {
  const buys = placeBuyDots(DAILY, pickBuyTransactions([tx({ date: "2026-03-04" }), tx({ date: "2026-03-06" })], ["a"]), "2025-11-11").dots;
  const sells = placeBuyDots(DAILY, pickBuyTransactions([tx({ type: "sell", date: "2026-03-04" })], ["a"], "sell"), "2025-11-11").dots;
  it("날짜순, 같은 봉이면 매수→매도(Tab 순서), 키 `kind:index`", () => {
    const m = buildTradeMarkers(buys, sells);
    expect(m.map((x) => x.key)).toEqual(["buy:2", "sell:2", "buy:4"]);
  });
  it("같은 봉 매수+매도는 가로 ±6px로 벌리고(y 불변) 히트 반경 6, 멀리 있는 점은 10~20", () => {
    const xOf = (d: string) => 10 + (DAILY.findIndex((p) => p.d === d)) * 50;
    const pos = layoutMarkers(buildTradeMarkers(buys, sells), xOf, (c) => 200 - c);
    expect(pos[0].x).toBe(xOf("2026-03-04") - 6);
    expect(pos[1].x).toBe(xOf("2026-03-04") + 6);
    expect(pos[0].y).toBe(pos[1].y);
    expect(pos[0].spread && pos[1].spread).toBe(true);
    expect(markerHitRadius(pos, 0)).toBe(6);
    expect(markerHitRadius(pos, 2)).toBeGreaterThanOrEqual(10);
    expect(markerHitRadius(pos, 2)).toBeLessThanOrEqual(20);
  });
  it("12px 이상 떨어진 매수·매도는 벌리지 않는다", () => {
    const xOf = (d: string) => (d === "2026-03-04" ? 10 : 50);
    const pos = layoutMarkers(buildTradeMarkers(placeBuyDots(DAILY, pickBuyTransactions([tx({ date: "2026-03-06" })], ["a"]), "2025-11-11").dots, sells), xOf, () => 0);
    expect(pos.every((p) => !p.spread)).toBe(true);
  });
});
