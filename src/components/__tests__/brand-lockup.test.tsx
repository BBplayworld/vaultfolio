// #4.66 브랜드 락업(logo-spec 확정 심볼 + SVG 워드마크, 대표 R6 자간·S 크기) 정적 단언
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { BrandSymbol } from "../brand-symbol";
import { BrandLockup } from "../brand-lockup";

const css = () => readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");

describe("BrandSymbol", () => {
  it("외곽선 면 path 2개(bs-hi·bs-lo)만, clipPath·stroke·그라데이션 없음", () => {
    const html = renderToStaticMarkup(<BrandSymbol />);
    expect(html.match(/<path /g)).toHaveLength(2);
    expect(html).toContain('class="bs-hi"');
    expect(html).toContain('class="bs-lo"');
    expect(html).not.toContain("clipPath");
    expect(html).not.toContain("stroke");
    expect(html).not.toContain("Gradient");
    expect(html).toContain('viewBox="0 0 32 32"');
    expect(html.split("fill:var(--brand-logo)").length - 1).toBe(2);
  });
  it("저해상도(1x)에서만 bs-lo로 교체하는 CSS 규칙이 있다", () => {
    const c = css();
    expect(c).toMatch(/\.bs-lo\s*\{\s*display:\s*none;/);
    expect(c).toMatch(/@media \(max-resolution: 1\.49dppx\)\s*\{\s*\.bs-hi\s*\{\s*display:\s*none;/);
  });
  it("로고 단일 색 토큰 --brand-logo: 라이트 #111111 / 다크 #F2F3F6 각 1회, 구 토큰 제거", () => {
    const c = css();
    const defs = [...c.matchAll(/--brand-logo:\s*(#[0-9a-fA-F]{6});/g)].map((m) => m[1].toLowerCase());
    expect(defs).toEqual(["#111111", "#f2f3f6"]);
    expect(c).not.toContain("--brand-symbol");
    expect(c).not.toContain("--brand-wordmark");
  });
});

describe("BrandLockup", () => {
  it("워드마크는 SVG path(currentColor)·서비스명 접근성 이름, 폰트 파일 미참조, 심볼과 같은 색 토큰", () => {
    const html = renderToStaticMarkup(<BrandLockup />);
    expect(html).toContain('aria-label="시크릿에셋"');
    expect(html).toContain('fill="currentColor"');
    expect(html).toContain("pwa-home-wordmark");
    expect(html).toContain("pwa-home-symbol");
    expect(html).toContain("text-[color:var(--brand-logo)]");
    const src = readFileSync(join(process.cwd(), "src/components/brand-wordmark.tsx"), "utf8");
    expect(src).toContain("SIL OFL");
    expect(src).not.toMatch(/\.(otf|ttf|woff2?)["']/);
  });
  it("R6 자간 +110: 워드마크 잉크 폭 9224(= logo-spec +50의 8984 + 글자 사이 4곳 × 60 units)", () => {
    const html = renderToStaticMarkup(<BrandLockup />);
    expect(html).toContain('viewBox="25 -1641 9224 1833"');
  });
  it("R6 S 축소: 심볼 박스 19.58px(S 잉크 16.4)·lg 22.6px, 음수 여백 = 박스 × 6.1058/32", () => {
    const c = css();
    const m = c.match(/\.pwa-home-symbol\s*\{\s*width:\s*([\d.]+)px;\s*height:\s*([\d.]+)px;\s*margin-left:\s*(-[\d.]+)px;/g)!;
    expect(m).toHaveLength(2);
    const [base, lg] = m.map((r) => r.match(/-?[\d.]+(?=px)/g)!.map(Number));
    expect(base).toEqual([19.58, 19.58, -3.74]);
    expect(lg).toEqual([22.6, 22.6, -4.31]);
    expect(base[0] * (26.8 / 32)).toBeCloseTo(16.4, 1);
    expect(lg[0] * (26.8 / 32)).toBeCloseTo(18.92, 1);
    [base, lg].forEach(([w, , ml]) => expect(ml).toBeCloseTo((-w * 6.1058) / 32, 2));
  });
});
