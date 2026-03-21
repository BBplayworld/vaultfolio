/**
 * /api/admin/cache
 * 서버 캐시 현황을 조회하는 어드민 전용 엔드포인트.
 *
 * 인증: Authorization: Bearer <ADMIN_TOKEN> 헤더 또는 ?token=<ADMIN_TOKEN> 쿼리
 * KIS_TOKEN.access_token은 앞 8자리만 노출 (민감 정보 마스킹)
 *
 * - 로컬 (파일 스토리지): finance-cache.json 전체 내용 + share-tokens.json 키 수
 * - Vercel (Upstash): 오늘자 환율 + KIS 토큰 상태
 */

import { NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";
import { getCacheStorage } from "@/lib/cache-storage";

const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "";
const FINANCE_CACHE_PATH = path.join(process.cwd(), "data", "finance-cache.json");
const SHARE_TOKENS_PATH = path.join(process.cwd(), "data", "share-tokens.json");

export async function GET(request: Request) {
  // 토큰 검증
  const { searchParams } = new URL(request.url);
  const bearer = request.headers.get("authorization")?.replace("Bearer ", "").trim();
  const queryToken = searchParams.get("token")?.trim();
  const provided = bearer || queryToken;

  if (!ADMIN_TOKEN || provided !== ADMIN_TOKEN) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const todayStr = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().split("T")[0];
  const isUpstash = !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);

  if (!isUpstash) {
    // 파일 스토리지: finance-cache.json 전체 반환 (마스킹 적용)
    if (!fs.existsSync(FINANCE_CACHE_PATH)) {
      return NextResponse.json({ storage: "file", error: "캐시 파일 없음", todayStr });
    }
    try {
      const raw = JSON.parse(fs.readFileSync(FINANCE_CACHE_PATH, "utf8")) as Record<string, unknown>;
      // KIS_TOKEN access_token 마스킹
      const kisToken = raw.KIS_TOKEN as { access_token?: string; updated_at?: string } | undefined;
      if (kisToken?.access_token) {
        kisToken.access_token = kisToken.access_token.substring(0, 8) + "...";
      }
      // share-tokens.json 키 수 포함
      let shareCount = 0;
      if (fs.existsSync(SHARE_TOKENS_PATH)) {
        try {
          const shareData = JSON.parse(fs.readFileSync(SHARE_TOKENS_PATH, "utf8")) as { tokens?: Record<string, unknown> };
          shareCount = Object.keys(shareData.tokens ?? {}).length;
        } catch { /* 무시 */ }
      }
      return NextResponse.json({ storage: "file", todayStr, shareTokenCount: shareCount, ...raw });
    } catch {
      return NextResponse.json({ storage: "file", error: "캐시 파싱 오류" }, { status: 500 });
    }
  }

  // Upstash: 오늘자 환율 + KIS 토큰 상태 반환
  const storage = getCacheStorage();
  const exchange = await storage.getExchange();
  const kisToken = await storage.getKisToken(todayStr);

  return NextResponse.json({
    storage: "upstash",
    todayStr,
    EXCHANGE: exchange,
    KIS_TOKEN: kisToken
      ? { updated_at: todayStr, access_token: kisToken.substring(0, 8) + "..." }
      : null,
  });
}
