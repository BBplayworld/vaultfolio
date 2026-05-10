/**
 * /api/finance/dividend
 * 종목별 배당정보를 KIS OpenAPI에서 조회합니다. (30일 캐시)
 *
 * 쿼리 파라미터:
 *   ticker  - 종목코드 (국내: 6자리, 해외: 영문)
 *   type    - "domestic" | "foreign"
 *   excd    - 거래소 코드 (해외 시 선택, 기본 NAS)
 */

import { NextResponse } from "next/server";
import { fetchDividendDomestic, fetchDividendOverseas, fetchKisToken } from "@/lib/finance-service";
import type { DividendPayoutResult, DividendFrequency } from "@/lib/finance-service";
import { getCacheStorage } from "@/lib/cache-storage";

const KIS_APP_KEY = process.env.KIS_APP_KEY || "";
const KIS_APP_SECRET = process.env.KIS_APP_SECRET || "";
const DIVIDEND_CACHE_VERSION = "v11";

async function getKisAccessToken(todayStr: string): Promise<string | null> {
  const storage = getCacheStorage();
  const cached = await storage.getKisToken(todayStr);
  if (cached) return cached;
  const token = await fetchKisToken(KIS_APP_KEY, KIS_APP_SECRET);
  if (token) await storage.setKisToken(token, todayStr);
  return token;
}

// 해외주식 이상값 필터: 전년도 중앙값 기준으로 올해 이상값 제거
function filterOverseasOutliers(
  thisYear: DividendPayoutResult[],
  prevYear: DividendPayoutResult[]
): DividendPayoutResult[] {
  const toAmt = (r: DividendPayoutResult) => r.amountForeign ?? r.amountPerShare;
  const prevAmounts = prevYear.map(toAmt).filter((v) => v > 0);
  const thisAmounts = thisYear.map(toAmt).filter((v) => v > 0);

  const calcMedian = (arr: number[]) => {
    const s = [...arr].sort((a, b) => a - b);
    const m = Math.floor(s.length / 2);
    return s.length % 2 === 0 ? (s[m - 1] + s[m]) / 2 : s[m];
  };

  const refAmounts = prevAmounts.length > 0 ? prevAmounts : [...prevAmounts, ...thisAmounts];
  if (refAmounts.length === 0) return thisYear;

  const refMedian = calcMedian(refAmounts);
  if (refMedian === 0) return thisYear;

  return thisYear.filter((r) => {
    const v = toAmt(r);
    return v >= refMedian / 20 && v <= refMedian * 20;
  });
}

function calcFrequency(count: number): DividendFrequency {
  if (count >= 10) return "monthly";
  if (count >= 3) return "quarterly";
  if (count >= 2) return "semiannual";
  return "annual";
}

// 지급 월 배열에서 최소 간격(월)을 구해 빈도 역산
// ex) [2, 5] → gap=3 → quarterly / [2, 8] → gap=6 → semiannual
function inferFrequencyFromMonths(months: number[]): DividendFrequency {
  if (months.length < 2) return "annual";
  const sorted = [...months].sort((a, b) => a - b);
  let minGap = 12;
  for (let i = 1; i < sorted.length; i++) {
    const gap = sorted[i] - sorted[i - 1];
    if (gap < minGap) minGap = gap;
  }
  if (minGap <= 1) return "monthly";
  if (minGap <= 3) return "quarterly";
  if (minGap <= 6) return "semiannual";
  return "annual";
}

