// #319(5.160) 증권사별 합계 — 묶음 합 = computeStockTotals(헤더), 화면 문자열 합 = 헤더 문자열(C150)
import { describe, expect, it } from "vitest";
import type { Cash, Stock } from "@/types/asset";
import { apportionUnits, brokerCashByRow, computeBrokerTotals, UNASSIGNED_BROKER_LABEL } from "../broker-totals";
import { computeStockTotals } from "@/app/(main)/_components/views/detail/asset-detail-tabs";
import { formatBrokerUnits, formatShareTenths } from "@/app/(main)/_components/views/detail/tabs/broker-totals-block";
import { formatCurrency } from "@/lib/number-utils";

const RATES = { USD: 1387.3, JPY: 911 };
const st = (o: Partial<Stock>): Stock =>
  ({ id: "s", category: "domestic", name: "삼성전자", ticker: "005930", quantity: 10, averagePrice: 70000, currentPrice: 80001, currency: "KRW", purchaseDate: "2025-01-01", ...o }) as Stock;

const FIXTURE: Stock[] = [
  st({ id: "a1", broker: "키움증권", quantity: 7, currentPrice: 80333 }),
  st({ id: "a2", broker: "키움 증권", ticker: "000660", name: "SK하이닉스", quantity: 3, averagePrice: 150000, currentPrice: 190111 }),
  // 같은 종목이 다른 증권사에도 있음
  st({ id: "b1", broker: "미래에셋증권", quantity: 5, currentPrice: 80333 }),
  st({ id: "c1", broker: "토스증권", category: "foreign", ticker: "AAPL", name: "Apple", currency: "USD", quantity: 3.3, averagePrice: 180.55, currentPrice: 191.27, purchaseExchangeRate: 1301.7 } as Partial<Stock>),
  st({ id: "c2", broker: "토스증권", category: "foreign", ticker: "AAPL", name: "Apple", currency: "USD", quantity: 1.7, averagePrice: 170.1, currentPrice: 191.27, purchaseExchangeRate: 1290.3 } as Partial<Stock>),
  st({ id: "d1", broker: "연금저축", category: "pension", ticker: "360750", name: "TIGER", quantity: 13, averagePrice: 15111, currentPrice: 20333 }),
  st({ id: "u1", broker: "항목 1", ticker: "111111", name: "무소속", quantity: 2, currentPrice: 12345 }),
  st({ id: "u2", broker: undefined, category: "unlisted", ticker: "", name: "비상장", quantity: 10, averagePrice: 5000, currentPrice: 5001 }),
  st({ id: "x1", broker: "토스증권", ticker: "999990", name: "폐지전자", quantity: 3, currentPrice: 0, inactiveStatus: "delisted" } as Partial<Stock>),
  st({ id: "z1", broker: "한국투자증권", ticker: "222222", name: "수량0", quantity: 0 }),
];

const num = (s: string) => Number(s.replace(/[^0-9.-]/g, ""));

