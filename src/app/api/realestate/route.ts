// 부동산 실거래가 API (S-4.21) — 서버 전용
// op=resolve : 주소 → 법정동코드·건물명
// op=estimate: 종류/시군구/단지명/면적 → 최근 실거래 추정치 (없고 면적 미상이면 면적 후보 목록)
// 캐시: 서버 모듈 메모리 TTL(시군구·월 단위). 지속 캐시(cache-storage) 이관은 후속.
import { NextResponse } from "next/server";
import { resolveAddress, fetchTrades, matchTrade, distinctAreas, type RealEstateTrade, type AreaKind } from "@/lib/realestate/realestate-service";
import { cdnCacheHeaders, guardRateLimit, guardRequest, withinUpstreamBudget } from "@/server/api-guard";

// 최대 24개월 순차 조회가 있어 상한을 넉넉히 두되 무한 점유는 막는다
export const maxDuration = 30;

const TTL_MS = 6 * 60 * 60 * 1000; // 6시간
// 빈 결과 음성 캐시 — 거래 없는 시군구·월을 반복 요청해 요청당 최대 24회 공공데이터 호출을 유발하던 증폭 차단
const EMPTY_TTL_MS = 10 * 60 * 1000;
// 인스턴스 메모리 상한(LRU) — 임의 시군구·월 조합으로 메모리를 무한 증가시키지 못하게
const TRADE_CACHE_MAX = 500;
const MAX_QUERY_LEN = 100;
const tradeCache = new Map<string, { at: number; ttl: number; data: RealEstateTrade[] }>();

class UpstreamBudgetExceeded extends Error {}

async function getTrades(dataset: string, lawd: string, ym: string): Promise<RealEstateTrade[]> {
  const key = `${dataset}:${lawd}:${ym}`;
  const hit = tradeCache.get(key);
  if (hit && Date.now() - hit.at < hit.ttl) {
    // LRU — 최근 사용 항목을 맨 뒤로
    tradeCache.delete(key);
    tradeCache.set(key, hit);
    return hit.data;
  }
  if (!(await withinUpstreamBudget("molit"))) throw new UpstreamBudgetExceeded();
  const data = await fetchTrades(dataset, lawd, ym);
  tradeCache.set(key, { at: Date.now(), ttl: data.length > 0 ? TTL_MS : EMPTY_TTL_MS, data });
  while (tradeCache.size > TRADE_CACHE_MAX) {
    const oldest = tradeCache.keys().next().value;
    if (oldest === undefined) break;
    tradeCache.delete(oldest);
  }
  return data;
}

const ymOf = (offset: number): string => {
  const kst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const d = new Date(kst.getFullYear(), kst.getMonth() - offset, 1);
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}`;
};

// 최근 [from, to) 개월 거래 병합 (당월부터 과거로)
async function recentTrades(dataset: string, lawd: string, from: number, to: number): Promise<RealEstateTrade[]> {
  const all: RealEstateTrade[] = [];
  for (let i = from; i < to; i++) {
    all.push(...(await getTrades(dataset, lawd, ymOf(i))));
  }
  return all;
}

export async function GET(request: Request) {
  const blocked = guardRequest(request, { route: "realestate", l1PerMinute: 60 });
  if (blocked) return blocked;
  const limited = await guardRateLimit(request, "realestate", 20, 60);
  if (limited) return limited;

  const { searchParams } = new URL(request.url);
  const op = searchParams.get("op") || "estimate";
  // 실제 기능이 쓰는 분기만 허용 — 그 외 op(구 디버그 op=raw 등)는 거부
  if (op !== "resolve" && op !== "estimate") return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });

  try {
    if (op === "resolve") {
      const query = (searchParams.get("query") || "").trim().slice(0, MAX_QUERY_LEN);
      if (!query) return NextResponse.json({ error: "주소를 해석하지 못했습니다." }, { status: 200 });
      if (!(await withinUpstreamBudget("kakao"))) {
        return NextResponse.json({ error: "조회 중 오류가 발생했습니다." }, { status: 200, headers: { "X-RealEstate-Unavailable": "1" } });
      }
      const result = await resolveAddress(query);
      if (!result) return NextResponse.json({ error: "주소를 해석하지 못했습니다." }, { status: 200 });
      return NextResponse.json(result, { headers: cdnCacheHeaders(86400, 3600) });
    }

    const dataset = searchParams.get("dataset") || "apt";
    const lawd = searchParams.get("lawd") || "";

    // op=estimate
    const matchBy = (searchParams.get("matchBy") as "complex" | "area") || "complex";
    const complexName = searchParams.get("complexName")?.slice(0, MAX_QUERY_LEN) || undefined;
    const legalDong = searchParams.get("legalDong")?.slice(0, MAX_QUERY_LEN) || undefined;
    const jibun = searchParams.get("jibun")?.slice(0, MAX_QUERY_LEN) || undefined;
    const areaKind = (searchParams.get("areaKind") as AreaKind) || undefined;
    const areaRaw = searchParams.get("area");
    const area = areaRaw ? parseFloat(areaRaw) : undefined;

    if (!/^\d{5}$/.test(lawd)) return NextResponse.json({ error: "시군구 코드가 없습니다." }, { status: 200 });

    // 6개월로 시작해 후보가 안 잡히면 12→24개월까지 확장 — 상가·단독은 거래가 희소하다.
    // 확장분도 동일 캐시 슬롯(dataset:lawd:ym)을 쓰므로 추가 비용은 미조회 월에 한정.
    const WINDOWS = [6, 12, 24];
    const trades: RealEstateTrade[] = [];
    let match: ReturnType<typeof matchTrade> = null;
    let prev = 0;
    for (const months of WINDOWS) {
      trades.push(...(await recentTrades(dataset, lawd, prev, months)));
      prev = months;
      match = matchTrade(trades, { matchBy, complexName, legalDong, jibun, area, areaKind });
      if (match) break;
    }

    if (trades.length === 0) {
      return NextResponse.json({ error: "최근 실거래 데이터를 찾지 못했습니다.", areas: [] }, { status: 200, headers: { "X-RealEstate-Unavailable": "1" } });
    }

    // 면적을 아직 모르면 후보 목록을 함께 제공 (수동 선택 폴백)
    const areas = distinctAreas(trades, matchBy === "complex" ? complexName : undefined);
    return NextResponse.json({
      estimate: match?.amount ?? null,
      date: match?.date ?? null,
      source: match?.source ?? null,
      grade: match?.grade ?? null,
      sampleCount: match?.sampleCount ?? null,
      unitPrice: match?.unitPrice ?? null,
      matchedArea: match?.area ?? null,
      matchedAreaKind: match?.areaKind ?? null,
      matchedComplexName: match?.complexName ?? null,
      matchedLegalDong: match?.legalDong ?? null,
      matchedFloor: match?.floor ?? null,
      areas, // 평형 수동 선택용 후보 (㎡)
    }, { headers: cdnCacheHeaders(6 * 3600, 600) });
  } catch {
    return NextResponse.json({ error: "조회 중 오류가 발생했습니다." }, { status: 200, headers: { "X-RealEstate-Unavailable": "1" } });
  }
}
