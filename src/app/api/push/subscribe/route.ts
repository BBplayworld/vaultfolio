import { NextRequest, NextResponse } from "next/server";
import { getCacheStorage } from "@/lib/cache-storage";
import { pushSubId } from "@/lib/push/crypto";
import { isPushConfigured } from "@/lib/push/send";
import { parseEndpointBody, parseSubscribeBody } from "@/lib/push/validate";
import { badRequest, guardRateLimit, guardRequest } from "@/server/api-guard";

// 시장 알림 구독 저장·해제(#179). 서버에 남는 값 = endpoint·keys·카탈로그 ID·조건뿐(보유 정보 0).
// 키 접두어(preview/prod 분리)는 저장소가 서버 환경 변수로만 계산한다 — 클라이언트 입력 없음.
// endpoint·키는 로그에 쓰지 않는다. DELETE는 endpoint 소지가 인증.

export const runtime = "nodejs";
const NO_STORE = { "Cache-Control": "private, no-store" } as const;

async function guard(req: NextRequest) {
  const blocked = guardRequest(req, { route: "push-subscribe", maxBodyBytes: 4096, l1PerMinute: 20 });
  if (blocked) return blocked;
  return guardRateLimit(req, "push-subscribe", 30, 3600);
}

export async function POST(req: NextRequest) {
  const blocked = await guard(req);
  if (blocked) return blocked;
  if (!isPushConfigured()) return NextResponse.json({ error: "not-configured" }, { status: 503, headers: NO_STORE });

  const body = parseSubscribeBody(await req.json().catch(() => null));
  if (!body) return badRequest();

  await getCacheStorage().putPushSub(pushSubId(body.endpoint), { ...body, updatedAt: new Date().toISOString().slice(0, 10) });
  return NextResponse.json({ ok: true }, { headers: NO_STORE });
}

export async function DELETE(req: NextRequest) {
  const blocked = await guard(req);
  if (blocked) return blocked;
  const endpoint = parseEndpointBody(await req.json().catch(() => null));
  if (!endpoint) return badRequest();

  await getCacheStorage().deletePushSub(pushSubId(endpoint));
  return NextResponse.json({ ok: true }, { headers: NO_STORE });
}
