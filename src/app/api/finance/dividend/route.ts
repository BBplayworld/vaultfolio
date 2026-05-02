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
import { getCacheStorage } from "@/lib/cache-storage";

const KIS_APP_KEY = process.env.KIS_APP_KEY || "";
const KIS_APP_SECRET = process.env.KIS_APP_SECRET || "";

async function getKisAccessToken(todayStr: string): Promise<string | null> {
  const storage = getCacheStorage();
  const cached = await storage.getKisToken(todayStr);
  if (cached) return cached;
  const token = await fetchKisToken(KIS_APP_KEY, KIS_APP_SECRET);
  if (token) await storage.setKisToken(token, todayStr);
  return token;
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
      log("ticker, type 파라미터 필요", "error");
      return NextResponse.json({ error: "ticker, type 파라미터 필요", messages }, { status: 400 });
    }

    const nowKST = new Date(Date.now() + 9 * 60 * 60 * 1000);
    const todayStr = nowKST.toISOString().split("T")[0];
    const cacheKey = `${ticker}`;

    const storage = getCacheStorage();

    // 1단계: 캐시 확인
    const cached = await storage.getDividend(cacheKey);
    if (cached) {
      log(`[배당 캐시 히트 - ${ticker}]: ${Array.isArray(cached) ? cached.length : "?"}건`);
      return NextResponse.json({ data: cached, messages });
    }

    log(`[배당 환경변수 - ${ticker}]: KIS_APP_KEY=${KIS_APP_KEY ? `설정됨(${KIS_APP_KEY.slice(0, 4)}***)` : "없음"}, KIS_APP_SECRET=${KIS_APP_SECRET ? "설정됨" : "없음"}`);

    if (!KIS_APP_KEY || !KIS_APP_SECRET) {
      log(`[배당 조회 중단 - ${ticker}]: KIS 환경변수 미설정`, "error");
      return NextResponse.json({ data: [], messages }, { status: 200 });
    }

    // 2단계: KIS API 호출 — 올해 1월 1일 ~ 오늘
    const year = nowKST.getUTCFullYear() - 1;
    const fdt = `${year}0101`;
    const tdt = `${year}1231`;

    log(`[배당 토큰 조회 - ${ticker}]: todayStr=${todayStr}`);
    const accessToken = await getKisAccessToken(todayStr);
    if (!accessToken) {
      log(`[배당 조회 실패 - ${ticker}]: KIS 액세스 토큰 발급 실패`, "error");
      return NextResponse.json({ data: [], messages }, { status: 200 });
    }
    log(`[배당 토큰 발급 성공 - ${ticker}]: 토큰 앞 10자=${accessToken.slice(0, 10)}***`);

    log(`[배당 조회 시작 - ${ticker}]: type=${type}, excd=${excd}, 기간=${fdt}~${tdt}`);

    const results =
      type === "domestic"
        ? await fetchDividendDomestic(ticker, fdt, tdt, accessToken, KIS_APP_KEY, KIS_APP_SECRET)
        : await fetchDividendOverseas(ticker, excd, fdt, tdt, accessToken, KIS_APP_KEY, KIS_APP_SECRET);

    log(`[배당 조회 완료 - ${ticker}]: ${results.length}건`);

    // 3단계: 캐시 저장
    await storage.setDividend(cacheKey, results);

    return NextResponse.json({ data: results, messages });
  } catch (err: any) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    log(`[배당 조회 서버 오류]: ${errorMsg}`, "error");
    return NextResponse.json({ error: errorMsg, messages }, { status: 500 });
  }
}