// 올해 실제 데이터 기준으로 예상 지급 생성
// - 빈도 판단 우선순위: 올해 월 간격 → 작년 건수 → 올해 1건+작년 1건 월 간격 → annual
// - 금액: 최신 실제 지급액 사용 (평균 아닌 가장 최근)
function inferEstimatedPayouts(
  thisYearFiltered: DividendPayoutResult[],
  prevYear: DividendPayoutResult[],
  todayStr: string,
  year: number
): { payouts: DividendPayoutResult[]; frequency: DividendFrequency; debugInfo: Record<string, unknown> } {
  const [todayYear, todayMonth] = todayStr.split("-");
  const currentMonthEnd = `${todayYear}-${todayMonth}-31`;

  const actualPayouts = thisYearFiltered
    .filter((p) => p.payoutDate <= currentMonthEnd && !p.isEstimated)
    .sort((a, b) => a.payoutDate.localeCompare(b.payoutDate));
  const actualMonths = actualPayouts.map((p) => parseInt(p.payoutDate.split("-")[1], 10));
  const actualMonthsSet = new Set(actualMonths);

  const debugInfo: Record<string, unknown> = {
    actualPayouts: actualPayouts.map((p) => ({ payoutDate: p.payoutDate, amountPerShare: p.amountPerShare })),
    actualMonths,
    prevYearCount: prevYear.length,
  };

  if (actualPayouts.length === 0) {
    return { payouts: [], frequency: "annual", debugInfo: { ...debugInfo, decision: "actualPayouts 없음 → annual" } };
  }

  let frequency: DividendFrequency;
  let decisionReason: string;

  if (actualPayouts.length >= 2) {
    // 올해 2건 이상: 건수 대신 월 간격으로 빈도 역산 (2건=반기/분기 모호 문제 해결)
    frequency = inferFrequencyFromMonths(actualMonths);
    decisionReason = `올해 ${actualPayouts.length}건, 월간격 역산: ${actualMonths.join(",")} → ${frequency}`;
  } else if (prevYear.length >= 2) {
    frequency = calcFrequency(prevYear.length);
    decisionReason = `올해 1건, 작년 ${prevYear.length}건 기준: ${frequency}`;
  } else if (prevYear.length === 1) {
    const thisMonth = parseInt(actualPayouts[0].payoutDate.split("-")[1], 10);
    const prevMonth = parseInt(prevYear[0].payoutDate.split("-")[1], 10);
    // 양방향 최소 간격 사용: 작년→올해, 올해→내년 두 방향 중 짧은 쪽이 실제 배당 주기
    // ex) 작년 3월 + 올해 12월 → 단방향 gap=9, 양방향 minGap=3 → quarterly
    const forwardGap = ((thisMonth - prevMonth + 12) % 12) || 12;
    const backwardGap = ((prevMonth - thisMonth + 12) % 12) || 12;
    const gap = Math.min(forwardGap, backwardGap);
    if (gap <= 1) frequency = "monthly";
    else if (gap <= 3) frequency = "quarterly";
    else if (gap <= 6) frequency = "semiannual";
    else frequency = "annual";
    decisionReason = `올해 1건(${thisMonth}월)+작년 1건(${prevMonth}월), 양방향 gap=${gap}개월(forward=${forwardGap}, backward=${backwardGap}) → ${frequency}`;
  } else {
    frequency = "annual";
    decisionReason = "데이터 부족 → annual";
  }

  debugInfo.frequencyDecision = decisionReason;

  if (frequency === "annual") {
    return { payouts: [], frequency, debugInfo };
  }

  const gap = frequency === "monthly" ? 1 : frequency === "quarterly" ? 3 : 6;
  const anchorMonth = Math.min(...actualMonths);
  const expectedMonths = new Set<number>();
  for (let offset = 0; offset < 12; offset += gap) {
    expectedMonths.add(((anchorMonth - 1 + offset) % 12) + 1);
  }

  const candidateMonths = [...expectedMonths].filter((m) => !actualMonthsSet.has(m)).sort((a, b) => a - b);
  debugInfo.anchorMonth = anchorMonth;
  debugInfo.expectedMonths = [...expectedMonths].sort((a, b) => a - b);
  debugInfo.candidateMonths = candidateMonths;

  if (candidateMonths.length === 0) return { payouts: [], frequency, debugInfo };

  // 금액: 가장 최근 실제 지급액 사용
  const latestPayout = actualPayouts[actualPayouts.length - 1];
  const useAmount = latestPayout.amountPerShare;
  const hasForeign = latestPayout.amountForeign !== undefined;
  const useForeign = hasForeign ? (latestPayout.amountForeign ?? latestPayout.amountPerShare) : undefined;
  const currency = latestPayout.currency;

  debugInfo.amountSource = `최신 지급액 (${latestPayout.payoutDate} ${useAmount})`;

  const payouts = candidateMonths.map((month) => ({
    payoutDate: `${year}-${String(month).padStart(2, "0")}-15`,
    amountPerShare: useAmount,
    ...(useForeign !== undefined ? { amountForeign: useForeign } : {}),
    ...(currency ? { currency } : {}),
    frequency,
    isEstimated: true,
  }));

  return { payouts, frequency, debugInfo };
}

