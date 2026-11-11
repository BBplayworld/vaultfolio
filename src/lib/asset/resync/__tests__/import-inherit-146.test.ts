// #146(4.77) 스크린샷 첫 등록 — 새 종목 매수일 일괄 입력 + `교체`·`초기화 후 등록` 이어받기, 맞추기 새 종목 매수일.
import { describe, expect, it } from "vitest";
import {
  applyResync, inheritedPreds, resyncInflowDate, stocksToCrypto, cryptoToStock,
  parsedCryptoToRaw, matchExchangeHint, resolveScreens, computeDiff, mergeScreens,
} from "..";
import { defaultNewPurchaseDate, freshImportCount, isValidNewPurchaseDate, kstTodayString, pairCryptoImport, pairStockImport, planCryptoImport, planStockImport } from "@/lib/asset/import-inherit";
import { computeDividendYield } from "@/lib/finance/dividend-yield";
import { resolveKept, keyOfStock } from "@/lib/asset/holdings-conflict";
import { assetDataSchema, cryptoSchema, stockSchema } from "@/types/asset";
import type { Crypto, Stock } from "@/types/asset";
import { row, run, screen, st, TODAY } from "./fixtures";

const JAN1 = "2026-01-01";
const MS = Date.UTC(2026, 10, 8, 3, 0, 0); // 2026-11-08 12:00 KST
const imp = (n: number, ticker: string, category: Stock["category"], broker: string | undefined, qty = 5, avg = 100, extra: Partial<Stock> = {}): Stock => ({
  ...st(`stock_import_${MS}_${n}`, ticker, category, broker, qty, avg, { purchaseDate: "2026-11-08", description: "", ...extra }),
});
const cr = (id: string, symbol: string, exchange: string, qty = 1, extra: Partial<Crypto> = {}): Crypto => ({
  id, name: symbol, symbol, quantity: qty, averagePrice: 100, currentPrice: 110, purchaseDate: "2025-02-02", description: `메모${id}`, exchange, ...extra,
});

describe("날짜 유틸", () => {
  it("기본값 = KST 올해 1월 1일, 빈 값·형식 오류·오늘 이후는 불가", () => {
    expect(defaultNewPurchaseDate("2026-11-08")).toBe(JAN1);
    expect(kstTodayString(Date.UTC(2026, 11, 31, 16, 0, 0))).toBe("2027-01-01"); // KST 자정 넘김
    expect(isValidNewPurchaseDate("2026-11-08", "2026-11-08")).toBe(true);
    expect(isValidNewPurchaseDate("2025-06-02", "2026-11-08")).toBe(true);
    expect(isValidNewPurchaseDate("2026-11-09", "2026-11-08")).toBe(false);
    expect(isValidNewPurchaseDate("", "2026-11-08")).toBe(false);
    expect(isValidNewPurchaseDate("2026-1-1", "2026-11-08")).toBe(false);
  });
});

