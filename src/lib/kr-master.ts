// 국내 종목 마스터 (KRX 전종목 + ETF) — 이름→코드 권위 소스
// 데이터: src/lib/data/*.json (재생성 절차는 같은 폴더 README.md 참고)
import etfMaster from "@/lib/data/kr-etf-master.json";
import stockMaster from "@/lib/data/kr-stock-master.json";

export interface KrMasterEntry {
  code: string;
  name: string; // 한글종목약명 (증권사 표시명과 일치 — 매칭 1차 키)
  fullName: string; // 한글종목명
  market: string; // 주식=시장구분(KOSPI/KOSDAQ/...), ETF=기초시장분류(국내/해외/국내&해외)
  kind?: string; // 주식만: 주식종류(보통주/우선주 등)
}

const ETF = etfMaster as KrMasterEntry[];
const STOCK = stockMaster as KrMasterEntry[];
const ALL = [...ETF, ...STOCK];

// 약명 → 코드. 약명은 파일 내 고유(중복 0). 정규화/퍼지는 ticker-map이 담당
export const KR_NAME_TO_CODE: Record<string, string> = {};
for (const e of ALL) {
  if (e.name && !KR_NAME_TO_CODE[e.name]) KR_NAME_TO_CODE[e.name] = e.code;
}

// 전체 국내 코드 (기존 DOMESTIC_TICKERS 대체)
export const KR_CODES = new Set<string>(ALL.map((e) => e.code));

// 코드 → 약명 (xray 역맵 대체)
export const KR_CODE_TO_NAME: Record<string, string> = {};
for (const e of ALL) {
  if (!KR_CODE_TO_NAME[e.code]) KR_CODE_TO_NAME[e.code] = e.name;
}

const MARKET_BY_CODE: Record<string, string> = {};
for (const e of ALL) MARKET_BY_CODE[e.code] = e.market;

// 코드의 시장구분(통화/해외ETF 판별 보조)
export function getKrMarketByCode(code: string): string | undefined {
  return MARKET_BY_CODE[code];
}
