// #139 보유 현황 업데이트(맞추기) 후 매수일·거래 기록·올해 배당 보존.
// 원인: 매칭 실패로 '추가'가 된 행이 같은 종목의 기존 항목 '삭제'와 함께 적용되면 새 id·오늘 매수일로 다시 만들어져
// 거래 기록(stockId)이 끊기고 매수일 이전 배당이 빠졌다. 정말 새 종목의 매수일은 올해 1월 1일(대표 결정 11-10).
import { describe, expect, it } from "vitest";
import {
  applyResync, buildUndoEntries, computeDiff, cryptoToStock, defaultRemoveIds, matchExchangeHint, mergeScreens,
  parsedCryptoToRaw, planUndo, resolveScreens, resyncInflowDate, resyncNewPurchaseDate, stocksToCrypto,
} from "..";
import { computeDividendYield } from "@/lib/finance/dividend-yield";
import { assetDataSchema, stockSchema } from "@/types/asset";
import type { AssetData, Crypto, Stock } from "@/types/asset";
import type { Transaction } from "@/types/transaction";
import { emptySel, row, run, screen, st, TODAY, USD } from "./fixtures";

const JAN1 = "2026-01-01";
const tx = (id: string, stockId: string, ticker: string, date: string): Transaction => ({
  id, stockId, ticker, stockName: ticker, type: "buy", quantity: 1, price: 100, currency: "KRW", date, reflected: true, createdAt: `${date}T00:00:00Z`,
});
const data = (stocks: Stock[], transactions: Transaction[] = []): AssetData => ({
  realEstate: [], stocks, crypto: [], cash: [], loans: [], yearlyNetAssets: [],
  transactions, cashTransactions: [], loanTransactions: [], cryptoTransactions: [], lastUpdated: "x", nickname: "",
});
// 올해 배당(지급 완료분) — 배당 탭과 같은 '매수일 이전 지급 제외' 필터를 쓰는 순수 함수로 확인
const PAYOUTS = [
  { payoutDate: "2026-04-15", amountPerShare: 10 },
  { payoutDate: "2026-08-15", amountPerShare: 10 },
];
const paidThisYear = (s: Stock) => {
  // 분자만 보려고 분모(평단×수량)를 1로 둔다
  const r = computeDividendYield([{ stock: { ...s, averagePrice: 1 / s.quantity }, payouts: PAYOUTS as never }], USD, "actual", "2026-11");
  return r ? Math.round((r.pct / 100) * (s.currency === "USD" ? USD : 1)) : 0;
};
const linked = (stocks: Stock[], txs: Transaction[]) => txs.every((t) => stocks.some((s) => s.id === t.stockId));

describe("기존 종목 — 매칭 성공(변경)", () => {
  it("수량·평단만 바뀌고 id·매수일·매입 환율·메모 유지, 거래 연결·올해 배당 유지", () => {
    const a = st("a", "005930", "domestic", "토스증권", 10, 70000);
    const txs = [tx("t1", "a", "005930", "2025-03-02"), tx("t2", "a", "005930", "2026-02-01")];
    const { result, diff } = run([a], [screen(0, [row("005930", 12, 71000, { brokerHint: "토스증권" })])]);
    expect(diff.rows[0].status).toBe("change");
    const n = result.stocks[0];
    expect(n).toMatchObject({ id: "a", purchaseDate: "2025-03-02", description: "메모a", quantity: 12, averagePrice: 71000, positionEffectiveDate: TODAY });
    expect(linked(result.stocks, txs)).toBe(true);
    expect(paidThisYear(n)).toBe(20 * 12);
  });
});

