"use client";

import React from "react";
import { resolveLogoSrc } from "@/lib/finance/logo-source";
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
 * src 해석은 `resolveLogoSrc` 공용 함수와 공유 — `StockIcon`(주식 탭 원형 아바타)도 같은 함수.
 * 캡처 DOM 전용 — 고정 px, `sm:` 금지(R32). `<img>`여야 `captureImage`의 dataURL 인라인
 * 루프를 타므로 인라인 `<svg>`로 바꾸지 말 것.
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
  const [imgError, setImgError] = React.useState(false);

  const chip = "flex items-center justify-center rounded-full overflow-hidden";

  if (etfBrand) {
    // 긴 브랜드명(TIMEFOLIO 등)은 지름 대비 글자수로 축소
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

  // 캡처 pixelRatio 3을 감안해 표시 크기보다 크게 요청(최대 512)
  const src = resolveLogoSrc(ticker, name, isForeign, { size: Math.min(512, size * 6) });
  if (!src || imgError) return null;

  return (
    <div className={chip} style={{ width: size, height: size, backgroundColor: bgColor }}>
      <img
        src={src}
        alt={name}
        className="object-cover"
        style={{ width: size, height: size }}
        onError={() => setImgError(true)}
      />
    </div>
  );
}
