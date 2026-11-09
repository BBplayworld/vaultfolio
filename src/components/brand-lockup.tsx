import { BrandSymbol } from "@/components/brand-symbol";
import { BrandWordmark } from "@/components/brand-wordmark";

/**
 * 홈 상단 왼쪽 공식 서비스 락업(#4.66 R3·R4): C 레이어 S 심볼 + SVG 워드마크.
 * 브라우저 모드는 심볼만(32px 박스, 기존 사양). PWA standalone에서 `.pwa-home-symbol`·`.pwa-home-wordmark`(globals.css)로
 * 심볼 21px(lg 24.2px, S 잉크 17.6/20.3)·워드마크 잉크 높이 13px(lg 15px) = 심볼 잉크 높이의 약 0.74 — R4 대표 "둘 다 줄여"로 토스뱅크급 절제 크기.
 * 간격은 심볼 박스 우측 여백만(잉크 간격 = 심볼 잉크 폭의 약 31%).
 * 두 요소 모두 잉크 세로 중심 = 박스 중심이라 items-center로 광학 정렬된다. 비인터랙티브.
 */
export function BrandLockup() {
  return (
    <span className="flex items-center min-w-0" data-testid="top-bar-brand">
      <BrandSymbol size={32} className="pwa-home-symbol" />
      <BrandWordmark className="pwa-home-wordmark hidden h-[13px] lg:h-[15px] text-[color:var(--brand-wordmark)]" />
    </span>
  );
}
