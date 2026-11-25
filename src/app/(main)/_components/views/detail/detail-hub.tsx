"use client";

import { TrendingUp, Building2, Bitcoin, Wallet, CreditCard, Gem, Receipt, ChevronRight, Plus } from "lucide-react";
import { useAssetData } from "@/contexts/asset-data-context";
import { formatShortCurrency, formatPriceByMode } from "@/lib/number-utils";
import { taxEntryLine } from "@/lib/tax-utils";
import { ASSET_THEME, PAGE_TITLE } from "@/config/theme";
import { profitTone } from "./detail-summary-header";
import { useAssetNavigation, type DetailTab } from "../../layout/navigation/navigation-context";
import { KpiCard } from "../../layout/ui/kpi-card";
import { HubShareButton } from "../../layout/ui/hub-share-button";

type AddCategory = "stock" | "real-estate" | "crypto" | "cash" | "loan";

// '추가하기' 줄 후보 — 순서 고정(주식→부동산→암호화폐→현금→대출). 실물은 입구가 FAB뿐이라 넣지 않는다(#290)
const ADD_CHIPS: ReadonlyArray<{ category: AddCategory; label: string }> = [
  { category: "stock", label: "주식" },
  { category: "real-estate", label: "부동산" },
  { category: "crypto", label: "암호화폐" },
  { category: "cash", label: "현금" },
  { category: "loan", label: "대출" },
];

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

  // 보유 판정 = 카드 onClick과 같은 기준. 6종 모두 0건이면(자산 0·빈 체험) 현행 0건 카드 5장 + 줄 없음, 하나라도 있으면 0건 카드는 빼고 맨 아래 한 줄로 모은다(#290)
  const held: Record<AddCategory, boolean> = {
    stock: s.stockCount > 0,
    "real-estate": s.realEstateCount > 0,
    crypto: s.cryptoCount > 0,
    cash: s.cashCount > 0,
    loan: assetData.loans.length > 0,
  };
  const hasAny = s.physicalCount > 0 || Object.values(held).some(Boolean);
  const show = (c: AddCategory) => !hasAny || held[c];
  const addChips = hasAny ? ADD_CHIPS.filter((c) => !held[c.category]) : [];

  return (
    <div className={`flex flex-col gap-3 sm:gap-4 ${ASSET_THEME.contentPad} motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-3 motion-safe:duration-500`}>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h2 className={PAGE_TITLE}>상세</h2>
        </div>
        <HubShareButton />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
        {show("stock") && (
          <KpiCard
            icon={TrendingUp}
            title="주식"
            primary={formatPriceByMode(s.stockValue)}
            primaryClassName={ASSET_THEME.text.default}
            secondary={s.stockCount > 0
              ? profitLine(s.stockProfit, s.stockCost > 0 ? (s.stockProfit / s.stockCost) * 100 : null)
              : countLine(0, "개")}
            onClick={() => s.stockCount > 0 ? go("stocks") : openAdd("stock")}
          />
        )}

        {show("real-estate") && (
          <KpiCard
            icon={Building2}
            title="부동산"
            primary={formatPriceByMode(s.realEstateValue)}
            primaryClassName={ASSET_THEME.text.default}
            secondary={s.realEstateCount > 0
              ? profitLine(s.realEstateProfit, s.realEstateCost > 0 ? (s.realEstateProfit / s.realEstateCost) * 100 : null)
              : countLine(0, "건")}
            onClick={() => s.realEstateCount > 0 ? go("real-estate") : openAdd("real-estate")}
          />
        )}

        {show("crypto") && (
          <KpiCard
            icon={Bitcoin}
            title="암호화폐"
            primary={formatPriceByMode(s.cryptoValue)}
            primaryClassName={ASSET_THEME.text.default}
            secondary={s.cryptoCount > 0
              ? profitLine(s.cryptoProfit, s.cryptoCost > 0 ? (s.cryptoProfit / s.cryptoCost) * 100 : null)
              : countLine(0, "개")}
            onClick={() => s.cryptoCount ? go("crypto") : openAdd("crypto")}
          />
        )}

        {show("cash") && (
          <KpiCard
            icon={Wallet}
            title="현금"
            primary={formatPriceByMode(s.cashValue)}
            primaryClassName={ASSET_THEME.text.default}
            secondary={countLine(s.cashCount, "건")}
            onClick={() => s.cashCount > 0 ? go("cash") : openAdd("cash")}
          />
        )}

        {/* 실물 자산(#58) — 0건이면 숨김(진입은 FAB 시트). 손익 비율은 매입가 0이면 생략 */}
        {s.physicalCount > 0 && (
          <div data-testid="detail-hub-card-physical" className="contents">
            <KpiCard
              icon={Gem}
              title="실물 자산"
              primary={formatPriceByMode(s.physicalValue)}
              primaryClassName={ASSET_THEME.text.default}
              secondary={profitLine(s.physicalProfit, s.physicalCost > 0 ? (s.physicalProfit / s.physicalCost) * 100 : null)}
              onClick={() => go("physical")}
            />
          </div>
        )}

        {show("loan") && (
          <KpiCard
            icon={CreditCard}
            title="대출"
            primary={formatPriceByMode(s.loanBalance)}
            primaryClassName={ASSET_THEME.text.default}
            secondary={countLine(s.loanCount, "건")}
            onClick={() => assetData.loans.length > 0 ? go("loans") : openAdd("loan")}
          />
        )}
        {/* 0건 자산군 추가 줄(#290) — 보유 카드 뒤·세금 행 앞, 그리드 전체 폭. 캡처에는 찍지 않는다 */}
        {addChips.length > 0 && (
          <div data-testid="hub-add-row" data-screenshot-hide role="group" aria-label="자산 추가" className="col-span-full flex flex-wrap items-center gap-x-2 gap-y-2 px-1">
            <span className="mr-1 whitespace-nowrap text-sm font-semibold text-muted-foreground">추가하기</span>
            {addChips.map((c) => (
              <button
                key={c.category}
                type="button"
                data-testid={`hub-add-chip-${c.category}`}
                aria-label={`${c.label} 추가`}
                onClick={() => openAdd(c.category)}
                className="inline-flex min-h-10 items-center gap-1 rounded-full bg-card px-3.5 text-sm font-medium text-foreground shadow-xs outline-none hover:bg-accent/50 focus-visible:ring-2 focus-visible:ring-ring/50 active:scale-[0.96] motion-safe:transition-[background-color,transform] motion-safe:duration-150"
              >
                <Plus aria-hidden className="size-3.5 text-muted-foreground" />
                {c.label}
              </button>
            ))}
          </div>
        )}
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
