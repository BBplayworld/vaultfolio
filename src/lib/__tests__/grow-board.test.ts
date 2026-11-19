// #239 [5.125 재설계 3차·5차 5b] 내 자산 불리기 표시 값 — 결론 합계·기준별 묶음·종목 행·보유 기간 대비 점수·점검 차례·카드 라벨 행·묶음 안 순서·데모 시드
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import type { Stock } from "@/types/asset";
import { assetDataSchema } from "@/types/asset";
import { computeStockTotals } from "@/app/(main)/_components/views/detail/asset-detail-tabs";
import { GRADE_THRESHOLDS } from "../report/asset-grade";
import { materializeDemo } from "../preview/demo-payload";
import { demoClassificationPatches } from "../preview/demo-inject";
import { parseStockLabels, recordReview, reviewsOf, setStockPlan, type StockLabels } from "../asset/stock-labels";
import type { Crypto } from "@/types/asset";
import { buildCryptoRows, buildGrowBoards, growStatus } from "../asset/grow-kinds";
import {
  BOARD_AXES, HOLD_SCORE_BANDS, SCORE_MIN_DAYS, annualizedPct, boardScale, boardTotal, buildAxisGroups, buildBoardRows, holdScore, scalePos,
  addMonthsKst, boardRowRank, boardSummary, countDueRows, dueReasonText, hitOf, monthDayText, nextCheckDateText, pctAckOf, PCT_ACK_MONTHS,
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
  it("전량 매도로 수량 0만 남은 보유 건은 행·합계·종목 수에서 빠진다(#243)", () => {
    const sold = st({ id: "s0", ticker: "SOLD", quantity: 0, averagePrice: 0, currentPrice: 280, purchaseDate: "2025-01-02" });
    const r = buildBoardRows([...STOCKS, sold], RATES, mk(), NOW);
    expect(r.map((x) => x.key)).toEqual(rows.map((x) => x.key));
    expect(r.some((x) => x.key === "t:SOLD")).toBe(false);
    expect(boardTotal([...STOCKS, sold], RATES, r).count).toBe(rows.length);
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

describe("점검 차례(5차) — 점검할 조건·기간, 오래 둘 12개월, 기준일에 '그대로 둠' 기록", () => {
  const STOCKS = [st({ id: "a" }), st({ id: "b", currentPrice: 80 }), st({ id: "c", currentPrice: 130 })];
  const rows = (l: StockLabels, now = NOW) => buildBoardRows(STOCKS, RATES, l, now);
  const by = (rs: ReturnType<typeof rows>, t: string) => rs.find((r) => r.labelKey === t)!;
  const chk = (o: Partial<StockLabels["items"][string]> = {}) => ({ label: "check" as const, labeledAt: "2026-10-01T00:00:00Z", at: "2026-10-01T00:00:00Z", ...o });
  it("다음 점검 날짜 — 오늘과 11개월 넘게 떨어지면 연도(`2027년 11월 18일`), 그 안이면 `M월 D일`(6차 ui-review ②)", () => {
    const now = Date.parse("2026-11-18T03:00:00Z");
    expect(nextCheckDateText(addMonthsKst(now, 12), now)).toBe("2027년 11월 18일");
    expect(nextCheckDateText(addMonthsKst(now, 11), now)).toBe("10월 18일");
    expect(nextCheckDateText(addMonthsKst(now, 3), now)).toBe("2월 18일");
  });
  it("다음 점검일 = 기준일(정한 날·점검한 날 중 늦은 쪽) + 기본 주기, 말일 당김(11/30 + 3개월 = 2월 28일)", () => {
    const l = mk({ A: chk({ labeledAt: "2026-11-30T03:00:00Z", at: "2026-11-30T03:00:00Z" }), B: chk({ checkedAt: "2026-10-29T03:00:00Z" }) }, 3);
    const r = rows(l, Date.parse("2026-12-01T03:00:00Z"));
    expect(monthDayText(by(r, "A").nextCheckMs!)).toBe("2월 28일");
    expect(monthDayText(by(r, "B").nextCheckMs!)).toBe("1월 29일");
    expect(by(rows(mk({ A: chk() })), "A").nextCheckMs).toBeNull(); // 기본 주기도 조건 기간도 없음
  });
  it("조건 하한·상한에 닿으면 차례(사실형 이유), 조건 기간은 기본 주기보다 먼저", () => {
    // B −20%, C +30%
    const l = mk({ A: chk({ plan: { months: 12 } }), B: chk({ plan: { down: 20 } }), C: chk({ plan: { up: 30, down: 5 } }) }, 3);
    const r = rows(l, Date.parse("2027-02-01T03:00:00Z")); // 4개월 경과
    expect(by(r, "A").due).toBe(false); // 조건 기간 12개월
    expect(by(r, "B").dueReason).toEqual({ kind: "down", pct: 20 });
    expect(by(r, "C").dueReason).toEqual({ kind: "up", pct: 30 });
    expect(dueReasonText({ kind: "up", pct: 25 })).toBe("평단 대비 +25% 이상에 닿았어요");
    // 6차 ui-review ①: 기간 출처별 문장 — 조건 기간 / 기본 주기 / 장기 보유 12개월
    expect(dueReasonText({ kind: "date", months: 6, source: "plan" })).toBe("정한 기간 6개월이 지났어요");
    expect(dueReasonText({ kind: "date", months: 3, source: "cycle" })).toBe("점검 주기 3개월이 지났어요");
    expect(dueReasonText({ kind: "date", months: 12, source: "keep" })).toBe("장기 보유로 정한 지 12개월이 지났어요");
    expect(by(rows(mk({ A: chk({ labeledAt: "2026-01-01T00:00:00Z", plan: { months: 6 } }) }, 3)), "A").dueReason).toEqual({ kind: "date", months: 6, source: "plan" });
    expect(by(rows(mk({ A: chk({ labeledAt: "2026-01-01T00:00:00Z" }) }, 3)), "A").dueReason).toEqual({ kind: "date", months: 3, source: "cycle" });
    expect(by(rows(mk({ B: chk({ plan: { down: 21 } }) })), "B").due).toBe(false); // −20.0% > −21%
  });
  it("오래 둘은 기준일 + 12개월에 차례, 사용자 주기(3개월)는 쓰지 않는다", () => {
    const keep = (labeledAt: string, checkedAt?: string) => mk({ A: { label: "keep", labeledAt, ...(checkedAt ? { checkedAt } : {}), at: labeledAt } }, 3);
    expect(by(rows(keep("2025-11-18T00:00:00Z")), "A").dueReason).toEqual({ kind: "date", months: 12, source: "keep" });
    expect(by(rows(keep("2025-11-19T03:00:00Z")), "A").due).toBe(false);
    expect(by(rows(keep("2025-01-01T00:00:00Z", "2026-06-01T00:00:00Z")), "A").due).toBe(false); // 그대로 오래 둠 뒤 12개월 전
  });
  it("P5 — 기준일에 마지막 '그대로 둠' 기록을 넣는다: 경합으로 checkedAt이 진 쪽에 있어도 차례가 되살아나지 않는다", () => {
    const l: StockLabels = { ...mk({ A: chk({ labeledAt: "2026-01-01T00:00:00Z", at: "2026-11-01T00:00:00Z", plan: { up: 50 } }) }, 3),
      reviews: [{ t: "A", at: "2026-10-20T00:00:00Z", from: "check", choice: "same", price: 105, rate: 5 }] };
    const r = by(rows(l), "A");
    expect(r.due).toBe(false);
    expect(r.since).toMatchObject({ kind: "checked" });
    expect(r.since!.pct).toBeCloseTo((110 / 105 - 1) * 100, 6);
  });
  it("행 2줄 % — 정한 날이 오늘이면 today(`오늘 정함`), 다음 날부터 정한 날 대비 %", () => {
    const today = mk({ A: chk({ labeledAt: "2026-11-18T01:00:00Z", at: "2026-11-18T01:00:00Z", base: { qty: 10, price: 100 } }) });
    expect(by(rows(today), "A").since).toMatchObject({ kind: "labeled", today: true });
    expect(by(rows(today, Date.parse("2026-11-19T03:00:00Z")), "A").since).toMatchObject({ kind: "labeled", today: false });
  });
  it("행 2줄 % — 기록 없으면 정한 날 가격(base.price)부터, 기준 가격이 없거나 정하지 않은 행은 없음", () => {
    const l = mk({ A: chk({ base: { qty: 10, price: 100 } }), B: chk(), C: { label: null, labeledAt: "2026-10-01T00:00:00Z", at: "2026-10-01T00:00:00Z" } });
    const r = rows(l);
    expect(by(r, "A").since).toEqual({ kind: "labeled", pct: expect.closeTo(10, 6), today: false });
    expect(by(r, "B").since).toBeNull();
    expect(by(r, "C").since).toBeNull();
  });
  it("정하지 않음 행의 `M월 D일 점검 대상에서 뺌`은 최근 90일 기록만(COO P2-9)", () => {
    const none = (at: string): StockLabels => ({ ...mk({ A: { label: null, labeledAt: at, at } }), reviews: [{ t: "A", at, from: "check", choice: "none", price: 100, rate: 1 }] });
    expect(by(rows(none("2026-09-19T03:00:00Z")), "A").dropNote).toBe("9월 19일 점검 대상에서 뺌");
    expect(by(rows(none("2026-08-20T03:00:00Z")), "A").dropNote).toBe("8월 20일 점검 대상에서 뺌"); // 90일
    expect(by(rows(none("2026-08-19T03:00:00Z")), "A").dropNote).toBeNull(); // 91일
  });
});

describe("#247 ±% 조건 차례 — `그대로 두기`로 확인하면 풀리고, 다음 점검일·조건 수정·반대 방향에서만 다시 차례", () => {
  // A +10%, B −20%, C +30%
  const STOCKS = [st({ id: "a" }), st({ id: "b", currentPrice: 80 }), st({ id: "c", currentPrice: 130 })];
  const rows = (l: StockLabels, now = NOW, stocks = STOCKS) => buildBoardRows(stocks, RATES, l, now);
  const by = (rs: ReturnType<typeof rows>, t: string) => rs.find((r) => r.labelKey === t)!;
  const P0 = "2026-10-01T00:00:00Z";
  const chk = (plan: NonNullable<StockLabels["items"][string]["plan"]>) => ({ label: "check" as const, labeledAt: P0, at: P0, plan: { ...plan, at: P0 } });
  const DAY = 86400000;
  /** 화면의 `그대로 두기`와 같은 쓰기 — 그 순간 행의 차례 이유를 hit으로 남긴다 */
  const press = (l: StockLabels, t: string, now: number, stocks = STOCKS): StockLabels => {
    const r = by(rows(l, now, stocks), t);
    return recordReview(l, t, "same", new Date(now).toISOString(), { price: r.nowPrice!, rate: r.rate! }, undefined, hitOf(r.dueReason));
  };
  const hits = (l: StockLabels, t: string) => reviewsOf(l, t).filter((x) => x.hit === "up" || x.hit === "down").length;

  it("상한 + 기본 주기 3개월 — 누르면 풀리고 약속한 다음 점검일에 다시 차례(문구 `그대로 두면 다음 점검은 2월 18일`과 같은 날)", () => {
    const l0 = mk({ C: chk({ up: 25 }) }, 3);
    expect(by(rows(l0), "C").dueReason).toEqual({ kind: "up", pct: 25 });
    expect(monthDayText(addMonthsKst(NOW, 3))).toBe("2월 18일"); // 버튼 아래 약속 줄의 날짜
    const l1 = press(l0, "C", NOW);
    const r = by(rows(l1), "C");
    expect([r.due, r.dueReason, r.checkedToday, monthDayText(r.nextCheckMs!)]).toEqual([false, null, true, "2월 18일"]);
    expect(countDueRows(rows(l1))).toBe(0);
    // 약속한 날 전날까지 차례 아님, 그날부터 다시 차례(조건에 여전히 닿아 있으면 그 이유)
    expect(by(rows(l1, Date.parse("2027-02-17T03:00:00Z")), "C").due).toBe(false);
    expect(by(rows(l1, Date.parse("2027-02-18T03:00:00Z")), "C").dueReason).toEqual({ kind: "up", pct: 25 });
    // 그날 다시 누르면 또 풀린다
    const l2 = press(l1, "C", Date.parse("2027-02-18T03:00:00Z"));
    expect(by(rows(l2, Date.parse("2027-02-19T03:00:00Z")), "C").due).toBe(false);
    expect(hits(l2, "C")).toBe(2);
  });
  it("날짜를 넘겨도 차례가 아니라 hit 기록이 늘지 않는다 — 다음 날 누른 기록은 hit 없음, 확인은 그대로", () => {
    let l = press(mk({ C: chk({ up: 25 }) }, 3), "C", NOW);
    for (const d of [1, 2, 3]) {
      const r = by(rows(l, NOW + d * DAY), "C");
      expect([r.due, r.checkedToday, hitOf(r.dueReason)]).toEqual([false, false, undefined]);
      l = press(l, "C", NOW + d * DAY);
      expect(by(rows(l, NOW + d * DAY), "C").due).toBe(false);
    }
    expect([reviewsOf(l, "C").length, hits(l, "C")]).toEqual([4, 1]);
    expect(pctAckOf(l, "C", l.items.C)).toMatchObject({ hit: "up", at: new Date(NOW).toISOString() }); // hit 없는 뒤 기록은 건너뛴다
    expect(by(rows(l, NOW + 40 * DAY), "C").due).toBe(false);
  });
  it("같은 날 다시 누름은 기존처럼 화면이 막는다(checkedToday) — 차례가 풀려도 값은 유지", () => {
    const l = press(mk({ C: chk({ up: 25 }) }, 3), "C", NOW);
    expect(by(rows(l, NOW + 3600000), "C")).toMatchObject({ due: false, checkedToday: true });
  });
  it("하한 + 주기·기간 없음 — 누르면 풀리고, 확인 기록 + 3개월이 지나 여전히 닿아 있으면 다시 차례(영구 확인 아님, 다음 점검일 표시는 없음)", () => {
    const l0 = mk({ B: chk({ down: 20 }) });
    expect(by(rows(l0), "B").dueReason).toEqual({ kind: "down", pct: 20 });
    const l1 = press(l0, "B", NOW); // 2026-11-18 확인
    expect(by(rows(l1), "B")).toMatchObject({ due: false, nextCheckMs: null });
    expect(PCT_ACK_MONTHS).toBe(3);
    // 3개월 경계 — 2027-02-17까지 풀린 채, 2027-02-18부터 다시 차례
    expect(by(rows(l1, Date.parse("2027-02-17T03:00:00Z")), "B").due).toBe(false);
    expect(by(rows(l1, Date.parse("2027-02-18T03:00:00Z")), "B").dueReason).toEqual({ kind: "down", pct: 20 });
    // 그 사이 차례가 아닌 날 누른 기록(hit 없음)은 3개월을 미루지 않는다
    const mid = press(l1, "B", NOW + 30 * DAY);
    expect(reviewsOf(mid, "B").map((x) => x.hit)).toEqual([undefined, "down"]);
    expect(by(rows(mid, Date.parse("2027-02-18T03:00:00Z")), "B").due).toBe(true);
    // 3개월 뒤 조건에서 벗어나 있으면 차례 아님
    expect(by(rows(l1, Date.parse("2027-02-18T03:00:00Z"), [st({ id: "b", currentPrice: 95 })]), "B").due).toBe(false);
    // 다시 누르면 그날부터 3개월 풀린다
    const l3 = press(l1, "B", Date.parse("2027-02-18T03:00:00Z"));
    expect(by(rows(l3, Date.parse("2027-05-17T03:00:00Z")), "B").due).toBe(false);
    expect(by(rows(l3, Date.parse("2027-05-18T03:00:00Z")), "B").due).toBe(true);
  });
  it("확인 뒤 조건 — 메모만 고치면 plan.at이 그대로라 풀린 채(D-5, 같은 날 `오늘 점검함` + `점검 차례` 모순 없음), ±% 값·기간을 고치면 다시 차례", () => {
    const l1 = press(mk({ B: chk({ down: 20 }) }), "B", NOW);
    const later = new Date(NOW + 3600000).toISOString(); // 같은 날 1시간 뒤
    // 같은 값으로 저장하면 그대로
    expect(setStockPlan(l1, "B", { down: 20 }, later)).toBe(l1);
    // 메모만 입력 — 저장은 되지만 plan.at 유지
    const memo = setStockPlan(l1, "B", { down: 20, memo: "실적 발표 뒤 다시 보기" }, later);
    expect(memo.items.B.plan).toEqual({ down: 20, memo: "실적 발표 뒤 다시 보기", at: P0 });
    expect(memo.items.B.at).toBe(later); // 병합 기준 시각은 움직인다
    expect(by(rows(memo, NOW + 3600000), "B")).toMatchObject({ due: false, checkedToday: true });
    // 메모 고치기·지우기도 같다
    const memo2 = setStockPlan(memo, "B", { down: 20 }, later);
    expect(memo2.items.B.plan).toEqual({ down: 20, at: P0 });
    expect(by(rows(memo2, NOW + 3600000), "B").due).toBe(false);
    // ±% 값을 고치면 새 조건 — 다시 차례, 누르면 다시 풀린다
    const l2 = setStockPlan(memo, "B", { down: 15, memo: "실적 발표 뒤 다시 보기" }, new Date(NOW + DAY).toISOString());
    expect(l2.items.B.plan!.at).toBe(new Date(NOW + DAY).toISOString());
    expect(by(rows(l2, NOW + DAY), "B").dueReason).toEqual({ kind: "down", pct: 15 });
    expect(by(rows(press(l2, "B", NOW + DAY), NOW + 2 * DAY), "B").due).toBe(false);
    // 반대쪽 조건 추가·기간 변경도 조건 수정이다
    expect(setStockPlan(l1, "B", { down: 20, up: 50 }, later).items.B.plan!.at).toBe(later);
    expect(by(rows(setStockPlan(l1, "B", { down: 20, months: 6 }, later), NOW + 3600000), "B").due).toBe(true);
  });
  it("plan.at이 없는 옛 조건 — 메모만 고쳐도 at을 새로 만들지 않는다", () => {
    const l = mk({ B: { label: "check", labeledAt: P0, at: P0, plan: { down: 20 } } });
    expect(setStockPlan(l, "B", { down: 20, memo: "메모" }, new Date(NOW).toISOString()).items.B.plan).toEqual({ down: 20, memo: "메모" });
  });
  it("조건 기간(plan.months)이 있으면 그 기간 뒤에 다시 차례 — 기본 주기보다 먼저", () => {
    const l = press(mk({ B: chk({ down: 20, months: 6 }) }, 3), "B", NOW);
    expect(by(rows(l, Date.parse("2027-05-17T03:00:00Z")), "B").due).toBe(false);
    expect(by(rows(l, Date.parse("2027-05-18T03:00:00Z")), "B").dueReason).toEqual({ kind: "down", pct: 20 });
  });
  it("반대 방향 조건에 닿으면 다시 차례 — 확인은 가장 최근 ±% 기록의 방향만", () => {
    const up = [st({ id: "c", currentPrice: 130 })];
    const down = [st({ id: "c", currentPrice: 80 })];
    const l1 = press(mk({ C: chk({ up: 25, down: 15 }) }), "C", NOW, up);
    expect(by(rows(l1, NOW + DAY, up), "C").due).toBe(false);
    expect(by(rows(l1, NOW + DAY, down), "C").dueReason).toEqual({ kind: "down", pct: 15 });
    const l2 = press(l1, "C", NOW + DAY, down);
    expect(by(rows(l2, NOW + 2 * DAY, down), "C").due).toBe(false);
    expect(by(rows(l2, NOW + 2 * DAY, up), "C").dueReason).toEqual({ kind: "up", pct: 25 }); // 다시 상한에 닿음
  });
  it("5.125에서 누른 기록(hit 없음)은 어느 조건을 보고 눌렀는지 알 수 없어 확인으로 치지 않는다 — 다음 누름부터 풀린다", () => {
    const old: StockLabels = { ...mk({ C: { ...chk({ up: 25 }), checkedAt: "2026-11-10T03:00:00Z" } }, 3),
      reviews: [{ t: "C", at: "2026-11-10T03:00:00Z", from: "check", choice: "same", price: 130, rate: 30 }] };
    expect(pctAckOf(old, "C", old.items.C)).toBeNull();
    expect(by(rows(old), "C").dueReason).toEqual({ kind: "up", pct: 25 });
    const next = press(old, "C", NOW);
    expect(reviewsOf(next, "C").map((x) => x.hit)).toEqual(["up", undefined]); // 옛 기록은 그대로 남는다
    expect(by(rows(next, NOW + DAY), "C").due).toBe(false);
  });
  it("확인으로 치지 않는 기록 — 조건을 고치기 전·지금 이름표를 정하기 전 기록, 바꾸기 기록, 기간 차례 기록", () => {
    const rv = (at: string, o: Record<string, unknown> = {}) => ({ t: "C", at, from: "check" as const, choice: "same" as const, price: 130, rate: 30, hit: "up" as const, ...o });
    const base = mk({ C: chk({ up: 25 }) });
    const due = (reviews: StockLabels["reviews"], items = base.items) => by(rows({ ...base, items, reviews }), "C").due;
    expect(due([rv("2026-10-20T00:00:00Z")])).toBe(false);
    expect(due([rv("2026-10-20T00:00:00Z")], { C: { ...base.items.C, plan: { up: 25, at: "2026-10-25T00:00:00Z" } } })).toBe(true); // 기록 뒤 조건 수정
    expect(due([rv("2026-09-20T00:00:00Z")])).toBe(true); // 이름표를 정하기 전
    expect(due([rv("2026-10-20T00:00:00Z", { choice: "keep" })])).toBe(true);
    expect(due([rv("2026-10-20T00:00:00Z", { hit: "cycle" })])).toBe(true);
    expect(due([rv("2026-10-20T00:00:00Z", { hit: "down" })])).toBe(true); // 방향 다름
  });
  it("기기 경합으로 checkedAt이 져도 기록이 남아 있으면 풀린 채다", () => {
    const l = press(mk({ C: chk({ up: 25 }) }, 3), "C", NOW);
    const { checkedAt: _c, ...item } = l.items.C;
    expect(by(rows({ ...l, items: { C: item } }, NOW + DAY), "C").due).toBe(false);
  });
  it("코인 키(c:)도 같은 판정 — 허브·세그먼트 수(growStatus)와 행 수가 함께 준다", () => {
    const btc = { id: "c1", name: "비트코인", symbol: "BTC", quantity: 0.05, averagePrice: 120_000_000, currentPrice: 140_000_000, purchaseDate: "2025-10-01" } as Crypto;
    const l0 = mk({ "c:BTC": chk({ up: 10 }), C: chk({ up: 25 }) }, 3);
    const boards = (l: StockLabels, now = NOW) => buildGrowBoards({ stocks: STOCKS, crypto: [btc], realEstate: [], physicalAssets: [], transactions: [], cryptoTransactions: [] }, RATES, l, now);
    const coin = buildCryptoRows([btc], l0, NOW)[0];
    expect(coin.dueReason).toEqual({ kind: "up", pct: 10 });
    expect(growStatus(boards(l0)).due).toBe(2);
    const l1 = recordReview(l0, "c:BTC", "same", new Date(NOW).toISOString(), { price: coin.nowPrice!, rate: coin.rate! }, undefined, hitOf(coin.dueReason));
    expect(buildCryptoRows([btc], l1, NOW + DAY)[0].due).toBe(false);
    const b = boards(l1, NOW + DAY);
    expect(growStatus(b).due).toBe(1);
    expect(growStatus(b).due).toBe(countDueRows(b.stock) + countDueRows(b.crypto) + countDueRows(b.own));
    expect(buildCryptoRows([btc], l1, Date.parse("2027-02-18T03:00:00Z"))[0].dueReason).toEqual({ kind: "up", pct: 10 });
  });
});

describe("카드 라벨 행·묶음 안 순서(5차)", () => {
  const STOCKS = [
    st({ id: "k1", purchaseDate: "2023-01-01", currentPrice: 90 }),
    st({ id: "k2", purchaseDate: "2024-01-01", currentPrice: 150 }),
    st({ id: "k3", purchaseDate: "2022-01-01", currentPrice: 120 }),
    st({ id: "c1", purchaseDate: "2025-06-01" }),
    st({ id: "n1", purchaseDate: "2025-01-01" }),
  ];
  const keep = (at: string) => ({ label: "keep" as const, labeledAt: at, at });
  const OLD = "2025-01-01T00:00:00Z";
  const NEW = "2026-06-01T00:00:00Z";
  it("오래 둘은 늘 수익률 꼴(Σ손익 ÷ Σ원가)과 산 날보다 낮은 수, 점검할은 점검 차례 수. 정한 것이 0이면 first", () => {
    const rows = buildBoardRows(STOCKS, RATES, mk({ K1: keep(OLD), K2: keep(NEW), K3: keep(OLD), C1: { label: "check", labeledAt: OLD, at: OLD } }, 3), NOW);
    const s = boardSummary(rows);
    expect(s.keep).toEqual({ count: 3, rate: expect.closeTo(((-10 + 50 + 20) / 300) * 100, 6), low: 1 });
    expect(s.check).toEqual({ count: 1, due: 1 });
    expect(s.first).toBe(false);
    expect(boardSummary(buildBoardRows(STOCKS, RATES, mk(), NOW)).first).toBe(true);
    expect(countDueRows(rows)).toBe(3); // K1·K3 12개월 + C1 주기
  });
  it("점검 차례 → 오래 가진 순. 오래 둘 점검 차례 안에서만 산 날보다 낮은 행 먼저(이분, 크기 순 아님)", () => {
    const rows = buildBoardRows(STOCKS, RATES, mk({ K1: keep(OLD), K2: keep(OLD), K3: keep(NEW) }), NOW);
    const rank = boardRowRank(rows);
    const order = [...rows].sort((a, b) => rank.get(a.key)! - rank.get(b.key)!).map((r) => r.key);
    // 차례: K1(−10%, 낮음) → K2(+50%) / 차례 아님: K3·C1·N1 오래 가진 순
    expect(order).toEqual(["t:K1", "t:K2", "t:K3", "t:N1", "t:C1"]);
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
    // #242: 주식 외 항목(r:·c:)도 정한 날 ≥ 매입·매수일
    const boughtAt = (key: string) => key.startsWith("r:") ? data.realEstate.find((x) => `r:${x.id}` === key)!.purchaseDate
      : key.startsWith("c:") ? data.crypto.find((x) => `c:${x.symbol}` === key)!.purchaseDate
        : data.stocks.find((x) => x.ticker === key)!.purchaseDate!;
    for (const [key, item] of Object.entries(labels.items)) {
      expect(item.labeledAt.slice(0, 10) >= boughtAt(key), key).toBe(true);
    }
  });
  it("분류 캐시 패치: 비어 있는 필드만, 밑줄 키 제외", () => {
    const seed = { _comment: "x", AAPL: { marketCapTier: "large" }, NVDA: { marketCapTier: "large" } };
    const cur = (t: string) => (t === "AAPL" ? { marketCapTier: "mid" as const } : undefined);
    expect(demoClassificationPatches(seed, cur)).toEqual({ NVDA: { marketCapTier: "large" } });
    expect(Object.keys(demoClassificationPatches(raw.xrayClassifications, () => undefined)).sort()).toEqual(["000660", "005930", "AAPL", "NVDA"]);
  });
});
