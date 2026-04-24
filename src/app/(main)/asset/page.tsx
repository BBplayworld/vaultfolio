"use client"

import { useState, useRef, useEffect } from "react";
import { AssetOverviewCards } from "./_components/overview/asset-overview-cards";
import { AssetDistributionCards } from "./_components/distribution/asset-distribution-cards";
import { YearlyNetAssetChart } from "./_components/chart";
import { RealEstateInput } from "./_components/input/real-estate-input";
import { StockInput } from "./_components/input/stock-input";
import { CryptoInput } from "./_components/input/crypto-input";
import { CashInput } from "./_components/input/cash-input";
import { LoanInput } from "./_components/input/loan-input";
import { WelcomeGuide } from "./_components/management/welcome-guide";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Info, Database, Sparkles, Activity, LayoutDashboard, PieChart, List, BarChart2, X, TrendingUp, Coins, Landmark } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DividendCard, ProfitCard } from "./_components/chart";
import { CopyrightFooter } from "./_components/management/copyright-footer";
import { FloatingAddButton } from "./_components/management/floating-add-button";
import { AssetDetailTabs } from "./_components/detail/asset-detail-tabs";
import { APP_CONFIG, ASSET_THEME } from "@/config";
import { useAssetData } from "@/contexts/asset-data-context";
import { useIsMobile } from "@/hooks/use-mobile";

const ALERT_DISMISSED_KEY = "secretasset-guide-dismissed";

const TABS = [
  { value: "distribution", label: "분포", icon: LayoutDashboard },
  { value: "detail", label: "상세", icon: List },
  { value: "chart", label: "차트", icon: BarChart2 },
] as const;

