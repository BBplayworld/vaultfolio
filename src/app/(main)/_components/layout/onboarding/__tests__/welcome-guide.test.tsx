// #48 첫 화면 "가치 먼저" 재배열 — node 환경(jsdom 없음): 정적 마크업·순수 매핑·grep만 검사.
// 런타임 호출 횟수(welcome_view 1회, 토글 0회 등)는 qa Playwright(gtag 스텁 계수)가 판정한다.
import { describe, expect, it, vi, afterEach } from "vitest";
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
  WELCOME_MANUAL_ROWS,
  handleManualAdd,
  WelcomeInAppCta,
  welcomeSource,
  welcomeCtaState,
  WELCOME_CTA_METHODS,
} from "../welcome-guide";
import { featureTitleOf } from "@/lib/analytics/ga";
import { SECURITY_COPY } from "@/config/security-copy";

const SRC = readFileSync(path.resolve(__dirname, "../welcome-guide.tsx"), "utf8");

describe("GA 매핑(위치 이동 후에도 값 동일)", () => {
  it.each([
    [true, false, "pwa"],
    [true, true, "pwa"],
    [false, true, "inapp"],
    [false, false, "web"],
  ])("welcome_view source: standalone=%s inApp=%s → %s", (standalone, inApp, code) => {
    expect(welcomeSource(standalone, inApp)).toBe(code);
  });

  it("CTA 버튼별 method 값 고정", () => {
    expect(WELCOME_CTA_METHODS).toMatchObject({
      wizard: "wizard",
      manual: "manual",
      import: "import",
      syncConnect: "sync_connect",
    });
  });

  it("웰컴 이벤트 page_title은 웰컴", () => {
    expect(featureTitleOf("welcome_view", { source: "web" }, "home")).toBe("웰컴");
    expect(featureTitleOf("onboarding_action", { method: WELCOME_CTA_METHODS.wizard }, "home")).toBe("웰컴·스크린샷 등록");
  });
});

