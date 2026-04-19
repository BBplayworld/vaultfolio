"use client"

import { useState, useRef } from "react";
import { AssetOverviewCards } from "./_components/asset-overview-cards";
import { AssetDistributionCards } from "./_components/asset-distribution-cards";
import { YearlyNetAssetChart } from "./_components/yearly-net-asset-chart";
import { RealEstateInput } from "./_components/input/real-estate-input";
import { StockInput } from "./_components/input/stock-input";
import { CryptoInput } from "./_components/input/crypto-input";
import { ExchangeRateInput } from "./_components/input/exchange-rate-input";
import { CashInput } from "./_components/input/cash-input";
import { LoanInput } from "./_components/input/loan-input";
import { WelcomeGuide } from "./_components/welcome-guide";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Info, Database, Sparkles, Activity, CircleChevronDown, LayoutDashboard, PieChart, List, BarChart2, X, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CopyrightFooter } from "./_components/copyright-footer";
import { FloatingAddButton } from "./_components/floating-add-button";
import { APP_CONFIG } from "@/config";
import { useAssetData } from "@/contexts/asset-data-context";
import { ASSET_THEME } from "@/config/theme";
import { useIsMobile } from "@/hooks/use-mobile";

const ALERT_DISMISSED_KEY = "secretasset-guide-dismissed";


const INPUT_TABS = [
  { value: "real-estate", label: "부동산", mobileLabel: undefined },
  { value: "stocks", label: "주식", mobileLabel: undefined },
  { value: "crypto", label: "암호화폐", mobileLabel: undefined },
  { value: "cash", label: "현금성 자산", mobileLabel: "현금" },
  { value: "loans", label: "대출", mobileLabel: undefined },
] as const;

const MOBILE_TABS = [
  { value: "asset", label: "자산", icon: LayoutDashboard },
  { value: "distribution", label: "분포", icon: PieChart },
  { value: "detail", label: "상세", icon: List },
  { value: "chart", label: "차트", icon: BarChart2 },
] as const;

const TAB_TRIGGER_CLASS = [
  "h-10 sm:flex-row bg-muted/60 text-muted-foreground border border-border py-1 sm:py-2 overflow-hidden cursor-pointer transition-all",
  "hover:bg-accent hover:text-foreground hover:border-primary/50",
  "data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:border-primary data-[state=active]:shadow-lg data-[state=active]:font-semibold",
  ASSET_THEME.tabActive,
].join(" ");


