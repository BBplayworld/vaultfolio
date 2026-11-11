// #157 종목 한 장 — 머리 값 = 행 값(C65), 매수 점 위치·창 밖(C76 ①~④), 평단선 범위, purchaseDate 점 금지(C74)
import { describe, expect, it } from "vitest";
import type { Stock } from "@/types/asset";
import type { Transaction } from "@/types/transaction";
import {
  computeStockMetrics,
  formatByDisplayCurrency,
  mergeStockGroup,
} from "@/app/(main)/_components/views/detail/asset-detail-tabs";
import {
  buildStockGroupHead,
  computePriceChange,
  computeYDomain,
  groupStocksByRowTicker,
  hasPriceFlow,
  pickBuyTransactions,
  placeBuyDots,
} from "../stock-page";
import type { PricePoint } from "../price-history";

const RATES = { USD: 1400, JPY: 900 };
let seq = 0;
const stock = (o: Partial<Stock>): Stock => ({
  id: `s${++seq}`, category: "domestic", name: "삼성전자", ticker: "005930", quantity: 10,
  averagePrice: 70000, currentPrice: 80000, currency: "KRW", purchaseDate: "2026-01-01", ...o,
} as Stock);
const tx = (o: Partial<Transaction>): Transaction => ({
  id: `t${++seq}`, stockId: "s1", ticker: "005930", stockName: "삼성전자", type: "buy", quantity: 1, price: 1000,
  currency: "KRW", date: "2026-03-02", reflected: true, createdAt: "2026-03-02T00:00:00Z", ...o,
} as Transaction);

describe("머리 값 = 행 값 (C65)", () => {
  const a = stock({ id: "a", broker: "A증권", quantity: 10, averagePrice: 70000, currentPrice: 80000 });
  const b = stock({ id: "b", broker: "B증권", quantity: 30, averagePrice: 90000, currentPrice: 80000 });
  const fa = stock({ id: "fa", category: "foreign", ticker: "AAPL", currency: "USD", quantity: 3.5, averagePrice: 150.5, currentPrice: 200.25, purchaseExchangeRate: 1300 });
  const fb = stock({ id: "fb", category: "foreign", ticker: "AAPL", currency: "USD", quantity: 2, averagePrice: 180, currentPrice: 200.25, purchaseExchangeRate: 1350 });

  // 상세·주식 행이 하는 계산 그대로(StockCard 행: mergeStockGroup + computeStockMetrics(비중은 무관))
  const rowValues = (items: Stock[], cur: "KRW" | "USD") => {
    const merged = mergeStockGroup(items);
    const m = computeStockMetrics(merged, RATES, 123456, cur);
    return { m, merged };
  };

  it.each([
    ["전체 탭(2계좌 합산) KRW", [a, b], "KRW"],
    ["계좌 필터 탭(1계좌) KRW", [a], "KRW"],
    ["전체 탭 해외 USD 토글", [fa, fb], "USD"],
    ["전체 탭 해외 KRW", [fa, fb], "KRW"],
    ["계좌 필터 해외 소수수량 USD", [fa], "USD"],
  ] as const)("%s: 평가·손익·%·수량·평단이 행과 같다", (_n, items, cur) => {
    const head = buildStockGroupHead([...items], RATES, cur);
    const { m, merged } = rowValues([...items], cur);
    expect(head.currentVal).toBe(m.currentVal);
    expect(head.profit).toBe(m.profit);
    expect(head.profitRate).toBe(m.profitRate);
    expect(head.quantity).toBe(merged.quantity);
    expect(head.averagePrice).toBe(merged.averagePrice);
    const fmt = (v: number) => formatByDisplayCurrency(v, cur, RATES.USD);
    expect(head.valueText).toBe(fmt(m.currentVal));
    const sign = m.profit >= 0 && Math.round(m.profit) !== 0 ? "+" : "";
    expect(head.profitText).toBe(`${sign}${fmt(Math.round(m.profit))}`);
    expect(head.rateText).toBe(`(${sign}${m.profitRate.toFixed(1)}%)`);
  });

  it("합산 평단선 값 = 펼침 평단(mergeStockGroup 가중 평단)", () => {
    const head = buildStockGroupHead([a, b], RATES, "KRW");
    expect(head.averagePrice).toBe((70000 * 10 + 90000 * 30) / 40);
  });

  it("손익 0이면 부호 없이 0", () => {
    const flat = stock({ averagePrice: 80000, currentPrice: 80000 });
    const head = buildStockGroupHead([flat], RATES, "KRW");
    expect(head.profitText.startsWith("+")).toBe(false);
    expect(head.rateText).toBe("(0.0%)");
  });
});

