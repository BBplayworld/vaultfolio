import type { ProfitRefResponse } from "@/app/api/finance/profit/route";
import { STORAGE_KEY_PREFIXES } from "@/lib/local-storage";

export type ProfitPeriod = "daily" | "weekly" | "monthly" | "yearly";

export function getProfitCacheKey(tickers: string, period: ProfitPeriod): string {
  const nowKST = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const todayStr = nowKST.toISOString().split("T")[0];
  if (period === "monthly") return `${STORAGE_KEY_PREFIXES.profit}monthly:${todayStr.slice(0, 7)}:${tickers}`;
  if (period === "yearly") return `${STORAGE_KEY_PREFIXES.profit}yearly:${todayStr.slice(0, 4)}:${tickers}`;
  return `${STORAGE_KEY_PREFIXES.profit}${period}:${todayStr}:${tickers}`;
}

export async function fetchProfitRef(tickers: string, period: ProfitPeriod): Promise<ProfitRefResponse> {
  const cacheKey = getProfitCacheKey(tickers, period);
  try {
    const raw = localStorage.getItem(cacheKey);
    if (raw) return JSON.parse(raw) as ProfitRefResponse;
  } catch { /* ignore */ }
  const res = await fetch(`/api/finance/profit?tickers=${tickers}&period=${period}`);
  if (!res.ok) return {};
  const data: ProfitRefResponse = await res.json();
  try { localStorage.setItem(cacheKey, JSON.stringify(data)); } catch { /* ignore */ }
  return data;
}
