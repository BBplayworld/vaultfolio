"use client";

import { captureLogoSize } from "@/lib/finance/logo-source";
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

/**
 * 기업 로고 배지 — 인증카드 포트폴리오 도넛 "조각 안"에 얹는 용도.
 *
 * - **원형 칩 배경 = 해당 조각색**(`bgColor`). 로고는 `object-cover`로 칩을 꽉 채우고
 *   `rounded-full`로 잘라 **완전한 원**이 된다(로고 자체의 사각 모서리가 안 보인다).
 * - **국내 ETF는 `etfBrand` 텍스트 배지**로 그린다 — 운용사 로고(logo.dev 도메인 조회)가
 *   흰 배경이 박힌 사각 이미지라(ACE 92.9%·TIGER 97.0%가 순백 불투명, 실측) 조각 위에서
 *   흰 박스로 뜨기 때문. 배지 원형 배경은 조각색을 어둡게 혼합한 톤(`darkenColor(bgColor)`)을
 *   써서 실제 로고 이미지처럼 조각 위에서 도드라지되, 조각마다 색조가 달라 다양하게 보이고,
 *   글자색은 그 어두운 배경과 대비되는 톤(`pickOnColor(badgeBg)`)으로 자동 선택한다(2026-09 —
 *   처음엔 조각색 그대로 써서 밋밋했고, 이후 `pickOnColor` 두 톤 고정은 팔레트 대부분이 흰
 *   배경으로 수렴해 "무조건 흰색"으로 보이는 문제가 있었다 — 어둡게 혼합해 다양성 확보).
 * - 로고가 없거나 로드 실패하면 **아무것도 그리지 않는다**(`null`) — 빈 칩이 남지 않게.
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
  // 표시 크기 기준으로 요청(retina로 ×2 되어 pixelRatio 1 커버). etfBrand면 아래에서 미사용.
  const { imgProps } = useLogoSrc(ticker, name, isForeign, { size: captureLogoSize(size) });

  const chip = "flex items-center justify-center rounded-full overflow-hidden";

  if (etfBrand) {
    // 6자 이상 브랜드명은 표시용 축약(ETF_BRAND_ABBR) — 원문 자체는 안 바꾼다.
    const displayBrand = ETF_BRAND_ABBR[etfBrand] ?? etfBrand;
    // fontSize prop이 있으면(메인 도넛 조각) 그 값을 그대로 사용 — 칩(size)이 커져도 라벨
    // 크기는 고정. 없으면(서브칩 등) 기존처럼 지름 대비 글자수로 계산.
    const resolvedFontSize =
      fontSize ?? Math.max(9, Math.round((size * 1.55) / Math.max(4, displayBrand.length)));
    // 조각 색을 어둡게 혼합한 원형 배경 — 조각마다 색조가 달라 다양하게 보이면서(요청: "다양한
    // 배경색"), 채도 높은 팔레트를 어둡게 낮추면 항상 밝은 텍스트와 안전하게 대비된다(요청:
    // "검정 배경도 괜찮아 보여"의 절충 — 완전 검정 대신 조각색 기반 다크 톤).
    const badgeBg = darkenColor(bgColor);
    const badgeText = pickOnColor(badgeBg); // 그 어두운 배경 위에서 대비되는 텍스트 색(항상 밝은 톤)
    return (
      <div className={chip} style={{ width: size, height: size, backgroundColor: badgeBg }}>
        <span
          className="font-bold leading-none tracking-tight px-1 text-center"
          style={{ color: badgeText, fontSize: resolvedFontSize }}
        >
          {displayBrand}
        </span>
      </div>
    );
  }

  // src 없음(도메인 매핑 없음) 또는 재시도 소진 → 빈 칩 남기지 않게 아무것도 안 그림
  if (!imgProps) return null;

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
