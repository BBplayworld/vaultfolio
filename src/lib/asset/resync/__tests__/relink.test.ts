// #147(4.77) 맞추기로 끊긴 거래 다시 잇기 — 감지(ⓐ~ⓛ)·적용·멱등·되돌리기·4.76 데이터 하위호환.
import { describe, expect, it } from "vitest";
import { applyRelink, buildUndoEntries, detectRelink, planUndo, relinkTotalCount, resyncInflowDate, type RelinkRow } from "..";
import { rollbackTransaction } from "@/lib/trade/trade-utils";
import { assetDataSchema } from "@/types/asset";
import type { AssetData, Crypto, Stock } from "@/types/asset";
import type { CryptoTransaction, Transaction } from "@/types/transaction";
import qaFixture from "./fixtures/relink-4.77-qa.json";

const MS = Date.UTC(2026, 9, 20, 3); // 만든 날 2026-10-20 (KST)
const CREATED = "2026-10-20";
const sid = (n = 0, ms = MS) => `stock_import_${ms}_${n}`;

const S = (id: string, ticker: string, qty: number, extra: Partial<Stock> = {}): Stock => ({
  id, category: "domestic", name: `이름${ticker}`, ticker, quantity: qty, averagePrice: 100, currentPrice: 100, currency: "KRW",
  purchaseDate: CREATED, description: "", broker: "토스증권", positionSource: "manual", positionEffectiveDate: CREATED, ...extra,
});
const F = (id: string, ticker: string, qty: number, extra: Partial<Stock> = {}): Stock => S(id, ticker, qty, { category: "foreign", currency: "USD", purchaseExchangeRate: 1380, ...extra });
const T = (id: string, stockId: string, ticker: string, type: "buy" | "sell", quantity: number, date: string, extra: Partial<Transaction> = {}): Transaction => ({
  id, stockId, ticker, stockName: ticker, type, quantity, price: 100, currency: "KRW", date, reflected: true, createdAt: `${date}T00:00:00Z`, ...extra,
});
const C = (id: string, symbol: string, qty: number, extra: Partial<Crypto> = {}): Crypto => ({
  id, name: symbol, symbol, quantity: qty, averagePrice: 100, currentPrice: 100, purchaseDate: CREATED, exchange: "업비트", description: "",
  positionSource: "manual", positionEffectiveDate: CREATED, ...extra,
});
const CT = (id: string, cryptoId: string, symbol: string, type: "buy" | "sell", quantity: number, date: string): CryptoTransaction => ({
  id, cryptoId, symbol, name: symbol, type, quantity, price: 100, date, reflected: true, createdAt: `${date}T00:00:00Z`,
});
const data = (o: Partial<AssetData>): AssetData => ({
  realEstate: [], stocks: [], crypto: [], cash: [], loans: [], yearlyNetAssets: [], transactions: [], cashTransactions: [], loanTransactions: [], cryptoTransactions: [],
  lastUpdated: "x", nickname: "", ...o,
});
const first = (rows: RelinkRow[]) => rows[0]?.targets[0];
const pickAll = (rows: RelinkRow[]) => Object.fromEntries(rows.map((r) => [r.rowId, r.targets[0].id]));

