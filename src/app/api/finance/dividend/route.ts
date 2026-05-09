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
import type { DividendPayoutResult } from "@/lib/finance-service";
import { getCacheStorage } from "@/lib/cache-storage";

const KIS_APP_KEY = process.env.KIS_APP_KEY || "";
const KIS_APP_SECRET = process.env.KIS_APP_SECRET || "";
const DIVIDEND_CACHE_VERSION = "v5";

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

  // 전년도 데이터가 충분하면 전년도 중앙값을 기준으로 사용 (더 신뢰도 높음)
  // 전년도가 없으면 올해 전체 합산 중앙값 사용
  const refAmounts = prevAmounts.length > 0 ? prevAmounts : [...prevAmounts, ...thisAmounts];
  if (refAmounts.length === 0) return thisYear;

  const refMedian = calcMedian(refAmounts);
  if (refMedian === 0) return thisYear;

  const before = thisYear.length;
  const filtered = thisYear.filter((r) => {
    const v = toAmt(r);
    return v >= refMedian / 20 && v <= refMedian * 20;
  });
  if (filtered.length < before) {
    console.log(`[해외배당 이상값 필터]: ${before}건 → ${filtered.length}건 (prevMedian=${refMedian})`);
  }
  return filtered;
}

function calcFrequency(count: number): import("@/lib/finance-service").DividendFrequency {
  if (count >= 10) return "monthly";
  if (count >= 3) return "quarterly";
  if (count >= 2) return "semiannual";
  return "annual";
}

// 올해 이상값 필터 후 실제 데이터 + 전년도 데이터로 예상 지급 생성
function inferEstimatedPayouts(
  thisYearFiltered: DividendPayoutResult[], // 이상값 필터 완료된 올해 실제 데이터
  prevYear: DividendPayoutResult[],
  todayStr: string,
  year: number
): DividendPayoutResult[] {
  // 올해 실제 확인된 지급 (당월 포함 이전 — 이번 달은 지급된 것으로 처리)
  const [todayYear, todayMonth] = todayStr.split("-");
  const currentMonthEnd = `${todayYear}-${todayMonth}-31`;
  const actualPayouts = thisYearFiltered.filter((p) => p.payoutDate <= currentMonthEnd && !p.isEstimated);
  const actualMonths = new Set(actualPayouts.map((p) => parseInt(p.payoutDate.split("-")[1], 10)));

  // 배당월 패턴: 작년 + 올해 실제 합산
  const prevYearMonths = new Set(prevYear.map((p) => parseInt(p.payoutDate.split("-")[1], 10)));
  const patternMonths = new Set([...prevYearMonths, ...actualMonths]);
  if (patternMonths.size === 0) return [];

  // 패턴에서 올해 미확인 월 (과거·미래 모두)
  const candidateMonths = [...patternMonths].filter((m) => !actualMonths.has(m));
  if (candidateMonths.length === 0) return [];

  // 주당 금액: 올해 실제 데이터 우선, 없으면 전년도
  // (올해 이상값은 이미 filterOverseasOutliers로 제거됨)
  const amountBase = actualPayouts.length > 0 ? actualPayouts : prevYear;
  const avgAmount = amountBase.reduce((s, p) => s + p.amountPerShare, 0) / amountBase.length;
  const hasForeign = amountBase.some((p) => p.amountForeign !== undefined);
  const avgForeign = hasForeign
    ? amountBase.reduce((s, p) => s + (p.amountForeign ?? p.amountPerShare), 0) / amountBase.length
    : undefined;
  const currency = amountBase[0]?.currency;

  // 분기 패턴 보완: 3개월 간격 패턴이 감지되면 누락 월 자동 추가
  // 예) 6,9,12월만 있으면 → 3월도 분기 패턴으로 추가
  const sortedPattern = [...patternMonths].sort((a, b) => a - b);
  const completedMonths = new Set(patternMonths);
  if (sortedPattern.length >= 2) {
    const gaps = sortedPattern.slice(1).map((m, i) => m - sortedPattern[i]);
    const allSameGap = gaps.every((g) => g === gaps[0]);
    if (allSameGap && gaps[0] === 3) {
      // 정확히 3개월 간격이면 연 4회 분기 패턴으로 나머지 월 추가
      const baseMonth = sortedPattern[0];
      for (let offset = 0; offset < 12; offset += 3) {
        const m = ((baseMonth - 1 + offset) % 12) + 1;
        completedMonths.add(m);
      }
    }
  }
  const finalCandidates = [...completedMonths].filter((m) => !actualMonths.has(m));

  const frequency = calcFrequency(completedMonths.size);

  return finalCandidates.map((month) => {
    const prevMatch = prevYear.find((p) => parseInt(p.payoutDate.split("-")[1], 10) === month);
    const thisMatch = actualPayouts.find((p) => parseInt(p.payoutDate.split("-")[1], 10) === month);
    const dd = (prevMatch ?? thisMatch)?.payoutDate.split("-")[2] ?? "15";
    const payoutDate = `${year}-${String(month).padStart(2, "0")}-${dd}`;
    return {
      payoutDate,
      amountPerShare: avgAmount,
      ...(avgForeign !== undefined ? { amountForeign: avgForeign } : {}),
      ...(currency ? { currency } : {}),
      frequency,
      isEstimated: true,
    };
  });
}

