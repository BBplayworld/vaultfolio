import { NextRequest, NextResponse } from "next/server";
import { fetchEtfComponents } from "@/lib/finance/finance-service";
import { getKisAccessToken, recordKisFailure, recordKisSuccess } from "@/lib/finance/kis-token";
import { normalizeEtfComponents, parseEtfCode } from "@/lib/finance/etf-components";
import { badRequest, cdnCacheHeaders, guardRateLimit, guardRequest, withinUpstreamBudget } from "@/server/api-guard";

// ETF 구성종목·비중(KIS FHKST121600C0) — ETF 속까지 합친 내 주식(#152).
// 요청 매개변수는 ETF 공개 코드 1종뿐(1종 1요청: 보유 조합 비노출), 사용자 자산 값 수신 0.
// 응답은 모든 사용자에게 같아 CDN에만 캐시한다(Redis 키 0 — market-index 패턴). 실패·부분 응답은 캐시하지 않는다.

export const maxDuration = 20;

// PDF는 영업일 장 전 갱신 — 하루 1회면 충분하나 기준일 표기 전까지 6시간으로 둔다
const CDN_TTL_SEC = 6 * 60 * 60;

export async function GET(req: NextRequest) {
  const blocked = guardRequest(req, { route: "etf-components", l1PerMinute: 60 });
  if (blocked) return blocked;

  const code = parseEtfCode(req.nextUrl.searchParams.get("code"));
  if (!code) return badRequest();

  const limited = await guardRateLimit(req, "etf-components", 10, 60);
  if (limited) return limited;
  if (!(await withinUpstreamBudget("kis"))) {
    return NextResponse.json({ error: "unavailable" }, { status: 503, headers: { "X-KIS-Unavailable": "1", "Cache-Control": "private, no-store" } });
  }

  const todayStr = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const { token: accessToken, unavailable } = await getKisAccessToken(todayStr);
  if (!accessToken) {
    return NextResponse.json(
      { error: "unavailable" },
      { status: 503, headers: { "Cache-Control": "private, no-store", ...(unavailable ? { "X-KIS-Unavailable": "1" } : {}) } },
    );
  }

  const raw = await fetchEtfComponents(code, accessToken, process.env.KIS_APP_KEY ?? "", process.env.KIS_APP_SECRET ?? "");
  const result = raw ? normalizeEtfComponents(code, raw.output1, raw.output2) : null;
  if (!result) {
    const unavailableNow = await recordKisFailure();
    return NextResponse.json(
      { error: "no-data" },
      { status: 502, headers: { "Cache-Control": "private, no-store", ...(unavailableNow ? { "X-KIS-Unavailable": "1" } : {}) } },
    );
  }
  await recordKisSuccess();

  // 실호출 게이트용 — 필드 의미 대조에 쓰는 원문 키 목록(공개 정보). 게이트 뒤 제거
  const probe = req.nextUrl.searchParams.get("probe") === "1";
  const body = probe
    ? { ...result, probe: { output1: raw!.output1, output2Head: raw!.output2.slice(0, 1), trConts: raw!.trConts } }
    : result;

  // 구성 수와 행 수가 일치(전량)할 때만 CDN 캐시
  if (result.complete && !probe) {
    return NextResponse.json(body, { headers: cdnCacheHeaders(CDN_TTL_SEC) });
  }
  return NextResponse.json(body, { headers: { "Cache-Control": "private, no-store" } });
}
