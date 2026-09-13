import { describe, it, expect } from "vitest";
import { captureLogoSize, resolveLogoSrc, CAPTURE_PIXEL_RATIO } from "../finance/logo-source";

describe("captureLogoSize", () => {
  it("표시 px에 캡처 배율(1)의 절반을 곱한다 — route가 retina로 ×2 하므로 최종 표시px×1", () => {
    expect(captureLogoSize(28)).toBe(14); // 리스트 아이콘: 14 요청 → retina 28px PNG = 28×1
    expect(captureLogoSize(44)).toBe(22);
    expect(captureLogoSize(92)).toBe(46); // 46 → 92px PNG = 92×1
  });

  it("CAPTURE_PIXEL_RATIO는 1(captureImage pixelRatio와 일치)", () => {
    expect(CAPTURE_PIXEL_RATIO).toBe(1);
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
    expect(src).toContain("size=46");
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
