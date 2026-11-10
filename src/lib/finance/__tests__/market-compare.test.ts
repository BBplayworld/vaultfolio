// #132 U3 시장과 비교 계산 — 분류(K1·조건 4), 기간별 등락·차이(C65), 기준일 일치(조건 5·F8), 조회 중(A8), 환율 무관(A5)
import { describe, expect, it } from "vitest";
import type { Stock } from "@/types/asset";
import type { ProfitRefResponse } from "@/app/api/finance/profit/route";
import type { MarketIndexResponse } from "@/app/api/finance/market-index/route";
import { computePeriodStockProfitTotal } from "../profit-utils";
import {
  classifyHoldings,
  compareTickers,
  computeIndexSpan,
  computeMarketCompare,
  computeNotComparedRows,
  computePeriodCell,
  formatCompareDiff,
  formatCompareRate,
  rateTenths,
  type PeriodRefs,
} from "../market-compare";

let seq = 0;
const stock = (o: Partial<Stock>): Stock => ({
  id: `s${++seq}`,
  category: "domestic",
  name: "종목",
  ticker: "005930",
  quantity: 10,
  averagePrice: 100,
  currentPrice: 100,
  currency: "KRW",
  purchaseDate: "2026-11-10",
  ...o,
} as Stock);

// 데모 F1 구성(?demo=1): 삼성전자·SK하이닉스·KODEX 200 / AAPL·NVDA / TIGER 미국S&P500
const PEERS = new Set(["005930", "000660", "069500"]);
const F1: Stock[] = [
  stock({ name: "삼성전자", ticker: "005930", quantity: 10 }),
  stock({ name: "SK하이닉스", ticker: "000660", quantity: 2 }),
  stock({ name: "KODEX 200", ticker: "069500", quantity: 5, category: "pension" }),
  stock({ name: "애플", ticker: "AAPL", category: "foreign", currency: "USD", quantity: 3 }),
  stock({ name: "엔비디아", ticker: "NVDA", category: "foreign", currency: "USD", quantity: 4 }),
  stock({ name: "TIGER 미국S&P500", ticker: "360750", category: "isa", quantity: 7 }),
];

// 화 20:00 KST, 종가 기준 sameBusinessDay 가정: 일별 11/6→11/9, 주간 시작 11/3, 월간 시작 국내 10/8·미국 10/9
const DAILY: ProfitRefResponse = {
  "005930": { refPrice: 102000, refDate: "2026-11-09", prevPrice: 100000, prevDate: "2026-11-06" },
  "000660": { refPrice: 495000, refDate: "2026-11-09", prevPrice: 500000, prevDate: "2026-11-06" },
  "069500": { refPrice: 82000, refDate: "2026-11-09", prevPrice: 80000, prevDate: "2026-11-06" },
  AAPL: { refPrice: 220, refDate: "2026-11-09", prevPrice: 200, prevDate: "2026-11-06" },
  NVDA: { refPrice: 190, refDate: "2026-11-09", prevPrice: 200, prevDate: "2026-11-06" },
  "360750": { refPrice: 21000, refDate: "2026-11-09", prevPrice: 20000, prevDate: "2026-11-06" },
};
const WEEKLY: ProfitRefResponse = {
  "005930": { refPrice: 96000, refDate: "2026-11-03" },
  "000660": { refPrice: 450000, refDate: "2026-11-03" },
  "069500": { refPrice: 80000, refDate: "2026-11-03" },
  AAPL: { refPrice: 210, refDate: "2026-11-03" },
  NVDA: { refPrice: 200, refDate: "2026-11-03" },
  "360750": { refPrice: 20500, refDate: "2026-11-03" },
};
const MONTHLY: ProfitRefResponse = {
  "005930": { refPrice: 120000, refDate: "2026-10-08" },
  "000660": { refPrice: 600000, refDate: "2026-10-08" },
  "069500": { refPrice: 100000, refDate: "2026-10-08" },
  AAPL: { refPrice: 200, refDate: "2026-10-09" },
  NVDA: { refPrice: 210, refDate: "2026-10-09" },
  "360750": { refPrice: 22000, refDate: "2026-10-09" },
};
const REFS: PeriodRefs = { daily: DAILY, weekly: WEEKLY, monthly: MONTHLY };

