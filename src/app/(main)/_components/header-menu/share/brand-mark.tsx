"use client";

import { captureLogoSize } from "@/lib/finance/logo-source";
import { useLogoSrc } from "@/hooks/use-logo-src";
import { pickOnColor } from "@/config/theme";

/**
 * 기업 로고 배지 — 인증카드 포트폴리오 도넛 "조각 안"에 얹는 용도.
 *
 * - **원형 칩 배경 = 해당 조각색**(`bgColor`). 로고는 `object-cover`로 칩을 꽉 채우고
 *   `rounded-full`로 잘라 **완전한 원**이 된다(로고 자체의 사각 모서리가 안 보인다).
 * - **국내 ETF는 `etfBrand` 텍스트 배지**로 그린다 — 운용사 로고(logo.dev 도메인 조회)가
 *   흰 배경이 박힌 사각 이미지라(ACE 92.9%·TIGER 97.0%가 순백 불투명, 실측) 조각 위에서
 *   흰 박스로 뜨기 때문. 글자색은 조각색 상대휘도로 자동 선택(`pickOnColor`).
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
}: {
  ticker: string;
  name: string;
  isForeign: boolean;
  size: number;
  /** 원형 칩 배경 — 해당 도넛 조각의 색 */
  bgColor: string;
  /** 국내 ETF 브랜드명(TIGER/KODEX/ACE…) — 있으면 로고 대신 텍스트 배지 */
  etfBrand?: string | null;
}) {
  // 표시 크기 기준으로 요청(retina로 ×2 되어 pixelRatio 3 커버). etfBrand면 아래에서 미사용.
  const { imgProps } = useLogoSrc(ticker, name, isForeign, { size: captureLogoSize(size) });

  const chip = "flex items-center justify-center rounded-full overflow-hidden";

  if (etfBrand) {
    // 긴 브랜드명(TIMEFOLIO 등)은 지름 대비 글자수로 축소. 칩(size)이 scale과 무관한 고정 px에
    // 딱 맞춰 튜닝된 좁은 컨테이너라 폰트를 /scale로 키우면(도넛 라벨과 동일 패턴 시도) transform
    // 적용 전에 이미 칩보다 텍스트가 커져 넘친다(2026-09 회귀 확인·롤백) — scale 보정 없이 칩과
    // 같은 비율로 자연 축소되게 둔다.
    const fontSize = Math.max(9, Math.round((size * 1.55) / Math.max(4, etfBrand.length)));
    return (
      <div className={chip} style={{ width: size, height: size, backgroundColor: bgColor }}>
        <span
          className="font-bold leading-none tracking-tight px-1 text-center"
          style={{ color: pickOnColor(bgColor), fontSize }}
        >
          {etfBrand}
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