describe("맞추기 — 새 종목 매수일 일괄 입력", () => {
  const existing = [st("k", "005930", "domestic", "토스증권", 10, 70000, { purchaseDate: "2024-05-05" })];
  const screens = [screen(0, [row("005930", 11, 71000, { brokerHint: "토스증권" }), row("000660", 3, 100000, { brokerHint: "토스증권" }), row("AAPL", 2, 150, { brokerHint: "토스증권" })])];

  it("입력값이 새 항목 전부에 들어가고 연결 종목 매수일은 그대로", () => {
    const r = run(existing, screens, { sel: () => ({ purchaseDate: "2025-06-02" }) });
    const added = r.result.stocks.filter((s) => r.result.addedIds.includes(s.id));
    expect(added).toHaveLength(2);
    expect(added.every((s) => s.purchaseDate === "2025-06-02")).toBe(true);
    expect(r.result.stocks.find((s) => s.id === "k")!.purchaseDate).toBe("2024-05-05");
  });
  it("입력 없음 = 올해 1월 1일(main과 동일)", () => {
    const r = run(existing, screens);
    expect(r.result.stocks.filter((s) => r.result.addedIds.includes(s.id)).every((s) => s.purchaseDate === JAN1)).toBe(true);
  });
  it("이어받은 항목에는 입력값을 쓰지 않는다(기존 매수일 유지)", () => {
    const a = st("a", "005930", "isa", "", 10, 70000, { purchaseDate: "2024-01-05" });
    const r = run([a], [screen(0, [row("005930", 12, 71000, { brokerHint: "토스증권" })])], { sel: () => ({ remove: new Set(["a"]), purchaseDate: "2025-06-02" }) });
    expect(inheritedPreds(r.diff, r.sel, [a]).size).toBe(1);
    expect(r.result.stocks).toHaveLength(1);
    expect(r.result.stocks[0].purchaseDate).toBe("2024-01-05");
  });
  it("코인 신규도 같은 입력값, 어댑터 왕복에서 값 유지", () => {
    const coins: Crypto[] = [];
    const adapted = coins.map(cryptoToStock);
    const raw = parsedCryptoToRaw({ name: "비트", symbol: "BTC", quantity: 1, averagePrice: 1000, currentPrice: 1000, exchange: "업비트", currency: "KRW" }, 1400);
    const resolved = resolveScreens([screen(0, [raw])], adapted, { usdRate: 1400, matchHint: matchExchangeHint });
    const diff = computeDiff(adapted, mergeScreens(resolved), resolved);
    const sel = { include: new Set<string>(), remove: new Set<string>(), pick: {}, qty: {}, ticker: {}, purchaseDate: "2025-06-02" };
    const r = { result: applyResync(adapted, diff, sel, { today: TODAY, usdRate: 1400, now: 1_700_000_000_000 }) };
    const out = stocksToCrypto(coins, adapted, r.result.stocks);
    expect(out).toHaveLength(1);
    expect(out[0].purchaseDate).toBe("2025-06-02");
    expect(cryptoSchema.safeParse(out[0]).success).toBe(true);
  });
});

