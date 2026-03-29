import type { MetadataRoute } from "next";

import { APP_CONFIG } from "@/config/app";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
      },
      {
        userAgent: "Googlebot",
        allow: "/",
      },
      {
        userAgent: "Yeti", // 네이버 검색봇
        allow: "/",
      },
    ],
    sitemap: `${APP_CONFIG.siteUrl}/sitemap.xml`,
  };
}
