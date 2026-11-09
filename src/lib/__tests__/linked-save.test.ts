// #103 연결 저장·삭제 원자성(C37) — 저장 경로 3종(기존 종목·신규 종목·삭제 되돌림)의 합성 결과를 실제 saveAssetData로 저장/실패 모의
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { getAssetData, saveAssetData } from "@/lib/asset/asset-storage";
import { buildLink, removeLink, stockLinkTrade, cryptoLinkTrade } from "@/lib/trade/linked-record";
import { cashItem, emptyData, g, memoryStorage } from "./physical-fixtures";
import type { AssetData } from "@/types/asset";

const TODAY = "2026-11-12";
let store: Storage;
let failWrites = false;
beforeEach(() => {
  store = memoryStorage();
  const raw = store.setItem.bind(store);
  store.setItem = (k: string, v: string) => { if (failWrites) throw new Error("quota"); raw(k, v); };
  g.window = globalThis as never;
  g.localStorage = store;
  failWrites = false;
});
afterEach(() => { delete g.window; delete g.localStorage; });

const tx = (id = "tx_1", type: "buy" | "sell" = "buy") => ({ id, stockId: "s1", ticker: "005930", stockName: "삼성", type, quantity: 10, price: 100_000, currency: "KRW" as const, date: "2026-11-10", reflected: true, createdAt: "x" });
const seed = (): AssetData => ({ ...emptyData(), cash: [cashItem("a", 5_000_000)], loans: [{ id: "l", type: "credit", name: "신용", balance: 3_000_000, interestRate: 3, startDate: "2025-01-01" }], stocks: [{ id: "s1", category: "domestic", name: "삼성", ticker: "005930", quantity: 5, averagePrice: 90_000, currentPrice: 100_000, currency: "KRW", purchaseDate: "2025-01-01" } as AssetData["stocks"][number]] });

describe("연결 저장 합성 + 저장 1회", () => {
  it("기존 종목: 거래·보유 패치·짝 기록·잔액이 한 번의 저장에 함께 있다", () => {
    const d = seed();
    const t = tx();
    const composed = { ...d, transactions: [t], stocks: d.stocks.map((s) => ({ ...s, quantity: 15 })) };
    const b = buildLink(composed, stockLinkTrade(t), { kind: "cash", cashId: "a" }, TODAY);
    if (!b.ok) throw new Error(b.reason);
    expect(saveAssetData(b.data)).toBe(true);
    const saved = getAssetData();
    expect(saved.transactions).toHaveLength(1);
    expect(saved.stocks[0].quantity).toBe(15);
    expect(saved.cashTransactions.map((c) => c.id)).toEqual(["ctx_link_tx_1"]);
    expect(saved.cash[0].balance).toBe(4_000_000);
  });
  it("저장 실패 모킹: 거래·현금·대출·코인·보유·잔액 모두 이전 값(3경로)", () => {
    saveAssetData(seed());
    const before = JSON.stringify({ ...getAssetData(), lastUpdated: "" });
    failWrites = true;
    // 1) 기존 종목 연결 저장
    const t = tx();
    const b = buildLink({ ...seed(), transactions: [t] }, stockLinkTrade(t), { kind: "loan", loanId: "l" }, TODAY);
    if (!b.ok) throw new Error();
    expect(saveAssetData(b.data)).toBe(false);
    // 2) 신규 종목(보유 추가) 연결 저장
    const b2 = buildLink({ ...seed(), transactions: [t], stocks: [...seed().stocks, { ...seed().stocks[0], id: "s2" }] }, stockLinkTrade(t), { kind: "cash", cashId: "a" }, TODAY);
    if (!b2.ok) throw new Error();
    expect(saveAssetData(b2.data)).toBe(false);
    // 3) 삭제 되돌림
    const withLink = buildLink({ ...seed(), transactions: [t] }, stockLinkTrade(t), { kind: "cash", cashId: "a" }, TODAY);
    if (!withLink.ok) throw new Error();
    expect(saveAssetData(removeLink({ ...withLink.data, transactions: [] }, "tx_1").data)).toBe(false);
    expect(JSON.stringify({ ...getAssetData(), lastUpdated: "" })).toBe(before);
  });
  it("가드 불통과(잔액 부족)는 거래 포함 아무것도 만들지 않는다", () => {
    const d = { ...seed(), cash: [cashItem("a", 100)] };
    const t = tx();
    expect(buildLink({ ...d, transactions: [t] }, stockLinkTrade(t), { kind: "cash", cashId: "a" }, TODAY)).toEqual({ ok: false, reason: "balance" });
  });
  it("현금 전액 사용(0원 현금)은 저장 불가 -> 연결 차단, 일부 사용은 저장", () => {
    const t = tx();
    const full = { ...seed(), cash: [cashItem("a", 1_000_000)] };
    expect(buildLink({ ...full, transactions: [t] }, stockLinkTrade(t), { kind: "cash", cashId: "a" }, TODAY)).toEqual({ ok: false, reason: "zero" });
    const part = { ...seed(), cash: [cashItem("a", 1_000_001)] };
    const b = buildLink({ ...part, transactions: [t] }, stockLinkTrade(t), { kind: "cash", cashId: "a" }, TODAY);
    if (!b.ok) throw new Error();
    expect(saveAssetData(b.data)).toBe(true);
    expect(getAssetData().cash[0].balance).toBe(1);
  });
  it("코인 연결: KRW, 짝 id는 crtx 거래 id 기반", () => {
    const ct = { id: "crtx_1731_ab12c", cryptoId: "c1", symbol: "BTC", name: "비트코인", type: "sell" as const, quantity: 0.01, price: 100_000_000, date: "2026-11-10", reflected: true, createdAt: "x" };
    const b = buildLink({ ...seed(), cryptoTransactions: [ct] }, cryptoLinkTrade(ct), { kind: "cash", cashId: "a" }, TODAY);
    if (!b.ok) throw new Error();
    expect(b.data.cashTransactions[0]).toMatchObject({ id: "ctx_link_crtx_1731_ab12c", type: "deposit", amount: 1_000_000, memo: "비트코인 매도" });
  });
});