export async function GET(request: Request) {
  const messages: string[] = [];
  const log = (msg: string, type: "log" | "error" = "log") => {
    if (type === "error") {
      console.error(msg);
    } else {
      console.log(msg);
    }
    messages.push(`[${new Date().toISOString()}] ${msg}`);
  };

  try {
    const { searchParams } = new URL(request.url);
    const ticker = searchParams.get("ticker")?.trim().toUpperCase();
    const type = searchParams.get("type"); // "domestic" | "foreign"
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
        p.isEstimated && p.payoutDate <= currentMonthEnd
          ? { ...p, isEstimated: false }
          : p
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

    // 2단계: 올해 데이터 조회
    const fdt = `${year}0101`;
    const tdt = `${year}1231`;
    log(`[배당 조회 시작 - ${ticker}]: type=${type}, excd=${excd}, 기간=${fdt}~${tdt}`);

    const thisYearRaw =
      type === "domestic"
        ? await fetchDividendDomestic(ticker, fdt, tdt, accessToken, KIS_APP_KEY, KIS_APP_SECRET)
        : await fetchDividendOverseas(ticker, excd, fdt, tdt, accessToken, KIS_APP_KEY, KIS_APP_SECRET);

    log(`[배당 올해 조회 완료 - ${ticker}]: ${thisYearRaw.length}건`);

    // 3단계: 전년도 데이터 조회 (rate limit 준수)
    await new Promise<void>((r) => setTimeout(r, 500));
    const pfdt = `${prevYear}0101`;
    const ptdt = `${prevYear}1231`;
    log(`[배당 전년도 조회 - ${ticker}]: 기간=${pfdt}~${ptdt}`);

    const prevYearRaw =
      type === "domestic"
        ? await fetchDividendDomestic(ticker, pfdt, ptdt, accessToken, KIS_APP_KEY, KIS_APP_SECRET)
        : await fetchDividendOverseas(ticker, excd, pfdt, ptdt, accessToken, KIS_APP_KEY, KIS_APP_SECRET);

    log(`[배당 전년도 조회 완료 - ${ticker}]: ${prevYearRaw.length}건`);

    // 4단계: 해외주식 이상값 필터
    const thisYearFiltered =
      type === "foreign"
        ? filterOverseasOutliers(thisYearRaw, prevYearRaw)
        : thisYearRaw;

    // 5단계: 예상 지급 추정
    const estimated = inferEstimatedPayouts(thisYearFiltered, prevYearRaw, todayStr, year);
    log(`[배당 예상 추정 - ${ticker}]: ${estimated.length}건`);

    // 6단계: 전년도 + 올해 전체(실제+예상) 합산 패턴 기반 frequency
    const allPayouts = [...thisYearFiltered, ...estimated];
    const unifiedPatternMonths = new Set([
      ...prevYearRaw.map((p) => parseInt(p.payoutDate.split("-")[1], 10)),
      ...allPayouts.map((p) => parseInt(p.payoutDate.split("-")[1], 10)),
    ]);
    // 3개월 간격 완전 분기 패턴 보완 (inferEstimatedPayouts와 동일 로직)
    const sortedUnified = [...unifiedPatternMonths].sort((a, b) => a - b);
    if (sortedUnified.length >= 2) {
      const gaps = sortedUnified.slice(1).map((m, i) => m - sortedUnified[i]);
      if (gaps.every((g) => g === 3)) {
        for (let offset = 0; offset < 12; offset += 3) {
          unifiedPatternMonths.add(((sortedUnified[0] - 1 + offset) % 12) + 1);
        }
      }
    }
    const unifiedFrequency = calcFrequency(unifiedPatternMonths.size);
    const results = allPayouts.map((p) => ({ ...p, frequency: unifiedFrequency }));

    // 6단계: 캐시 저장
    await storage.setDividend(cacheKey, results);

    return NextResponse.json({ data: results, messages });
  } catch (err: any) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    log(`[배당 조회 서버 오류]: ${errorMsg}`, "error");
    return NextResponse.json({ error: errorMsg, messages }, { status: 500 });
  }
}
