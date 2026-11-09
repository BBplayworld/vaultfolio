// #4.66 R3 브랜드 락업(C 레이어 S 심볼 + SVG 워드마크) 정적 단언
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { BrandSymbol } from "../brand-symbol";
import { BrandLockup } from "../brand-lockup";

describe("BrandSymbol", () => {
  it("인스턴스마다 clip id가 고유하고 참조가 자기 id를 가리킨다", () => {
    const html = renderToStaticMarkup(
      <>
        <BrandSymbol />
        <BrandSymbol size={26} />
      </>,
    );
    const ids = [...html.matchAll(/ id="([^"]+)"/g)].map((m) => m[1]);
    expect(ids).toHaveLength(4);
    expect(new Set(ids).size).toBe(4);
    ids.forEach((id) => {
      expect(id).toMatch(/^[a-zA-Z0-9_-]+$/);
      expect(html).toContain(`url(#${id})`);
    });
  });
  it("R4 상하 균형: 대각 틈(폭 1.1) 중심선이 척추 교차점(16,15.5)을 지난다", () => {
    const html = renderToStaticMarkup(<BrandSymbol />);
    expect(html).toContain("16 15.5C");
    const [top, bottom] = [...html.matchAll(/<clipPath[^>]*><path d="([^"]+)"/g)].map((m) => m[1].match(/-?\d+(\.\d+)?/g)!.map(Number));
    // 위 클립 M0 0H32V{yR}L0 {yL}Z, 아래 클립 M0 {yL}L32 {yR}V32H0Z → x=16에서 두 경계의 중점 = 교차점
    const midTop = (top[3] + top[5]) / 2;
    const midBottom = (bottom[1] + bottom[3]) / 2;
    expect((midTop + midBottom) / 2).toBeCloseTo(15.5, 5);
    expect(midBottom - midTop).toBeCloseTo(1.1, 5);
  });
  it("R5 흑백: 두 면 모두 단색 CSS 변수(라이트 검정/다크 흰색), 그라데이션 없음", () => {
    const html = renderToStaticMarkup(<BrandSymbol />);
    expect(html.split("stroke:var(--brand-symbol)").length - 1).toBe(2);
    expect(html).not.toContain("Gradient");
    const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");
    const defs = [...css.matchAll(/--brand-symbol:\s*(#[0-9a-fA-F]{6});/g)].map((m) => m[1].toLowerCase());
    expect(defs).toEqual(["#000000", "#ffffff"]);
    expect(css).not.toMatch(/--brand-symbol-(t|b)\d/);
    expect(css.split("--brand-wordmark:").length - 1).toBe(2);
  });
});

describe("BrandLockup", () => {
  it("워드마크는 SVG path(currentColor)·서비스명 접근성 이름, 폰트 파일 미참조", () => {
    const html = renderToStaticMarkup(<BrandLockup />);
    expect(html).toContain('aria-label="시크릿에셋"');
    expect(html).toContain('fill="currentColor"');
    expect(html).toContain("pwa-home-wordmark");
    expect(html).toContain("pwa-home-symbol");
    const src = readFileSync(join(process.cwd(), "src/components/brand-wordmark.tsx"), "utf8");
    expect(src).toContain("SIL OFL");
    expect(src).not.toMatch(/\.(otf|ttf|woff2?)["']/);
  });
  it("R5 자간 0: 워드마크 잉크 폭 8788(= -0.04em 8460 + 글자 사이 4곳 × 82 units)", () => {
    const html = renderToStaticMarkup(<BrandLockup />);
    expect(html).toContain('viewBox="20 -1644 8788 1840"');
  });
});
