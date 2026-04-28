import { NextResponse } from "next/server";
import { getCacheStorage } from "@/lib/cache-storage";

const LOGO_DEV_TICKER_TOKEN = "pk_I3rhtineRSqYNMtDKQM1zw";
const LOGO_DEV_DOMAIN_TOKEN = "pk_DmcvYxOTTfuXuZ2Nuf3sJA";
const TICKER_RE = /^[A-Z0-9]{1,10}$/i;
const DOMAIN_RE = /^[a-z0-9][a-z0-9\-\.]{1,98}[a-z0-9]$/i;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const ticker = searchParams.get("ticker");
  const domain = searchParams.get("domain");

  // ── 도메인 모드 ──
  if (domain) {
    if (!DOMAIN_RE.test(domain)) {
      return NextResponse.json({ error: "잘못된 domain" }, { status: 400 });
    }
    const cacheKey = `domain:${domain.toLowerCase()}`;
    const upstreamUrl = `https://img.logo.dev/${domain}?token=${LOGO_DEV_DOMAIN_TOKEN}`;

    const storage = getCacheStorage();
    const cached = await storage.getTickerLogo(cacheKey);
    if (cached) {
      const buf = Buffer.from(cached.data, "base64");
      return new Response(buf, {
        headers: {
          "Content-Type": cached.contentType,
          "Cache-Control": "public, max-age=31536000",
          "X-Cache": "HIT",
        },
      });
    }

    try {
      const upstream = await fetch(upstreamUrl, { signal: AbortSignal.timeout(5000) });
      if (!upstream.ok) {
        return NextResponse.redirect(upstreamUrl, 302);
      }
      const contentType = upstream.headers.get("content-type") ?? "image/png";
      const buf = Buffer.from(await upstream.arrayBuffer());
      const base64 = buf.toString("base64");
      await storage.setTickerLogo(cacheKey, base64, contentType);
      return new Response(buf, {
        headers: {
          "Content-Type": contentType,
          "Cache-Control": "public, max-age=31536000",
          "X-Cache": "MISS",
        },
      });
    } catch {
      return NextResponse.redirect(upstreamUrl, 302);
    }
  }

  // ── 티커 모드 ──
  if (!ticker) {
    return NextResponse.json({ error: "ticker 또는 domain 필요" }, { status: 400 });
  }
  if (!TICKER_RE.test(ticker)) {
    return NextResponse.json({ error: "잘못된 ticker" }, { status: 400 });
  }

  const t = ticker.toUpperCase();
  const upstreamUrl = `https://img.logo.dev/ticker/${t}?token=${LOGO_DEV_TICKER_TOKEN}`;
  const cacheKey = t;

  const storage = getCacheStorage();
  const cached = await storage.getTickerLogo(cacheKey);
  if (cached) {
    const buf = Buffer.from(cached.data, "base64");
    return new Response(buf, {
      headers: {
        "Content-Type": cached.contentType,
        "Cache-Control": "public, max-age=31536000",
        "X-Cache": "HIT",
      },
    });
  }

  try {
    const upstream = await fetch(upstreamUrl, { signal: AbortSignal.timeout(5000) });
    if (!upstream.ok) {
      return NextResponse.redirect(upstreamUrl, 302);
    }
    const contentType = upstream.headers.get("content-type") ?? "image/png";
    const buf = Buffer.from(await upstream.arrayBuffer());
    const base64 = buf.toString("base64");
    await storage.setTickerLogo(cacheKey, base64, contentType);
    return new Response(buf, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000",
        "X-Cache": "MISS",
      },
    });
  } catch {
    return NextResponse.redirect(upstreamUrl, 302);
  }
}