describe("computeBrokerTotals", () => {
  it("묶음: sameBroker로 합치고 미지정은 한 묶음·맨 아래, 폐지·수량 0만 가진 증권사는 행 없음", () => {
    const { rows } = computeBrokerTotals(FIXTURE, RATES);
    const names = rows.map((r) => r.name);
    expect(names).toHaveLength(5);
    expect(names.at(-1)).toBe(UNASSIGNED_BROKER_LABEL);
    expect(rows.at(-1)!.unassigned).toBe(true);
    expect(rows.at(-1)!.count).toBe(2);
    expect(names.filter((n) => n.includes("키움"))).toHaveLength(1);
    expect(names).toContain("연금저축");
    expect(names).not.toContain("한국투자증권");
    // 평가금 내림차순(미지정 제외)
    const vals = rows.filter((r) => !r.unassigned).map((r) => r.valueUnits);
    expect(vals).toEqual([...vals].sort((a, b) => b - a));
  });

  it("같은 종목이 여러 증권사에 있으면 각 증권사에 1종목씩, 같은 증권사 분할 행은 1종목", () => {
    const { rows } = computeBrokerTotals(FIXTURE, RATES);
    expect(rows.find((r) => r.name.includes("키움"))!.count).toBe(2);
    expect(rows.find((r) => r.name.includes("미래에셋"))!.count).toBe(1);
    expect(rows.find((r) => r.name.includes("토스"))!.count).toBe(1);
  });

  it("평가금·손익 합 = 헤더(원 단위), 문자열 합 = 헤더 문자열, 비중 합 100.0%", () => {
    const { rows, scale } = computeBrokerTotals(FIXTURE, RATES);
    const t = computeStockTotals(FIXTURE, RATES);
    expect(rows.reduce((a, r) => a + r.valueUnits, 0)).toBe(Math.round(t.totalValue));
    expect(rows.reduce((a, r) => a + r.profitUnits, 0)).toBe(Math.round(t.totalProfit));
    expect(rows.reduce((a, r) => a + num(formatBrokerUnits(r.valueUnits, scale)), 0)).toBe(num(formatCurrency(t.totalValue)));
    expect(rows.reduce((a, r) => a + r.shareTenths, 0)).toBe(1000);
    expect(formatShareTenths(rows.reduce((a, r) => a + r.shareTenths, 0))).toBe("100.0%");
  });

  it("해외 달러 보기: 센트 단위로 헤더 표기($)와 같다", () => {
    const foreign = [
      st({ id: "f1", broker: "토스증권", category: "foreign", ticker: "AAPL", currency: "USD", quantity: 3.3, averagePrice: 180.55, currentPrice: 191.27, purchaseExchangeRate: 1300 } as Partial<Stock>),
      st({ id: "f2", broker: "키움증권", category: "foreign", ticker: "MSFT", currency: "USD", quantity: 1.1, averagePrice: 400.12, currentPrice: 411.33, purchaseExchangeRate: 1300 } as Partial<Stock>),
      st({ id: "f3", broker: "미래에셋증권", category: "foreign", ticker: "NVDA", currency: "USD", quantity: 2.7, averagePrice: 120.1, currentPrice: 140.77, purchaseExchangeRate: 1300 } as Partial<Stock>),
    ];
    const { rows, scale } = computeBrokerTotals(foreign, RATES, "USD");
    expect(scale).toBe(100);
    const t = computeStockTotals(foreign, RATES, "USD");
    const headerValue = `$${(t.totalValue / RATES.USD).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    expect(formatBrokerUnits(rows.reduce((a, r) => a + r.valueUnits, 0), scale)).toBe(headerValue);
    const profitUnits = rows.reduce((a, r) => a + r.profitUnits, 0);
    expect(profitUnits).toBe(Math.round((Math.round(t.totalProfit) / RATES.USD) * 100));
  });

  it("수익률: 원가 0이면 null", () => {
    const { rows } = computeBrokerTotals([st({ id: "p", broker: "가나다", averagePrice: 0 }), st({ id: "q", broker: "라마바" })], RATES);
    expect(rows.find((r) => r.name === "가나다")!.profitRate).toBeNull();
    expect(rows.find((r) => r.name === "라마바")!.profitRate).not.toBeNull();
  });

  it("빈 목록·한 묶음", () => {
    expect(computeBrokerTotals([], RATES).rows).toEqual([]);
    expect(computeBrokerTotals([st({ id: "o", broker: "키움증권" })], RATES).rows).toHaveLength(1);
  });

  it("카테고리별로도 합이 같다", () => {
    for (const cat of ["domestic", "foreign", "irp", "isa", "pension", "unlisted"] as const) {
      const rowsIn = FIXTURE.filter((s) => s.category === cat);
      const { rows } = computeBrokerTotals(rowsIn, RATES);
      const t = computeStockTotals(rowsIn, RATES);
      expect(rows.reduce((a, r) => a + r.valueUnits, 0)).toBe(Math.round(t.totalValue));
      expect(rows.reduce((a, r) => a + r.profitUnits, 0)).toBe(Math.round(t.totalProfit));
    }
  });
});

describe("apportionUnits", () => {
  it("합이 target이 되고 음수도 다룬다", () => {
    expect(apportionUnits([1.4, 1.4, 1.4], 4).reduce((a, b) => a + b, 0)).toBe(4);
    expect(apportionUnits([-1.6, -1.6, 0.3], -3).reduce((a, b) => a + b, 0)).toBe(-3);
    expect(apportionUnits([], 0)).toEqual([]);
  });
});

// #335(5.167) 증권사별 행 현금 — 정확 일치만·'기타' 제외·외화 환산·0원 숨김, 헤더·행·비중 불변(C150·C156)
describe("brokerCashByRow", () => {
  const cash = (id: string, institution: string | undefined, balance: number, currency: "KRW" | "USD" | "JPY" = "KRW") =>
    ({ id, name: id, type: "cma", balance, currency, institution }) as Cash;
  const STOCKS: Stock[] = [
    st({ id: "k", broker: "키움증권", quantity: 7, currentPrice: 80333 }),
    st({ id: "m", broker: "미래에셋증권", ticker: "000660", quantity: 3, currentPrice: 190111 }),
    st({ id: "h", broker: "하나증권", ticker: "035420", quantity: 2, currentPrice: 210000 }),
    st({ id: "e", broker: "이베스트투자증권", ticker: "035720", quantity: 4, currentPrice: 41000 }),
    st({ id: "i", broker: "ISA", ticker: "360750", quantity: 5, currentPrice: 20333 }),
    st({ id: "g", broker: "기타", ticker: "111111", quantity: 1, currentPrice: 10000 }),
    st({ id: "u", broker: "", ticker: "222222", quantity: 1, currentPrice: 9000 }),
  ];
  const CASH: Cash[] = [
    cash("c1", "키움증권", 1_000_000),
    cash("c2", " 키움 증권 ", 234_567), // 공백 제거 후 정확 일치 → 합침
    cash("c3", "키움", 999_999), // 부분 일치 → 안 붙음
    cash("c4", "하나은행", 5_000_000), // 은행 ≠ 하나증권
    cash("c5", "하나", 777_777), // 부분 일치 → 안 붙음
    cash("c6", "기타", 3_333_333), // '기타' 행·현금 둘 다 제외
    cash("c7", "ISA", 4_444_444), // 자유 텍스트 행
    cash("c8", undefined, 1_111_111), // 기관 미지정
    cash("c9", "미래에셋증권", 100.55, "USD"), // 외화 → 현재 환율 원화 환산
    cash("c10", "미래에셋증권", 10_000, "JPY"),
    cash("c11", "토스증권", 50_000), // 주식 행이 없는 증권사 → 행 없음
    cash("c12", "이베스트투자증권", 0.4), // 반올림 0원 → 숨김
  ];

  it("정확 일치 증권사 행에만 원화 합, 나머지는 Map에 없음", () => {
    const { rows } = computeBrokerTotals(STOCKS, RATES);
    const m = brokerCashByRow(rows, CASH, RATES);
    expect(Object.fromEntries(m)).toEqual({
      키움증권: 1_234_567,
      미래에셋증권: Math.round(100.55 * RATES.USD + 10_000 * (RATES.JPY / 100)),
    });
    expect(m.has("하나증권")).toBe(false);
    expect(m.has("ISA")).toBe(false);
    expect(m.has("기타")).toBe(false);
    expect(m.has(UNASSIGNED_BROKER_LABEL)).toBe(false);
    expect(m.has("이베스트투자증권")).toBe(false);
    expect(m.has("토스증권")).toBe(false);
  });

  it("현금 0건·빈 행이면 빈 Map", () => {
    expect(brokerCashByRow(computeBrokerTotals(STOCKS, RATES).rows, [], RATES).size).toBe(0);
    expect(brokerCashByRow([], CASH, RATES).size).toBe(0);
  });

  it("현금은 행 평가금·손익·비중·헤더 합에 더하지 않는다(computeBrokerTotals 입력에 현금 없음)", () => {
    const before = computeBrokerTotals(STOCKS, RATES);
    brokerCashByRow(before.rows, CASH, RATES);
    const after = computeBrokerTotals(STOCKS, RATES);
    expect(after).toEqual(before);
    const t = computeStockTotals(STOCKS.filter((s) => s.quantity > 0), RATES);
    expect(after.rows.reduce((a, r) => a + r.valueUnits, 0)).toBe(num(formatCurrency(t.totalValue)));
    expect(after.rows.reduce((a, r) => a + r.shareTenths, 0)).toBe(1000);
  });
});
