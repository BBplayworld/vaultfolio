/**
 * /api/share
 * Short URL 생성 및 조회 엔드포인트.
 *
 * POST /api/share
 *   body: { token: "v71N...", owner_id?: "uuid" }
 *   → { key: "a3f8b2c1ab", owner_id: "uuid" }
 *
 *   key = sha256(token)[:10] — 콘텐츠 기반, IP 무관
 *   같은 자산 상태 → 항상 동일 key (부부가 동일 데이터 공유 시 1개 키)
 *   자산 변경 → token 변경 → 새 key
 *
 *   owner_id: 브라우저 localStorage에 저장된 UUID.
 *   재공유 시 이전 키를 즉시 삭제해 Redis 누적을 방지.
 *
 * GET /api/share?key=a3f8b2c1ab
 *   → { token: "v71N..." }
 *   접근 시 TTL 30일 자동 연장 (Sliding Window)
 *
 * 스토리지: 로컬=data/share-tokens.json, Vercel=Upstash Redis (30일 Sliding TTL)
 */

import { NextResponse } from "next/server";
import { createHash, randomUUID } from "crypto";
import { getCacheStorage } from "@/lib/cache-storage";

function getClientIp(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip")?.trim() ??
    "unknown"
  );
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const key = searchParams.get("key")?.trim();

  if (!key) {
    return NextResponse.json({ error: "key 파라미터 필요" }, { status: 400 });
  }

  const storage = getCacheStorage();
  const token = await storage.getShareToken(key);

  if (!token) {
    return NextResponse.json({ error: "링크가 만료되었거나 존재하지 않습니다." }, { status: 404 });
  }

  return NextResponse.json({ token });
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as { token?: string; owner_id?: string };
    const token = body.token?.trim();

    if (!token) {
      return NextResponse.json({ error: "token 필드 필요" }, { status: 400 });
    }

    // PIN 미설정 토큰(v71N) 거부 — 서버에는 PIN 암호화 토큰만 저장
    if (token.startsWith("v71N")) {
      return NextResponse.json({ error: "짧은 URL은 PIN 설정이 필요합니다." }, { status: 400 });
    }

    const ip = getClientIp(request);
    const storage = getCacheStorage();

    // IP 기반 Rate Limit (분당 10회)
    const allowed = await storage.checkRateLimit(ip);
    if (!allowed) {
      return NextResponse.json({ error: "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요." }, { status: 429 });
    }

    // 콘텐츠 기반 키: sha256(token)[:10] — IP 무관, 같은 자산 = 같은 키
    const key = createHash("sha256").update(token).digest("hex").substring(0, 10);

    // Owner ID로 이전 키 추적 및 즉시 삭제
    const ownerId = body.owner_id?.trim() || randomUUID();
    const ownerHash = createHash("sha256").update(ownerId).digest("hex").substring(0, 12);

    const prevKey = await storage.getOwnerKey(ownerHash);
    if (prevKey && prevKey !== key) {
      // 자산이 바뀌어 새 키가 생성된 경우 → 이전 키 즉시 삭제
      await storage.deleteShareToken(prevKey);
    }

    await storage.setShareToken(key, token);
    await storage.setOwnerKey(ownerHash, key);

    return NextResponse.json({ key, owner_id: ownerId });
  } catch {
    return NextResponse.json({ error: "잘못된 요청" }, { status: 400 });
  }
}
