// #249 복귀 등록 칸 상태 — node 환경: 정적 마크업·순수 매핑·grep. 팝오버 열림·포커스·마법사 단계는 qa Playwright.
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

import { WelcomeAssetCta, WELCOME_PICK_COPY, WELCOME_MANUAL_ROWS, wizardStartOf } from "../welcome-guide";
import { useOnboardingWizardStore } from "@/stores/onboarding-wizard-store";

const read = (rel: string) => readFileSync(path.resolve(__dirname, "../../../../../../..", rel), "utf8");
const BUTTON_TAG = { "welcome-cta-wizard": /<button[^>]*data-testid="welcome-cta-wizard"[^>]*>/, "welcome-cta-more": /<button[^>]*data-testid="welcome-cta-more"[^>]*>/ };
const variantOf = (html: string, testid: keyof typeof BUTTON_TAG) => {
  const tag = html.match(BUTTON_TAG[testid])?.[0] ?? "";
  return /\bbg-brand\b/.test(tag) ? "brand" : /\bbg-secondary\b/.test(tag) ? "secondary" : "?";
};

describe("복귀 등록 칸 6상태(spec 4절, AC-6)", () => {
  it("제목·설명 낱말 = 팝오버 행 라벨, 조사 확정", () => {
    expect(WELCOME_PICK_COPY).toEqual({
      stock: { title: "주식부터 추가해보세요", desc: "방금 본 화면이 내 주식으로 채워져요." },
      crypto: { title: "암호화폐부터 추가해보세요", desc: "방금 본 화면이 내 암호화폐로 채워져요." },
      cash: { title: "현금성 자산부터 추가해보세요", desc: "방금 본 화면이 내 현금성 자산으로 채워져요." },
      loan: { title: "대출부터 추가해보세요", desc: "방금 본 화면이 내 대출로 채워져요." },
      "real-estate": { title: "부동산부터 추가해보세요", desc: "부동산은 직접 입력으로 넣어요." },
    });
    for (const row of WELCOME_MANUAL_ROWS) expect(WELCOME_PICK_COPY[row.type].title.startsWith(`${row.label}부터`)).toBe(true);
  });
  it.each(["stock", "crypto", "cash", "loan"] as const)("%s: 스크린샷 brand·직접 입력 secondary, 버튼 2개·문구·testid 그대로", (pick) => {
    const html = renderToStaticMarkup(<WelcomeAssetCta standalone={false} focusOnMount pick={pick} />);
    expect(html).toContain(WELCOME_PICK_COPY[pick].title);
    expect(html).toContain(WELCOME_PICK_COPY[pick].desc);
    expect(html.match(/<button/g)?.length).toBe(2);
    expect(variantOf(html, "welcome-cta-wizard")).toBe("brand");
    expect(variantOf(html, "welcome-cta-more")).toBe("secondary");
    expect(html).toContain("스크린샷으로 자산 등록");
    expect(html).toContain("직접 입력 · 가져오기");
  });
  it("부동산: 두 버튼 variant만 맞바꿈(직접 입력 brand, 스크린샷 secondary)", () => {
    const html = renderToStaticMarkup(<WelcomeAssetCta standalone={false} focusOnMount pick="real-estate" />);
    expect(variantOf(html, "welcome-cta-wizard")).toBe("secondary");
    expect(variantOf(html, "welcome-cta-more")).toBe("brand");
    expect(html.indexOf("welcome-cta-wizard")).toBeLessThan(html.indexOf("welcome-cta-more"));
  });
  it("값 없음: 현행 마크업과 같다(pick=null ≡ prop 없음)", () => {
    expect(renderToStaticMarkup(<WelcomeAssetCta standalone={false} focusOnMount pick={null} />)).toBe(
      renderToStaticMarkup(<WelcomeAssetCta standalone={false} focusOnMount />),
    );
  });
  it("설치 앱도 자산군 제목이 우선", () => {
    expect(renderToStaticMarkup(<WelcomeAssetCta standalone pick="cash" />)).toContain("현금성 자산부터 추가해보세요");
  });
  it("새 문장에 수·금액·권유 낱말 0(AC-15)", () => {
    for (const { title, desc } of Object.values(WELCOME_PICK_COPY)) {
      expect(`${title} ${desc}`).not.toMatch(/\d|원|수익|추천|매수|매도|투자/);
    }
  });
});

