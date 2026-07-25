"use client";

import { Pencil, Trash2, Calendar, Clock, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { InlineSelector } from "../../../layout/ui/inline-selector";
import { useAssetData } from "@/contexts/asset-data-context";
import { formatCurrency, formatShortCurrency, formatHoldingPeriod, formatPriceByMode } from "@/lib/number-utils";
import { ASSET_THEME, MAIN_PALETTE, getProfitLossColor } from "@/config/theme";
import { assignColors, groupCryptoBySymbol, mergeCryptoGroup } from "../asset-detail-tabs";
import { DetailSummaryHeader, ProfitMetric } from "../detail-summary-header";
import { Crypto } from "@/types/asset";

function computeCryptoMetrics(coin: Crypto) {
  const value = coin.quantity * coin.currentPrice;
  const cost = coin.quantity * coin.averagePrice;
  const profit = value - cost;
  const profitRate = cost > 0 ? (profit / cost) * 100 : 0;
  return { value, cost, profit, profitRate };
}

function SubCryptoCard({ coin, idx, onDelete }: { coin: Crypto; idx: number; onDelete: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const { value, cost, profit, profitRate } = computeCryptoMetrics(coin);
  const label = coin.exchange || `항목 ${idx + 1}`;
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className={ASSET_THEME.subCard}>
        <div className={`flex items-center gap-1 sm:gap-2 px-1.5 sm:px-3 py-2 ${ASSET_THEME.subCardHeader}`}>
          <CollapsibleTrigger asChild>
            <button className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0 text-left">
              <ChevronDown className={`size-3.5 sm:size-4 text-muted-foreground flex-shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
              <span className="text-sm font-semibold text-foreground truncate">{label}</span>
              <span className="text-sm text-foreground shrink-0 tabular-nums">{coin.quantity.toLocaleString(undefined, { maximumFractionDigits: 10 })}개</span>
              <div className="flex flex-col items-end ml-auto mr-2 sm:mr-4 shrink-0">
                <span className="text-sm font-medium text-foreground tabular-nums">{formatCurrency(Math.round(value))}</span>
                <span className={`text-sm font-bold tabular-nums ${getProfitLossColor(profit)}`}>
                  {profit >= 0 ? "+" : ""}{formatCurrency(Math.round(profit))} ({profitRate >= 0 ? "+" : ""}{profitRate.toFixed(1)}%)
                </span>
              </div>
            </button>
          </CollapsibleTrigger>
        </div>
        <CollapsibleContent>
          <div className={ASSET_THEME.cardExpandBox}>
            <div className={`grid grid-cols-2 sm:grid-cols-4 px-4 py-2.5 gap-4 ${ASSET_THEME.cardSection}`}>
              <div><p className={ASSET_THEME.cardDetailLabel}>매입가</p><p className={ASSET_THEME.cardDetailValue}>{formatCurrency(coin.averagePrice)}</p></div>
              <div><p className={ASSET_THEME.cardDetailLabel}>총 매입금액</p><p className={ASSET_THEME.cardDetailValue}>{formatCurrency(cost)}</p></div>
              <div><p className={ASSET_THEME.cardDetailLabel}>현재가</p><p className={ASSET_THEME.cardDetailValueBold} style={{ color: "var(--accent-teal)" }}>{formatCurrency(coin.currentPrice)}</p></div>
              <div><p className={ASSET_THEME.cardDetailLabel}>총 평가금액</p><p className={ASSET_THEME.cardDetailValueBold} style={{ color: "var(--accent-teal)" }}>{formatCurrency(value)}</p></div>
            </div>
            <div className={ASSET_THEME.cardActions}>
              <Button size="icon" variant="secondary" className={ASSET_THEME.cardActionButton} title="수정" onClick={() => window.dispatchEvent(new CustomEvent("trigger-edit-crypto", { detail: { id: coin.id } }))}>
                <Pencil className="size-3.5" />
              </Button>
              <Button size="icon" variant="secondary" className={ASSET_THEME.cardActionButton} title="삭제" onClick={() => {
                if (!confirm("정말 삭제하시겠습니까?")) return;
                onDelete(coin.id);
              }}>
                <Trash2 className="size-3.5" />
              </Button>
            </div>
            <div className="px-4 py-2 flex flex-wrap gap-x-3 gap-y-1 text-sm text-muted-foreground bg-muted/5">
              <span className="flex items-center gap-1"><Clock className="size-3" /><span className={`font-medium ${ASSET_THEME.text.default}`}>{formatHoldingPeriod(coin.purchaseDate)} 보유</span></span>
              <span className="flex items-center gap-1"><Calendar className="size-3" /><span className={`font-medium ${ASSET_THEME.text.default}`}>{coin.purchaseDate} 매수</span></span>
              {coin.description && <span className="w-full text-primary truncate"># {coin.description}</span>}
            </div>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

function CryptoCard({ coin, value, profit, profitRate, pct, color, onDelete, onDeleteGroup, groupItems, subItems }: {
  coin: { id: string; symbol?: string; name: string; quantity: number; averagePrice: number; currentPrice: number; purchaseDate: string; description?: string };
  value: number; profit: number; profitRate: number; pct: number; color: string;
  onDelete: (id: string) => void;
  onDeleteGroup?: (ids: string[]) => void;
  groupItems?: Crypto[];
  subItems?: Crypto[];
}) {
  const [open, setOpen] = useState(false);
  const hasSubItems = !!subItems && subItems.length > 0;
  const effectiveGroupItems = groupItems ?? [];
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="mb-2">
      <div className={ASSET_THEME.cardWrapper}>
        <div className={ASSET_THEME.cardHeader}>
          <CollapsibleTrigger asChild>
            <button className={ASSET_THEME.cardTriggerButton}>
              <div className="size-6 sm:size-7 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: color }}>
                <span className="text-[9px] sm:text-[10px] font-bold text-white">{(coin.symbol || coin.name).replace(/[^A-Za-z]/g, "").slice(0, 2).toUpperCase() || "?"}</span>
              </div>
              <div className={ASSET_THEME.cardInfoLeft}>
                <div className={ASSET_THEME.cardInfoTitle}>
                  <span className={ASSET_THEME.cardInfoName}>{coin.name}</span>
                  {coin.symbol && <span className="text-[10px] text-muted-foreground font-mono shrink-0">{coin.symbol}</span>}
                </div>
                <div className={ASSET_THEME.cardInfoMeta}>
                  <span className="text-sm text-foreground">{coin.quantity.toLocaleString(undefined, { maximumFractionDigits: 10 })}개</span>
                  <span className="text-sm text-muted-foreground">·</span>
                  <span className="text-sm font-semibold text-primary">{pct.toFixed(1)}%</span>
                </div>
              </div>
              <div className={ASSET_THEME.cardInfoRight}>
                <p className={`${ASSET_THEME.cardAmountMain} ${ASSET_THEME.text.default}`}>{formatPriceByMode(value)}</p>
                <div className={ASSET_THEME.cardAmountProfitRow}>
                  <p className={`${ASSET_THEME.cardAmountSub} ${getProfitLossColor(profit)}`}>{profit >= 0 ? "+" : ""}{formatPriceByMode(Math.round(profit))}</p>
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
            {/* 종합 — 거래소 분할 여부와 무관하게 병합 대표(coin)의 합산 상세를 항상 노출 (주식과 동일 형태) */}
            <div className={`flex items-start gap-2 px-4 py-2.5 ${ASSET_THEME.cardSection}`}>
              <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 min-w-0 flex-1">
                <span className="text-sm font-semibold text-foreground break-all">{coin.name}</span>
                {coin.symbol && <span className="text-sm font-mono font-medium text-muted-foreground">({coin.symbol})</span>}
              </div>
              <span className="text-sm text-foreground font-semibold shrink-0 whitespace-nowrap tabular-nums">총 {coin.quantity.toLocaleString(undefined, { maximumFractionDigits: 10 })}개</span>
            </div>
            <div className={`grid grid-cols-2 sm:grid-cols-4 px-4 py-2.5 gap-4 ${ASSET_THEME.cardSection}`}>
              <div><p className={ASSET_THEME.cardDetailLabel}>매입가</p><p className={ASSET_THEME.cardDetailValue}>{formatCurrency(coin.averagePrice)}</p></div>
              <div><p className={ASSET_THEME.cardDetailLabel}>총 매입금액</p><p className={ASSET_THEME.cardDetailValue}>{formatCurrency(coin.averagePrice * coin.quantity)}</p></div>
              <div><p className={ASSET_THEME.cardDetailLabel}>현재가</p><p className={ASSET_THEME.cardDetailValueBold} style={{ color: "var(--accent-teal)" }}>{formatCurrency(coin.currentPrice)}</p></div>
              <div><p className={ASSET_THEME.cardDetailLabel}>총 평가금액</p><p className={ASSET_THEME.cardDetailValueBold} style={{ color: "var(--accent-teal)" }}>{formatCurrency(coin.currentPrice * coin.quantity)}</p></div>
            </div>
            <div className={ASSET_THEME.cardActions}>
              <Button size="icon" variant="secondary" className={`${ASSET_THEME.cardActionButton}${hasSubItems && effectiveGroupItems.length > 1 ? " !opacity-20 cursor-not-allowed" : ""}`} disabled={hasSubItems && effectiveGroupItems.length > 1} title="수정" onClick={() => window.dispatchEvent(new CustomEvent("trigger-edit-crypto", { detail: { id: coin.id } }))}>
                <Pencil className="size-3.5" />
              </Button>
              <Button size="icon" variant="secondary" className={ASSET_THEME.cardActionButton} title="삭제" onClick={() => {
                if (!confirm("정말 삭제하시겠습니까?")) return;
                if (effectiveGroupItems.length <= 1) {
                  onDelete(coin.id);
                } else {
                  onDeleteGroup?.(effectiveGroupItems.map((c) => c.id));
                }
              }}>
                <Trash2 className="size-3.5" />
              </Button>
            </div>
            {!hasSubItems && (
              <div className={`px-4 py-2 flex flex-wrap gap-x-3 gap-y-1 text-sm text-muted-foreground ${ASSET_THEME.cardSectionMeta}`}>
                <span className="flex items-center gap-1"><Clock className="size-3" /><span className={`font-medium ${ASSET_THEME.text.default}`}>{formatHoldingPeriod(coin.purchaseDate)} 보유</span></span>
                <span className="flex items-center gap-1"><Calendar className="size-3" /><span className={`font-medium ${ASSET_THEME.text.default}`}>{coin.purchaseDate} 매수</span></span>
                {coin.description && <span className="w-full text-primary truncate"># {coin.description}</span>}
              </div>
            )}
            {hasSubItems && (
              <div className={`px-3 py-2.5 space-y-1.5 ${ASSET_THEME.subItemsWell}`}>
                <p className="text-sm font-semibold text-muted-foreground px-1 pb-0.5">거래소별 항목</p>
                {subItems!.map((sub, idx) => (
                  <SubCryptoCard key={sub.id} coin={sub} idx={idx} onDelete={onDelete} />
                ))}
              </div>
            )}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

export function CryptoTab() {
  const { assetData, deleteCrypto, saveData, getAssetSummary } = useAssetData();
  const summary = getAssetSummary();

  const handleDelete = (id: string) => {
    deleteCrypto(id);
    toast.success("삭제되었습니다.");
  };

  const handleDeleteGroup = (ids: string[]) => {
    const idSet = new Set(ids);
    saveData({ ...assetData, crypto: assetData.crypto.filter((c) => !idSet.has(c.id)) });
    toast.success("삭제되었습니다.");
  };

  const groupedCrypto = Array.from(groupCryptoBySymbol(assetData.crypto).values());
  const sorted = groupedCrypto
    .map((groupItems) => {
      const coin = mergeCryptoGroup(groupItems);
      const value = coin.quantity * coin.currentPrice;
      const cost = coin.quantity * coin.averagePrice;
      const profit = value - cost;
      const profitRate = cost > 0 ? (profit / cost) * 100 : 0;
      const subItems = groupItems.length > 1 || (groupItems.length > 0 && !!groupItems[0]?.exchange) ? groupItems : undefined;
      return { coin, groupItems, subItems, value, cost, profit, profitRate };
    })
    .filter((d) => d.value > 0)
    .sort((a, b) => b.value - a.value);

  const totalValue = summary.cryptoValue;
  const totalProfit = summary.cryptoProfit;
  const totalCost = summary.cryptoCost;

  const cryptoColors = assignColors(sorted.map((d) => ({ value: d.value })));
  const barItems = sorted.map(({ coin, value }, idx) => ({ coin, value, color: cryptoColors[idx] }));

  return (
    <Card className={ASSET_THEME.contentCard}>
      <CardHeader className={ASSET_THEME.contentPad}>
        <CardTitle>암호화폐</CardTitle>
      </CardHeader>
      <CardContent className={`space-y-4 ${ASSET_THEME.contentPad}`}>
        <DetailSummaryHeader
          label="총 암호화폐 평가금액"
          value={totalValue}
          valueClass={ASSET_THEME.text.default}
          inline={<ProfitMetric label="평가손익" profit={totalProfit} cost={totalCost} />}
        />

        {/* 카테고리 selector — 단일 옵션(전체)로 다른 탭과 시각 통일 */}
        <div className="flex justify-start">
          <InlineSelector
            value="all"
            onChange={() => { }}
            options={[{ value: "all", label: "전체" }]}
            ariaLabel="암호화폐 카테고리"
          />
        </div>

        {barItems.length > 0 && totalValue > 0 && (
          <div className="space-y-2">
            <div className="flex h-6 w-full rounded-full overflow-hidden gap-px">
              {barItems.map(({ coin, value: v, color }) => {
                const pct = (v / totalValue) * 100;
                return (
                  <div key={coin.id} className="flex items-center justify-center overflow-hidden transition-all" style={{ width: `${pct}%`, backgroundColor: color }} title={`${coin.name}: ${pct.toFixed(1)}%`}>
                    {pct > 5 && <span className="text-white text-[11px] font-bold drop-shadow select-none px-0.5 truncate">{pct.toFixed(1)}%</span>}
                  </div>
                );
              })}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-2 px-2">
              {barItems.map(({ coin, value: v, color }) => {
                const pct = (v / totalValue) * 100;
                return (
                  <div key={coin.id} className="flex items-center gap-1">
                    <span className="size-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                    <span className="text-sm text-foreground">{coin.name}</span>
                    <span className="text-sm font-bold shrink-0" style={{ color: color }}>{pct.toFixed(1)}%</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {sorted.length === 0 ? (
          <div className="flex h-36 items-center justify-center rounded-lg border border-dashed">
            <p className="text-muted-foreground text-sm">등록된 암호화폐가 없습니다.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {sorted.map(({ coin, groupItems, subItems, value, profit, profitRate }, idx) => {
              const pct = totalValue > 0 ? (value / totalValue) * 100 : 0;
              const color = cryptoColors[idx] ?? MAIN_PALETTE[0];
              return (
                <CryptoCard key={coin.id} coin={coin} value={value} profit={profit} profitRate={profitRate} pct={pct} color={color} onDelete={handleDelete} onDeleteGroup={handleDeleteGroup} groupItems={groupItems} subItems={subItems} />
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
