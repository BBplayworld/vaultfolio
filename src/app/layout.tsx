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
        </PreferencesStoreProvider>
      </body>
    </html>
  );
}
