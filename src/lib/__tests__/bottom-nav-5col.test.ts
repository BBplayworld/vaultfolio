import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// #125 하단 네비 5칸·인증카드 더보기 도구 행 정적 단언
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

describe("더보기 도구 › 인증카드 행 (#125)", () => {
  const tool = read("app/(main)/_components/header-menu/tool-menu.tsx");
  it("이벤트가 아닌 직접 오픈 + 계측 + 자산 0건 숨김", () => {
    expect(tool).toContain('data-testid="more-row-share-card"');
    expect(tool).not.toContain("dispatchOpenShareCard");
    expect(tool).toContain('source: "more"');
    expect(tool).toContain('recordVisit("share-card")');
    expect(tool).toContain("<ShareScreenshotDialog open={shareCardOpen}");
    expect(tool).toContain('"screenshot-dialog-toggle"');
    expect(tool).toMatch(/\{hasAssets && \(\s*<button[^>]*\n\s*type="button"\s*\n\s*data-testid="more-row-share-card"/);
  });
  it("행 순서: 세금 관리 → 인증카드", () => {
    expect(tool.indexOf("more-row-tax")).toBeLessThan(tool.indexOf("more-row-share-card"));
  });
  it("상단 버튼도 방문 기록", () => {
    const top = read("app/(main)/_components/header-menu/top-bar.tsx");
    expect(top).toMatch(/recordVisit\("share-card"\);\s*track\("feature_use", \{ category: "share_card", method: "open", source: "top_bar" \}\)/);
  });
  it("app-features 인증카드 설명에 위치 표현 없음", () => {
    expect(read("config/app-features.ts")).not.toContain("상단의 인증카드");
  });
});
