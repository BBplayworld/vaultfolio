"use client";

// 실물 자산(#58) 상세 탭 — real-estate-tab.tsx 구조를 복제·축소(카테고리 선택기·항목별 비중 막대 없음).
import { useState } from "react";
import { Pencil, Trash2, ChevronDown, Gem, Clock, Calendar } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useAssetData } from "@/contexts/asset-data-context";
import { formatHoldingPeriod, formatPriceByMode } from "@/lib/number-utils";
import { ASSET_THEME, MAIN_PALETTE, getProfitLossColor } from "@/config/theme";
import { physicalAssetTypes } from "@/config/asset-options";
import { dispatchAddPhysical } from "../../../layout/navigation/asset-dispatch";
import { useAssetNavigation } from "../../../layout/navigation/navigation-context";
import { DetailSummaryHeader, ProfitMetric } from "../detail-summary-header";
import type { PhysicalAsset } from "@/types/asset";

const COLOR = MAIN_PALETTE[8]; // 홈 도넛 실물 조각과 같은 고정색
const typeOf = (t: string) => physicalAssetTypes.find((x) => x.value === t) ?? physicalAssetTypes[4];

function PhysicalCard({ item, pct, onDelete }: { item: PhysicalAsset; pct: number; onDelete: (item: PhysicalAsset) => void }) {
  const [open, setOpen] = useState(false);
  const profit = item.currentValue - item.purchasePrice;
  const profitRate = item.purchasePrice > 0 ? (profit / item.purchasePrice) * 100 : 0;
  const color0 = profit === 0 ? "text-muted-foreground" : getProfitLossColor(profit); // 0은 빨강·파랑이 아니다
  const type = typeOf(item.type);
  return (
    <Collapsible open={open} onOpenChange={setOpen} className={`mb-2 dark:mb-0 ${ASSET_THEME.cardOpenDivider}`}>
      <div className={ASSET_THEME.cardWrapper} data-testid={`physical-card-${item.id}`} data-screenshot-hide>
        <div className={ASSET_THEME.cardHeader}>
          <CollapsibleTrigger asChild>
            <button className={ASSET_THEME.cardTriggerButton}>
              <div className="size-6 sm:size-7 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: COLOR }}>
                <Gem className="size-3.5 sm:size-4 text-white" />
              </div>
              <div className={`${ASSET_THEME.cardInfoLeft} min-w-0`}>
                <div className={`${ASSET_THEME.cardInfoTitle} min-w-0 flex-nowrap`}>
                  <span className={`${ASSET_THEME.cardInfoName} truncate min-w-0`}>{item.name}</span>
                </div>
                <div className={ASSET_THEME.cardInfoMeta}>
                  <span className="text-sm text-muted-foreground whitespace-nowrap">{type.shortLabel} · <span className="font-semibold text-primary tabular-nums">{pct.toFixed(1)}%</span></span>
                </div>
              </div>
              <div className={ASSET_THEME.cardInfoRight}>
                <p className={`${ASSET_THEME.cardAmountMain} ${ASSET_THEME.text.default} whitespace-nowrap`}>{formatPriceByMode(item.currentValue)}</p>
                <div className={ASSET_THEME.cardAmountProfitRow}>
                  <p className={`${ASSET_THEME.cardAmountSub} ${color0}`}>{profit > 0 ? "+" : ""}{formatPriceByMode(profit)}</p>
                  <p className={`${ASSET_THEME.cardAmountRate} ${color0}`}>({profitRate >= 0 ? "+" : ""}{profitRate.toFixed(1)}%)</p>
                </div>
              </div>
              <ChevronDown className={`size-3.5 sm:size-4 text-muted-foreground flex-shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
            </button>
          </CollapsibleTrigger>
        </div>
        <div className="h-0.5 w-full bg-muted dark:mx-4 dark:mb-3 dark:w-auto dark:rounded-full dark:overflow-hidden">
          <div className="h-full transition-[width]" style={{ width: `${pct}%`, backgroundColor: COLOR }} />
        </div>
        {!open && <div className="h-1.5 bg-muted/20 dark:hidden" />}
        <CollapsibleContent>
          <div className={ASSET_THEME.cardExpandBox}>
            <div className={`grid grid-cols-2 sm:grid-cols-4 px-4 py-2.5 gap-4 ${ASSET_THEME.cardSection}`}>
              <div>
                <p className={ASSET_THEME.cardDetailLabel}>종류</p>
                <p className={`${ASSET_THEME.cardDetailValue} break-keep`}>{type.label}</p>
              </div>
              <div>
                <p className={ASSET_THEME.cardDetailLabel}>매입가</p>
                <p className={`${ASSET_THEME.cardDetailValue} tabular-nums`}>{formatPriceByMode(item.purchasePrice)}</p>
              </div>
              <div>
                <p className={ASSET_THEME.cardDetailLabel}>매입일</p>
                <p className={`${ASSET_THEME.cardDetailValue} tabular-nums whitespace-nowrap`}>{item.purchaseDate || "-"}</p>
              </div>
              <div>
                <p className={ASSET_THEME.cardDetailLabel}>평가손익</p>
                <p className={`${ASSET_THEME.cardDetailValueBold} tabular-nums ${color0}`}>{profit > 0 ? "+" : ""}{formatPriceByMode(profit)}</p>
              </div>
              {item.description && (
                <div className="col-span-2 sm:col-span-4">
                  <p className={ASSET_THEME.cardDetailLabel}>메모</p>
                  <p className={`${ASSET_THEME.cardDetailValue} break-keep text-pretty`}>{item.description}</p>
                </div>
              )}
            </div>
            <div className={ASSET_THEME.cardActions}>
              <Button size="icon" variant="secondary" className={ASSET_THEME.cardActionButton} title="수정" aria-label={`${item.name} 수정`} data-testid={`physical-edit-${item.id}`}
                onClick={() => window.dispatchEvent(new CustomEvent("trigger-edit-physical", { detail: { id: item.id } }))}>
                <Pencil className="size-3.5" />
              </Button>
              <Button size="icon" variant="secondary" className={ASSET_THEME.cardActionButton} title="삭제" aria-label={`${item.name} 삭제`} data-testid={`physical-delete-${item.id}`}
                onClick={() => onDelete(item)}>
                <Trash2 className="size-3.5" />
              </Button>
            </div>
            {item.purchaseDate && (
              <div className={`px-4 py-2 flex flex-wrap gap-x-3 gap-y-1 text-sm text-muted-foreground ${ASSET_THEME.cardSectionMeta}`}>
                <span className="flex items-center gap-1"><Clock className="size-3" /><span className={`font-medium ${ASSET_THEME.text.default}`}>{formatHoldingPeriod(item.purchaseDate)} 보유</span></span>
                <span className="flex items-center gap-1"><Calendar className="size-3" /><span className={`font-medium ${ASSET_THEME.text.default}`}>{item.purchaseDate} 매입</span></span>
              </div>
            )}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

export function PhysicalTab() {
  const { assetData, deletePhysicalAsset, getAssetSummary } = useAssetData();
  const { navigate } = useAssetNavigation();
  const summary = getAssetSummary();
  const sorted = [...(assetData.physicalAssets ?? [])].sort((a, b) => b.currentValue - a.currentValue);
  const total = summary.physicalValue;

  const handleDelete = (item: PhysicalAsset) => {
    if (!confirm("이 실물 자산을 삭제할까요?")) return;
    const isLast = sorted.length === 1;
    deletePhysicalAsset(item.id);
    toast.success("삭제했어요.");
    if (isLast) navigate({ type: "detail", tab: "hub" }); // 빈 탭에 머물지 않고 허브로 복귀
  };

  return (
    <Card className={ASSET_THEME.contentCard} data-testid="physical-tab">
      <CardHeader className={ASSET_THEME.contentPad}>
        <CardTitle>실물 자산</CardTitle>
      </CardHeader>
      <CardContent className={`space-y-4 ${ASSET_THEME.contentPad}`}>
        <div data-testid="physical-total" data-screenshot-hide>
          <DetailSummaryHeader
            label="총 실물 평가액"
            value={total}
            valueClass={ASSET_THEME.text.default}
            inline={<ProfitMetric label="평가손익" profit={summary.physicalProfit} cost={summary.physicalCost} decimals={1} />}
          />
        </div>
        <p data-testid="physical-caption" className="text-xs text-muted-foreground break-keep text-pretty">
          평가액은 직접 입력한 값이에요. 시세에 따라 자동으로 바뀌지 않아요.
        </p>

        {sorted.length === 0 ? (
          <div data-testid="physical-empty" className="flex h-36 flex-col items-center justify-center gap-3 rounded-lg border border-dashed">
            <p className="text-muted-foreground text-sm break-keep">등록한 실물 자산이 없어요.</p>
            <Button variant="brand" size="sm" onClick={dispatchAddPhysical}>실물 자산 추가</Button>
          </div>
        ) : (
          <div data-testid="detail-list-box-physical" className={`space-y-2 mt-4 ${ASSET_THEME.listBox}`}>
            {sorted.map((item) => (
              <PhysicalCard key={item.id} item={item} pct={total > 0 ? (item.currentValue / total) * 100 : 0} onDelete={handleDelete} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
