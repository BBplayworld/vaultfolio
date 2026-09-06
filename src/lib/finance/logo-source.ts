/**
 * 기업 로고 src 해석 — `/api/logo` 프록시 쿼리를 만드는 단일 출처.
 *
 * 원형 아바타(`StockIcon`, 주식 탭)와 투명 로고(`BrandMark`, 인증카드 포트폴리오 도넛)가
 * 동일한 해석 규칙을 공유한다(중복 구현 금지). 렌더 모양만 각자 다르다.
 */

import { DOMESTIC_STOCK_DOMAIN_MAP } from "@/app/api/parse-screenshot/ticker-map";

/**
 * 국내 ETF 브랜드 접두어 **단일 출처**. 로고(이 파일)와 X-Ray 분류(`stock-xray.ts`)가 공유한다.
 * `ETF_DOMAIN`에 도메인이 없는 브랜드도 여기엔 포함된다(분류만 되고 로고는 없는 운용사).
 */
export const KR_ETF_BRANDS = [
  "TIGER", "KODEX", "ACE", "KBSTAR", "SOL", "RISE", "PLUS", "ARIRANG", "KOSEF", "HANARO", "KINDEX", "TIMEFOLIO", "BIG",
  "TIME", "KIWOOM", "KOACT", "WOORI", "HANA", "SHINHAN", "MERITZ", "DAISHIN", "UNICORN",
] as const;

/** 국내 ETF 브랜드 접두어 → 운용사 도메인 (키는 KR_ETF_BRANDS의 부분집합) */
export const ETF_DOMAIN: Record<string, string> = {
  TIGER: "www.tigeretf.com",
  KODEX: "www.samsungfund.com",
  ACE: "www.aceetf.co.kr",
  KINDEX: "www.aceetf.co.kr",
  HANARO: "www.hanaroetf.com",
  SOL: "www.shinhansec.com",
  RISE: "www.kbam.co.kr",
  KBSTAR: "www.kbam.co.kr",
  ARIRANG: "www.hanwhafund.co.kr",
  BIG: "www.hanwhafund.co.kr",
  PLUS: "www.hanwhafund.co.kr",
  KOSEF: "www.wooriasset.co.kr",
  TIMEFOLIO: "www.timefolio.co.kr",
};

function matchBrand(name: string, brands: readonly string[]): string | null {
  const upper = name.toUpperCase();
  for (const brand of brands) {
    if (upper.startsWith(brand + " ") || upper === brand) return brand;
  }
  return null;
}

export function getEtfDomain(name: string): string | null {
  const brand = matchBrand(name, Object.keys(ETF_DOMAIN));
  return brand ? ETF_DOMAIN[brand] : null;
}

/**
 * 국내 ETF면 브랜드명(TIGER/KODEX/ACE…), 아니면 null.
 *
 * 운용사 로고(logo.dev 도메인 조회)는 **흰 배경이 박힌 사각 이미지**라(ACE 92.9%·TIGER 97.0%가
 * 순백 불투명 — 실측) 도넛 조각 위에 얹으면 흰 박스로 뜬다. 그래서 국내 ETF는 로고를 아예
 * 요청하지 않고 이 브랜드명을 텍스트 배지로 그린다(`BrandMark`의 `etfBrand`).
 */
export function getEtfBrand(name: string): string | null {
  return matchBrand(name, KR_ETF_BRANDS);
}

export interface LogoSourceOptions {
  /** 로고가 올라갈 배경 밝기 — 어두운 배경엔 "dark"(밝은 로고 변형) */
  theme?: "light" | "dark";
  /** 요청 픽셀 크기(최대 512). 캡처는 pixelRatio 3이라 표시 크기의 3배 이상 권장 */
  size?: number;
}

/**
 * 해외 티커 → logo.dev 티커 조회, 국내 ETF → 운용사 도메인, 국내 개별주 → 종목 도메인.
 * 어디에도 걸리지 않으면 null(호출부가 이니셜·티커 텍스트로 폴백).
 *
 * 국내 ETF 운용사 로고는 흰 배경이 박힌 사각 이미지다(ACE 92.9%·TIGER 97.0%가 순백
 * 불투명 — 실측). `StockIcon`(주식 탭 원형 아바타)은 이 로고를 그대로 써도 자연스럽지만,
 * 도넛 조각처럼 색면 위에 얹는 곳(`BrandMark`)은 흰 박스가 튀어 보이므로 **호출부(`BrandMark`)가
 * `etfBrand`(`getEtfBrand`) 유무로 먼저 분기해 이 함수를 아예 호출하지 않고 텍스트 배지로 대체한다**
 * — 이 함수 자체는 국내 ETF를 배제하지 않는다(중복 판정 금지).
 */
export function resolveLogoSrc(
  ticker: string,
  name: string,
  isForeign: boolean,
  opts: LogoSourceOptions = {},
): string | null {
  const params = new URLSearchParams();

  if (isForeign && ticker && /^[A-Z]+$/.test(ticker)) {
    params.set("ticker", ticker);
  } else if (!isForeign) {
    const domain = getEtfDomain(name) ?? DOMESTIC_STOCK_DOMAIN_MAP[ticker] ?? null;
    if (!domain) return null;
    params.set("domain", domain);
  } else {
    return null;
  }

  if (opts.theme) params.set("theme", opts.theme);
  if (opts.size) params.set("size", String(opts.size));
  return `/api/logo?${params.toString()}`;
}
