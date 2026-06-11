/**
 * /api/feedback
 * 사용자 의견·요청을 Slack 웹훅으로 전달. 서버에는 저장하지 않음.
 *
 * POST /api/feedback
 *   body: { message: string, nickname?: string, contact?: string }
 *   → { ok: true }
 *
 * 환경변수: SLACK_WEBHOOK_URL (미설정 시 500)
 * 남용 방지: IP 기반 Rate Limit (share와 동일 버킷, 분당 10회)
 */

import { NextResponse } from "next/server";
import { getCacheStorage } from "@/lib/cache-storage";

const MESSAGE_MAX = 2000;
const FIELD_MAX = 200;

function getClientIp(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip")?.trim() ??
    "unknown"
  );
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { message?: string; nickname?: string; contact?: string };
    const message = body.message?.trim().slice(0, MESSAGE_MAX);

    if (!message) {
      return NextResponse.json({ error: "요청 내용을 입력해주세요." }, { status: 400 });
    }

    const ip = getClientIp(request);
    const storage = getCacheStorage();
    const allowed = await storage.checkRateLimit(ip);
    if (!allowed) {
      return NextResponse.json({ error: "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요." }, { status: 429 });
    }

    const webhookUrl = process.env.SLACK_WEBHOOK_URL;
    if (!webhookUrl) {
      console.error("[feedback] SLACK_WEBHOOK_URL 미설정");
      return NextResponse.json({ error: "전송 설정이 완료되지 않았습니다." }, { status: 500 });
    }

    const nickname = body.nickname?.trim().slice(0, FIELD_MAX) || "(미입력)";
    const contact = body.contact?.trim().slice(0, FIELD_MAX) || "(미입력)";
    const text = `*[secretasset 의견·요청]*\n닉네임: ${nickname}\n연락처: ${contact}\n\n${message}`;

    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });

    if (!res.ok) {
      console.error("[feedback] Slack 웹훅 실패:", res.status);
      return NextResponse.json({ error: "전송에 실패했습니다." }, { status: 502 });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "잘못된 요청" }, { status: 400 });
  }
}
