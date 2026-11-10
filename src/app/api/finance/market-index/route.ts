import { NextRequest, NextResponse } from "next/server";
import { fetchKospiDailySeries, fetchOverseasIndexDailySeries } from "@/lib/finance/finance-service";
import { getKisAccessToken, recordKisFailure, recordKisSuccess } from "@/lib/finance/kis-token";
import { buildRefEntryFromSeries, getSeriesRange, resolveRefDates } from "@/lib/finance/profit-dates";
import type { ProfitRefEntry } from "@/app/api/finance/profit/route";
import { badRequest, cdnCacheHeaders, guardRateLimit, guardRequest, isOneOf, secondsUntilNextHour, withinUpstreamBudget } from "@/server/api-guard";

// 시장 지수(코스피·S&P 500) 기준 종가 — 시장과 비교(#132).
// 요청 매개변수는 기간·종가 기준뿐(종목코드·수량·금액 없음), 응답은 모든 사용자에게 같아 CDN에만 캐시한다(Redis 키 0).
// 응답은 profit 라우트와 같은 ProfitRefEntry 모양 — 지수를 '종목 1개짜리 바구니'로 다뤄 같은 날짜 규칙·계산을 쓴다.

export const maxDuration = 20;

const PERIODS = ["daily", "weekly", "monthly"] as const;
const BASES = ["sameBusinessDay", "kstAccessDay"] as const;

// KIS 해외지수 마스터 코드(S&P 500)
const SPX_INDEX_CODE = "SPX";
// 국내 지수 기준 종가는 국내 종목(fetchDomesticHistoricalPrice)과 같은 5일 롤백 범위
const KR_LOOKBACK_DAYS = 5;

export interface MarketIndexResponse {
  KOSPI: ProfitRefEntry | null;
  SPX: ProfitRefEntry | null;
}

export async function GET(req: NextRequest) {
  const blocked = guardRequest(req, { route: "market-index", l1PerMinute: 60 });
  if (blocked) return blocked;

  const { searchParams } = req.nextUrl;
  const period = searchParams.get("period");
  const basis = searchParams.get("basis");
  // 1년·임의 값은 400 — 기간 3종 × 종가 기준 2종만 허용
  if (!isOneOf(period, PERIODS) || !isOneOf(basis, BASES)) return badRequest();

  const { kr, us } = resolveRefDates(period, basis);
  const empty: MarketIndexResponse = { KOSPI: null, SPX: null };

  // CDN 미스일 때만 도달 — L2 한도·전역 예산(지수 2회)
  const limited = await guardRateLimit(req, "market-index", 10, 60);
  if (limited) return limited;
  if (!(await withinUpstreamBudget("kis", 2))) {
    return NextResponse.json(empty, { headers: { "X-KIS-Unavailable": "1" } });
  }

  const nowKST = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const todayStr = nowKST.toISOString().slice(0, 10);
  const { token: accessToken, unavailable } = await getKisAccessToken(todayStr);
  if (!accessToken) {
    return NextResponse.json(empty, unavailable ? { headers: { "X-KIS-Unavailable": "1" } } : undefined);
  }
  const appKey = process.env.KIS_APP_KEY ?? "";
  const appSecret = process.env.KIS_APP_SECRET ?? "";

  const krRange = getSeriesRange(kr);
  const usRange = getSeriesRange(us);
  const [krSeries, usSeries] = await Promise.all([
    fetchKospiDailySeries(krRange.start, krRange.end, accessToken, appKey, appSecret),
    fetchOverseasIndexDailySeries(SPX_INDEX_CODE, usRange.start, usRange.end, accessToken, appKey, appSecret),
  ]);

  const result: MarketIndexResponse = {
    KOSPI: krSeries ? buildRefEntryFromSeries(krSeries, kr, KR_LOOKBACK_DAYS) : null,
    SPX: usSeries ? buildRefEntryFromSeries(usSeries, us) : null,
  };

  // 두 호출 모두 실패 = KIS 점검 등 → 서킷 반영. 하나라도 성공이면 정상 기록
  let unavailableNow = false;
  if (!krSeries && !usSeries) unavailableNow = await recordKisFailure();
  else await recordKisSuccess();

  // 두 값이 모두 채워졌을 때만 CDN 캐시(부분·실패 응답은 캐시하지 않아 다음 요청이 다시 받는다)
  if (result.KOSPI && result.SPX) {
    return NextResponse.json(result, { headers: cdnCacheHeaders(secondsUntilNextHour()) });
  }
  return NextResponse.json(result, unavailableNow ? { headers: { "X-KIS-Unavailable": "1" } } : undefined);
}
