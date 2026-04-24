import { NextRequest, NextResponse } from "next/server";
import { getCacheStorage } from "@/lib/cache-storage";
import {
  fetchKisToken,
  fetchDomesticHistoricalPrice,
  fetchOverseasHistoricalPrice,
  classifyTickers,
} from "@/lib/finance-service";

export type ProfitPeriod = "daily" | "weekly" | "monthly" | "yearly";

export interface ProfitRefEntry {
  refPrice: number;
  refDate: string;
}

export type ProfitRefResponse = Record<string, ProfitRefEntry | null>;

function getKSTDate(offsetDays = 0): Date {
  const nowKST = new Date(Date.now() + 9 * 60 * 60 * 1000);
  nowKST.setUTCDate(nowKST.getUTCDate() + offsetDays);
  return nowKST;
}

function toDateStr(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

function rollbackWeekend(d: Date): Date {
  const day = d.getUTCDay(); // 0=일, 6=토
  if (day === 0) d.setUTCDate(d.getUTCDate() - 2);
  else if (day === 6) d.setUTCDate(d.getUTCDate() - 1);
  return d;
}

function getRefDate(period: ProfitPeriod): string {
  const nowKST = getKSTDate(0);

  if (period === "daily") {
    const twoDaysAgo = getKSTDate(-2);
    return toDateStr(rollbackWeekend(twoDaysAgo));
  }

  if (period === "weekly") {
    // 지난주 금요일
    const d = getKSTDate(0);
    const day = d.getUTCDay(); // 0=일, 1=월, ..., 5=금, 6=토
    const daysToLastFriday = day === 0 ? 2 : day === 6 ? 1 : day + 2;
    d.setUTCDate(d.getUTCDate() - daysToLastFriday);
    return toDateStr(d);
  }

  if (period === "monthly") {
    // 이번달 1일
    const d = new Date(Date.UTC(nowKST.getUTCFullYear(), nowKST.getUTCMonth(), 1));
    return toDateStr(rollbackWeekend(d));
  }

  // yearly: 올해 1월 2일 (첫 영업일 근사)
  const d = new Date(Date.UTC(nowKST.getUTCFullYear(), 0, 2));
  return toDateStr(rollbackWeekend(d));
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const tickersParam = searchParams.get("tickers") ?? "";
  const period = (searchParams.get("period") ?? "daily") as ProfitPeriod;

  const tickers = tickersParam
    .split(",")
    .map((t) => t.trim().toUpperCase())
    .filter(Boolean);

  if (tickers.length === 0) {
    return NextResponse.json({});
  }

  const refDate = getRefDate(period);
  const krRefDate = refDate;
  const usRefDate = refDate;
  const cache = getCacheStorage();
  const result: ProfitRefResponse = {};

  // 국내/해외 분류 후 각각 다른 refDate로 캐시 조회
  const { krTickers: allKr, usTickers: allUs } = classifyTickers(tickers);
  const uncachedKr: string[] = [];
  const uncachedUs: string[] = [];

  await Promise.all([
    ...allKr.map(async (ticker) => {
      const cached = await cache.getRefPrice(ticker, krRefDate);
      if (cached !== null) {
        result[ticker] = { refPrice: cached, refDate: krRefDate };
      } else {
        uncachedKr.push(ticker);
      }
    }),
    ...allUs.map(async (ticker) => {
      const cached = await cache.getRefPrice(ticker, usRefDate);
      if (cached !== null) {
        result[ticker] = { refPrice: cached, refDate: usRefDate };
      } else {
        uncachedUs.push(ticker);
      }
    }),
  ]);

  if (uncachedKr.length === 0 && uncachedUs.length === 0) {
    return NextResponse.json(result);
  }

  // KIS API 토큰 획득
  const appKey = process.env.KIS_APP_KEY ?? "";
  const appSecret = process.env.KIS_APP_SECRET ?? "";
  const nowKST = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const todayStr = toDateStr(nowKST);

  let accessToken: string | null = await cache.getKisToken(todayStr);
  if (!accessToken) {
    accessToken = await fetchKisToken(appKey, appSecret);
    if (accessToken) await cache.setKisToken(accessToken, todayStr);
  }

  if (!accessToken) {
    for (const ticker of [...uncachedKr, ...uncachedUs]) result[ticker] = null;
    return NextResponse.json(result);
  }

  await Promise.all([
    ...uncachedKr.map(async (ticker) => {
      console.log(`[RefPrice KIS 국내 조회] ${ticker}/${krRefDate}`);
      const price = await fetchDomesticHistoricalPrice(ticker, krRefDate, accessToken!, appKey, appSecret);
      if (price !== null) {
        result[ticker] = { refPrice: price, refDate: krRefDate };
        await cache.setRefPrice(ticker, krRefDate, price);
      } else {
        result[ticker] = null;
      }
    }),
    ...uncachedUs.map(async (ticker) => {
      console.log(`[RefPrice KIS 해외 조회] ${ticker}/${usRefDate}`);
      const price = await fetchOverseasHistoricalPrice(ticker, usRefDate, accessToken!, appKey, appSecret);
      if (price !== null) {
        result[ticker] = { refPrice: price, refDate: usRefDate };
        await cache.setRefPrice(ticker, usRefDate, price);
      } else {
        result[ticker] = null;
      }
    }),
  ]);

  return NextResponse.json(result);
}