export default function Page() {
  const { assetData, isDataLoaded, isSharePending } = useAssetData();
  const [activeTab, setActiveTab] = useState("real-estate");
  const [activeMobileTab, setActiveMobileTab] = useState("asset");
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

  const guideMiniBanner = (
    <button
      onClick={restoreAlert}
      className="flex items-center gap-2 w-full text-left px-3 py-2 rounded-lg border border-primary/20 bg-primary/5 hover:bg-primary/10 transition-colors text-xs text-primary"
    >
      <Info className="size-3.5 shrink-0" />
      <span className="flex-1 font-medium">앱 가이드 · 보안 안내 보기</span>
      <ChevronDown className="size-3.5 shrink-0 opacity-60" />
    </button>
  );

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
              데이터는 <span className="text-rose-500">이 기기 브라우저</span>에만 보관됩니다.{" "}
              <span className="text-rose-500">'공유 URL 복사'</span> 시에도 랜덤 키(Key)와 사용자 PIN이 완전히 분리되어, 관리자를 포함한 그 누구도 서버 데이터 단독으로는 복호화할 수 없도록 <span className="font-medium text-rose-500">원천 봉쇄</span>되어 있습니다.{" "}
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
              <span className="text-rose-500">자산 관리 메뉴</span>에서
              Grok·Gemini·GPT에 바로 붙여넣을 수 있는{" "}
              <span className="text-rose-500">AI 평가용 프롬프트</span>를 생성할 수 있습니다.{" "}
              데이터 내보내기·가져오기를 지원합니다.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <Activity className="size-4 text-primary flex-shrink-0 mt-0.5" />
            <span className="text-foreground leading-snug">
              <span className="font-semibold text-primary">매일 자동 업데이트</span>
              {"  —  "}
              보유 <span className="text-rose-500">주식 현재가</span>와{" "}
              <span className="text-rose-500">환율(USD·JPY)</span>을
              매일 최신 정보로 자동 반영합니다.
            </span>
          </li>
        </ul>
      </AlertDescription>
    </Alert>
  );

  const alertOrBanner = alertDismissed ? guideMiniBanner : alert;

  const inputTabs = (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
      <TabsList className="grid w-full grid-cols-5 h-13 p-1 gap-1 mb-0.5">
        {INPUT_TABS.map(({ value, label, mobileLabel }) => (
          <TabsTrigger key={value} value={value} className={TAB_TRIGGER_CLASS}>
            <span className="ml-1 text-[11px] leading-tight sm:text-sm">
              {mobileLabel ? <><span className="sm:hidden">{mobileLabel}</span><span className="hidden sm:inline">{label}</span></> : label}
            </span>
            <CircleChevronDown className="hidden sm:inline ml-auto size-3 sm:size-5 opacity-40 shrink-0" />
          </TabsTrigger>
        ))}
      </TabsList>
      <TabsContent value="real-estate" forceMount className="data-[state=inactive]:hidden"><RealEstateInput /></TabsContent>
      <TabsContent value="stocks" forceMount className="data-[state=inactive]:hidden"><StockInput /></TabsContent>
      <TabsContent value="crypto" forceMount className="data-[state=inactive]:hidden"><CryptoInput /></TabsContent>
      <TabsContent value="cash" forceMount className="data-[state=inactive]:hidden"><CashInput /></TabsContent>
      <TabsContent value="loans" forceMount className="data-[state=inactive]:hidden"><LoanInput /></TabsContent>
    </Tabs>
  );

  // isMobile이 undefined이면 분기 렌더 보류 (hydration flash 방지)
  if (isMobile === undefined) {
    return (
      <div className="flex flex-col gap-4 md:gap-6">
        {alertOrBanner}
      </div>
    );
  }

  if (isMobile) {
    return (
      <div className="flex flex-col gap-1">
        {alertOrBanner}
        <Tabs value={activeMobileTab} onValueChange={setActiveMobileTab} className="w-full mt-0.5">
          <TabsList className="grid w-full grid-cols-4 h-11 p-1 gap-1 mb-0.5 sticky top-0 z-10 bg-background/95 backdrop-blur">
            {MOBILE_TABS.map(({ value, label, icon: Icon }) => (
              <TabsTrigger
                key={value}
                value={value}
                className={[
                  "h-10 flex-col gap-0.5 bg-muted/60 text-muted-foreground border border-border py-1 overflow-hidden cursor-pointer transition-all",
                  "hover:bg-accent hover:text-foreground hover:border-primary/50",
                  "data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:border-primary data-[state=active]:shadow-lg data-[state=active]:font-semibold",
                  ASSET_THEME.tabActive,
                ].join(" ")}
              >
                <Icon className="size-4 shrink-0" />
                <span className="text-[10px] leading-tight">{label}</span>
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="asset">
            <AssetOverviewCards />
          </TabsContent>

          <TabsContent value="distribution">
            <AssetDistributionCards />
          </TabsContent>

          <TabsContent value="detail" forceMount className="data-[state=inactive]:hidden">
            <div className="flex flex-col gap-4 pb-5">
              <div ref={tabsRef}>{inputTabs}</div>
              <ExchangeRateInput />
            </div>
          </TabsContent>

          <TabsContent value="chart" forceMount className="data-[state=inactive]:hidden">
            <YearlyNetAssetChart />
          </TabsContent>
        </Tabs>
        <CopyrightFooter />
        <FloatingAddButton />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      {alertOrBanner}
      <AssetOverviewCards />
      <AssetDistributionCards />
      <div ref={tabsRef} className="pb-24">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-5 h-13 p-1 gap-1">
            {INPUT_TABS.map(({ value, label, mobileLabel }) => (
              <TabsTrigger key={value} value={value} className={TAB_TRIGGER_CLASS}>
                <span className="ml-1 text-[11px] leading-tight sm:text-sm">
                  {mobileLabel ? <><span className="sm:hidden">{mobileLabel}</span><span className="hidden sm:inline">{label}</span></> : label}
                </span>
                <CircleChevronDown className="hidden sm:inline ml-auto size-3 sm:size-5 opacity-40 shrink-0" />
              </TabsTrigger>
            ))}
          </TabsList>
          <TabsContent value="real-estate" forceMount className="data-[state=inactive]:hidden"><RealEstateInput /></TabsContent>
          <TabsContent value="stocks" forceMount className="data-[state=inactive]:hidden"><StockInput /></TabsContent>
          <TabsContent value="crypto" forceMount className="data-[state=inactive]:hidden"><CryptoInput /></TabsContent>
          <TabsContent value="cash" forceMount className="data-[state=inactive]:hidden"><CashInput /></TabsContent>
          <TabsContent value="loans" forceMount className="data-[state=inactive]:hidden"><LoanInput /></TabsContent>
        </Tabs>
      </div>
      <div className="flex flex-col gap-2">
        <ExchangeRateInput />
      </div>
      <YearlyNetAssetChart />
      <CopyrightFooter />
      <FloatingAddButton />
    </div>
  );
}
