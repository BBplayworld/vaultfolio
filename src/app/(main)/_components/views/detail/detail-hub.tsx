"use client";

import { TrendingUp, Building2, Bitcoin, Wallet, CreditCard, Gem, Receipt, ChevronRight } from "lucide-react";
import { useAssetData } from "@/contexts/asset-data-context";
import { formatShortCurrency, formatPriceByMode } from "@/lib/number-utils";
import { taxEntryLine } from "@/lib/tax-utils";
import { ASSET_THEME } from "@/config/theme";
import { profitTone } from "./detail-summary-header";
import { useAssetNavigation, type DetailTab } from "../../layout/navigation/navigation-context";
import { KpiCard } from "../../layout/ui/kpi-card";
import { HubShareButton } from "../../layout/ui/hub-share-button";

type AddCategory = "stock" | "real-estate" | "crypto" | "cash" | "loan";

export function DetailHub() {
  const { assetData, getAssetSummary } = useAssetData();
  const s = getAssetSummary();
  const { navigate } = useAssetNavigation();

  const taxLine = taxEntryLine(assetData);

  const go = (tab: DetailTab) => navigate({ type: "detail", tab });

  const profitLine = (profit: number, rate: number | null) => {
    const tone = profitTone(profit, rate ?? 0);
    return (
      <span data-testid="hub-profit" data-zero={tone.isZero} className={`font-semibold tabular-nums ${tone.colorClass}`}>
        {tone.sign}{formatPriceByMode(tone.amount)}
        {rate !== null && (
          <> ({tone.sign}{tone.rate.toFixed(2)}%)</>
        )}
        <span data-testid="hub-profit-label" className="text-muted-foreground font-medium ml-1.5 whitespace-nowrap">평가손익</span>
      </span>
    );
  };

  // 0건 카드는 눌러도 반응이 없던 문제(#4.85) — 보조 줄을 '추가하기'로 바꾸고 누르면 그 자산군 추가 시트(open-add-asset-sheet 재사용)
  const addLine = () => <span data-testid="hub-add-line" className="text-brand dark:text-indigo-300 font-medium">추가하기</span>;
  const openAdd = (category: AddCategory) => window.dispatchEvent(new CustomEvent("open-add-asset-sheet", { detail: { category } }));
  const countLine = (count: number, unit: string) =>
    count === 0 ? addLine() : <span className="text-muted-foreground font-medium tabular-nums">{count}{unit}</span>;

  return (
    <div className={`flex flex-col gap-3 sm:gap-4 ${ASSET_THEME.contentPad} motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-3 motion-safe:duration-500`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-base sm:text-lg lg:text-2xl font-bold text-foreground text-balance">상세</h2>
          <p className="text-sm text-muted-foreground mt-0.5 break-keep text-pretty">자산 카테고리별 보유 현황을 자세히 확인하세요</p>
        </div>
        <HubShareButton />
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
          onClick={() => s.stockCount > 0 ? go("stocks") : openAdd("stock")}
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
          onClick={() => s.realEstateCount > 0 ? go("real-estate") : openAdd("real-estate")}
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
          onClick={() => s.cryptoCount ? go("crypto") : openAdd("crypto")}
        />

        <KpiCard
          icon={Wallet}
          title="현금"
          description="현금성 자산"
          primary={formatPriceByMode(s.cashValue)}
          primaryClassName={ASSET_THEME.text.default}
          secondary={countLine(s.cashCount, "건")}
          onClick={() => s.cashCount > 0 ? go("cash") : openAdd("cash")}
        />

        {/* 실물 자산(#58) — 0건이면 숨김(진입은 FAB 시트). 손익 비율은 매입가 0이면 생략 */}
        {s.physicalCount > 0 && (
          <div data-testid="detail-hub-card-physical" className="contents">
            <KpiCard
              icon={Gem}
              title="실물 자산"
              description="금·은·귀금속 등 직접 보관 자산"
              primary={formatPriceByMode(s.physicalValue)}
              primaryClassName={ASSET_THEME.text.default}
              secondary={profitLine(s.physicalProfit, s.physicalCost > 0 ? (s.physicalProfit / s.physicalCost) * 100 : null)}
              onClick={() => go("physical")}
            />
          </div>
        )}

        <KpiCard
          icon={CreditCard}
          title="대출"
          description="대출 잔액"
          primary={formatPriceByMode(s.loanBalance)}
          primaryClassName={ASSET_THEME.text.default}
          secondary={countLine(s.loanCount, "건")}
          onClick={() => assetData.loans.length > 0 ? go("loans") : openAdd("loan")}
        />
        {/* 세금 관리 진입 행(4.89) — 더보기 '도구'에서 이동. ToolTile 가로형 변형, 보조줄은 내 자산 파생 일정 1건(홈 팁 닫기와 무관), 임박(0~6일)만 날짜 주황 */}
        <button
          type="button"
          data-testid="detail-hub-tax-row"
          data-screenshot-hide
          onClick={() => navigate({ type: "tax" })}
          className="flex min-h-16 min-w-0 items-center gap-3 rounded-xl bg-muted/50 px-4 py-3 text-left outline-none hover:bg-muted/70 focus-visible:ring-2 focus-visible:ring-ring/50 active:scale-[0.98] motion-safe:transition-[background-color,transform] motion-safe:duration-150 dark:bg-card dark:shadow-sm dark:hover:bg-muted/30 lg:col-span-2"
        >
          <Receipt aria-hidden className="size-5 shrink-0 text-primary" />
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="text-sm font-semibold text-foreground">세금 관리</span>
            <span data-testid="detail-hub-tax-sub" className="truncate text-sm text-muted-foreground">
              {taxLine ? (
                <>
                  <span className={taxLine.imminent ? "font-medium tabular-nums text-orange-600 dark:text-orange-400" : "tabular-nums"}>{taxLine.dueLabel}</span>
                  {" "}{taxLine.title}
                </>
              ) : "세금 일정과 연말 절세 시뮬레이션"}
            </span>
          </span>
          <ChevronRight aria-hidden className="size-4 shrink-0 text-muted-foreground" />
        </button>
      </div>
    </div>
  );
}
