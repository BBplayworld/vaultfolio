import { APP_CONFIG } from "@/config/app";
import { BrandSymbol } from "@/components/brand-symbol";

/**
 * 홈 상단 왼쪽 공식 서비스 락업(#4.66 r2): 배경 없는 브랜드 심볼 + 워드마크.
 * 워드마크는 기본 숨김(브라우저 모드는 심볼만), PWA standalone에서 `.pwa-home-wordmark`로 노출(globals.css).
 * 심볼 교체는 BrandSymbol 내부에서만. 비인터랙티브.
 */
export function BrandLockup() {
  return (
    <span className="flex items-center gap-2 min-w-0 text-foreground" data-testid="top-bar-brand">
      <BrandSymbol size={32} />
      <span className="pwa-home-wordmark hidden text-lg lg:text-xl font-bold tracking-tight whitespace-nowrap truncate">
        {APP_CONFIG.name}
      </span>
    </span>
  );
}
