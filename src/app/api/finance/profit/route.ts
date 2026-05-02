import { NextRequest, NextResponse } from "next/server";
import { getCacheStorage } from "@/lib/cache-storage";
import {
  fetchKisToken,
  fetchDomesticHistoricalPrice,
  fetchOverseasHistoricalPrice,
  classifyTickers,
} from "@/lib/finance-service";
import {
  rollbackToBusinessDay as krRollback,
  forwardToBusinessDay as krForward,
} from "@/lib/kr-holidays";
import {
  rollbackToUsBusinessDay as usRollback,
  forwardToUsBusinessDay as usForward,
} from "@/lib/us-holidays";

export type ProfitPeriod = "daily" | "weekly" | "monthly" | "yearly";
type Market = "kr" | "us";

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

function getRefDate(period: ProfitPeriod, market: Market): string {
  const isKr = market === "kr";
  const rollback = isKr ? krRollback : usRollback;
  const forward = isKr ? krForward : usForward;
  const nowKST = getKSTDate(0);

  if (period === "daily") {
    // 현재가가 가리키는 영업일의 직전 영업일
    // (주말·연휴엔 현재가도 직전 영업일 종가이므로, 그 하루 전 영업일과 비교해야 의미 있음)
    const today = getKSTDate(0);
    const currentBiz = rollback(today);
    const prev = new Date(currentBiz);
    prev.setUTCDate(prev.getUTCDate() - 1);
    return toDateStr(rollback(prev));
  }

  if (period === "weekly") {
    // 지난주 금요일: 이번 주 월요일 기준 3일 전
    const d = getKSTDate(0);
    const day = d.getUTCDay();
    const daysToMonday = day === 0 ? 6 : day - 1;
    d.setUTCDate(d.getUTCDate() - daysToMonday - 3);
    return toDateStr(rollback(d));
  }

  if (period === "monthly") {
    const firstOfMonth = new Date(Date.UTC(nowKST.getUTCFullYear(), nowKST.getUTCMonth(), 1));
    const firstBizThisMonth = forward(firstOfMonth);
    const firstBizPlusOne = new Date(firstBizThisMonth);
    firstBizPlusOne.setUTCDate(firstBizPlusOne.getUTCDate() + 1);
    const todayStr = toDateStr(nowKST);
    const thresholdStr = toDateStr(firstBizPlusOne);

    // 오늘 <= 첫 영업일 + 1 → 지난달로 fallback (1일치 종가만으론 의미있는 변동률 X)
    if (todayStr <= thresholdStr) {
      const firstOfLastMonth = new Date(Date.UTC(nowKST.getUTCFullYear(), nowKST.getUTCMonth() - 1, 1));
      return toDateStr(forward(firstOfLastMonth));
    }
    return toDateStr(firstBizThisMonth);
  }

  // yearly: 올해 1월 2일 → 영업일 롤백
  const d = new Date(Date.UTC(nowKST.getUTCFullYear(), 0, 2));
  return toDateStr(rollback(d));
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

  const krRefDate = getRefDate(period, "kr");
  const usRefDate = getRefDate(period, "us");
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
        await cache.setRefPrice(ticker, krRefDate, price, period);
      } else {
        result[ticker] = null;
      }
    }),
    ...uncachedUs.map(async (ticker) => {
      console.log(`[RefPrice KIS 해외 조회] ${ticker}/${usRefDate}`);
      const price = await fetchOverseasHistoricalPrice(ticker, usRefDate, accessToken!, appKey, appSecret);
      if (price !== null) {
        result[ticker] = { refPrice: price, refDate: usRefDate };
        await cache.setRefPrice(ticker, usRefDate, price, period);
      } else {
        result[ticker] = null;
      }
    }),
  ]);

  return NextResponse.json(result);
}
