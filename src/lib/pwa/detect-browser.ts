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
  /** iOS Safari 신형(하단 단일 바 ⋯ 더보기 메뉴 → 공유) 여부. iOS 메이저 ≥ 18. */
  iosSafariModern: boolean;
}

// 인앱 브라우저(홈 화면 추가 불가 → 외부 브라우저 유도)
export const IN_APP_BROWSER_RE = /kakaotalk|instagram|fbav|fban|fb_iab|line\/|naver\(inapp/;

// iOS Safari 신형 가이드(⋯ 메뉴 → 공유) 적용 최소 메이저 버전.
// iOS 18부터 하단 단일 바에 ⋯ 더보기 메뉴 도입 → 그 안에서 공유. iOS 17 이하는 공유 버튼 직접 탭(구형).
const IOS_SAFARI_MODERN_MAJOR = 18;

/**
 * UA에서 iOS 메이저 버전 파싱.
 *  - iPhone/iPad 정식 UA: "CPU iPhone OS 17_0 like..." → 17
 *  - iPadOS 13+ 데스크톱 위장 UA(Macintosh): "os" 토큰은 "Mac OS X 10_15"로 고정 → `Version/16.5` 폴백
 */
function parseIosMajor(s: string): number {
  const m = s.match(/(?:iphone |ipad )?os (\d+)[_.]/) ?? s.match(/version\/(\d+)/);
  return m ? parseInt(m[1], 10) : 0;
}

/**
 * UA로 플랫폼·브라우저·인앱 여부 판별. 비주류·불명은 safari(iOS)/chrome(Android)로 폴백.
 * @param maxTouchPoints iPadOS 13+ 는 데스크톱 Safari UA(Macintosh)로 위장 → 터치포인트로 iPad 판별.
 */
export function detectBrowserEnv(
  ua: string = typeof navigator !== "undefined" ? navigator.userAgent : "",
  maxTouchPoints: number = typeof navigator !== "undefined" ? (navigator.maxTouchPoints ?? 0) : 0,
): BrowserEnv {
  const s = ua.toLowerCase();
  const isInApp = IN_APP_BROWSER_RE.test(s);

  // iPadOS 13+ Safari는 "Macintosh" UA로 위장 → 멀티터치(maxTouchPoints>1)면 iPad로 간주
  const isIpadOS = /macintosh/.test(s) && maxTouchPoints > 1;

  if (/iphone|ipad|ipod/.test(s) || isIpadOS) {
    const browser: GuideBrowser = /crios/.test(s) ? "chrome" : /whale/.test(s) ? "whale" : "safari";
    // 신형 판정은 순정 Safari에만 의미(크롬/웨일 iOS는 자체 공유 위치) → safari + iOS ≥ 18
    const iosSafariModern = browser === "safari" && parseIosMajor(s) >= IOS_SAFARI_MODERN_MAJOR;
    return { platform: "ios", browser, isInApp, iosSafariModern };
  }
  if (/android/.test(s)) {
    const browser: GuideBrowser = /samsungbrowser/.test(s) ? "samsung" : /whale/.test(s) ? "whale" : "chrome";
    return { platform: "android", browser, isInApp, iosSafariModern: false };
  }
  return { platform: "pc", browser: "chrome", isInApp, iosSafariModern: false };
}
