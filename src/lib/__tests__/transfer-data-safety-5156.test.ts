// #310(5.156) 증권사 이관 데이터 안전 — 백업 내보내기→복원 왕복, 동기화 병합(구버전 기기 혼재) 고아 현상 고정
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { applyImportedPayload, collectAssetIds, getAssetData, reconcileAdditiveMerge, saveAssetData } from "../asset/asset-storage";
import { planDeleteStocks } from "@/contexts/asset-data-context";
import { applyResync, computeDiff, defaultRemoveIds, mergeScreens, planResyncSave, resolveScreens, type ResyncSelection } from "../asset/resync";
import { emptySel, row, screen, st } from "../asset/resync/__tests__/fixtures";
import { emptyData, g, memoryStorage } from "./physical-fixtures";
import type { AssetData } from "@/types/asset";

beforeEach(() => {
  g.window = Object.assign(globalThis, { dispatchEvent: () => true }) as never;
  g.localStorage = memoryStorage();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-25T03:00:00Z"));
});
afterEach(() => {
  vi.useRealTimers();
  delete g.window; delete g.localStorage;
});

const RATES = { USD: 1400, JPY: 900 };
const tx = (id: string, stockId: string, date: string) =>
  ({ id, stockId, ticker: "005930", stockName: "삼성전자", type: "buy", quantity: 1, price: 60_000, currency: "KRW", date, reflected: true, createdAt: `${date}T00:00:00.000Z` }) as AssetData["transactions"][number];
const A = st("a", "005930", "domestic", "미래에셋증권", 10, 60_000);
const B = st("b", "005930", "domestic", "토스증권", 10, 60_000);
const loan = { id: "l1", type: "mortgage-stock", name: "담보", balance: 1_000_000, interestRate: 5, startDate: "2025-01-01", linkedStockId: "a" } as AssetData["loans"][number];
const before = (): AssetData => ({ ...emptyData(), stocks: [A, B], transactions: [tx("t1", "a", "2024-05-01"), tx("t2", "b", "2026-10-01")], loans: [loan] });

function transfer(fresh: AssetData): AssetData {
  const resolved = resolveScreens([screen(0, [row("005930", 10, 60_000, { brokerHint: "토스증권" })])], fresh.stocks, { usdRate: RATES.USD });
  const diff = computeDiff(fresh.stocks, mergeScreens(resolved), resolved);
  const sel: ResyncSelection = { ...emptySel(), remove: defaultRemoveIds(diff), transfer: new Set(["a"]) };
  const result = applyResync(fresh.stocks, diff, sel, { today: "2026-11-25", usdRate: RATES.USD, now: 1 });
  return planResyncSave(fresh, result, (d, ids) => planDeleteStocks(d, ids, RATES, "2026-11-25")).data;
}
const orphans = (d: AssetData) => d.transactions.filter((t) => !d.stocks.some((s) => s.id === t.stockId)).length;
const loanOrphans = (d: AssetData) => d.loans.filter((l) => l.linkedStockId && !d.stocks.some((s) => s.id === l.linkedStockId)).length;

describe("#310 백업 왕복", () => {
  it("이관 뒤 백업(JSON) → 복원: 거래·대출 연결 유지, 고아 0", () => {
    const after = transfer(before());
    expect(orphans(after)).toBe(0);
    const file = JSON.parse(JSON.stringify({ assetData: after }));
    applyImportedPayload(file);
    const d = getAssetData();
    expect(d.stocks.map((s) => s.id)).toEqual(["b"]);
    expect(d.transactions.map((t) => t.stockId)).toEqual(["b", "b"]);
    expect(d.loans[0].linkedStockId).toBe("b");
    expect(orphans(d)).toBe(0);
    expect(loanOrphans(d)).toBe(0);
  });
});

describe("#310 동기화 병합(구버전 기기 혼재)", () => {
  it("이관을 모르는 기기가 동기화된 상태에서 pull: 원격(이관 후)으로 교체, 고아 0", () => {
    const local = before();
    const synced = new Set(collectAssetIds(local));
    const remote = transfer(before());
    const { data } = reconcileAdditiveMerge(local, remote, synced);
    expect(orphans(data)).toBe(0);
    expect(data.stocks.map((s) => s.id)).toEqual(["b"]);
  });

  it("알려진 한계(현상 고정): 그 기기에 A로 적은 미동기 새 거래가 있으면 되살아나 고아 1건", () => {
    const local = before();
    const synced = new Set(collectAssetIds(local));
    local.transactions = [...local.transactions, tx("t-new", "a", "2026-11-24")];
    const { data, changed } = reconcileAdditiveMerge(local, transfer(before()), synced);
    expect(changed).toBe(true);
    expect(orphans(data)).toBe(1);
  });

  it("저장소 왕복: 이관 결과를 저장하고 다시 읽어도 같다(저장 키·스키마 변경 0)", () => {
    const after = transfer(before());
    expect(saveAssetData(after)).toBe(true);
    const d = getAssetData();
    expect(d.transactions.map((t) => [t.id, t.stockId])).toEqual(after.transactions.map((t) => [t.id, t.stockId]));
    expect(d.loans[0].linkedStockId).toBe("b");
  });
});
