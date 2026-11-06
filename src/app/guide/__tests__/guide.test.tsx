import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { APP_CONFIG, OG_IMAGE, WEB_APPLICATION_JSON_LD } from "@/config/app";
import { RATIO_PREVIEW_UPLOAD_NOTICE, SECURITY_COPY } from "@/config/security-copy";
import sitemap from "@/app/sitemap";
import { allowedUtmQuery } from "@/lib/analytics/utm-allow";
import { featureTitleOf, screenPath, trackScreen, trackThenNavigate, __resetGaStateForTest } from "@/lib/analytics/ga";

vi.mock("@/components/logo", () => ({ Logo: () => null })); // next/font 의존 제거(node 환경)

import { GUIDES, GUIDE_SLUGS, GUIDE_BRAND_LINE } from "../guide-copy";
import { GuideShell, guideMetadata } from "../guide-shell";

// 가이드(#77) 정적 규칙 — node 환경, 서버 렌더 마크업·문구 상수·메타 대상
const WWW = "https://www.secretasset.xyz";
const FORBIDDEN = /[0-9]\s*(원|만|억|%)|줄이세요|늘리세요|리밸런싱|사세요|파세요|추천|절대|완벽|원천|서버로 아무것도|세금/;

describe("정본 호스트", () => {
  it("siteUrl 기본값은 www로 시작한다", () => {
    expect(APP_CONFIG.siteUrl.startsWith("https://www.")).toBe(true);
  });
  it("PWA 안내 그림 DOMAIN은 리터럴 secretasset.xyz", () => {
    const src = readFileSync(join(__dirname, "../../(main)/_components/pwa/pwa-guide-illustrations.tsx"), "utf8");
    expect(src).toContain('const DOMAIN = "secretasset.xyz";');
  });
});

describe("sitemap", () => {
  const a = sitemap();
  it("4건, 모두 www 접두", () => {
    expect(a.map((e) => e.url)).toEqual([WWW, `${WWW}/ratio`, `${WWW}/guide/stock-ratio`, `${WWW}/guide/net-worth`]);
    expect(a.map((e) => e.priority)).toEqual([1, 0.8, 0.6, 0.6]);
  });
  it("lastModified는 호출마다 같은 고정 날짜", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2030-01-01"));
    const b = sitemap();
    vi.useRealTimers();
    expect(b.map((e) => e.lastModified)).toEqual(a.map((e) => e.lastModified));
    expect(String(a[0].lastModified instanceof Date ? a[0].lastModified.toISOString() : "")).toContain("2026-11-06");
  });
});

describe("metadata", () => {
  it.each(GUIDE_SLUGS)("%s: canonical·og.url·images 재선언", (slug) => {
    const m = guideMetadata(slug);
    const url = `${APP_CONFIG.siteUrl}/guide/${slug}`;
    expect(m.alternates?.canonical).toBe(url);
    expect((m.openGraph as { url: string }).url).toBe(url);
    expect((m.openGraph as { images: unknown[] }).images).toHaveLength(1);
    expect((m.twitter as { images: string[] }).images).toEqual([OG_IMAGE.url]);
    expect(m.title).toBe(`${GUIDES[slug].title} — ${APP_CONFIG.name}`);
  });
  it("page.tsx는 guideMetadata를 export한다", () => {
    for (const slug of GUIDE_SLUGS) {
      const src = readFileSync(join(__dirname, "..", slug, "page.tsx"), "utf8");
      expect(src).toContain(`export const metadata = guideMetadata("${slug}")`);
    }
  });
});

describe("JS 없는 본문", () => {
  it.each(GUIDE_SLUGS)("%s: h1·h2·행동 링크·브랜드 문장이 HTML에 있다", (slug) => {
    const doc = GUIDES[slug];
    const html = renderToStaticMarkup(<GuideShell slug={slug} />);
    expect(html.match(/<h1/g)).toHaveLength(1);
    expect(html.match(/<h2/g)).toHaveLength(doc.steps.length + 1);
    expect(html).toContain('href="/ratio"');
    expect(html).toContain('href="/?trial=1"');
    expect(html).toContain(GUIDE_BRAND_LINE);
    expect(html).toContain(`href="/guide/${doc.other}"`);
    for (const id of ["guide-page", "guide-title", "guide-summary", "guide-steps", "guide-step-1", "guide-fact-box", "guide-cta-primary", "guide-cta-secondary", "guide-other-link", "guide-brand"]) {
      expect(html).toContain(`data-testid="${id}"`);
    }
    expect(html).toContain('aria-label="다른 가이드"');
    expect(html).not.toMatch(/utm_/);
  });
});

