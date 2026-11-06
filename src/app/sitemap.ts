import type { MetadataRoute } from "next";

import { APP_CONFIG } from "@/config/app";

import { GUIDES, GUIDE_SLUGS } from "./guide/guide-copy";

// lastModified는 문서별 고정 날짜 — 글·화면을 고칠 때만 갱신한다(호출 시각 사용 금지)
export default function sitemap(): MetadataRoute.Sitemap {
  const base = APP_CONFIG.siteUrl;
  return [
    { url: base, lastModified: new Date("2026-11-06"), changeFrequency: "weekly", priority: 1.0 },
    { url: `${base}/ratio`, lastModified: new Date("2026-11-06"), changeFrequency: "monthly", priority: 0.8 },
    ...GUIDE_SLUGS.map((slug) => ({
      url: `${base}/guide/${slug}`,
      lastModified: new Date(GUIDES[slug].lastModified),
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
  ];
}
