import { NextRequest, NextResponse } from "next/server";
import { getCacheStorage } from "@/lib/cache-storage";
import {
  fetchDomesticHistoricalPrice,
  fetchOverseasHistoricalPrice,
  classifyTickers,
} from "@/lib/finance/finance-service";
import { getKisAccessToken, recordKisFailure, recordKisSuccess } from "@/lib/finance/kis-token";
import { resolveRefDates } from "@/lib/finance/profit-dates";
import { getStockCacheSlot, getEffectiveDateStr } from "@/lib/finance/stock-cache-slot";
import { isKrBusinessDay } from "@/lib/finance/kr-holidays";
import { isUsBusinessDay } from "@/lib/finance/us-holidays";
import { KR_CODES } from "@/lib/finance/kr-master";
import { US_TICKERS } from "@/lib/finance/us-master";
import { getTodayChipSession, type ChipMarket } from "@/lib/finance/today-chip";
import { badRequest, cdnCacheHeaders, guardRateLimit, guardRequest, isOneOf, parseTickerList, secondsUntilNextHour, withinUpstreamBudget } from "@/server/api-guard";

export const maxDuration = 20;

const PERIODS = ["daily", "weekly", "monthly", "yearly", "ytd"] as const;
// 클라이언트 배치는 3개(profit-utils PROFIT_BATCH_SIZE) — 여유를 두되 fan-out 상한
const MAX_TICKERS = 10;

export type ProfitPeriod = "daily" | "weekly" | "monthly" | "yearly" | "ytd";

