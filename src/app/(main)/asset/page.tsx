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
import { Info, Database, Sparkles, Activity } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";

export default function Page() {
  const isMobile = useIsMobile();

  return (
    <div className="flex flex-col gap-4 md:gap-6">

      {
        (
          <Alert className="border-primary/30 bg-gradient-to-r from-primary/5 to-primary/10">
            <Info className="size-5 text-primary" />
            <AlertTitle className="text-base font-semibold text-primary mb-2">
              개인 자산 관리 시스템
            </AlertTitle>
            <AlertDescription className="space-y-1.5 text-xs sm:text-sm">
              <div className="flex items-start gap-2">
                <Database className="size-4 text-primary flex-shrink-0 mt-0.5" />
                <span className="text-foreground">
                  로그인·서버 저장 없이{" "}
                  <span className="font-medium text-rose-500">이 브라우저에만</span> 데이터가 안전하게 보관됩니다.{" "}
                  혼자 사용한다면 본인 기기에서만, 부부·가족이 함께 관리한다면{" "}
                  <span className="font-medium text-rose-500">'공유 URL 복사'</span>로 PIN 암호화된 자산 현황을 파트너에게 안전하게 전달할 수 있습니다.{" "}
                  <span className="text-muted-foreground text-xs">(짧은 URL 사용 시에만 PIN 암호화 데이터가 공유 서버에 30일 임시 보관됩니다)</span>
                </span>
              </div>
              <div className="flex items-start gap-2">
                <Sparkles className="size-4 text-primary flex-shrink-0 mt-0.5" />
                <span className="text-foreground">
                  상단 <span className="font-medium text-rose-500">자산 관리 메뉴</span>에서 데이터 내보내기·가져오기, 공유 URL 생성,
                  그리고 현재 보유 자산을 정리해 Grok·Gemini·GPT 등 AI에게 직접 분석을 요청할 수 있는{" "}
                  <span className="font-medium text-rose-500">AI 평가용 프롬프트</span> 기능을 제공합니다.
                </span>
              </div>
              <div className="flex items-start gap-2">
                <Activity className="size-4 text-primary flex-shrink-0 mt-0.5" />
                <span className="text-foreground">
                  보유 <span className="font-medium text-rose-500">주식 현재가와 환율(USD·JPY)</span>은{" "}
                  매일 자동으로 최신 정보를 불러옵니다.
                </span>
              </div>
            </AlertDescription>
          </Alert>
        )
      }

      <div className="flex flex-col gap-4 md:gap-6 w-full">
        <AssetOverviewCards />
        <AssetDistributionCards />
        <div className="flex flex-col gap-2">
          <ExchangeRateInput />
        </div>
        <YearlyNetAssetChart />
      </div>

      <Tabs defaultValue="real-estate" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="real-estate">부동산</TabsTrigger>
          <TabsTrigger value="stocks">주식</TabsTrigger>
          <TabsTrigger value="crypto">코인</TabsTrigger>
          <TabsTrigger value="cash">현금</TabsTrigger>
          <TabsTrigger value="loans">대출</TabsTrigger>
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
    </div >
  );
}
