// #59 체험 게이트·배너·웰컴 진입 링크 — node 환경: 정적 마크업·grep만. 런타임 흐름은 qa Playwright가 판정한다.
import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";

let search = "";
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(search) }));

import { TrialGate } from "../trial-gate";
import { TrialBanner } from "../../views/home/trial-banner";
import { WelcomeTrialLink } from "../../layout/onboarding/welcome-guide";

const read = (rel: string) => readFileSync(path.resolve(__dirname, "../../../../..", rel), "utf8");

describe("TrialGate — 쿼리 없을 때 main과 동일(완료 기준 5)", () => {
  it.each(["", "?demo=1", "?trial=0", "?trial=true"])("%j: children만 그대로, DOM 추가 0", (q) => {
    search = q;
    expect(renderToStaticMarkup(<TrialGate><p>x</p></TrialGate>)).toBe("<p>x</p>");
    expect(renderToStaticMarkup(<TrialGate />)).toBe("");
  });
  it("?trial=1: children 보류 + 문구 없는 로딩 덮개(sr-only만)", () => {
    search = "?trial=1";
    const html = renderToStaticMarkup(<TrialGate><p>x</p></TrialGate>);
    expect(html).not.toContain("<p>x</p>");
    expect(html).toContain('data-testid="trial-gate-loading"');
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain('<span class="sr-only">불러오는 중</span>');
    expect(html).toContain("animation-delay:300ms");
  });
  it("layout: TrialGate는 PreviewGate 바깥·AssetDataProvider 바깥", () => {
    const src = read("app/(main)/layout.tsx");
    expect(src).toMatch(/<TrialGate>\s*\{isPreviewEnv\(\) \? <PreviewGate>\{tree\}<\/PreviewGate> : tree\}\s*<\/TrialGate>/);
    expect(src.indexOf("<ReactQueryProvider>")).toBeLessThan(src.lastIndexOf("<TrialGate>"));
  });
  it("trial-boot는 게이트에서 동적 import로만", () => {
    expect(read("app/(main)/_components/trial/trial-gate.tsx")).toContain('import("@/lib/trial/trial-boot")');
  });
});

describe("TrialBanner", () => {
  const html = renderToStaticMarkup(<TrialBanner />);
  it("문구·testid·brand 버튼 1개·스크린샷 숨김", () => {
    expect(html).toContain('data-testid="trial-banner"');
    expect(html).toContain("data-screenshot-hide");
    expect(html).toContain("예시 데이터로 둘러보는 중이에요");
    expect(html).toContain("저장되지 않아요");
    expect(html).toContain("내 자산으로 시작");
    expect(html.match(/data-testid="trial-start-btn"/g)?.length).toBe(1);
    expect(html.match(/<button/g)?.length).toBe(1);
    expect(html).toMatch(/<button[^>]*class="[^"]*\bbg-brand\b/);
    expect(html).not.toMatch(/\b(fixed|sticky)\b/);
  });
  it("일반 웹(인앱 아님): iOS 가이드 영역 없음", () => {
    expect(html).not.toContain("trial-inapp-guide");
  });
  it("page.tsx: 홈 뷰 + 체험 중에만, AssetPageTabs 앞", () => {
    const src = read("app/(main)/page.tsx");
    const banner = src.indexOf('{isTrialMode() && view.type === "home" && <TrialBanner />}');
    expect(banner).toBeGreaterThan(0);
    expect(banner).toBeLessThan(src.indexOf("<AssetPageTabs />"));
  });
  it("종료: 표식 기록 후 / 이동, 원본 복구 코드 없음", () => {
    const src = read("app/(main)/_components/views/home/trial-banner.tsx");
    expect(src).toContain("sessionStorage.setItem(TRIAL_EXIT_KEY, \"1\")");
    expect(src).toContain('window.location.assign("/")');
    expect(src).not.toMatch(/localStorage/);
  });
});

describe("웰컴 진입 링크·복귀", () => {
  it("칩 마크업: testid·문구·히트영역(after -inset-1)·nowrap", () => {
    const html = renderToStaticMarkup(<WelcomeTrialLink />);
    expect(html).toContain('data-testid="welcome-trial-link"');
    expect(html).toContain("직접 둘러보기");
    expect(html).toContain("after:-inset-1");
    expect(html).toContain("whitespace-nowrap");
    expect(html).not.toContain('disabled=""');
  });
  it("진입은 trackThenNavigate로 /?trial=1, 복귀는 별도 effect에서 trial_start 1회 + asset 상태", () => {
    const src = read("app/(main)/_components/layout/onboarding/welcome-guide.tsx");
    expect(src).toContain('trackThenNavigate("feature_use", { category: "demo" }, TRIAL_ENTRY_URL);');
    expect(src.match(/WELCOME_CTA_METHODS\.trialStart/g)?.length).toBe(1);
    expect(src).toMatch(/sessionStorage\.removeItem\(TRIAL_EXIT_KEY\);[\s\S]{0,200}track\("onboarding_action", \{ method: WELCOME_CTA_METHODS\.trialStart \}\);\s*setShowAssetCta\(true\);/);
    // 링크는 마운트 후 + 공유 대기 아님 + 복원 해시 없음일 때만
    expect(src).toContain("action={mounted && allowTrial && !restoreHash ? <WelcomeTrialLink /> : undefined}");
    expect(read("app/(main)/page.tsx")).toContain("<WelcomeGuide allowTrial={!isSharePending} />");
  });
});
