/**
 * 인앱 브라우저 → 외부 브라우저(Chrome/Safari) 이동.
 * Android는 스킴으로 자동 이동, iOS는 신뢰 가능한 스킴이 없어 수동 가이드로 폴백한다.
 */

import { detectBrowserEnv } from "./detect-browser";

/**
 * targetUrl을 외부 브라우저에서 연다.
 * @returns 자동 이동을 시도했으면 true, 불가(iOS 등)면 false — 호출측은 false일 때 수동 가이드/클립보드로 폴백.
 */
export function openExternalBrowser(targetUrl: string): boolean {
  if (typeof window === "undefined") return false;

  const ua = navigator.userAgent.toLowerCase();
  const { platform } = detectBrowserEnv();

  // iOS 인앱 브라우저: 외부 Safari로 자동 이동시키는 신뢰 가능한 스킴이 없다 → 수동 가이드로 폴백
  if (platform === "ios") return false;

  // Android 카카오톡: 전용 외부 브라우저 스킴 (신뢰성 높음)
  if (ua.includes("kakaotalk")) {
    window.location.href = "kakaotalk://web/openExternal?url=" + encodeURIComponent(targetUrl);
    return true;
  }

  // Android 그 외 인앱(네이버/인스타/라인/페북): intent:// 스킴으로 기본 브라우저 유도.
  // 원본 해시(#share=)는 intent의 #Intent 구분자와 충돌하므로 intent 경로에 넣지 않고
  // browser_fallback_url(전체 URL 인코딩)에만 담아 해시까지 보존한다.
  try {
    const u = new URL(targetUrl);
    const hostPathQuery = u.host + u.pathname + u.search;
    const fallback = encodeURIComponent(targetUrl);
    window.location.href =
      `intent://${hostPathQuery}` +
      `#Intent;scheme=https;S.browser_fallback_url=${fallback};end`;
    return true;
  } catch {
    // URL 파싱 실패 시 자동 이동 불가로 간주
    return false;
  }
}
