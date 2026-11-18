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
import { parseStockLabels, type StockLabels } from "../asset/stock-labels";
import {
  BOARD_AXES, HOLD_SCORE_BANDS, SCORE_MIN_DAYS, annualizedPct, boardScale, boardTotal, buildAxisGroups, buildBoardRows, holdScore, scalePos,
  boardRowRank, boardSummary, countDueRows, dueReasonText, monthDayText,
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

describe("점검 차례(5차) — 점검할 조건·기간, 오래 둘 12개월, 기준일에 '그대로 둠' 기록", () => {
  const STOCKS = [st({ id: "a" }), st({ id: "b", currentPrice: 80 }), st({ id: "c", currentPrice: 130 })];
  const rows = (l: StockLabels, now = NOW) => buildBoardRows(STOCKS, RATES, l, now);
  const by = (rs: ReturnType<typeof rows>, t: string) => rs.find((r) => r.labelKey === t)!;
  const chk = (o: Partial<StockLabels["items"][string]> = {}) => ({ label: "check" as const, labeledAt: "2026-10-01T00:00:00Z", at: "2026-10-01T00:00:00Z", ...o });
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
    expect(dueReasonText({ kind: "date", months: 3 })).toBe("정한 기간 3개월이 지났어요");
    expect(by(rows(mk({ B: chk({ plan: { down: 21 } }) })), "B").due).toBe(false); // −20.0% > −21%
  });
  it("오래 둘은 기준일 + 12개월에 차례, 사용자 주기(3개월)는 쓰지 않는다", () => {
    const keep = (labeledAt: string, checkedAt?: string) => mk({ A: { label: "keep", labeledAt, ...(checkedAt ? { checkedAt } : {}), at: labeledAt } }, 3);
    expect(by(rows(keep("2025-11-18T00:00:00Z")), "A").dueReason).toEqual({ kind: "date", months: 12 });
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