const IDX: PeriodRefs<MarketIndexResponse> = {
  daily: {
    KOSPI: { refPrice: 5018.85, refDate: "2026-11-09", prevPrice: 5059.69, prevDate: "2026-11-06" },
    SPX: { refPrice: 7549.94, refDate: "2026-11-09", prevPrice: 7376.86, prevDate: "2026-11-06" },
  },
  weekly: { KOSPI: { refPrice: 5648.79, refDate: "2026-11-03" }, SPX: { refPrice: 7568.92, refDate: "2026-11-03" } },
  monthly: { KOSPI: { refPrice: 6625.93, refDate: "2026-10-08" }, SPX: { refPrice: 7811.54, refDate: "2026-10-09" } },
};

describe("classifyHoldings — K1·조건 4", () => {
  it("F1: 국내 3(펜션의 KODEX 200 포함) · 미국 2 · 비교하지 않은 종목 1(TIGER 미국S&P500)", () => {
    const c = classifyHoldings(F1, PEERS);
    expect(c.kr.map((h) => h.ticker)).toEqual(["005930", "000660", "069500"]);
    expect(c.us.map((h) => h.ticker)).toEqual(["AAPL", "NVDA"]);
    expect(c.notCompared).toEqual([{ ticker: "360750", name: "TIGER 미국S&P500", reason: "krNonEquity" }]);
  });

  it("F4·F6: 파킹형 ETF·판별 실패 → 비교 안 함, 일본 → 비교 안 함, 비상장·티커 없음·상장폐지 → 제외", () => {
    const c = classifyHoldings([
      stock({ name: "KODEX CD금리액티브", ticker: "459580", category: "irp" }),
      stock({ name: "신규상장", ticker: "999990" }),
      stock({ name: "토요타", ticker: "7203", category: "foreign", currency: "JPY" }),
      stock({ name: "비상장", ticker: undefined, category: "unlisted" }),
      stock({ name: "티커없음", ticker: "", category: "isa" }),
      stock({ name: "폐지", ticker: "000660", inactiveStatus: "delisted" }),
      stock({ name: "삼성전자", ticker: "005930" }),
    ], PEERS);
    expect(c.kr.map((h) => h.ticker)).toEqual(["005930"]);
    expect(c.notCompared.map((n) => [n.ticker, n.reason])).toEqual([
      ["459580", "krNonEquity"], ["999990", "krNonEquity"], ["7203", "foreignNonUs"],
    ]);
    expect(c.unlisted.map((u) => u.name)).toEqual(["비상장", "티커없음"]);
    expect(c.delisted.map((d) => d.ticker)).toEqual(["000660"]);
  });

  it("같은 티커는 여러 계좌라도 1종목으로 병합(수량 합)", () => {
    const c = classifyHoldings([
      stock({ ticker: "005930", quantity: 3 }),
      stock({ ticker: "005930", quantity: 7, category: "isa" }),
    ], PEERS);
    expect(c.kr).toEqual([{ ticker: "005930", name: "종목", quantity: 10 }]);
  });

  it("조회 대상 티커에 비교하지 않은 종목도 들어간다(목록에 등락만 보임)", () => {
    expect(compareTickers(classifyHoldings(F1, PEERS))).toEqual(["005930", "000660", "069500", "AAPL", "NVDA", "360750"]);
  });
});

