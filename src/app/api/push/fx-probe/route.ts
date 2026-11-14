import { NextRequest, NextResponse } from "next/server";
import { fetchFxKrwDailySeries } from "@/lib/finance/finance-service";
import { getKisAccessToken } from "@/lib/finance/kis-token";
import { guardRequest } from "@/server/api-guard";

// 임시 진단(4.91 환율 실호출 확인용, 확인 직후 삭제) — preview 전용. 공개 시장 값(날짜·환율)만 반환.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (process.env.VERCEL_ENV !== "preview") return new NextResponse(null, { status: 404 });
  const blocked = guardRequest(req, { route: "fx-probe", l1PerMinute: 5 });
  if (blocked) return blocked;
  const today = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
  const { token, unavailable } = await getKisAccessToken(today);
  if (!token) return NextResponse.json({ today, token: false, unavailable });
  const start = new Date(Date.now() + 9 * 3600 * 1000 - 12 * 86400000).toISOString().slice(0, 10);
  const rows = await fetchFxKrwDailySeries(start, today, token, process.env.KIS_APP_KEY ?? "", process.env.KIS_APP_SECRET ?? "");
  return NextResponse.json({ today, token: true, count: rows?.length ?? null, last: rows?.slice(-4) ?? null });
}
