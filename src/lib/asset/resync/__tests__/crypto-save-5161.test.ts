// 5.161 코인 맞추기 — 체크 삭제 코인의 거래 정리(planDeleteCryptos 재사용)와 되돌리기 왕복
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { planDeleteCryptos } from "@/contexts/asset-data-context";
import { applyResync, buildCryptoResyncUndoEntries, computeDiff, cryptoToStock, defaultRemoveIds, matchExchangeHint, mergeScreens, parsedCryptoToRaw, planCryptoResyncSave, planUndo, resolveScreens, stocksToCrypto } from "..";
import type { AssetData, Crypto, CryptoTransaction } from "@/types/asset";
import { emptySel, TODAY } from "./fixtures";

const RATES = { USD: 1400, JPY: 900 };
const data = (o: Partial<AssetData> = {}): AssetData => ({
  realEstate: [], stocks: [], crypto: [], cash: [], loans: [], yearlyNetAssets: [], transactions: [], cashTransactions: [], loanTransactions: [], cryptoTransactions: [],
  lastUpdated: "2026-01-01T00:00:00.000Z", nickname: "", ...o,
});
const co = (id: string, symbol: string, quantity: number, price = 50_000_000, name = `코인${symbol}`): Crypto =>
  ({ id, name, symbol, quantity, averagePrice: price, currentPrice: price, purchaseDate: "2025-04-04", exchange: "업비트" }) as Crypto;
const tx = (id: string, cryptoId: string): CryptoTransaction => ({ id, cryptoId, symbol: "X", name: "x", type: "buy", quantity: 1, price: 1000, date: "2026-11-03", reflected: true, createdAt: "x" }) as CryptoTransaction;
const raw = (symbol: string, quantity: number, avg: number, name = `코인${symbol}`) =>
  parsedCryptoToRaw({ name, symbol, quantity, averagePrice: avg, currentPrice: avg, exchange: "업비트", currency: "KRW" }, 1400);

/** 대화상자 handleApply와 같은 순서: 화면 인식 → 맞추기 → 저장 계획 */
function resync(fresh: AssetData, items: ReturnType<typeof raw>[], remove: string[] = []) {
  const before = fresh.crypto.map(cryptoToStock);
  const resolved = resolveScreens([{ index: 0, status: "ok", items }], before, { usdRate: 1400, matchHint: matchExchangeHint });
  const diff = computeDiff(before, mergeScreens(resolved), resolved);
  const sel = { ...emptySel(), remove: defaultRemoveIds(diff) };
  remove.forEach((id) => sel.remove.add(id)); // 미리보기에서 사용자가 체크한 삭제
  const result = applyResync(before, diff, sel, { today: TODAY, usdRate: 1400, now: 5 });
  const nextCrypto = stocksToCrypto(fresh.crypto, before, result.stocks);
  const next = planCryptoResyncSave(fresh, nextCrypto, (d, ids) => planDeleteCryptos(d, ids, RATES, TODAY));
  return { next, nextCrypto };
}

