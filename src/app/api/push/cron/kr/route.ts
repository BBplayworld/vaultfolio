import { runPushCron } from "@/lib/push/cron-run";

// 국내 장 마감 알림(#179, 4.91) — Vercel Cron(vercel.json, 07:00 UTC = KST 16:00) 호출. 운영·CRON_SECRET 일치일 때만 동작
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  return runPushCron(req, "kr");
}
