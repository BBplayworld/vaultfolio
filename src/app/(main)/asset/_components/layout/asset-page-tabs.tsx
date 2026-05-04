"use client";

import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Home, List, Activity, TrendingUp, Coins, Landmark, Building2, Bitcoin, Banknote, CreditCard, LayoutGrid, Wallet, ShieldAlert } from "lucide-react";
import { ASSET_THEME } from "@/config";
import { Dashboard, useDashboardTabs } from "../main-nav/home/dashboard";
import { StockTab } from "../main-nav/detail/tabs/stock-tab";
import { RealEstateTab } from "../main-nav/detail/tabs/real-estate-tab";
import { CryptoTab } from "../main-nav/detail/tabs/crypto-tab";
import { CashTab } from "../main-nav/detail/tabs/cash-tab";
import { LoanTab } from "../main-nav/detail/tabs/loan-tab";
import { YearlyNetAssetChart, DividendCard, ProfitCard } from "../main-nav/activity";
import { RealEstateInput } from "../bottom-nav/asset-update/input/real-estate-input";
import { StockInput } from "../bottom-nav/asset-update/input/stock-input";
import { CryptoInput } from "../bottom-nav/asset-update/input/crypto-input";
import { CashInput } from "../bottom-nav/asset-update/input/cash-input";
import { LoanInput } from "../bottom-nav/asset-update/input/loan-input";
import type { LucideIcon } from "lucide-react";

// 최상위 탭 (홈/상세/성과) — tabList1 스타일 (w-fit)
const HOME_TABS = [
  { value: "home", label: "홈", icon: Home },
  { value: "detail", label: "상세", icon: List },
  { value: "activity", label: "성과", icon: Activity },
] as const;

// 홈 서브탭 아이콘 매핑 (useDashboardTabs가 동적으로 생성하는 탭)
const HOME_SUBTAB_ICONS: Record<string, LucideIcon> = {
  all: LayoutGrid,
  financial: Wallet,
  realEstate: Building2,
  liability: ShieldAlert,
};

// 상세 서브탭 (주식/부동산/암호화폐/현금/대출) — tabList2 스타일 (w-full)
const DETAIL_TABS = [
  { value: "stocks", label: "주식", icon: TrendingUp, Content: StockTab },
  { value: "real-estate", label: "부동산", icon: Building2, Content: RealEstateTab },
  { value: "crypto", label: "암호화폐", icon: Bitcoin, Content: CryptoTab },
  { value: "cash", label: "현금", icon: Banknote, Content: CashTab },
  { value: "loans", label: "대출", icon: CreditCard, Content: LoanTab },
] as const;

// 성과 서브탭 (순자산/수익/배당) — tabList2 스타일 (w-full)
const ACTIVITY_TABS = [
  { value: "netasset", label: "순자산", icon: Landmark },
  { value: "profit", label: "수익", icon: TrendingUp },
  { value: "dividend", label: "배당", icon: Coins },
] as const;

