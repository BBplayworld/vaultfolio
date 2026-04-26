"use client";
import { Stock } from "@/types/asset";

import { useState, useEffect } from "react";
import { TrendingUp, Building2, Bitcoin, Banknote, CreditCard } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ASSET_THEME, MAIN_PALETTE } from "@/config/theme";
import { formatCurrency } from "@/lib/number-utils";
import { StockTab } from "./tabs/stock-tab";
import { RealEstateTab } from "./tabs/real-estate-tab";
import { CryptoTab } from "./tabs/crypto-tab";
import { CashTab } from "./tabs/cash-tab";
import { LoanTab } from "./tabs/loan-tab";

const NAV_LIST = ASSET_THEME.tabList2;
const NAV_TRIGGER = ASSET_THEME.tabTrigger2;

// 공통 유틸 — 각 탭 파일에서 import
export function assignColors(items: { value: number }[]): string[] {
  if (items.length === 0) return [];
  const maxIdx = items.reduce((mi, it, i) => (it.value > items[mi].value ? i : mi), 0);
  let si = 0;
  return items.map((_, i) => (i === maxIdx ? MAIN_PALETTE[0] : MAIN_PALETTE[1 + (si++) % 9]));
}

export function getMultiplier(currency: string | undefined, exchangeRates: { USD: number; JPY: number }): number {
  if (currency === "USD") return exchangeRates.USD;
  if (currency === "JPY") return exchangeRates.JPY / 100;
  return 1;
}

export function formatCurrencyDisplay(value: number, currency = "KRW"): string {
  if (currency === "USD") return `$${value.toLocaleString(undefined, { maximumFractionDigits: 3 })}`;
  if (currency === "JPY") return `¥${value.toLocaleString(undefined, { maximumFractionDigits: 3 })}`;
  return formatCurrency(value);
}

/**
 * 주식 종목의 매입 시 환율(단위당 원화 환산율)을 반환합니다.
 * purchaseExchangeRate가 없으면 현재 환율로 fallback.
 */
export function getPurchaseRatePerUnit(
  stock: Pick<Stock, "purchaseExchangeRate" | "currency">,
  currentMultiplier: number,
): number {
  if (!stock.purchaseExchangeRate || stock.purchaseExchangeRate <= 0) return currentMultiplier;
  return stock.currency === "JPY" ? stock.purchaseExchangeRate / 100 : stock.purchaseExchangeRate;
}

const DETAIL_TABS = [
  { value: "stocks", label: "주식", icon: TrendingUp },
  { value: "real-estate", label: "부동산", icon: Building2 },
  { value: "crypto", label: "암호화폐", icon: Bitcoin },
  { value: "cash", label: "현금", icon: Banknote },
  { value: "loans", label: "대출", icon: CreditCard },
] as const;

export function AssetDetailTabs() {
  const [activeTab, setActiveTab] = useState("stocks");

  useEffect(() => {
    const handler = (e: Event) => {
      const tab = (e as CustomEvent<{ tab: string }>).detail?.tab;
      if (tab) setActiveTab(tab);
    };
    window.addEventListener("navigate-to-tab", handler);
    return () => window.removeEventListener("navigate-to-tab", handler);
  }, []);

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab}>
      <TabsList className={NAV_LIST}>
        {DETAIL_TABS.map(({ value, label, icon: Icon }) => (
          <TabsTrigger key={value} value={value} className={NAV_TRIGGER}>
            <Icon className="size-3 shrink-0" />
            {label}
          </TabsTrigger>
        ))}
      </TabsList>

      <TabsContent value="stocks" forceMount className="data-[state=inactive]:hidden">
        <StockTab />
      </TabsContent>
      <TabsContent value="real-estate" forceMount className="data-[state=inactive]:hidden">
        <RealEstateTab />
      </TabsContent>
      <TabsContent value="crypto" forceMount className="data-[state=inactive]:hidden">
        <CryptoTab />
      </TabsContent>
      <TabsContent value="cash" forceMount className="data-[state=inactive]:hidden">
        <CashTab />
      </TabsContent>
      <TabsContent value="loans" forceMount className="data-[state=inactive]:hidden">
        <LoanTab />
      </TabsContent>
    </Tabs>
  );
}
