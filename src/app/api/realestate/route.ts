// 부동산 실거래가 API (S-4.21) — 서버 전용
// op=resolve : 주소 → 법정동코드·건물명
// op=estimate: 종류/시군구/단지명/면적 → 최근 실거래 추정치 (없고 면적 미상이면 면적 후보 목록)
// 캐시: 서버 모듈 메모리 TTL(시군구·월 단위). 지속 캐시(cache-storage) 이관은 후속.
import { NextResponse } from "next/server";
import { resolveAddress, fetchTrades, fetchTradesXml, matchTrade, distinctAreas, type RealEstateTrade, type AreaKind } from "@/lib/realestate-service";

const TTL_MS = 6 * 60 * 60 * 1000; // 6시간
const tradeCache = new Map<string, { at: number; data: RealEstateTrade[] }>();

async function getTrades(dataset: string, lawd: string, ym: string): Promise<RealEstateTrade[]> {
  const key = `${dataset}:${lawd}:${ym}`;
  const hit = tradeCache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.data;
  const data = await fetchTrades(dataset, lawd, ym);
  // 빈 결과는 짧게만 유지되도록 성공(비어있지 않음)일 때만 캐시
  if (data.length > 0) tradeCache.set(key, { at: Date.now(), data });
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
  const { searchParams } = new URL(request.url);
  const op = searchParams.get("op") || "estimate";

  try {
    if (op === "resolve") {
      const query = searchParams.get("query") || "";
      const result = await resolveAddress(query);
      if (!result) return NextResponse.json({ error: "주소를 해석하지 못했습니다." }, { status: 200 });
      return NextResponse.json(result);
    }

    const dataset = searchParams.get("dataset") || "apt";
    const lawd = searchParams.get("lawd") || "";

    // op=raw — 실제 응답 태그명 대조용(서버 전용 디버그). 첫 item 블록 원문만 반환.
    if (op === "raw") {
      const ym = searchParams.get("ym") || ymOf(1);
      const xml = await fetchTradesXml(dataset, lawd, ym);
      const item = xml?.match(/<item>[\s\S]*?<\/item>/)?.[0] ?? null;
      return NextResponse.json({ ym, item, hasXml: !!xml });
    }

    // op=estimate
    const matchBy = (searchParams.get("matchBy") as "complex" | "area") || "complex";
    const complexName = searchParams.get("complexName") || undefined;
    const legalDong = searchParams.get("legalDong") || undefined;
    const jibun = searchParams.get("jibun") || undefined;
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
    });
  } catch {
    return NextResponse.json({ error: "조회 중 오류가 발생했습니다." }, { status: 200, headers: { "X-RealEstate-Unavailable": "1" } });
  }
}
