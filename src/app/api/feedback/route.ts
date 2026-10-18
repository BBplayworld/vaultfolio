/**
 * /api/feedback
 * 사용자 의견·요청을 Slack 웹훅으로 전달. 서버에는 저장하지 않음.
 *
 * POST /api/feedback
 *   body: { message: string, nickname?: string, contact?: string }
 *   → { ok: true }
 *
 * 환경변수: SLACK_FEEDBACK_WEBHOOK_URL (구: SLACK_WEBHOOK_URL, 미설정 시 500)
 * 남용 방지: 출처 검사·본문 16KB 상한·IP 기반 Rate Limit(전용 버킷, 10분당 5회)·Slack 멘션/링크 이스케이프
 */

import { NextResponse } from "next/server";
import { guardRateLimit, guardRequest } from "@/server/api-guard";

export const maxDuration = 10;

const MESSAGE_MAX = 2000;
const FIELD_MAX = 200;
const MAX_BODY_BYTES = 16 * 1024;

// Slack mrkdwn 제어 문자 이스케이프 — <!channel>·<@U…>·<https://evil|링크> 같은 멘션·링크 주입 차단
function escapeSlack(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function field(value: unknown, max: number): string | undefined {
  return typeof value === "string" ? value.trim().slice(0, max) || undefined : undefined;
}

export async function POST(request: Request) {
  const blocked = guardRequest(request, { route: "feedback", maxBodyBytes: MAX_BODY_BYTES, l1PerMinute: 10 });
  if (blocked) return blocked;

  try {
    const body = (await request.json()) as { message?: unknown; nickname?: unknown; contact?: unknown };
    const message = field(body.message, MESSAGE_MAX);

    if (!message) {
      return NextResponse.json({ error: "요청 내용을 입력해주세요." }, { status: 400 });
    }

    const limited = await guardRateLimit(request, "feedback", 5, 600);
    if (limited) return limited;

    const webhookUrl = process.env.SLACK_FEEDBACK_WEBHOOK_URL || process.env.SLACK_WEBHOOK_URL;
    if (!webhookUrl) {
      console.error("[feedback] SLACK_FEEDBACK_WEBHOOK_URL 미설정");
      return NextResponse.json({ error: "전송 설정이 완료되지 않았습니다." }, { status: 500 });
    }

    const nickname = escapeSlack(field(body.nickname, FIELD_MAX) ?? "(미입력)");
    const contact = escapeSlack(field(body.contact, FIELD_MAX) ?? "(미입력)");
    const text = `*[시크릿에셋 의견·요청]*\n닉네임: ${nickname}\n연락처: ${contact}\n\n${escapeSlack(message)}`;

    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // 링크 자동 펼침·멘션 파싱 비활성화(이스케이프와 이중 방어)
      body: JSON.stringify({ text, unfurl_links: false, unfurl_media: false, link_names: false }),
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
