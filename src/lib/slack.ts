/**
 * slack.ts
 * Slack 웹훅 전송 유틸 (서버 전용).
 *
 * - SLACK_ADMIN_WEBHOOK_URL: 모든 에러·정보 등 관리자용 알림
 * - (의견 보내기는 /api/feedback 라우트에서 SLACK_FEEDBACK_WEBHOOK_URL 사용)
 */

const SLACK_TIMEOUT_MS = 3000;

// 관리자 채널로 텍스트 전송. 실패해도 예외를 던지지 않음(호출부 흐름 비차단).
export async function sendAdminSlack(text: string): Promise<void> {
  const url = process.env.SLACK_ADMIN_WEBHOOK_URL;
  if (!url) {
    console.error("[slack] SLACK_ADMIN_WEBHOOK_URL 미설정");
    return;
  }
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
      signal: AbortSignal.timeout(SLACK_TIMEOUT_MS),
    });
    if (!res.ok) console.error("[slack] 관리자 웹훅 실패:", res.status);
  } catch (e) {
    console.error("[slack] 관리자 웹훅 오류:", e);
  }
}
