import type { Metadata } from "next";
import Link from "next/link";

import { Logo } from "@/components/logo";
import { APP_CONFIG, OG_IMAGE } from "@/config/app";
import { MAIN_PALETTE } from "@/config/theme";

import { GuideArticle } from "./_components/guide-article";
import { GuideScreenTracker } from "./guide-actions";
import { GUIDE_BRAND_LINE, GUIDES, type GuideSlug } from "./guide-copy";

/** 가이드 metadata — 자식 openGraph/twitter가 부모를 통째로 대체하므로 images까지 재선언한다(/ratio와 동일 규칙) */
export function guideMetadata(slug: GuideSlug): Metadata {
  const doc = GUIDES[slug];
  const title = `${doc.title} — ${APP_CONFIG.name}`;
  const url = `${APP_CONFIG.siteUrl}/guide/${slug}`;
  return {
    title,
    description: doc.description,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      locale: "ko_KR",
      url,
      siteName: APP_CONFIG.name,
      title,
      description: doc.description,
      images: [{ url: OG_IMAGE.url, width: OG_IMAGE.width, height: OG_IMAGE.height, alt: OG_IMAGE.alt }],
    },
    twitter: { card: "summary_large_image", title, description: doc.description, images: [OG_IMAGE.url] },
  };
}

// (main) 밖 공개 정적 문서 — /ratio와 같은 껍데기(헤더 복사, 홈 링크 없음)
export function GuideShell({ slug }: { slug: GuideSlug }) {
  const doc = GUIDES[slug];
  const other = GUIDES[doc.other];
  return (
    <main id="guide-page" data-testid="guide-page" className="min-h-dvh bg-background">
      <div className="mx-auto flex w-full max-w-[480px] flex-col gap-5 px-3 pb-10 pt-4 sm:pt-12">
        <header className="flex h-10 items-center gap-1.5">
          <Logo size={22} style={{ color: MAIN_PALETTE[0] }} />
          <span className="text-sm font-semibold text-foreground">{APP_CONFIG.name}</span>
        </header>
        <GuideScreenTracker slug={slug} />
        <GuideArticle doc={doc} />
        <nav aria-label="다른 가이드">
          <Link
            data-testid="guide-other-link"
            href={`/guide/${other.slug}`}
            className="inline-flex min-h-10 items-center text-sm font-medium text-primary break-keep"
          >
            {other.title} →
          </Link>
        </nav>
        <p data-testid="guide-brand" className="mt-2 text-center text-sm text-muted-foreground">
          {GUIDE_BRAND_LINE}
        </p>
      </div>
    </main>
  );
}
