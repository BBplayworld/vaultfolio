// #4.66 브랜드 락업(logo-spec 확정 심볼 + SVG 워드마크, 대표 R6 자간·S 크기) 정적 단언
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { BrandSymbol } from "../brand-symbol";
import { BrandLockup } from "../brand-lockup";

const css = () => readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");

describe("BrandSymbol", () => {
  it("R8 Leckerli One S 외곽선 path 1개(bs-hi·bs-lo 분기 제거), clipPath·stroke·그라데이션 없음, 출처 주석", () => {
    const html = renderToStaticMarkup(<BrandSymbol />);
    expect(html.match(/<path /g)).toHaveLength(1);
    expect(html).not.toContain("bs-hi");
    expect(html).not.toContain("bs-lo");
    expect(html).not.toContain("clipPath");
    expect(html).not.toContain("stroke");
    expect(html).not.toContain("Gradient");
    expect(html).toContain('viewBox="0 0 32 32"');
    expect(html.split("fill:var(--brand-logo)").length - 1).toBe(1);
    const src = readFileSync(join(process.cwd(), "src/components/brand-symbol.tsx"), "utf8");
    expect(src).toContain("Leckerli One");
    expect(src).toContain("SIL OFL");
    expect(src).not.toMatch(/\.(otf|ttf|woff2?)["']/);
    expect(css()).not.toMatch(/\.bs-(hi|lo)/);
  });
  it("S 잉크 경계 = viewBox x 7.13~24.87 · y 2.6~29.4(높이 26.8, 가로·세로 중앙)", () => {
    const src = readFileSync(join(process.cwd(), "src/components/brand-symbol.tsx"), "utf8");
    const d = src.match(/S_PATH =\s*"([^"]+)"/)![1];
    const nums = d.match(/-?[\d.]+/g)!.map(Number);
    const xs = nums.filter((_, i) => i % 2 === 0);
    const ys = nums.filter((_, i) => i % 2 === 1);
    // 2차 곡선 제어점 포함 경계라 잉크 경계보다 같거나 넓다 — 끝점·극값이 경계에 닿는지 확인
    expect(Math.min(...xs)).toBeCloseTo(7.13, 1);
    expect(Math.max(...xs)).toBeCloseTo(24.87, 1);
    expect(Math.min(...ys)).toBeCloseTo(2.6, 1);
    expect(Math.max(...ys)).toBeCloseTo(29.4, 1);
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
  it("R8 S 크기: 심볼 박스 18.21px(Leckerli S 잉크 높이 15.25)·lg 21.01px(15/13배), 음수 여백 = 박스 × 7.1311/32 + 광학 보정 0.4(lg 0.46)", () => {
    const c = css();
    const m = c.match(/\.pwa-home-symbol\s*\{\s*width:\s*([\d.]+)px;\s*height:\s*([\d.]+)px;\s*margin-left:\s*(-[\d.]+)px;/g)!;
    expect(m).toHaveLength(2);
    const [base, lg] = m.map((r) => r.match(/-?[\d.]+(?=px)/g)!.map(Number));
    expect(base).toEqual([18.21, 18.21, -4.46]);
    expect(lg).toEqual([21.01, 21.01, -5.14]);
    expect(base[0] * (26.8 / 32)).toBeCloseTo(15.25, 1);
    expect(base[0] * (26.8 / 32)).toBeGreaterThanOrEqual(14.5);
    expect(base[0] * (26.8 / 32)).toBeLessThanOrEqual(16);
    expect(lg[0] * (26.8 / 32)).toBeCloseTo(15.25 * 15 / 13, 1);
    expect(base[2]).toBeCloseTo((-base[0] * 7.1311) / 32 - 0.4, 2);
    expect(lg[2]).toBeCloseTo((-lg[0] * 7.1311) / 32 - 0.46, 2);
  });
  it("R8 간격 규칙: 워드마크 margin-left = S 잉크 높이 × 0.3124 − 심볼 박스 우측 여백(0.7px, lg 0.81px)", () => {
    const html = renderToStaticMarkup(<BrandLockup />);
    expect(html).toContain("ml-[0.7px]");
    expect(html).toContain("lg:ml-[0.81px]");
    [[18.21, 0.7], [21.01, 0.81]].forEach(([box, ml]) => {
      const gap = 0.3124 * (26.8 / 32) * box;
      expect(ml).toBeCloseTo(gap - (box * (32 - 24.8689)) / 32, 1);
    });
  });
});
