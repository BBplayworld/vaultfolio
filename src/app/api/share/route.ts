/**
 * /api/share
 * Short URL 생성 및 조회 엔드포인트.
 *
 * POST /api/share
 *   body: { token: "v73A...", owner_id?: "uuid" }  (v73A만 저장, 최대 900k자)
 *   → { key: "a3f8b2c1ab", owner_id: "uuid" }
 *
 *   key = sha256(token)[:10] — 콘텐츠 기반, IP 무관
 *   v73A는 salt·nonce가 무작위라 같은 자산이어도 매번 새 key
 *
 *   owner_id: 브라우저 localStorage에 저장된 UUID.
 *   재공유 시 이전 키를 즉시 삭제해 Redis 누적을 방지.
 *
 * GET /api/share?key=a3f8b2c1ab
 *   → { token: "v73A..." }  (key는 hex 10자리만 허용, 구 v72Z도 읽기 허용)
 *   v73A는 접근 시 TTL 30일 연장 (Sliding Window), v72Z는 연장하지 않음(자연 소멸)
 *
 * 스토리지: 로컬=data/share-tokens.json, Vercel=Upstash Redis (30일 Sliding TTL)
 */

import { NextResponse } from "next/server";
import { createHash, randomUUID } from "crypto";
import { getCacheStorage } from "@/lib/cache-storage";
import { badRequest, exceedsDailyGlobal, guardRateLimit, guardRequest, SHARE_POST_DAILY_LIMIT } from "@/server/api-guard";

export const maxDuration = 10;

// 서버 발급 키 형식(sha256 앞 10자리 hex)만 허용 — share:{key} 네임스페이스 밖(rl:·owner: 등) 접근·TTL 연장 차단
const SHARE_KEY_RE = /^[0-9a-f]{10}$/;
const OWNER_ID_RE = /^[0-9a-f-]{36}$/i;
// 토큰 상한(문자 수) — 임의 대용량 문자열을 30일 저장소로 남용하지 못하게
const MAX_TOKEN_LEN = 900_000;
const MAX_BODY_BYTES = 1_000_000;
// 구 v72Z(문자 시프트) 조회 차단 스위치 — B안 확정(대표 11-14): GET 허용·TTL 연장 중지로 30일 자연 소멸. true로 바꾸면 410 반환(기본 허용, 즉시 삭제 안 함)
const BLOCK_LEGACY_V72Z_GET = false;
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

  if (BLOCK_LEGACY_V72Z_GET && token.startsWith("v72Z")) {
    return NextResponse.json({ error: "구형 공유 링크는 더 이상 열 수 없습니다. 다시 공유해 주세요." }, { status: 410, headers: NO_STORE });
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

    // 서버에는 Zero-Knowledge 토큰(v73A: AES-GCM, PIN+URL 키)만 저장 — v72Z 신규 저장·무암호(v71N)·PIN 단독(v71P) 거부
    if (!token.startsWith("v73A")) {
      return badRequest("짧은 URL은 PIN 설정이 필요합니다.");
    }
    if (token.length > MAX_TOKEN_LEN) {
      return NextResponse.json({ error: "공유 데이터가 너무 큽니다." }, { status: 413, headers: NO_STORE });
    }

    const storage = getCacheStorage();

    // 인스턴스 메모리 빈도 한도(분당 10회) + IP 없는 하루 전역 상한(5.113, rl:share-post:global:{날짜})
    const limited = await guardRateLimit(request, "share-post", 10, 60);
    if (limited) return limited;
    if (await exceedsDailyGlobal("share-post", SHARE_POST_DAILY_LIMIT)) {
      return NextResponse.json({ error: "오늘 공유 한도에 도달했습니다. 내일 다시 시도해 주세요." }, { status: 429, headers: { "Cache-Control": "private, no-store" } });
    }

    // 콘텐츠 기반 키: sha256(token)[:10] — IP 무관
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
