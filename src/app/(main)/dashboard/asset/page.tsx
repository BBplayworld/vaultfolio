import { AssetDataProvider } from "@/contexts/asset-data-context";
import { AssetOverviewCards } from "./_components/asset-overview-cards";
import { AssetDistributionCards } from "./_components/asset-distribution-cards";
import { YearlyNetAssetChart } from "./_components/yearly-net-asset-chart";
import { RealEstateInput } from "./_components/real-estate-input";
import { StockInput } from "./_components/stock-input";
import { CryptoInput } from "./_components/crypto-input";
import { LoanInput } from "./_components/loan-input";
import { AssetManagementCard } from "./_components/asset-management-card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ShieldCheck } from "lucide-react";

export default function Page() {
  return (
    <AssetDataProvider>
      <div className="flex flex-col gap-4 md:gap-6">
        {/* 로컬 저장 안내 배너 */}
        <Alert className="border-primary/50 bg-primary/5">
          <ShieldCheck className="size-4 text-primary" />
          <AlertDescription className="text-sm">
            <span className="font-semibold text-primary">100% 로컬 저장 시스템</span>
            <span className="text-muted-foreground">
              {" "}• 모든 데이터는 귀하의 브라우저에만 저장됩니다. 서버 전송 없음, 로그인 불필요.{" "}
            </span>
            <span className="text-muted-foreground">
              대략적인 순자산과 년도별 자산 변화를 간편하게 관리하세요.
            </span>
          </AlertDescription>
        </Alert>

        <AssetOverviewCards />
        <AssetDistributionCards />
        <YearlyNetAssetChart />
        <AssetManagementCard />

        <Tabs defaultValue="real-estate" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="real-estate">부동산</TabsTrigger>
            <TabsTrigger value="stocks">주식</TabsTrigger>
            <TabsTrigger value="crypto">코인</TabsTrigger>
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
          <TabsContent value="loans">
            <LoanInput />
          </TabsContent>
        </Tabs>
      </div>
    </AssetDataProvider>
  );
}