describe("첫 등록 주식 — 이어받기(교체·초기화 후 등록)", () => {
  const old = st("old1", "AAPL", "foreign", "토스증권", 3, 120, { purchaseDate: "2024-03-04", purchaseExchangeRate: 1250, description: "메모" });
  const other = st("o2", "MSFT", "foreign", "토스증권", 2, 300);

  it("교체(merge): id·매수일·매입 환율·메모 유지, 수량·평단·증권사·계좌 = 화면 값, manual·오늘", () => {
    const incoming = [imp(0, "AAPL", "foreign", "키움증권", 7, 150, { purchaseExchangeRate: 1400, description: "" })];
    const plan = planStockImport([old, other], incoming, "merge", "2025-06-02", TODAY);
    expect(plan.inherited).toBe(1);
    expect(plan.fresh).toBe(0);
    const a = plan.items.find((s) => s.ticker === "AAPL")!;
    expect(a).toMatchObject({ id: "old1", purchaseDate: "2024-03-04", purchaseExchangeRate: 1250, description: "메모", quantity: 7, averagePrice: 150, broker: "키움증권", category: "foreign", positionSource: "manual", positionEffectiveDate: TODAY });
    expect(plan.items.find((s) => s.id === "o2")).toBe(other); // 겹치지 않는 기존은 그대로
    expect(plan.items.some((s) => s.id.startsWith("stock_import_"))).toBe(false);
  });
  it("초기화 후 등록(reset): 이어받은 것만 남고 화면에 없는 기존 항목은 삭제", () => {
    const incoming = [imp(0, "AAPL", "foreign", "키움증권", 7, 150)];
    const plan = planStockImport([old, other], incoming, "reset", "2025-06-02", TODAY);
    expect(plan.items.map((s) => s.id)).toEqual(["old1"]);
  });
  it("혼합: 이어받기 + 신규 → 신규만 입력 매수일, 건수 정합", () => {
    const incoming = [imp(0, "AAPL", "foreign", "토스증권", 7, 150), imp(1, "NVDA", "foreign", "토스증권", 1, 100)];
    const plan = planStockImport([old], incoming, "merge", "2025-06-02", TODAY);
    expect(plan).toMatchObject({ inherited: 1, fresh: 1 });
    expect(plan.items.find((s) => s.ticker === "NVDA")).toMatchObject({ id: `stock_import_${MS}_1`, purchaseDate: "2025-06-02" });
    expect(freshImportCount(incoming, pairStockImport([old], incoming))).toBe(1);
  });
  it("같은 키 기존 2개·화면 1행 → 증권사 같은 것을 잇고 나머지는 삭제(C3)", () => {
    const k = st("k", "005930", "domestic", "키움증권", 5, 60000, { purchaseDate: "2024-01-05" });
    const t = st("t", "005930", "domestic", "토스증권", 5, 60000, { purchaseDate: "2023-01-05" });
    const plan = planStockImport([k, t], [imp(0, "005930", "domestic", "키움증권")], "merge", JAN1, TODAY);
    expect(plan.items.map((s) => s.id)).toEqual(["k"]);
    // 증권사가 모두 다르면 매수일 이른 것
    const plan2 = planStockImport([k, t], [imp(0, "005930", "domestic", "미래에셋증권")], "merge", JAN1, TODAY);
    expect(plan2.items.map((s) => s.id)).toEqual(["t"]);
  });
  it("같은 키 화면 행이 기존보다 많으면 남는 행은 신규", () => {
    const k = st("k", "005930", "domestic", "키움증권", 5, 60000);
    const plan = planStockImport([k], [imp(0, "005930", "domestic", "키움증권"), imp(1, "005930", "domestic", "토스증권")], "merge", "2025-06-02", TODAY);
    expect(plan).toMatchObject({ inherited: 1, fresh: 1 });
    expect(plan.items.map((s) => s.id)).toEqual(["k", `stock_import_${MS}_1`]);
    expect(plan.items[1].purchaseDate).toBe("2025-06-02");
  });
  it("티커 없는 행은 이어받지 않는다", () => {
    const e = st("e", "", "domestic", "토스증권", 1, 1);
    expect(pairStockImport([e], [imp(0, "", "domestic", "토스증권")]).size).toBe(0);
  });
  it("C1: resolveKept는 그대로 — 현금·대출 공용 결과 불변", () => {
    const ex = [{ k: "a" }, { k: "b" }];
    expect(resolveKept(ex, new Set(["a"]), "merge", (x) => x.k)).toEqual([{ k: "b" }]);
    expect(resolveKept(ex, new Set(["a"]), "reset", (x) => x.k)).toEqual([]);
    expect(keyOfStock({ ticker: "AAPL", category: "foreign" })).toBe("AAPL:foreign");
  });
  it("결과가 Stock 스키마·앱 데이터 스키마를 만족한다(저장 키 ⊆ 기존 필드)", () => {
    const plan = planStockImport([old], [imp(0, "AAPL", "foreign", "키움증권", 7, 150), imp(1, "NVDA", "foreign", "키움증권", 1, 100)], "merge", "2025-06-02", TODAY);
    for (const s of plan.items) expect(stockSchema.safeParse(s).success).toBe(true);
    const base = { realEstate: [], stocks: plan.items, crypto: [], cash: [], loans: [], yearlyNetAssets: [], transactions: [], cashTransactions: [], loanTransactions: [], cryptoTransactions: [], lastUpdated: "x", nickname: "" };
    expect(assetDataSchema.safeParse(base).success).toBe(true);
  });
});

