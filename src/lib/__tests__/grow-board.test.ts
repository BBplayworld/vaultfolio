// #239 [5.125 재설계 3차] 내 자산 불리기 표시 값 — 결론 합계·기준별 묶음·종목 행·보유 기간 대비 점수·다음 점검일·데모 시드
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import type { Stock } from "@/types/asset";
import { assetDataSchema } from "@/types/asset";
import { computeStockTotals } from "@/app/(main)/_components/views/detail/asset-detail-tabs";
import { GRADE_THRESHOLDS } from "../report/asset-grade";
import { materializeDemo } from "../preview/demo-payload";
import { demoClassificationPatches } from "../preview/demo-inject";
import { parseStockLabels, type StockLabels } from "../asset/stock-labels";
import {
  BOARD_AXES, HOLD_SCORE_BANDS, SCORE_MIN_DAYS, annualizedPct, boardScale, boardTotal, buildAxisGroups, buildBoardRows, holdScore, nextChecks, scalePos,
} from "../asset/grow-board";

const RATES = { USD: 1400, JPY: 925 };
const NOW = Date.parse("2026-11-18T03:00:00Z");
const mk = (items: StockLabels["items"] = {}, months: 3 | 6 | 12 | null = null): StockLabels => ({ v: 1, cycle: { months, at: months ? "2025-01-01T00:00:00.000Z" : "" }, items });
const st = (o: Partial<Stock> & { id: string }): Stock => ({
  category: "domestic", name: o.id, ticker: o.id.toUpperCase(), quantity: 10, averagePrice: 100, currentPrice: 110, currency: "KRW", purchaseDate: "2025-01-10", ...o,
} as Stock);

describe("보유 기간 대비 점수 — 연 환산 수익률, 자산 성적표 성장 축과 같은 구간", () => {
  it("구간은 GRADE_THRESHOLDS.growth(15·10·5·0%)를 그대로 쓴다", () => {
    const g = GRADE_THRESHOLDS.growth;
    expect(HOLD_SCORE_BANDS.map((b) => [b.score, b.min])).toEqual([[5, g.cagrExcellent], [4, g.cagrGood], [3, g.cagrReal], [2, 0], [1, null]]);
  });
  it("연 환산 = (1 + r)^(365 ÷ 일수) − 1 — 1년이면 그대로, 2년이면 연평균", () => {
    expect(annualizedPct(10, 100, 365)).toBeCloseTo(10, 6);
    expect(annualizedPct(21, 100, 730)).toBeCloseTo(10, 6);
    expect(annualizedPct(-100, 100, 400)).toBe(-100);
    expect(annualizedPct(10, 0, 365)).toBeNull();
  });
  it("경계: 183일 미만은 측정 중, 183일부터 점수", () => {
    expect(SCORE_MIN_DAYS).toBe(183);
    expect(holdScore(50, 100, 182, true)).toEqual({ state: "measuring" });
    expect(holdScore(50, 100, 183, true).state).toBe("score");
  });
  it("구간 판정(같은 % 라도 보유가 길수록 연 환산이 낮다)", () => {
    const s = (profit: number, days: number) => { const r = holdScore(profit, 100, days, true); return r.state === "score" ? r.score : r.state; };
    expect(s(15, 365)).toBe(5);
    expect(s(14.9, 365)).toBe(4);
    expect(s(10, 365)).toBe(4);
    expect(s(5, 365)).toBe(3);
    expect(s(0, 365)).toBe(2);
    expect(s(-0.1, 365)).toBe(1);
    expect(s(30, 730)).toBe(4); // 연 환산 약 14.0%
    expect(s(30, 365 * 3)).toBe(3); // 연 환산 약 9.1%
  });
  it("시세 없음·매수일 미상·원가 0이면 점수 없음", () => {
    expect(holdScore(10, 100, 400, false)).toEqual({ state: "none" });
    expect(holdScore(10, 100, null, true)).toEqual({ state: "none" });
    expect(holdScore(10, 0, 400, true)).toEqual({ state: "none" });
  });
});

