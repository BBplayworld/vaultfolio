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
    // 페이드(바깥 span, 300ms 지연)와 회전(안쪽 svg)은 다른 노드(ui-review R1)
    expect(html).toMatch(/<span aria-hidden="true" class="motion-safe:animate-in motion-safe:fade-in" style="animation-delay:300ms;animation-fill-mode:backwards"><svg[^>]*class="[^"]*motion-safe:animate-spin/);
    expect(html).not.toMatch(/<svg[^>]*animate-in/);
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

describe("TrialBanner — 전 화면 공통 상단 표시(#249)", () => {
  const html = renderToStaticMarkup(<TrialBanner />);
  it("문구·testid·brand 버튼 1개·스크린샷 숨김·상단 sticky", () => {
    expect(html).toContain('data-testid="trial-banner"');
    expect(html).toContain("data-screenshot-hide");
    expect(html).toContain("data-trial-bar");
    expect(html).toMatch(/data-testid="trial-tag"[^>]*>예시 자산</);
    expect(html).toMatch(/data-testid="trial-note"[^>]*>저장되지 않아요</);
    expect(html).not.toContain("예시 데이터로 둘러보는 중이에요");
    expect(html).toContain("내 자산으로 시작");
    expect(html.match(/data-testid="trial-start-btn"/g)?.length).toBe(1);
    expect(html.match(/<button/g)?.length).toBe(1);
    expect(html).toMatch(/<button[^>]*class="[^"]*\bbg-brand\b/);
    // 가림 면 = 하단 탭과 같은 토큰, z = Z_LAYER.raised(20), 버튼 h-9 + 누름 48px(after -inset-y-1.5)
    expect(html).toMatch(/data-testid="trial-banner"[^>]*class="[^"]*\bsticky\b[^"]*\bz-20\b[^"]*bg-background\/95[^"]*backdrop-blur-md/);
    expect(html).toContain("after:-inset-y-1.5");
    expect(html).toContain("h-9");
  });
  it("일반 웹(인앱 아님): iOS 가이드 영역 없음", () => {
    expect(html).not.toContain("trial-inapp-guide");
  });
  it("page.tsx: 체험 중이면 화면 종류와 무관하게 1곳, AssetPageTabs 앞(key 래퍼 밖), 화면 키 전달", () => {
    const src = read("app/(main)/page.tsx");
    const banner = src.indexOf("{isTrialMode() && <TrialBanner viewKey={viewToKey(view)} />}");
    expect(banner).toBeGreaterThan(0);
    expect(banner).toBeLessThan(src.indexOf("<AssetPageTabs />"));
    expect(src.match(/<TrialBanner/g)?.length).toBe(1);
  });
  it("종료: 화면 키 + 표식 기록 후 / 이동(인앱은 기록 전 return), 원본 복구 코드 없음", () => {
    const src = read("app/(main)/_components/views/home/trial-banner.tsx");
    expect(src).toContain("writeTrialExit(sessionStorage, viewKey)");
    expect(src).toContain('window.location.assign("/")');
    expect(src).toMatch(/if \(inApp\) \{[\s\S]*?return;\s*\}\s*try \{ writeTrialExit\(sessionStorage, viewKey\);/);
    expect(src).not.toMatch(/localStorage/);
    expect(src).not.toMatch(/\btrack\(/);
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
  it("진입은 trackThenNavigate로 /?trial=1, 복귀는 별도 effect에서 trial_start 1회 + 포커스 표식", () => {
    const src = read("app/(main)/_components/layout/onboarding/welcome-guide.tsx");
    // 5.122(#234): 칩·인앱 보조 버튼이 같은 진입 훅을 쓴다 — 일반 칩 인자는 { category: "demo" } 그대로
    expect(src).toContain('trackThenNavigate("feature_use", params, TRIAL_ENTRY_URL);');
    expect(src).toContain('chip: { category: "demo" },');
    // #249: 소비는 consumeTrialExit 1곳(두 키 동시 삭제) → trial_start 1건 + 허용 화면이면 꼬리 1건 → 포커스
    expect(src.match(/WELCOME_CTA_METHODS\.trialStart/g)?.length).toBe(2);
    expect(src).toMatch(/consumeTrialExit\(sessionStorage\)[\s\S]{0,200}track\("onboarding_action", \{ method: WELCOME_CTA_METHODS\.trialStart \}\);\s*const target = resolveTrialExit\(exit\.from\);\s*if \(target\.ga\) track\("onboarding_action", \{ method: WELCOME_CTA_METHODS\.trialStart, \.\.\.target\.ga \}\);/);
    // 링크는 마운트 후 + 공유 대기 아님 + 복원 해시 없음일 때만
    expect(src).toContain('action={mounted && allowTrial && !restoreHash ? <WelcomeTrialLink inApp={ctaState === "inapp"} /> : undefined}');
    expect(read("app/(main)/page.tsx")).toContain("<WelcomeGuide allowTrial={!isSharePending} skipHeroEnter={skipHeroEnterRef.current} />");
  });
});
