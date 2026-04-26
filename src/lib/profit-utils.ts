import type { ProfitRefResponse } from "@/app/api/finance/profit/route";

export type ProfitPeriod = "daily" | "weekly" | "monthly" | "yearly";

export function getProfitCacheKey(tickers: string, period: ProfitPeriod): string {
  const nowKST = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const todayStr = nowKST.toISOString().split("T")[0];
  if (period === "weekly") {
    const day = nowKST.getUTCDay();
    const daysToMonday = day === 0 ? 6 : day - 1;
    const lastFriday = new Date(nowKST);
    lastFriday.setUTCDate(nowKST.getUTCDate() - daysToMonday - 3);
    return `profit:weekly:${lastFriday.toISOString().split("T")[0]}:${tickers}`;
  }
  if (period === "monthly") return `profit:monthly:${todayStr.slice(0, 7)}:${tickers}`;
  if (period === "yearly") return `profit:yearly:${todayStr.slice(0, 4)}:${tickers}`;
  return `profit:daily:${todayStr}:${tickers}`;
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
