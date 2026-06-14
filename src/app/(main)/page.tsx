"use client"

import { useEffect, useState } from "react";
import { WelcomeGuide } from "./_components/layout/onboarding/welcome-guide";
import { AppGuide } from "./_components/header-menu/app-guide";
import { RealEstateInput } from "./_components/forms/asset-update/input/real-estate-input";
import { StockInput } from "./_components/forms/asset-update/input/stock-input";
import { CryptoInput } from "./_components/forms/asset-update/input/crypto-input";
import { CashInput } from "./_components/forms/asset-update/input/cash-input";
import { LoanInput } from "./_components/forms/asset-update/input/loan-input";
import { TradeInput } from "./_components/forms/trade/trade-input";
import { CopyrightFooter } from "./_components/layout/copyright-footer";
import { FloatingAddButton } from "./_components/layout/floating/floating-add-button";
import { AssetPageTabs } from "./_components/layout/navigation/asset-page-tabs";
import { TutorialOverlay } from "./_components/tutorial/tutorial-overlay";
import { useAssetData } from "@/contexts/asset-data-context";
import { useIsMobile } from "@/hooks/use-mobile";
import { UpdateNoticeDialog } from "./_components/layout/onboarding/notice-dialog";
import { useTutorialStore } from "@/stores/tutorial/tutorial-provider";
import type { TutorialStep } from "@/stores/tutorial/tutorial-store";

export default function Page() {
  const { assetData, isDataLoaded, isSharePending } = useAssetData();
  const isMobile = useIsMobile();
  const initTutorial = useTutorialStore((s) => s.initTutorial);
  const completeStep = useTutorialStore((s) => s.completeStep);
  const showStep0 = useTutorialStore((s) => s.showStep0);
  const [step0Mode, setStep0Mode] = useState<"screenshot" | "manual" | "real-estate" | null>(null);

  const isWelcomeGuide =
    isSharePending ||
    (assetData.realEstate.length === 0 &&
      assetData.stocks.length === 0 &&
      assetData.crypto.length === 0 &&
      assetData.cash.length === 0 &&
      assetData.loans.length === 0);

  // 튜토리얼 초기화
  useEffect(() => {
    if (!isDataLoaded) return;
    initTutorial();
  }, [isDataLoaded, initTutorial]);

  useEffect(() => {
    const h = (e: Event) => {
      const mode = (e as CustomEvent).detail?.mode as "screenshot" | "manual" | "real-estate";
      setStep0Mode(mode ?? "screenshot");
      showStep0();
    };
    window.addEventListener("tutorial-show-step0", h);
    return () => window.removeEventListener("tutorial-show-step0", h);
  }, [showStep0]);

  // 커스텀 이벤트 리스너 — 각 컴포넌트에서 completeStep 이벤트를 발생시키면 처리
  useEffect(() => {
    const makeHandler = (step: TutorialStep) => () => completeStep(step);
    const h1 = makeHandler(1); // 자산 업데이트(FAB)
    const h2 = makeHandler(2); // 자산 도구(더보기)
    const h3 = makeHandler(3); // 인증샷
    const h4 = makeHandler(4); // 상세 탭
    const h5 = makeHandler(5); // 성과 탭

    window.addEventListener("tutorial-complete-step1", h1);
    window.addEventListener("tutorial-complete-step2", h2);
    window.addEventListener("tutorial-complete-step3", h3);
    window.addEventListener("tutorial-complete-step4", h4);
    window.addEventListener("tutorial-complete-step5", h5);

    return () => {
      window.removeEventListener("tutorial-complete-step1", h1);
      window.removeEventListener("tutorial-complete-step2", h2);
      window.removeEventListener("tutorial-complete-step3", h3);
      window.removeEventListener("tutorial-complete-step4", h4);
      window.removeEventListener("tutorial-complete-step5", h5);
    };
  }, [completeStep]);

  if (!isDataLoaded) return null;

  if (isWelcomeGuide) {
    return (
      <div className="flex flex-col gap-4 md:gap-6">
        <AppGuide />
        <WelcomeGuide />
        <div className="hidden" aria-hidden="true">
          <RealEstateInput />
          <StockInput />
          <CryptoInput />
          <CashInput />
          <LoanInput />
          <TradeInput />
        </div>
        <CopyrightFooter />
        <TutorialOverlay isWelcomeGuide={isWelcomeGuide} isSharePending={isSharePending} step0Mode={step0Mode} />
      </div>
    );
  }

  if (isMobile === undefined) {
    return (
      <div className="flex flex-col gap-4 md:gap-6">
        <TutorialOverlay isWelcomeGuide={isWelcomeGuide} isSharePending={isSharePending} step0Mode={step0Mode} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 md:gap-6 pb-5 sm:pb-9">
      <AssetPageTabs />
      <FloatingAddButton />
      <TradeInput />
      <CopyrightFooter />
      <TutorialOverlay isWelcomeGuide={isWelcomeGuide} isSharePending={isSharePending} />
      <UpdateNoticeDialog />
    </div>
  );
}
