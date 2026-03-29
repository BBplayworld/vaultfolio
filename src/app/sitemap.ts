import type { MetadataRoute } from "next";

import { APP_CONFIG } from "@/config/app";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: APP_CONFIG.siteUrl,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1.0,
    },
    {
      url: `${APP_CONFIG.siteUrl}/asset`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.9,
    },
  ];
}
