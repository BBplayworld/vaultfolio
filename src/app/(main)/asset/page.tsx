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
                  <span className="font-medium text-rose-500">로컬 브라우저 환경</span>에서 운영되는 개인 자산 관리 시스템입니다.
                  로그인 및 서버 저장 없이 당신의 브라우저에만 데이터가 안전하게 보관됩니다.
                </span>
              </div>
              <div className="flex items-start gap-2">
                <Sparkles className="size-4 text-primary flex-shrink-0 mt-0.5" />
                <span className="text-foreground">
                  상단 <span className="font-medium text-rose-500">데이터 및 설정 관리 메뉴</span>를 통해 데이터 가져오기/내보내기/공유하기 및 AI 평가용 자산 현황 정리 기능을 이용하실 수 있습니다.
                  <br />
                </span>
              </div>
              <div className="flex items-start gap-2">
                <Activity className="size-4 text-primary flex-shrink-0 mt-0.5" />
                <span className="text-foreground">
                  <span className="font-medium text-rose-500">환율, 주식 현재가</span>는 하루 단위로 자동 갱신 및 캐싱됩니다.
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
