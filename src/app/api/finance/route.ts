/**
 * /api/finance
 * 주식 현재가 및 환율을 서버 파일 캐시를 통해 제공합니다.
 *
 * 캐시 키 전략: "티커-날짜" (예: "TSLA-2026-03-20")
 * → 동일 종목의 당일 캐시 존재 여부를 O(1)로 판단하며,
 *   만료된 이전 날짜 항목은 자동으로 무시됩니다.
 *
 * 처리 흐름:
 *   1단계. 서버 파일 캐시 확인 ("티커-날짜" 키 기준)
 *   2단계. 미캐시 항목만 외부 API 호출 (1일 1회)
 *   3단계. 서버 파일 캐시 갱신
 */

import { NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";
import {
  StockPriceResult,
  ExchangeRates,
  classifyTickers,
  fetchStocksFromTwelveData,
  fetchStocksFromYahooFinance,
  fetchExchangeRatesFromTwelveData,
} from "@/lib/finance-service";

const CACHE_PATH = path.join(process.cwd(), "data", "finance-cache.json");
const API_KEY = process.env.TWELVE_DATA_API_KEY || "";

// 서버 파일 캐시 구조
// STOCKS 키는 "티커-날짜" 형식 (예: "TSLA-2026-03-20")
interface CacheStructure {
  EXCHANGE?: ExchangeRates;
  STOCKS?: Record<string, StockPriceResult>;
}

function stockCacheKey(ticker: string, date: string): string {
  return `${ticker}-${date}`;
}

function readCache(): CacheStructure {
  if (!fs.existsSync(CACHE_PATH)) return { STOCKS: {} };
  try {
    return JSON.parse(fs.readFileSync(CACHE_PATH, "utf8"));
  } catch {
    return { STOCKS: {} };
  }
}

function writeCache(cache: CacheStructure): void {
  try {
    fs.mkdirSync(path.dirname(CACHE_PATH), { recursive: true });
    fs.writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2), "utf8");
  } catch (e) {
    console.error("[캐시 저장 오류]:", e);
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type");
  const todayStr = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().split("T")[0];

  const cache = readCache();

  // ── 환율 조회 ──────────────────────────────────────────────────────────

  if (type === "exchange") {
    // 1단계: 서버 캐시 확인
    if (cache.EXCHANGE?.updated_at === todayStr) {
      return NextResponse.json(cache.EXCHANGE);
    }

    // 2단계: 외부 API 호출
    const rates = await fetchExchangeRatesFromTwelveData(API_KEY, todayStr);
    if (rates) {
      // 3단계: 서버 캐시 갱신
      cache.EXCHANGE = rates;
      writeCache(cache);
      return NextResponse.json(rates);
    }

    // 외부 API 실패 시 기존 캐시로 fallback
    if (cache.EXCHANGE) return NextResponse.json(cache.EXCHANGE);
    return NextResponse.json({ error: "환율 조회 실패" }, { status: 500 });
  }

  // ── 주식 현재가 조회 ──────────────────────────────────────────────────

  if (type === "stock") {
    const tickers =
      searchParams.get("tickers")?.split(",").map((t) => t.trim().toUpperCase()) || [];
    if (tickers.length === 0) {
      return NextResponse.json({ error: "티커 없음" }, { status: 400 });
    }

    if (!cache.STOCKS) cache.STOCKS = {};

    const results: Record<string, StockPriceResult> = {};
    const uncachedTickers: string[] = [];

    // 1단계: 서버 캐시 확인 ("티커-날짜" 키 기준)
    for (const ticker of tickers) {
      const cached = cache.STOCKS[stockCacheKey(ticker, todayStr)];
      if (cached) {
        results[ticker] = cached;
      } else {
        uncachedTickers.push(ticker);
      }
    }

    if (uncachedTickers.length === 0) {
      return NextResponse.json(results);
    }

    // 2단계: 미캐시 항목만 외부 API 호출 (국내/해외 분류)
    const { usTickers, krTickers } = classifyTickers(uncachedTickers);
    const apiResults: Record<string, StockPriceResult> = {};

    if (usTickers.length > 0) {
      const res = await fetchStocksFromTwelveData(usTickers.slice(0, 2), API_KEY, todayStr);
      Object.assign(apiResults, res);
    }

    if (krTickers.length > 0) {
      const res = await fetchStocksFromYahooFinance(krTickers.slice(0, 2), todayStr);
      Object.assign(apiResults, res);
    }

    // 3단계: 서버 캐시 갱신 ("티커-날짜" 키로 저장)
    if (Object.keys(apiResults).length > 0) {
      for (const [ticker, result] of Object.entries(apiResults)) {
        cache.STOCKS[stockCacheKey(ticker, todayStr)] = result;
      }
      writeCache(cache);
    }

    return NextResponse.json({ ...results, ...apiResults });
  }

  return NextResponse.json({ error: "잘못된 요청" }, { status: 400 });
}
