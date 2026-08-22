"use client";

import { Pencil, Trash2, MapPin, CreditCard, ChevronDown, Building2, Clock, Calendar } from "lucide-react";
import { toast } from "sonner";
import { useState, useMemo, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { InlineSelector } from "../../../layout/ui/inline-selector";
import { useAssetData } from "@/contexts/asset-data-context";
import { formatHoldingPeriod, formatPriceByMode, formatArea } from "@/lib/number-utils";
import { ASSET_THEME, MAIN_PALETTE, getProfitLossColor } from "@/config/theme";
import { realEstateTypes, realEstateTradeDataset } from "@/config/asset-options";
import { formatFullAddress } from "@/lib/realestate/real-estate-address";
import { GradeBadge } from "../../../forms/asset-update/input/real-estate-input";
import { assignColors } from "../asset-detail-tabs";
import { DetailSummaryHeader, ProfitMetric } from "../detail-summary-header";
import { AnnualizedReturn } from "../annualized-return";
import { RealEstate, Loan } from "@/types/asset";

const RE_CATEGORY_TABS = [
  { value: "all", label: "전체" },
  ...realEstateTypes.map(({ value, shortLabel }) => ({ value, label: shortLabel })),
] as const;

// 실투자금(내 돈) 기준 성과 — 갭투자·담보대출을 감안한 레버리지 수익률과 LTV
function computeEquityMetrics(item: RealEstate, linkedLoans: Loan[], profit: number) {
  const deposit = item.tenantDeposit ?? 0;
  const loanBalance = linkedLoans.reduce((sum, l) => sum + l.balance, 0);
  const leverageTotal = deposit + loanBalance;
  const actualInvested = item.purchasePrice - leverageTotal;
  return {
    leverageTotal,
    actualInvested,
    equityReturnRate: actualInvested > 0 ? (profit / actualInvested) * 100 : 0,
    ltv: item.currentValue > 0 && loanBalance > 0 ? (loanBalance / item.currentValue) * 100 : null,
  };
}

function RealEstateCard({ item, profit, profitRate, pct, color, typeLabel, linkedLoans, onDelete }: {
  item: RealEstate; profit: number; profitRate: number; pct: number; color: string;
  typeLabel: string; linkedLoans: Loan[]; onDelete: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const equity = computeEquityMetrics(item, linkedLoans, profit);
  // 종류별 면적 명칭(전용면적/연면적/건물면적) — 서로 다른 면적을 같은 이름으로 부르지 않는다
  const datasetInfo = realEstateTradeDataset[item.type];
  const areaLabel = datasetInfo?.areaLabel ?? "면적";
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="mb-2">
      <div className={ASSET_THEME.cardWrapper}>
        <div className={ASSET_THEME.cardHeader}>
          <CollapsibleTrigger asChild>
            <button className={ASSET_THEME.cardTriggerButton}>
              <div className="size-6 sm:size-7 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: color }}>
                <Building2 className="size-3.5 sm:size-4 text-white" />
              </div>
              <div className={ASSET_THEME.cardInfoLeft}>
                <div className={ASSET_THEME.cardInfoTitle}>
                  <span className={ASSET_THEME.cardInfoName}>{item.name}</span>
                </div>
                <div className={ASSET_THEME.cardInfoMeta}>
                  <span className="text-sm font-semibold text-primary">{pct.toFixed(1)}%</span>
                </div>
              </div>
              <div className={ASSET_THEME.cardInfoRight}>
                <p className={`${ASSET_THEME.cardAmountMain} ${ASSET_THEME.text.default}`}>{formatPriceByMode(item.currentValue)}</p>
                <div className={ASSET_THEME.cardAmountProfitRow}>
                  <p className={`${ASSET_THEME.cardAmountSub} ${getProfitLossColor(profit)}`}>{profit >= 0 ? "+" : ""}{formatPriceByMode(profit)}</p>
                  <p className={`${ASSET_THEME.cardAmountRate} ${getProfitLossColor(profit)}`}>({profitRate >= 0 ? "+" : ""}{profitRate.toFixed(1)}%)</p>
                </div>
              </div>
              <ChevronDown className={`size-3.5 sm:size-4 text-muted-foreground flex-shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
            </button>
          </CollapsibleTrigger>
        </div>
        <div className="h-0.5 w-full bg-muted">
          <div className="h-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
        </div>
        {!open && <div className="h-1.5 bg-gradient-to-b from-muted/30 to-muted/5" />}
        <CollapsibleContent>
          <div className={ASSET_THEME.cardExpandBox}>
            <div className={`grid grid-cols-2 sm:grid-cols-4 px-4 py-2.5 gap-4 ${ASSET_THEME.cardSection}`}>
              <div>
                <p className={ASSET_THEME.cardDetailLabel}>종류</p>
                <p className={ASSET_THEME.cardDetailValue}>{typeLabel}</p>
              </div>
              <div>
                <p className={ASSET_THEME.cardDetailLabel}>매입가</p>
                <p className={`${ASSET_THEME.cardDetailValue} tabular-nums`}>{formatPriceByMode(item.purchasePrice)}</p>
              </div>
              <div>
                <p className={ASSET_THEME.cardDetailLabel}>실거래가</p>
                <p className={`${ASSET_THEME.cardDetailValueBold} tabular-nums`} style={{ color: "var(--accent-teal)" }}>{formatPriceByMode(item.currentValue)}</p>
              </div>
              <div>
                <p className={ASSET_THEME.cardDetailLabel}>평가손익</p>
                <p className={`${ASSET_THEME.cardDetailValueBold} tabular-nums ${getProfitLossColor(profit)}`}>{profit >= 0 ? "+" : ""}{formatPriceByMode(profit)}</p>
              </div>
              {/* 실거래 추정 시세 (S-4.21) — currentValue와 병기, 참고 톤(muted).
                  모바일은 라벨(뱃지+info 포함)이 다른 셀보다 길어 반폭(grid-cols-2)에서 잘리므로 전폭 사용 */}
              {item.marketEstimate && item.marketEstimate > 0 && (
                <div className="col-span-2 sm:col-span-1">
                  <p className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1">
                    <span className={ASSET_THEME.cardDetailLabel}>실거래 추정</span>
                    <GradeBadge
                      grade={item.marketEstimateGrade}
                      detail={
                        <>
                          {item.marketEstimateSource && <p>매칭기준 {item.marketEstimateSource}</p>}
                          {item.marketEstimateSampleCount ? <p>유사 거래 {item.marketEstimateSampleCount}건</p> : null}
                        </>
                      }
                    />
                  </p>
                  <p className={`${ASSET_THEME.cardDetailValue} tabular-nums text-muted-foreground`}>{formatPriceByMode(item.marketEstimate)}</p>
                  {item.marketEstimateDate && (
                    <p className={ASSET_THEME.cardDetailMeta}>{item.marketEstimateDate} 기준</p>
                  )}
                </div>
              )}
              {(item.tenantDeposit ?? 0) > 0 && (
                <div>
                  <p className={ASSET_THEME.cardDetailLabel}>임차보증금</p>
                  <p className={`${ASSET_THEME.cardDetailValueBold} ${ASSET_THEME.liability} tabular-nums`}>{formatPriceByMode(item.tenantDeposit!)}</p>
                </div>
              )}
            </div>
            {/* 실거래 추정 근거 (S-4.21) — 실제 매칭된 거래 레코드 값 우선(검색 키와 다를 수 있음), 없으면 검색 키로 대체 */}
            {item.marketEstimate && item.marketEstimate > 0 && (
              (item.marketEstimateComplexName || item.complexName)
              || (item.marketEstimateLegalDong || item.legalDong)
              || item.marketEstimateArea || item.exclusiveArea || item.marketEstimateFloor !== undefined || item.marketEstimateSource
            ) && (
              <p className={`px-4 py-2 text-sm text-muted-foreground text-pretty ${ASSET_THEME.cardSectionMeta}`}>
                근거: {[
                  item.marketEstimateComplexName || item.complexName,
                  item.marketEstimateLegalDong || item.legalDong,
                  // 매칭된 거래의 면적 우선 — 사용자가 면적을 입력하지 않아도 근거 면적은 표시된다
                  (item.marketEstimateArea ?? item.exclusiveArea)
                    ? `${areaLabel} ${formatArea(item.marketEstimateArea ?? item.exclusiveArea!)}`
                    : undefined,
                  item.marketEstimateFloor !== undefined ? `${item.marketEstimateFloor}층` : undefined,
                ].filter(Boolean).join(" · ")}
              </p>
            )}
            {/* 실거래 추정 미확보 안내 (S-4.21 AC4) — 지원 종류인데 추정치가 없으면 원인별 CTA로 유도.
                수정 다이얼로그 안에서 주소 검색·면적 입력을 하므로 기존 trigger-edit-real-estate 이벤트를 재사용한다. */}
            {!(item.marketEstimate && item.marketEstimate > 0) && datasetInfo && (
              <div className={`flex flex-wrap items-center justify-between gap-2 px-4 py-2 ${ASSET_THEME.cardSectionMeta}`}>
                <p className="text-sm text-muted-foreground">
                  실거래 추정 · <span className="font-medium text-foreground">
                    {!item.regionCode
                      ? "주소 검색 필요"
                      : datasetInfo.matchBy === "area" && !item.exclusiveArea
                        ? `${areaLabel} 입력 필요`
                        : "실거래 매칭 실패"}
                  </span>
                </p>
                <Button
                  size="sm"
                  variant="secondary"
                  className="gap-1.5 shrink-0"
                  onClick={() => window.dispatchEvent(new CustomEvent("trigger-edit-real-estate", { detail: { id: item.id } }))}
                >
                  <Pencil className="size-3.5" />수정
                </Button>
              </div>
            )}
            {/* 실투자금 기준 성과 — 보증금·담보대출을 뺀 내 돈이 얼마나 일했는가 */}
            {equity.actualInvested > 0 && (equity.leverageTotal > 0) && (
              <div className={`grid grid-cols-2 sm:grid-cols-4 px-4 py-2.5 gap-4 ${ASSET_THEME.cardSection}`}>
                <div>
                  <p className={ASSET_THEME.cardDetailLabel}>실투자금</p>
                  <p className={`${ASSET_THEME.cardDetailValueBold} tabular-nums`}>{formatPriceByMode(equity.actualInvested)}</p>
                  <p className={ASSET_THEME.cardDetailMeta}>매입가 − 보증금 − 담보대출</p>
                </div>
                <div>
                  <p className={ASSET_THEME.cardDetailLabel}>실투자금 수익률</p>
                  <p className={`${ASSET_THEME.cardDetailValueBold} tabular-nums ${getProfitLossColor(equity.equityReturnRate)}`}>
                    {equity.equityReturnRate >= 0 ? "+" : ""}{equity.equityReturnRate.toFixed(1)}%
                  </p>
                  <p className={ASSET_THEME.cardDetailMeta}>레버리지 반영</p>
                </div>
                {equity.ltv !== null && (
                  <div>
                    <p className={ASSET_THEME.cardDetailLabel}>LTV</p>
                    <p className={`${ASSET_THEME.cardDetailValueBold} tabular-nums`}>{equity.ltv.toFixed(0)}%</p>
                    <p className={ASSET_THEME.cardDetailMeta}>담보대출 ÷ 실거래가</p>
                  </div>
                )}
              </div>
            )}
            <div className={ASSET_THEME.cardActions}>
              <Button size="icon" variant="secondary" className={ASSET_THEME.cardActionButton} title="수정" onClick={() => window.dispatchEvent(new CustomEvent("trigger-edit-real-estate", { detail: { id: item.id } }))}>
                <Pencil className="size-3.5" />
              </Button>
              <Button size="icon" variant="secondary" className={ASSET_THEME.cardActionButton} title="삭제" onClick={() => onDelete(item.id)}>
                <Trash2 className="size-3.5" />
              </Button>
            </div>
            {linkedLoans.length > 0 && (
              <div className="px-4 py-2.5 space-y-1.5">
                <p className="text-sm font-bold text-muted-foreground flex items-center gap-1"><CreditCard className="size-3" />담보대출</p>
                {linkedLoans.map((loan) => (
                  <div key={loan.id} className="flex items-center justify-between px-2.5 py-1.5 text-sm rounded-md bg-muted/30">
                    <span className={ASSET_THEME.cardLoanName}>{loan.name}</span>
                    <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                      <span className={`font-bold tabular-nums ${ASSET_THEME.liability}`}>-{formatPriceByMode(loan.balance)}</span>
                      <span className={ASSET_THEME.cardLoanRate}>{loan.interestRate}%</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className={`px-4 py-2 flex flex-wrap gap-x-3 gap-y-1 text-sm text-muted-foreground ${ASSET_THEME.cardSectionMeta}`}>
              {item.purchaseDate && (
                <>
                  <span className="flex items-center gap-1"><Clock className="size-3" /><span className={`font-medium ${ASSET_THEME.text.default}`}>{formatHoldingPeriod(item.purchaseDate)} 보유</span></span>
                  <span className="flex items-center gap-1"><Calendar className="size-3" /><span className={`font-medium ${ASSET_THEME.text.default}`}>{item.purchaseDate} 매입</span></span>
                  <AnnualizedReturn totalRatePct={profitRate} sinceDate={item.purchaseDate} />
                </>
              )}
              {/* 주소 + 상세주소(동·호) — 말줄임하면 동·호수가 잘려 사라지므로 줄바꿈으로 전부 보여준다 */}
              {formatFullAddress(item) && (
                <span className="flex items-start gap-1 w-full"><MapPin className="size-3 flex-shrink-0 mt-1" /><span className="min-w-0 text-pretty break-keep">{formatFullAddress(item)}</span></span>
              )}
            </div>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

export function RealEstateTab() {
  const { assetData, deleteRealEstate, getAssetSummary } = useAssetData();
  const [activeCategory, setActiveCategory] = useState("all");
  const summary = getAssetSummary();

  const allSorted = [...assetData.realEstate].sort((a, b) => b.currentValue - a.currentValue);
  const totalValue = summary.realEstateValue;

  const visibleCategories = useMemo(() => {
    const activeTypes = new Set(allSorted.map((item) => item.type));
    return [
      { value: "all", label: "전체" },
      ...realEstateTypes
        .filter(({ value }) => activeTypes.has(value))
        .map(({ value, shortLabel }) => ({ value, label: shortLabel })),
    ];
  }, [allSorted]);

  useEffect(() => {
    if (!visibleCategories.some((tab) => tab.value === activeCategory)) {
      setActiveCategory("all");
    }
  }, [visibleCategories, activeCategory]);

  const reBarColors = assignColors(allSorted.map((item) => ({ value: item.currentValue })));
  const barItems = allSorted.map((item, idx) => ({ item, value: item.currentValue, color: reBarColors[idx] }));

  const filteredItems = activeCategory === "all"
    ? allSorted
    : allSorted.filter((item) => item.type === activeCategory);

  const displayValue = activeCategory === "all"
    ? totalValue
    : filteredItems.reduce((sum, item) => sum + item.currentValue, 0);

  const displayCost = activeCategory === "all"
    ? summary.realEstateCost
    : filteredItems.reduce((sum, item) => sum + item.purchasePrice, 0);

  const displayProfit = activeCategory === "all"
    ? summary.realEstateProfit
    : displayValue - displayCost;

  const handleDelete = (id: string) => {
    if (confirm("정말 삭제하시겠습니까?")) { deleteRealEstate(id); toast.success("삭제되었습니다."); }
  };

  const renderCard = (item: RealEstate) => {
    const idx = allSorted.findIndex((r) => r.id === item.id);
    const profit = item.currentValue - item.purchasePrice;
    const profitRate = item.purchasePrice > 0 ? (profit / item.purchasePrice) * 100 : 0;
    const pct = displayValue > 0 ? (item.currentValue / displayValue) * 100 : 0;
    const color = reBarColors[idx] ?? MAIN_PALETTE[0];
    const linkedLoans = assetData.loans.filter((l) => l.linkedRealEstateId === item.id);
    const typeLabel = realEstateTypes.find((t) => t.value === item.type)?.label ?? item.type;
    return (
      <RealEstateCard
        key={item.id}
        item={item} profit={profit} profitRate={profitRate} pct={pct} color={color} typeLabel={typeLabel}
        linkedLoans={linkedLoans} onDelete={handleDelete}
      />
    );
  };

  return (
    <Card className={ASSET_THEME.contentCard}>
      <CardHeader className={ASSET_THEME.contentPad}>
        <CardTitle>부동산</CardTitle>
      </CardHeader>
      <CardContent className={`space-y-4 ${ASSET_THEME.contentPad}`}>
        <DetailSummaryHeader
          label="총 부동산 평가금액"
          value={displayValue}
          valueClass={ASSET_THEME.text.default}
          inline={<ProfitMetric label="평가손익" profit={displayProfit} cost={displayCost} decimals={1} />}
        />

        <div className="flex justify-start">
          <InlineSelector
            value={activeCategory}
            onChange={setActiveCategory}
            options={visibleCategories}
            ariaLabel="부동산 카테고리 선택"
          />
        </div>

        <div className="space-y-3">
          {barItems.length > 0 && totalValue > 0 && (
            <div className="space-y-2">
              <div className="flex h-6 w-full rounded-full overflow-hidden gap-px">
                {barItems.map(({ item, value: v, color }) => {
                  const pct = (v / totalValue) * 100;
                  return (
                    <div key={item.id} className="overflow-hidden transition-all" style={{ width: `${pct}%`, backgroundColor: color }} title={`${item.name}: ${pct.toFixed(1)}%`} />
                  );
                })}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-2 px-2">
                {barItems.map(({ item, value: v, color }) => {
                  const pct = (v / totalValue) * 100;
                  return (
                    <div key={item.id} className="flex items-center gap-1 min-w-0">
                      <span className="size-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                      <span className="text-sm text-foreground truncate min-w-0">{item.name}</span>
                      <span className="text-sm font-bold shrink-0" style={{ color: color }}>{pct.toFixed(1)}%</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {filteredItems.length === 0 ? (
            <div className="flex h-36 items-center justify-center rounded-lg border border-dashed">
              <p className="text-muted-foreground text-sm">등록된 부동산이 없습니다.</p>
            </div>
          ) : activeCategory === "all" ? (
            <div className="space-y-4 mt-8">
              {visibleCategories.filter((c) => c.value !== "all").map((cat) => {
                const catItems = allSorted.filter((item) => item.type === cat.value);
                if (catItems.length === 0) return null;
                return (
                  <div key={cat.value}>
                    <p className="text-sm font-semibold text-muted-foreground px-1 pb-1.5">{cat.label}</p>
                    <div className="space-y-2">{catItems.map(renderCard)}</div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="space-y-2 mt-8">{filteredItems.map(renderCard)}</div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
