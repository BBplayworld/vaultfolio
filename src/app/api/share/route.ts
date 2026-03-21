/**
 * /api/share
 * Short URL 생성 및 조회 엔드포인트.
 *
 * POST /api/share
 *   body: { token: "v71N..." }
 *   → { key: "a3f8b2c1ab" } (10자리 hex)
 *   → 생성된 URL: #share=s:<key>
 *   key = sha256(ip + ":" + token)의 앞 10자리 — 같은 IP + 같은 token은 항상 동일 key 반환
 *
 * GET /api/share?key=a3f8b2c1ab
 *   → { token: "v71N..." }
 *
 * 스토리지: 로컬=data/share-tokens.json, Vercel=Upstash Redis (30일 TTL)
 */

import { NextResponse } from "next/server";
import { createHash } from "crypto";
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
    const body = await request.json() as { token?: string };
    const token = body.token?.trim();

    if (!token) {
      return NextResponse.json({ error: "token 필드 필요" }, { status: 400 });
    }

    // key = sha256(ip:token) 앞 10자리 — 같은 IP + 같은 token은 항상 동일 key
    const ip = getClientIp(request);
    const key = createHash("sha256").update(`${ip}:${token}`).digest("hex").substring(0, 10);

    const storage = getCacheStorage();
    await storage.setShareToken(key, token);

    return NextResponse.json({ key });
  } catch {
    return NextResponse.json({ error: "잘못된 요청" }, { status: 400 });
  }
}
