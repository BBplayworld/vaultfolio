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
  const { searchParams } = new URL(request.url);
  const ticker = searchParams.get("ticker")?.trim().toUpperCase();
  const type = searchParams.get("type"); // "domestic" | "foreign"
  const excd = searchParams.get("excd") || "NAS";

  if (!ticker || !type) {
    return NextResponse.json({ error: "ticker, type 파라미터 필요" }, { status: 400 });
  }

  const nowKST = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const todayStr = nowKST.toISOString().split("T")[0];
  const cacheKey = `${ticker}`;

  const storage = getCacheStorage();

  // 1단계: 캐시 확인
  const cached = await storage.getDividend(cacheKey);
  if (cached) return NextResponse.json(cached);

  if (!KIS_APP_KEY || !KIS_APP_SECRET) {
    return NextResponse.json([], { status: 200 });
  }

  // 2단계: KIS API 호출 — 올해 1월 1일 ~ 오늘
  const year = nowKST.getUTCFullYear() - 1;
  const fdt = `${year}0101`;
  const tdt = `${year}1231`;

  const accessToken = await getKisAccessToken(todayStr);
  if (!accessToken) {
    return NextResponse.json([], { status: 200 });
  }

  const results =
    type === "domestic"
      ? await fetchDividendDomestic(ticker, fdt, tdt, accessToken, KIS_APP_KEY, KIS_APP_SECRET)
      : await fetchDividendOverseas(ticker, excd, fdt, tdt, accessToken, KIS_APP_KEY, KIS_APP_SECRET);

  // 3단계: 캐시 저장
  await storage.setDividend(cacheKey, results);

  return NextResponse.json(results);
}
