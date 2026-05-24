"use client";

import { useEffect } from "react";
import { Dashboard } from "../../views/home/dashboard";
import { StockTab } from "../../views/detail/tabs/stock-tab";
import { RealEstateTab } from "../../views/detail/tabs/real-estate-tab";
import { CryptoTab } from "../../views/detail/tabs/crypto-tab";
import { CashTab } from "../../views/detail/tabs/cash-tab";
import { LoanTab } from "../../views/detail/tabs/loan-tab";
import { YearlyNetAssetChart, DividendCard, ProfitCard } from "../../views/activity";
import { PerformanceHub } from "../../views/activity/performance-hub";
import { DetailHub } from "../../views/detail/detail-hub";
import { InlineSelector } from "../ui/inline-selector";
import { RealEstateInput } from "../../forms/asset-update/input/real-estate-input";
import { StockInput } from "../../forms/asset-update/input/stock-input";
import { CryptoInput } from "../../forms/asset-update/input/crypto-input";
import { CashInput } from "../../forms/asset-update/input/cash-input";
import { LoanInput } from "../../forms/asset-update/input/loan-input";
import { useAssetNavigation, type DetailTab, type ActivityTab } from "./navigation-context";

// 1차 탭 (홈/상세/성과) — 홈에서만 노출, 상세·성과 클릭 시 drill-down 진입
type Top1 = "home" | "detail" | "activity";
const TOP1_OPTIONS: { value: Top1; label: string }[] = [
  { value: "home",     label: "홈" },
  { value: "detail",   label: "상세" },
  { value: "activity", label: "성과" },
];

function HomeView() {
  const { navigate } = useAssetNavigation();
  const onTabChange = (tab: Top1) => {
    if (tab === "home") return;
    if (tab === "detail") navigate({ type: "detail", tab: "hub" });
    if (tab === "activity") navigate({ type: "activity", tab: "hub" });
  };
  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <div className="flex justify-start">
        <InlineSelector
          value="home"
          onChange={onTabChange}
          options={TOP1_OPTIONS}
          size="lg"
          ariaLabel="페이지 선택"
        />
      </div>
      <Dashboard />
    </div>
  );
}

function DetailView({ tab }: { tab: DetailTab }) {
  if (tab === "hub") return <DetailHub />;
  return (
    <div className="flex flex-col gap-3 sm:gap-4">
      {tab === "stocks"      && <StockTab />}
      {tab === "real-estate" && <RealEstateTab />}
      {tab === "crypto"      && <CryptoTab />}
      {tab === "cash"        && <CashTab />}
      {tab === "loans"       && <LoanTab />}
    </div>
  );
}

function ActivityView({ tab }: { tab: ActivityTab }) {
  if (tab === "hub") return <PerformanceHub />;
  return (
    <div className="flex flex-col gap-3 sm:gap-4">
      {tab === "netasset" && <YearlyNetAssetChart />}
      {tab === "profit"   && <ProfitCard isActive />}
      {tab === "dividend" && <DividendCard isActive />}
    </div>
  );
}

export function AssetPageTabs() {
  const { view, navigate } = useAssetNavigation();

  // 기존 코드와의 호환: navigate-to-tab CustomEvent 수신해 detail로 진입
  useEffect(() => {
    const handler = (e: Event) => {
      const tab = (e as CustomEvent<{ tab: string }>).detail?.tab as DetailTab | undefined;
      if (tab) navigate({ type: "detail", tab });
    };
    window.addEventListener("navigate-to-tab", handler);
    return () => window.removeEventListener("navigate-to-tab", handler);
  }, [navigate]);

  return (
    <>
      <div className="hidden" aria-hidden="true">
        <RealEstateInput />
        <StockInput />
        <CryptoInput />
        <CashInput />
        <LoanInput />
      </div>

      {/* key 변경 시 재마운트되며 fade+slide-in 애니메이션 (토스 스타일 미세 전환) */}
      <div
        key={view.type === "home" ? "home" : `${view.type}/${view.tab}`}
        className="animate-in fade-in slide-in-from-bottom-1 duration-200"
      >
        {view.type === "home" && <HomeView />}
        {view.type === "detail" && <DetailView tab={view.tab} />}
        {view.type === "activity" && <ActivityView tab={view.tab} />}
      </div>
    </>
  );
}