describe("코인 맞추기 저장 계획(5.161)", () => {
  const fresh = data({ crypto: [co("a", "BTC", 1), co("b", "ETH", 2, 3_000_000), co("z", "ZERO", 0)], cryptoTransactions: [tx("ta", "a"), tx("tb", "b"), tx("tz", "z")] });

  it("체크 삭제 코인의 거래 = 같은 입력 planDeleteCryptos 결과와 동일, 고아 거래 0", () => {
    const { next } = resync(fresh, [raw("BTC", 1, 50_000_000)], ["b", "z"]); // ETH·ZERO는 화면에 없음 → 삭제
    expect(next.crypto.map((c) => c.id)).toEqual(["a"]);
    expect(next.cryptoTransactions).toEqual(planDeleteCryptos(fresh, ["b", "z"], RATES, TODAY).cryptoTransactions);
    const live = new Set(next.crypto.map((c) => c.id));
    // 평가액 0 코인(z)의 거래는 규칙대로 남는다 — 그 밖에는 고아 0
    expect(next.cryptoTransactions!.filter((t) => !live.has(t.cryptoId)).map((t) => t.id)).toEqual(["tz"]);
    expect(next.cryptoTransactions!.map((t) => t.id)).toEqual(["ta", "tz"]);
  });

  it("지운 코인이 없으면 거래 배열은 같은 참조", () => {
    const { next } = resync(fresh, [raw("BTC", 1, 50_000_000), raw("ETH", 2, 3_000_000), raw("ZERO", 0.0, 1)]);
    expect(next.cryptoTransactions).toBe(fresh.cryptoTransactions);
  });

  it("이름이 바뀌어 매칭된 코인의 거래는 지워지지 않는다", () => {
    const { next, nextCrypto } = resync(fresh, [raw("BTC", 1, 50_000_000, "비트코인(새이름)"), raw("ETH", 2, 3_000_000)]);
    expect(nextCrypto.map((c) => c.id)).toEqual(expect.arrayContaining(["a", "b"]));
    expect(next.cryptoTransactions!.map((t) => t.id)).toEqual(expect.arrayContaining(["ta", "tb"]));
  });

  it("되돌리기: crypto·cryptoTransactions의 id·내용이 맞추기 직전과 같다", () => {
    const { next } = resync(fresh, [raw("BTC", 1, 50_000_000)], ["b", "z"]);
    expect(next.cryptoTransactions!.length).toBeLessThan(fresh.cryptoTransactions!.length);
    const entries = buildCryptoResyncUndoEntries(fresh, next);
    expect(new Set(entries.map((e) => e.coll))).toEqual(new Set(["crypto", "cryptoTransactions"]));
    const undone = planUndo(entries, next);
    expect(undone.skipped).toBe(0);
    const byId = <T extends { id: string }>(l: T[]) => [...l].sort((x, y) => x.id.localeCompare(y.id));
    expect(byId(undone.data.crypto)).toEqual(byId(fresh.crypto));
    expect(byId(undone.data.cryptoTransactions ?? [])).toEqual(byId(fresh.cryptoTransactions ?? []));
  });
});

describe("닫은 뒤 토스트 되돌리기(5.161 확인)", () => {
  it("토스트는 대화상자 상태 없이 entries 사본만으로 되돌린다(코인은 거래까지) — 그 사이 다른 필드 수정은 보존", () => {
    const fresh = data({ crypto: [co("a", "BTC", 1), co("b", "ETH", 2, 3_000_000)], cryptoTransactions: [tx("ta", "a"), tx("tb", "b")] });
    const { next } = resync(fresh, [raw("BTC", 1, 50_000_000)], ["b"]);
    const entries = buildCryptoResyncUndoEntries(fresh, next); // 닫을 때 토스트가 붙잡는 사본
    const current = { ...next, nickname: "그 사이 바꾼 값" };
    const undone = planUndo(entries, current).data;
    expect(undone.cryptoTransactions!.map((t) => t.id).sort()).toEqual(["ta", "tb"]);
    expect(undone.crypto.map((c) => c.id).sort()).toEqual(["a", "b"]);
    expect(undone.nickname).toBe("그 사이 바꾼 값");
  });
  it("모달(body pointer-events:none)이 열려 있어도 토스트 버튼이 눌린다 — 토스트가 pointer-events:auto를 받고 sonner 규칙이 이를 덮지 않는다(D-1)", () => {
    const wrapper = readFileSync("src/components/ui/sonner.tsx", "utf8");
    // 계산값 auto: Toaster가 모든 토스트에 pointer-events-auto 클래스를 준다(Tailwind pointer-events: auto)
    expect(wrapper).toMatch(/toastOptions=\{\{\s*className:\s*"pointer-events-auto"/);
    const css = readFileSync("node_modules/sonner/dist/index.mjs", "utf8");
    const rules = [...css.matchAll(/([^{}]+)\{([^{}]*pointer-events[^{}]*)\}/g)].map((m) => `${m[1].trim()}{${m[2]}}`).filter((r) => r.startsWith("[data-sonner"));
    // sonner가 pointer-events를 건드리는 곳은 숨김 토스트뿐(그 외 규칙이 auto를 덮지 않는다)
    expect(rules.every((r) => r.includes("[data-visible=false]") && r.includes("pointer-events:none"))).toBe(true);
    // 토스트 z-index는 시트·대화상자(10002)보다 높다
    const z = Math.max(...[...css.matchAll(/z-index:\s*(\d+)/g)].map((m) => Number(m[1])));
    expect(z).toBeGreaterThan(10002);
  });
});
