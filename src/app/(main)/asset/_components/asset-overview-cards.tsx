"use client";

import { Gem, Building2, TrendingUp, Wallet, Bitcoin, CreditCard, House, Banknote } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAssetData } from "@/contexts/asset-data-context";
import { formatShortCurrency } from "@/lib/number-utils";
import { ASSET_THEME, getProfitLossColor } from "@/config/theme";

import { useIsMobile } from "@/hooks/use-mobile";

export function AssetOverviewCards() {
  const { getAssetSummary } = useAssetData();
  const summary = getAssetSummary();
  const isMobile = useIsMobile();

  return (
    <div className="grid grid-cols-1 gap-4 *:data-[slot=card]:shadow-xs sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
      <Card className={`border-2 ${ASSET_THEME.primary.border} ${ASSET_THEME.primary.bgLight}`}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className={`text-sm font-medium ${ASSET_THEME.primary.text}`}>순자산</CardTitle>
            <Gem className={`size-5 ${ASSET_THEME.primary.text}`} />
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            <p className={`text-3xl font-extrabold ${ASSET_THEME.important}`}>{formatShortCurrency(summary.netAsset)}</p>
            <div className="flex items-center justify-between text-xs">
              <span className={ASSET_THEME.text.muted}>총자산 - 총부채</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {!isMobile && (
        <>
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className={`text-sm font-medium ${ASSET_THEME.primary.text}`}>부동산</CardTitle>
                <Building2 className={`size-5 ${ASSET_THEME.text.muted}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                <p className="text-2xl font-bold">{formatShortCurrency(summary.realEstateValue)}</p>
                <div className="flex items-center justify-between text-xs">
                  <span className={ASSET_THEME.text.muted}>{summary.realEstateCount}개 보유</span>
                  {summary.realEstateProfit !== 0 && (
                    <span className={`font-semibold tabular-nums ${getProfitLossColor(summary.realEstateProfit)}`}>
                      {summary.realEstateProfit >= 0 ? "+" : ""}{formatShortCurrency(Math.round(summary.realEstateProfit))}
                    </span>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className={`text-sm font-medium ${ASSET_THEME.primary.text}`}>주식</CardTitle>
                <TrendingUp className={`size-5 ${ASSET_THEME.text.muted}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                <p className="text-2xl font-bold">{formatShortCurrency(summary.stockValue)}</p>
                <div className="flex items-center justify-between text-xs">
                  <span className={ASSET_THEME.text.muted}>{summary.stockCount}개 보유</span>
                  {summary.stockFxProfit !== 0 && (
                    <span className={`font-semibold tabular-nums ${getProfitLossColor(summary.stockFxProfit)}`}>
                      {summary.stockFxProfit >= 0 ? "+" : ""}{formatShortCurrency(Math.round(summary.stockFxProfit))}
                    </span>
                  )}
                </div>
                {summary.stockCurrencyGain !== 0 && (
                  <div className="flex items-center justify-between text-xs">
                    <span className={ASSET_THEME.text.muted}>환차손익</span>
                    <span className={`font-medium tabular-nums ${getProfitLossColor(summary.stockCurrencyGain)}`}>
                      {summary.stockCurrencyGain >= 0 ? "+" : ""}{formatShortCurrency(Math.round(summary.stockCurrencyGain))}
                    </span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className={`text-sm font-medium ${ASSET_THEME.primary.text}`}>암호화폐</CardTitle>
                <Bitcoin className={`size-5 ${ASSET_THEME.text.muted}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                <p className="text-2xl font-bold">{formatShortCurrency(summary.cryptoValue)}</p>
                <div className="flex items-center justify-between text-xs">
                  <span className={ASSET_THEME.text.muted}>{summary.cryptoCount}개 보유</span>
                  {summary.cryptoProfit !== 0 && (
                    <span className={`font-semibold tabular-nums ${getProfitLossColor(summary.cryptoProfit)}`}>
                      {summary.cryptoProfit >= 0 ? "+" : ""}{formatShortCurrency(Math.round(summary.cryptoProfit))}
                    </span>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className={`text-sm font-medium ${ASSET_THEME.primary.text}`}>현금</CardTitle>
                <Wallet className={`size-5 ${ASSET_THEME.text.muted}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                <p className="text-2xl font-bold">{formatShortCurrency(summary.cashValue)}</p>
                <div className="flex items-center justify-between text-xs">
                  <span className={ASSET_THEME.text.muted}>{summary.cashCount}개 보유</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className={`text-sm font-medium ${ASSET_THEME.primary.text}`}>대출</CardTitle>
                <CreditCard className={`size-5 ${ASSET_THEME.text.muted}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                <p className={`text-2xl font-bold ${ASSET_THEME.liability}`}>
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
                <CardTitle className={`text-sm font-medium ${ASSET_THEME.primary.text}`}>임차인 보증금</CardTitle>
                <House className={`size-5 ${ASSET_THEME.text.muted}`} />
                <Banknote className={`size-5 ${ASSET_THEME.text.muted}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                <p className={`text-2xl font-bold ${ASSET_THEME.liability}`}>
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
        </>
      )}
    </div>
  );
}
