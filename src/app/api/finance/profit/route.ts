import { NextRequest, NextResponse } from "next/server";
import { getCacheStorage } from "@/lib/cache-storage";
import {
  fetchKisToken,
  fetchDomesticHistoricalPrice,
  fetchOverseasHistoricalPrice,
  classifyTickers,
} from "@/lib/finance-service";
import { getDailyClosingRefDates } from "@/lib/profit-utils";

export type ProfitPeriod = "daily" | "weekly" | "monthly" | "yearly";

export interface ProfitRefEntry {
  refPrice: number;
  refDate: string;
  prevPrice?: number;
  prevDate?: string;
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

// daily만 두 날짜(prev, ref) 반환, 나머지는 단일 ref만
function getDates(period: ProfitPeriod, market: "domestic" | "foreign"): { refDate: string; prevDate?: string } {
  const now = getKSTNow();
  if (period === "daily") return getDailyClosingRefDates(market);
  if (period === "weekly") return { refDate: toDateStr(subtractWeekdays(now, 5)) };
  if (period === "monthly") return { refDate: toDateStr(subtractCalendarMonths(now, 1)) };
  return { refDate: toDateStr(subtractCalendarYears(now, 1)) };
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const tickersParam = searchParams.get("tickers") ?? "";
  const period = (searchParams.get("period") ?? "daily") as ProfitPeriod;

  const tickers = Array.from(new Set(
    tickersParam
      .split(",")
      .map((t) => t.trim().toUpperCase())
      .filter(Boolean)
  ));

  if (tickers.length === 0) {
    return NextResponse.json({});
  }

  const krDates = getDates(period, "domestic");
  const usDates = getDates(period, "foreign");
  const cache = getCacheStorage();
  const result: ProfitRefResponse = {};

  const { krTickers: allKr, usTickers: allUs } = classifyTickers(tickers);

  // 종목별로 ref/prev 캐시 조회 → 누락된 경우 fetch 큐에 추가
  type FetchTask = { ticker: string; date: string; kind: "ref" | "prev"; market: "domestic" | "foreign" };
  const fetchQueue: FetchTask[] = [];
  const ensureEntry = (ticker: string) => {
    if (!result[ticker]) result[ticker] = { refPrice: 0, refDate: "" };
    return result[ticker]!;
  };

  await Promise.all([
    ...allKr.map(async (ticker) => {
      const refCached = await cache.getRefPrice(ticker, krDates.refDate);
      if (refCached !== null) {
        const e = ensureEntry(ticker);
        e.refPrice = refCached;
        e.refDate = krDates.refDate;
      } else {
        fetchQueue.push({ ticker, date: krDates.refDate, kind: "ref", market: "domestic" });
      }
      if (krDates.prevDate) {
        const prevCached = await cache.getRefPrice(ticker, krDates.prevDate);
        if (prevCached !== null) {
          const e = ensureEntry(ticker);
          e.prevPrice = prevCached;
          e.prevDate = krDates.prevDate;
        } else {
          fetchQueue.push({ ticker, date: krDates.prevDate, kind: "prev", market: "domestic" });
        }
      }
    }),
    ...allUs.map(async (ticker) => {
      const refCached = await cache.getRefPrice(ticker, usDates.refDate);
      if (refCached !== null) {
        const e = ensureEntry(ticker);
        e.refPrice = refCached;
        e.refDate = usDates.refDate;
      } else {
        fetchQueue.push({ ticker, date: usDates.refDate, kind: "ref", market: "foreign" });
      }
      if (usDates.prevDate) {
        const prevCached = await cache.getRefPrice(ticker, usDates.prevDate);
        if (prevCached !== null) {
          const e = ensureEntry(ticker);
          e.prevPrice = prevCached;
          e.prevDate = usDates.prevDate;
        } else {
          fetchQueue.push({ ticker, date: usDates.prevDate, kind: "prev", market: "foreign" });
        }
      }
    }),
  ]);

  // 캐시 hit으로 모두 충족 → 미설정 종목은 null 처리
  if (fetchQueue.length === 0) {
    for (const ticker of [...allKr, ...allUs]) {
      if (!result[ticker] || !result[ticker]!.refDate) result[ticker] = null;
    }
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
    console.error(`[KIS 토큰 없음 - 과거종가 조회 스킵]: ${fetchQueue.map((t) => t.ticker).join(",")}`);
    for (const ticker of [...allKr, ...allUs]) {
      if (!result[ticker] || !result[ticker]!.refDate) result[ticker] = null;
    }
    return NextResponse.json(result);
  }

  await Promise.all(
    fetchQueue.map(async (task) => {
      const fetcher = task.market === "domestic" ? fetchDomesticHistoricalPrice : fetchOverseasHistoricalPrice;
      const res = await fetcher(task.ticker, task.date, accessToken!, appKey, appSecret);
      if (res !== null) {
        await cache.setRefPrice(task.ticker, res.date, res.price, period);
        const e = ensureEntry(task.ticker);
        if (task.kind === "ref") {
          e.refPrice = res.price;
          e.refDate = res.date;
        } else {
          e.prevPrice = res.price;
          e.prevDate = res.date;
        }
      }
    })
  );

  // ref 종가 자체가 없는 종목은 null로 마무리
  for (const ticker of [...allKr, ...allUs]) {
    const e = result[ticker];
    if (!e || !e.refDate) result[ticker] = null;
  }

  return NextResponse.json(result);
}
