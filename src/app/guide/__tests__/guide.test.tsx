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
import { decadeCounts } from "../_components/decade-table";
import { YEAR_SETTLE_COPY } from "@/lib/report/year-settlement";
import { CARD_UNTIL_DAY, FIRST_RECORD_MIN_DAYS } from "@/lib/report/settlement";
import { GuideShell, guideMetadata } from "../guide-shell";
import { buildIndexView } from "@/lib/invest/calc";
import { marketHistory } from "@/lib/invest/market-history";

// 가이드(#77) 정적 규칙 — node 환경, 서버 렌더 마크업·문구 상수·메타 대상
const WWW = "https://www.secretasset.xyz";
// 본문이 글 3편(단계·fact 구조)인 가이드. market-history(#263)는 본문이 투자 탭 컴포넌트라 따로 검사한다
const ARTICLE_SLUGS = GUIDE_SLUGS.filter((s) => s !== "market-history" && s !== "index-returns-by-year");
const FORBIDDEN = /[0-9]\s*(원|만|억|%)|줄이세요|늘리세요|리밸런싱|사세요|파세요|추천|절대|완벽|원천|서버로 아무것도|세금|엑셀|시트|노션|절세/;

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
  it("7건, 모두 www 접두(market-history·index-returns-by-year 포함)", () => {
    expect(a.map((e) => e.url)).toEqual([WWW, `${WWW}/ratio`, `${WWW}/guide/stock-ratio`, `${WWW}/guide/net-worth`, `${WWW}/guide/year-end`, `${WWW}/guide/market-history`, `${WWW}/guide/index-returns-by-year`]);
    expect(a.map((e) => e.priority)).toEqual([1, 0.8, 0.6, 0.6, 0.6, 0.6, 0.6]);
  });
  it("lastModified는 호출마다 같은 고정 날짜", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2030-01-01"));
    const b = sitemap();
    vi.useRealTimers();
    expect(b.map((e) => e.lastModified)).toEqual(a.map((e) => e.lastModified));
    expect(String(a[0].lastModified instanceof Date ? a[0].lastModified.toISOString() : "")).toContain("2026-11-21");
    expect(String(a[5].lastModified instanceof Date ? a[5].lastModified.toISOString() : "")).toContain("2026-11-22");
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
  it.each(ARTICLE_SLUGS)("%s: h1·h2·행동 링크·브랜드 문장이 HTML에 있다", (slug) => {
    const doc = GUIDES[slug];
    const html = renderToStaticMarkup(<GuideShell slug={slug} />);
    expect(html.match(/<h1/g)).toHaveLength(1);
    expect(html.match(/<h2/g)).toHaveLength(doc.steps.length + 2);
    expect(html).toContain('href="/ratio"');
    expect(html).toContain('href="/?trial=1"');
    expect(html).toContain(GUIDE_BRAND_LINE);
    const others = GUIDE_SLUGS.filter((x) => x !== slug);
    expect(html.match(/data-testid="guide-other-link-/g)).toHaveLength(GUIDE_SLUGS.length - 1);
    others.forEach((o) => expect(html).toContain(`data-testid="guide-other-link-${o}"`));
    expect(html.indexOf(`guide-other-link-${others[0]}`)).toBeLessThan(html.indexOf(`guide-other-link-${others[1]}`));
    for (const id of ["guide-page", "guide-title", "guide-summary", "guide-steps", "guide-step-1", "guide-fact-box", "guide-cta-primary", "guide-cta-secondary", "guide-other-list", "guide-brand"]) {
      expect(html).toContain(`data-testid="${id}"`);
    }
    expect(html).toContain('aria-labelledby="guide-other-title"');
    expect(html).not.toMatch(/utm_/);
  });
});

describe("market-history 가이드(#263)", () => {
  const doc = GUIDES["market-history"];
  const html = renderToStaticMarkup(<GuideShell slug="market-history" />);
  it("SEO 제목·설명(spec 9절)과 h1 1개, 내 자산 정리 CTA·다른 가이드", () => {
    expect(doc.title).toBe("S&P 500·나스닥100·코스피, 크게 빠진 때와 금리 한 장으로 보기");
    expect(guideMetadata("market-history").title).toBe(`${doc.title} — ${APP_CONFIG.name}`);
    expect(html.match(/<h1/g)).toHaveLength(1);
    expect(html).toContain("내 자산도 정리해 보기");
    expect(html).toContain('data-testid="guide-cta-primary"');
    expect(html).toContain(GUIDE_BRAND_LINE);
    expect(html.match(/data-testid="guide-other-link-/g)).toHaveLength(GUIDE_SLUGS.length - 1);
  });
  it("설명의 숫자(시작 연도·건수)는 투자 데이터에서 파생한 값과 같다", () => {
    const v = buildIndexView(marketHistory, "spx");
    expect(doc.description).toContain(`${v.start + 1}년 이후 S&P 500이 연말 기준 15% 넘게 빠진 ${v.eps.length}번을`);
    expect(doc.description).toBe(`${v.start + 1}년 이후 S&P 500이 연말 기준 15% 넘게 빠진 ${v.eps.length}번을 기준금리, 미국 경기침체, 같은 시기 사건과 한 장에 모았어요. 바닥까지·전고점까지 걸린 기간과 연도별 수익률도 볼 수 있어요.`);
  });
  it("SSR: 머리 3줄·목록 행은 있고 지수 수준값·연도별 표·다운로드·CSV 링크는 없다(AC34)", () => {
    expect(html).toContain("1961년 이후 연말 기준 15% 넘게 빠진 때는 4번이었어요");
    expect(html.match(/data-testid="drop-row"/g)).toHaveLength(4);
    expect(html).not.toContain('data-testid="yearly-table"');
    expect(html).toContain("pattern-conclusion");
    expect(html).toContain("크게 빠지기 전 12개월에 연준 금리가 올라간 때는 자료가 있는 3번 중 1번이었어요.");
    for (const level of ["6,846", "6846", "5,882", "903"]) expect(html).not.toContain(level);
    expect(html).not.toMatch(/\.csv|download|datasets\//i);
  });
  it("기본 지수 S&P 500 고정(내 자산 판정 0): 가이드 소스에 자산 컨텍스트 import 0", () => {
    const src = readFileSync(join(__dirname, "../_components/market-history-article.tsx"), "utf8");
    expect(src).toContain('defaultIndex="spx"');
    expect(src).not.toMatch(/asset-data-context|useAssetData/);
  });
  it("가이드 문구에 금지어(투자 탭 R1~R11) 0", () => {
    const t = [doc.title, doc.description, doc.h1, doc.summary, doc.primary.label, doc.secondary.label, doc.linkLabel].join("\n");
    const tt = t.replace("연도별 수익률", ""); // meta description 1회 허용(CEO R4.1)
    for (const w of ["때문", "덕분", "로 인해", "영향으로", "촉발", "여파", "역전", "신호", "예고", "기회", "타이밍", "유리", "추천", "수익", "로그", "지금 사면", "전조", "조심", "경고", "과열", "붐", "기대", "연착륙", "반등"]) expect(tt).not.toContain(w);
  });
  it("공개 데이터셋 링크는 없고 앱 본문 번들 격리: guide-copy는 투자 데이터를 import하지 않는다", () => {
    const src = readFileSync(join(__dirname, "../guide-copy.ts"), "utf8");
    expect(src).not.toMatch(/from\s+["'][^"']*invest/);
  });
});

describe("index-returns-by-year 가이드(5.138)", () => {
  const doc = GUIDES["index-returns-by-year"];
  const html = renderToStaticMarkup(<GuideShell slug="index-returns-by-year" />);
  const mh = GUIDES["market-history"];
  it("SEO·canonical·h1 1개·고유 표 1개(연대 × 3지수, 오른 해/전체 해)", () => {
    expect(guideMetadata("index-returns-by-year").alternates?.canonical).toBe(`${WWW}/guide/index-returns-by-year`);
    expect(html.match(/<h1/g)).toHaveLength(1);
    expect(html.match(/data-testid="guide-unique-table"/g)).toHaveLength(1);
    expect(html).toContain('<th scope="row"');
    expect(html).toContain("<caption");
    expect(html).toContain("내 자산도 정리해 보기");
  });
  it("표 값: 연대별 오른 해 수가 투자 데이터에서 파생된다(S&P 1961~69, 나스닥 60·70년대 `—`)", () => {
    const rows = decadeCounts();
    const v = buildIndexView(marketHistory, "spx");
    const d60 = rows.find((r) => r.decade === 1960)!.cells[0]!;
    let up = 0; for (let y = 1961; y <= 1969; y++) if ((v.ret[y - v.start] as number) > 0) up++;
    expect(d60).toEqual({ up, n: 9 });
    expect(rows.find((r) => r.decade === 1960)!.cells[1]).toBeNull();
    expect(rows.at(-1)!.cells[0]!.n).toBe(6);
  });
  it("SSR에 지수 수준값 0, 요약·제목이 market-history와 겹치지 않고 금지어 0", () => {
    for (const level of ["6,846", "6846", "5,882"]) expect(html).not.toContain(level);
    expect(doc.summary).not.toBe(mh.summary);
    expect(doc.title).not.toBe(mh.title);
    const sentences = (t: string) => t.split(/[.]/).map((x) => x.trim()).filter((x) => x.length > 8);
    const mhs = new Set(sentences(mh.summary));
    for (const x of sentences(doc.summary)) expect(mhs.has(x), x).toBe(false);
    const t = [doc.summary, doc.primary.label, doc.linkLabel].join("\n");
    for (const w of ["때문", "덕분", "추천", "수익", "과열", "기대", "반등", "신호", "기회"]) expect(t).not.toContain(w);
  });
  it("첫 화면 가이드 링크는 4개 그대로(새 편은 루트 링크 줄에 없다)", () => {
    const src = readFileSync(join(__dirname, "../../(main)/_components/layout/onboarding/root-guide-links.tsx"), "utf8");
    expect(src).toContain('const ORDER: GuideSlug[] = ["year-end", "net-worth", "stock-ratio", "market-history"];');
  });
});

describe("문구 규칙", () => {
  const local = SECURITY_COPY.find((c) => c.id === "local")!.desc;
  const text = (slug: (typeof GUIDE_SLUGS)[number]) => {
    const d = GUIDES[slug];
    return [d.title, d.description, d.h1, d.summary, ...d.steps.flatMap((s) => [s.title, s.body, s.inlineLink?.label ?? ""]), ...d.facts, d.primary.label, d.secondary.label].join("\n");
  };
  it.each(ARTICLE_SLUGS)("%s: 금지어 0·분량 800~1,500자", (slug) => {
    const d = GUIDES[slug];
    expect(text(slug)).not.toMatch(FORBIDDEN);
    const body = [d.summary, ...d.steps.flatMap((s) => [s.title, s.body]), ...d.facts].join("").length;
    expect(body).toBeGreaterThanOrEqual(800);
    expect(body).toBeLessThanOrEqual(1500);
  });
  it("보안 문장은 security-copy 원문과 일치", () => {
    expect(GUIDES["stock-ratio"].facts).toContain(RATIO_PREVIEW_UPLOAD_NOTICE);
    for (const slug of ARTICLE_SLUGS) expect(GUIDES[slug].facts).toContain(local);
    expect(local).toBe("자산 데이터는 동기화를 켜지 않는 한 이 기기의 브라우저에만 저장돼요.");
  });
  it("year-end: 앱 상수와 같은 글자·fact 순서·보안 문장", () => {
    const f = GUIDES["year-end"].facts;
    expect(f).toHaveLength(7);
    expect(f[1]).toContain(YEAR_SETTLE_COPY.periodSub);
    expect(f[2]).toContain(YEAR_SETTLE_COPY.loanHint);
    expect(f[3]).toContain(YEAR_SETTLE_COPY.help);
    expect(f[4]).toContain(`${FIRST_RECORD_MIN_DAYS}일`);
    expect(f[5]).toContain(`1월 ${CARD_UNTIL_DAY}일`);
    expect(f.at(-1)).toBe(local);
    expect(FIRST_RECORD_MIN_DAYS).toBe(7);
    expect(CARD_UNTIL_DAY).toBe(10);
    // 앱 cause label 원문 대조(asset-report 값 import 없이 소스 문자열로)
    const src = readFileSync(join(__dirname, "../../../lib/report/asset-report.ts"), "utf8");
    expect(src).toContain('label: "기록 안 된 변화"');
    expect(f[3]).toContain("'기록 안 된 변화'");
    expect(f[0]).toContain("성과 > 자산 변화");
    expect(src.includes("바로 나눠")).toBe(false);
  });
  it("year-end: 빠져나간 돈은 fact F3에서만, 약속 문장 0, net-worth와 같은 문장 0", () => {
    const d = GUIDES["year-end"];
    expect(text("year-end").split(YEAR_SETTLE_COPY.loan).length - 1).toBe(1);
    expect(d.facts[2]).toContain(YEAR_SETTLE_COPY.loan);
    expect(text("year-end")).not.toMatch(/바로 나눠/);
    const sentences = (slug: (typeof GUIDE_SLUGS)[number]) =>
      text(slug).split(/[.\n]/).map((x) => x.trim()).filter((x) => x.length > 8);
    const nw = new Set(sentences("net-worth"));
    for (const x of sentences("year-end")) if (x !== local.replace(/\.$/, "") && x !== GUIDES["net-worth"].title && x !== GUIDES["year-end"].primary.label && x !== GUIDES["year-end"].secondary.label) expect(nw.has(x), x).toBe(false);
    expect(d.steps[1].inlineLink).toEqual({ label: "월말 순자산 정리하는 법", href: "/guide/net-worth" });
  });
  it("linkLabel 4종·GUIDE_SLUGS 순서", () => {
    expect(GUIDE_SLUGS).toEqual(["stock-ratio", "net-worth", "year-end", "market-history", "index-returns-by-year"]);
    expect(GUIDES["index-returns-by-year"].linkLabel).toBe("해마다 오르내린 %, 한 격자로 보기");
    expect(GUIDES["market-history"].linkLabel).toBe("크게 빠진 때와 금리, 한 장으로 보기");
    expect(GUIDES["year-end"].linkLabel).toBe("올해 자산 결산");
    expect(GUIDES["net-worth"].linkLabel).toBe("월말 순자산 정리");
    expect(GUIDES["stock-ratio"].linkLabel).toBe("주식 비중 한 번에 보기");
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
  it("year-end 화면 제목·guide_open 제목", () => {
    expect(featureTitleOf("page_view", {}, "guide:year-end")).toBe("가이드·올해 결산");
    expect(screenPath("guide:year-end")).toBe("/v/guide/year-end");
    expect(featureTitleOf("feature_use", { category: "guide_open" }, "home")).toBe("웰컴·가이드 열기");
  });
  it("체험 이동: feature_use demo(4.88 title 가이드·체험), 가상 경로 /v/guide/<slug>", () => {
    trackScreen("guide:net-worth");
    const nav = vi.fn();
    trackThenNavigate("feature_use", { category: "demo" }, "/?trial=1", nav);
    const [, name, payload] = gtag.mock.calls.at(-1)!;
    expect(name).toBe("feature_use");
    expect(payload.page_title).toBe("가이드·체험");
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
