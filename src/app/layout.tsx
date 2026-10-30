import { ReactNode } from "react";

import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import Script from "next/script";

import { Toaster } from "@/components/ui/sonner";
import { APP_CONFIG } from "@/config/app";
import { getPreference } from "@/server/preferences";
import { PreferencesStoreProvider } from "@/stores/preferences/preferences-provider";
import { THEME_MODE_VALUES, type ThemeMode } from "@/types/preferences/theme";

import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const viewport: Viewport = {
  userScalable: false,
  maximumScale: 1,
  initialScale: 1,
};

const OG_IMAGE = {
  url: `${APP_CONFIG.siteUrl}/og-image.png`,
  width: 1200,
  height: 630,
  alt: "안전한 자산 관리, 시크릿에셋",
} as const;

export const metadata: Metadata = {
  title: APP_CONFIG.meta.title,
  description: APP_CONFIG.meta.description,
  keywords: [...APP_CONFIG.meta.keywords],
  authors: [{ name: APP_CONFIG.name, url: APP_CONFIG.siteUrl }],
  creator: APP_CONFIG.name,
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
  alternates: {
    canonical: APP_CONFIG.siteUrl,
  },
  openGraph: {
    type: "website",
    locale: "ko_KR",
    url: APP_CONFIG.siteUrl,
    siteName: APP_CONFIG.name,
    title: APP_CONFIG.meta.title,
    description: APP_CONFIG.meta.description,
    // 링크 미리보기 정적 이미지(#48) — 브랜드 문구만, 금액·사용자 데이터 없음. 교체 시 파일명 변경(크롤러 캐시)
    images: [{ url: OG_IMAGE.url, width: OG_IMAGE.width, height: OG_IMAGE.height, alt: OG_IMAGE.alt }],
  },
  twitter: {
    card: "summary_large_image",
    title: APP_CONFIG.meta.title,
    description: APP_CONFIG.meta.description,
    images: [OG_IMAGE.url],
  },
  other: {
    "naver-site-verification": "7a749c9de7f929519b80424a0fac9c56fb9deb03",
  },
  // iOS 홈 화면 추가용 아이콘·standalone 메타 (manifest만으론 iOS가 제대로 인식 못 함)
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: APP_CONFIG.name,
  },
  icons: {
    apple: [{ url: "/icons/icon-192x192.png", sizes: "180x180", type: "image/png" }],
  },
};

