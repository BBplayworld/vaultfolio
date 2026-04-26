"use client"

import { useState, useRef, useEffect } from "react";
import { Dashboard } from "./_components/main-nav/home/dashboard";
import { AppGuide } from "./_components/top-nav/app-guide";
import { YearlyNetAssetChart } from "./_components/main-nav/activity";
import { RealEstateInput } from "./_components/bottom-nav/asset-update/input/real-estate-input";
import { StockInput } from "./_components/bottom-nav/asset-update/input/stock-input";
import { CryptoInput } from "./_components/bottom-nav/asset-update/input/crypto-input";
import { CashInput } from "./_components/bottom-nav/asset-update/input/cash-input";
import { LoanInput } from "./_components/bottom-nav/asset-update/input/loan-input";
import { WelcomeGuide } from "./_components/layout/welcome-guide";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Home, List, Activity, TrendingUp, Coins, Landmark } from "lucide-react";
import { DividendCard, ProfitCard } from "./_components/main-nav/activity";
import { CopyrightFooter } from "./_components/layout/copyright-footer";
import { FloatingAddButton } from "./_components/layout/floating-add-button";
import { AssetDetailTabs } from "./_components/main-nav/detail/asset-detail-tabs";
import { ASSET_THEME } from "@/config";
import { useAssetData } from "@/contexts/asset-data-context";
import { useIsMobile } from "@/hooks/use-mobile";

const TABS = [
  { value: "home", label: "홈", icon: Home },
  { value: "detail", label: "상세", icon: List },
  { value: "activity", label: "성과", icon: Activity },
] as const;

export default function Page() {
  const { assetData, isDataLoaded, isSharePending, syncStockPricesAndSnapshots } = useAssetData();
  const [activeHomeTab, setActiveHomeTab] = useState("home");
  const [activeActivityTab, setActiveActivityTab] = useState("netasset");
  const stockSyncedRef = useRef(false);

  const handleHomeTabChange = (tab: string) => {
    setActiveHomeTab(tab);
    if (tab === "detail" && !stockSyncedRef.current) {
      stockSyncedRef.current = true;
      void syncStockPricesAndSnapshots();
    }
  };

  useEffect(() => {
    const handler = () => handleHomeTabChange("detail");
    window.addEventListener("navigate-to-tab", handler);
    return () => window.removeEventListener("navigate-to-tab", handler);
  }, []);

  const isMobile = useIsMobile();
  const tabsRef = useRef<HTMLDivElement>(null);

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
          <StockInput hideList />
          <CryptoInput />
          <CashInput />
          <LoanInput />
        </div>
        <CopyrightFooter />
      </div>
    );
  }

  const activityTabs = (
    <Tabs value={activeActivityTab} onValueChange={setActiveActivityTab} className="w-full">
      <TabsList className={ASSET_THEME.tabList2}>
        <TabsTrigger value="netasset" className={ASSET_THEME.tabTrigger2}><Landmark className="size-4 shrink-0" />순자산</TabsTrigger>
        <TabsTrigger value="profit" className={ASSET_THEME.tabTrigger2}><TrendingUp className="size-4 shrink-0" />수익</TabsTrigger>
        <TabsTrigger value="dividend" className={ASSET_THEME.tabTrigger2}><Coins className="size-4 shrink-0" />배당</TabsTrigger>
      </TabsList>
      <TabsContent value="netasset" forceMount className="data-[state=inactive]:hidden mt-2 sm:mt-4">
        <YearlyNetAssetChart />
      </TabsContent>
      <TabsContent value="dividend" forceMount className="data-[state=inactive]:hidden mt-2 sm:mt-4">
        <DividendCard isActive={activeActivityTab === "dividend"} />
      </TabsContent>
      <TabsContent value="profit" forceMount className="data-[state=inactive]:hidden mt-2 sm:mt-4">
        <ProfitCard isActive={activeActivityTab === "profit"} />
      </TabsContent>
    </Tabs>
  );

  if (isMobile === undefined) {
    return (
      <div className="flex flex-col gap-4 md:gap-6">
        <AppGuide />
      </div>
    );
  }

  const inputLayer = (
    <div className="hidden" aria-hidden="true">
      <RealEstateInput hideList />
      <StockInput />
      <CryptoInput hideList />
      <CashInput hideList />
      <LoanInput hideList />
    </div>
  );

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      {inputLayer}
      <AppGuide />
      <Tabs value={activeHomeTab} onValueChange={handleHomeTabChange} className="w-full">
        <div className="sticky top-10 sm:top-0 z-40 bg-background/95 backdrop-blur-sm pb-1 sm:pb-0 sm:static sm:bg-transparent sm:backdrop-blur-none">
          <TabsList className={ASSET_THEME.tabList1}>
            {TABS.map(({ value, label, icon: Icon }) => (
              <TabsTrigger key={value} value={value} className={ASSET_THEME.tabTrigger1}>
                <Icon className="size-4 shrink-0" />
                {label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <TabsContent value="home" className="data-[state=inactive]:hidden mt-2 sm:mt-2">
          <div className="flex flex-col gap-4 md:gap-6">
            <Dashboard />
          </div>
        </TabsContent>

        <TabsContent value="detail" forceMount className="data-[state=inactive]:hidden mt-2 sm:mt-2">
          <div className="flex flex-col gap-4" ref={tabsRef}>
            <AssetDetailTabs />
          </div>
        </TabsContent>

        <TabsContent value="activity" forceMount className="data-[state=inactive]:hidden mt-2 sm:mt-2">
          {activityTabs}
        </TabsContent>
      </Tabs>

      <CopyrightFooter />
      <FloatingAddButton />
    </div>
  );
}
