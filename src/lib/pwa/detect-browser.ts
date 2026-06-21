/**
 * 접속 환경(플랫폼·브라우저) 자동 감지 — 설치 가이드 공통.
 * UA 기반. 설치 플로우·설치 가이드 양쪽에서 재사용한다.
 */

export type GuidePlatform = "ios" | "android" | "pc";
export type GuideBrowser = "safari" | "chrome" | "whale" | "samsung";

export interface BrowserEnv {
  platform: GuidePlatform;
  browser: GuideBrowser;
  isInApp: boolean;
}

// 인앱 브라우저(홈 화면 추가 불가 → 외부 브라우저 유도)
export const IN_APP_BROWSER_RE = /kakaotalk|instagram|fbav|fban|fb_iab|line\/|naver\(inapp/;

/** UA로 플랫폼·브라우저·인앱 여부 판별. 비주류·불명은 safari(iOS)/chrome(Android)로 폴백. */
export function detectBrowserEnv(ua: string = typeof navigator !== "undefined" ? navigator.userAgent : ""): BrowserEnv {
  const s = ua.toLowerCase();
  const isInApp = IN_APP_BROWSER_RE.test(s);

  if (/iphone|ipad|ipod/.test(s)) {
    const browser: GuideBrowser = /crios/.test(s) ? "chrome" : /whale/.test(s) ? "whale" : "safari";
    return { platform: "ios", browser, isInApp };
  }
  if (/android/.test(s)) {
    const browser: GuideBrowser = /samsungbrowser/.test(s) ? "samsung" : /whale/.test(s) ? "whale" : "chrome";
    return { platform: "android", browser, isInApp };
  }
  return { platform: "pc", browser: "chrome", isInApp };
}
