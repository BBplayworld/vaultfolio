import { NextRequest, NextResponse } from "next/server";
import { KR_CODES } from "@/lib/finance/kr-master";
import { US_TICKERS } from "@/lib/finance/us-master";
import { classifyTickers } from "@/lib/finance/finance-service";
import { getKisAccessToken, recordKisFailure, recordKisSuccess } from "@/lib/finance/kis-token";
import { fetchPriceHistory, PRICE_RANGES, MAX_PAGES } from "@/lib/finance/price-history";
import { badRequest, cdnCacheHeaders, guardRateLimit, guardRequest, isOneOf, parseTickerList, withinUpstreamBudget } from "@/server/api-guard";

// 종목 한 장(#157) 가격 흐름 — 요청 매개변수는 ticker·range뿐(수량·평단·날짜 없음), 응답은 모든 사용자에게 같아 CDN에만 캐시한다(Redis 키 0).

export const maxDuration = 20;

const NO_STORE = { "Cache-Control": "no-store" };
// 하루 한 점만 바뀌는 시계열 — 6시간
const CDN_MAX_AGE_SEC = 6 * 3600;

export async function GET(req: NextRequest) {
  const blocked = guardRequest(req, { route: "price-history", l1PerMinute: 60 });
  if (blocked) return blocked;

  const { searchParams } = req.nextUrl;
  const range = searchParams.get("range");
  if (!isOneOf(range, PRICE_RANGES)) return badRequest();
  const ticker = parseTickerList(searchParams.get("ticker")?.toUpperCase() ?? null, 1)[0];
  if (!ticker) return badRequest();

  const { krTickers, usTickers } = classifyTickers([ticker]);
  const market = krTickers.length > 0 ? "kr" : usTickers.length > 0 ? "us" : null;
  if (!market) {
    return NextResponse.json({ ticker, range, currency: "KRW", interval: "D", points: [] }, { headers: NO_STORE });
  }

  // CDN 미스일 때만 도달 — L2 한도·전역 예산(회차 상한만큼)
  const limited = await guardRateLimit(req, "price-history", 10, 60);
  if (limited) return limited;
  if (!(await withinUpstreamBudget("kis", MAX_PAGES))) {
    return NextResponse.json({ error: "일시 오류" }, { status: 503, headers: { ...NO_STORE, "X-KIS-Unavailable": "1" } });
  }

  const todayStr = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const { token: accessToken, unavailable } = await getKisAccessToken(todayStr);
  if (!accessToken) {
    return NextResponse.json(
      { error: "일시 오류" },
      { status: 503, headers: unavailable ? { ...NO_STORE, "X-KIS-Unavailable": "1" } : NO_STORE },
    );
  }

  const result = await fetchPriceHistory({
    ticker,
    market,
    range,
    todayStr,
    accessToken,
    appKey: process.env.KIS_APP_KEY ?? "",
    appSecret: process.env.KIS_APP_SECRET ?? "",
  });

  if (!result) {
    // 마스터에 없는 티커의 실패는 서킷에 반영하지 않는다(무효 티커 반복 요청으로 전 사용자 차단 방지, profit 라우트와 같은 규칙)
    const unavailableNow = KR_CODES.has(ticker) || US_TICKERS.has(ticker) ? await recordKisFailure() : false;
    return NextResponse.json(
      { error: "일시 오류" },
      { status: 503, headers: unavailableNow ? { ...NO_STORE, "X-KIS-Unavailable": "1" } : NO_STORE },
    );
  }
  await recordKisSuccess();
  if (result.points.length === 0) return NextResponse.json(result, { headers: NO_STORE });
  return NextResponse.json(result, { headers: cdnCacheHeaders(CDN_MAX_AGE_SEC, 3600) });
}