describe("context 저장·삭제 함수는 saveData를 정확히 1회 호출한다 (정적 단언)", () => {
  const src = readFileSync(path.resolve(__dirname, "../../contexts/asset-data-context.tsx"), "utf8");
  it.each(["addTransactionWithPosition", "addTransactionsBatch", "deleteTransactionWithPosition", "addCryptoTransactionWithPosition", "deleteCryptoTransactionWithPosition"])("%s", (name) => {
    const start = src.indexOf(`const ${name} = useCallback(`);
    const end = src.indexOf("[assetData, saveData]", start);
    const body = src.slice(start, end);
    expect(body.match(/saveData\(/g)).toHaveLength(1);
  });
});

describe("코인 연결 저장 (#107 핫픽스 병합 후)", () => {
  it("반영 식별자는 commit 직전 부여 -> validateReflection 통과, 연결 저장 합성·저장 성공", async () => {
    const { validateReflection } = await import("@/lib/trade/validate-reflection");
    const draft = { id: "crtx_9", cryptoId: "c1", symbol: "BTC", name: "비트코인", type: "sell" as const, quantity: 0.01, price: 50_000_000, date: "2026-11-10", reflected: true, reflectionId: undefined, createdAt: "x" };
    const pos = { quantity: 1, avgPrice: 40_000_000 } as never;
    expect(validateReflection(draft as never, pos).level).not.toBe("restrict");
    const tx = { ...draft, reflectionId: "ref_1" }; // commit 시점 부여
    const b = buildLink({ ...seed(), cryptoTransactions: [tx] }, cryptoLinkTrade(tx), { kind: "cash", cashId: "a" }, TODAY);
    if (!b.ok) throw new Error(b.reason);
    expect(saveAssetData(b.data)).toBe(true);
    const saved = getAssetData();
    expect(saved.cash[0].balance).toBe(5_500_000);
    expect(saved.cashTransactions[0].id).toBe("ctx_link_crtx_9");
  });
  it("crypto-tx-input: buildTx는 reflectionId를 비우고 commit이 부여한다(정적)", () => {
    const src = readFileSync(path.resolve(__dirname, "../../app/(main)/_components/forms/asset-update/input/crypto-tx-input.tsx"), "utf8");
    expect(src).toMatch(/reflectionId: undefined/);
    expect(src).toMatch(/const tx = rawTx\.reflected \? \{ \.\.\.rawTx, reflectionId/);
    expect(src).toMatch(/addCryptoTransactionWithPosition\(tx, coin\.id, buildReflectionPatch\(tx, coin\), link\)/);
  });
});
