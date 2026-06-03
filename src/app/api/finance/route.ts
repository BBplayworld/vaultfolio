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
  StockPriceResult,
} from "@/lib/finance-service";
import { getCacheStorage, getEffectiveDateStr, getStockCacheSlot } from "@/lib/cache-storage";

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
    if (cached?.updated_at === effectiveDateExchange) {
      return NextResponse.json({ ...cached, history: await storage.getExchangeHistory() });
    }

    // 2단계: 외부 API 호출
    const accessTokenForExchange = await getKisAccessToken(todayStr);
    const rates = accessTokenForExchange
      ? await fetchExchangeRateFromKis(accessTokenForExchange, KIS_APP_KEY, KIS_APP_SECRET, effectiveDateExchange)
      : null;
    if (rates) {
      // 3단계: 캐시 갱신
      await storage.setExchange(rates);
      return NextResponse.json({ ...rates, history: await storage.getExchangeHistory() });
    }

    // 외부 API 실패 시 기존 캐시로 fallback
    if (cached) return NextResponse.json({ ...cached, history: await storage.getExchangeHistory() });
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
    const slotForeign = getStockCacheSlot("foreign");
    const slotDomestic = getStockCacheSlot("domestic");
    const { usTickers, krTickers } = classifyTickers(tickers);

    const results: Record<string, StockPriceResult> = {};
    const uncachedUs: string[] = [];
    const uncachedKr: string[] = [];

    // 1단계: 캐시 확인 (국내/해외 슬롯 각각 적용 — 장중 1시간 단위)
    // X-Ray 분류(classification) 필드가 없는 옛 캐시는 미캐시로 처리해 재조회 트리거
    for (const ticker of usTickers) {
      const cached = await storage.getStock(stockCacheKey(ticker, slotForeign));
      if (cached && cached.classification) results[ticker] = cached;
      else uncachedUs.push(ticker);
    }
    for (const ticker of krTickers) {
      const cached = await storage.getStock(stockCacheKey(ticker, slotDomestic));
      if (cached && cached.classification) results[ticker] = cached;
      else uncachedKr.push(ticker);
    }

    if (uncachedUs.length === 0 && uncachedKr.length === 0) return NextResponse.json(results);

    // 2단계: 미캐시 항목만 외부 API 호출
    const apiResults: Record<string, StockPriceResult> = {};

    if (uncachedUs.length > 0) {
      const accessToken = await getKisAccessToken(todayStr);
      if (accessToken) {
        const { prices, classifications } = await fetchStocksFromKisOverseas(uncachedUs, effectiveDateForeign, accessToken, KIS_APP_KEY, KIS_APP_SECRET);
        for (const [ticker, cls] of Object.entries(classifications)) {
          if (prices[ticker]) prices[ticker].classification = cls;
          // 90일 분류 캐시에도 머지 저장 — Gemini themes가 없어도 region/marketCapTier/indices는 보존
          await storage.setStockClassification(ticker, cls as unknown as Record<string, unknown>);
        }
        Object.assign(apiResults, prices);
      } else {
        console.error(`[KIS 토큰 없음 - 해외주식 조회 스킵]: ${uncachedUs.join(",")}`);
      }
    }

    if (uncachedKr.length > 0) {
      const accessToken = await getKisAccessToken(todayStr);
      if (accessToken) {
        const { prices, classifications } = await fetchStocksFromKorea(uncachedKr, effectiveDateDomestic, accessToken, KIS_APP_KEY, KIS_APP_SECRET);
        for (const [ticker, cls] of Object.entries(classifications)) {
          if (prices[ticker]) prices[ticker].classification = cls;
          await storage.setStockClassification(ticker, cls as unknown as Record<string, unknown>);
        }
        Object.assign(apiResults, prices);
      } else {
        console.error(`[KIS 토큰 없음 - 국내주식 조회 스킵]: ${uncachedKr.join(",")}`);
      }
    }

    // 3단계: 캐시 갱신 (국내/해외 슬롯 각각 적용 — 장중 1시간 단위)
    for (const [ticker, result] of Object.entries(apiResults)) {
      const isUs = usTickers.includes(ticker);
      const slot = isUs ? slotForeign : slotDomestic;
      await storage.setStock(stockCacheKey(ticker, slot), result, slot, ticker);
    }

    return NextResponse.json({ ...results, ...apiResults });
  }

  return NextResponse.json({ error: "잘못된 요청" }, { status: 400 });
}
