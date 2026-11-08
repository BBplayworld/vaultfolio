// #91 코인 어댑터 — 같은 5함수 시그니처. 범위 키 = 거래소, 매칭 키 = 심볼+거래소 (C20·S1~S5 코인 대응)
import { describe, expect, it } from "vitest";
import {
  applyResync, computeDiff, cryptoToStock, defaultRemoveIds, matchExchangeHint, mergeScreens, parsedCryptoToRaw,
  resolveScreens, stocksToCrypto, buildUndoEntries, planUndo,
} from "..";
import type { AssetData, Crypto } from "@/types/asset";
import type { RawScreen } from "../types";
import { emptySel, TODAY } from "./fixtures";

const co = (id: string, symbol: string, exchange: string | undefined, quantity: number, averagePrice: number, extra: Partial<Crypto> = {}): Crypto => ({
  id, name: `코인${symbol}`, symbol, quantity, averagePrice, currentPrice: averagePrice, purchaseDate: "2025-04-04", description: `메모${id}`,
  ...(exchange !== undefined ? { exchange } : {}), ...extra,
});
const raw = (symbol: string, quantity: number, avg: number, exchange = "", extra: Record<string, unknown> = {}) =>
  parsedCryptoToRaw({ name: `코인${symbol}`, symbol, quantity, averagePrice: avg, currentPrice: avg, exchange, currency: "KRW", ...extra }, 1400);
const scr = (index: number, items: ReturnType<typeof raw>[], status: RawScreen["status"] = "ok"): RawScreen => ({ index, status, items });

function run(existing: Crypto[], screens: RawScreen[], o: { brokers?: Record<number, string>; remove?: string[]; include?: (d: ReturnType<typeof computeDiff>) => Set<string> } = {}) {
  const adapted = existing.map(cryptoToStock);
  const resolved = resolveScreens(screens, adapted, { usdRate: 1400, brokerOverrides: o.brokers, matchHint: matchExchangeHint });
  const diff = computeDiff(adapted, mergeScreens(resolved), resolved);
  const sel = { ...emptySel(), remove: defaultRemoveIds(diff), include: o.include?.(diff) ?? new Set<string>() };
  (o.remove ?? []).forEach((id) => sel.remove.add(id));
  const result = applyResync(adapted, diff, sel, { today: TODAY, usdRate: 1400, now: 5 });
  return { diff, result, adapted, coins: stocksToCrypto(existing, adapted, result.stocks) };
}

describe("거래소 글자 → 목록명", () => {
  it.each([["업비트", "업비트"], ["Upbit", "업비트"], ["빗썸 프로", "빗썸"], ["", undefined], ["바이낸스", "바이낸스"], ["OKX", "OKX"]])("%j → %j", (h, want) => expect(matchExchangeHint(h)).toBe(want));
});

describe("어댑터", () => {
  it("바뀌지 않은 코인은 원래 객체 그대로, 바뀐 코인은 id·매수일·메모·baseDate 승계", () => {
    const a = co("a", "BTC", "업비트", 1, 50_000_000, { baseDate: "2026-11-07" });
    const b = co("b", "ETH", "업비트", 2, 3_000_000);
    const { coins } = run([a, b], [scr(0, [raw("BTC", 1.5, 50_000_000, "업비트"), raw("ETH", 2, 3_000_000)])]);
    expect(coins[1]).toBe(b);
    expect(coins[0]).toEqual({ ...a, quantity: 1.5, positionSource: "manual", positionEffectiveDate: TODAY });
  });
  it("신규 코인: 매수일 오늘, 거래소=장 거래소, 매입 환율 필드 없음", () => {
    const { coins } = run([], [scr(0, [raw("XRP", 100, 800, "업비트")])]);
    expect(coins[0]).toMatchObject({ symbol: "XRP", purchaseDate: TODAY, exchange: "업비트", quantity: 100, positionSource: "manual" });
    expect(coins[0]).not.toHaveProperty("purchaseExchangeRate");
  });
  it("달러 화면은 기존 가져오기처럼 오늘 환율로 원화 환산", () => {
    const r = parsedCryptoToRaw({ name: "비트", symbol: "BTC", quantity: 1, averagePrice: 100, currentPrice: 110, currency: "USD" }, 1400);
    expect(r).toMatchObject({ averagePrice: 140000, currentPrice: 154000 });
  });
});