describe("computeMarketCompare — F1 두 블록 × 3기간", () => {
  const blocks = computeMarketCompare(classifyHoldings(F1, PEERS), REFS, IDX);

  it("가진 시장만, 국내 → 미국", () => {
    expect(blocks.map((b) => [b.market, b.count])).toEqual([["kr", 3], ["us", 2]]);
  });

  it("보유 종목 등락 = Σ(수량×끝) / Σ(수량×시작) − 1 (지금 수량 × 시작 종가 가중)", () => {
    const kr = blocks[0].periods.daily;
    const start = 10 * 100000 + 2 * 500000 + 5 * 80000;
    const end = 10 * 102000 + 2 * 495000 + 5 * 82000;
    expect(kr.state).toBe("ok");
    expect(kr.holdingsRate).toBeCloseTo((end / start - 1) * 100, 10);
    expect([kr.startDate, kr.endDate]).toEqual(["2026-11-06", "2026-11-09"]);
  });

  it("1주·1개월 끝 종가 = 일별 ref(기존 Hero와 같은 끝), 시작 = 그 기간 ref", () => {
    const us = blocks[1].periods.weekly;
    expect([us.startDate, us.endDate]).toEqual(["2026-11-03", "2026-11-09"]);
    expect(us.holdingsRate).toBeCloseTo(((3 * 220 + 4 * 190) / (3 * 210 + 4 * 200) - 1) * 100, 10);
    expect(blocks[0].periods.monthly.startDate).toBe("2026-10-08");
    expect(blocks[1].periods.monthly.startDate).toBe("2026-10-09");
  });

  it("차이 = 보이는 두 값(소수 1자리)의 차(C65)", () => {
    for (const b of blocks) {
      for (const p of ["daily", "weekly", "monthly"] as const) {
        const c = b.periods[p];
        expect(c.indexState).toBe("ok");
        const shown = (Number(formatCompareRate(c.holdingsRate!).replace("%", "")) - Number(formatCompareRate(c.indexRate!).replace("%", "")));
        expect(Number(formatCompareDiff(c.diffTenths!).replace("%p", ""))).toBeCloseTo(shown, 10);
      }
    }
  });

  it("목록: 등락률 높은 순, 시장 줄이 그 순서 안에 놓인다", () => {
    const rows = blocks[0].periods.weekly.rows;
    expect(rows.map((r) => r.name)).toEqual(["SK하이닉스", "삼성전자", "KODEX 200", "코스피"]);
    const usDaily = blocks[1].periods.daily.rows;
    expect(usDaily.map((r) => r.name)).toEqual(["애플", "S&P 500", "엔비디아"]);
  });
});

describe("기존 계산과 교차 검산(A14·A5)", () => {
  it("국내 주식형만: 새 함수 % = profit-chart 식(Σ수익/Σ기준값, computePeriodStockProfitTotal)", () => {
    const krOnly = F1.slice(0, 3);
    const cell = computePeriodCell("kr", "weekly", classifyHoldings(krOnly, PEERS).kr, REFS, IDX);
    const profit = computePeriodStockProfitTotal(krOnly, WEEKLY, DAILY, { USD: 1400, JPY: 900 })!;
    const refValue = krOnly.reduce((s, st) => s + WEEKLY[st.ticker!]!.refPrice * st.quantity, 0);
    expect(cell.holdingsRate).toBeCloseTo((profit / refValue) * 100, 10);
  });

  it("미국: 환율을 바꿔도 값이 같다(달러 가격, A5) — 기존 식도 같은 환율이면 환율이 약분된다", () => {
    const usOnly = F1.slice(3, 5);
    const cell = computePeriodCell("us", "monthly", classifyHoldings(usOnly, PEERS).us, REFS, IDX);
    for (const usd of [1000, 1500]) {
      const profit = computePeriodStockProfitTotal(usOnly, MONTHLY, DAILY, { USD: usd, JPY: 900 })!;
      const refValue = usOnly.reduce((s, st) => s + MONTHLY[st.ticker!]!.refPrice * st.quantity * usd, 0);
      expect(cell.holdingsRate).toBeCloseTo((profit / refValue) * 100, 10);
    }
  });
});