describe("감지 ⓐ~ⓛ", () => {
  it("ⓐ 4.73 맞추기 고아 3건 → 1행, 새 매수일 = 첫 매수", () => {
    const d = data({
      stocks: [S(sid(), "005930", 10)],
      transactions: [T("a1", "old", "005930", "buy", 5, "2024-03-04"), T("a2", "old", "005930", "buy", 7, "2024-09-10"), T("a3", "old", "005930", "sell", 2, "2025-01-20")],
    });
    const rows = detectRelink(d);
    expect(rows).toHaveLength(1);
    expect(rows[0].rowId).toBe(`stock:${sid()}`);
    expect(first(rows)).toMatchObject({ id: sid(), count: 3, firstDate: "2024-03-04", lastDate: "2025-01-20", cut: 0, currentPurchaseDate: CREATED, newPurchaseDate: "2024-03-04" });
    expect(relinkTotalCount(rows)).toBe(3);
  });
  it("ⓑ 전량 매도로 끝난 옛 종목 → 후보 0", () => {
    const d = data({ stocks: [S(sid(), "TSLA", 5)], transactions: [T("b1", "old", "TSLA", "buy", 3, "2025-01-01"), T("b2", "old", "TSLA", "sell", 3, "2025-03-01")] });
    expect(detectRelink(d)).toEqual([]);
  });
  it("ⓒ 전량 매도 후 재매수 → 마지막 회차만(앞 회차는 k에 합산)", () => {
    const d = data({
      stocks: [S(sid(), "TSLA", 5)],
      transactions: [T("c1", "old", "TSLA", "buy", 3, "2024-01-01"), T("c2", "old", "TSLA", "sell", 3, "2024-03-01"), T("c3", "old", "TSLA", "buy", 5, "2024-06-01")],
    });
    expect(first(detectRelink(d))).toMatchObject({ txIds: ["c3"], count: 1, cut: 2, newPurchaseDate: "2024-06-01" });
  });
  it("ⓓ 거래 날짜가 만든 날보다 늦으면 제외(묶음 전체)", () => {
    const d = data({ stocks: [S(sid(), "005930", 5)], transactions: [T("d1", "old", "005930", "buy", 5, "2024-03-04"), T("d2", "old", "005930", "buy", 1, "2026-10-21")] });
    expect(detectRelink(d)).toEqual([]);
    // 만든 날 당일은 포함
    const d2 = data({ stocks: [S(sid(), "005930", 5)], transactions: [T("d1", "old", "005930", "buy", 5, CREATED)] });
    expect(first(detectRelink(d2))).toMatchObject({ count: 1 });
  });
  it("ⓓ-1 미래 날짜로 기록했어도 기록 시각이 맞추기 이전이면 이어짐(날짜는 사용자 지정값)", () => {
    const d = data({
      stocks: [S(sid(), "005930", 6)],
      transactions: [T("d1", "old", "005930", "buy", 5, "2024-03-04"), T("d2", "old", "005930", "buy", 1, "2030-01-01", { createdAt: "2026-10-01T00:00:00Z" })],
    });
    expect(first(detectRelink(d))).toMatchObject({ count: 2, lastDate: "2030-01-01" });
  });
  it("ⓓ-2 날짜는 과거여도 기록 시각이 맞추기 이후인 고아 묶음은 안 이어짐", () => {
    const d = data({
      stocks: [S(sid(), "005930", 5)],
      transactions: [T("d1", "old", "005930", "buy", 5, "2024-03-04", { createdAt: "2026-10-25T00:00:00Z" })],
    });
    expect(detectRelink(d)).toEqual([]);
  });
  it("ⓓ-3 기록 시각이 파싱 불가면 거래 날짜 비교로 대체", () => {
    const ok = data({ stocks: [S(sid(), "005930", 5)], transactions: [T("d1", "old", "005930", "buy", 5, "2024-03-04", { createdAt: "broken" })] });
    expect(first(detectRelink(ok))).toMatchObject({ count: 1 });
    const late = data({ stocks: [S(sid(), "005930", 5)], transactions: [T("d1", "old", "005930", "buy", 5, "2026-10-21", { createdAt: "" })] });
    expect(detectRelink(late)).toEqual([]);
  });
  it("ⓔ 같은 키 S 2개(증권사 다름) → 행 1개·대상 2개, 선택 필수(rowId = multi)", () => {
    const d = data({
      stocks: [S(sid(0), "005930", 5, { broker: "토스증권" }), S(sid(1), "005930", 5, { broker: "키움증권" })],
      transactions: [T("e1", "old", "005930", "buy", 5, "2024-03-04")],
    });
    const rows = detectRelink(d);
    expect(rows).toHaveLength(1);
    expect(rows[0].rowId).toBe("stock:multi:domestic:005930");
    expect(rows[0].targets.map((t) => t.id)).toEqual([sid(0), sid(1)]);
    // 고르지 않으면 적용 0
    expect(applyRelink(d, {}).txs).toBe(0);
    // 고른 쪽에만 연결
    const r = applyRelink(d, { [rows[0].rowId]: sid(1) });
    expect(r.data.transactions[0].stockId).toBe(sid(1));
  });
  it("ⓕ 사용자가 매수일을 고친 S → 제외, 만든 해 1월 1일은 대상", () => {
    const base = { transactions: [T("f1", "old", "005930", "buy", 5, "2024-03-04")] };
    expect(detectRelink(data({ ...base, stocks: [S(sid(), "005930", 5, { purchaseDate: "2026-03-02" })] }))).toEqual([]);
    expect(detectRelink(data({ ...base, stocks: [S(sid(), "005930", 5, { purchaseDate: "2026-01-01" })] }))).toHaveLength(1);
  });
  it("ⓖ 해외↔국내는 짝이 되지 않는다(거래 통화 KRW ⇔ 국내 계열)", () => {
    const d = data({ stocks: [F(sid(), "AAPL", 5)], transactions: [T("g1", "old", "AAPL", "buy", 5, "2024-03-04", { currency: "KRW" })] });
    expect(detectRelink(d)).toEqual([]);
    const d2 = data({ stocks: [F(sid(), "AAPL", 5)], transactions: [T("g1", "old", "AAPL", "buy", 5, "2024-03-04", { currency: "USD" })] });
    expect(detectRelink(d2)).toHaveLength(1);
  });
  it("ⓗ 코인 — `crypto_import_`·`stock_import_` 접두 모두 대상(대문자 심볼 비교)", () => {
    const d = data({
      crypto: [C(`crypto_import_${MS}_0`, "BTC", 1), C(sid(3), "ETH", 2)],
      cryptoTransactions: [CT("k1", "c_old1", "btc", "buy", 1, "2024-05-02"), CT("k2", "c_old2", "ETH", "buy", 2, "2025-04-14")],
    });
    const rows = detectRelink(d);
    expect(rows.map((r) => r.kind)).toEqual(["crypto", "crypto"]);
    const r = applyRelink(d, pickAll(rows));
    expect(r.data.cryptoTransactions.map((t) => t.cryptoId)).toEqual([`crypto_import_${MS}_0`, sid(3)]);
    expect(r.data.crypto.map((c) => c.purchaseDate)).toEqual(["2024-05-02", "2025-04-14"]);
  });
  it("ⓘ 적용 후 재감지 0(멱등), 같은 picks를 다시 적용해도 변화 0", () => {
    const d = data({ stocks: [S(sid(), "005930", 5)], transactions: [T("i1", "old", "005930", "buy", 5, "2024-03-04")] });
    const r = applyRelink(d, pickAll(detectRelink(d)));
    expect(r).toMatchObject({ rows: 1, txs: 1 });
    expect(detectRelink(r.data)).toEqual([]);
    const again = applyRelink(r.data, pickAll(detectRelink(d)));
    expect(again).toMatchObject({ rows: 0, txs: 0 });
    expect(again.data).toBe(r.data);
  });
  it("ⓙ 여러 세대(id1 매수·id2 매도) → 합쳐 판정, 매수·매도가 함께 이어진다(A1)", () => {
    const d = data({
      stocks: [F(sid(), "AAPL", 7)],
      transactions: [T("j1", "old1", "AAPL", "buy", 10, "2025-02-03", { currency: "USD" }), T("j2", "old2", "AAPL", "sell", 3, "2025-08-04", { currency: "USD" })],
    });
    const t = first(detectRelink(d))!;
    expect(t).toMatchObject({ txIds: ["j1", "j2"], count: 2, cut: 0, newPurchaseDate: "2025-02-03" });
    // 매도만 따로 매수 없이 시작해도(옛 id별 판정이 아님) 매수·매도가 같이 붙는다
    expect(applyRelink(d, pickAll(detectRelink(d))).data.transactions.map((x) => x.stockId)).toEqual([sid(), sid()]);
  });
  it("ⓚ 현재 10주·이을 매수 30주 → 앞쪽이 잘리고, 적용 후 무관한 거래 1건 삭제 미리보기 수량 ≈ 10(A2)", () => {
    const d = data({
      stocks: [S(sid(), "005930", 10)],
      transactions: [T("k1", "old", "005930", "buy", 20, "2024-01-01"), T("k2", "old", "005930", "buy", 10, "2024-06-01"), T("k3", "old", "005930", "buy", 10, "2024-09-01"), T("own", sid(), "005930", "buy", 0.0, "2026-10-25")],
    });
    // 현재 10주: 뒤에서부터 k3(−10 → 0) 가능, k2(−10 → −10) 불가 → 앞쪽(k1·k2)은 잘림
    const t = first(detectRelink(d))!;
    expect(t.txIds).toEqual(["k3"]);
    expect(t.cut).toBe(2);
    expect(t.newPurchaseDate).toBe("2024-09-01");
    const after = applyRelink(d, pickAll(detectRelink(d))).data;
    const pos = { stockId: sid(), quantity: 10, avgPrice: 100, avgExchangeRate: 0, source: "manual" as const, effectiveDate: CREATED, lockedByManual: false };
    const mine = after.transactions.filter((x) => x.stockId === sid());
    // 이은 거래가 아닌 거래(own)를 지우면 수량이 10 근처(0 절단으로 부풀지 않음)
    const rolled = rollbackTransaction(pos, mine, "own");
    expect(rolled.quantity).toBeCloseTo(10, 6);
    // 이은 거래(10주 매수)를 지우면 기준 0 + 남은 거래 = 0 — 앞쪽 30주가 이어졌다면 기준이 0으로 잘려 부풀었을 것
    expect(rollbackTransaction(pos, mine, "k3").quantity).toBeCloseTo(0, 6);
  });
  it("A2 결함 확정(대조): 앞쪽을 자르지 않고 30주를 모두 이으면 무관한 거래 1건 삭제에도 수량이 40으로 부푼다 — 그래서 자른다", () => {
    const pos = { stockId: "s", quantity: 10, avgPrice: 100, avgExchangeRate: 0, source: "manual" as const, effectiveDate: CREATED, lockedByManual: false };
    const all = [T("k1", "s", "005930", "buy", 20, "2024-01-01"), T("k2", "s", "005930", "buy", 10, "2024-06-01"), T("k3", "s", "005930", "buy", 10, "2024-09-01"), T("own", "s", "005930", "buy", 0, "2026-10-25")];
    expect(rollbackTransaction(pos, all, "own").quantity).toBe(40);
  });
  it("ⓛ 새 매수일이 만든 해 1/1이면 resyncInflowDate가 기본값으로 읽어 투입일 = 만든 날(수용)", () => {
    const d = data({ stocks: [S(sid(), "005930", 5)], transactions: [T("l1", "old", "005930", "buy", 5, "2026-01-01")] });
    const after = applyRelink(d, pickAll(detectRelink(d))).data;
    expect(after.stocks[0].purchaseDate).toBe("2026-01-01");
    expect(resyncInflowDate(after.stocks[0])).toBe(CREATED);
    // 다른 날이면 그 날 그대로
    const d2 = data({ stocks: [S(sid(), "005930", 5)], transactions: [T("l1", "old", "005930", "buy", 5, "2025-03-03")] });
    expect(resyncInflowDate(applyRelink(d2, pickAll(detectRelink(d2))).data.stocks[0])).toBe("2025-03-03");
  });
  it("새 매수일은 현재 매수일보다 이를 때만, 매수 거래가 없으면 그대로", () => {
    const d = data({ stocks: [S(sid(), "005930", 5)], transactions: [T("m1", "old", "005930", "buy", 5, CREATED)] });
    expect(first(detectRelink(d))!.newPurchaseDate).toBeUndefined(); // 같은 날
    const d2 = data({ stocks: [S(sid(), "005930", 5)], transactions: [T("m1", "old", "005930", "sell", 1, "2025-01-01", { reflected: false })] });
    expect(first(detectRelink(d2))!.newPurchaseDate).toBeUndefined();
  });
  it("비상장·티커 없음·옛 id가 아닌 종목·이미 연결된 거래는 대상 아님", () => {
    const d = data({
      stocks: [S(sid(0), "005930", 5, { category: "unlisted" }), S("stock_1700000000000", "000660", 5), S(sid(2), "", 5)],
      transactions: [T("n1", "old", "005930", "buy", 5, "2024-03-04"), T("n2", "old", "000660", "buy", 5, "2024-03-04"), T("n3", sid(0), "005930", "buy", 5, "2024-03-04")],
    });
    expect(detectRelink(d)).toEqual([]);
  });
});

