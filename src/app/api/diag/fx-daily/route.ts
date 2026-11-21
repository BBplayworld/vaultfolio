import { NextResponse } from "next/server";
import { fetchFxKrwDailySeries, fetchKospiDailySeries, type IndexCloseRow } from "@/lib/finance/finance-service";
import { getKisAccessToken } from "@/lib/finance/kis-token";
import { shiftDate } from "@/lib/push/quotes";
import { guardRateLimit, guardRequest, withinUpstreamBudget } from "@/server/api-guard";

// 임시 진단(#241, 5.126) — 아침 알림이 쓰는 KIS 환율 일봉(X/FX@KRW)이 몇 시에 어떤 날짜 행을 주는지 실측한다. 머지 전 삭제.
// preview 전용(그 밖의 환경은 404). 입력 매개변수 0, 응답은 공개 시세의 날짜·값과 서버 시각뿐(사용자 정보·비밀값 0).

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 20;

const NO_STORE = { "Cache-Control": "private, no-store" } as const;
const LOOKBACK_DAYS = 12; // 알림 조회(quotes.ts)와 같은 범위
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const tail = (rows: IndexCloseRow[] | null, n: number) => (rows ? rows.slice(-n) : null);

export async function GET(req: Request) {
  if (process.env.VERCEL_ENV !== "preview") return new NextResponse(null, { status: 404 });

  const blocked = guardRequest(req, { route: "diag-fx-daily", l1PerMinute: 6 });
  if (blocked) return blocked;
  const limited = await guardRateLimit(req, "diag-fx-daily", 6, 60);
  if (limited) return limited;

  const kst = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString();
  const today = kst.slice(0, 10);
  const base = { kstNow: `${kst.slice(0, 19)}+09:00`, today };

  if (!(await withinUpstreamBudget("kis", 2))) return NextResponse.json({ ...base, error: "budget" }, { status: 503, headers: NO_STORE });
  const { token } = await getKisAccessToken(today);
  if (!token) return NextResponse.json({ ...base, error: "no-token" }, { status: 503, headers: NO_STORE });

  const appKey = process.env.KIS_APP_KEY ?? "";
  const appSecret = process.env.KIS_APP_SECRET ?? "";
  const start = shiftDate(today, -LOOKBACK_DAYS);
  // 종료일 = 오늘 — 이 시각에 오늘 날짜 행이 있는지가 실측 대상
  const fx = await fetchFxKrwDailySeries(start, today, token, appKey, appSecret);
  await sleep(350); // 알림 조회와 같은 간격
  const kospi = await fetchKospiDailySeries(start, today, token, appKey, appSecret, "0001");

  return NextResponse.json(
    {
      ...base,
      fx: { rows: tail(fx, 3), hasTodayRow: fx ? fx[fx.length - 1]?.date === today : null },
      kospi: { rows: tail(kospi, 2), lastDate: kospi ? (kospi[kospi.length - 1]?.date ?? null) : null },
    },
    { headers: NO_STORE },
  );
}
