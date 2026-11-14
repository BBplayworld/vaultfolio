import { NextRequest, NextResponse } from "next/server";
import { getCacheStorage } from "@/lib/cache-storage";
import { pushKeyPrefix } from "@/lib/push/prefix";
import { buildTestPayloads } from "@/lib/push/test-payloads";
import { isPushConfigured, sendPush } from "@/lib/push/send";
import { pushSubId } from "@/lib/push/crypto";
import { parseEndpointBody } from "@/lib/push/validate";
import { badRequest, guardRateLimit, guardRequest } from "@/server/api-guard";

// 테스트 알림(#179) — preview·로컬 전용(운영 404). 호출자 endpoint로 서버에 저장된 그 구독 1건에만,
// 고른 종류별로 운영 Cron과 같은 생성 함수·실제 시세로 만든 알림을 1건씩(최대 4건) 보낸다.
// 구독당 1분 1회·IP당 10회/시간. 타인 구독에는 보낼 수 없다(endpoint 소지자만).

export const runtime = "nodejs";
const NO_STORE = { "Cache-Control": "private, no-store" } as const;

export async function POST(req: NextRequest) {
  if (process.env.VERCEL_ENV === "production") return new NextResponse(null, { status: 404 });

  const blocked = guardRequest(req, { route: "push-test", maxBodyBytes: 4096, l1PerMinute: 10 });
  if (blocked) return blocked;
  const limited = await guardRateLimit(req, "push-test", 10, 3600);
  if (limited) return limited;
  if (!isPushConfigured()) return NextResponse.json({ error: "not-configured" }, { status: 503, headers: NO_STORE });

  const endpoint = parseEndpointBody(await req.json().catch(() => null));
  if (!endpoint) return badRequest();

  const storage = getCacheStorage();
  const id = pushSubId(endpoint);
  const sub = await storage.getPushSub(id);
  if (!sub) return NextResponse.json({ error: "not-subscribed" }, { status: 404, headers: NO_STORE });

  const lock = await storage.acquireLock(`${pushKeyPrefix()}testlock:${id}`, 60);
  if (!lock) return NextResponse.json({ error: "cooldown" }, { status: 429, headers: { ...NO_STORE, "Retry-After": "60" } });

  const payloads = await buildTestPayloads(sub.topics, sub.cond);
  let sent = 0;
  for (const payload of payloads) {
    const result = await sendPush(sub, payload);
    if (result === "gone") {
      await storage.deletePushSub(id);
      return NextResponse.json({ error: "not-subscribed" }, { status: 404, headers: NO_STORE });
    }
    if (result === "fail") return NextResponse.json({ error: "send-failed" }, { status: 502, headers: NO_STORE });
    sent++;
  }
  return NextResponse.json({ ok: true, sent }, { headers: NO_STORE });
}
