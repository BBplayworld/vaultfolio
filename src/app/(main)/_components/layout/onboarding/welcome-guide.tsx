"use client";

import React from "react";
import { ShieldCheck, CloudLightning, EyeOff, ArrowRight, FolderInput, Pencil, ImageUp, Download, Smartphone, ChevronDown, Link2, ExternalLink, Loader2, Building2, TrendingUp, Bitcoin, Wallet, CreditCard } from "lucide-react";
import { useOnboardingWizardStore } from "@/stores/onboarding-wizard-store";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useState, useEffect, useRef } from "react";
import { useAssetImport } from "@/hooks/use-asset-import";
import { usePWAInstall } from "@/hooks/use-pwa-install";
import { useIsMobile } from "@/hooks/use-mobile";
import { ASSET_THEME, MAIN_PALETTE } from "@/config/theme";
import { TreemapItem, NetAssetSummaryBox } from "@/app/(main)/_components/views/home/dashboard";
import { assignColors, getMultiplier } from "@/app/(main)/_components/views/detail/asset-detail-tabs";
import { Stock } from "@/types/asset";
import { PwaInstallFlow } from "../../pwa/pwa-install-flow";
import { InAppExternalGuide } from "../../pwa/in-app-external-guide";
import { hasRestoreHash } from "../../pwa/in-app-browser-gate";
import { useExternalMove } from "@/hooks/use-external-move";
import { ADD_TRIGGER_EVENTS } from "@/app/(main)/_components/layout/navigation/asset-dispatch";
import previewData from "./welcome-preview-data.json";
import { track, trackThenNavigate, type GaParams } from "@/lib/analytics/ga";
import { TRIAL_ENTRY_URL } from "@/lib/trial/trial-mode";
import { consumeTrialExit, resolveTrialExit, type TrialExitAsset } from "@/lib/trial/trial-exit";
import { WIZARD_CATEGORIES, type WizardCategory } from "@/lib/onboarding-wizard-status";
import { detectBrowserEnv, isStandaloneDisplay } from "@/lib/pwa/detect-browser";
import { useCloudSync } from "@/lib/cloud-sync/cloud-sync-provider";
import { SECURITY_COPY, type SecurityCopyId } from "@/config/security-copy";
import { ENTER, WELCOME_ROOT, WELCOME_TRUST_WRAP, WelcomeHero, WelcomeTrustLine } from "./welcome-intro";

// 보안 카드 id → 아이콘(순서 ShieldCheck·CloudLightning·EyeOff 유지)
const SECURITY_ICONS: Record<SecurityCopyId, React.ElementType> = { local: ShieldCheck, sync: CloudLightning, admin: EyeOff };

// ── 예시 데이터 정적 계산 (컴포넌트 외부)
const EXCHANGE_RATES = previewData.exchangeRates as { USD: number; JPY: number };
const PREVIEW_STOCKS = previewData.stocks as unknown as Stock[];

const stockTotal = PREVIEW_STOCKS.reduce(
  (s, st) => s + st.quantity * st.currentPrice * getMultiplier(st.currency, EXCHANGE_RATES),
  0,
);
const financialValue = stockTotal + previewData.cryptoValue + previewData.cashValue;
const totalAsset = previewData.realEstateValue + financialValue;
const netAsset = totalAsset - previewData.loanValue;
const grossTotal = totalAsset + previewData.loanValue;

const PREVIEW_TREEMAP: TreemapItem[] = [
  { key: "realEstate", name: "부동산", value: previewData.realEstateValue, color: MAIN_PALETTE[0], pct: (previewData.realEstateValue / grossTotal) * 100 },
  { key: "financial", name: "금융자산", value: financialValue, color: MAIN_PALETTE[3], pct: (financialValue / grossTotal) * 100 },
  { key: "liability", name: "부채", value: previewData.loanValue, color: MAIN_PALETTE[1], pct: (previewData.loanValue / grossTotal) * 100 },
];

const finBase = [
  { key: "stocks", label: "주식", value: stockTotal },
  { key: "crypto", label: "암호화폐", value: previewData.cryptoValue },
  { key: "cash", label: "현금성", value: previewData.cashValue },
].filter((d) => d.value > 0);
const finColors = assignColors(finBase);
const PREVIEW_FIN_BAR = finBase.map((d, i) => ({ ...d, color: finColors[i] }));