export async function GET(request: Request) {
  // 단계별 메시지는 응답에 포함되어 클라이언트 로그로 전달됨 (서버 콘솔에는 error만 출력)
  const messages: string[] = [];
  const log = (msg: string, type: "log" | "error" = "log") => {
    if (type === "error") console.error(msg);
    messages.push(`[${new Date().toISOString()}] ${msg}`);
  };

  try {
    const { searchParams } = new URL(request.url);
    const ticker = searchParams.get("ticker")?.trim().toUpperCase();
    const type = searchParams.get("type");
    const excd = searchParams.get("excd") || "NAS";

    if (!ticker || !type) {
      return NextResponse.json({ error: "ticker, type 파라미터 필요", messages }, { status: 400 });
    }

    const nowKST = new Date(Date.now() + 9 * 60 * 60 * 1000);
    const todayStr = nowKST.toISOString().split("T")[0];
    const cacheKey = `${ticker}-${DIVIDEND_CACHE_VERSION}`;

    const storage = getCacheStorage();

    // 1단계: 캐시 확인
    const cached = await storage.getDividend(cacheKey);
    if (cached) {
      log(`[배당 캐시 히트 - ${ticker}]: ${Array.isArray(cached) ? cached.length : "?"}건`);
      const [todayYear, todayMonth] = todayStr.split("-");
      const currentMonthEnd = `${todayYear}-${todayMonth}-31`;
      const retagged = (cached as DividendPayoutResult[]).map((p) =>
        p.isEstimated && p.payoutDate <= currentMonthEnd ? { ...p, isEstimated: false } : p
      );
      return NextResponse.json({ data: retagged, messages });
    }

    if (!KIS_APP_KEY || !KIS_APP_SECRET) {
      return NextResponse.json({ data: [], messages }, { status: 200 });
    }

    const year = nowKST.getUTCFullYear();
    const prevYear = year - 1;
    const accessToken = await getKisAccessToken(todayStr);
    if (!accessToken) {
      return NextResponse.json({ data: [], messages }, { status: 200 });
    }

    // 2단계: KIS 원본 응답 수집용 (로컬 로그)
    const kisRawLog: Record<string, unknown> = {};

    // 3단계: 올해 데이터 조회
    const fdt = `${year}0101`;
    const tdt = `${year}1231`;
    log(`[배당 조회 시작 - ${ticker}]: type=${type}, excd=${excd}, 기간=${fdt}~${tdt}`);

    const thisYearRaw =
      type === "domestic"
        ? await fetchDividendDomestic(ticker, fdt, tdt, accessToken, KIS_APP_KEY, KIS_APP_SECRET, kisRawLog)
        : await fetchDividendOverseas(ticker, excd, fdt, tdt, accessToken, KIS_APP_KEY, KIS_APP_SECRET, kisRawLog);

    log(`[배당 올해 조회 완료 - ${ticker}]: ${thisYearRaw.length}건`);

    // 4단계: 전년도 데이터 조회
    await new Promise<void>((r) => setTimeout(r, 500));
    const pfdt = `${prevYear}0101`;
    const ptdt = `${prevYear}1231`;
    log(`[배당 전년도 조회 - ${ticker}]: 기간=${pfdt}~${ptdt}`);

    let prevYearRaw =
      type === "domestic"
        ? await fetchDividendDomestic(ticker, pfdt, ptdt, accessToken, KIS_APP_KEY, KIS_APP_SECRET, kisRawLog)
        : await fetchDividendOverseas(ticker, excd, pfdt, ptdt, accessToken, KIS_APP_KEY, KIS_APP_SECRET, kisRawLog);

    log(`[배당 전년도 조회 완료 - ${ticker}]: ${prevYearRaw.length}건`);

    // 4-1단계: 전년도 0건이면 재작년 추가 조회 (QQQ처럼 KIS가 전년도 데이터를 안 주는 경우)
    if (prevYearRaw.length === 0) {
      await new Promise<void>((r) => setTimeout(r, 500));
      const twoYearsAgo = prevYear - 1;
      const p2fdt = `${twoYearsAgo}0101`;
      const p2tdt = `${twoYearsAgo}1231`;
      log(`[배당 재작년 조회 - ${ticker}]: 기간=${p2fdt}~${p2tdt}`);
      prevYearRaw =
        type === "domestic"
          ? await fetchDividendDomestic(ticker, p2fdt, p2tdt, accessToken, KIS_APP_KEY, KIS_APP_SECRET, kisRawLog)
          : await fetchDividendOverseas(ticker, excd, p2fdt, p2tdt, accessToken, KIS_APP_KEY, KIS_APP_SECRET, kisRawLog);
      log(`[배당 재작년 조회 완료 - ${ticker}]: ${prevYearRaw.length}건`);
    }

    // 5단계: 해외주식 이상값 필터
    const thisYearFiltered =
      type === "foreign"
        ? filterOverseasOutliers(thisYearRaw, prevYearRaw)
        : thisYearRaw;

    // 6단계: 예상 지급 추정
    const { payouts: estimated, frequency: finalFrequency, debugInfo } = inferEstimatedPayouts(
      thisYearFiltered, prevYearRaw, todayStr, year
    );
    log(`[배당 예상 추정 - ${ticker}]: ${estimated.length}건, frequency=${finalFrequency}`);

    // 7단계: 최종 결과에 frequency 통일 적용
    const results: DividendPayoutResult[] = [...thisYearFiltered, ...estimated].map((r) => ({
      ...r,
      frequency: finalFrequency,
    }));

    // 8단계: 로컬 파일 로그 (KIS 원본 + 처리 단계별)
    if (process.env.NODE_ENV === "development") {
      try {
        const fs = await import("fs");
        const path = await import("path");
        const logDir = path.join(process.cwd(), "data", "dividend-logs");
        fs.mkdirSync(logDir, { recursive: true });

        // KIS 원본 응답 로그
        fs.writeFileSync(
          path.join(logDir, `${ticker}-${todayStr}-kis-raw.json`),
          JSON.stringify(kisRawLog, null, 2),
          "utf8"
        );

        // 처리 결과 로그
        fs.writeFileSync(
          path.join(logDir, `${ticker}-${todayStr}.json`),
          JSON.stringify({
            ticker, type, excd, todayStr,
            "1_thisYearRaw": thisYearRaw,
            "2_prevYearRaw": prevYearRaw,
            "3_thisYearFiltered": thisYearFiltered,
            "4_inferDebug": debugInfo,
            "5_estimated": estimated,
            "6_finalFrequency": finalFrequency,
            "7_results": results,
          }, null, 2),
          "utf8"
        );
      } catch (e) {
        console.error("[배당 파일 로그 오류]:", e);
      }
    }

    // 9단계: 캐시 저장
    await storage.setDividend(cacheKey, results);

    return NextResponse.json({ data: results, messages });
  } catch (err: any) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    log(`[배당 조회 서버 오류]: ${errorMsg}`, "error");
    return NextResponse.json({ error: errorMsg, messages }, { status: 500 });
  }
}
