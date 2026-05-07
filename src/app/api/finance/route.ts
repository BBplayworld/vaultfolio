/**
 * /api/finance
 * 주식 현재가 및 환율을 스토리지 어댑터를 통해 제공합니다.
 *
 * 스토리지 전략:
 *   - 로컬 개발: data/finance-cache.json 파일 캐시 (FileCacheStorage)
 *   - Vercel 배포: Upstash for Redis (UpstashCacheStorage)
 *
 * 캐시 키 전략: "티커-날짜" (예: "TSLA-2026-03-20")
 *
 * 처리 흐름:
 *   1단계. 스토리지 캐시 확인
 *   2단계. 미캐시 항목만 외부 API 호출 (1일 1회)
 *   3단계. 스토리지 캐시 갱신
 */

import { NextResponse } from "next/server";
import {
  classifyTickers,
  fetchStocksFromKisOverseas,
  fetchKisToken,
  fetchStocksFromKorea,
  fetchExchangeRateFromKis,
} from "@/lib/finance-service";
import { getCacheStorage, getEffectiveDateStr } from "@/lib/cache-storage";

const KIS_APP_KEY = process.env.KIS_APP_KEY || "";
const KIS_APP_SECRET = process.env.KIS_APP_SECRET || "";

function stockCacheKey(ticker: string, date: string): string {
  return `${ticker}-${date}`;
}

// KIS access_token: 오늘자 캐시 확인 → 없으면 신규 발급 후 저장
async function getKisAccessToken(todayStr: string): Promise<string | null> {
  const storage = getCacheStorage();
  const cached = await storage.getKisToken(todayStr);
  if (cached) return cached;
  const token = await fetchKisToken(KIS_APP_KEY, KIS_APP_SECRET);
  if (token) await storage.setKisToken(token, todayStr);
  return token;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type");
  const todayStr = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().split("T")[0];
  const storage = getCacheStorage();

  // ── 환율 조회 ──────────────────────────────────────────────────────────

  if (type === "exchange") {
    const effectiveDateExchange = getEffectiveDateStr("exchange");
    // 1단계: 캐시 확인 (유효 날짜 기준)
    const cached = await storage.getExchange();
    if (cached?.updated_at === effectiveDateExchange) return NextResponse.json(cached);

    // 2단계: 외부 API 호출
    const accessTokenForExchange = await getKisAccessToken(todayStr);
    const rates = accessTokenForExchange
      ? await fetchExchangeRateFromKis(accessTokenForExchange, KIS_APP_KEY, KIS_APP_SECRET, effectiveDateExchange)
      : null;
    if (rates) {
      // 3단계: 캐시 갱신
      await storage.setExchange(rates);
      return NextResponse.json(rates);
    }

    // 외부 API 실패 시 기존 캐시로 fallback
    if (cached) return NextResponse.json(cached);
    return NextResponse.json({ error: "환율 조회 실패" }, { status: 500 });
  }

  // ── 주식 현재가 조회 ──────────────────────────────────────────────────

  if (type === "stock") {
    const tickers = (
      searchParams.get("tickers")?.split(",").map((t) => t.trim()) || []
    ).slice(0, 3);
    if (tickers.length === 0) {
      return NextResponse.json({ error: "티커 없음" }, { status: 400 });
    }

    const effectiveDateForeign = getEffectiveDateStr("foreign");
    const effectiveDateDomestic = getEffectiveDateStr("domestic");
    const { usTickers, krTickers } = classifyTickers(tickers);

    const results: Record<string, { price: number; name: string; updated_at: string }> = {};
    const uncachedUs: string[] = [];
    const uncachedKr: string[] = [];

    // 1단계: 캐시 확인 (국내/해외 유효 날짜 각각 적용)
    for (const ticker of usTickers) {
      const cached = await storage.getStock(stockCacheKey(ticker, effectiveDateForeign));
      if (cached) results[ticker] = cached;
      else uncachedUs.push(ticker);
    }
    for (const ticker of krTickers) {
      const cached = await storage.getStock(stockCacheKey(ticker, effectiveDateDomestic));
      if (cached) results[ticker] = cached;
      else uncachedKr.push(ticker);
    }

    if (uncachedUs.length === 0 && uncachedKr.length === 0) return NextResponse.json(results);

    // 2단계: 미캐시 항목만 외부 API 호출
    const apiResults: Record<string, { price: number; name: string; updated_at: string }> = {};

    if (uncachedUs.length > 0) {
      const accessToken = await getKisAccessToken(todayStr);
      if (accessToken) {
        const res = await fetchStocksFromKisOverseas(uncachedUs, effectiveDateForeign, accessToken, KIS_APP_KEY, KIS_APP_SECRET);
        Object.assign(apiResults, res);
      }
    }

    if (uncachedKr.length > 0) {
      const accessToken = await getKisAccessToken(todayStr);
      if (accessToken) {
        const res = await fetchStocksFromKorea(uncachedKr, effectiveDateDomestic, accessToken, KIS_APP_KEY, KIS_APP_SECRET);
        Object.assign(apiResults, res);
      }
    }

    // 3단계: 캐시 갱신 (국내/해외 날짜 각각 적용)
    for (const [ticker, result] of Object.entries(apiResults)) {
      const isUs = usTickers.includes(ticker);
      const effectiveDate = isUs ? effectiveDateForeign : effectiveDateDomestic;
      await storage.setStock(stockCacheKey(ticker, effectiveDate), result, effectiveDate, ticker);
    }

    return NextResponse.json({ ...results, ...apiResults });
  }

  return NextResponse.json({ error: "잘못된 요청" }, { status: 400 });
}
