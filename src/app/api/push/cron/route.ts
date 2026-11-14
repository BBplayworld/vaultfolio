import { runPushCron } from "@/lib/push/cron-run";

// 날짜표 기반 알림(#179, 4.91) — Vercel Cron(vercel.json, 매일 00:00 UTC = KST 09:00) 1개가 호출. 운영·CRON_SECRET 일치일 때만 동작
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  return runPushCron(req);
}
