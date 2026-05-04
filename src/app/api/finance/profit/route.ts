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

function getKSTNow(): Date {
  return new Date(Date.now() + 9 * 60 * 60 * 1000);
}

function toDateStr(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

// 토/일만 건너뛰는 단순 rollback (N 영업일 전)
function subtractWeekdays(from: Date, n: number): Date {
  const d = new Date(from);
  let count = 0;
  while (count < n) {
    d.setUTCDate(d.getUTCDate() - 1);
    const day = d.getUTCDay();
    if (day !== 0 && day !== 6) count++;
  }
  return d;
}

// 달력 기준 N개월 전, 토/일이면 금요일로 rollback
function subtractCalendarMonths(from: Date, months: number): Date {
  const d = new Date(from);
  d.setUTCMonth(d.getUTCMonth() - months);
  while (d.getUTCDay() === 0 || d.getUTCDay() === 6) {
    d.setUTCDate(d.getUTCDate() - 1);
  }
  return d;
}

// 달력 기준 N년 전, 토/일이면 금요일로 rollback
function subtractCalendarYears(from: Date, years: number): Date {
  const d = new Date(from);
  d.setUTCFullYear(d.getUTCFullYear() - years);
  while (d.getUTCDay() === 0 || d.getUTCDay() === 6) {
    d.setUTCDate(d.getUTCDate() - 1);
  }
  return d;
}

function getRefDate(period: ProfitPeriod): string {
  const now = getKSTNow();
  if (period === "daily") return toDateStr(subtractWeekdays(now, 2));
  if (period === "weekly") return toDateStr(subtractWeekdays(now, 5));
  if (period === "monthly") return toDateStr(subtractCalendarMonths(now, 1));
  // yearly
  return toDateStr(subtractCalendarYears(now, 1));
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
  const cache = getCacheStorage();
  const result: ProfitRefResponse = {};

  const { krTickers: allKr, usTickers: allUs } = classifyTickers(tickers);
  const uncachedKr: string[] = [];
  const uncachedUs: string[] = [];

  await Promise.all([
    ...allKr.map(async (ticker) => {
      const cached = await cache.getRefPrice(ticker, refDate);
      if (cached !== null) {
        result[ticker] = { refPrice: cached, refDate };
      } else {
        uncachedKr.push(ticker);
      }
    }),
    ...allUs.map(async (ticker) => {
      const cached = await cache.getRefPrice(ticker, refDate);
      if (cached !== null) {
        result[ticker] = { refPrice: cached, refDate };
      } else {
        uncachedUs.push(ticker);
      }
    }),
  ]);

  if (uncachedKr.length === 0 && uncachedUs.length === 0) {
    return NextResponse.json(result);
  }

  const appKey = process.env.KIS_APP_KEY ?? "";
  const appSecret = process.env.KIS_APP_SECRET ?? "";
  const nowKST = getKSTNow();
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
      console.log(`[RefPrice KIS 국내 조회] ${ticker}/${refDate}`);
      const res = await fetchDomesticHistoricalPrice(ticker, refDate, accessToken!, appKey, appSecret);
      if (res !== null) {
        result[ticker] = { refPrice: res.price, refDate: res.date };
        await cache.setRefPrice(ticker, res.date, res.price, period);
      } else {
        result[ticker] = null;
      }
    }),
    ...uncachedUs.map(async (ticker) => {
      console.log(`[RefPrice KIS 해외 조회] ${ticker}/${refDate}`);
      const res = await fetchOverseasHistoricalPrice(ticker, refDate, accessToken!, appKey, appSecret);
      if (res !== null) {
        result[ticker] = { refPrice: res.price, refDate: res.date };
        await cache.setRefPrice(ticker, res.date, res.price, period);
      } else {
        result[ticker] = null;
      }
    }),
  ]);

  return NextResponse.json(result);
}