describe("상태 — 조회 중(A8)·지수 실패(A9)·기준일(A6·F8)", () => {
  const kr = classifyHoldings(F1, PEERS).kr;

  it("종목 키가 하나라도 없으면(조회 중·한도) loading, 숫자·제외 0", () => {
    const partial = { ...DAILY } as Record<string, unknown>;
    delete partial["000660"];
    const c = computePeriodCell("kr", "daily", kr, { ...REFS, daily: partial as ProfitRefResponse }, IDX);
    expect(c.state).toBe("loading");
    expect(c.holdingsRate).toBeNull();
    expect(c.excluded).toEqual([]);
  });

  it("지수 응답 대기면 loading", () => {
    expect(computePeriodCell("kr", "weekly", kr, REFS, { daily: IDX.daily }).state).toBe("loading");
  });

  it("null(기준가 없음)은 제외 N에 '기준가 없음'으로 세고 합산에서 뺀다", () => {
    const c = computePeriodCell("kr", "weekly", kr, { ...REFS, weekly: { ...WEEKLY, "000660": null } }, IDX);
    expect(c.state).toBe("ok");
    expect(c.excluded).toEqual([{ ticker: "000660", name: "SK하이닉스", reason: "noRef" }]);
    expect(c.includedCount).toBe(2);
  });

  it("지수 조회 실패: 보유 종목 값만, 차이·시장 줄 없음", () => {
    const failed: PeriodRefs<MarketIndexResponse> = { ...IDX, weekly: { KOSPI: null, SPX: IDX.weekly!.SPX } };
    const c = computePeriodCell("kr", "weekly", kr, REFS, failed);
    expect(c.state).toBe("ok");
    expect(c.holdingsRate).not.toBeNull();
    expect(c.indexState).toBe("failed");
    expect(c.diffTenths).toBeNull();
    expect(c.rows.some((r) => r.kind === "index")).toBe(false);
  });

  it("기준일이 다른 종목은 '기준일 다름'으로 제외(다수 쌍이 기준)", () => {
    const odd = { ...WEEKLY, "069500": { refPrice: 79000, refDate: "2026-11-02" } };
    const c = computePeriodCell("kr", "weekly", kr, { ...REFS, weekly: odd }, IDX);
    expect(c.excluded).toEqual([{ ticker: "069500", name: "KODEX 200", reason: "dateMismatch" }]);
    expect(c.indexState).toBe("ok");
  });

  it("지수 날짜가 종목 기준일과 다르면 시장·차이 —(dateMismatch), 0.0%p 없음", () => {
    const idx: PeriodRefs<MarketIndexResponse> = { ...IDX, weekly: { ...IDX.weekly!, KOSPI: { refPrice: 5600, refDate: "2026-11-02" } } };
    const c = computePeriodCell("kr", "weekly", kr, REFS, idx);
    expect(c.indexState).toBe("dateMismatch");
    expect(c.indexRate).toBeNull();
    expect(c.diffTenths).toBeNull();
    expect(c.rows.some((r) => r.kind === "index")).toBe(false);
  });

  it("F8 국내만 휴장(한글날 10/9 명목일): 하루 칸 holiday, 0.0% 없음, 목록 rate null(입력 순서)", () => {
    const hol: ProfitRefResponse = {
      "005930": { refPrice: 100000, refDate: "2026-10-09", prevPrice: 100000, prevDate: "2026-10-08" },
      "000660": { refPrice: 500000, refDate: "2026-10-09", prevPrice: 500000, prevDate: "2026-10-08" },
      "069500": { refPrice: 80000, refDate: "2026-10-09", prevPrice: 80000, prevDate: "2026-10-08" },
    };
    const idx: PeriodRefs<MarketIndexResponse> = { daily: { KOSPI: { refPrice: 3000, refDate: "2026-10-09", prevPrice: 3000, prevDate: "2026-10-08" }, SPX: null } };
    const c = computePeriodCell("kr", "daily", kr, { daily: hol }, idx);
    expect(c.state).toBe("holiday");
    expect(c.holdingsRate).toBeNull();
    expect(c.diffTenths).toBeNull();
    expect(c.rows.map((r) => [r.name, r.rate])).toEqual([["삼성전자", null], ["SK하이닉스", null], ["KODEX 200", null]]);
  });

  it("F8 미국만 휴장(추수감사절 11/26 명목일): 미국 하루 holiday, 국내는 정상", () => {
    const daily: ProfitRefResponse = {
      AAPL: { refPrice: 200, refDate: "2026-11-26", prevPrice: 200, prevDate: "2026-11-25" },
      NVDA: { refPrice: 200, refDate: "2026-11-26", prevPrice: 200, prevDate: "2026-11-25" },
    };
    const idx: PeriodRefs<MarketIndexResponse> = { daily: { KOSPI: null, SPX: { refPrice: 7000, refDate: "2026-11-26", prevPrice: 7000, prevDate: "2026-11-25" } } };
    const us = classifyHoldings(F1, PEERS).us;
    expect(computePeriodCell("us", "daily", us, { daily }, idx).state).toBe("holiday");
  });

  it("합산할 종목이 0(전부 기준가 없음)이면 empty", () => {
    const allNull: ProfitRefResponse = { "005930": null, "000660": null, "069500": null };
    const c = computePeriodCell("kr", "daily", kr, { daily: allNull }, IDX);
    expect(c.state).toBe("empty");
    expect(c.excluded).toHaveLength(3);
  });
});

