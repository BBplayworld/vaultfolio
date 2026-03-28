"use client"

import { AssetOverviewCards } from "./_components/asset-overview-cards";
import { AssetDistributionCards } from "./_components/asset-distribution-cards";
import { YearlyNetAssetChart } from "./_components/yearly-net-asset-chart";
import { RealEstateInput } from "./_components/real-estate-input";
import { StockInput } from "./_components/stock-input";
import { CryptoInput } from "./_components/crypto-input";
import { ExchangeRateInput } from "./_components/exchange-rate-input";
import { CashInput } from "./_components/cash-input";
import { LoanInput } from "./_components/loan-input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Info, Database, Sparkles, Activity, Building2, TrendingUp, Bitcoin, Wallet, CreditCard, CircleChevronDown } from "lucide-react";
import { CopyrightFooter } from "./_components/copyright-footer";
import { APP_CONFIG } from "@/config";

export default function Page() {

  return (
    <div className="flex flex-col gap-4 md:gap-6">

      {
        (
          <Alert className="border-primary/30 bg-gradient-to-r from-primary/5 to-primary/10">
            <Info className="size-5 text-primary" />
            <AlertTitle className="text-base font-semibold text-primary mb-3">
              {APP_CONFIG.name} - 내 자산은 오직 내 브라우저에만
            </AlertTitle>
            <AlertDescription>
              <ul className="space-y-2.5 text-xs sm:text-sm">
                <li className="flex items-start gap-2">
                  <Database className="size-4 text-primary flex-shrink-0 mt-0.5" />
                  <span className="text-foreground leading-snug">
                    <span className="font-semibold text-primary">로그인·서버 저장 없음</span>
                    {"  —  "}
                    데이터는 <span className="font-medium text-rose-500">이 기기 브라우저</span>에만 보관되며 외부로 전송되지 않습니다.{" "}
                    <span className="font-medium text-rose-500">'공유 URL 복사'</span>로
                    PIN 암호화된 자산 현황을 가족·파트너와 안전하게 공유할 수 있습니다.{" "}
                    <span className="text-muted-foreground text-xs">
                      (짧은 URL 복사시 암호화 데이터가 서버에 30일 임시 보관되며, 동일 브라우저에서 재생성하면 이전 데이터는 자동으로 교체됩니다)
                    </span>
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <Sparkles className="size-4 text-primary flex-shrink-0 mt-0.5" />
                  <span className="text-foreground leading-snug">
                    <span className="font-semibold text-primary">AI 자산 분석</span>
                    {"  —  "}
                    상단{" "}
                    <span className="font-medium text-rose-500">자산 관리 메뉴</span>에서
                    Grok·Gemini·GPT에 바로 붙여넣을 수 있는{" "}
                    <span className="font-medium text-rose-500">AI 평가용 프롬프트</span>를 생성할 수 있습니다.{" "}
                    데이터 내보내기·가져오기를 지원합니다.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <Activity className="size-4 text-primary flex-shrink-0 mt-0.5" />
                  <span className="text-foreground leading-snug">
                    <span className="font-semibold text-primary">매일 자동 업데이트</span>
                    {"  —  "}
                    보유 <span className="font-medium text-rose-500">주식 현재가</span>와{" "}
                    <span className="font-medium text-rose-500">환율(USD·JPY)</span>을
                    매일 최신 정보로 자동 반영합니다.
                  </span>
                </li>
              </ul>
            </AlertDescription>
          </Alert>
        )
      }

      <div className="flex flex-col gap-4 md:gap-6 w-full">
        <AssetOverviewCards />
        <AssetDistributionCards />
      </div>

      <Tabs defaultValue="real-estate" className="w-full">
        <TabsList className="grid w-full grid-cols-5 h-auto p-1 gap-1">
          {(
            [
              { value: "real-estate", icon: Building2, label: "부동산" },
              { value: "stocks", icon: TrendingUp, label: "주식" },
              { value: "crypto", icon: Bitcoin, label: "암호화폐" },
              { value: "cash", icon: Wallet, label: "현금성 자산" },
              { value: "loans", icon: CreditCard, label: "대출" },
            ] as const
          ).map(({ value, icon: Icon, label }) => (
            <TabsTrigger
              key={value}
              value={value}
              className={[
                "bg-muted/60 text-muted-foreground border border-border py-2 cursor-pointer transition-all",
                "hover:bg-accent hover:text-foreground hover:border-primary/50",
                "data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:border-primary",
                "dark:data-[state=active]:bg-primary/30 dark:data-[state=active]:text-foreground dark:data-[state=active]:border-primary",
              ].join(" ")}
            >
              <Icon className="hidden sm:inline shrink-0 size-5" />
              <span className="text-xs sm:text-sm">{label}</span>
              <CircleChevronDown className="hidden sm:inline ml-auto size-3 sm:size-5 opacity-40 shrink-0" />
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="real-estate">
          <RealEstateInput />
        </TabsContent>
        <TabsContent value="stocks">
          <StockInput />
        </TabsContent>
        <TabsContent value="crypto">
          <CryptoInput />
        </TabsContent>
        <TabsContent value="cash">
          <CashInput />
        </TabsContent>
        <TabsContent value="loans">
          <LoanInput />
        </TabsContent>
      </Tabs>

      <div className="flex flex-col gap-2">
        <ExchangeRateInput />
      </div>
      <YearlyNetAssetChart />

      <CopyrightFooter />
    </div >
  );
}