describe("첫 등록 코인 — 이어받기", () => {
  it("교체: id·매수일·메모 유지, 수량·평단·거래소 = 화면 값, 새 코인은 입력 매수일", () => {
    const old = cr("c_old", "BTC", "업비트", 1);
    const incoming = [cr(`crypto_import_${MS}_0`, "BTC", "업비트", 2, { averagePrice: 200, purchaseDate: "2026-11-08", description: "" }), cr(`crypto_import_${MS}_1`, "ETH", "업비트", 3, { purchaseDate: "2026-11-08", description: "" })];
    const plan = planCryptoImport([old], incoming, "merge", "2025-06-02", TODAY);
    expect(plan).toMatchObject({ inherited: 1, fresh: 1 });
    expect(plan.items[0]).toMatchObject({ id: "c_old", purchaseDate: "2025-02-02", description: "메모c_old", quantity: 2, averagePrice: 200, exchange: "업비트", positionSource: "manual", positionEffectiveDate: TODAY });
    expect(plan.items[1]).toMatchObject({ id: `crypto_import_${MS}_1`, purchaseDate: "2025-06-02" });
    for (const c of plan.items) expect(cryptoSchema.safeParse(c).success).toBe(true);
  });
  it("초기화 후 등록: 이어받지 않은 기존만 삭제", () => {
    const a = cr("a", "BTC", "업비트");
    const b = cr("b", "XRP", "업비트");
    const plan = planCryptoImport([a, b], [cr(`crypto_import_${MS}_0`, "BTC", "업비트", 2)], "reset", JAN1, TODAY);
    expect(plan.items.map((c) => c.id)).toEqual(["a"]);
    expect(pairCryptoImport([a, b], [cr("x", "BTC", "빗썸")]).size).toBe(0); // 거래소 다르면 다른 키
  });
});

describe("결산 예측 투입일 (d') — 첫 등록 신규", () => {
  it("기본값(만든 해 1월 1일) 그대로 저장 → 투입일 = 만든 날(main과 동일), 주식·코인 모두", () => {
    const plan = planStockImport([], [imp(0, "AAPL", "foreign", "토스증권")], "merge", defaultNewPurchaseDate("2026-11-08"), "2026-11-08");
    expect(plan.items[0].purchaseDate).toBe(JAN1);
    expect(resyncInflowDate(plan.items[0])).toBe("2026-11-08");
    const cp = planCryptoImport([], [cr(`crypto_import_${MS}_0`, "BTC", "업비트")], "merge", JAN1, "2026-11-08");
    expect(resyncInflowDate(cp.items[0])).toBe("2026-11-08");
  });
  it("사용자가 바꾼 날짜는 그 날 투입(의도된 차이)", () => {
    const plan = planStockImport([], [imp(0, "AAPL", "foreign", "토스증권")], "merge", "2025-06-02", "2026-11-08");
    expect(resyncInflowDate(plan.items[0])).toBe("2025-06-02");
  });
  it("이어받은 기존 항목은 purchaseDate 그대로", () => {
    const old = st("stock_import_1700000000000_0", "AAPL", "foreign", "토스증권", 1, 1, { purchaseDate: "2024-03-04" });
    const plan = planStockImport([old], [imp(0, "AAPL", "foreign", "토스증권")], "merge", "2025-06-02", TODAY);
    expect(plan.items[0].id).toBe(old.id);
    expect(resyncInflowDate(plan.items[0])).toBe("2024-03-04");
  });
});

describe("배당 — 새 종목 매수일 입력이 올해 지급 예상에 반영", () => {
  const PAYOUTS = [{ payoutDate: "2026-04-15", amountPerShare: 10 }, { payoutDate: "2026-08-15", amountPerShare: 10 }];
  const paid = (s: Stock) => Math.round((computeDividendYield([{ stock: { ...s, averagePrice: 1 / s.quantity }, payouts: PAYOUTS as never }], 1400, "actual", "2026-11")?.pct ?? 0) / 100);
  it("기본 1/1 → 올해 2회 모두, 6/2 → 6/2 이전 지급분 제외", () => {
    const base = imp(0, "005930", "domestic", "토스증권", 1, 100);
    expect(paid(planStockImport([], [base], "merge", JAN1, "2026-11-08").items[0])).toBe(20);
    expect(paid(planStockImport([], [base], "merge", "2026-06-02", "2026-11-08").items[0])).toBe(10);
  });
});