describe("마법사 시작 단계(spec 4절 조건 3, AC-16·17)", () => {
  it("자산군 → 시작 단계: 마법사 4종만, 부동산·없음은 현행", () => {
    expect(wizardStartOf("stock")).toBe("stock");
    expect(wizardStartOf("crypto")).toBe("crypto");
    expect(wizardStartOf("cash")).toBe("cash");
    expect(wizardStartOf("loan")).toBe("loan");
    expect(wizardStartOf("real-estate")).toBeUndefined();
    expect(wizardStartOf(null)).toBeUndefined();
  });
  it("store: open(시작) 메모리만, close에서 초기화", () => {
    const st = useOnboardingWizardStore.getState();
    st.open("cash");
    expect(useOnboardingWizardStore.getState()).toMatchObject({ isOpen: true, startCategory: "cash" });
    st.close();
    expect(useOnboardingWizardStore.getState()).toMatchObject({ isOpen: false, startCategory: null });
    st.open();
    expect(useOnboardingWizardStore.getState().startCategory).toBeNull();
    st.close();
  });
  it("여는 순간 wizard_step 0건: 전송은 인트로 시작·단계 done/skipped·exit·complete 5곳뿐, 초기 phase에 track 없음", () => {
    const src = read("src/app/(main)/_components/layout/onboarding/onboarding-wizard/onboarding-wizard-flow.tsx");
    expect(src.match(/track\("wizard_step"/g)?.length).toBe(5);
    expect(src).toContain('onStart={() => { track("wizard_step", { step: "start" });');
    expect(src).toMatch(/useState<Phase>\(\(\) => resolveWizardStart\(readOnboardingWizardStatus\(\), startCategory\)\);/);
  });
});

describe("짚는 표시·포커스(spec 4절, AC-21) — 소스 고정", () => {
  const src = read("src/app/(main)/_components/layout/onboarding/welcome-guide.tsx");
  it("짚는 행 = data-picked + aria-current + bg-accent 면 + 굵은 라벨, 링 클래스 추가 0", () => {
    expect(src).toContain('{...(picked ? { "data-picked": "", "aria-current": true } : {})}');
    expect(src).toContain("className={picked ? `${ROW_CLASS} bg-accent` : ROW_CLASS}");
    expect(src).toContain('<span className={picked ? "font-semibold" : "font-medium"}>{label}</span>');
  });
  it("팝오버 첫 포커스는 자산군 있을 때만 해당 행으로(없으면 현행 Radix 기본)", () => {
    expect(src).toContain("{...(pick ? { onOpenAutoFocus: (e: Event) => { e.preventDefault(); pickedRowRef.current?.focus(); } } : {})}");
  });
  it("복귀 포커스: 부동산은 직접 입력, 그 밖은 스크린샷", () => {
    expect(src).toContain("if (focusOnMount) (manualFirst ? moreRef : wizardRef).current?.focus();");
  });
});

describe("체험 아닌 방문·보유자 홈(AC-9, AC-12) — 정적 검사", () => {
  it("page.tsx: 체험 표시는 isTrialMode() 조건 1곳, FAB 가드 문자열 그대로", () => {
    const src = read("src/app/(main)/page.tsx");
    expect(src).toContain("{isTrialMode() && <TrialBanner viewKey={viewToKey(view)} />}");
    expect(src).toContain("{!isTrialMode() && <FloatingAddButton />}");
  });
  it("세금 sticky 오프셋은 표시가 있을 때만 값이 생기는 변수(비체험 0 = 현행 자리)", () => {
    const css = read("src/app/globals.css");
    expect(css).toMatch(/html:has\(\[data-trial-bar\]\) \{\s*--trial-bar-h: calc\(var\(--trial-bar-top, 0px\) \+ 56px\);/);
    expect(css.match(/--trial-bar-h:/g)?.length).toBe(1);
    expect(read("src/app/(main)/_components/views/tax/tax-calendar-view.tsx")).toContain("sticky top-[var(--trial-bar-h,0px)] z-10");
    expect(read("src/app/(main)/_components/views/tax/tax-year-end-simulator.tsx")).toContain("sticky top-[calc(7rem+var(--trial-bar-h,0px))] z-10");
  });
});