// ── GA 호출 조건 고정용 순수 매핑(#48) — 위치만 바뀌고 값·조건은 기존과 동일
/** welcome_view source 판정: standalone → pwa, 인앱 → inapp, 그 외 → web */
export function welcomeSource(standalone: boolean, inApp: boolean): "pwa" | "inapp" | "web" {
  return standalone ? "pwa" : inApp ? "inapp" : "web";
}

/** 웰컴 CTA 버튼별 onboarding_action method */
export const WELCOME_CTA_METHODS = {
  wizard: "wizard",
  manual: "manual",
  import: "import",
  syncConnect: "sync_connect",
  trialStart: "trial_start",
} as const satisfies Record<string, NonNullable<GaParams["method"]>>;

/** CTA 슬롯 상태 — pending: 마운트 전(SSR 동일) / inapp: 인앱 브라우저(외부 이동 안내, #60) / asset: 자산 등록(모바일 웹 미설치 포함, #167) */
export type WelcomeCtaState = "pending" | "inapp" | "asset";
export function welcomeCtaState(env: { mounted: boolean; isStandalone: boolean; isInApp: boolean }): WelcomeCtaState {
  if (!env.mounted) return "pending";
  if (env.isInApp && !env.isStandalone) return "inapp";
  return "asset";
}

/** 팝오버 직접 입력 5행(#167) — 라벨·아이콘은 FAB ASSET_TYPES와 같은 값(테스트가 grep으로 고정). 순서는 웰컴 문구 순서 */
export const WELCOME_MANUAL_ROWS = [
  { type: "real-estate", label: "부동산", icon: Building2 },
  { type: "stock", label: "주식", icon: TrendingUp },
  { type: "crypto", label: "암호화폐", icon: Bitcoin },
  { type: "cash", label: "현금성 자산", icon: Wallet },
  { type: "loan", label: "대출", icon: CreditCard },
] as const satisfies readonly { type: keyof typeof ADD_TRIGGER_EVENTS; label: string; icon: React.ElementType }[];

/** 직접 입력 행 전송 — onboarding_action(manual) 1회 + 해당 자산군 추가 폼 열기 이벤트(숨김 마운트된 입력 창이 수신). 자산 추가 시작 이벤트는 보내지 않는다 */
export function handleManualAdd(type: (typeof WELCOME_MANUAL_ROWS)[number]["type"]) {
  track("onboarding_action", { method: WELCOME_CTA_METHODS.manual });
  window.dispatchEvent(new CustomEvent(ADD_TRIGGER_EVENTS[type], { detail: { mode: "manual" } }));
}

