"use client"

import { AppGuide } from "./_components/top-nav/app-guide";
import { WelcomeGuide } from "./_components/layout/welcome-guide";
import { RealEstateInput } from "./_components/bottom-nav/asset-update/input/real-estate-input";
import { StockInput } from "./_components/bottom-nav/asset-update/input/stock-input";
import { CryptoInput } from "./_components/bottom-nav/asset-update/input/crypto-input";
import { CashInput } from "./_components/bottom-nav/asset-update/input/cash-input";
import { LoanInput } from "./_components/bottom-nav/asset-update/input/loan-input";
import { CopyrightFooter } from "./_components/layout/copyright-footer";
import { FloatingAddButton } from "./_components/layout/floating-add-button";
import { AssetPageTabs } from "./_components/layout/asset-page-tabs";
import { useAssetData } from "@/contexts/asset-data-context";
import { useIsMobile } from "@/hooks/use-mobile";

export default function Page() {
  const { assetData, isDataLoaded, isSharePending } = useAssetData();
  const isMobile = useIsMobile();

  const isWelcomeGuide =
    isSharePending ||
    (assetData.realEstate.length === 0 &&
      assetData.stocks.length === 0 &&
      assetData.crypto.length === 0 &&
      assetData.cash.length === 0 &&
      assetData.loans.length === 0);

  if (!isDataLoaded) return null;

  if (isWelcomeGuide) {
    return (
      <div className="flex flex-col gap-4 md:gap-6">
        <WelcomeGuide />
        <div className="hidden" aria-hidden="true">
          <RealEstateInput />
          <StockInput />
          <CryptoInput />
          <CashInput />
          <LoanInput />
        </div>
        <CopyrightFooter />
      </div>
    );
  }

  if (isMobile === undefined) {
    return (
      <div className="flex flex-col gap-4 md:gap-6">
        <AppGuide />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <AppGuide />
      <AssetPageTabs />
      <CopyrightFooter />
      <FloatingAddButton />
    </div>
  );
}