describe("hasPriceFlow / 시장 비교 그룹", () => {
  it("비상장·티커 없음·상장폐지는 가격 흐름 없음", () => {
    expect(hasPriceFlow({ ticker: "005930", category: "domestic" })).toBe(true);
    expect(hasPriceFlow({ ticker: "", category: "domestic" })).toBe(false);
    expect(hasPriceFlow({ ticker: undefined as unknown as string, category: "domestic" })).toBe(false);
    expect(hasPriceFlow({ ticker: "X", category: "unlisted" })).toBe(false);
    expect(hasPriceFlow({ ticker: "005930", category: "domestic", inactiveStatus: "delisted" })).toBe(false);
    expect(hasPriceFlow({ ticker: "005930", category: "domestic", inactiveStatus: "halted" })).toBe(true);
  });
  it("시장 비교 줄(티커) → 같은 티커 전체(계좌 구분 없이)", () => {
    const x1 = stock({ ticker: "005930" });
    const x2 = stock({ ticker: "005930", broker: "B" });
    const y = stock({ ticker: "000660" });
    expect(groupStocksByRowTicker([x1, x2, y], "005930").map((s) => s.id)).toEqual([x1.id, x2.id]);
    expect(groupStocksByRowTicker([x1, y], "NOPE")).toEqual([]);
  });
});

// 일봉 가짜 시계열: 2026-03-02(월)부터 영업일 5개, 종가 100,000 대
const DAILY: PricePoint[] = [
  { d: "2026-03-02", c: 100000 },
  { d: "2026-03-03", c: 101000 },
  { d: "2026-03-04", c: 99000 },
  { d: "2026-03-05", c: 102000 },
  { d: "2026-03-06", c: 103000 },
];
const buy = (date: string, quantity = 1, price = 1000, id = `b${++seq}`) => ({ id, date, quantity, price, currency: "KRW" });

describe("pickBuyTransactions (C74: 거래 기록만)", () => {
  it("그룹의 buy만, 매도·다른 종목 제외, 날짜 오름차순", () => {
    const list = [
      tx({ id: "1", stockId: "a", date: "2026-03-05" }),
      tx({ id: "2", stockId: "a", type: "sell", date: "2026-03-03" }),
      tx({ id: "3", stockId: "z", date: "2026-03-01" }),
      tx({ id: "4", stockId: "b", date: "2026-03-02" }),
    ];
    expect(pickBuyTransactions(list, ["a", "b"]).map((x) => x.id)).toEqual(["4", "1"]);
  });
  it("거래 기록 0이면 purchaseDate가 있어도 점 0 — 소비처는 purchaseDate를 읽지 않는다", () => {
    const withDate = stock({ id: "p", purchaseDate: "2026-03-03" });
    const buys = pickBuyTransactions([], [withDate.id]);
    expect(placeBuyDots(DAILY, buys, "2025-11-11")).toEqual({ dots: [], outsideCount: 0 });
  });
});

