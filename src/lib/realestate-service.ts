// 부동산 실거래가 연동 서비스 (S-4.21) — 서버 전용
// 흐름: 주소해석(카카오) → 종류별 MOLIT 실거래가 조회 → 단지명/면적 매칭 → 최근 실거래 추정치.
// 미검증 주의: 외부 API 엔드포인트·응답 필드는 서비스키 발급 후 실호출로 대조 필요.
// 키 미설정·실패 시 전부 graceful(null·빈배열)로 degrade — 앱 사용은 막지 않는다(AC5).

import { fetchWithTimeout } from "./finance-service";

const KAKAO_KEY = process.env.KAKAO_REST_API_KEY || "";
const DATA_KEY = process.env.PUBLIC_DATA_API_KEY || ""; // 공공데이터포털 서비스키(디코딩된 원문)

// 종류별 MOLIT 매매 실거래가 엔드포인트 (apis.data.go.kr/1613000)
const MOLIT_ENDPOINTS: Record<string, string> = {
  apt: "https://apis.data.go.kr/1613000/RTMSDataSvcAptTradeDev/getRTMSDataSvcAptTradeDev",
  offi: "https://apis.data.go.kr/1613000/RTMSDataSvcOffiTrade/getRTMSDataSvcOffiTrade",
  rh: "https://apis.data.go.kr/1613000/RTMSDataSvcRHTrade/getRTMSDataSvcRHTrade",
  sh: "https://apis.data.go.kr/1613000/RTMSDataSvcSHTrade/getRTMSDataSvcSHTrade",
  nrg: "https://apis.data.go.kr/1613000/RTMSDataSvcNrgTrade/getRTMSDataSvcNrgTrade",
};

export interface AddressResolveResult {
  lawdCd: string;      // 법정동코드 시군구 5자리
  legalDong: string;   // 법정동명
  buildingName: string;// 건물/단지명 (도로명주소 building_name)
  jibun: string;       // 지번
}

// 면적 종류 — 데이터셋마다 공개하는 면적이 달라 서로 비교하면 안 된다.
// exclusive: 전용면적(apt·offi·rh) / gross: 연면적·건물면적(sh·nrg) / plottage: 대지면적(폴백)
export type AreaKind = "exclusive" | "gross" | "plottage";

export interface RealEstateTrade {
  complexName: string; // 단지/건물명 (sh는 주택유형, nrg는 건물주용도로 대체)
  area: number;        // 면적 ㎡ (종류는 areaKind 참조)
  areaKind: AreaKind;
  amount: number;      // 거래금액 (원)
  date: string;        // 거래일 YYYY-MM-DD
  legalDong: string;   // 법정동
  jibun: string;
  floor?: number;
  use?: string;        // 건물주용도 등
  buildingType?: string; // nrg 건물유형(상업용/업무용 등)
}

// ── (A) 주소 해석 — 카카오 로컬 주소검색 ──
// 반환 b_code(10자리 법정동코드) → 앞 5자리가 시군구(LAWD_CD).
export async function resolveAddress(query: string): Promise<AddressResolveResult | null> {
  if (!KAKAO_KEY || !query.trim()) return null;
  try {
    const url = `https://dapi.kakao.com/v2/local/search/address.json?query=${encodeURIComponent(query.trim())}`;
    const res = await fetchWithTimeout(url, { headers: { Authorization: `KakaoAK ${KAKAO_KEY}` } });
    if (!res.ok) return null;
    const data = await res.json();
    const doc = data?.documents?.[0];
    if (!doc) return null;
    const addr = doc.address ?? {};
    const road = doc.road_address ?? {};
    const bCode: string = addr.b_code || road.b_code || "";
    if (bCode.length < 5) return null;
    return {
      lawdCd: bCode.substring(0, 5),
      legalDong: addr.region_3depth_name || road.region_3depth_name || "",
      buildingName: road.building_name || "",
      jibun: [addr.main_address_no, addr.sub_address_no].filter(Boolean).join("-"),
    };
  } catch {
    return null;
  }
}

// ── (B) MOLIT 실거래가 조회 (종류별) ──
// XML 응답을 태그명 다중 폴백으로 파싱. 만원 단위 거래금액 → 원 환산.
export async function fetchTrades(dataset: string, lawdCd: string, dealYmd: string): Promise<RealEstateTrade[]> {
  const xml = await fetchTradesXml(dataset, lawdCd, dealYmd);
  return xml ? parseTradesXml(xml, dataset) : [];
}