export default async function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  const themeMode = await getPreference<ThemeMode>("theme_mode", THEME_MODE_VALUES, "dark");
  // Vercel이 자동 주입 — Production Branch(main) 배포일 때만 "production".
  // 로컬 `next dev`/`next build`는 미설정이라 자동으로 false(개발 환경 제외 겸함).
  // preview 배포도 "preview"라 false — GA 스크립트 자체가 렌더 안 돼 네트워크 요청도 없음.
  const gaEnabled = process.env.VERCEL_ENV === "production";

  return (
    <html
      lang="ko"
      className={themeMode === "dark" ? "dark" : ""}
      suppressHydrationWarning
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              // PWA 설치 이벤트 조기 캡처 (React 마운트 전 발생분 누락 방지)
              window.addEventListener('beforeinstallprompt', function (e) {
                e.preventDefault();
                window.__bipEvent = e;
                window.dispatchEvent(new Event('bip-captured'));
              });
              window.addEventListener('appinstalled', function () {
                window.__bipEvent = null;
                window.__pwaInstalled = true;
              });
            `
          }}
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                var ua = window.navigator.userAgent.toLowerCase();
                var isMobile = /iphone|ipad|ipod|android|webos|blackberry|iemobile|opera mini/i.test(ua);
                document.documentElement.setAttribute('data-device', isMobile ? 'mobile' : 'pc');
              } catch (_) {}
            `
          }}
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                var hash = window.location.hash;
                var themeMatch = hash.match(/[#&]theme=(light|dark)/);
                if (themeMatch) {
                  var theme = themeMatch[1];
                  document.documentElement.className = theme === 'dark' ? 'dark' : '';
                }
              } catch (_) {}
            `
          }}
        />
        {gaEnabled && (
          <>
            <script
              dangerouslySetInnerHTML={{
                __html: `
                  // gtag 큐를 hydration 전에 정의 — 초기 화면 page_view 등 앱 이벤트가 gtag.js 로드 전에도 유실되지 않게.
                  // localStorage 예외(사생활 보호 모드 등)와 무관하게 항상 정의되도록 플래그 처리보다 앞에 둔다.
                  var GA_ID = '${APP_CONFIG.gaId}';
                  window.dataLayer = window.dataLayer || [];
                  function gtag(){dataLayer.push(arguments);}
                  window.gtag = gtag;
                  var gaDebug = false;
                  try {
                    var host = window.location.hostname;
                    // 로컬 개발 환경은 자동 제외
                    // 인라인 스크립트 문자열이라 정규식의 점 이스케이프는 역슬래시 2개로 써야 한다.
                    // 1개만 쓰면 템플릿 리터럴이 삼켜 점이 와일드카드가 되고, "local"로 끝나는 모든 호스트가 매칭된다.
                    var isLocal = host === 'localhost' || host === '127.0.0.1' || host === '[::1]' || /\\.local$/.test(host);
                    var params = new URLSearchParams(window.location.search);
                    // 특정 URL로 본인 기기에 플래그 기록/해제
                    if (params.get('ga-optout') === '1') localStorage.setItem('ga-optout', '1');
                    if (params.get('ga-optout') === '0') localStorage.removeItem('ga-optout');
                    // DebugView 검증용 디버그 플래그(S-4.28) — ga-optout과 동일 패턴
                    if (params.get('ga-debug') === '1') localStorage.setItem('ga-debug', '1');
                    if (params.get('ga-debug') === '0') localStorage.removeItem('ga-debug');
                    gaDebug = localStorage.getItem('ga-debug') === '1';
                    // 로컬 접속이거나 플래그 있으면 GA 전송 완전 차단
                    if (isLocal || localStorage.getItem('ga-optout') === '1') {
                      window['ga-disable-' + GA_ID] = true;
                    }
                  } catch (_) {}
                  gtag('js', new Date());
                  // 자동 page_view 끔 — 화면 전환은 앱이 가상 경로(/v/<화면>)로 직접 보낸다.
                  // page_location을 origin+pathname으로 고정해 URL 해시(#share·#sync)·쿼리(?url)가 전송되지 않게 한다.
                  var gaConfig = { send_page_view: false, page_location: window.location.origin + window.location.pathname };
                  if (gaDebug) gaConfig.debug_mode = true;
                  gtag('config', GA_ID, gaConfig);
                `
              }}
            />
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${APP_CONFIG.gaId}`}
              strategy="afterInteractive"
            />
          </>
        )}
      </head>
      <body className={`${inter.className} min-h-screen antialiased`}>
        <PreferencesStoreProvider themeMode={themeMode}>
          {children}
          <Toaster />
          <script
            dangerouslySetInnerHTML={{
              __html: `
                if ('serviceWorker' in navigator) {
                  // 새 SW는 install→activate→clients.claim()까지 조용히 진행되고,
                  // 다음 자연스러운 진입(다음 방문·탭 재실행)부터 새 번들을 받는다.
                  // 과거엔 controllerchange에서 즉시 location.reload()를 강제했는데,
                  // 배포 직후 CDN/엣지 인스턴스 간 빌드가 잠깐 어긋나는 배포 스큐 구간에서
                  // reload→다른 버전 sw.js 수신→install→activate→controllerchange→reload가
                  // 반복되는 무한 새로고침 루프를 만들 수 있었다(모바일 크롬에서 특히 재현,
                  // visibilitychange마다 reg.update()가 잦아 재발 빈도가 높음). 세션 중 하드
                  // 리로드가 사용자 흐름을 끊는 비용이 즉시 반영의 이득보다 크므로 제거한다(2026-08).
                  window.addEventListener('load', function() {
                    navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' }).then(function(reg) {
                      reg.update();
                      // 포그라운드 복귀 시마다 최신 SW 확인
                      document.addEventListener('visibilitychange', function() {
                        if (document.visibilityState === 'visible') reg.update();
                      });
                    }).catch(function(err) {
                      console.error('ServiceWorker registration failed: ', err);
                    });
                  });
                }
              `
            }}
          />
        </PreferencesStoreProvider>
      </body>
    </html>
  );
}
