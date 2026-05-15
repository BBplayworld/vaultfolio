import { NextRequest, NextResponse } from "next/server";
import { getCacheStorage } from "@/lib/cache-storage";
import { fetchKisToken } from "@/lib/finance-service";

// 검증 전용: 한투 API 해외 일별 종가 응답 raw 확인
// GET /api/finance/debug-overseas?ticker=TSLA&dates=20260515,20260514,20260513,20260512
// 검증 완료 후 이 파일 삭제 예정
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const ticker = (searchParams.get("ticker") ?? "TSLA").toUpperCase();
  const datesParam = searchParams.get("dates") ?? "";
  const dates = datesParam.split(",").map(d => d.trim()).filter(Boolean);

  if (dates.length === 0) {
    return NextResponse.json({ error: "dates 쿼리 파라미터 필요 (예: ?dates=20260515,20260514)" }, { status: 400 });
  }

  const appKey = process.env.KIS_APP_KEY ?? "";
  const appSecret = process.env.KIS_APP_SECRET ?? "";
  const cache = getCacheStorage();
  const nowKST = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const todayStr = nowKST.toISOString().split("T")[0];

  let token = await cache.getKisToken(todayStr);
  if (!token) {
    token = await fetchKisToken(appKey, appSecret);
    if (token) await cache.setKisToken(token, todayStr);
  }
  if (!token) {
    return NextResponse.json({ error: "KIS 토큰 발급 실패" }, { status: 500 });
  }

  const results: Array<{
    bymd: string;
    excd: string;
    rt_cd?: string;
    msg1?: string;
    output2?: Array<{ xymd?: string; clos?: string; open?: string; high?: string; low?: string; tvol?: string }>;
  }> = [];

  for (const bymd of dates) {
    for (const excd of ["NAS", "NYS", "AMS"]) {
      try {
        const res = await fetch(
          `https://openapi.koreainvestment.com:9443/uapi/overseas-price/v1/quotations/dailyprice?AUTH=&EXCD=${excd}&SYMB=${ticker}&GUBN=0&MODP=0&BYMD=${bymd}&NCNT=10`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              appkey: appKey,
              appsecret: appSecret,
              tr_id: "HHDFS76240000",
              "content-type": "application/json; charset=utf-8",
            },
            cache: "no-store",
          }
        );
        const data = await res.json();
        const output2 = Array.isArray(data?.output2) ? data.output2 : undefined;
        results.push({
          bymd,
          excd,
          rt_cd: data?.rt_cd,
          msg1: data?.msg1,
          output2: output2?.slice(0, 10).map((r: Record<string, string>) => ({
            xymd: r.xymd,
            clos: r.clos,
            open: r.open,
            high: r.high,
            low: r.low,
            tvol: r.tvol,
          })),
        });
        // NAS에서 정상 응답 나오면 다음 excd 안 돌아도 됨 (충분히 빠르게)
        if (data?.rt_cd === "0" && output2 && output2.length > 0) break;
      } catch (e) {
        results.push({ bymd, excd, msg1: `error: ${e instanceof Error ? e.message : String(e)}` });
      }
    }
  }

  return NextResponse.json({
    ticker,
    requestedDates: dates,
    nowKST: nowKST.toISOString(),
    results,
  });
}