// 원문 XML — 파싱 전 태그명 대조(op=raw)에도 재사용
export async function fetchTradesXml(dataset: string, lawdCd: string, dealYmd: string): Promise<string | null> {
  const endpoint = MOLIT_ENDPOINTS[dataset];
  if (!endpoint || !DATA_KEY || !/^\d{5}$/.test(lawdCd) || !/^\d{6}$/.test(dealYmd)) return null;
  try {
    const url = `${endpoint}?serviceKey=${encodeURIComponent(DATA_KEY)}&LAWD_CD=${lawdCd}&DEAL_YMD=${dealYmd}&numOfRows=1000&pageNo=1`;
    const res = await fetchWithTimeout(url);
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

const tag = (block: string, names: string[]): string => {
  for (const n of names) {
    const m = block.match(new RegExp(`<${n}>\\s*<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>\\s*</${n}>`))
      || block.match(new RegExp(`<${n}>([\\s\\S]*?)</${n}>`));
    if (m) return m[1].trim();
  }
  return "";
};

// 데이터셋별 태그 매핑 — MOLIT는 종류마다 공개 필드가 다르다.
// 아파트 기준 태그(excluUseAr·aptNm)만 읽으면 단독(sh)·비주거용(nrg)은 면적이 전부 0이 되어
// 면적 필터가 통째로 무력화되고 시군구 전체 최근 거래가 잡히는 오매칭이 발생한다.
const DATASET_FIELDS: Record<string, { area: string[]; areaKind: AreaKind; fallbackArea?: string[]; name: string[] }> = {
  apt:  { area: ["excluUseAr", "전용면적"], areaKind: "exclusive", name: ["aptNm", "단지명"] },
  offi: { area: ["excluUseAr", "전용면적"], areaKind: "exclusive", name: ["offiNm", "단지명"] },
  rh:   { area: ["excluUseAr", "전용면적"], areaKind: "exclusive", name: ["mhouseNm", "연립다세대", "단지명"] },
  sh:   { area: ["totalFloorAr", "연면적"], areaKind: "gross", fallbackArea: ["plottageAr", "대지면적"], name: ["houseType", "주택유형"] },
  nrg:  { area: ["buildingAr", "건물면적"], areaKind: "gross", fallbackArea: ["plottageAr", "대지면적"], name: ["buildingUse", "건물주용도", "용도"] },
};

export function parseTradesXml(xml: string, dataset = "apt"): RealEstateTrade[] {
  const fields = DATASET_FIELDS[dataset] ?? DATASET_FIELDS.apt;
  const items = xml.match(/<item>[\s\S]*?<\/item>/g) || [];
  const trades: RealEstateTrade[] = [];
  for (const block of items) {
    // 거래금액: "12,000"(만원) → 120,000,000원
    const amtRaw = tag(block, ["dealAmount", "거래금액"]).replace(/[^\d]/g, "");
    const amount = amtRaw ? parseInt(amtRaw, 10) * 10000 : 0;
    let area = parseFloat(tag(block, fields.area) || "0");
    let areaKind = fields.areaKind;
    // 주 면적이 비면 대지면적으로 폴백 — 종류가 달라지므로 areaKind도 함께 바꾼다
    if (!(area > 0) && fields.fallbackArea) {
      area = parseFloat(tag(block, fields.fallbackArea) || "0");
      if (area > 0) areaKind = "plottage";
    }
    const y = tag(block, ["dealYear", "년"]);
    const mo = tag(block, ["dealMonth", "월"]);
    const d = tag(block, ["dealDay", "일"]);
    if (!amount || !y) continue;
    trades.push({
      complexName: tag(block, fields.name),
      area,
      areaKind,
      amount,
      date: `${y}-${String(mo).padStart(2, "0")}-${String(d || "1").padStart(2, "0")}`,
      legalDong: tag(block, ["umdNm", "법정동"]),
      jibun: tag(block, ["jibun", "지번"]),
      floor: parseInt(tag(block, ["floor", "층"]) || "0", 10) || undefined,
      use: tag(block, ["buildingUse", "건물주용도", "용도"]) || undefined,
      buildingType: tag(block, ["buildingType", "건물유형"]) || undefined,
    });
  }
  return trades;
}

// ── (C) 매칭 — 단지명 정규화 + 전용면적 근접, 가장 최근 거래 ──
const norm = (s: string) => s.replace(/\s+/g, "").replace(/[()]/g, "").toLowerCase();

// 추정 등급 — 사용자에게 "이 값을 얼마나 믿어도 되는지" 그대로 노출한다.
// exact: 같은 지번 / similar: 같은 단지·면적 / approx: 같은 법정동·유사 면적 / estimated: ㎡당 단가 중앙값 환산
export type MatchGrade = "exact" | "similar" | "approx" | "estimated";

export interface MatchResult {
  amount: number;
  date: string | null;   // 단가 추정(estimated)은 특정 거래일이 없어 null
  area: number;
  areaKind: AreaKind;
  grade: MatchGrade;
  source: string;
  complexName?: string;
  legalDong?: string;
  floor?: number;
  sampleCount?: number;  // estimated일 때 표본 건수
  unitPrice?: number;    // estimated일 때 ㎡당 단가(원)
}

export interface MatchOptions {
  matchBy: "complex" | "area";
  complexName?: string;
  legalDong?: string;
  jibun?: string;
  area?: number;
  areaKind?: AreaKind;
}

const GRADE_LABEL: Record<MatchGrade, string> = {
  exact: "지번 일치",
  similar: "단지·면적 일치",
  approx: "법정동·유사 면적",
  estimated: "㎡당 단가 중앙값",
};

// 면적 허용 오차 — 절대 ±3㎡ 고정은 대형 상가에서 사실상 매칭 불가라 상대 오차를 함께 쓴다
const areaTolerance = (area: number) => Math.max(3, area * 0.1);
const nameMatches = (a: string, b: string) => {
  const [x, y] = [norm(a), norm(b)];
  return !!x && !!y && (x.includes(y) || y.includes(x));
};
// 지번은 "123-4" / "123" 등 표기가 섞여 앞 본번까지 정규화해 비교
const normJibun = (s: string) => s.replace(/\s+/g, "").replace(/^0+/, "");

export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

const MIN_SAMPLE = 3; // 단가 추정 최소 표본 — 이보다 적으면 추정치를 내보내지 않는다

export function matchTrade(trades: RealEstateTrade[], opts: MatchOptions): MatchResult | null {
  const area = opts.area && opts.area > 0 ? opts.area : undefined;
  // 하드 가드: 단지명으로 좁힐 수 없는 종류(단독·상가)에서 면적까지 모르면 추정 자체를 하지 않는다.
  // (과거엔 시군구 전체 최근 거래 1건이 그대로 추정치가 되어 전혀 다른 물건 가격이 노출됐다)
  if (opts.matchBy === "area" && !area) return null;

  // 면적 종류가 다르면(전용 vs 연면적 vs 대지면적) 애초에 비교가 성립하지 않는다.
  // 후보가 0건이어도 전체로 되돌리지 않는다 — 그 완화가 곧 오매칭이다.
  const pool = opts.areaKind ? trades.filter((t) => t.areaKind === opts.areaKind) : trades;

  // ── 1단계: 가장 유사한 거래 1건 ──
  const tol = area ? areaTolerance(area) : Infinity;
  const scored = pool
    .map((t) => {
      const areaDiff = area && t.area > 0 ? Math.abs(t.area - area) : null;
      if (area && (t.area <= 0 || areaDiff! > tol)) return null;
      const jibunHit = !!opts.jibun && !!t.jibun && normJibun(t.jibun) === normJibun(opts.jibun);
      const nameHit = !!opts.complexName && !!t.complexName && nameMatches(t.complexName, opts.complexName);
      const dongHit = !!opts.legalDong && !!t.legalDong && t.legalDong.includes(opts.legalDong);
      // 단지명으로 찾는 종류는 지번 또는 단지명이 "실제로 일치"할 때만 개별 거래를 특정한다.
      // 법정동만 맞는 거래를 고르면 전혀 다른 단지의 가격·이름이 '근사'로 확정 노출된다(실사용 오매칭).
      // 여기서 걸러진 건은 2단계 단가 중앙값(estimated)으로 흘러가며, 그 경로는 단지명을 내보내지 않는다.
      if (opts.matchBy === "complex" && !jibunHit && !nameHit) return null;
      const score =
        (jibunHit ? 1000 : 0) +
        (nameHit ? 300 : 0) +
        (dongHit ? 100 : 0) +
        (areaDiff !== null ? Math.max(0, 50 - (areaDiff / (tol || 1)) * 50) : 0);
      return { t, score, jibunHit, nameHit };
    })
    .filter((v): v is { t: RealEstateTrade; score: number; jibunHit: boolean; nameHit: boolean } => v !== null);

  if (scored.length > 0) {
    scored.sort((a, b) => b.score - a.score || b.t.date.localeCompare(a.t.date));
    const best = scored[0];
    const grade: MatchGrade = best.jibunHit ? "exact" : best.nameHit && !!area ? "similar" : "approx";
    return {
      amount: best.t.amount,
      date: best.t.date,
      area: best.t.area,
      areaKind: best.t.areaKind,
      grade,
      source: GRADE_LABEL[grade],
      complexName: best.t.complexName || undefined,
      legalDong: best.t.legalDong || undefined,
      floor: best.t.floor,
    };
  }

  // ── 2단계: ㎡당 단가 중앙값 폴백 ──
  if (!area) return null;
  const samples = pool.filter(
    (t) => t.area > 0 && Math.abs(t.area - area) <= area * 0.3
      && (!opts.legalDong || (t.legalDong && t.legalDong.includes(opts.legalDong))),
  );
  if (samples.length < MIN_SAMPLE) return null;
  const unitPrice = median(samples.map((t) => t.amount / t.area));
  return {
    amount: Math.round(unitPrice * area),
    date: null,
    area,
    areaKind: samples[0].areaKind,
    grade: "estimated",
    source: GRADE_LABEL.estimated,
    legalDong: opts.legalDong,
    sampleCount: samples.length,
    unitPrice: Math.round(unitPrice),
  };
}

// 해당 단지/지역 거래의 면적 종류 목록 (평형 수동 선택 폴백용)
export function distinctAreas(trades: RealEstateTrade[], complexName?: string): number[] {
  let pool = trades;
  if (complexName) {
    const hit = pool.filter((t) => t.complexName && nameMatches(t.complexName, complexName));
    if (hit.length > 0) pool = hit;
  }
  return [...new Set(pool.map((t) => Math.round(t.area * 10) / 10).filter((a) => a > 0))].sort((a, b) => a - b);
}
