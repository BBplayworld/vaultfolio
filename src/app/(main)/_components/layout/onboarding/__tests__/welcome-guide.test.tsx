// #48 첫 화면 "가치 먼저" 재배열 — node 환경(jsdom 없음): 정적 마크업·순수 매핑·grep만 검사.
// 런타임 호출 횟수(welcome_view 1회, 토글 0회 등)는 qa Playwright(gtag 스텁 계수)가 판정한다.
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

import {
  WelcomeGuide,
  WelcomeAssetCta,
  WelcomeInstallCta,
  WelcomeInAppCta,
  welcomeSource,
  welcomeCtaState,
  WELCOME_CTA_METHODS,
} from "../welcome-guide";
import { labelOf, PARAM_VALUES } from "@/lib/analytics/ga";
import { SECURITY_COPY } from "@/config/security-copy";

const SRC = readFileSync(path.resolve(__dirname, "../welcome-guide.tsx"), "utf8");

describe("GA 매핑(위치 이동 후에도 값·라벨 동일)", () => {
  it.each([
    [true, false, "PWA 앱"],
    [true, true, "PWA 앱"],
    [false, true, "인앱 브라우저"],
    [false, false, "웹"],
  ])("welcome_view source: standalone=%s inApp=%s → %s", (standalone, inApp, label) => {
    expect(labelOf("source", welcomeSource(standalone, inApp))).toBe(label);
  });

  it("CTA 버튼별 onboarding_action 라벨", () => {
    expect(labelOf("method", WELCOME_CTA_METHODS.skipInstall)).toBe("설치 없이 시작");
    expect(labelOf("method", WELCOME_CTA_METHODS.wizard)).toBe("마법사");
    expect(labelOf("method", WELCOME_CTA_METHODS.manual)).toBe("직접 입력");
    expect(labelOf("method", WELCOME_CTA_METHODS.import)).toBe("백업 가져오기");
    expect(labelOf("method", WELCOME_CTA_METHODS.syncConnect)).toBe("동기화 연결");
  });

  it("PARAM_VALUES 고정(키·값 diff 0)", () => {
    expect(PARAM_VALUES).toMatchSnapshot();
  });
});

describe("CTA 슬롯 상태", () => {
  const base = { mounted: true, isMobile: false, isStandalone: false, skipInstall: false, isInApp: false };
  it("마운트 전은 환경과 무관하게 pending(SSR·첫 렌더 동일)", () => {
    expect(welcomeCtaState({ ...base, mounted: false, isMobile: true })).toBe("pending");
  });
  it("모바일 웹 미설치 → install, 바로 시작 후 → asset", () => {
    expect(welcomeCtaState({ ...base, isMobile: true })).toBe("install");
    expect(welcomeCtaState({ ...base, isMobile: true, skipInstall: true })).toBe("asset");
  });
  it("데스크톱·PWA standalone → asset (바로 시작 버튼 없음)", () => {
    expect(welcomeCtaState(base)).toBe("asset");
    expect(welcomeCtaState({ ...base, isMobile: true, isStandalone: true })).toBe("asset");
  });
  it("인앱(#60): install·asset보다 우선, 바로 시작 후에도 inapp, standalone이면 아님, 마운트 전은 pending", () => {
    expect(welcomeCtaState({ ...base, isInApp: true })).toBe("inapp");
    expect(welcomeCtaState({ ...base, isInApp: true, isMobile: true })).toBe("inapp");
    expect(welcomeCtaState({ ...base, isInApp: true, isMobile: true, skipInstall: true })).toBe("inapp");
    expect(welcomeCtaState({ ...base, isInApp: true, isMobile: true, isStandalone: true })).toBe("asset");
    expect(welcomeCtaState({ ...base, isInApp: true, mounted: false })).toBe("pending");
  });
});