describe("기존 종목 — 매칭 실패로 추가+삭제(원인 경로)", () => {
  it("해외 티커 미인식(이름 다름) → 티커 입력 추가 + 기본 삭제: 새로 만들지 않고 기존 기록을 이어받는다", () => {
    const a = st("a", "AAPL", "foreign", "토스증권", 10, 150, { purchaseDate: "2025-03-02", purchaseExchangeRate: 1300 });
    const b = st("b", "MSFT", "foreign", "토스증권", 1, 300);
    const c = st("c", "NVDA", "foreign", "토스증권", 1, 100);
    const txs = [tx("t1", "a", "AAPL", "2025-03-02"), tx("t2", "a", "AAPL", "2025-09-01")];
    const { result, diff, sel } = run(
      [a, b, c],
      [screen(0, [row("", 12, 151, { name: "애플", section: "해외", category: "foreign", brokerHint: "토스증권" }), row("MSFT", 1, 300, { brokerHint: "토스증권" }), row("NVDA", 1, 100, { brokerHint: "토스증권" })])],
      { sel: (d) => ({ include: new Set([d.rows[0].rowId]), ticker: { [d.rows[0].rowId]: "AAPL" } }) },
    );
    // 미리보기는 '추가 1 · 삭제 1'(기본 삭제 체크) — 대표가 겪은 일괄 맞추기 경로
    expect(diff.rows[0].reasons).toContain("tickerMissing");
    expect(sel.remove.has("a")).toBe(true);
    const n = result.stocks.find((s) => s.ticker === "AAPL")!;
    expect(result.stocks.filter((s) => s.ticker === "AAPL")).toHaveLength(1);
    expect(n).toMatchObject({ id: "a", purchaseDate: "2025-03-02", purchaseExchangeRate: 1300, description: "메모a", name: "이름AAPL", quantity: 12, averagePrice: 151, positionSource: "manual", positionEffectiveDate: TODAY });
    expect(result.stocks.map((s) => s.id)).toEqual(["a", "b", "c"]); // 제자리 유지, 새 id 없음
    expect(result.addedIds).toEqual([]);
    expect(linked(result.stocks, txs)).toBe(true);
    expect(paidThisYear(n)).toBe(Math.round(20 * 12 * USD));
  });

  it("증권사 미지정 ISA 기존 + 일반 계좌로 추정된 화면 → 유지 묶음에서 삭제 체크하면 이어받고 계좌·증권사는 화면 값", () => {
    const a = st("a", "005930", "isa", "", 10, 70000);
    const { result, diff } = run([a], [screen(0, [row("005930", 12, 71000, { brokerHint: "토스증권" })])], { sel: () => ({ remove: new Set(["a"]) }) });
    expect(diff.rows[0].status).toBe("add");
    expect(diff.kept.map((k) => k.id)).toEqual(["a"]);
    expect(result.stocks).toEqual([{ ...a, category: "domestic", broker: "토스증권", quantity: 12, averagePrice: 71000, positionSource: "manual", positionEffectiveDate: TODAY }]);
  });

  it("기존 항목을 지우지 않으면(유지) 이어받지 않는다 — 새 항목은 올해 1월 1일, 기존은 그대로", () => {
    const a = st("a", "005930", "isa", "", 10, 70000);
    const { result } = run([a], [screen(0, [row("005930", 12, 71000, { brokerHint: "토스증권" })])]);
    expect(result.stocks[0]).toBe(a);
    expect(result.stocks[1]).toMatchObject({ purchaseDate: JAN1, positionEffectiveDate: TODAY });
  });

  it("같은 티커 삭제 후보가 둘이면 증권사 같은 쪽을 잇고, 나머지는 삭제된다", () => {
    const k = st("k", "005930", "domestic", "키움증권", 5, 60000, { purchaseDate: "2024-01-05" });
    const t = st("t", "005930", "domestic", "토스증권", 5, 60000, { purchaseDate: "2025-06-01" });
    const diff0 = run([k, t], [screen(0, [row("005930", 7, 61000, { brokerHint: "토스증권" })])]).diff;
    expect(diff0.rows[0].status).toBe("change"); // 증권사 같으면 원래 연결 — 삭제·추가가 아님
    // 연결 실패 상황: 둘 다 다른 장 증권사 → 삭제 체크
    const { result } = run([k, t], [screen(0, [row("005930", 7, 61000, { brokerHint: "미래에셋증권" })])], { sel: () => ({ remove: new Set(["k", "t"]) }) });
    expect(result.stocks).toHaveLength(1);
    expect(result.stocks[0]).toMatchObject({ id: "k", purchaseDate: "2024-01-05", broker: "미래에셋증권", quantity: 7 });
  });

  it("같은 티커 추가 행 2개·삭제 1개 → 하나만 잇고 다른 하나는 새 항목(1월 1일)", () => {
    const a = st("a", "005930", "domestic", "키움증권", 5, 60000);
    const { result } = run(
      [a],
      [screen(0, [row("005930", 3, 61000, { brokerHint: "토스증권" })]), screen(1, [row("005930", 4, 62000, { brokerHint: "미래에셋증권" })])],
      { sel: () => ({ remove: new Set(["a"]) }) },
    );
    expect(result.stocks.map((s) => [s.id, s.purchaseDate, s.quantity])).toEqual([["a", "2025-03-02", 3], [expect.stringMatching(/^stock_import_/), JAN1, 4]]);
  });

  it("해외↔국내 다른 시장은 잇지 않는다", () => {
    const a = st("a", "AAPL", "foreign", "키움증권", 5, 100);
    const { result } = run([a], [screen(0, [row("AAPL", 5, 100, { brokerHint: "토스증권", section: "국내", category: "domestic" })])], { sel: () => ({ remove: new Set(["a"]) }) });
    expect(result.stocks.map((s) => s.id)).toEqual([expect.stringMatching(/^stock_import_/)]);
  });
});

