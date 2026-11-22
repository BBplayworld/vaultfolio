import type { Metadata } from "next";
import Link from "next/link";

import { Logo } from "@/components/logo";
import { APP_CONFIG, OG_IMAGE } from "@/config/app";
import { MAIN_PALETTE } from "@/config/theme";

import { GuideArticle } from "./_components/guide-article";
import { MarketHistoryArticle } from "./_components/market-history-article";
import { GuideScreenTracker } from "./guide-actions";
import { ChevronRight } from "lucide-react";

import { GUIDE_BRAND_LINE, GUIDES, GUIDE_SLUGS, type GuideSlug } from "./guide-copy";

/** 본문이 투자 탭 컴포넌트(MarketHistoryArticle)인 편 */
const MARKET_ARTICLE_SLUGS: GuideSlug[] = ["market-history", "index-returns-by-year", "rate-hike-years", "recession-years"];

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
  const others = GUIDE_SLUGS.filter((s) => s !== slug);
  return (
    <main id="guide-page" data-testid="guide-page" className="min-h-dvh bg-background">
      <div className="mx-auto flex w-full max-w-[480px] flex-col gap-5 px-3 pb-10 pt-4 sm:pt-12">
        <header className="flex h-10 items-center gap-1.5">
          <Logo size={22} style={{ color: MAIN_PALETTE[0] }} />
          <span className="text-sm font-semibold text-foreground">{APP_CONFIG.name}</span>
        </header>
        <GuideScreenTracker slug={slug} />
        {MARKET_ARTICLE_SLUGS.includes(slug) ? <MarketHistoryArticle doc={doc} /> : <GuideArticle doc={doc} />}
        <nav aria-labelledby="guide-other-title" data-testid="guide-other-list" className="flex flex-col">
          <h2 id="guide-other-title" className="mb-1 text-sm font-semibold">
            다른 가이드
          </h2>
          {others.map((o) => (
            <Link
              key={o}
              data-testid={`guide-other-link-${o}`}
              href={`/guide/${o}`}
              className="flex min-h-11 items-center justify-between gap-3 border-t border-border py-2.5 text-sm font-medium text-foreground break-keep transition-colors hover:text-primary dark:border-border/40"
            >
              <span>{GUIDES[o].title}</span>
              <ChevronRight aria-hidden className="size-4 shrink-0 text-muted-foreground" />
            </Link>
          ))}
        </nav>
        <p data-testid="guide-brand" className="mt-2 text-center text-sm text-muted-foreground">
          {GUIDE_BRAND_LINE}
        </p>
      </div>
    </main>
  );
}
