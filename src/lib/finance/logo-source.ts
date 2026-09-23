/**
 * 기업 로고 src 해석 — `/api/logo` 프록시 쿼리를 만드는 단일 출처.
 *
 * 원형 아바타(`StockIcon`, 주식 탭)와 투명 로고(`BrandMark`, 인증카드 포트폴리오 도넛)가
 * 동일한 해석 규칙을 공유한다(중복 구현 금지). 렌더 모양만 각자 다르다.
 */

import { DOMESTIC_STOCK_DOMAIN_MAP } from "@/app/api/parse-screenshot/ticker-map";
import { US_TICKER_TO_NAME } from "@/lib/finance/us-master";

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
 * 운용사 로고(logo.dev 도메인 조회)는 대부분 **불투명 배경이 박힌 사각 이미지**다(실측 —
 * TIGER 95.9%·ACE/KINDEX 91.7%·ARIRANG/BIG/PLUS 91.6%·TIMEFOLIO 90.5%·SOL 85.4% 흰 배경,
 * RISE/KBSTAR 노란 배경, HANARO 검정 배경, KODEX만 완전 투명 — 2026-09). `BrandMark`는 이
 * 브랜드명을 신호로 받아 로고를 **흰 원형 배지 위**에 얹어 그린다 — 조각 색과 무관하게 항상
 * 흰 배경이라 로고 자체의 불투명 배경이 "의도된 로고 배지"처럼 자연스럽게 읽힌다.
 */
export function getEtfBrand(name: string): string | null {
  return matchBrand(name, KR_ETF_BRANDS);
}

/** 로고 실패 시 표시할 이니셜(영문·한글만, 최대 2자, 대문자) — `StockIcon`(주식 현황)·
 *  `BrandMark`(인증카드 포트폴리오 도넛) 공용. 두 곳이 같은 종목에 항상 같은 이니셜을 보이도록
 *  단일 출처화한다(중복 구현 금지).
 *
 *  국내 종목 티커(예: "015760")는 숫자뿐이라 영문·한글만 남기는 정규식을 거치면 빈 문자열이
 *  된다 — `ticker || name`처럼 티커를 우선하면 이 경우 이니셜이 통째로 사라진다(2026-09 버그:
 *  한국전력·맥쿼리인프라 등 도메인 매핑 없는 국내 종목의 폴백 배지가 빈 채로 렌더됨). 티커에서
 *  뽑은 결과가 비어 있으면 종목명으로 폴백한다. */
export function getLogoInitial(ticker: string, name: string): string {
  const fromTicker = ticker.replace(/[^A-Za-z가-힣]/g, "").slice(0, 2).toUpperCase();
  if (fromTicker) return fromTicker;
  return name.trim().replace(/[^A-Za-z가-힣]/g, "").slice(0, 2).toUpperCase();
}

/** 해외 ETF는 logo.dev `ticker/{TICKER}` 카탈로그에 브랜드 로고가 없는 경우가 많다(운용사
 *  브랜드가 아니라 상품명이라 인식 못 함 — 실측: SPY는 성공, QQQ·VOO는 실패). 펀드명(예:
 *  "Vanguard S&P 500 ETF")에 운용사 브랜드가 그대로 포함돼 있으므로, US_TICKER_TO_NAME
 *  (`us-master.ts`, us-etf-master.json 5185종 전체 인덱스 — 신규 데이터 불필요)에서 이름을
 *  찾아 키워드 매칭하면 운용사 공식 도메인을 얻을 수 있다 — logo.dev 도메인 모드(국내 ETF
 *  도메인 조회와 동일 방식)로 조회하면 QQQ/VOO뿐 아니라 같은 운용사의 다른 ETF도 커버된다. */
