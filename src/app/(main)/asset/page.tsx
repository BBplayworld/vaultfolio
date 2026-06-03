"use client"

import { useEffect, useState } from "react";
import { WelcomeGuide } from "./_components/layout/welcome-guide";
import { AppGuide } from "./_components/top-nav/app-guide";
import { RealEstateInput } from "./_components/bottom-nav/asset-update/input/real-estate-input";
import { StockInput } from "./_components/bottom-nav/asset-update/input/stock-input";
import { CryptoInput } from "./_components/bottom-nav/asset-update/input/crypto-input";
import { CashInput } from "./_components/bottom-nav/asset-update/input/cash-input";
import { LoanInput } from "./_components/bottom-nav/asset-update/input/loan-input";
import { CopyrightFooter } from "./_components/layout/copyright-footer";
import { FloatingAddButton } from "./_components/layout/floating-add-button";
import { AssetPageTabs } from "./_components/layout/asset-page-tabs";
import { TutorialOverlay } from "./_components/tutorial/tutorial-overlay";
import { useAssetData } from "@/contexts/asset-data-context";
import { useIsMobile } from "@/hooks/use-mobile";
import { ScrollToTop } from "./_components/layout/scroll-to-top";
import { UpdateNoticeDialog } from "./_components/layout/notice-dialog";
import { useTutorialStore } from "@/stores/tutorial/tutorial-provider";
import type { TutorialStep } from "@/stores/tutorial/tutorial-store";

export default function Page() {
  const { assetData, isDataLoaded, isSharePending } = useAssetData();
  const isMobile = useIsMobile();
  const initTutorial = useTutorialStore((s) => s.initTutorial);
  const completeStep = useTutorialStore((s) => s.completeStep);
  const advanceStep5 = useTutorialStore((s) => s.advanceStep5);
  const showStep0 = useTutorialStore((s) => s.showStep0);
  const startWaiting = useTutorialStore((s) => s.startWaiting);
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
    const h1 = makeHandler(1);
    const h2 = () => startWaiting(2);
    const h3 = makeHandler(3);
    const h4 = makeHandler(4);
    const h5Activity = () => advanceStep5(); // Step 5: activity 탭 클릭 → sub-step profit으로 전환
    const h5Profit = makeHandler(5);         // Step 5: profit 탭 클릭 → 완료

    window.addEventListener("tutorial-complete-step1", h1);
    window.addEventListener("tutorial-start-wait-step2", h2);
    window.addEventListener("tutorial-complete-step3", h3);
    window.addEventListener("tutorial-complete-step4", h4);
    window.addEventListener("tutorial-advance-step5", h5Activity);
    window.addEventListener("tutorial-complete-step5", h5Profit);

    return () => {
      window.removeEventListener("tutorial-complete-step1", h1);
      window.removeEventListener("tutorial-start-wait-step2", h2);
      window.removeEventListener("tutorial-complete-step3", h3);
      window.removeEventListener("tutorial-complete-step4", h4);
      window.removeEventListener("tutorial-advance-step5", h5Activity);
      window.removeEventListener("tutorial-complete-step5", h5Profit);
    };
  }, [completeStep, advanceStep5]);

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
    <div className="flex flex-col gap-4 md:gap-6">
      <AssetPageTabs />
      <CopyrightFooter />
      <FloatingAddButton />
      <ScrollToTop />
      <TutorialOverlay isWelcomeGuide={isWelcomeGuide} isSharePending={isSharePending} />
      <UpdateNoticeDialog />
    </div>
  );
}