/** skipHeroEnter: 루트 사전 조각을 거친 첫 mount — 히어로·신뢰 줄은 조각과 같은 자리에 애니메이션 없이 이어진다(#113) */
export function WelcomeGuide({ allowTrial = false, skipHeroEnter = false }: { allowTrial?: boolean; skipHeroEnter?: boolean } = {}) {
  const { isStandalone, isInApp, isIOS } = usePWAInstall();
  const isMobile = useIsMobile();
  const [skipEnter] = useState(skipHeroEnter); // mount 시점 값 고정 — 이후 prop 변화로 ENTER가 재생되지 않게
  const [mounted, setMounted] = useState(false);
  const [focusCta, setFocusCta] = useState(false); // 체험 종료 복귀 시에만 등록 버튼으로 포커스·진입 모션
  const [trialPick, setTrialPick] = useState<TrialExitAsset | null>(null); // 체험에서 보던 자산군(#249) — 이 웰컴이 떠 있는 동안만
  const [securityOpen, setSecurityOpen] = useState(false); // 보안 상세 펼침 — 메모리 상태만(저장 안 함)
  const [restoreHash, setRestoreHash] = useState(false); // #share·#sync 링크 진입이면 체험 링크 숨김(#59)

  useEffect(() => {
    setMounted(true);
    // 활성화 퍼널 1단계(S-4.28)
    track("welcome_view", { source: welcomeSource(isStandaloneDisplay(), detectBrowserEnv().isInApp) });
  }, []);

  // 체험 종료(#59) 복귀: 표식 1회 소비(보던 화면 키와 함께 삭제, #249) → trial_start 전송(+허용 화면이면 꼬리 1건) → 등록 버튼으로 포커스 이동
  useEffect(() => {
    setRestoreHash(hasRestoreHash(window.location.hash));
    let exit: ReturnType<typeof consumeTrialExit>;
    try {
      exit = consumeTrialExit(sessionStorage);
    } catch {
      return;
    }
    if (!exit.returned) return;
    track("onboarding_action", { method: WELCOME_CTA_METHODS.trialStart });
    const target = resolveTrialExit(exit.from);
    if (target.ga) track("onboarding_action", { method: WELCOME_CTA_METHODS.trialStart, ...target.ga });
    setTrialPick(target.asset);
    setFocusCta(true);
  }, []);

  const ctaState = welcomeCtaState({ mounted, isStandalone, isInApp });
  // 설치 박스는 데스크톱·태블릿 미설치만 — 모바일 웹은 첫 저장 뒤 홈 #78 안내가 설치를 맡는다. 인앱은 외부 이동만 안내(설치 버튼 미렌더, #60)
  const showInstallBox = mounted && !isStandalone && !isMobile && ctaState !== "inapp";

  return (
    <div className={WELCOME_ROOT}>

      {/* ① 히어로 */}
      <WelcomeHero enter={!skipEnter} />

      {/* ② 신뢰 한 줄 + 자세히 보기 + 보안 상세(제자리 펼침) — 접힌 상세가 여백을 남기지 않게 gap 없음 */}
      <div
        data-testid="welcome-trust"
        className={skipEnter ? WELCOME_TRUST_WRAP : `${WELCOME_TRUST_WRAP} ${ENTER}`}
        style={skipEnter ? undefined : { animationDelay: "60ms" }}
      >
        <WelcomeTrustLine />
        <button
          type="button"
          data-testid="welcome-security-toggle"
          onClick={() => setSecurityOpen((v) => !v)}
          aria-expanded={securityOpen}
          aria-controls="welcome-security-detail"
          className="mt-1 inline-flex min-h-10 items-center gap-1 px-2 text-sm text-muted-foreground hover:text-foreground motion-safe:active:scale-[0.96] transition-[color,transform]"
        >
          {securityOpen ? "접기" : "자세히 보기"}
          <ChevronDown aria-hidden className={`size-3.5 motion-safe:transition-transform duration-200 ${securityOpen ? "rotate-180" : ""}`} />
        </button>
        {/* 항상 마운트 + grid-rows 0fr↔1fr 높이 전환(재마운트 없음, 전환 중 재탭은 현재 값에서 역전). 닫힘은 inert */}
        <div
          id="welcome-security-detail"
          data-testid="welcome-security-detail"
          role="region"
          aria-label="보안 상세"
          {...(securityOpen ? {} : { inert: true })}
          className={`grid w-full ease-out motion-safe:transition-[grid-template-rows,opacity,visibility] motion-safe:duration-300 ${securityOpen ? "grid-rows-[1fr] opacity-100 visible" : "grid-rows-[0fr] opacity-0 invisible"}`}
        >
          <div className="min-h-0 overflow-hidden">
            {/* 보안 특징 카드 3개 — 앱가이드와 같은 SECURITY_COPY 렌더 */}
            <div className="pt-2 grid grid-cols-1 sm:grid-cols-3 gap-3">
              {SECURITY_COPY.map(({ id, title, desc }) => (
                <FeatureCard key={id} icon={SECURITY_ICONS[id]} title={title} desc={desc} />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ③ 시작 CTA 단일 슬롯(#292 신뢰 줄 바로 아래로)(#33 대체 지점) — 셸 노드는 상태가 바뀌어도 유지, 안쪽 콘텐츠만 교체 */}
      <div
        data-testid="welcome-cta-slot"
        data-state={ctaState}
        className={`rounded-xl bg-card/80 shadow-xs p-4 sm:p-6 min-h-[216px] sm:min-h-[160px] ${ENTER}`}
        style={{ animationDelay: "120ms" }}
      >
        {ctaState === "inapp" && <WelcomeInAppCta isIOS={isIOS} />}
        {ctaState === "asset" && <WelcomeAssetCta standalone={isStandalone} focusOnMount={focusCta} pick={trialPick} />}
      </div>

      {/* ④ 예시 순자산 미리보기 + 안내 문장(한 묶음, #292 — 주식 미리보기는 제거) */}
      <div className={`space-y-2 ${ENTER}`} style={{ animationDelay: "180ms" }}>
        <div data-testid="welcome-preview-net" className="space-y-3">
          <PreviewLabel
            title="포트폴리오 미리보기"
            action={mounted && allowTrial && !restoreHash ? <WelcomeTrialLink inApp={ctaState === "inapp"} /> : undefined}
          />
          <NetAssetSummaryBox
            netAsset={netAsset}
            treemapData={PREVIEW_TREEMAP}
            change={{ deltaNet: previewData.dailyProfit, pct: previewData.dailyProfitRate, isBig: false, negligible: false, label: "전일 대비", estimated: false, sentence: null, causes: [] }}
            screenshotMode={true}
          />
        </div>
        <p className={`text-2xs text-center text-pretty break-keep ${ASSET_THEME.distributionCard.muted}`}>
          실제 자산을 입력하면 이 화면이 내 포트폴리오로 채워집니다.
        </p>
      </div>

      {/* ⑤ PWA 웹앱 설치 유도(데스크톱·태블릿 미설치) — 홈 설치 버튼과 동일한 설치 흐름(PwaInstallFlow) 공용 사용 */}
      {showInstallBox && (
        <div data-testid="welcome-install-box" className="rounded-xl bg-primary/5 p-5 flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex items-center gap-3">
            <Smartphone aria-hidden className="size-5 shrink-0 text-primary" />
            <div>
              <h2 className="text-base font-semibold">웹앱으로 설치하세요</h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                홈 화면에서 바로 실행 · 네이티브 앱처럼 사용
              </p>
            </div>
          </div>
          <div className="sm:ml-auto">
            <InstallButton className="w-full sm:w-auto" />
          </div>
        </div>
      )}
    </div>
  );
}

function PreviewLabel({ title, action }: { title: string; action?: React.ReactNode }) {
  if (!action) {
    return (
      <div className="flex items-center gap-2">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <Badge variant="secondary" className="text-2xs px-2 py-0.5">예시 데이터</Badge>
      </div>
    );
  }
  // 액션이 있으면 제목+배지 묶음은 줄바꿈 허용(320에서 배지만 둘째 줄), 액션은 첫 줄 오른쪽 고정
  return (
    <div className="flex items-start gap-2">
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <Badge variant="secondary" className="text-2xs px-2 py-0.5">예시 데이터</Badge>
      </div>
      {action}
    </div>
  );
}

/** 웰컴 체험 진입 GA 인자(5.122 #234) — 일반·설치 앱 칩은 기존 값 그대로, 인앱 칩은 title '체험 모드·인앱'으로 구분. GA로는 page_title만 나간다 */
export const WELCOME_TRIAL_PARAMS = {
  chip: { category: "demo" },
  inAppChip: { category: "demo", source: "inapp" },
} as const satisfies Record<string, GaParams>;

/** 체험 진입 공통 — 진입 이벤트를 실제 페이지에서 보낸 뒤 /?trial=1로 이동(연타 1회) */
function useTrialEntry(params: GaParams) {
  const [busy, setBusy] = useState(false);
  const firedRef = useRef(false); // 한 태스크 안 동기 다중 click도 1회만(state 반영 전)
  const handleClick = () => {
    if (firedRef.current) return;
    firedRef.current = true;
    setBusy(true);
    trackThenNavigate("feature_use", params, TRIAL_ENTRY_URL);
  };
  return { busy, handleClick };
}

/** 웰컴 ③ "직접 둘러보기" 칩(#59) — 데모로 즉시 둘러보는 유일한 진입점(5.123 대표 지시: 같은 기능은 진입점 1개). inApp이면 GA title만 '체험 모드·인앱'으로 분리(화면 동일) */
export function WelcomeTrialLink({ inApp = false }: { inApp?: boolean } = {}) {
  const { busy, handleClick } = useTrialEntry(inApp ? WELCOME_TRIAL_PARAMS.inAppChip : WELCOME_TRIAL_PARAMS.chip);
  return (
    <button
      type="button"
      data-testid="welcome-trial-link"
      onClick={handleClick}
      disabled={busy}
      aria-busy={busy || undefined}
      className="relative -my-1.5 inline-flex h-8 shrink-0 items-center gap-1 rounded-full bg-brand/15 px-3 text-sm font-semibold text-foreground break-keep whitespace-nowrap hover:bg-brand/25 dark:bg-brand/20 dark:hover:bg-brand/30 motion-safe:transition-[background-color,scale] motion-safe:duration-150 motion-safe:active:not-disabled:scale-[0.96] outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-60 after:absolute after:-inset-1 after:content-['']"
    >
      직접 둘러보기
      {busy ? <Loader2 aria-hidden className="size-3.5 motion-safe:animate-spin" /> : <ArrowRight aria-hidden className="size-3.5 text-brand" />}
    </button>
  );
}

/** 설치 버튼 — 데스크톱 설치 박스 전용 */
function InstallButton({ className = "" }: { className?: string }) {
  return (
    <PwaInstallFlow>
      {({ onClick, loading }) => (
        <Button
          variant="brand"
          size="lg"
          data-testid="welcome-install-btn"
          className={`gap-2 ${className}`}
          onClick={onClick}
          disabled={loading}
        >
          <Download className="size-4" />
          {loading ? "준비 중..." : "웹앱 설치하기"}
        </Button>
      )}
    </PwaInstallFlow>
  );
}

/** CTA 슬롯 inapp 상태(#60): 등록 진입점 없이 외부 브라우저 이동만. iOS는 주소 복사 + 수동 가이드 펼침 */
export function WelcomeInAppCta({ isIOS }: { isIOS: boolean }) {
  const { go, iosFallback } = useExternalMove(isIOS);
  const [busy, setBusy] = useState(false);

  const handleMove = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await go(window.location.origin + "/");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-200">
      {/* 제목 묶음 + 버튼만 space-y — 닫힌 가이드 앞에 아래 여백이 남지 않게 가이드는 형제로 둔다 */}
      <div className="space-y-5">
        <div className="text-center space-y-1">
          <h2 className="text-lg font-semibold text-balance break-keep">
            자산 등록은 <span className="whitespace-nowrap">Chrome·Safari에서</span> 시작해요
          </h2>
          <p className="text-sm text-muted-foreground text-pretty break-keep">이 화면에서는 입력한 내용이 사라질 수 있어요.</p>
        </div>
        <div className="flex justify-center">
          <Button
            variant="brand"
            size="lg"
            data-testid="welcome-cta-inapp"
            className="w-full gap-2 break-keep sm:w-auto"
            onClick={handleMove}
            disabled={busy}
            aria-controls="welcome-inapp-guide"
            {...(isIOS ? { "aria-expanded": iosFallback } : {})}
          >
            {busy ? <Loader2 aria-hidden className="size-4 motion-safe:animate-spin" /> : <ExternalLink aria-hidden className="size-4" />}
            외부 브라우저에서 시작하기
          </Button>
        </div>
      </div>
      {/* iOS 수동 가이드 — 항상 마운트 + grid-rows 0fr↔1fr 높이 전환(재마운트 없음). 닫힘은 inert */}
      <div
        id="welcome-inapp-guide"
        data-testid="welcome-inapp-guide"
        role="region"
        aria-label="외부 브라우저 이동 방법"
        {...(iosFallback ? {} : { inert: true })}
        className={`grid ease-out motion-safe:transition-[grid-template-rows,opacity,visibility] motion-safe:duration-300 ${iosFallback ? "grid-rows-[1fr] opacity-100 visible" : "grid-rows-[0fr] opacity-0 invisible"}`}
      >
        <div className="min-h-0 overflow-hidden">
          {/* 간격(pt-5)은 펼침 영역 안에 — 닫힘 높이 0. break-keep은 상속돼 공용 가이드는 무변경 */}
          <div className="pt-5 text-left break-keep">
            <InAppExternalGuide
              notice={
                <p role="status" data-testid="welcome-inapp-caption" className="text-sm font-semibold break-keep text-pretty">
                  주소가 복사됐어요. 브라우저에 붙여넣어 주세요.
                </p>
              }
              lastStep="이동한 브라우저에서 주소로 접속하면 이어집니다."
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// 팝오버 행 공통 — 히트영역 44px, 동심 radius(rounded-md), scale 전환만(transition-all 금지)
const ROW_CLASS =
  "flex min-h-11 w-full items-center gap-2.5 rounded-md px-3 text-left text-sm text-popover-foreground hover:bg-accent focus-visible:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-inset transition-[background-color,scale] motion-safe:active:scale-[0.98]";

/** 체험 복귀 등록 칸 제목·설명(#249) — 자산군 낱말 = 팝오버 행 라벨, 조사 확정(spec 4절) */
export const WELCOME_PICK_COPY: Record<TrialExitAsset, { title: string; desc: string }> = {
  stock: { title: "주식부터 추가해보세요", desc: "방금 본 화면이 내 주식으로 채워져요." },
  crypto: { title: "암호화폐부터 추가해보세요", desc: "방금 본 화면이 내 암호화폐로 채워져요." },
  cash: { title: "현금성 자산부터 추가해보세요", desc: "방금 본 화면이 내 현금성 자산으로 채워져요." },
  loan: { title: "대출부터 추가해보세요", desc: "방금 본 화면이 내 대출로 채워져요." },
  "real-estate": { title: "부동산부터 추가해보세요", desc: "부동산은 직접 입력으로 넣어요." },
};

/** 체험 복귀 자산군 → 마법사 시작 단계(부동산은 마법사 단계 없음 → 현행 재개 규칙) */
export function wizardStartOf(pick: TrialExitAsset | null | undefined): WizardCategory | undefined {
  return pick && (WIZARD_CATEGORIES as readonly string[]).includes(pick) ? (pick as WizardCategory) : undefined;
}

/**
 * CTA 슬롯 asset 상태: 기존 자산 등록 CTA(스크린샷 등록 + 직접 입력·가져오기 팝오버).
 * pick(#249, 체험 복귀 자산군): 제목·설명·마법사 시작 단계·팝오버 첫 포커스·짚는 표시. 부동산만 두 버튼 variant·포커스 맞바꿈. 없으면 현행 마크업 그대로.
 */
export function WelcomeAssetCta({ standalone, focusOnMount = false, pick = null }: { standalone: boolean; focusOnMount?: boolean; pick?: TrialExitAsset | null }) {
  const [isStockMenuOpen, setIsStockMenuOpen] = useState(false);
  const { fileInputRef, isImporting, openFilePicker, handleFileChange } = useAssetImport();
  const cs = useCloudSync();
  const openWizard = useOnboardingWizardStore((s) => s.open);
  const wizardRef = useRef<HTMLButtonElement>(null);
  const moreRef = useRef<HTMLButtonElement>(null);
  const pickedRowRef = useRef<HTMLButtonElement>(null);
  const pointerOpenRef = useRef(false); // 포인터·터치로 연 팝오버는 짚는 행 첫 포커스에 링 없음(키보드로 열면 focus-visible 링 유지)
  const manualFirst = pick === "real-estate"; // 부동산은 직접 입력이 강조·포커스
  const copy = pick ? WELCOME_PICK_COPY[pick] : null;

  // 체험 종료 복귀 시 자산 등록 버튼으로 포커스 이동(키보드·스크린리더 흐름 유지). 부동산 복귀는 직접 입력 버튼
  useEffect(() => {
    if (focusOnMount) (manualFirst ? moreRef : wizardRef).current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleWizard = () => {
    track("onboarding_action", { method: WELCOME_CTA_METHODS.wizard });
    openWizard(wizardStartOf(pick));
  };

  const handleManualRow = (type: (typeof WELCOME_MANUAL_ROWS)[number]["type"]) => {
    setIsStockMenuOpen(false);
    handleManualAdd(type);
  };

  return (
    <>
    <div className={`space-y-5 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-200 ${focusOnMount ? "motion-safe:slide-in-from-bottom-1" : ""}`}>
      <div className="text-center space-y-1">
        <h2 className="text-lg font-semibold text-balance break-keep">
          {copy ? copy.title : standalone ? "자산을 등록해보세요" : "첫 번째 자산을 추가해보세요"}
        </h2>
        <p className="text-sm text-muted-foreground text-pretty break-keep">
          {copy ? copy.desc : "부동산, 주식, 암호화폐, 현금, 대출까지 — 모든 자산을 한 곳에서 관리하세요."}
        </p>
      </div>
      <div className="flex flex-col sm:flex-row gap-3 justify-center flex-wrap">
        <Button ref={wizardRef} size="lg" variant={manualFirst ? "secondary" : "brand"} data-testid="welcome-cta-wizard" className="gap-2" onClick={handleWizard}>
          <ImageUp className="size-4" />
          스크린샷으로 자산 등록
          <ArrowRight className="size-4" />
        </Button>
        <Popover open={isStockMenuOpen} onOpenChange={setIsStockMenuOpen}>
          <PopoverTrigger asChild>
            <Button
              ref={moreRef}
              size="lg"
              variant={manualFirst ? "brand" : "secondary"}
              data-testid="welcome-cta-more"
              className="gap-2"
              {...(pick ? { onPointerDown: () => { pointerOpenRef.current = true; }, onKeyDown: () => { pointerOpenRef.current = false; } } : {})}
            >
              <Pencil className="size-4" />
              직접 입력 · 가져오기
            </Button>
          </PopoverTrigger>
          <PopoverContent
            align="center"
            collisionPadding={8}
            className="w-60 p-1.5 max-h-[min(var(--radix-popover-content-available-height),26rem)] overflow-y-auto overscroll-contain"
            {...(pick ? { onOpenAutoFocus: (e: Event) => { e.preventDefault(); pickedRowRef.current?.focus(pointerOpenRef.current ? ({ focusVisible: false } as FocusOptions) : undefined); } } : {})}
          >
            <div role="group" aria-labelledby="welcome-manual-label">
              <p id="welcome-manual-label" data-testid="welcome-manual-label" className="px-3 pt-2 pb-1 text-xs font-medium text-muted-foreground">직접 입력</p>
              {WELCOME_MANUAL_ROWS.map(({ type, label, icon: Icon }) => {
                // 짚는 표시(#249): 방금 본 자산군 행 — hover·focus-visible과 같은 bg-accent 면 + 굵은 라벨(링 없음)
                const picked = pick === type;
                return (
                  <button
                    key={type}
                    ref={picked ? pickedRowRef : undefined}
                    type="button"
                    data-testid={`welcome-manual-${type}`}
                    {...(picked ? { "data-picked": "", "aria-current": true } : {})}
                    className={picked ? `${ROW_CLASS} bg-accent` : ROW_CLASS}
                    onClick={() => handleManualRow(type)}
                  >
                    <Icon aria-hidden className={picked ? "size-4 text-foreground shrink-0" : "size-4 text-muted-foreground shrink-0"} />
                    <span className={picked ? "font-semibold" : "font-medium"}>{label}</span>
                  </button>
                );
              })}
            </div>
            <div role="separator" className="mx-3 my-1.5 h-px bg-border/40" />
            <div role="group" aria-label="가져오기">
            <button
              type="button"
              data-testid="welcome-import"
              className={`${ROW_CLASS} py-2 disabled:opacity-50 disabled:cursor-not-allowed`}
              onClick={() => { track("onboarding_action", { method: WELCOME_CTA_METHODS.import }); setIsStockMenuOpen(false); openFilePicker(); }}
              disabled={isImporting}
            >
              <FolderInput className="size-4 text-muted-foreground shrink-0" />
              <div className="text-left">
                <p className="font-medium">{isImporting ? "가져오는 중..." : "기존 데이터 가져오기"}</p>
                <p className="text-xs text-muted-foreground">백업 JSON 파일 복원</p>
              </div>
            </button>
            <button
              type="button"
              data-testid="welcome-sync-connect"
              className={`${ROW_CLASS} py-2`}
              onClick={() => { track("onboarding_action", { method: WELCOME_CTA_METHODS.syncConnect }); setIsStockMenuOpen(false); cs.setShowConnectDialog(true); }}
            >
              <Link2 className="size-4 text-muted-foreground shrink-0" />
              <div className="text-left">
                <p className="font-medium">기존 동기화 자산 연결</p>
                <p className="text-xs text-muted-foreground">다른 기기의 자산 불러오기</p>
              </div>
            </button>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
    {/* 숨은 file input은 space-y 밖 — 마지막 자식이면 버튼 행에 하단 여백이 붙는다 */}
    <input ref={fileInputRef} type="file" accept="application/json" onChange={handleFileChange} className="hidden" />
    </>
  );
}

function FeatureCard({
  icon: Icon,
  title,
  desc,
}: {
  icon: React.ElementType;
  title: string;
  desc: string;
}) {
  return (
    <div className="rounded-xl bg-card/60 shadow-xs p-5 space-y-2.5">
      <div className="flex items-center gap-2">
        <div className="rounded-lg bg-primary/10 p-2 shrink-0">
          <Icon className="size-4 text-primary" />
        </div>
        <h3 className="text-sm font-semibold text-balance break-keep">{title}</h3>
      </div>
      <p className="text-sm text-muted-foreground leading-7 tracking-[0.01em] break-keep text-pretty">{desc}</p>
    </div>
  );
}
