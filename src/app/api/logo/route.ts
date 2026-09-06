import { NextResponse } from "next/server";
import { getCacheStorage } from "@/lib/cache-storage";

/**
 * 기업 로고 프록시 (logo.dev)
 *
 * - 티커 모드 `/ticker/{T}`, 도메인 모드 `/{domain}`.
 * - **응답은 항상 same-origin 바이트**. 과거 티커 실패 시 img.logo.dev로 302 리다이렉트했는데,
 *   인증카드 캡처(html-to-image)가 `<img>`를 fetch→dataURL로 인라인할 때 크로스오리진이라
 *   CORS로 실패해 저장 PNG에서 로고가 통째로 누락됐다. 실패는 404로 끝내고 클라가 폴백한다.
 *
 * **Brandfetch(cdn.brandfetch.io)는 쓰지 않는다** — Logo Link 가이드라인이 서버 측
 * fetch·프록시·캐싱을 명시적으로 금지하고(`x-bf-error: automated_traffic`으로 302 차단),
 * 브라우저 `<img>` 직접 hotlink만 허용한다. 우리는 캡처를 위해 same-origin 바이트가
 * 반드시 필요하므로(위 참조) 구조적으로 호환되지 않는다. 유효한 client ID가 있어도 동일.
 *
 * logo.dev 옵션(실측 확인): `format=png`(기본 JPEG는 투명 불가 — 조각 위 투명 로고에 필수),
 * `size`·`retina=true`(캡처 pixelRatio 3 대응), `theme=light|dark`(배경 밝기별 변형),
 * `fallback=404`(미존재 시 logo.dev 기본 모노그램 대신 404 → 우리 티커 텍스트 폴백 사용).
 */
const LOGO_DEV_TICKER_TOKEN = "pk_I3rhtineRSqYNMtDKQM1zw";
const LOGO_DEV_DOMAIN_TOKEN = "pk_DmcvYxOTTfuXuZ2Nuf3sJA";

const TICKER_RE = /^[A-Z0-9]{1,10}$/i;
const DOMAIN_RE = /^[a-z0-9][a-z0-9\-.]{1,98}[a-z0-9]$/i;
const THEMES = ["light", "dark"] as const;
type LogoTheme = (typeof THEMES)[number];
const DEFAULT_SIZE = 256;
const MAX_SIZE = 512;

const CACHE_HEADERS = { "Cache-Control": "public, max-age=31536000" } as const;

/** logo.dev 공통 옵션 — 투명 PNG + 고해상도 + 테마 변형 + 미존재 시 404 */
function logoDevQuery(token: string, size: number, theme: LogoTheme | null): string {
  const q = new URLSearchParams({
    token,
    format: "png", // 기본 JPEG는 투명 배경 불가
    size: String(size),
    retina: "true",
    fallback: "404", // 기본 모노그램 대신 404 → 호출부의 티커 텍스트 폴백
  });
  if (theme) q.set("theme", theme);
  return q.toString();
}

/** 제공자 목록을 순서대로 시도해 첫 성공 이미지를 반환. 실패는 조용히 다음으로 넘어간다. */
async function fetchFirstImage(urls: (string | null)[]): Promise<{ buf: Buffer<ArrayBuffer>; contentType: string } | null> {
  for (const url of urls) {
    if (!url) continue;
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(5000), redirect: "follow" });
      if (!res.ok) continue;
      const contentType = res.headers.get("content-type") ?? "image/png";
      if (!contentType.startsWith("image/")) continue; // 에러 HTML 등 방어
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.byteLength === 0) continue;
      return { buf, contentType };
    } catch {
      // 다음 제공자로
    }
  }
  return null;
}

function imageResponse(buf: Buffer<ArrayBuffer>, contentType: string, cacheState: "HIT" | "MISS") {
  return new Response(buf, {
    headers: { "Content-Type": contentType, ...CACHE_HEADERS, "X-Cache": cacheState },
  });
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const ticker = searchParams.get("ticker");
  const domain = searchParams.get("domain");

  const rawTheme = searchParams.get("theme");
  const theme: LogoTheme | null = THEMES.includes(rawTheme as LogoTheme) ? (rawTheme as LogoTheme) : null;
  const parsedSize = Number(searchParams.get("size"));
  const size = Number.isFinite(parsedSize) && parsedSize > 0 ? Math.min(parsedSize, MAX_SIZE) : DEFAULT_SIZE;

  // 캐시 키에 옵션을 포함해야 size/theme 별 결과가 서로 덮어쓰지 않는다.
  const mode = domain ? "d" : "t";
  const rawKey = (domain ?? ticker ?? "").toLowerCase();
  const cacheKey = `v2:${mode}:${rawKey}:${size}:${theme ?? "auto"}`;

  let upstreams: (string | null)[];

  if (domain) {
    if (!DOMAIN_RE.test(domain)) {
      return NextResponse.json({ error: "잘못된 domain" }, { status: 400 });
    }
    upstreams = [`https://img.logo.dev/${domain}?${logoDevQuery(LOGO_DEV_DOMAIN_TOKEN, size, theme)}`];
  } else {
    if (!ticker) {
      return NextResponse.json({ error: "ticker 또는 domain 필요" }, { status: 400 });
    }
    if (!TICKER_RE.test(ticker)) {
      return NextResponse.json({ error: "잘못된 ticker" }, { status: 400 });
    }
    upstreams = [
      `https://img.logo.dev/ticker/${ticker.toUpperCase()}?${logoDevQuery(LOGO_DEV_TICKER_TOKEN, size, theme)}`,
    ];
  }

  const storage = getCacheStorage();
  const cached = await storage.getTickerLogo(cacheKey);
  if (cached) {
    return imageResponse(Buffer.from(cached.data, "base64"), cached.contentType, "HIT");
  }

  const found = await fetchFirstImage(upstreams);
  if (!found) {
    return NextResponse.json({ error: "logo not found" }, { status: 404 });
  }

  await storage.setTickerLogo(cacheKey, found.buf.toString("base64"), found.contentType);
  return imageResponse(found.buf, found.contentType, "MISS");
}
