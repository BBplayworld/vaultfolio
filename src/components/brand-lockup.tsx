import { BrandSymbol } from "@/components/brand-symbol";
import { BrandWordmark } from "@/components/brand-wordmark";

/**
 * 홈 상단 왼쪽 공식 서비스 락업(#4.66 logo-spec + 대표 R6): C 레이어 S 심볼 + SVG 워드마크, 단일 색 `--brand-logo`.
 * 브라우저 모드는 심볼만(32px 박스, 기존 사양). PWA standalone에서 `.pwa-home-symbol`·`.pwa-home-wordmark`(globals.css)로
 * 심볼 19.58px 박스(S 잉크 16.4, R6 "S 조금 더 줄여" 17.6→16.4)·워드마크 잉크 높이 13px, lg는 15/13배(박스 22.6·S 잉크 18.92·워드마크 15px).
 * 잉크 간격 = S 잉크 폭의 42.3%(375 5.12px, lg 5.91px) = 심볼 박스 우측 여백 + 워드마크 margin-left 1.39px(lg 1.6px).
 * 세로: 두 잉크 중심 = 박스 중심(items-center) + 워드마크 무게중심 보정 0.25px(lg 0.3px) 하향. 비인터랙티브.
 */
export function BrandLockup() {
  return (
    <span className="flex items-center min-w-0" data-testid="top-bar-brand">
      <BrandSymbol size={32} className="pwa-home-symbol" />
      <BrandWordmark className="pwa-home-wordmark hidden h-[13px] lg:h-[15px] ml-[1.39px] lg:ml-[1.6px] translate-y-[0.25px] lg:translate-y-[0.3px] text-[color:var(--brand-logo)]" />
    </span>
  );
}
