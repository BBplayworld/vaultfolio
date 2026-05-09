import { NextResponse } from "next/server";
import { list } from "@vercel/blob";

export async function GET() {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json({ urls: [] });
  }

  try {
    const { blobs } = await list({ prefix: "notice/", token: process.env.BLOB_READ_WRITE_TOKEN });
    const urls = blobs
      .filter((b) => !b.pathname.endsWith("/"))
      .sort((a, b) => a.pathname.localeCompare(b.pathname))
      .map((b) => b.url);
    return NextResponse.json({ urls });
  } catch {
    return NextResponse.json({ urls: [] });
  }
}
