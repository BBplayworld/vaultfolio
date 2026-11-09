import { APP_CONFIG } from "@/config/app";

/**
 * 홈 상단 왼쪽 공식 서비스 락업(#4.66 r2): 앱 아이콘 타일(manifest 아이콘과 동일) + 워드마크.
 * 워드마크는 기본 숨김(브라우저 모드는 타일만), PWA standalone에서 `.pwa-home-wordmark`로 노출(globals.css).
 * 192px 원본을 32px로 축소해 2x/3x 화면에서도 선명. 비인터랙티브.
 */
export function BrandLockup() {
  return (
    <span className="flex items-center gap-2 min-w-0 text-foreground" data-testid="top-bar-brand">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/icons/icon-192x192.png"
        alt=""
        width={32}
        height={32}
        className="size-8 rounded-lg shrink-0 ring-1 ring-foreground/10"
      />
      <span className="pwa-home-wordmark hidden text-lg lg:text-xl font-bold tracking-tight whitespace-nowrap truncate">
        {APP_CONFIG.name}
      </span>
    </span>
  );
}