describe("새 종목 — 매수일 기본값 올해 1월 1일(대표 결정)", () => {
  it("purchaseDate=올해 1월 1일, positionEffectiveDate=오늘, 해외 매입 환율=입력/오늘 환율 그대로", () => {
    const a = st("a", "005930", "domestic", "토스증권", 10, 70000);
    const { result } = run([a], [screen(0, [row("005930", 10, 70000, { brokerHint: "토스증권" }), row("TSLA", 2, 200, { brokerHint: "토스증권" })])]);
    const n = result.stocks[1];
    expect(n).toMatchObject({ purchaseDate: JAN1, positionSource: "manual", positionEffectiveDate: TODAY, purchaseExchangeRate: USD });
    // 올해 지급분(4월·8월) 모두 포함
    expect(paidThisYear(n)).toBe(Math.round(20 * 2 * USD));
    // 수정 전(매수일=오늘)이면 올해 지급분이 모두 빠졌다
    expect(paidThisYear({ ...n, purchaseDate: TODAY })).toBe(0);
  });
  it("resyncNewPurchaseDate는 KST 오늘의 연도 1월 1일", () => {
    expect(resyncNewPurchaseDate("2026-11-10")).toBe("2026-01-01");
    expect(resyncNewPurchaseDate("2027-01-01")).toBe("2027-01-01");
  });
});

describe("수량 0(화면에 없음 = 전량)", () => {
  it("삭제 후보로만 처리되고 다른 종목이 그 기록을 잇지 않는다", () => {
    const a = st("a", "005930", "domestic", "토스증권", 10, 1);
    const b = st("b", "000660", "domestic", "토스증권", 10, 1);
    const c = st("c", "035420", "domestic", "토스증권", 10, 1);
    const { result } = run([a, b, c], [screen(0, [row("005930", 10, 1, { brokerHint: "토스증권" }), row("000660", 10, 1, { brokerHint: "토스증권" }), row("051910", 1, 1, { brokerHint: "토스증권" })])]);
    expect(result.stocks.map((s) => s.id)).toEqual(["a", "b", expect.stringMatching(/^stock_import_/)]);
    expect(result.stocks[2].purchaseDate).toBe(JAN1);
  });
});

