// qa 5.175 — 실제 저장 관문(saveAssetData: assetDataSchemaLoose.parse) 통과 여부. 코인은 strict cryptoSchema(수량>0·평단>0).
import { describe, it, expect, beforeEach, vi } from "vitest";
import { saveAssetData, getAssetData } from "@/lib/asset/asset-storage";
import type { AssetData, Crypto, Stock } from "@/types/asset";

const mem = new Map<string, string>();
beforeEach(() => {
  mem.clear();
  vi.stubGlobal("window", {});
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => (mem.has(k) ? mem.get(k)! : null), setItem: (k: string, v: string) => void mem.set(k, v),
    removeItem: (k: string) => void mem.delete(k), key: (i: number) => [...mem.keys()][i] ?? null, get length() { return mem.size; }, clear: () => mem.clear(),
  });
});
const base = (o: Partial<AssetData>): AssetData => ({
  realEstate: [], stocks: [], crypto: [], cash: [], loans: [], yearlyNetAssets: [], transactions: [], cashTransactions: [],
  loanTransactions: [], cryptoTransactions: [], lastUpdated: "", nickname: "", ...o,
} as AssetData);
const coin = (o: Partial<Crypto>): Crypto => ({ id: "k1", name: "비트코인", symbol: "BTC", quantity: 10, averagePrice: 100, currentPrice: 150, purchaseDate: "2026-01-01", ...o } as Crypto);
const stock = (o: Partial<Stock>): Stock => ({ id: "s1", category: "domestic", name: "삼성전자", ticker: "005930", quantity: 10, averagePrice: 100, currentPrice: 150, currency: "KRW", purchaseDate: "2026-01-01", ...o } as Stock);

const out: string[] = [];
describe("저장 관문", () => {
  it("코인 10@100 저장 = true (통제군)", () => { expect(saveAssetData(base({ crypto: [coin({})] }))).toBe(true); });
  it("코인 전량 매도 결과 0@0 저장 = false (조용한 실패)", () => {
    const r = saveAssetData(base({ crypto: [coin({ quantity: 0, averagePrice: 0, positionSource: "computed" })] }));
    out.push(`코인 0@0 저장=${r}`);
    expect(r).toBe(false);
  });
  it("코인 매도 삭제 결과 10@0 저장 = false", () => {
    const r = saveAssetData(base({ crypto: [coin({ quantity: 10, averagePrice: 0 })] }));
    out.push(`코인 10@0 저장=${r}`);
    expect(r).toBe(false);
  });
  it("주식 0@0·10@0 저장 = true (완화 스키마)", () => {
    const a = saveAssetData(base({ stocks: [stock({ quantity: 0, averagePrice: 0 })] }));
    const b = saveAssetData(base({ stocks: [stock({ quantity: 10, averagePrice: 0 })] }));
    out.push(`주식 0@0 저장=${a}, 10@0 저장=${b}`);
    expect([a, b]).toEqual([true, true]);
  });
  it("저장소에 수량 0 코인이 이미 있으면 읽기도 실패(빈 데이터 폴백 여부 기록)", () => {
    mem.set("secretasset_asset_data", JSON.stringify(base({ crypto: [coin({ quantity: 0, averagePrice: 0 })], loans: [] })));
    const d = getAssetData();
    out.push(`수량 0 코인 저장본 읽기: crypto ${d.crypto.length}개`);
    console.log("\n[qa-5175 save-gate]\n" + out.join("\n"));
  });
});
