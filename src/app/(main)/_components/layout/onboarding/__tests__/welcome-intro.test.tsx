// #113 루트 첫 화면 사전 조각 — 웰컴과 같은 공용 조각을 쓰는지·head 키 가드. node 환경(jsdom 없음).
import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("@/hooks/use-asset-import", () => ({
  useAssetImport: () => ({ fileInputRef: { current: null }, isImporting: false, openFilePicker: () => {}, handleFileChange: () => {} }),
}));
vi.mock("@/lib/cloud-sync/cloud-sync-provider", () => ({
  useCloudSync: () => ({ setShowConnectDialog: () => {}, syncLink: null }),
}));
vi.mock("@/hooks/use-share-artifacts", () => ({
  useShareArtifacts: () => ({ generateShareArtifacts: async () => null, hasAssets: false }),
}));

import { WelcomeGuide } from "../welcome-guide";
import { RootFirstPaint, WelcomeHero, WelcomeTrustLine, ENTER, shouldSkipHeroEnter } from "../welcome-intro";
import { STORAGE_KEYS, LEGACY_KEYS } from "@/lib/local-storage";

const text = (html: string) => html.replace(/<[^>]+>/g, "");

describe("루트 사전 조각 ↔ WelcomeGuide 공용 조각", () => {
  const shell = renderToStaticMarkup(<RootFirstPaint />);
  const guide = renderToStaticMarkup(<WelcomeGuide skipHeroEnter />);

  it("히어로·신뢰 줄 마크업이 WelcomeGuide(skipHeroEnter)와 바이트 단위로 같다", () => {
    expect(guide).toContain(renderToStaticMarkup(<WelcomeHero enter={false} />));
    expect(guide).toContain(renderToStaticMarkup(<WelcomeTrustLine />));
    expect(shell).toContain(renderToStaticMarkup(<WelcomeHero enter={false} />));
    expect(shell).toContain(renderToStaticMarkup(<WelcomeTrustLine />));
  });
  it("조각 textContent = h1·부제·신뢰 줄만(보안 펼침·CTA·미리보기 없음)", () => {
    expect(text(shell)).toBe(
      "나만의 비밀 자산 금고흩어진 자산을 한 화면에서 정리해 보세요.로그인 없음·자산은 내 기기에 저장·원하면 암호화 동기화",
    );
    expect(shell).not.toContain("welcome-cta-slot");
    expect(shell).not.toContain("welcome-security-toggle");
  });
  it("h1 1개, 첫 조각에는 진입 애니메이션·숨김 속성 없음", () => {
    expect(shell.match(/<h1/g)?.length).toBe(1);
    expect(shell).not.toContain("animate-in");
    // 아이콘(svg)의 aria-hidden만 허용 — 텍스트 숨김 클래스·sr-only 없음(수집기/사람 동일 텍스트)
    expect(shell).not.toContain("sr-only");
    expect(shell).not.toMatch(/class="[^"]*\bhidden\b/);
    expect(shell).toContain("data-first-paint");
    expect(shell).toContain('data-testid="first-paint-shell"');
  });
  it("skipHeroEnter이면 히어로·신뢰 래퍼에 ENTER 없음, 기본은 ENTER 유지(웰컴 재진입 회귀)", () => {
    const withEnter = renderToStaticMarkup(<WelcomeGuide />);
    const heroTag = (h: string) => h.slice(h.indexOf('data-testid="welcome-hero"'), h.indexOf("</section>"));
    const trustTag = (h: string) => h.slice(h.indexOf('data-testid="welcome-trust"'), h.indexOf("<p", h.indexOf('data-testid="welcome-trust"')));
    expect(heroTag(guide)).not.toContain("animate-in");
    expect(trustTag(guide)).not.toContain("animate-in");
    expect(heroTag(withEnter)).toContain("animate-in");
    expect(trustTag(withEnter)).toContain("animate-in");
    expect(ENTER).toContain("animate-in");
  });
});

describe("shouldSkipHeroEnter(O1) — 조각이 실제로 보인 경우만 ENTER 생략", () => {
  it("로드 전 + 속성 없음 → true", () => {
    expect(shouldSkipHeroEnter({ isDataLoaded: false, hasAssetsAttr: false })).toBe(true);
  });
  it("속성 있음(키만 남은 0건 기기, 조각 숨김) → false(ENTER 유지)", () => {
    expect(shouldSkipHeroEnter({ isDataLoaded: false, hasAssetsAttr: true })).toBe(false);
  });
  it("이미 로드된 상태로 mount → false", () => {
    expect(shouldSkipHeroEnter({ isDataLoaded: true, hasAssetsAttr: false })).toBe(false);
  });
});

describe("layout.tsx head 스크립트 키 가드(#113 K2)", () => {
  const LAYOUT = readFileSync(path.resolve(__dirname, "../../../../../layout.tsx"), "utf8");
  it("자산 키 3개가 local-storage.ts 값과 같다", () => {
    for (const k of [STORAGE_KEYS.assetData, STORAGE_KEYS.physicalAssets, LEGACY_KEYS.assetData]) {
      expect(LAYOUT).toContain(`'${k}'`);
    }
  });
  it("<script> 태그 수 불변(기존 data-device 블록 안에서 판정)·값은 읽지 않고 존재만 본다", () => {
    expect(LAYOUT.match(/<script\b/g)?.length).toBe(6);
    expect(LAYOUT).toContain("getItem(hk[i]) !== null");
    expect(LAYOUT).not.toMatch(/getItem\(hk\[i\]\)\s*[.[)]/);
  });
});
