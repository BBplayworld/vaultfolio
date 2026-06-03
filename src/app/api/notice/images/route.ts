import { NextResponse } from "next/server";
import { list } from "@vercel/blob";
import { readdir } from "fs/promises";
import path from "path";

const IMAGE_EXT = /\.(png|jpe?g|gif|webp|svg|avif)$/i;

export async function GET() {
  // 운영: Vercel Blob의 notice/ 폴더에서 stem → URL 매핑
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    try {
      const { blobs } = await list({ prefix: "notice/", token: process.env.BLOB_READ_WRITE_TOKEN });
      const images: Record<string, string> = {};
      for (const b of blobs) {
        if (b.pathname.endsWith("/")) continue;
        // "notice/portfolio-chart.png" → "portfolio-chart"
        const stem = b.pathname.replace(/^notice\//, "").replace(/\.[^.]+$/, "");
        images[stem] = b.url;
      }
      // [디버그] preview에서 이미지 누락 원인 추적용 (진단 후 제거)
      console.log("[notice-images] blob 조회", {
        source: "blob",
        blobCount: blobs.length,
        pathnames: blobs.map((b) => b.pathname),
        mappedKeys: Object.keys(images),
      });
      return NextResponse.json({ images });
    } catch (e) {
      console.warn("[notice-images] blob 조회 실패", e);
      return NextResponse.json({ images: {} });
    }
  }

  // 로컬/개발(Blob 토큰 없음): public/notice/ 디렉토리를 이미지 경로로 사용해 공지 이미지 테스트
  // 파일명(확장자 제외) = NEXT_PUBLIC_NOTICE items[].image 의 stem. 예: public/notice/stock-xray.jpg → "stock-xray"
  try {
    const dir = path.join(process.cwd(), "public", "notice");
    const files = await readdir(dir);
    const images: Record<string, string> = {};
    for (const file of files) {
      if (!IMAGE_EXT.test(file)) continue;
      const stem = file.replace(/\.[^.]+$/, "");
      images[stem] = `/notice/${file}`; // public/ 정적 서빙 경로
    }
    return NextResponse.json({ images });
  } catch {
    // notice 디렉토리 없음 등 → 빈 매핑
    return NextResponse.json({ images: {} });
  }
}