describe("적용·되돌리기·데이터 안전", () => {
  const d = data({
    stocks: [S(sid(), "005930", 10), S("keep", "000660", 3, { purchaseDate: "2023-01-01" })],
    crypto: [C(sid(5), "ETH", 2)],
    transactions: [T("a1", "old", "005930", "buy", 10, "2024-03-04"), T("x1", "keep", "000660", "buy", 3, "2023-01-01"), T("z1", "gone", "035420", "buy", 1, "2024-01-01")],
    cryptoTransactions: [CT("c1", "c_old", "ETH", "buy", 2, "2025-04-14")],
  });
  it("바뀌는 값은 후보 거래의 stockId/cryptoId와 대상 purchaseDate뿐, 나머지는 같은 참조", () => {
    const r = applyRelink(d, pickAll(detectRelink(d)));
    expect(r.data.stocks[1]).toBe(d.stocks[1]);
    expect({ ...r.data.stocks[0], purchaseDate: "x" }).toEqual({ ...d.stocks[0], purchaseDate: "x" });
    expect(r.data.transactions[1]).toBe(d.transactions[1]);
    expect(r.data.transactions[2]).toBe(d.transactions[2]); // 대상 아닌 고아는 그대로
    expect({ ...r.data.transactions[0], stockId: "x" }).toEqual({ ...d.transactions[0], stockId: "x" });
    expect(r.data.cash).toBe(d.cash);
    expect(assetDataSchema.safeParse(r.data).success).toBe(true);
    expect(r).toMatchObject({ rows: 2, txs: 2 });
  });
  it("되돌리기(R1): 저장 전과 깊은 비교 동일, 이은 뒤 직접 고친 항목은 그대로", () => {
    const r = applyRelink(d, pickAll(detectRelink(d)));
    const entries = [
      ...buildUndoEntries(d.stocks, r.data.stocks, "stocks"),
      ...buildUndoEntries(d.crypto, r.data.crypto, "crypto"),
      ...buildUndoEntries(d.transactions, r.data.transactions, "transactions"),
      ...buildUndoEntries(d.cryptoTransactions, r.data.cryptoTransactions, "cryptoTransactions"),
    ];
    const undone = planUndo(entries, r.data);
    expect(undone.skipped).toBe(0);
    expect(undone.data).toEqual(d);
    // 이은 뒤 종목 수량을 직접 고치면 그 항목은 되돌리지 않는다
    const edited = { ...r.data, stocks: r.data.stocks.map((s) => (s.id === sid() ? { ...s, quantity: 99 } : s)) };
    const partial = planUndo(entries, edited);
    expect(partial.skipped).toBe(1);
    expect(partial.data.stocks.find((s) => s.id === sid())!.quantity).toBe(99);
    expect(partial.data.transactions[0].stockId).toBe("old");
  });
  it("4.76 데이터(고아 거래 포함)는 감지만 하고 저장 형식은 그대로 — JSON 왕복 후에도 같은 결과", () => {
    const round = JSON.parse(JSON.stringify(d)) as AssetData;
    expect(detectRelink(round)).toEqual(detectRelink(d));
    const r = applyRelink(round, pickAll(detectRelink(round)));
    expect(JSON.parse(JSON.stringify(r.data))).toEqual(r.data);
  });
  it("거래·종목이 없거나 undefined 배열이어도 안전", () => {
    expect(detectRelink(data({}))).toEqual([]);
    expect(detectRelink({ stocks: [], crypto: [], transactions: undefined as never, cryptoTransactions: undefined as never })).toEqual([]);
  });
});

describe("qa 재현 JSON 픽스처(relink-4.77-qa.json)", () => {
  it("스키마를 통과하고, 주식 2행(삼성전자·애플)·코인 2행이 감지되며 테슬라(전량 매도)는 빠진다", () => {
    const parsed = assetDataSchema.parse((qaFixture as { assetData: unknown }).assetData);
    const rows = detectRelink(parsed);
    expect(rows.map((r) => [r.kind, r.targets[0].name, r.targets[0].count])).toEqual([
      ["stock", "삼성전자", 3], ["stock", "애플", 2], ["crypto", "비트코인", 2], ["crypto", "이더리움", 1],
    ]);
    const after = applyRelink(parsed, pickAll(rows));
    expect(after.txs).toBe(8);
    expect(detectRelink(after.data)).toEqual([]);
  });
});