export interface ProfitRefEntry {
  refPrice: number;
  refDate: string;
  prevPrice?: number;
  prevDate?: string;
  // '오늘' 칩 휴장 구간 보강(#132 U7, 선택 필드) — daily·kstAccessDay에서 서버 시각의 칩 세션이 장 종료 후이고
  // 그 종가쌍이 (refDate, prevDate)와 다를 때만. 두 가격 모두 실제 종가일 = 요청일(롤백 값 금지). 실패하면 필드 생략
  chipPair?: { closeDate: string; closePrice: number; baseDate: string; basePrice: number };
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

export async function GET(req: NextRequest) {
  const blocked = guardRequest(req, { route: "profit", l1PerMinute: 120 });
  if (blocked) return blocked;

  const { searchParams } = req.nextUrl;
  const periodRaw = searchParams.get("period") ?? "daily";
  // 임의 period가 yearly 경로로 흘러 1년 TTL 쓰레기 키를 만들던 문제 차단 — 5종만 허용
  if (!isOneOf(periodRaw, PERIODS)) return badRequest();
  const period: ProfitPeriod = periodRaw;
  // 종가 기준 옵션 (기본 kstAccessDay = 현행 동작)
  const basis = searchParams.get("basis") === "sameBusinessDay" ? "sameBusinessDay" : "kstAccessDay";

  const tickers = parseTickerList(searchParams.get("tickers")?.toUpperCase() ?? null, MAX_TICKERS);

  if (tickers.length === 0) {
    return NextResponse.json({});
  }

  // sameBusinessDay: 국내·해외 모두 해외 영업일 계산을 사용해 같은 영업일로 정렬
  // kstAccessDay: 국내=domestic, 해외=foreign 독립 산출 (현행)
  // 일별 종료일이 그 시장 휴장일이면 refDate를 명목 종료일로 유지(직전 영업일로 덮어쓰지 않음)
  // → refPrice는 폴백 close라 prevPrice와 같아 주가변동 0, refRate만 종료일 환율로 잡혀 환차만 반영
  // (날짜 산출은 market-index 라우트와 공용 — profit-dates.ts)
  const { us: usDates, kr: krDates } = resolveRefDates(period, basis);
  const krRefHoliday = krDates.refHoliday;
  const usRefHoliday = usDates.refHoliday;
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
  // 미국 ytd만 수정주가(MODP=1)라 기준가 캐시 키를 분리한다(#150). 국내는 원래 수정주가라 그대로
  const isAdj = (market: "domestic" | "foreign") => period === "ytd" && market === "foreign";
  const lookupCached = async (
    ticker: string,
    requestDate: string,
    market: "domestic" | "foreign",
  ): Promise<{ price: number; actualDate: string } | null> => {
    const actualDate = await cache.getRefDateForRequest(ticker, requestDate, period);
    if (!actualDate) return null;
    const price = await cache.getRefPrice(ticker, actualDate, isAdj(market));
    if (price === null) return null;
    return { price, actualDate };
  };

  await Promise.all([
    ...allKr.map(async (ticker) => {
      const refHit = await lookupCached(ticker, krDates.refDate, "domestic");
      if (refHit) {
        const e = ensureEntry(ticker);
        e.refPrice = refHit.price;
        e.refDate = krRefHoliday ? krDates.refDate : refHit.actualDate;
      } else {
        fetchQueue.push({ ticker, date: krDates.refDate, kind: "ref", market: "domestic" });
      }
      if (krDates.prevDate) {
        const prevHit = await lookupCached(ticker, krDates.prevDate, "domestic");
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
      const refHit = await lookupCached(ticker, usDates.refDate, "foreign");
      if (refHit) {
        const e = ensureEntry(ticker);
        e.refPrice = refHit.price;
        e.refDate = usRefHoliday ? usDates.refDate : refHit.actualDate;
      } else {
        fetchQueue.push({ ticker, date: usDates.refDate, kind: "ref", market: "foreign" });
      }
      if (usDates.prevDate) {
        const prevHit = await lookupCached(ticker, usDates.prevDate, "foreign");
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

  // ── '오늘' 칩 휴장 구간 보강(U7) ── 기존 필드·null 판정이 끝난 result에만 덧붙인다
  type ChipNeed = { ticker: string; market: ChipMarket; closeDate: string; baseDate: string };
  const collectChipNeeds = (): ChipNeed[] => {
    if (period !== "daily" || basis !== "kstAccessDay") return [];
    const sessions = { domestic: getTodayChipSession("domestic"), foreign: getTodayChipSession("foreign") };
    const needs: ChipNeed[] = [];
    const visit = (ticker: string, market: ChipMarket) => {
      const e = result[ticker];
      const s = sessions[market];
      if (!e || s.phase !== "closed") return;
      if (e.refDate === s.tradeDate && e.prevDate === s.baseDate) return; // 평일 정상 시각: 추가 호출 0
      needs.push({ ticker, market, closeDate: s.tradeDate, baseDate: s.baseDate });
    };
    for (const t of allKr) visit(t, "domestic");
    for (const t of allUs) visit(t, "foreign");
    return needs;
  };
  // 캐시에서 먼저 찾고, 없는 날짜만 fetchMiss로 받는다(fetchMiss가 null이면 KIS 호출 불가 → 그 쌍 생략).
  // 반환: "none"(보강 대상 0) / "ok" / "failed"(하나라도 생략)
  const attachChipPairs = async (
    needs: ChipNeed[],
    fetchMiss: ((misses: { ticker: string; date: string; market: ChipMarket }[]) => Promise<Map<string, number | null>>) | null,
  ): Promise<"none" | "ok" | "failed"> => {
    if (needs.length === 0) return "none";
    const prices = new Map<string, number | null>(); // `${ticker}|${date}` → 실제 종가일 = 요청일인 종가
    const misses: { ticker: string; date: string; market: ChipMarket }[] = [];
    for (const n of needs) {
      for (const date of [n.closeDate, n.baseDate]) {
        const k = `${n.ticker}|${date}`;
        if (prices.has(k)) continue;
        const hit = await lookupCached(n.ticker, date, n.market);
        if (hit) prices.set(k, hit.actualDate === date ? hit.price : null);
        else {
          prices.set(k, null);
          misses.push({ ticker: n.ticker, date, market: n.market });
        }
      }
    }
    if (misses.length > 0 && fetchMiss) {
      for (const [k, v] of await fetchMiss(misses)) prices.set(k, v);
    }
    let failed = false;
    for (const n of needs) {
      const closePrice = prices.get(`${n.ticker}|${n.closeDate}`);
      const basePrice = prices.get(`${n.ticker}|${n.baseDate}`);
      const e = result[n.ticker];
      if (e && closePrice && closePrice > 0 && basePrice && basePrice > 0) {
        e.chipPair = { closeDate: n.closeDate, closePrice, baseDate: n.baseDate, basePrice };
      } else failed = true;
    }
    return failed ? "failed" : "ok";
  };
  // 놓친 날짜를 KIS로 받는다 — 기존 큐와 같은 캐시 규칙(setRefPrice·요청일 색인)
  const fetchChipMisses = async (
    misses: { ticker: string; date: string; market: ChipMarket }[],
    token: string,
    excd: Map<string, string | undefined>,
  ): Promise<Map<string, number | null>> => {
    const out = new Map<string, number | null>();
    const appKey = process.env.KIS_APP_KEY ?? "";
    const appSecret = process.env.KIS_APP_SECRET ?? "";
    await Promise.all(misses.map(async (m) => {
      const isDomestic = m.market === "domestic";
      const res = isDomestic
        ? await fetchDomesticHistoricalPrice(m.ticker, m.date, token, appKey, appSecret)
        : await fetchOverseasHistoricalPrice(m.ticker, m.date, token, appKey, appSecret, excd.get(m.ticker), isAdj("foreign"));
      if (!res) { out.set(`${m.ticker}|${m.date}`, null); return; }
      await cache.setRefPrice(m.ticker, res.date, res.price, period, isAdj(m.market));
      const reqIsBusinessDay = (isDomestic ? isKrBusinessDay : isUsBusinessDay)(new Date(`${m.date}T00:00:00.000Z`));
      if (res.date === m.date || !reqIsBusinessDay) await cache.setRefDateForRequest(m.ticker, m.date, res.date, period);
      out.set(`${m.ticker}|${m.date}`, res.date === m.date ? res.price : null);
    }));
    return out;
  };
  // 해외 종목별 EXCD를 STOCKS 캐시에서 사전 조회 (장중 슬롯과 effectiveDate 슬롯 모두 시도)
  const loadExcd = async (tickers: string[]): Promise<Map<string, string | undefined>> => {
    const foreignEffective = getEffectiveDateStr("foreign");
    const foreignSlot = getStockCacheSlot("foreign");
    const excdByTicker = new Map<string, string | undefined>();
    await Promise.all(
      tickers.map(async (ticker) => {
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
    return excdByTicker;
  };

  // 캐시 hit으로 모두 충족 → 미설정 종목은 null 처리
  if (fetchQueue.length === 0) {
    for (const ticker of [...allKr, ...allUs]) {
      if (!result[ticker] || !result[ticker]!.refDate) result[ticker] = null;
    }
    // 칩 보강에 KIS 호출이 필요할 때만 L2·예산·토큰을 확인한다. 막히면 필드만 생략(기존 응답 그대로)
    const chip = await attachChipPairs(collectChipNeeds(), async (misses) => {
      if (await guardRateLimit(req, "profit", 30, 60)) return new Map();
      if (!(await withinUpstreamBudget("kis", misses.length))) return new Map();
      const { token } = await getKisAccessToken(toDateStr(getKSTNow()));
      if (!token) return new Map();
      const usMiss = [...new Set(misses.filter((m) => m.market === "foreign").map((m) => m.ticker))];
      return fetchChipMisses(misses, token, await loadExcd(usMiss));
    });
    // 보강 실패분이 있으면 CDN에 1시간 굳히지 않는다(다음 요청에서 다시 시도)
    return NextResponse.json(result, chip === "failed" ? undefined : { headers: cdnCacheHeaders(secondsUntilNextHour()) });
  }

  // 캐시 미스만 L2 rate limit·전역 예산 적용 — 예산 초과 시 외부 호출 없이 일시 오류 신호
  const limited = await guardRateLimit(req, "profit", 30, 60);
  if (limited) return limited;
  if (!(await withinUpstreamBudget("kis", fetchQueue.length))) {
    for (const ticker of [...allKr, ...allUs]) {
      if (!result[ticker] || !result[ticker]!.refDate) result[ticker] = null;
    }
    return NextResponse.json(result, { headers: { "X-KIS-Unavailable": "1" } });
  }

  const appKey = process.env.KIS_APP_KEY ?? "";
  const appSecret = process.env.KIS_APP_SECRET ?? "";
  const nowKST = getKSTNow();
  const todayStr = toDateStr(nowKST);

  const { token: accessToken, unavailable } = await getKisAccessToken(todayStr);

  if (!accessToken) {
    console.error(`[KIS 토큰 없음 - 과거종가 조회 스킵]: ${fetchQueue.map((t) => t.ticker).join(",")}`);
    for (const ticker of [...allKr, ...allUs]) {
      if (!result[ticker] || !result[ticker]!.refDate) result[ticker] = null;
    }
    // 서킷 open(3회 이상 연속 실패) 시 클라이언트에 일시 오류 신호
    return NextResponse.json(result, unavailable ? { headers: { "X-KIS-Unavailable": "1" } } : undefined);
  }

  // 클라이언트 배치(BATCH_SIZE=3, 1초 간격)가 KIS rate limit을 흡수하므로 서버는 단순 Promise.all
  const excdByTicker = await loadExcd(allUs);

  let successCount = 0;
  await Promise.all(
    fetchQueue.map(async (task) => {
      const isDomestic = task.market === "domestic";
      const res = isDomestic
        ? await fetchDomesticHistoricalPrice(task.ticker, task.date, accessToken!, appKey, appSecret)
        : await fetchOverseasHistoricalPrice(task.ticker, task.date, accessToken!, appKey, appSecret, excdByTicker.get(task.ticker), isAdj("foreign"));
      if (res !== null) {
        successCount++;
        await cache.setRefPrice(task.ticker, res.date, res.price, period, isAdj(task.market));
        // 응답일==요청일이거나, 요청일이 비영업일(휴장/주말)이라 직전 영업일로 폴백된 경우 매핑 저장
        // - 비영업일 폴백은 영구 확정값이라 안전 (휴장일 동안 매번 KIS 재호출되던 churn 제거)
        // - 영업일인데 응답일이 더 이른 경우(장중 미확정)는 stale 매핑 영구 hit 방지를 위해 저장 안 함
        const reqDate = new Date(`${task.date}T00:00:00.000Z`);
        const reqIsBusinessDay = isDomestic ? isKrBusinessDay(reqDate) : isUsBusinessDay(reqDate);
        if (res.date === task.date || !reqIsBusinessDay) {
          await cache.setRefDateForRequest(task.ticker, task.date, res.date, period);
        }
        const e = ensureEntry(task.ticker);
        if (task.kind === "ref") {
          e.refPrice = res.price;
          // 일별 종료일이 휴장이면 명목 종료일 유지 (주가변동 0 + 환차만 반영)
          e.refDate = period === "daily" && !reqIsBusinessDay ? task.date : res.date;
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

  // 토큰은 유효했으나(캐시 hit) 전량 실패 = 토큰 발급 후·만료 전에 KIS 점검이 시작된 경우 →
  // 서킷에 반영해 클라이언트에 일시 오류 신호 전달. 개별 티커 1~2개 실패(신규상장 등)는 정상 범위.
  let unavailableNow = false;
  // 마스터에 없는 티커만으로 이뤄진 전량 실패는 서킷에 반영하지 않는다(무효 티커 반복 요청으로 전 사용자 차단 방지)
  if (fetchQueue.length > 0 && successCount === 0 && fetchQueue.some((t) => KR_CODES.has(t.ticker) || US_TICKERS.has(t.ticker))) {
    unavailableNow = await recordKisFailure();
  } else if (successCount > 0) {
    await recordKisSuccess();
  }

  if (unavailableNow) return NextResponse.json(result, { headers: { "X-KIS-Unavailable": "1" } });
  // 칩 보강(U7) — 이미 받은 토큰으로, 예산 안에서만
  const chipNeeds = collectChipNeeds();
  await attachChipPairs(chipNeeds, async (misses) =>
    (await withinUpstreamBudget("kis", misses.length)) ? fetchChipMisses(misses, accessToken, excdByTicker) : new Map());
  return NextResponse.json(result);
}
