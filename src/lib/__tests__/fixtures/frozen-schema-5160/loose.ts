// 동결 스키마 사본 — main 9c13292(v5.160)의 src/lib/asset/asset-storage.ts 중 읽기·저장용 완화 스키마(stockSchemaLoose·assetDataSchemaLoose)와
// 구버전 기기의 저장소 동작(읽기·저장·clearAssetData·가져오기·내보내기)을 옮긴 것. 구버전 기기 재현 전용(#329 data-safety-5166.test.ts).
// `src/`의 살아 있는 스키마·저장 모듈을 import하지 않는다(이 폴더의 사본과 zod만 쓴다).
// 구버전은 payload 최상위 `cashTxTags`와 저장 키 `secretasset.cash_tx_tags`를 모른다 — 읽지 않고, push·백업에 싣지 않는다.
import { z } from "zod";
import { assetDataSchema } from "./asset";
import { transactionSchema } from "./transaction";

const stockSchemaLoose = z.object({
  id: z.string(),
  category: z.enum(["domestic", "foreign", "irp", "isa", "pension", "unlisted"]),
  name: z.string(),
  ticker: z.string().optional().default(""),
  quantity: z.number(),
  averagePrice: z.number(),
  currentPrice: z.number(),
  currency: z.enum(["KRW", "USD", "JPY"]).default("KRW"),
  purchaseDate: z.string(),
  description: z.string().optional().default(""),
  baseDate: z.string().optional(),
  purchaseExchangeRate: z.number().optional(),
  broker: z.string().optional(),
  inactiveStatus: z.enum(["delisted", "halted"]).optional(),
  inactiveReason: z.string().optional(),
  inactiveCheckedAt: z.string().optional(),
  positionSource: z.enum(["manual", "computed"]).optional(),
  positionEffectiveDate: z.string().optional(),
});

export const frozenAssetDataSchema = assetDataSchema;
export const frozenAssetDataSchemaLoose = assetDataSchema.omit({ stocks: true }).extend({
  stocks: z.array(stockSchemaLoose).default([]),
  transactions: z.array(transactionSchema).default([]),
});

export type FrozenAssetData = z.infer<typeof frozenAssetDataSchema>;

const MAIN = "secretasset_asset_data";
// 9c13292 clearAssetData의 보존 키(접두 포함) — 그 밖의 `secretasset_` 키는 지운다. 점 구분 키(`secretasset.`)는 접두가 달라 걸리지 않는다
const KEEP = ["secretasset_tutorial_status", "secretasset_sync", "secretasset_gemini_usage", "secretasset_collapsible_used", "secretasset_finance_api_error_count", "secretasset_backup", "secretasset_tax_notice", "secretasset_asset_refresh", "secretasset_ga_flags", "secretasset_feature_usage"];

/** 구버전(5.160) 기기 — 호출 시점의 전역 localStorage를 쓴다 */
export const frozenDevice = {
  read(): FrozenAssetData {
    const raw = localStorage.getItem(MAIN);
    const { physicalAssets: _p, ...rest } = (raw ? JSON.parse(raw) : {}) as Record<string, unknown>;
    return frozenAssetDataSchemaLoose.parse(rest) as FrozenAssetData;
  },
  save(data: FrozenAssetData): void {
    const { physicalAssets: _p, ...rest } = data as Record<string, unknown>;
    const validated = frozenAssetDataSchemaLoose.parse(rest);
    localStorage.setItem(MAIN, JSON.stringify({ ...validated, lastUpdated: new Date().toISOString() }));
  },
  clear(): void {
    for (const k of Object.keys(localStorage)) {
      if (!k.startsWith("secretasset_") || KEEP.includes(k)) continue;
      if (k.startsWith("secretasset_notice_seen") || k.startsWith("secretasset_pwa_auth")) continue;
      localStorage.removeItem(k);
    }
  },
  /** applyImportedPayload(pull·백업 복원) — 검증(strip) → clear → 저장. 최상위는 assetData만 읽는다 */
  applyImport(payload: unknown): FrozenAssetData {
    const p = (payload ?? {}) as Record<string, unknown>;
    const validated = frozenAssetDataSchema.parse(p.assetData ?? p);
    frozenDevice.clear();
    frozenDevice.save(validated);
    return validated;
  },
  /** buildExportPayload(push·백업) — 구버전이 아는 최상위 필드만 */
  buildPayload(): Record<string, unknown> {
    return { assetData: frozenDevice.read(), profitBasis: "sameBusinessDay" };
  },
};
