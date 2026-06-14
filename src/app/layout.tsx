import { ReactNode } from "react";

import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import Script from "next/script";

import { Toaster } from "@/components/ui/sonner";
import { APP_CONFIG } from "@/config/app";
import { getPreference } from "@/server/server-actions";
import { PreferencesStoreProvider } from "@/stores/preferences/preferences-provider";
import { THEME_MODE_VALUES, type ThemeMode } from "@/types/preferences/theme";

import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const viewport: Viewport = {
  userScalable: false,
  maximumScale: 1,
  initialScale: 1,
};

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
  },
  twitter: {
    card: "summary",
    title: APP_CONFIG.meta.title,
    description: APP_CONFIG.meta.description,
  },
  other: {
    "naver-site-verification": "7a749c9de7f929519b80424a0fac9c56fb9deb03",
  },
  // iOS 홈 화면 추가용 아이콘·standalone 메타 (manifest만으론 iOS가 제대로 인식 못 함)
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "시크릿에셋",
  },
  icons: {
    apple: [{ url: "/icons/icon-192x192.png", sizes: "180x180", type: "image/png" }],
  },
};

export default async function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  const themeMode = await getPreference<ThemeMode>("theme_mode", THEME_MODE_VALUES, "dark");

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
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-PZXY31JVEW"
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-PZXY31JVEW');
          `}
        </Script>
      </head>
      <body className={`${inter.className} min-h-screen antialiased`}>
        <PreferencesStoreProvider themeMode={themeMode}>
          {children}
          <Toaster />
          <script
            dangerouslySetInnerHTML={{
              __html: `
                if ('serviceWorker' in navigator) {
                  window.addEventListener('load', function() {
                    navigator.serviceWorker.register('/sw.js').then(function(reg) {
                      console.log('ServiceWorker registration successful');
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
