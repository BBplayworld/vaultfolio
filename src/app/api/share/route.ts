/**
 * /api/share
 * Short URL 생성 및 조회 엔드포인트.
 *
 * POST /api/share
 *   body: { token: "v72Z...", owner_id?: "uuid" }  (v72Z만 저장, 최대 900k자)
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
 *   → { token: "v72Z..." }  (key는 hex 10자리만 허용)
 *   접근 시 TTL 30일 자동 연장 (Sliding Window)
 *
 * 스토리지: 로컬=data/share-tokens.json, Vercel=Upstash Redis (30일 Sliding TTL)
 */

import { NextResponse } from "next/server";
import { createHash, randomUUID } from "crypto";
import { getCacheStorage } from "@/lib/cache-storage";
import { badRequest, guardRateLimit, guardRequest } from "@/server/api-guard";

export const maxDuration = 10;

// 서버 발급 키 형식(sha256 앞 10자리 hex)만 허용 — share:{key} 네임스페이스 밖(rl:·owner: 등) 접근·TTL 연장 차단
const SHARE_KEY_RE = /^[0-9a-f]{10}$/;
const OWNER_ID_RE = /^[0-9a-f-]{36}$/i;
// 토큰 상한(문자 수) — 임의 대용량 문자열을 30일 저장소로 남용하지 못하게
const MAX_TOKEN_LEN = 900_000;
const MAX_BODY_BYTES = 1_000_000;
const NO_STORE = { "Cache-Control": "private, no-store" } as const;

export async function GET(request: Request) {
  const blocked = guardRequest(request, { route: "share-get", l1PerMinute: 60 });
  if (blocked) return blocked;

  const { searchParams } = new URL(request.url);
  const key = searchParams.get("key")?.trim();

  if (!key || !SHARE_KEY_RE.test(key)) {
    return badRequest("key 파라미터 필요");
  }

  const limited = await guardRateLimit(request, "share-get", 30, 60);
  if (limited) return limited;

  const storage = getCacheStorage();
  const token = await storage.getShareToken(key);

  if (!token) {
    return NextResponse.json({ error: "링크가 만료되었거나 존재하지 않습니다." }, { status: 404, headers: NO_STORE });
  }

  return NextResponse.json({ token }, { headers: NO_STORE });
}

export async function POST(request: Request) {
  const blocked = guardRequest(request, { route: "share-post", maxBodyBytes: MAX_BODY_BYTES, l1PerMinute: 20 });
  if (blocked) return blocked;

  try {
    const body = await request.json() as { token?: unknown; owner_id?: unknown };
    const token = typeof body.token === "string" ? body.token.trim() : "";

    if (!token) {
      return badRequest("token 필드 필요");
    }

    // 서버에는 Zero-Knowledge 토큰(v72Z: PIN+로컬 키 암호화)만 저장 — 무암호(v71N·구버전)·PIN 단독(v71P) 거부
    if (!token.startsWith("v72Z")) {
      return badRequest("짧은 URL은 PIN 설정이 필요합니다.");
    }
    if (token.length > MAX_TOKEN_LEN) {
      return NextResponse.json({ error: "공유 데이터가 너무 큽니다." }, { status: 413, headers: NO_STORE });
    }

    const storage = getCacheStorage();

    // IP 기반 Rate Limit (분당 10회, 라우트 전용 버킷)
    const limited = await guardRateLimit(request, "share-post", 10, 60);
    if (limited) return limited;

    // 콘텐츠 기반 키: sha256(token)[:10] — IP 무관, 같은 자산 = 같은 키
    const key = createHash("sha256").update(token).digest("hex").substring(0, 10);

    // Owner ID로 이전 키 추적 및 즉시 삭제
    // owner_id는 서버가 발급한 UUID 형식만 신뢰 — 그 외 값은 새로 발급
    const ownerIdRaw = typeof body.owner_id === "string" ? body.owner_id.trim() : "";
    const ownerId = OWNER_ID_RE.test(ownerIdRaw) ? ownerIdRaw : randomUUID();
    const ownerHash = createHash("sha256").update(ownerId).digest("hex").substring(0, 12);

    const prevKey = await storage.getOwnerKey(ownerHash);
    if (prevKey && prevKey !== key) {
      // 자산이 바뀌어 새 키가 생성된 경우 → 이전 키 즉시 삭제
      await storage.deleteShareToken(prevKey);
    }

    await storage.setShareToken(key, token);
    await storage.setOwnerKey(ownerHash, key);

    return NextResponse.json({ key, owner_id: ownerId }, { headers: NO_STORE });
  } catch {
    return badRequest("잘못된 요청");
  }
}