describe("종목 행 buildBoardRows", () => {
  const STOCKS = [
    st({ id: "a", purchaseDate: "2024-01-05" }),
    st({ id: "b", purchaseDate: "2026-06-01", currentPrice: 90 }),
    st({ id: "b2", ticker: "B", purchaseDate: "2025-03-01", category: "isa" }), // 같은 티커 다른 계좌 → 1행, 가장 이른 매수일
    st({ id: "c", ticker: "", name: "수동 종목", purchaseDate: "" }),
    st({ id: "d", purchaseDate: "2027-01-01" }), // 미래 매수일 → 기간 미상
    st({ id: "x", inactiveStatus: "delisted" }),
    st({ id: "f", ticker: "AAPL", category: "foreign", currency: "USD", averagePrice: 100, currentPrice: 120, purchaseExchangeRate: 1300, purchaseDate: "2025-11-18" }),
  ];
  const rows = buildBoardRows(STOCKS, RATES, mk(), NOW);
  it("오래 가진 순, 기간 미상은 끝. 상장폐지 제외, 티커 없는 종목은 행이 있고 이름표 키 없음", () => {
    expect(rows.map((r) => r.key)).toEqual(["t:A", "t:B", "t:AAPL", "c", "t:D"]);
    expect(rows.find((r) => r.key === "c")!.labelKey).toBeNull();
    expect(rows.find((r) => r.key === "t:D")!.holdText).toBe("기간 미상");
    expect(rows.find((r) => r.key === "t:B")!.purchaseDate).toBe("2025-03-01");
    expect(rows.find((r) => r.key === "t:B")!.groupStockIds).toEqual(["b", "b2"]);
  });
  it("보유 기간 표기: `2년 10개월` / `1년` / `20일`", () => {
    expect(rows[0].holdText).toBe("2년 10개월");
    expect(rows.find((r) => r.key === "t:AAPL")!.holdText).toBe("1년");
  });
  it("행 손익 합 = 상세 › 주식 '전체' 헤더 손익 = 결론 합계(원 단위, 해외는 매입환율 원가)", () => {
    const t = computeStockTotals(STOCKS, RATES);
    const sum = rows.reduce((s, r) => s + r.profit, 0);
    expect(Math.round(sum)).toBe(Math.round(t.totalProfit));
    const total = boardTotal(STOCKS, RATES, rows);
    expect(Math.round(total.profit)).toBe(Math.round(t.totalProfit));
    expect(total.rate).toBeCloseTo(t.totalProfitRate, 10);
    expect(total.count).toBe(rows.length);
  });
  it("시세 없는 종목이 있으면 합계 priced=false, 그 행 rate null", () => {
    const r = buildBoardRows([...STOCKS, st({ id: "z", currentPrice: 0 })], RATES, mk(), NOW);
    expect(boardTotal(STOCKS, RATES, r).priced).toBe(false);
    expect(r.find((x) => x.key === "t:Z")!.rate).toBeNull();
  });
  it("점검 차례: '점검할 자산'이고 주기가 지난 행만(주기 미설정이면 없음)", () => {
    const labels = (months: 3 | null) => mk({ A: { label: "check", labeledAt: "2026-01-01T00:00:00Z", at: "2026-01-01T00:00:00Z" }, B: { label: "keep", labeledAt: "2026-01-01T00:00:00Z", at: "2026-01-01T00:00:00Z" } }, months);
    expect(buildBoardRows(STOCKS, RATES, labels(3), NOW).filter((r) => r.due).map((r) => r.key)).toEqual(["t:A"]);
    expect(buildBoardRows(STOCKS, RATES, labels(null), NOW).some((r) => r.due)).toBe(false);
  });
});

describe("기준별 묶음 buildAxisGroups", () => {
  const STOCKS = [
    st({ id: "old", purchaseDate: "2024-01-05", currentPrice: 90 }),
    st({ id: "new", purchaseDate: "2026-06-01", currentPrice: 130 }),
    st({ id: "e", ticker: "069500", name: "KODEX 200", purchaseDate: "2025-02-01" }),
    st({ id: "u", ticker: "", name: "수동", purchaseDate: "" }),
  ];
  const rows = buildBoardRows(STOCKS, RATES, mk(), NOW);
  const total = boardTotal(STOCKS, RATES, rows);
  it("축마다 묶음 손익 합 = 결론 합계, 묶음 수 합 = 행 수", () => {
    for (const a of BOARD_AXES) {
      const gs = buildAxisGroups(a.value, rows);
      expect(Math.round(gs.reduce((s, g) => s + g.profit, 0)), a.value).toBe(Math.round(total.profit));
      expect(gs.reduce((s, g) => s + g.count, 0), a.value).toBe(rows.length);
    }
  });
  it("보유 기간: 1년 이상 → 1년 미만 → 기간 미상(값과 무관한 고정 순서)", () => {
    expect(buildAxisGroups("hold", rows).map((g) => g.label)).toEqual(["1년 이상", "1년 미만", "기간 미상"]);
  });
  it("ETF·개별: X-Ray 판정(국내 ETF 브랜드) — ETF 먼저", () => {
    expect(buildAxisGroups("etf", rows).map((g) => [g.label, g.count])).toEqual([["ETF", 1], ["개별 종목", 3]]);
  });
  it("시가총액: 분류 캐시가 없으면 미분류, ETF는 ETF/펀드 — 대형→중형→소형→ETF→미분류 순", () => {
    expect(buildAxisGroups("cap", rows).map((g) => g.label)).toEqual(["ETF/펀드", "미분류"]);
  });
  it("% = Σ손익 ÷ Σ원가", () => {
    const g = buildAxisGroups("hold", rows).find((x) => x.key === "long")!;
    expect(g.rate).toBeCloseTo((g.profit / g.cost) * 100, 10);
  });
});

