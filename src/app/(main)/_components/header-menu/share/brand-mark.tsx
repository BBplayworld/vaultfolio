"use client";

import { captureLogoSize, getLogoInitial } from "@/lib/finance/logo-source";
import { useLogoSrc } from "@/hooks/use-logo-src";
import { pickOnColor, darkenColor } from "@/config/theme";

// 6자 이상 ETF 브랜드명만 표시용으로 축약(칩 안 텍스트 전용 — getEtfBrand()가 반환하는 원문
// 자체는 안 바꾼다). 5자 이하(TIGER/KODEX/KOSEF/KOACT/WOORI 등)는 고정 폰트 14px에서 이미
// 안 잘려 축약 불필요. 여기 값은 서로/기존 5자 이하 브랜드와 표시 문자열이 겹치지 않도록
// 수동 지정(예: HANARO→HANR, HANA와 구분).
const ETF_BRAND_ABBR: Record<string, string> = {
  KBSTAR: "KBST",
  HANARO: "HANR",
  KINDEX: "KNDX",
  KIWOOM: "KIWO",
  MERITZ: "MERI",
  ARIRANG: "ARIR",
  SHINHAN: "SHIN",
  DAISHIN: "DAIS",
  UNICORN: "UNIC",
  TIMEFOLIO: "TFOL",
};

// etfBrand 배지·로고 실패 폴백이 공유하는 "어두운 원형 배경 + 대비 텍스트" 렌더 — 중복 제거.
// 조각 색을 어둡게 혼합한 배경(darkenColor)에 대비 텍스트(pickOnColor)를 얹어, 조각마다
// 색조가 달라 다양하게 보이면서도 항상 안전한 대비를 보장한다(BrandMark 문서 주석 참고).
function renderMonogramBadge(text: string, size: number, bgColor: string, fontSize?: number, darkenFactor?: number) {
  const resolvedFontSize = fontSize ?? Math.max(9, Math.round((size * 1.55) / Math.max(4, text.length)));
  const badgeBg = darkenColor(bgColor, darkenFactor);
  const badgeText = pickOnColor(badgeBg);
  return (
    <div className="flex items-center justify-center rounded-full overflow-hidden" style={{ width: size, height: size, backgroundColor: badgeBg }}>
      <span
        className="font-bold leading-none tracking-tight px-1 text-center"
        style={{ color: badgeText, fontSize: resolvedFontSize }}
      >
        {text}
      </span>
    </div>
  );
}

/**
 * 기업 로고 배지 — 인증카드 포트폴리오 도넛 "조각 안"에 얹는 용도.
 *
 * - **원형 칩 배경 = 해당 조각색**(`bgColor`) — 일반 종목(국내 개별주·해외 종목) 로고는 이
 *   색 위에 `object-cover`로 칩을 꽉 채우고 `rounded-full`로 잘라 완전한 원이 된다.
 * - **국내 ETF(`etfBrand`)는 항상 흰 원형 배지 위에 실제 로고**를 얹는다 — 운용사 로고
 *   (logo.dev 도메인 조회)는 대부분 불투명 배경이 박힌 사각 이미지라(TIGER 95.9%·ACE/KINDEX
 *   91.7% 등 흰 배경, RISE/KBSTAR 노란 배경, HANARO 검정 배경, KODEX만 투명 — 2026-09 실측)
 *   조각 색 위에 바로 얹으면 색이 안 맞는 박스로 튄다. 배경을 조각 색과 무관하게 항상 흰색으로
 *   고정하면 로고 자체의 불투명 배경이 "의도된 로고 배지"처럼 자연스럽게 읽힌다(금융 앱의 기관
 *   로고 배지와 동일한 패턴). logo.dev에 로고 자체가 없는 브랜드(예: KOSEF)만 브랜드명 텍스트
 *   배지로 폴백한다.
 * - 그 외 로고가 없거나 로드 실패하면 **종목 이니셜 배지로 대체한다**(빈 칩 금지) — `getLogoInitial`로
 *   만든 이니셜은 `StockIcon`(주식 현황)과 동일 알고리즘이라 같은 종목이면 항상 같은 이니셜이 뜬다.
 *   텍스트 배지(브랜드명·이니셜 공용)는 조각색을 어둡게 혼합한 톤(`darkenColor(bgColor)`)을
 *   배경으로 써서 조각마다 색조가 달라 다양하게 보이되, 글자색은 그 어두운 배경과 대비되는 톤
 *   (`pickOnColor(badgeBg)`)으로 자동 선택한다(2026-09 — 처음엔 조각색 그대로 써서 밋밋했고,
 *   이후 `pickOnColor` 두 톤 고정은 팔레트 대부분이 흰 배경으로 수렴해 "무조건 흰색"으로 보이는
 *   문제가 있었다 — 어둡게 혼합해 다양성 확보).
 *
 * src 해석·로드 재시도는 `useLogoSrc` 공용 훅 — `StockIcon`(주식 탭 원형 아바타)도 같은 훅.
 * 캡처 DOM 전용 — 고정 px, `sm:` 금지(R32). `<img>`여야 `captureImage`의 dataURL 인라인
 * 루프를 타므로 인라인 `<svg>`로 바꾸지 말 것. 요청 크기는 `captureLogoSize`로 표시 px 기준
 * 환산(과대 요청 시 모바일 WebView가 로고를 못 그린다).
 */
