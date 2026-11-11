"use client"

import { useEffect, useRef } from "react";
import { WelcomeGuide } from "./_components/layout/onboarding/welcome-guide";
import { RootFirstPaint, WELCOME_PAGE_WRAP, shouldSkipHeroEnter } from "./_components/layout/onboarding/welcome-intro";
import { RealEstateInput } from "./_components/forms/asset-update/input/real-estate-input";
import { StockInput } from "./_components/forms/asset-update/input/stock-input";
import { CryptoInput } from "./_components/forms/asset-update/input/crypto-input";
import { CashInput } from "./_components/forms/asset-update/input/cash-input";
import { LoanInput } from "./_components/forms/asset-update/input/loan-input";
import { TradeInput } from "./_components/forms/trade/trade-input";
import { CopyrightFooter } from "./_components/layout/copyright-footer";
import { FloatingAddButton } from "./_components/layout/floating/floating-add-button";
import { AssetPageTabs } from "./_components/layout/navigation/asset-page-tabs";
import { TrialBanner } from "./_components/views/home/trial-banner";
import { TutorialOverlay } from "./_components/tutorial/tutorial-overlay";
import { useAssetData } from "@/contexts/asset-data-context";
import { hasAnyAssets } from "@/lib/asset/asset-storage";
import { isTrialMode } from "@/lib/trial/trial-mode";
import { useIsMobile } from "@/hooks/use-mobile";
import { usePWAInstall } from "@/hooks/use-pwa-install";
import { useAssetNavigation } from "./_components/layout/navigation/navigation-context";
import { useTutorialStore } from "@/stores/tutorial/tutorial-provider";
import type { TutorialStep } from "@/stores/tutorial/tutorial-store";
import { useOnboardingWizardStore } from "@/stores/onboarding-wizard-store";
import { OnboardingWizardFlow } from "./_components/layout/onboarding/onboarding-wizard/onboarding-wizard-flow";

export default function Page() {
  const { assetData, isDataLoaded, isSharePending } = useAssetData();
  const isMobile = useIsMobile();
  const { isStandalone } = usePWAInstall();
  const { view } = useAssetNavigation();
  const initTutorial = useTutorialStore((s) => s.initTutorial);
  const completeStep = useTutorialStore((s) => s.completeStep);
  const isWizardOpen = useOnboardingWizardStore((s) => s.isOpen);
  const hideFooterInPWA = isStandalone && (view.type === "detail" || view.type === "activity");

  const hasNoAssets = !hasAnyAssets(assetData);
  const isWelcomeGuide = isSharePending || hasNoAssets;

  // 루트 사전 조각을 거친 첫 웰컴 mount만 히어로·신뢰 줄 진입 애니메이션 생략(#113) — 다른 화면이 한 번이라도 렌더되면 해제
  const skipHeroEnterRef = useRef(false);
  const mountedLoadedRef = useRef(isDataLoaded);
  useEffect(() => {
    // 마운트 시점 판정(SSR 안전) — 조각이 실제로 보인 기기(속성 없음)만 true
    skipHeroEnterRef.current = shouldSkipHeroEnter({
      isDataLoaded: mountedLoadedRef.current,
      hasAssetsAttr: document.documentElement.hasAttribute("data-has-assets"),
    });
  }, []);
  const isWelcomeView = isWelcomeGuide && !isWizardOpen;
  useEffect(() => {
    if (isDataLoaded && !isWelcomeView) skipHeroEnterRef.current = false;
  }, [isDataLoaded, isWelcomeView]);

  // 튜토리얼 초기화
  useEffect(() => {
    if (!isDataLoaded) return;
    initTutorial();
  }, [isDataLoaded, initTutorial]);

  // 커스텀 이벤트 리스너 — 각 컴포넌트에서 completeStep 이벤트를 발생시키면 처리
  useEffect(() => {
    const makeHandler = (step: TutorialStep) => () => completeStep(step);
    const h1 = makeHandler(1); // 자산 업데이트(FAB)
    const h3 = makeHandler(3); // 인증카드
    const h4 = makeHandler(4); // 상세 탭
    const h5 = makeHandler(5); // 성과 탭

    window.addEventListener("tutorial-complete-step1", h1);
    window.addEventListener("tutorial-complete-step3", h3);
    window.addEventListener("tutorial-complete-step4", h4);
    window.addEventListener("tutorial-complete-step5", h5);

    return () => {
      window.removeEventListener("tutorial-complete-step1", h1);
      window.removeEventListener("tutorial-complete-step3", h3);
      window.removeEventListener("tutorial-complete-step4", h4);
      window.removeEventListener("tutorial-complete-step5", h5);
    };
  }, [completeStep]);

  // 로드 전: 정적 사전 조각(서버·클라이언트 첫 렌더 동일). 보유자는 html[data-has-assets] CSS로 숨김(#113)
  if (!isDataLoaded) return <RootFirstPaint />;

  if (isWizardOpen) {
    return (
      <div className="flex flex-col gap-4 md:gap-6">
        <OnboardingWizardFlow />
        {/* 부동산 수동 입력 진입점(dispatchAddRealEstate)이 열 다이얼로그 — 마법사 자체 스크린샷 단계는
            각 *ScreenshotImport를 직접 마운트하므로 여기서는 부동산만 필요 */}
        <div className="hidden" aria-hidden="true">
          <RealEstateInput />
        </div>
        {/* 스크린샷 실패 박스 [직접 입력]이 여는 추가 폼(#99) — 웰컴 분기와 같은 숨김 마운트 */}
        <div className="hidden" aria-hidden="true">
          <StockInput />
          <CryptoInput />
          <CashInput />
          <LoanInput />
        </div>
      </div>
    );
  }

  if (isWelcomeGuide) {
    return (
      <div className={WELCOME_PAGE_WRAP}>
        {/* 체험 진입 링크는 공유 대기 중에는 숨김(#59) */}
        <WelcomeGuide allowTrial={!isSharePending} skipHeroEnter={skipHeroEnterRef.current} />
        <div className="hidden" aria-hidden="true">
          <RealEstateInput />
          <StockInput />
          <CryptoInput />
          <CashInput />
          <LoanInput />
          <TradeInput />
        </div>
        <CopyrightFooter />
        <TutorialOverlay isWelcomeGuide={isWelcomeGuide} isSharePending={isSharePending} />
      </div>
    );
  }

  if (isMobile === undefined) {
    return (
      <div className="flex flex-col gap-4 md:gap-6">
        <TutorialOverlay isWelcomeGuide={isWelcomeGuide} isSharePending={isSharePending} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 md:gap-6 pb-5 sm:pb-9">
      {/* 체험 모드(#59) 예시 표기 정본 1곳 — 홈에서만, in-flow */}
      {isTrialMode() && view.type === "home" && <TrialBanner />}
      <AssetPageTabs />
      {/* 체험 모드(#59): FAB(스크린샷 AI 인식·등록) 숨김 */}
      {!isTrialMode() && <FloatingAddButton />}
      <TradeInput />
      {!hideFooterInPWA && <CopyrightFooter />}
      <TutorialOverlay isWelcomeGuide={isWelcomeGuide} isSharePending={isSharePending} />
    </div>
  );
}
