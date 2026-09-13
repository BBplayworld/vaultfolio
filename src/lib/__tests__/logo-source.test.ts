import { describe, it, expect } from "vitest";
import { captureLogoSize, resolveLogoSrc, CAPTURE_PIXEL_RATIO } from "../finance/logo-source";

describe("captureLogoSize", () => {
  it("표시 px에 캡처 배율(3)의 절반을 곱한다 — route가 retina로 ×2 하므로 최종 표시px×3", () => {
    expect(captureLogoSize(28)).toBe(42); // 리스트 아이콘: 42 요청 → retina 84px PNG = 28×3
    expect(captureLogoSize(44)).toBe(66); // 최소 조각 칩
    expect(captureLogoSize(92)).toBe(138); // 최대 조각 칩: 138 → 276px PNG = 92×3
  });

  it("CAPTURE_PIXEL_RATIO는 3(captureImage pixelRatio와 일치)", () => {
    expect(CAPTURE_PIXEL_RATIO).toBe(3);
  });

  it("과거 과대 요청(size*6, 최대 512)보다 훨씬 작다", () => {
    expect(captureLogoSize(92)).toBeLessThan(Math.min(512, 92 * 6));
  });
});

describe("resolveLogoSrc", () => {
  it("해외 티커(A-Z) → ?ticker=, size 옵션이 쿼리에 실린다", () => {
    const src = resolveLogoSrc("NVDA", "NVIDIA", true, { size: captureLogoSize(92) });
    expect(src).toContain("/api/logo?");
    expect(src).toContain("ticker=NVDA");
    expect(src).toContain("size=138");
  });

  it("국내 ETF 브랜드 → ?domain= (운용사 도메인)", () => {
    const src = resolveLogoSrc("", "TIGER 미국S&P500", false);
    expect(src).toContain("domain=");
  });

  it("해외인데 티커가 A-Z가 아니면 null", () => {
    expect(resolveLogoSrc("", "이름없음", true)).toBeNull();
  });

  it("국내인데 도메인 매핑이 없으면 null", () => {
    expect(resolveLogoSrc("999999", "존재하지않는종목", false)).toBeNull();
  });

  it("size 옵션 미전달 시 쿼리에 size 없음(주식 탭 실사용 경로)", () => {
    const src = resolveLogoSrc("AAPL", "Apple", true);
    expect(src).toContain("ticker=AAPL");
    expect(src).not.toContain("size=");
  });
});