describe("C20 코인 대응", () => {
  it("① 거래소 미지정 / ② `항목 2` 연결 + 거래소 채움", () => {
    for (const ex of [undefined, "", "항목 2"]) {
      const a = co("a", "BTC", ex, 1, 50_000_000);
      const { diff, coins } = run([a], [scr(0, [raw("BTC", 1, 50_000_000, "업비트")])]);
      expect(diff.rows[0]).toMatchObject({ status: "change", linkedBy: "unassigned" });
      expect(coins[0]).toMatchObject({ id: "a", exchange: "업비트", purchaseDate: "2025-04-04", description: "메모a" });
    }
  });
  it("③ 같은 심볼 두 거래소: 한 곳만 맞춰도 다른 거래소 줄 불변", () => {
    const a = co("a", "BTC", "업비트", 1, 50_000_000);
    const b = co("b", "BTC", "빗썸", 2, 49_000_000);
    const { coins } = run([a, b], [scr(0, [raw("BTC", 3, 50_000_000, "업비트")])]);
    expect(coins[1]).toBe(b);
    expect(coins[0].quantity).toBe(3);
  });
  it("거래소 혼재: 업비트 화면만 올리면 빗썸·거래소 미지정 코인은 유지 묶음, 삭제 0", () => {
    const ex = [co("u1", "BTC", "업비트", 1, 1), co("u2", "ETH", "업비트", 1, 1), co("u3", "XRP", "업비트", 1, 1), co("u4", "SOL", "업비트", 1, 1), co("u5", "ADA", "업비트", 1, 1),
      co("b1", "BTC", "빗썸", 1, 1), co("n1", "DOGE", undefined, 1, 1), co("n2", "DOT", "", 1, 1)];
    const { diff, coins } = run(ex, [scr(0, [raw("BTC", 1, 1, "업비트"), raw("ETH", 1, 1), raw("XRP", 1, 1), raw("SOL", 1, 1)])]);
    expect(diff.removes.map((r) => r.stock.id)).toEqual(["u5"]);
    expect(diff.kept.map((s) => s.id).sort()).toEqual(["b1", "n1", "n2"]);
    expect(coins.map((c) => c.id)).toEqual(["u1", "u2", "u3", "u4", "b1", "n1", "n2"]);
  });
  it("⑧ 고아 거래: 코인 거래 배열은 건드리지 않는다(맞추기는 crypto만 교체)", () => {
    const txs = [{ id: "x", cryptoId: "gone" }] as unknown as AssetData["cryptoTransactions"];
    const data = { crypto: [co("a", "BTC", "업비트", 2, 1)], cryptoTransactions: txs };
    const { coins } = run(data.crypto, [scr(0, [raw("BTC", 1, 1, "업비트")])]);
    const after = { ...data, crypto: coins };
    expect(after.cryptoTransactions).toBe(txs);
  });
});

