// GA4 gtag 전역 타입 (S-4.28) — layout.tsx가 production에서만 주입하므로 모두 optional
export {};

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
    // GA 공식 옵트아웃 플래그(window['ga-disable-<측정ID>'] = true면 전송 중단)
    [key: `ga-disable-${string}`]: boolean | undefined;
  }
}