describe("막대 눈금 — 화면 전체 1개", () => {
  it("10% 단위 올림, 음수가 없으면 0이 왼쪽 끝", () => {
    expect(boardScale([3, 19.1, 27.5])).toEqual({ lo: 0, hi: 30 });
    expect(boardScale([])).toEqual({ lo: 0, hi: 10 });
    expect(boardScale([-12, 5])).toEqual({ lo: -20, hi: 10 });
    expect(scalePos(0, { lo: -20, hi: 10 })).toBeCloseTo(66.667, 2);
    expect(scalePos(50, { lo: 0, hi: 30 })).toBe(100);
  });
});

describe("다음 점검일 nextChecks", () => {
  const STOCKS = [st({ id: "a" }), st({ id: "b" })];
  const rows = (l: StockLabels) => buildBoardRows(STOCKS, RATES, l, NOW);
  it("주기 + 기준일(점검일·붙인 날 중 늦은 쪽). 지났으면 `지금`, 지난 것 먼저", () => {
    const l = mk({
      A: { label: "check", labeledAt: "2026-01-01T00:00:00Z", at: "2026-01-01T00:00:00Z" },
      B: { label: "check", labeledAt: "2026-01-01T00:00:00Z", checkedAt: "2026-10-29T03:00:00Z", at: "2026-10-29T03:00:00Z" },
    }, 3);
    expect(nextChecks(rows(l), l, NOW)).toEqual({ state: "list", items: [{ name: "a", when: "지금", due: true }, { name: "b", when: "1월 29일", due: false }] });
  });
  it("말일 당김: 11/30 + 3개월 = 2월 28일", () => {
    const l = mk({ A: { label: "check", labeledAt: "2026-11-30T03:00:00Z", at: "2026-11-30T03:00:00Z" } }, 3);
    const r = nextChecks(rows(l), l, Date.parse("2026-12-01T03:00:00Z"));
    expect(r).toEqual({ state: "list", items: [{ name: "a", when: "2월 28일", due: false }] });
  });
  it("점검할 자산 없음 / 주기 없음", () => {
    expect(nextChecks(rows(mk()), mk(), NOW)).toEqual({ state: "no-check" });
    const l = mk({ A: { label: "check", labeledAt: "2026-01-01T00:00:00Z", at: "2026-01-01T00:00:00Z" } });
    expect(nextChecks(rows(l), l, NOW)).toEqual({ state: "no-cycle" });
  });
});

describe("데모 시드(재설계 3차) — 장기 묶음·분류 캐시", () => {
  const raw = JSON.parse(readFileSync(path.resolve(__dirname, "../preview/demo-data.json"), "utf8"));
  it.each(["2026-11-18", "2026-03-10", "2027-01-31"])("기준일 %s: 보유 기간 축에 1년 이상 2종목(삼성전자·TIGER), 이름표 붙인 날 ≥ 매수일", (today) => {
    const p = materializeDemo(raw, today) as { assetData: unknown; stockLabels: unknown };
    const data = assetDataSchema.parse(p.assetData);
    const labels = parseStockLabels(p.stockLabels)!;
    const rows = buildBoardRows(data.stocks, RATES, labels, Date.parse(`${today}T03:00:00Z`), data.transactions);
    const long = buildAxisGroups("hold", rows).find((g) => g.key === "long")!;
    expect(long.rowKeys.sort()).toEqual(["t:005930", "t:360750"]);
    expect(rows.slice(0, 2).map((r) => r.labelKey)).toEqual(["360750", "005930"]); // 오래 가진 순
    for (const [key, item] of Object.entries(labels.items)) {
      const s = data.stocks.find((x) => x.ticker === key)!;
      expect(item.labeledAt.slice(0, 10) >= s.purchaseDate!, key).toBe(true);
    }
  });
  it("분류 캐시 패치: 비어 있는 필드만, 밑줄 키 제외", () => {
    const seed = { _comment: "x", AAPL: { marketCapTier: "large" }, NVDA: { marketCapTier: "large" } };
    const cur = (t: string) => (t === "AAPL" ? { marketCapTier: "mid" as const } : undefined);
    expect(demoClassificationPatches(seed, cur)).toEqual({ NVDA: { marketCapTier: "large" } });
    expect(Object.keys(demoClassificationPatches(raw.xrayClassifications, () => undefined)).sort()).toEqual(["000660", "005930", "AAPL", "NVDA"]);
  });
});
