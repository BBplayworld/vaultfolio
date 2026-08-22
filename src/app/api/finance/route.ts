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
  fetchStocksFromKorea,
  fetchDomesticClassifications,
  fetchExchangeRateFromKis,
  StockPriceResult,
  StockClassificationPatch,
} from "@/lib/finance/finance-service";
import { getCacheStorage, getEffectiveDateStr, getStockCacheSlot } from "@/lib/cache-storage";
import { getKisAccessToken, recordKisFailure, recordKisSuccess } from "@/lib/finance/kis-token";

const KIS_APP_KEY = process.env.KIS_APP_KEY || "";
const KIS_APP_SECRET = process.env.KIS_APP_SECRET || "";

// KIS 외부 API 일시 오류 신호 헤더 (5회 이상 토큰 발급 실패 시)
const KIS_UNAVAILABLE_HEADER = { "X-KIS-Unavailable": "1" } as const;

function stockCacheKey(ticker: string, date: string): string {
  return `${ticker}-${date}`;
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
    const { token: accessTokenForExchange, unavailable } = await getKisAccessToken(todayStr);
    const rates = accessTokenForExchange
      ? await fetchExchangeRateFromKis(accessTokenForExchange, KIS_APP_KEY, KIS_APP_SECRET, effectiveDateExchange)
      : null;
    if (rates) {
      // 3단계: 캐시 갱신
      await storage.setExchange(rates);
      await recordKisSuccess();
      return NextResponse.json({ ...rates, history: await storage.getExchangeHistory() });
    }

    // 토큰은 유효했으나(캐시 hit) 환율 조회 자체가 전량 실패 = 토큰 발급 후·만료 전에
    // KIS 점검이 시작된 경우 → 서킷에 반영해 오늘자 동기화에도 일시 오류 신호 전달
    let unavailableNow = unavailable;
    if (accessTokenForExchange && !rates) {
      unavailableNow = await recordKisFailure();
    }
    const headers = unavailableNow ? KIS_UNAVAILABLE_HEADER : undefined;
    // 외부 API 실패 시 기존 캐시로 fallback
    if (cached) return NextResponse.json({ ...cached, history: await storage.getExchangeHistory() }, { headers });
    return NextResponse.json({ error: "환율 조회 실패" }, { status: 500, headers });
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
    // 국내 분류(region/KOSPI200 등)는 가격(1시간 슬롯)과 별도로 90일 캐시를 쓴다 — 가격 캐시 hit 여부와 무관하게 항상 확인
    const uncachedClassificationKr: string[] = [];
    const classificationKr: Record<string, StockClassificationPatch> = {};

    // 1단계: 캐시 확인
    // 해외: X-Ray 분류(classification) 필드가 없는 옛 캐시는 미캐시로 처리해 재조회 트리거(기존과 동일)
    for (const ticker of usTickers) {
      const cached = await storage.getStock(stockCacheKey(ticker, slotForeign));
      if (cached && cached.classification) results[ticker] = cached;
      else uncachedUs.push(ticker);
    }
    // 국내: 가격 캐시(1시간)와 분류 캐시(90일)를 독립적으로 확인
    for (const ticker of krTickers) {
      const cachedPrice = await storage.getStock(stockCacheKey(ticker, slotDomestic));
      if (cachedPrice) results[ticker] = cachedPrice;
      else uncachedKr.push(ticker);

      const cachedCls = await storage.getStockClassification(ticker);
      if (cachedCls) classificationKr[ticker] = cachedCls as unknown as StockClassificationPatch;
      else uncachedClassificationKr.push(ticker);
    }

    if (uncachedUs.length === 0 && uncachedKr.length === 0 && uncachedClassificationKr.length === 0) {
      for (const ticker of krTickers) {
        if (results[ticker] && classificationKr[ticker] && !results[ticker].classification) {
          results[ticker] = { ...results[ticker], classification: classificationKr[ticker] };
        }
      }
      return NextResponse.json(results);
    }

    // 2단계: 미캐시 항목만 외부 API 호출
    const apiResults: Record<string, StockPriceResult> = {};
    let kisUnavailable = false;
    let attemptedFetch = false;
    let anySuccess = false;

    if (uncachedUs.length > 0) {
      const { token: accessToken, unavailable } = await getKisAccessToken(todayStr);
      kisUnavailable = kisUnavailable || unavailable;
      if (accessToken) {
        attemptedFetch = true;
        const { prices, classifications } = await fetchStocksFromKisOverseas(uncachedUs, effectiveDateForeign, accessToken, KIS_APP_KEY, KIS_APP_SECRET);
        if (Object.keys(prices).length > 0) anySuccess = true;
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

    // 국내 가격 조회(실시간, inquire-price) — 서킷 open이면 스킵
    if (uncachedKr.length > 0 && !kisUnavailable) {
      const { token: accessToken, unavailable } = await getKisAccessToken(todayStr);
      kisUnavailable = kisUnavailable || unavailable;
      if (accessToken) {
        attemptedFetch = true;
        const { prices } = await fetchStocksFromKorea(uncachedKr, effectiveDateDomestic, accessToken, KIS_APP_KEY, KIS_APP_SECRET);
        if (Object.keys(prices).length > 0) anySuccess = true;
        Object.assign(apiResults, prices);
      } else {
        console.error(`[KIS 토큰 없음 - 국내주식 조회 스킵]: ${uncachedKr.join(",")}`);
      }
    }

    // 국내 분류 조회(90일 캐시 없는 티커만) — 가격 조회 성패와 무관하게 독립 수행.
    // 실패해도 setStockClassification을 호출하지 않아 캐시를 오염시키지 않고 다음 요청에서 자연 재시도된다.
    if (uncachedClassificationKr.length > 0 && !kisUnavailable) {
      const { token: accessToken, unavailable } = await getKisAccessToken(todayStr);
      kisUnavailable = kisUnavailable || unavailable;
      if (accessToken) {
        const { classifications } = await fetchDomesticClassifications(uncachedClassificationKr, accessToken, KIS_APP_KEY, KIS_APP_SECRET);
        for (const [ticker, cls] of Object.entries(classifications)) {
          classificationKr[ticker] = cls;
          await storage.setStockClassification(ticker, cls as unknown as Record<string, unknown>);
        }
      } else {
        console.error(`[KIS 토큰 없음 - 국내주식 분류 조회 스킵]: ${uncachedClassificationKr.join(",")}`);
      }
    }

    // 국내 가격(캐시 또는 신규)에 분류(캐시 또는 신규)를 병합 — 가격 소스와 무관하게 한 번에 처리
    for (const ticker of krTickers) {
      const cls = classificationKr[ticker];
      if (!cls) continue;
      if (results[ticker] && !results[ticker].classification) results[ticker] = { ...results[ticker], classification: cls };
      if (apiResults[ticker] && !apiResults[ticker].classification) apiResults[ticker].classification = cls;
    }

    // 3단계: 캐시 갱신 (국내/해외 슬롯 각각 적용 — 장중 1시간 단위)
    for (const [ticker, result] of Object.entries(apiResults)) {
      const isUs = usTickers.includes(ticker);
      const slot = isUs ? slotForeign : slotDomestic;
      await storage.setStock(stockCacheKey(ticker, slot), result, slot, ticker);
    }

    // 토큰은 유효했으나(캐시 hit) 조회가 전량 실패 = 토큰 발급 후·만료 전에 KIS 점검이
    // 시작된 경우 → 서킷에 반영. 개별 티커 1~2개 실패(신규상장 등)는 anySuccess가 true라 무시.
    if (attemptedFetch) {
      if (anySuccess) {
        await recordKisSuccess();
      } else {
        kisUnavailable = await recordKisFailure();
      }
    }

    return NextResponse.json(
      { ...results, ...apiResults },
      kisUnavailable ? { headers: KIS_UNAVAILABLE_HEADER } : undefined
    );
  }

  return NextResponse.json({ error: "잘못된 요청" }, { status: 400 });
}
