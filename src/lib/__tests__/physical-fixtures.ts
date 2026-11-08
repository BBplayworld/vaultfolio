// #58 실물 자산 테스트 공용 — 메모리 Storage, 4.53(직전 main) 구버전 로직 사본, 픽스처.
import { assetDataSchema } from "@/types/asset";
import type { AssetData, PhysicalAsset } from "@/types/asset";

/** Object.keys(localStorage)를 쓰는 clearAssetData까지 동작: 데이터는 own 속성, 메서드는 비열거 */
export function memoryStorage(): Storage {
  const s = {} as Record<string, string>;
  const def = (k: string, value: unknown) => Object.defineProperty(s, k, { value, enumerable: false, writable: true, configurable: true });
  def("getItem", (k: string) => (Object.prototype.hasOwnProperty.call(s, k) ? s[k] : null));
  def("setItem", (k: string, v: string) => { s[k] = String(v); });
  def("removeItem", (k: string) => { delete s[k]; });
  def("clear", () => { for (const k of Object.keys(s)) delete s[k]; });
  def("key", (i: number) => Object.keys(s)[i] ?? null);
  Object.defineProperty(s, "length", { get: () => Object.keys(s).length, enumerable: false });
  return s as unknown as Storage;
}

export const g = globalThis as unknown as { window?: unknown; localStorage?: Storage; fetch?: unknown };

export const emptyData = (): AssetData => ({
  realEstate: [], stocks: [], crypto: [], cash: [], loans: [],
  yearlyNetAssets: [], transactions: [], cashTransactions: [], loanTransactions: [], cryptoTransactions: [],
  lastUpdated: "2026-01-01T00:00:00.000Z", nickname: "",
});

export const gold = (id = "P1", over: Partial<PhysicalAsset> = {}): PhysicalAsset => ({
  id, type: "gold", name: "금 10돈", currentValue: 2_000_000, purchasePrice: 1_500_000, purchaseDate: "2024-03-01", ...over,
});

export const cashItem = (id: string, balance: number) => ({ id, name: "예금", balance, currency: "KRW" as const, type: "bank" as const });

// ── v4.53(직전 main) 로직 사본: 실물 키를 읽지도 쓰지도 않고, zod strip으로 본 키만 다룬다 ──
const legacySchema = assetDataSchema.omit({ physicalAssets: true });
const MAIN = "secretasset_asset_data";
const LEGACY_KEEP = ["secretasset_sync", "secretasset_backup"];

export const legacy = {
  read(): AssetData {
    const raw = localStorage.getItem(MAIN);
    return legacySchema.parse(raw ? JSON.parse(raw) : emptyData()) as AssetData;
  },
  save(data: AssetData) {
    const v = legacySchema.parse(data);
    localStorage.setItem(MAIN, JSON.stringify({ ...v, lastUpdated: new Date().toISOString() }));
  },
  /** clearAssetData: secretasset_ 접두 키 전부 삭제(keep 제외) */
  clear() {
    for (const k of Object.keys(localStorage)) {
      if (k.startsWith("secretasset_") && !LEGACY_KEEP.includes(k)) localStorage.removeItem(k);
    }
  },
  /** applyImportedPayload: strip 검증 → clear → 저장 */
  applyImport(payload: unknown) {
    const p = (payload ?? {}) as Record<string, unknown>;
    const v = legacySchema.parse(p.assetData ?? p);
    legacy.clear();
    localStorage.setItem(MAIN, JSON.stringify(v));
  },
  buildPayload() {
    return { assetData: legacy.read() };
  },
};
