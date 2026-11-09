import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// #125 하단 네비 5칸·인증카드 상단 통일(v2) 정적 단언
const read = (p: string) => readFileSync(join(process.cwd(), "src", p), "utf8");

describe("하단 네비 5칸 (#125)", () => {
  const nav = read("app/(main)/_components/pwa/bottom-nav.tsx");
  it("순서: 홈·상세·업데이트·성과·더보기, 인증카드 칸 없음", () => {
    const ids = [...nav.matchAll(/\{ id: "(\w+)", label:/g)].map((m) => m[1]);
    expect(ids).toEqual(["home", "detail", "update", "activity", "more"]);
    expect(nav).not.toContain("ShareScreenshotDialog");
    expect(nav).not.toContain("IdCard");
  });
  it("균등 grid (5칸, 체험 3칸) + aria-current", () => {
    expect(nav).toContain('"grid-cols-3" : "grid-cols-5"');
    expect(nav).toContain('aria-current={isActive ? "page" : undefined}');
  });
});

describe("인증카드 상단 통일 (#125 v2)", () => {
  const top = read("app/(main)/_components/header-menu/top-bar.tsx");
  const hub = read("app/(main)/_components/layout/ui/hub-share-button.tsx");
  const css = read("app/globals.css");
  const count = (src: string, needle: string) => src.split(needle).length - 1;

  it("대화상자 렌더·리스너는 top-bar 1곳뿐", () => {
    const files = [
      "app/(main)/_components/header-menu/top-bar.tsx",
      "app/(main)/_components/header-menu/tool-menu.tsx",
      "app/(main)/_components/pwa/bottom-nav.tsx",
      "app/(main)/_components/layout/ui/hub-share-button.tsx",
      "app/(main)/_components/views/detail/detail-hub.tsx",
      "app/(main)/_components/views/activity/performance-hub.tsx",
    ];
    expect(files.map((f) => count(read(f), "<ShareScreenshotDialog"))).toEqual([1, 0, 0, 0, 0, 0]);
    expect(files.map((f) => count(read(f), 'addEventListener("trigger-open-share-card"'))).toEqual([1, 0, 0, 0, 0, 0]);
  });
  it("허브 버튼은 발송 전용, data-tutorial 없음", () => {
    expect(hub).toContain('dispatchOpenShareCard(undefined, "top_bar")');
    expect(hub).not.toContain("ShareScreenshotDialog");
    expect(hub).not.toContain("addEventListener");
    expect(hub).not.toContain("data-tutorial");
    expect(hub).toContain("pwa-only-action");
    expect(hub).toContain("hasAnyAssets");
  });
  it("리스너 출처는 detail.source ?? home_tip, 버튼 클릭은 방문 기록", () => {
    expect(top).toContain('source: detail?.source ?? "home_tip"');
    expect(top).toMatch(/recordVisit\("share-card"\);\s*track\("feature_use", \{ category: "share_card", method: "open", source: "top_bar" \}\)/);
  });
  it("인증카드 버튼은 pwa-hide-actions 밖, 설치·더보기·선택기는 안", () => {
    expect(top).toMatch(/<div className="contents pwa-hide-actions">\s*\{showInstall && <PwaInstallButton \/>\}/);
    expect(top).toMatch(/\{showShare && <ShareScreenshotButton \/>\}\s*<div className="contents pwa-hide-actions">\s*\{showMore/);
    expect(top).toMatch(/pwa-hide-actions">\s*<InlineSelector/);
  });
  it("홈 전용 PWA 헤더 CSS, 브라우저용 클래스 무변경", () => {
    expect(css).toContain("header.pwa-home-header");
    expect(css).toContain("calc(2.5rem + env(safe-area-inset-top, 0px))");
    expect(css).toContain("pwa-only-action");
    expect(top).toContain('"flex h-12 sm:h-14 shrink-0 items-center gap-2 transition-[width,height] ease-linear');
  });
  it("더보기·app-features는 main과 동일(인증카드 행 없음)", () => {
    expect(read("app/(main)/_components/header-menu/tool-menu.tsx")).not.toContain("IdCard");
    expect(read("config/app-features.ts")).toContain("상단의 인증카드 버튼");
  });
});