describe("문구 규칙", () => {
  const local = SECURITY_COPY.find((c) => c.id === "local")!.desc;
  const text = (slug: (typeof GUIDE_SLUGS)[number]) => {
    const d = GUIDES[slug];
    return [d.title, d.description, d.h1, d.summary, ...d.steps.flatMap((s) => [s.title, s.body, s.inlineLink?.label ?? ""]), ...d.facts, d.primary.label, d.secondary.label].join("\n");
  };
  it.each(GUIDE_SLUGS)("%s: 금지어 0·분량 800~1,500자", (slug) => {
    const d = GUIDES[slug];
    expect(text(slug)).not.toMatch(FORBIDDEN);
    const body = [d.summary, ...d.steps.flatMap((s) => [s.title, s.body]), ...d.facts].join("").length;
    expect(body).toBeGreaterThanOrEqual(800);
    expect(body).toBeLessThanOrEqual(1500);
  });
  it("보안 문장은 security-copy 원문과 일치", () => {
    expect(GUIDES["stock-ratio"].facts).toContain(RATIO_PREVIEW_UPLOAD_NOTICE);
    for (const slug of GUIDE_SLUGS) expect(GUIDES[slug].facts).toContain(local);
    expect(local).toBe("자산 데이터는 동기화를 켜지 않는 한 이 기기의 브라우저에만 저장돼요.");
  });
  it("본문 중간 행동 링크는 편당 최대 1곳", () => {
    for (const slug of GUIDE_SLUGS) expect(GUIDES[slug].steps.filter((s) => s.inlineLink).length).toBeLessThanOrEqual(1);
  });
});

describe("GA·UTM", () => {
  const gtag = vi.fn();
  beforeEach(() => {
    gtag.mockReset();
    (globalThis as unknown as { window: unknown }).window = { gtag, location: { origin: WWW, pathname: "/guide/stock-ratio", search: "?utm_source=threads&utm_campaign=guide_v1" } };
    __resetGaStateForTest();
  });
  afterEach(() => {
    delete (globalThis as unknown as { window?: unknown }).window;
  });

  it("화면 제목 2종", () => {
    expect(featureTitleOf("page_view", {}, "guide:stock-ratio")).toBe("가이드·주식 비중");
    expect(featureTitleOf("page_view", {}, "guide:net-worth")).toBe("가이드·순자산 정리");
    expect(screenPath("guide:net-worth")).toBe("/v/guide/net-worth");
  });
  it("trackScreen: page_title·UTM 귀속", () => {
    trackScreen("guide:stock-ratio");
    const payload = gtag.mock.calls.at(-1)![2];
    expect(payload.page_title).toBe("가이드·주식 비중");
    expect(payload.page_location).toBe(`${WWW}/v/guide/stock-ratio?utm_source=threads&utm_campaign=guide_v1`);
  });
  it("체험 이동: feature_use demo, 가상 경로 /v/guide/<slug>", () => {
    trackScreen("guide:net-worth");
    const nav = vi.fn();
    trackThenNavigate("feature_use", { category: "demo" }, "/?trial=1", nav);
    const [, name, payload] = gtag.mock.calls.at(-1)!;
    expect(name).toBe("feature_use");
    expect(payload.page_title).toBe("체험 모드");
    expect(payload.page_location).toContain("/v/guide/net-worth");
  });
  it("UTM 허용 경로", () => {
    const s = "?utm_source=a&evil=1";
    expect(allowedUtmQuery("/guide/stock-ratio", s)).toBe("?utm_source=a");
    expect(allowedUtmQuery("/guide/net-worth/", s)).toBe("?utm_source=a");
    for (const p of ["/guide", "/guide/", "/guide/a/b", "/", "/guide/A"]) expect(allowedUtmQuery(p, s)).toBe("");
  });
});

describe("JSON-LD", () => {
  it("직렬화 가능한 WebApplication, 가격·금액 없음", () => {
    const o = JSON.parse(JSON.stringify(WEB_APPLICATION_JSON_LD));
    expect(o["@type"]).toBe("WebApplication");
    expect(o.url).toBe(APP_CONFIG.siteUrl);
    expect(o.description).toBe(APP_CONFIG.meta.description);
    expect(o).not.toHaveProperty("offers");
  });
  it("layout head에 ld+json 1개", () => {
    const src = readFileSync(join(__dirname, "../../layout.tsx"), "utf8");
    expect(src.match(/application\/ld\+json/g)).toHaveLength(1);
  });
});