export function AssetPageTabs() {
  const [activeHomeTab, setActiveHomeTab] = useState("home");
  const [activeActivityTab, setActiveActivityTab] = useState("netasset");
  const [activeDetailTab, setActiveDetailTab] = useState("");
  const [activeDetailAssetTab, setActiveDetailAssetTab] = useState("stocks");

  const handleHomeTabChange = (tab: string) => {
    setActiveHomeTab(tab);
    if (tab === "detail") {
      window.dispatchEvent(new CustomEvent("tutorial-start-wait-step2"));
    }
    if (tab === "activity") {
      window.dispatchEvent(new CustomEvent("tutorial-advance-step5"));
    }
  };

  useEffect(() => {
    const handler = (e: Event) => {
      const tab = (e as CustomEvent<{ tab: string }>).detail?.tab;
      handleHomeTabChange("detail");
      if (tab) setActiveDetailAssetTab(tab);
    };
    
    // 튜토리얼 "다음" 버튼 클릭 시, 가짜 클릭 이벤트가 무시되더라도 확실히 탭이 전환되도록 리스너 추가
    const forceDetailTab = () => handleHomeTabChange("detail");
    const forceActivityTab = () => setActiveHomeTab("activity");
    const forceProfitTab = () => setActiveActivityTab("profit");

    window.addEventListener("navigate-to-tab", handler);
    window.addEventListener("tutorial-start-wait-step2", forceDetailTab);
    window.addEventListener("tutorial-advance-step5", forceActivityTab);
    window.addEventListener("tutorial-complete-step5", forceProfitTab);
    
    return () => {
      window.removeEventListener("navigate-to-tab", handler);
      window.removeEventListener("tutorial-start-wait-step2", forceDetailTab);
      window.removeEventListener("tutorial-advance-step5", forceActivityTab);
      window.removeEventListener("tutorial-complete-step5", forceProfitTab);
    };
  }, []);

  const { visibleTabs, resolvedTab } = useDashboardTabs(activeDetailTab);

  return (
    <>
      <div className="hidden" aria-hidden="true">
        <RealEstateInput />
        <StockInput />
        <CryptoInput />
        <CashInput />
        <LoanInput />
      </div>

      <Tabs value={activeHomeTab} onValueChange={handleHomeTabChange} className="w-full">
        <div className="bg-background/95 pb-1 sm:pb-0">
          <TabsList className={ASSET_THEME.tabList1}>
            {HOME_TABS.map(({ value, label, icon: Icon }) => (
              <TabsTrigger
                key={value}
                value={value}
                className={ASSET_THEME.tabTrigger1}
                data-tutorial={value === "detail" ? "tutorial-detail-tab" : value === "activity" ? "tutorial-activity-tab" : undefined}
              >
                <Icon className="size-4 shrink-0" />
                {label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <TabsContent value="home" className="data-[state=inactive]:hidden mt-1 sm:mt-2">
          <div className="flex flex-col gap-4 md:gap-6">
            {visibleTabs.length > 1 && (
              <Tabs value={resolvedTab} onValueChange={setActiveDetailTab}>
                <TabsList className={ASSET_THEME.tabList2}>
                  {visibleTabs.map(({ value, label }) => {
                    const Icon = HOME_SUBTAB_ICONS[value];
                    return (
                      <TabsTrigger key={value} value={value} className={ASSET_THEME.tabTrigger2}>
                        {Icon && <Icon className="size-4 shrink-0 hidden sm:block" />}
                        {label}
                      </TabsTrigger>
                    );
                  })}
                </TabsList>
              </Tabs>
            )}
            <Dashboard activeDetailTab={activeDetailTab} setActiveDetailTab={setActiveDetailTab} />
          </div>
        </TabsContent>

        <TabsContent value="detail" forceMount className="data-[state=inactive]:hidden mt-1 sm:mt-2">
          <Tabs value={activeDetailAssetTab} onValueChange={setActiveDetailAssetTab}>
            <TabsList className={ASSET_THEME.tabList2}>
              {DETAIL_TABS.map(({ value, label, icon: Icon }) => (
                <TabsTrigger key={value} value={value} className={ASSET_THEME.tabTrigger2}>
                  <Icon className="size-3.5 shrink-0 hidden sm:block" />
                  {label}
                </TabsTrigger>
              ))}
            </TabsList>
            {DETAIL_TABS.map(({ value, Content }) => (
              <TabsContent key={value} value={value} forceMount className="data-[state=inactive]:hidden">
                <Content />
              </TabsContent>
            ))}
          </Tabs>
        </TabsContent>

        <TabsContent value="activity" forceMount className="data-[state=inactive]:hidden mt-1 sm:mt-2">
          <Tabs
            value={activeActivityTab}
            onValueChange={(tab) => {
              setActiveActivityTab(tab);
              if (tab === "profit") {
                window.dispatchEvent(new CustomEvent("tutorial-complete-step5"));
              }
            }}
            className="w-full"
          >
            <TabsList className={ASSET_THEME.tabList2}>
              {ACTIVITY_TABS.map(({ value, label, icon: Icon }) => (
                <TabsTrigger
                  key={value}
                  value={value}
                  className={ASSET_THEME.tabTrigger2}
                  data-tutorial={value === "profit" ? "tutorial-profit-subtab" : undefined}
                >
                  <Icon className="size-4 shrink-0 hidden sm:block" />
                  {label}
                </TabsTrigger>
              ))}
            </TabsList>
            <TabsContent value="netasset" forceMount className="data-[state=inactive]:hidden mt-1 sm:mt-2">
              <YearlyNetAssetChart />
            </TabsContent>
            <TabsContent value="profit" forceMount className="data-[state=inactive]:hidden mt-1 sm:mt-2">
              <ProfitCard isActive={activeActivityTab === "profit"} />
            </TabsContent>
            <TabsContent value="dividend" forceMount className="data-[state=inactive]:hidden mt-1 sm:mt-2">
              <DividendCard isActive={activeActivityTab === "dividend"} />
            </TabsContent>
          </Tabs>
        </TabsContent>
      </Tabs>
    </>
  );
}