describe("표시 규칙", () => {
  it("소수 1자리·부호, 0.0은 부호 없음, -0 없음", () => {
    expect(formatCompareRate(2)).toBe("+2.0%");
    expect(formatCompareRate(-1.25)).toBe("-1.3%");
    expect(formatCompareRate(-0.04)).toBe("0.0%");
    expect(formatCompareRate(0.05)).toBe("+0.1%");
    expect(formatCompareDiff(8)).toBe("+0.8%p");
    expect(formatCompareDiff(-3)).toBe("-0.3%p");
    expect(formatCompareDiff(0)).toBe("0.0%p");
    expect(rateTenths(-0.04)).toBe(0);
    expect(Object.is(rateTenths(-0.04), -0)).toBe(false);
  });

  it("진입 글줄과 페이지 표가 같은 지수 값(같은 함수)", () => {
    const blocks = computeMarketCompare(classifyHoldings(F1, PEERS), REFS, IDX);
    expect(computeIndexSpan("us", "weekly", IDX).rate).toBe(blocks[1].periods.weekly.indexRate);
    expect(formatCompareRate(computeIndexSpan("kr", "weekly", IDX).rate!)).toBe("-11.2%");
  });
});

describe("비교하지 않은 종목 묶음", () => {
  it("등락만, 높은 순, 기준가 없음은 맨 뒤 rate null", () => {
    const nc = [
      { ticker: "360750", name: "TIGER 미국S&P500", reason: "krNonEquity" as const },
      { ticker: "459580", name: "KODEX CD금리액티브", reason: "krNonEquity" as const },
      { ticker: "7203", name: "토요타", reason: "foreignNonUs" as const },
    ];
    const daily: ProfitRefResponse = {
      "360750": { refPrice: 21000, refDate: "2026-11-09", prevPrice: 20000, prevDate: "2026-11-06" },
      "459580": { refPrice: 50010, refDate: "2026-11-09", prevPrice: 50000, prevDate: "2026-11-06" },
      "7203": null,
    };
    const rows = computeNotComparedRows(nc, "daily", { daily })!;
    expect(rows.map((r) => r.name)).toEqual(["TIGER 미국S&P500", "KODEX CD금리액티브", "토요타"]);
    expect(rows[2].rate).toBeNull();
    expect(computeNotComparedRows(nc, "weekly", { daily })).toBeNull();
  });
});
