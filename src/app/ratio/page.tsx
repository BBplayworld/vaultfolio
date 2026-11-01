import type { Metadata } from "next";

import { Logo } from "@/components/logo";
import { APP_CONFIG, OG_IMAGE } from "@/config/app";
import { MAIN_PALETTE } from "@/config/theme";

import { RatioPreview } from "./ratio-preview";
import { RATIO_DESC, RATIO_TITLE } from "./ratio-copy";

// (main) 밖 공개 라우트 — 금고·잠금·튜토리얼 없이 캡처 1장으로 비중만 보여준다(#63).
// Next metadata는 자식이 openGraph/twitter를 정의하면 부모를 통째로 대체하므로 images까지 재선언한다.
const TITLE = `종목 비중 미리보기 — ${APP_CONFIG.name}`;
const URL_PATH = `${APP_CONFIG.siteUrl}/ratio`;

export const metadata: Metadata = {
  title: TITLE,
  description: RATIO_DESC,
  alternates: { canonical: URL_PATH },
  openGraph: {
    type: "website",
    locale: "ko_KR",
    url: URL_PATH,
    siteName: APP_CONFIG.name,
    title: TITLE,
    description: RATIO_DESC,
    images: [{ url: OG_IMAGE.url, width: OG_IMAGE.width, height: OG_IMAGE.height, alt: OG_IMAGE.alt }],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: RATIO_DESC,
    images: [OG_IMAGE.url],
  },
};

export default function RatioPage() {
  return (
    <main id="ratio-page" data-testid="ratio-page" className="min-h-dvh bg-background">
      <div className="mx-auto flex w-full max-w-[480px] flex-col gap-5 px-3 pb-10 pt-4 sm:pt-12">
        <header className="flex h-10 items-center gap-1.5">
          <Logo size={22} style={{ color: MAIN_PALETTE[0] }} />
          <span className="text-sm font-semibold text-foreground">{APP_CONFIG.name}</span>
        </header>
        <div>
          <h1 className="text-xl font-bold leading-snug text-balance break-keep sm:text-2xl">{RATIO_TITLE}</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground text-pretty break-keep">{RATIO_DESC}</p>
        </div>
        <RatioPreview />
      </div>
    </main>
  );
}
