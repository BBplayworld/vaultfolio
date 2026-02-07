"use client";

import { Building2, TrendingUp, Bitcoin, Wallet, CreditCard, TrendingDown } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAssetData } from "@/hooks/use-asset-data";
import { formatCurrency, formatShortCurrency } from "@/lib/number-utils";

export function AssetOverviewCards() {
  const { getAssetSummary } = useAssetData();
  const summary = getAssetSummary();

  return (
    <div className="grid grid-cols-1 gap-4 *:data-[slot=card]:shadow-xs sm:grid-cols-2 xl:grid-cols-6">
      <Card className="border-primary/50 bg-primary/5">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium">순자산</CardTitle>
            <TrendingDown className="text-muted-foreground size-4" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            <p className="text-2xl font-bold">{formatShortCurrency(summary.netAsset)}</p>
            <div className="flex flex-col gap-0.5 text-xs">
              <span className="text-muted-foreground">{formatCurrency(summary.netAsset)}</span>
              <span className="font-medium text-muted-foreground">총자산 - 대출 - 보증금</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium">부동산</CardTitle>
            <Building2 className="text-muted-foreground size-4" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            <p className="text-2xl font-bold">{formatShortCurrency(summary.realEstateValue)}</p>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">{summary.realEstateCount}개 보유</span>
              <span
                className={`font-medium ${summary.realEstateProfit >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}
              >
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
            <TrendingUp className="text-muted-foreground size-4" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            <p className="text-2xl font-bold">{formatShortCurrency(summary.stockValue)}</p>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">{summary.stockCount}개 보유</span>
              <span
                className={`font-medium ${summary.stockProfit >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}
              >
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
            <Bitcoin className="text-muted-foreground size-4" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            <p className="text-2xl font-bold">{formatShortCurrency(summary.cryptoValue)}</p>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">{summary.cryptoCount}개 보유</span>
              <span
                className={`font-medium ${summary.cryptoProfit >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}
              >
                {summary.cryptoProfit >= 0 ? "+" : ""}
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
            <CreditCard className="text-muted-foreground size-4" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            <p className="text-2xl font-bold text-rose-600 dark:text-rose-400">
              -{formatShortCurrency(summary.loanBalance)}
            </p>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">{summary.loanCount}건 보유</span>
              <span className="font-medium text-muted-foreground">잔액</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium">임차인 보증금</CardTitle>
            <Wallet className="text-muted-foreground size-4" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">
              -{formatShortCurrency(summary.tenantDepositTotal)}
            </p>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">부동산 임대</span>
              <span className="font-medium text-muted-foreground">돌려줄 금액</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
