"use client";

import { TrendingUp, Building2, Bitcoin, Wallet, CreditCard } from "lucide-react";
import { useAssetData } from "@/contexts/asset-data-context";
import { formatShortCurrency, formatPriceByMode } from "@/lib/number-utils";
import { ASSET_THEME, getProfitLossColor } from "@/config/theme";
import { useAssetNavigation, type DetailTab } from "../../layout/navigation/navigation-context";
import { KpiCard } from "../../layout/ui/kpi-card";

export function DetailHub() {
  const { getAssetSummary } = useAssetData();
  const s = getAssetSummary();
  const { navigate } = useAssetNavigation();

  const go = (tab: DetailTab) => navigate({ type: "detail", tab });

  const profitLine = (profit: number, rate: number | null) => (
    <span className={`font-semibold tabular-nums ${getProfitLossColor(profit)}`}>
      {profit >= 0 ? "+" : ""}{formatPriceByMode(profit)}
      {rate !== null && (
        <> ({profit >= 0 ? "+" : ""}{rate.toFixed(2)}%)</>
      )}
      <span className="text-muted-foreground font-normal ml-1.5">평가손익</span>
    </span>
  );

  const countLine = (count: number, unit: string) => (
    <span className="text-muted-foreground tabular-nums">{count}{unit}</span>
  );

  return (
    <div className={`flex flex-col gap-3 sm:gap-4 ${ASSET_THEME.contentPad} motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-3 motion-safe:duration-500`}>
      <div>
        <h2 className="text-base sm:text-lg lg:text-2xl font-bold text-foreground text-balance">상세</h2>
        <p className="text-xs lg:text-sm text-muted-foreground mt-0.5 text-pretty">자산 카테고리별 보유 현황을 자세히 확인하세요</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
        <KpiCard
          icon={TrendingUp}
          title="주식"
          description="국내·해외 보유 종목"
          primary={formatPriceByMode(s.stockValue)}
          primaryClassName={ASSET_THEME.text.default}
          secondary={s.stockCount > 0
            ? profitLine(s.stockProfit, s.stockCost > 0 ? (s.stockProfit / s.stockCost) * 100 : null)
            : countLine(0, "개")}
          onClick={() => s.stockCount > 0 ? go("stocks") : ''}
        />

        <KpiCard
          icon={Building2}
          title="부동산"
          description="보유 부동산"
          primary={formatPriceByMode(s.realEstateValue)}
          primaryClassName={ASSET_THEME.text.default}
          secondary={s.realEstateCount > 0
            ? profitLine(s.realEstateProfit, s.realEstateCost > 0 ? (s.realEstateProfit / s.realEstateCost) * 100 : null)
            : countLine(0, "건")}
          onClick={() => s.realEstateCount > 0 ? go("real-estate") : ''}
        />

        <KpiCard
          icon={Bitcoin}
          title="암호화폐"
          description="보유 코인"
          primary={formatPriceByMode(s.cryptoValue)}
          primaryClassName={ASSET_THEME.text.default}
          secondary={s.cryptoCount > 0
            ? profitLine(s.cryptoProfit, s.cryptoCost > 0 ? (s.cryptoProfit / s.cryptoCost) * 100 : null)
            : countLine(0, "개")}
          onClick={() => s.cryptoCount ? go("crypto") : ''}
        />

        <KpiCard
          icon={Wallet}
          title="현금"
          description="현금성 자산"
          primary={formatPriceByMode(s.cashValue)}
          primaryClassName={ASSET_THEME.text.default}
          secondary={countLine(s.cashCount, "건")}
          onClick={() => s.cashCount > 0 ? go("cash") : ''}
        />

        <KpiCard
          icon={CreditCard}
          title="대출"
          description="대출 잔액"
          primary={formatPriceByMode(s.loanBalance)}
          primaryClassName={ASSET_THEME.text.default}
          secondary={countLine(s.loanCount, "건")}
          onClick={() => s.loanCount ? go("loans") : ''}
        />
      </div>
    </div>
  );
}