export default function Page() {
  const { assetData, isDataLoaded, isSharePending, syncStockPricesAndSnapshots } = useAssetData();
  const [activePcTab, setActivePcTab] = useState("distribution");
  const [activeChartTab, setActiveChartTab] = useState("netasset");
  const stockSyncedRef = useRef(false);

  const handlePcTabChange = (tab: string) => {
    setActivePcTab(tab);
    if (tab === "detail" && !stockSyncedRef.current) {
      stockSyncedRef.current = true;
      void syncStockPricesAndSnapshots();
    }
  };
  const isMobile = useIsMobile();
  const tabsRef = useRef<HTMLDivElement>(null);
  const [alertDismissed, setAlertDismissed] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(ALERT_DISMISSED_KEY) === "1";
  });

  const dismissAlert = () => {
    localStorage.setItem(ALERT_DISMISSED_KEY, "1");
    setAlertDismissed(true);
  };

  const restoreAlert = () => {
    localStorage.removeItem(ALERT_DISMISSED_KEY);
    setAlertDismissed(false);
  };

  useEffect(() => {
    const restore = () => restoreAlert();
    const dismiss = () => setAlertDismissed(true);
    window.addEventListener("trigger-restore-guide", restore);
    window.addEventListener("trigger-dismiss-guide", dismiss);
    return () => {
      window.removeEventListener("trigger-restore-guide", restore);
      window.removeEventListener("trigger-dismiss-guide", dismiss);
    };
  }, []);

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

  const alert = (
    <Alert className="border-primary/30 bg-gradient-to-r from-primary/5 to-primary/10 relative">
      <Info className="size-5 text-primary" />
      <Button
        variant="ghost"
        size="icon"
        onClick={dismissAlert}
        className="absolute top-2 right-2 size-7 text-muted-foreground hover:text-foreground"
        aria-label="닫기"
      >
        <X className="size-4" />
      </Button>
      <AlertTitle className="text-base font-semibold text-primary mb-3 pr-8">
        {APP_CONFIG.name} - 내 자산은 오직 내 브라우저에만
      </AlertTitle>
      <AlertDescription>
        <ul className="space-y-2.5 text-xs sm:text-xs">
          <li className="flex items-start gap-2">
            <Database className="size-4 text-primary flex-shrink-0 mt-0.5" />
            <span className="text-foreground leading-snug">
              <span className="font-semibold text-primary">영지식(Zero-Knowledge) 이중 보안</span>
              {"  —  "}
              데이터는 <span className="text-rose-400">이 기기 브라우저</span>에만 보관됩니다.{" "}
              <span className="text-rose-400">&apos;공유 URL 복사&apos;</span> 시에도 랜덤 키(Key)와 사용자 PIN이 완전히 분리되어, 관리자를 포함한 그 누구도 서버 데이터 단독으로는 복호화할 수 없도록 <span className="font-medium text-rose-400">원천 봉쇄</span>되어 있습니다.{" "}
              <span className="text-muted-foreground block mt-1 break-keep">
                (주의: 공유 URL 자체에 해독 키의 절반이 포함되어 있습니다. 안전을 위해 URL을 공개 게시판 등에 노출하지 마시고, PIN 번호는 다른 수단을 통해 공유 대상자에게 별도로 알려주세요.)
              </span>
            </span>
          </li>
          <li className="flex items-start gap-2">
            <Sparkles className="size-4 text-primary flex-shrink-0 mt-0.5" />
            <span className="text-foreground leading-snug">
              <span className="font-semibold text-primary">AI 자산 분석</span>
              {"  —  "}
              상단{" "}
              <span className="text-rose-400">자산 관리 메뉴</span>에서
              Grok·Gemini·GPT에 바로 붙여넣을 수 있는{" "}
              <span className="text-rose-400">AI 평가용 프롬프트</span>를 생성할 수 있습니다.{" "}
              데이터 내보내기·가져오기를 지원합니다.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <Activity className="size-4 text-primary flex-shrink-0 mt-0.5" />
            <span className="text-foreground leading-snug">
              <span className="font-semibold text-primary">매일 자동 업데이트</span>
              {"  —  "}
              보유 <span className="text-rose-400">주식 현재가</span>와{" "}
              <span className="text-rose-400">환율(USD·JPY)</span>을
              매일 최신 정보로 자동 반영합니다.
            </span>
          </li>
        </ul>
      </AlertDescription>
    </Alert>
  );

  const alertOrBanner = alertDismissed ? null : alert;
  const chartTabs = (
    <Tabs value={activeChartTab} onValueChange={setActiveChartTab} className="w-full">
      <TabsList className={ASSET_THEME.tabList2}>
        <TabsTrigger value="netasset" className={ASSET_THEME.tabTrigger2}><Landmark className="size-4 shrink-0" />순자산</TabsTrigger>
        <TabsTrigger value="profit" className={ASSET_THEME.tabTrigger2}><TrendingUp className="size-4 shrink-0" />수익</TabsTrigger>
        <TabsTrigger value="dividend" className={ASSET_THEME.tabTrigger2}><Coins className="size-4 shrink-0" />배당</TabsTrigger>
      </TabsList>
      <TabsContent value="netasset" forceMount className="data-[state=inactive]:hidden mt-2 sm:mt-4">
        <YearlyNetAssetChart />
      </TabsContent>
      <TabsContent value="dividend" forceMount className="data-[state=inactive]:hidden mt-2 sm:mt-4">
        <DividendCard isActive={activeChartTab === "dividend"} />
      </TabsContent>
      <TabsContent value="profit" forceMount className="data-[state=inactive]:hidden mt-2 sm:4">
        <ProfitCard isActive={activeChartTab === "profit"} />
      </TabsContent>
    </Tabs>
  );

  if (isMobile === undefined) {
    return (
      <div className="flex flex-col gap-4 md:gap-6">
        {alertOrBanner}
      </div>
    );
  }

  const inputLayer = (
    <div className="hidden" aria-hidden="true">
      <RealEstateInput hideList />
      <StockInput hideList />
      <CryptoInput hideList />
      <CashInput hideList />
      <LoanInput hideList />
    </div>
  );

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      {inputLayer}
      {alertOrBanner}
      <Tabs value={activePcTab} onValueChange={handlePcTabChange} className="w-full">
        <TabsList className={ASSET_THEME.tabList1}>
          {TABS.map(({ value, label, icon: Icon }) => (
            <TabsTrigger key={value} value={value} className={ASSET_THEME.tabTrigger1}>
              <Icon className="size-4 shrink-0" />
              {label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="distribution" className="data-[state=inactive]:hidden mt-2 sm:mt-4">
          <div className="flex flex-col gap-4 md:gap-6">
            <AssetDistributionCards />
          </div>
        </TabsContent>

        <TabsContent value="detail" forceMount className="data-[state=inactive]:hidden mt-2 sm:mt-4">
          <div className="flex flex-col gap-4" ref={tabsRef}>
            <AssetDetailTabs />
          </div>
        </TabsContent>

        <TabsContent value="chart" forceMount className="data-[state=inactive]:hidden mt-2 sm:mt-4">
          {chartTabs}
        </TabsContent>
      </Tabs>

      <CopyrightFooter />
      <FloatingAddButton />
    </div>
  );
}