describe("WelcomeGuide 초기 마크업", () => {
  const html = renderToStaticMarkup(<WelcomeGuide />);
  const pos = (id: string) => html.indexOf(`data-testid="${id}"`);

  it("블록 DOM 순서: 히어로 < 신뢰 < 보안 상세 < 순자산 < CTA 슬롯 < 주식", () => {
    const order = ["welcome-hero", "welcome-trust", "welcome-security-detail", "welcome-preview-net", "welcome-cta-slot", "welcome-preview-stock"].map(pos);
    order.forEach((p) => expect(p).toBeGreaterThanOrEqual(0));
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it("마운트 전 CTA 슬롯은 빈 pending 셸, 설치 박스 없음", () => {
    expect(html).toContain('data-state="pending"');
    expect(html).not.toContain("welcome-install-box");
    expect(html).not.toContain("웹앱 설치하기");
  });

  it("보안 상세는 기본 접힘(항상 마운트·inert·invisible·0fr), 토글 aria-expanded=false", () => {
    const detail = html.match(/<div[^>]*data-testid="welcome-security-detail"[^>]*>/)?.[0] ?? "";
    expect(detail).toContain("inert");
    expect(detail).toContain("invisible");
    expect(detail).toContain("grid-rows-[0fr]");
    expect(html).toMatch(/data-testid="welcome-security-toggle"[^>]*aria-expanded="false"/);
    expect(html).toContain("자세히 보기");
    // 접힘 상세 바깥 가시 텍스트에 기술 용어 없음
    const visible = html.slice(0, pos("welcome-security-detail")) + html.slice(pos("welcome-preview-net"));
    for (const word of ["PBKDF2", "Ed25519", "blob"]) expect(visible).not.toContain(word);
    // 상세 안에는 SECURITY_COPY 3카드(앱가이드와 같은 상수, #61)
    for (const c of SECURITY_COPY) {
      expect(html).toContain(c.title);
      expect(html).toContain(c.desc);
    }
  });

  it("삭제 항목 없음 + '로그인 없' 1회(C1)", () => {
    expect(html).not.toContain("시작하기<");
    expect(html).not.toContain("설치 없이 웹에서 바로 시작");
    expect(html).not.toContain("로그인 없이, 서버 저장 없이");
    expect(html.match(/로그인 없/g)?.length).toBe(1);
    expect(html).toContain("흩어진 자산을 한 화면에서 정리해 보세요.");
  });
});

describe("CTA 슬롯 콘텐츠", () => {
  it("asset(데스크톱·PWA): 바로 시작 없음, 자산 등록 2버튼, outline 버튼 없음", () => {
    const html = renderToStaticMarkup(<WelcomeAssetCta standalone={false} />);
    expect(html).not.toContain("웹에서 바로 시작");
    expect(html).toContain('data-testid="welcome-cta-wizard"');
    expect(html).toContain('data-testid="welcome-cta-more"');
    expect(html).toContain("첫 번째 자산을 추가해보세요");
    expect(html).not.toContain("dark:border-input");
  });
  it("asset standalone 문구", () => {
    expect(renderToStaticMarkup(<WelcomeAssetCta standalone />)).toContain("자산을 등록해보세요");
  });
  it("install(모바일 웹): 웹에서 바로 시작 보조 버튼 + 캡션", () => {
    const html = renderToStaticMarkup(<WelcomeInstallCta onSkipInstall={() => {}} />);
    expect(html).toContain('data-testid="welcome-skip-install-btn"');
    expect(html).toContain("웹에서 바로 시작");
    expect(html).toContain("설치하면 홈 화면에서 바로 열립니다.");
  });
});

describe("CTA 슬롯 inapp(#60)", () => {
  const html = renderToStaticMarkup(<WelcomeInAppCta isIOS />);
  it("등록·설치 진입점 없음, 외부 이동 버튼 1개", () => {
    for (const id of ["welcome-cta-wizard", "welcome-cta-more", "welcome-install-btn", "welcome-skip-install-btn"]) {
      expect(html).not.toContain(`data-testid="${id}"`);
    }
    expect(html).not.toContain('type="file"');
    expect(html.match(/data-testid="welcome-cta-inapp"/g)?.length).toBe(1);
    expect(html.match(/<button/g)?.length).toBe(1);
    expect(html).toContain("외부 브라우저에서 시작하기");
    expect(html).toContain("이 화면에서는 입력한 내용이 사라질 수 있어요.");
    expect(html).toContain('<span class="whitespace-nowrap">Chrome·Safari에서</span>');
  });
  it("iOS 가이드: 항상 마운트·기본 닫힘(inert·0fr), 캡션 1회, 앱 설치 문장·기존 앰버 제목 없음", () => {
    const guide = html.match(/<div[^>]*data-testid="welcome-inapp-guide"[^>]*>/)?.[0] ?? "";
    expect(guide).toContain("inert");
    expect(guide).toContain("grid-rows-[0fr]");
    expect(html).toMatch(/data-testid="welcome-cta-inapp"[^>]*aria-expanded="false"/);
    expect(html.match(/주소가 복사됐어요\. 브라우저에 붙여넣어 주세요\./g)?.length).toBe(1);
    expect(html).not.toContain("앱 설치 기능");
    expect(html).not.toContain("현재 웹페이지 주소가 복사되었습니다!");
    expect(html).toContain("이동한 브라우저에서 주소로 접속하면 이어집니다.");
    // 가이드 래퍼 break-keep(상속) + 간격은 펼침 영역 안(pt-5), 가이드는 space-y 밖 형제(ui-review R1·R2)
    expect(html).toContain('class="pt-5 text-left break-keep"');
    expect(html).toMatch(/^<div class="motion-safe:animate-in[^"]*"><div class="space-y-5">/);
  });
  it("Android: aria-expanded 없음", () => {
    expect(renderToStaticMarkup(<WelcomeInAppCta isIOS={false} />)).not.toContain("aria-expanded");
  });
});

describe("코드 불변 조건(grep)", () => {
  it("저장 경로 미접촉(C16) — 보안 카드 원문의 'localStorage' 단어는 문구라 코드 사용만 검사", () => {
    expect(SRC).not.toMatch(/\blocalStorage\s*[.[]/);
    for (const w of ["STORAGE_KEYS", "saveAssetData", "setAssetData", "notifyAssetUserEdit", "applyImportedPayload"]) {
      expect(SRC).not.toContain(w);
    }
  });
  it('track("welcome_view" 1곳, 마운트 effect([]) 안', () => {
    expect(SRC.match(/track\("welcome_view"/g)?.length).toBe(1);
    expect(SRC).toMatch(/useEffect\(\(\) => \{\s*setMounted\(true\);[\s\S]{0,120}track\("welcome_view"[^\n]*\n\s*\}, \[\]\);/);
  });
  it("토글 클릭 핸들러에 track 없음", () => {
    const toggle = SRC.slice(SRC.indexOf('data-testid="welcome-security-toggle"'), SRC.indexOf('id="welcome-security-detail"'));
    expect(toggle).not.toContain("track(");
  });
});
