// 보유 현황 맞추기 테스트 공용 픽스처 — 실제 broker 값 형태(`""`·`항목 N`·자유 텍스트·목록 밖 `데모증권`)를 쓴다.
import type { Stock } from "@/types/asset";
import { applyResync, defaultRemoveIds, type ResyncSelection } from "..";
import { computeDiff, mergeScreens, resolveScreens } from "..";
import type { RawScreen, RawScreenItem } from "../types";

export const TODAY = "2026-11-08";
export const USD = 1400;

export const st = (id: string, ticker: string, category: Stock["category"], broker: string | undefined, quantity: number, averagePrice: number, extra: Partial<Stock> = {}): Stock => ({
  id,
  category,
  name: `이름${ticker || id}`,
  ticker,
  quantity,
  averagePrice,
  currentPrice: averagePrice,
  currency: category === "foreign" ? "USD" : "KRW",
  purchaseDate: "2025-03-02",
  description: `메모${id}`,
  ...(category === "foreign" ? { purchaseExchangeRate: 1300 } : {}),
  ...(broker !== undefined ? { broker } : {}),
  ...extra,
});

export const row = (ticker: string, quantity: number, averagePrice: number, extra: Partial<RawScreenItem> = {}): RawScreenItem => ({
  name: `이름${ticker}`,
  ticker,
  quantity,
  averagePrice,
  currentPrice: averagePrice,
  category: /^\d{6}$/.test(ticker) ? "domestic" : "foreign",
  section: /^\d{6}$/.test(ticker) ? "국내" : "해외",
  originalCurrency: /^\d{6}$/.test(ticker) ? "KRW" : "USD",
  brokerHint: "",
  quantityMissing: false,
  averagePriceEstimated: false,
  ...extra,
});

export const screen = (index: number, items: RawScreenItem[], status: RawScreen["status"] = "ok"): RawScreen => ({ index, status, items });

export const emptySel = (): ResyncSelection => ({ include: new Set(), remove: new Set(), pick: {}, qty: {}, ticker: {} });

export function run(
  existing: Stock[],
  screens: RawScreen[],
  o: { brokers?: Record<number, string>; sel?: (d: ReturnType<typeof computeDiff>) => Partial<ResyncSelection> } = {},
) {
  const resolved = resolveScreens(screens, existing, { usdRate: USD, brokerOverrides: o.brokers });
  const diff = computeDiff(existing, mergeScreens(resolved), resolved);
  const base = { ...emptySel(), remove: defaultRemoveIds(diff) };
  const sel = { ...base, ...(o.sel?.(diff) ?? {}) };
  const result = applyResync(existing, diff, sel, { today: TODAY, usdRate: USD, now: 1_700_000_000_000 });
  return { resolved, diff, sel, result };
}
