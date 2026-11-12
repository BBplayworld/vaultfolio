import { runPushCron } from "@/lib/push/cron-run";

// 미국 장 마감 후(KST 다음 날 아침) 종가 요약(#179) — Vercel Cron(vercel.json)이 호출. 운영·CRON_SECRET 일치일 때만 동작
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  return runPushCron(req, "us");
}