describe("CTA 슬롯 상태", () => {
  const base = { mounted: true, isStandalone: false, isInApp: false };
  it("마운트 전은 환경과 무관하게 pending(SSR·첫 렌더 동일, S3)", () => {
    expect(welcomeCtaState({ ...base, mounted: false })).toBe("pending");
    expect(welcomeCtaState({ ...base, mounted: false, isInApp: true })).toBe("pending");
  });
  it("기본 경로(S1·S4): 모바일·데스크톱 구분 없이 미설치 웹도 asset — install 상태 없음(#167)", () => {
    expect(welcomeCtaState(base)).toBe("asset");
  });
  it("PWA standalone(S5) → asset", () => {
    expect(welcomeCtaState({ ...base, isStandalone: true })).toBe("asset");
  });
  it("인앱(S6, #60): asset보다 우선, standalone이면 아님", () => {
    expect(welcomeCtaState({ ...base, isInApp: true })).toBe("inapp");
    expect(welcomeCtaState({ ...base, isInApp: true, isStandalone: true })).toBe("asset");
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

  it("마운트 전 CTA 슬롯은 빈 pending 셸(모바일 216px·sm 160px 고정, 점프 0), 설치 박스 없음", () => {
    expect(html).toContain('data-state="pending"');
    expect(html).toContain("min-h-[216px] sm:min-h-[160px]");
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
  it("기본 경로(모바일 웹 미설치): 설치 버튼·웹에서 바로 시작·캡션 없음, 등록 2버튼 + 팝오버 마크업", () => {
    const html = renderToStaticMarkup(<WelcomeAssetCta standalone={false} />);
    for (const w of ["웹앱 설치하기", "웹에서 바로 시작", "설치하면 홈 화면에서 바로 열립니다.", "welcome-install-btn", "welcome-skip-install-btn"]) {
      expect(html).not.toContain(w);
    }
    expect(html).toContain('data-testid="welcome-cta-wizard"');
  });
});

describe("직접 입력 5행(#167)", () => {
  it("5행 type·라벨 순서 고정(부동산·주식·암호화폐·현금성 자산·대출)", () => {
    expect(WELCOME_MANUAL_ROWS.map((r) => r.type)).toEqual(["real-estate", "stock", "crypto", "cash", "loan"]);
    expect(WELCOME_MANUAL_ROWS.map((r) => r.label)).toEqual(["부동산", "주식", "암호화폐", "현금성 자산", "대출"]);
  });
  it("라벨·아이콘이 FAB ASSET_TYPES와 같은 값(비공개 상수 → 소스 grep)", () => {
    const fab = readFileSync(path.resolve(__dirname, "../../floating/floating-add-button.tsx"), "utf8");
    const icons: Record<string, string> = { "real-estate": "Building2", stock: "TrendingUp", crypto: "Bitcoin", cash: "Wallet", loan: "CreditCard" };
    for (const { type, label } of WELCOME_MANUAL_ROWS) {
      expect(fab).toContain(`type: "${type}" as AssetType, label: "${label}", icon: ${icons[type]},`);
      expect(SRC).toContain(`{ type: "${type}", label: "${label}", icon: ${icons[type]} }`);
    }
  });
  it("행 이벤트명이 숨김 마운트 입력 창의 수신 대상과 1:1(무반응 방지)", () => {
    const main = path.resolve(__dirname, "../../../..");
    const page = readFileSync(path.resolve(main, "page.tsx"), "utf8");
    const inputs: Record<string, [string, string]> = {
      "real-estate": ["RealEstateInput", "real-estate-input"],
      stock: ["StockInput", "stock-input"],
      crypto: ["CryptoInput", "crypto-input"],
      cash: ["CashInput", "cash-input"],
      loan: ["LoanInput", "loan-input"],
    };
    for (const { type } of WELCOME_MANUAL_ROWS) {
      const [comp, file] = inputs[type];
      expect(page, comp).toContain(`<${comp}`);
      const src = readFileSync(path.resolve(main, `_components/forms/asset-update/input/${file}.tsx`), "utf8");
      expect(src, file).toContain(`trigger-add-${type}`);
    }
  });
  it("행 클릭 전송: onboarding_action(manual) 1회 + 이벤트명 ADD_TRIGGER_EVENTS·detail.mode=manual, asset_add_start 없음", () => {
    expect(SRC.match(/asset_add_start/g)).toBeNull();
    expect(SRC).not.toContain("runDirectInput");
    expect(SRC).not.toContain("skip_install");
  });
  it("renderToStaticMarkup: 팝오버는 닫힘이라 행 testid는 마크업에 없음(qa Playwright가 열어서 확인)", () => {
    expect(renderToStaticMarkup(<WelcomeAssetCta standalone={false} />)).not.toContain("welcome-manual-");
  });
});

describe("handleManualAdd 전송", () => {
  afterEach(() => vi.unstubAllGlobals());
  it.each(WELCOME_MANUAL_ROWS.map((r) => r.type))("%s → 자산군 추가 이벤트 1회(detail.mode=manual)", async (type) => {
    const { ADD_TRIGGER_EVENTS } = await import("@/app/(main)/_components/layout/navigation/asset-dispatch");
    const events: CustomEvent[] = [];
    vi.stubGlobal("window", { dispatchEvent: (e: CustomEvent) => (events.push(e), true) });
    vi.stubGlobal("CustomEvent", class { type: string; detail: unknown; constructor(t: string, i?: { detail?: unknown }) { this.type = t; this.detail = i?.detail; } });
    handleManualAdd(type);
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe(ADD_TRIGGER_EVENTS[type]);
    expect(events[0].detail).toEqual({ mode: "manual" });
  });
});

describe("CTA 슬롯 inapp(#60)", () => {
  const html = renderToStaticMarkup(<WelcomeInAppCta isIOS />);
  it("등록·설치 진입점 없음, 외부 이동 버튼 1개", () => {
    for (const id of ["welcome-cta-wizard", "welcome-cta-more", "welcome-install-btn"]) {
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