const US_ETF_ISSUER_KEYWORDS: readonly (readonly [string, string])[] = [
  ["Vanguard", "vanguard.com"],
  ["iShares", "ishares.com"],
  ["Invesco", "invesco.com"],
  ["SPDR", "ssga.com"],
  ["State Street", "ssga.com"],
  ["Schwab", "schwabassetmanagement.com"],
  ["Fidelity", "fidelity.com"],
  ["First Trust", "ftportfolios.com"],
  ["WisdomTree", "wisdomtree.com"],
  ["Global X", "globalxetfs.com"],
  ["ProShares", "proshares.com"],
  ["Direxion", "direxion.com"],
  ["VanEck", "vaneck.com"],
];

function getUsEtfIssuerDomain(ticker: string): string | null {
  const name = US_TICKER_TO_NAME[ticker.toUpperCase()];
  if (!name) return null;
  for (const [keyword, domain] of US_ETF_ISSUER_KEYWORDS) {
    if (name.includes(keyword)) return domain;
  }
  return null;
}

export interface LogoSourceOptions {
  /** 로고가 올라갈 배경 밝기 — 어두운 배경엔 "dark"(밝은 로고 변형) */
  theme?: "light" | "dark";
  /**
   * `/api/logo`에 넘길 요청 픽셀 크기(최대 512). **표시 CSS px을 그대로 넣지 말고**
   * 호출부가 `captureLogoSize(표시px)`로 환산해 전달한다(아래 주석 참고).
   */
  size?: number;
}

/** 인증카드 캡처 `pixelRatio` — `share-menu.tsx` captureImage와 동일해야 한다 */
export const CAPTURE_PIXEL_RATIO = 3;

/**
 * 표시 CSS px → `/api/logo` 요청 size.
 *
 * `/api/logo` route가 항상 `retina=true`를 강제해 **반환 PNG = 요청 size의 2배**다.
 * 따라서 표시px×pixelRatio(3) 해상도를 얻으려면 요청 size는 그 절반(= 표시px×1.5)이면 된다.
 * 과거엔 44~92px 칩에 512(→retina 1024px PNG)를 요청해 모바일 WebView가 디코드/메모리
 * 한계로 로고를 통째로 못 그렸다(인증카드 저장 시 로고 누락 버그, 2026-09).
 */
export function captureLogoSize(displayPx: number): number {
  return Math.ceil((displayPx * CAPTURE_PIXEL_RATIO) / 2);
}

/**
 * 해외 스타일 티커(영문only) → 유명 ETF는 운용사 도메인(US_ETF_ISSUER_KEYWORDS), 아니면
 * logo.dev 티커 조회. 국내 ETF → 운용사 도메인, 국내 개별주 → 종목 도메인. 어디에도 걸리지
 * 않으면 null(호출부가 이니셜·티커 텍스트로 폴백).
 *
 * **`isForeign`이 아니라 티커 형태로 우선 분기한다.** `isForeign`은 "해외 계좌" 카테고리
 * 여부일 뿐이라(`stock.category === "foreign"`), IRP·ISA·연금 계좌로 담은 QQQ/VOO 같은
 * 미국 ETF는 통화가 USD라도 `isForeign=false`로 들어온다 — 예전엔 이 경우 국내 분기로
 * 빠져 도메인 매핑이 없어 로고를 통째로 못 찾았다(2026-09 버그: IRP/ISA 보유 해외 ETF
 * 로고 누락). 국내 종목 코드는 6자리 숫자뿐이라 영문 전용 정규식(`/^[A-Z]+$/`)과 절대
 * 겹치지 않으므로, 계좌 카테고리와 무관하게 "티커가 영문뿐이면 해외 로고 경로"로 판단해도
 * 안전하다.
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
  const isAlphaTicker = /^[A-Z]+$/i.test(ticker);

  if (ticker && isAlphaTicker) {
    const etfDomain = getUsEtfIssuerDomain(ticker);
    if (etfDomain) {
      params.set("domain", etfDomain);
    } else {
      params.set("ticker", ticker.toUpperCase());
    }
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
