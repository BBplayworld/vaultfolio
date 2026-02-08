"use client";

import { Building2, TrendingUp, Bitcoin, Wallet, CreditCard, Banknote } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAssetData } from "@/hooks/use-asset-data";
import { formatCurrency, formatShortCurrency } from "@/lib/number-utils";
import { ASSET_THEME, getProfitLossColor } from "@/config/theme";

export function AssetOverviewCards() {
  const { getAssetSummary } = useAssetData();
  const summary = getAssetSummary();

  return (
    <div className="grid grid-cols-1 gap-4 *:data-[slot=card]:shadow-xs sm:grid-cols-2 xl:grid-cols-6">
      <Card className={`${ASSET_THEME.primary.border} ${ASSET_THEME.primary.bgLight} ring-2 ${ASSET_THEME.primary.ring}`}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className={`text-base font-bold ${ASSET_THEME.primary.text}`}>순자산</CardTitle>
            <Banknote className={`size-5 ${ASSET_THEME.primary.text}`} />
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            <p className={`text-3xl font-extrabold ${ASSET_THEME.secondary.text}`}>{formatShortCurrency(summary.netAsset)}</p>
            <div className="flex flex-col gap-0.5 text-xs">
              <span className={`font-medium ${ASSET_THEME.text.muted}`}>총자산 - 대출 - 보증금</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium">부동산</CardTitle>
            <Building2 className={`size-4 ${ASSET_THEME.text.muted}`} />
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            <p className="text-2xl font-bold">{formatShortCurrency(summary.realEstateValue)}</p>
            <div className="flex items-center justify-between text-xs">
              <span className={ASSET_THEME.text.muted}>{summary.realEstateCount}개 보유</span>
              <span className={`font-medium ${getProfitLossColor(summary.realEstateProfit)}`}>
                {summary.realEstateProfit >= 0 ? "+" : ""}
                {formatShortCurrency(Math.abs(summary.realEstateProfit))}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium">주식</CardTitle>
            <TrendingUp className={`size-4 ${ASSET_THEME.text.muted}`} />
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            <p className="text-2xl font-bold">{formatShortCurrency(summary.stockValue)}</p>
            <div className="flex items-center justify-between text-xs">
              <span className={ASSET_THEME.text.muted}>{summary.stockCount}개 보유</span>
              <span className={`font-medium ${getProfitLossColor(summary.stockProfit)}`}>
                {summary.stockProfit >= 0 ? "+" : ""}
                {formatShortCurrency(Math.abs(summary.stockProfit))}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium">암호화폐</CardTitle>
            <Bitcoin className={`size-4 ${ASSET_THEME.text.muted}`} />
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            <p className="text-2xl font-bold">{formatShortCurrency(summary.cryptoValue)}</p>
            <div className="flex items-center justify-between text-xs">
              <span className={ASSET_THEME.text.muted}>{summary.cryptoCount}개 보유</span>
              <span className={`font-medium ${getProfitLossColor(summary.cryptoProfit)}`}>
                {summary.cryptoProfit >= 0 ? "+" : "-"}
                {formatShortCurrency(Math.abs(summary.cryptoProfit))}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium">대출</CardTitle>
            <CreditCard className={`size-4 ${ASSET_THEME.text.muted}`} />
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            <p className={`text-2xl font-bold ${ASSET_THEME.loss.light}`}>
              {summary.loanBalance > 0 ? "-" : ""}
              {formatShortCurrency(summary.loanBalance)}
            </p>
            <div className="flex items-center justify-between text-xs">
              <span className={ASSET_THEME.text.muted}>{summary.loanCount}건 보유</span>
              <span className={`font-medium ${ASSET_THEME.text.muted}`}>총 잔액</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium">임차인 보증금</CardTitle>
            <Wallet className={`size-4 ${ASSET_THEME.text.muted}`} />
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            <p className={`text-2xl font-bold ${ASSET_THEME.loss.light}`}>
              {summary.tenantDepositTotal > 0 ? "-" : ""}
              {formatShortCurrency(summary.tenantDepositTotal)}
            </p>
            <div className="flex items-center justify-between text-xs">
              <span className={ASSET_THEME.text.muted}>부동산 임대</span>
              <span className={`font-medium ${ASSET_THEME.text.muted}`}>돌려줄 금액</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