describe("S2·S4 코인", () => {
  const six = ["BTC", "ETH", "XRP", "SOL", "ADA", "DOT"].map((s, i) => co(`c${i}`, s, "업비트", 1, 100));
  it("잘림 장이 있으면 모든 삭제 기본 해제", () => {
    const { diff } = run(six, [scr(0, six.slice(0, 5).map((c, i) => raw(c.symbol, 1, 100, i === 0 ? "업비트" : ""))), scr(1, [], "truncated")]);
    expect(diff.removes.every((r) => !r.defaultChecked && r.offReason === "incomplete")).toBe(true);
  });
  it("거래소 미확정 장은 확인 필요이고 사용자가 거래소를 고르면 확정", () => {
    const a = run([], [scr(0, [raw("BTC", 1, 100)])]);
    expect(a.diff.rows[0]).toMatchObject({ status: "needs", reasons: ["brokerUnconfirmed"] });
    expect(a.coins).toHaveLength(0);
    const b = run([], [scr(0, [raw("BTC", 1, 100)])], { brokers: { 0: "빗썸" } });
    expect(b.coins[0]).toMatchObject({ exchange: "빗썸" });
  });
  it("거래소 글자가 없어도 기존 심볼 과반의 거래소로 확정(②)", () => {
    const ex = [co("a", "BTC", "업비트", 1, 100), co("b", "ETH", "업비트", 1, 100)];
    const { diff } = run(ex, [scr(0, [raw("BTC", 1, 100), raw("ETH", 1, 100)])]);
    expect(diff.incomplete).toBe(false);
  });
  it("평단 미표시(averagePriceMissing)면 기존 평단 유지, 수량만 변경", () => {
    const a = co("a", "BTC", "업비트", 1, 50_000_000);
    const { coins } = run([a], [scr(0, [raw("BTC", 2, 99_000_000, "업비트", { averagePriceMissing: true })])]);
    expect(coins[0]).toMatchObject({ quantity: 2, averagePrice: 50_000_000 });
  });
  it("수량 감소(② 연결)는 확인 필요, 포함하면 적용", () => {
    const a = co("a", "BTC", "", 2, 50_000_000);
    const off = run([a], [scr(0, [raw("BTC", 1, 50_000_000, "업비트")])]);
    expect(off.diff.rows[0]).toMatchObject({ status: "needs", reasons: ["qtyDecrease"] });
    expect(off.coins[0]).toBe(a);
    const on = run([a], [scr(0, [raw("BTC", 1, 50_000_000, "업비트")])], { include: (d) => new Set([d.rows[0].rowId]) });
    expect(on.coins[0]).toMatchObject({ quantity: 1, exchange: "업비트" });
  });
  it("두 장 수량 충돌(K1): 확인 필요 1칸, 큰 값 기본", () => {
    const a = co("a", "BTC", "업비트", 1, 1);
    const { diff } = run([a], [scr(0, [raw("BTC", 1, 1, "업비트")]), scr(1, [raw("BTC", 2, 1, "업비트")])]);
    expect(diff.rows).toHaveLength(1);
    expect(diff.rows[0].item).toMatchObject({ quantity: 2, quantityCandidates: [1, 2] });
  });
});

describe("되돌리기 코인", () => {
  const base = (crypto: Crypto[]): AssetData => ({
    realEstate: [], stocks: [], crypto, cash: [], loans: [], yearlyNetAssets: [],
    transactions: [], cashTransactions: [], loanTransactions: [], cryptoTransactions: [], lastUpdated: "x", nickname: "",
  });
  it("변경·추가·삭제 혼합을 되돌리면 맞추기 전과 같고 삭제 코인은 목록 끝", () => {
    const ex = [co("a", "BTC", "업비트", 1, 100), co("b", "ETH", "업비트", 1, 100), co("c", "XRP", "빗썸", 1, 100)];
    const { coins } = run(ex, [scr(0, [raw("BTC", 3, 100, "업비트"), raw("SOL", 5, 10)])], { remove: ["b"] });
    const entries = buildUndoEntries(ex, coins, "crypto");
    expect(entries.map((e) => e.kind).sort()).toEqual(["modified", "remoteDeleted", "resurrected"]);
    expect(entries.every((e) => e.key.startsWith("crypto:"))).toBe(true);
    const u = planUndo(entries, base(coins));
    expect(u.restored).toBe(3);
    expect(u.data.crypto.map((c) => c.id)).toEqual(["a", "c", "b"]);
    expect(u.data.crypto.find((c) => c.id === "a")).toEqual(ex[0]);
  });
});
