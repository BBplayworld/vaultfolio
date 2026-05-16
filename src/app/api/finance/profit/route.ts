import { NextRequest, NextResponse } from "next/server";
import { getCacheStorage } from "@/lib/cache-storage";
import {
  fetchKisToken,
  fetchDomesticHistoricalPrice,
  fetchOverseasHistoricalPrice,
  classifyTickers,
} from "@/lib/finance-service";
import { getDailyClosingRefDates } from "@/lib/profit-utils";
import { getStockCacheSlot, getEffectiveDateStr } from "@/lib/stock-cache-slot";

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

// 서버 STOCKS 캐시의 market 필드 → KIS 해외 EXCD 코드
function marketToExcd(market: string | undefined): string | undefined {
  if (market === "NASDAQ") return "NAS";
  if (market === "NYSE") return "NYS";
  if (market === "AMEX") return "AMS";
  return undefined;
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

  // 요청일 → 응답일 색인 lookup → 응답일로 가격 조회 (둘 중 하나라도 miss면 KIS 호출)
  const lookupCached = async (
    ticker: string,
    requestDate: string,
  ): Promise<{ price: number; actualDate: string } | null> => {
    const actualDate = await cache.getRefDateForRequest(ticker, requestDate, period);
    if (!actualDate) return null;
    const price = await cache.getRefPrice(ticker, actualDate);
    if (price === null) return null;
    return { price, actualDate };
  };

  await Promise.all([
    ...allKr.map(async (ticker) => {
      const refHit = await lookupCached(ticker, krDates.refDate);
      if (refHit) {
        const e = ensureEntry(ticker);
        e.refPrice = refHit.price;
        e.refDate = refHit.actualDate;
      } else {
        fetchQueue.push({ ticker, date: krDates.refDate, kind: "ref", market: "domestic" });
      }
      if (krDates.prevDate) {
        const prevHit = await lookupCached(ticker, krDates.prevDate);
        if (prevHit) {
          const e = ensureEntry(ticker);
          e.prevPrice = prevHit.price;
          e.prevDate = prevHit.actualDate;
        } else {
          fetchQueue.push({ ticker, date: krDates.prevDate, kind: "prev", market: "domestic" });
        }
      }
    }),
    ...allUs.map(async (ticker) => {
      const refHit = await lookupCached(ticker, usDates.refDate);
      if (refHit) {
        const e = ensureEntry(ticker);
        e.refPrice = refHit.price;
        e.refDate = refHit.actualDate;
      } else {
        fetchQueue.push({ ticker, date: usDates.refDate, kind: "ref", market: "foreign" });
      }
      if (usDates.prevDate) {
        const prevHit = await lookupCached(ticker, usDates.prevDate);
        if (prevHit) {
          const e = ensureEntry(ticker);
          e.prevPrice = prevHit.price;
          e.prevDate = prevHit.actualDate;
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

  // 해외 종목별 EXCD를 STOCKS 캐시에서 사전 조회 (장중 슬롯과 effectiveDate 슬롯 모두 시도)
  // 클라이언트 배치(BATCH_SIZE=3, 1초 간격)가 KIS rate limit을 흡수하므로 서버는 단순 Promise.all
  const foreignEffective = getEffectiveDateStr("foreign");
  const foreignSlot = getStockCacheSlot("foreign");
  const excdByTicker = new Map<string, string | undefined>();
  await Promise.all(
    allUs.map(async (ticker) => {
      const tryKeys = foreignSlot !== foreignEffective
        ? [`${ticker}-${foreignSlot}`, `${ticker}-${foreignEffective}`]
        : [`${ticker}-${foreignEffective}`];
      for (const key of tryKeys) {
        const st = await cache.getStock(key);
        if (st?.market) {
          excdByTicker.set(ticker, marketToExcd(st.market));
          return;
        }
      }
      excdByTicker.set(ticker, undefined);
    }),
  );

  await Promise.all(
    fetchQueue.map(async (task) => {
      const isDomestic = task.market === "domestic";
      const res = isDomestic
        ? await fetchDomesticHistoricalPrice(task.ticker, task.date, accessToken!, appKey, appSecret)
        : await fetchOverseasHistoricalPrice(task.ticker, task.date, accessToken!, appKey, appSecret, excdByTicker.get(task.ticker));
      if (res !== null) {
        await cache.setRefPrice(task.ticker, res.date, res.price, period);
        // 요청일이 응답일과 다를 수 있음 → 매핑 기록으로 다음 호출 영구 hit
        await cache.setRefDateForRequest(task.ticker, task.date, res.date, period);
        const e = ensureEntry(task.ticker);
        if (task.kind === "ref") {
          e.refPrice = res.price;
          e.refDate = res.date;
        } else {
          e.prevPrice = res.price;
          e.prevDate = res.date;
        }
      }
    }),
  );

  // ref 종가 자체가 없는 종목은 null로 마무리
  for (const ticker of [...allKr, ...allUs]) {
    const e = result[ticker];
    if (!e || !e.refDate) result[ticker] = null;
  }

  return NextResponse.json(result);
}