export function BrandMark({
  ticker,
  name,
  isForeign,
  size,
  bgColor,
  etfBrand,
  fontSize,
}: {
  ticker: string;
  name: string;
  isForeign: boolean;
  size: number;
  /** 원형 칩 배경 — 해당 도넛 조각의 색 */
  bgColor: string;
  /** 국내 ETF 브랜드명(TIGER/KODEX/ACE…) — 있으면 로고 대신 텍스트 배지 */
  etfBrand?: string | null;
  /** 지정 시 이 값을 그대로 폰트 크기(px)로 사용(계산식 무시). 메인 도넛 조각에서 "칩이
   *  커져도 라벨 크기는 커지지 않게" 고정하는 용도. 미지정(서브칩 등)이면 기존 계산식 유지. */
  fontSize?: number;
}) {
  // 표시 크기 기준으로 요청(retina로 ×2 되어 pixelRatio 3 커버). etfBrand·일반 종목 공용.
  const { imgProps } = useLogoSrc(ticker, name, isForeign, { size: captureLogoSize(size) });

  const chip = "flex items-center justify-center rounded-full overflow-hidden";

  if (etfBrand) {
    if (imgProps) {
      // 국내 ETF 로고는 대부분 불투명 배경(흰색·노란색·검정 등)이라 조각 색 위에 바로 얹으면
      // 색이 안 맞는 박스로 튄다 — 흰 원형 배지 위에 얹으면 "의도된 로고 배지"로 자연스럽게
      // 읽힌다(금융 앱의 기관 로고 배지와 동일한 패턴). 조각 색과 무관하게 항상 흰 배경 고정.
      return (
        <div className={chip} style={{ width: size, height: size, backgroundColor: "#FFFFFF" }}>
          <img
            key={imgProps.src}
            {...imgProps}
            alt={name}
            className="object-cover"
            style={{ width: size, height: size }}
          />
        </div>
      );
    }
    // logo.dev에 로고 자체가 없는 브랜드(예: KOSEF, 404) — 브랜드명 텍스트 배지로 폴백.
    // 6자 이상 브랜드명은 표시용 축약(ETF_BRAND_ABBR) — 원문 자체는 안 바꾼다.
    const displayBrand = ETF_BRAND_ABBR[etfBrand] ?? etfBrand;
    return renderMonogramBadge(displayBrand, size, bgColor, fontSize);
  }

  // src 없음(도메인/티커 매핑 실패) 또는 재시도(최대 3회) 소진 → 빈 칩 대신 종목 이니셜 배지로
  // 대체한다(어떤 경우든 최종 원형 로고를 노출). getLogoInitial은 StockIcon(주식 현황)과 동일
  // 알고리즘 — 같은 종목이면 두 화면에서 항상 같은 이니셜이 뜬다.
  if (!imgProps) {
    // 로고 실패 폴백은 vivid 팔레트 원색이 밝아 기본 factor(0.55)로는 카드 검정 배경과 대비가
    // 약해 흐릿해 보인다는 피드백 — 이 경로만 더 진하게(0.72) 섞어 텍스트 대비를 확보한다.
    return renderMonogramBadge(getLogoInitial(ticker, name), size, bgColor, fontSize, 0.72);
  }

  return (
    <div className={chip} style={{ width: size, height: size, backgroundColor: bgColor }}>
      <img
        key={imgProps.src}
        {...imgProps}
        alt={name}
        className="object-cover"
        style={{ width: size, height: size }}
      />
    </div>
  );
}