describe("코인 — 같은 규칙", () => {
  const co = (id: string, symbol: string, exchange: string, quantity: number): Crypto => ({
    id, name: `코인${symbol}`, symbol, quantity, averagePrice: 100, currentPrice: 100, purchaseDate: "2025-04-04", description: `메모${id}`, exchange,
  });
  const raw = (symbol: string, quantity: number, exchange: string) =>
    parsedCryptoToRaw({ name: `코인${symbol}`, symbol, quantity, averagePrice: 100, currentPrice: 100, exchange, currency: "KRW" }, 1400);
  it("거래소가 바뀌어 지우고 다시 들어오면 이어받고(매수일 유지), 새 코인은 1월 1일", () => {
    const ex = [co("a", "BTC", "업비트", 1)];
    const adapted = ex.map(cryptoToStock);
    const screens = [{ index: 0, status: "ok" as const, items: [raw("BTC", 2, "빗썸"), raw("SOL", 3, "빗썸")] }];
    const resolved = resolveScreens(screens, adapted, { usdRate: 1400, matchHint: matchExchangeHint });
    const diff = computeDiff(adapted, mergeScreens(resolved), resolved);
    const sel = { ...emptySel(), remove: new Set(["a"]) };
    const result = applyResync(adapted, diff, sel, { today: TODAY, usdRate: 1400, now: 5 });
    const coins = stocksToCrypto(ex, adapted, result.stocks);
    expect(coins[0]).toEqual({ ...ex[0], quantity: 2, exchange: "빗썸", positionSource: "manual", positionEffectiveDate: TODAY });
    expect(coins[1]).toMatchObject({ symbol: "SOL", purchaseDate: JAN1 });
  });
});

describe("데이터 안전", () => {
  const setup = () => {
    const a = st("a", "AAPL", "foreign", "토스증권", 10, 150);
    const b = st("b", "MSFT", "foreign", "토스증권", 1, 300);
    const c = st("c", "NVDA", "foreign", "토스증권", 1, 100);
    const ex = [a, b, c];
    const r = run(ex, [screen(0, [row("", 12, 151, { name: "애플", section: "해외", category: "foreign", brokerHint: "토스증권" }), row("MSFT", 1, 300, { brokerHint: "토스증권" }), row("NVDA", 1, 100, { brokerHint: "토스증권" }), row("TSLA", 2, 200, { brokerHint: "토스증권" })])],
      { sel: (d) => ({ include: new Set([d.rows[0].rowId]), ticker: { [d.rows[0].rowId]: "AAPL" } }) });
    return { ex, ...r };
  };

  it("저장 스키마 변경 0 — 결과 항목 키는 기존 Stock 필드뿐이고 현행 스키마를 통과한다(구버전 기기 호환)", () => {
    const { result } = setup();
    const known = new Set(Object.keys(stockSchema.innerType().shape));
    for (const s of result.stocks) {
      expect(Object.keys(s).every((k) => known.has(k))).toBe(true);
      expect(stockSchema.safeParse(s).success).toBe(true);
    }
  });

  it("백업·동기화 왕복(JSON → assetDataSchema) 후 매수일·id·거래 연결 손실 0", () => {
    const { result } = setup();
    const txs = [tx("t1", "a", "AAPL", "2025-03-02")];
    const back = assetDataSchema.parse(JSON.parse(JSON.stringify(data(result.stocks, txs))));
    expect(back.stocks.find((s) => s.id === "a")?.purchaseDate).toBe("2025-03-02");
    expect(back.stocks.find((s) => s.ticker === "TSLA")?.purchaseDate).toBe(JAN1);
    expect(back.transactions).toEqual(txs);
    expect(linked(back.stocks, back.transactions)).toBe(true);
  });

  it("되돌리기 — 이어받은 항목은 '변경'으로 기록되어 되돌리면 맞추기 전과 같다", () => {
    const { ex, result } = setup();
    const entries = buildUndoEntries(ex, result.stocks);
    expect(entries.find((e) => e.key === "stocks:a")?.kind).toBe("modified");
    const u = planUndo(entries, data(result.stocks));
    expect(u.data.stocks).toEqual(ex);
  });
});

