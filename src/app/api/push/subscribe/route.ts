import { NextRequest, NextResponse } from "next/server";
import { getCacheStorage } from "@/lib/cache-storage";
import { pushSubId, pushSubIdLegacy } from "@/lib/push/crypto";
import { PUSH_MAX_SUBS } from "@/lib/push/prefix";
import { isPushConfigured } from "@/lib/push/send";
import { parseEndpointBody, parseSubscribeBody } from "@/lib/push/validate";
import { badRequest, guardRateLimit, guardRequest } from "@/server/api-guard";

// 시장 알림 구독 저장·해제(#179). 서버에 남는 값 = endpoint·keys·알림 종류 ID뿐(보유 정보 0).
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

  const storage = getCacheStorage();
  const id = pushSubId(body.endpoint);
  // 전체 상한 — 신규 구독만 막는다(기존 구독의 종류 갱신은 허용)
  if (!(await storage.getPushSub(id)) && (await storage.countPushSubs()) >= PUSH_MAX_SUBS) {
    return NextResponse.json({ error: "capacity" }, { status: 503, headers: NO_STORE });
  }
  await storage.putPushSub(id, { ...body, updatedAt: new Date().toISOString().slice(0, 10) });
  // 5.113 이행: 같은 endpoint의 구 id 레코드·집합 멤버 제거(신 id로 재기록 완료)
  await storage.deletePushSub(pushSubIdLegacy(body.endpoint));
  return NextResponse.json({ ok: true }, { headers: NO_STORE });
}

export async function DELETE(req: NextRequest) {
  const blocked = await guard(req);
  if (blocked) return blocked;
  // 키 미설정이면 저장된 구독이 있을 수 없다 — 500 대신 안전하게 성공 응답
  if (!isPushConfigured()) return NextResponse.json({ ok: true }, { headers: NO_STORE });
  const endpoint = parseEndpointBody(await req.json().catch(() => null));
  if (!endpoint) return badRequest();

  const storage = getCacheStorage();
  await storage.deletePushSub(pushSubId(endpoint));
  await storage.deletePushSub(pushSubIdLegacy(endpoint)); // 이행 기간 — 구 id도 함께
  return NextResponse.json({ ok: true }, { headers: NO_STORE });
}