describe("placeBuyDots (C76 ① 거래 0 · ② 두 계좌 · ③ 창 밖 · ④ 분할 전)", () => {
  it("① 거래 0 → 점 0, 창 밖 0", () => {
    expect(placeBuyDots(DAILY, [], "2025-11-11")).toEqual({ dots: [], outsideCount: 0 });
  });

  it("② 두 계좌 거래 모두 점으로, 같은 봉 거래는 점 1개로 묶인다", () => {
    const { dots } = placeBuyDots(DAILY, [buy("2026-03-03", 5, 1, "x"), buy("2026-03-03", 2, 1, "y"), buy("2026-03-05", 1, 1, "z")], "2025-11-11");
    expect(dots.map((d) => [d.d, d.buys.map((b) => b.id)])).toEqual([["2026-03-03", ["x", "y"]], ["2026-03-05", ["z"]]]);
  });

  it("휴일(주말) 매수는 다음 영업일 봉, 마지막 봉 뒤 매수는 마지막 봉", () => {
    const { dots } = placeBuyDots(DAILY, [buy("2026-02-28"), buy("2026-03-10")], "2025-11-11");
    expect(dots.map((d) => d.d)).toEqual(["2026-03-02", "2026-03-06"]);
  });

  it("D2 주봉: 봉 날짜가 그 주 첫 거래일 — 수요일·금요일 매수도 그 주 봉, 다음 주 봉이 아니다", () => {
    const weekly: PricePoint[] = [{ d: "2026-03-02", c: 1 }, { d: "2026-03-09", c: 2 }, { d: "2026-03-16", c: 3 }];
    const { dots } = placeBuyDots(weekly, [buy("2026-03-04"), buy("2026-03-13"), buy("2026-03-09"), buy("2026-03-20")], "2021-11-11", "W");
    expect(dots.map((d) => [d.d, d.buys.length])).toEqual([["2026-03-02", 1], ["2026-03-09", 2], ["2026-03-16", 1]]);
  });

  it("일봉은 불변(매수일 이상 첫 봉)", () => {
    expect(placeBuyDots(DAILY, [buy("2026-03-04")], "2025-11-11", "D").dots[0].d).toBe("2026-03-04");
  });

  it("③ 창 시작 전 매수는 점 없이 건수만, 5년(더 이른 창)에서는 점으로", () => {
    const buys = [buy("2025-01-05"), buy("2025-12-01"), buy("2026-03-04")];
    const y1 = placeBuyDots(DAILY, buys, "2025-11-11");
    expect(y1.outsideCount).toBe(1);
    expect(y1.dots).toHaveLength(2);
    const y5 = placeBuyDots(DAILY, buys, "2021-11-11");
    expect(y5.outsideCount).toBe(0);
    // 창 안이 된 이른 매수 둘은 첫 봉에 한 점으로 묶인다
    expect(y5.dots.map((d) => d.buys.length)).toEqual([2, 1]);
  });

  it("④ 분할 전 매수: 점 y = 그 봉 종가(수정 차트 위), 거래 단가를 바꿔도 y는 불변·단가는 원값 그대로", () => {
    const a = placeBuyDots(DAILY, [buy("2026-03-04", 1, 1_000_000, "o")], "2025-11-11");
    const b = placeBuyDots(DAILY, [buy("2026-03-04", 1, 5, "o")], "2025-11-11");
    expect(a.dots[0].c).toBe(99000);
    expect(b.dots[0].c).toBe(99000);
    expect(a.dots[0].buys[0].price).toBe(1_000_000);
  });
});

describe("computeYDomain 평단선 범위", () => {
  it("평단이 값 범위 안이면 도메인은 값 범위 + 8% 여백, clamped none", () => {
    const r = computeYDomain(100, 200, 150);
    expect(r.clamped).toBe("none");
    expect(r.domain[0]).toBeCloseTo(92);
    expect(r.domain[1]).toBeCloseTo(208);
  });
  it("범위 밖이지만 40% 이내면 도메인을 평단까지 넓힌다", () => {
    const r = computeYDomain(100, 200, 230);
    expect(r.clamped).toBe("none");
    expect(r.domain[1]).toBeGreaterThan(230);
  });
  it("40%를 넘으면 도메인은 유지하고 위/아래 고정", () => {
    const up = computeYDomain(100, 200, 400);
    expect(up.clamped).toBe("up");
    expect(up.domain[1]).toBeLessThan(220);
    expect(computeYDomain(100, 200, 10).clamped).toBe("down");
  });
  it("평단 0(미입력)이면 선 없음(none)·도메인은 값 범위", () => {
    const r = computeYDomain(100, 200, 0);
    expect(r.clamped).toBe("none");
    expect(r.domain[0]).toBeCloseTo(92);
  });
  it("값이 평평해도 도메인이 퇴화하지 않는다", () => {
    const r = computeYDomain(100, 100, 100);
    expect(r.domain[1]).toBeGreaterThan(r.domain[0]);
  });
});

describe("computePriceChange", () => {
  it("첫 점 대비 마지막 점 %, 점 2개 미만이면 null", () => {
    expect(computePriceChange(DAILY)).toBeCloseTo(3);
    expect(computePriceChange([DAILY[0]])).toBeNull();
    expect(computePriceChange([])).toBeNull();
  });
});
