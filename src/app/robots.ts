import type { MetadataRoute } from "next";

import { APP_CONFIG } from "@/config/app";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: "/api/",
      },
      {
        userAgent: "Googlebot",
        allow: "/",
        disallow: "/api/",
      },
      {
        userAgent: "Yeti", // 네이버 검색봇
        allow: "/",
        disallow: "/api/",
      },
    ],
    sitemap: `${APP_CONFIG.siteUrl}/sitemap.xml`,
  };
}