describe("결산 예측 투입일 resyncInflowDate(#139 qa D1)", () => {
  const at = (date: string) => Date.parse(`${date}T03:00:00Z`); // KST 정오
  const base = (id: string, purchaseDate: string) => ({ id, purchaseDate });
  it("맞추기로 새로 만든 항목(매수일 기본값 그대로) → 만든 날(KST)", () => {
    const ex = [st("a", "005930", "domestic", "토스증권", 1, 1)];
    const r = applyResync(ex, run(ex, [screen(0, [row("005930", 1, 1, { brokerHint: "토스증권" }), row("000660", 1, 1, { brokerHint: "토스증권" })])]).diff, { ...emptySel() }, { today: "2026-11-10", usdRate: USD, now: at("2026-11-10") });
    const n = r.stocks.find((s) => s.ticker === "000660")!;
    expect(n.purchaseDate).toBe("2026-01-01");
    expect(resyncInflowDate(n)).toBe("2026-11-10");
    // KST 자정 직후(UTC 전날)도 KST 날짜
    expect(resyncInflowDate(base(`stock_import_${Date.parse("2026-11-09T15:30:00Z")}_0`, "2026-01-01"))).toBe("2026-11-10");
  });
  it("이어받은 기존 항목·직접 등록·첫 등록·매수일을 고친 항목에는 걸리지 않는다", () => {
    // 이어받기: 원래 id·원래 매수일
    expect(resyncInflowDate(base("a", "2025-03-02"))).toBe("2025-03-02");
    // 이어받은 옛 첫 등록 항목(id 만든 날 3월, 매수일 = 만든 날)
    expect(resyncInflowDate(base(`stock_import_${at("2026-03-05")}_0`, "2026-03-05"))).toBe("2026-03-05");
    // 1월 1일에 만든 항목(매수일 = 만든 날)
    expect(resyncInflowDate(base(`stock_import_${at("2026-01-01")}_0`, "2026-01-01"))).toBe("2026-01-01");
    // 사용자가 매수일을 고친 새 항목
    expect(resyncInflowDate(base(`stock_import_${at("2026-11-10")}_0`, "2025-06-01"))).toBe("2025-06-01");
    // 수정 전 맞추기 항목(매수일 = 만든 날)
    expect(resyncInflowDate(base(`stock_import_${at("2026-11-08")}_1`, "2026-11-08"))).toBe("2026-11-08");
    // 코인 첫 등록 id
    expect(resyncInflowDate(base(`crypto_import_${at("2026-11-10")}_0`, "2026-11-10"))).toBe("2026-11-10");
    expect(resyncInflowDate(base("1730000000000", "2026-01-01"))).toBe("2026-01-01");
  });
  it("직접 등록 신규 종목(stock_<ms>, 기본값 1월 1일)도 만든 날 투입(#142)", () => {
    expect(resyncInflowDate(base(`stock_${at("2026-11-10")}`, "2026-01-01"))).toBe("2026-11-10");
    // 매수일을 고쳤거나 1월 1일 당일 등록이면 그대로
    expect(resyncInflowDate(base(`stock_${at("2026-11-10")}`, "2025-06-01"))).toBe("2025-06-01");
    expect(resyncInflowDate(base(`stock_${at("2026-01-01")}`, "2026-01-01"))).toBe("2026-01-01");
  });
  it("이어받기 결과 항목은 매수일 그대로(판별 미해당)", () => {
    const a = st("a", "005930", "isa", "", 10, 70000);
    const { result } = run([a], [screen(0, [row("005930", 12, 71000, { brokerHint: "토스증권" })])], { sel: () => ({ remove: new Set(["a"]) }) });
    expect(resyncInflowDate(result.stocks[0])).toBe("2025-03-02");
  });
});
