/**
 * /api/pwa-manifest
 * 동적 manifest 엔드포인트.
 * startUrl 파라미터로 start_url을 오버라이드하여 PWA 설치 시 공유 토큰 포함 가능.
 */

import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const startUrl = searchParams.get("startUrl") || "/";

  const manifest = {
    name: "시크릿에셋 (Secret Asset)",
    short_name: "시크릿에셋",
    description: "서버 저장 없는 나만의 암호화 자산 금고",
    id: "/asset",
    start_url: startUrl,
    scope: "/",
    display: "standalone",
    background_color: "#09090b",
    theme_color: "#09090b",
    icons: [
      {
        src: "/icons/icon-192x192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    share_target: {
      action: "/",
      method: "GET",
      enctype: "application/x-www-form-urlencoded",
      params: {
        title: "title",
        text: "text",
        url: "url",
      },
    },
  };

  return new NextResponse(JSON.stringify(manifest), {
    headers: {
      "Content-Type": "application/manifest+json",
      "Cache-Control": "no-cache, no-store",
    },
  });
}
