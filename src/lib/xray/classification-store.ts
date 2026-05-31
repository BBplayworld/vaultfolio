/**
 * 종목 분류 캐시 v2
 *
 * 사용자 자산(Stock) 스키마와 분리해 외부 분류 정보를 별도 보관 (옵션 B).
 * 데이터 출처는 KIS 추출 + Gemini 보충 하이브리드. spread 머지 + indices만 배열 합집합.
 */

const STORAGE_KEY = "secretasset_stock_classification";
const SCHEMA_VERSION = 4;

// 상위 카테고리(핵심 분야) — 한 종목당 정확히 1개. 라벨 변경 시 route.ts SECTOR_ENUM·프롬프트와 동기화.
export const SECTOR_ENUM = [
  // AI 및 디지털 인프라
  "AI 가속기 및 반도체",
  "AI 데이터센터 및 인프라",
  "AI 전력 인프라 및 중전기기",
  "사이버 보안",
  "피지컬 AI 및 휴머노이드 로봇",
  "자율주행 및 모빌리티",

  // 규제 완화 및 매크로 수혜
  "전통 에너지 및 석유·가스",
  "방위산업 및 우주항공",
  "기업용 소프트웨어 및 SaaS",
  "핀테크 및 차세대 결제",
  "전통 금융 및 보험",

  // 실물 경제 및 경기 방어
  "건설 및 중장비",
  "초대형 유통 및 이커머스",
  "공급망 리밸런싱 및 물류",
  "산업 자동화",
  "디지털 광고 및 미디어 콘텐츠",

  // 바이오 헬스케어 및 미래 기술
  "비만치료제 및 GLP-1",
  "AI 기반 신약 개발",
  "디지털 헬스케어 및 의료 관리",
  "암호화폐 및 블록체인 금융",

  // ETF/펀드 및 기타
  "ETF/펀드",
  "기타",
] as const;
export type Sector = (typeof SECTOR_ENUM)[number];

// 알려진 키 — 자동완성용. 확장 가능 (string index).
export interface KnownClassification {
  sector?: Sector | string;   // 상위 카테고리 (단일) — 핵심 분야 축의 share 기준
  themes?: string[];          // 핵심 확장 분야 (다중 태그, 참고용)
  themePrimary?: string;      // 대표 테마 (1줄 요약용)
  industry?: string;          // 영문 세부 산업 (보조)
  region?: string;            // "KR"|"US"|"JP"|"CN"|"HK"|"Other"
  regionName?: string;        // 표시용 (선택)
  marketCapTier?: "large" | "mid" | "small" | "etf" | "unknown";
  indices?: string[];         // ["KOSPI","KOSPI 200"], ["NASDAQ","S&P 500"] 등
}

export type StockClassification = KnownClassification & Record<string, unknown>;

interface StorageShape {
  version: number;
  updatedAt: string;
  data: Record<string, StockClassification>;
}

function emptyStore(): StorageShape {
  return { version: SCHEMA_VERSION, updatedAt: new Date().toISOString(), data: {} };
}

function readStore(): StorageShape {
  if (typeof window === "undefined") return emptyStore();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyStore();
    const parsed = JSON.parse(raw) as StorageShape;
    if (parsed.version !== SCHEMA_VERSION || !parsed.data) return emptyStore();
    return parsed;
  } catch {
    return emptyStore();
  }
}

function writeStore(store: StorageShape): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    /* quota 등 무시 */
  }
}

// indices만 배열 합집합 처리, 나머지는 spread 덮어쓰기
function mergeClassification(prev: StockClassification | undefined, patch: StockClassification): StockClassification {
  const base = prev ?? {};
  const merged: StockClassification = { ...base, ...patch };
  const prevIndices = Array.isArray(base.indices) ? base.indices : [];
  const patchIndices = Array.isArray(patch.indices) ? patch.indices : [];
  if (prevIndices.length || patchIndices.length) {
    const set = new Set<string>();
    for (const v of prevIndices) if (typeof v === "string" && v) set.add(v);
    for (const v of patchIndices) if (typeof v === "string" && v) set.add(v);
    merged.indices = Array.from(set);
  }
  return merged;
}

export function getClassification(ticker: string): StockClassification | undefined {
  if (!ticker) return undefined;
  return readStore().data[ticker.toUpperCase()];
}

export function getAllClassifications(): Record<string, StockClassification> {
  return readStore().data;
}

export function upsertClassification(ticker: string, patch: StockClassification): void {
  if (!ticker) return;
  const key = ticker.toUpperCase();
  const store = readStore();
  store.data[key] = mergeClassification(store.data[key], patch);
  store.updatedAt = new Date().toISOString();
  writeStore(store);
}

export function upsertClassifications(patches: Record<string, StockClassification>): void {
  const entries = Object.entries(patches);
  if (entries.length === 0) return;
  const store = readStore();
  for (const [ticker, patch] of entries) {
    if (!ticker) continue;
    const key = ticker.toUpperCase();
    store.data[key] = mergeClassification(store.data[key], patch);
  }
  store.updatedAt = new Date().toISOString();
  writeStore(store);
}

export function clearClassifications(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
