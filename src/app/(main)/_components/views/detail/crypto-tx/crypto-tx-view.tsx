"use client";

import { useMemo, useState } from "react";
import { ArrowLeftRight, Trash2, TrendingUp, TrendingDown, Plus } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { InlineSelector } from "../../../layout/ui/inline-selector";
import { useAssetData } from "@/contexts/asset-data-context";
import { useCryptoTxViewStore } from "@/stores/crypto-tx-view-store";
import { dispatchAddCryptoTx } from "../../../layout/navigation/asset-dispatch";
import { formatCurrency } from "@/lib/number-utils";
import { rollbackTransaction, type PositionLike } from "@/lib/trade/trade-utils";
import { ASSET_THEME } from "@/config/theme";
import type { Crypto, CryptoTransaction } from "@/types/asset";

type DatePreset = "1m" | "3m" | "1y" | "all";
type TypeFilter = "all" | "buy" | "sell";

const DATE_PRESETS = [
  { value: "1m" as DatePreset, label: "1개월" },
  { value: "3m" as DatePreset, label: "3개월" },
  { value: "1y" as DatePreset, label: "1년" },
  { value: "all" as DatePreset, label: "전체" },
];
const TYPE_FILTERS = [
  { value: "all" as TypeFilter, label: "전체" },
  { value: "buy" as TypeFilter, label: "매수" },
  { value: "sell" as TypeFilter, label: "매도" },
];

function presetFrom(preset: DatePreset): string {
  if (preset === "all") return "0000-01-01";
  const d = new Date();
  if (preset === "1m") d.setMonth(d.getMonth() - 1);
  else if (preset === "3m") d.setMonth(d.getMonth() - 3);
  else if (preset === "1y") d.setFullYear(d.getFullYear() - 1);
  return d.toISOString().split("T")[0];
}

interface CryptoPosition extends PositionLike {
  cryptoId: string;
}

function getCryptoPosition(coin: Crypto): CryptoPosition {
  return {
    cryptoId: coin.id,
    quantity: coin.quantity,
    avgPrice: coin.averagePrice,
    avgExchangeRate: 0,
    source: coin.positionSource ?? "manual",
    effectiveDate: coin.positionEffectiveDate ?? coin.purchaseDate,
    lockedByManual: false,
  };
}

export function CryptoTxView() {
  const { assetData, deleteCryptoTransaction, deleteCryptoTransactionWithPosition } = useAssetData();
  const target = useCryptoTxViewStore((s) => s.target);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [datePreset, setDatePreset] = useState<DatePreset>("all");
  const [deleteTarget, setDeleteTarget] = useState<{ tx: CryptoTransaction; preview: { quantity: number; avgPrice: number } } | null>(null);

  const coin = assetData.crypto.find((c) => c.id === target?.cryptoId);

  const fromDate = presetFrom(datePreset);
  const list = useMemo(() => {
    return (assetData.cryptoTransactions || [])
      .filter((t) => t.cryptoId === target?.cryptoId)
      .filter((t) => (typeFilter === "all" ? true : t.type === typeFilter))
      .filter((t) => t.date >= fromDate)
      .sort((a, b) => (a.date === b.date ? b.createdAt.localeCompare(a.createdAt) : b.date.localeCompare(a.date)));
  }, [assetData.cryptoTransactions, target?.cryptoId, typeFilter, fromDate]);

  // 통계 — 필터 범위 기준
  const stats = useMemo(() => {
    let buyQty = 0, buyAmt = 0, sellQty = 0, sellAmt = 0;
    for (const t of list) {
      const amt = t.price * t.quantity;
      if (t.type === "buy") { buyQty += t.quantity; buyAmt += amt; }
      else { sellQty += t.quantity; sellAmt += amt; }
    }
    return { buyQty, buyAmt, sellQty, sellAmt };
  }, [list]);

  const confirmDelete = (tx: CryptoTransaction) => {
    if (!tx.reflected || !coin) {
      if (!confirm("이 기록을 삭제하시겠습니까?")) return;
      if (deleteCryptoTransaction(tx.id)) toast.success("삭제되었습니다.");
      return;
    }
    // 가중평균 포지션이라 단순 산술 역가감이 아니라 거래로그 전체를 재적용해 롤백해야 정확하다.
    const pos = getCryptoPosition(coin);
    const allTx = (assetData.cryptoTransactions || []).filter((t) => t.cryptoId === coin.id);
    const rolledBack = rollbackTransaction(pos, allTx, tx.id);
    setDeleteTarget({ tx, preview: { quantity: rolledBack.quantity, avgPrice: rolledBack.avgPrice } });
  };

  const runReflectedDelete = () => {
    if (!deleteTarget || !coin) return;
    const { tx, preview } = deleteTarget;
    if (deleteCryptoTransactionWithPosition(tx.id, coin.id, {
      quantity: preview.quantity,
      averagePrice: preview.avgPrice,
      positionSource: "computed",
    })) {
      toast.success("삭제하고 포지션을 되돌렸습니다.");
    }
    setDeleteTarget(null);
  };

  if (!target || !coin) {
    return (
      <Card className={`min-w-0 ${ASSET_THEME.contentCard}`}>
        <CardContent className={`py-10 text-center text-sm text-muted-foreground ${ASSET_THEME.contentPad}`}>
          코인을 선택하면 매수/매도 내역이 표시됩니다.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={`min-w-0 ${ASSET_THEME.contentCard}`}>
      <CardHeader className={ASSET_THEME.contentPad}>
        <CardTitle className="flex items-center gap-2">
          <ArrowLeftRight className="size-5 text-primary" />
          {target.name} · 매수/매도 내역
        </CardTitle>
      </CardHeader>
      <CardContent className={`space-y-4 min-w-0 ${ASSET_THEME.contentPad}`}>
        {/* 요약 */}
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-xl bg-red-500/5 px-3 py-2">
            <p className="flex items-center gap-1 text-sm text-red-500"><TrendingUp className="size-3" /> 매수</p>
            <p className="font-bold tabular-nums">{stats.buyQty.toLocaleString(undefined, { maximumFractionDigits: 10 })}개</p>
            <p className="text-sm text-muted-foreground tabular-nums">{formatCurrency(Math.round(stats.buyAmt))}</p>
          </div>
          <div className="rounded-xl bg-blue-500/5 px-3 py-2">
            <p className="flex items-center gap-1 text-sm text-blue-500"><TrendingDown className="size-3" /> 매도</p>
            <p className="font-bold tabular-nums">{stats.sellQty.toLocaleString(undefined, { maximumFractionDigits: 10 })}개</p>
            <p className="text-sm text-muted-foreground tabular-nums">{formatCurrency(Math.round(stats.sellAmt))}</p>
          </div>
        </div>

        {/* 필터 */}
        <div className="flex flex-col gap-2">
          <InlineSelector value={typeFilter} onChange={(v) => setTypeFilter(v as TypeFilter)} options={TYPE_FILTERS} ariaLabel="유형 필터" />
          <InlineSelector value={datePreset} onChange={(v) => setDatePreset(v as DatePreset)} options={DATE_PRESETS} ariaLabel="기간 필터" />
        </div>

        {/* 기록 버튼 */}
        <Button variant="brand" className="w-full gap-1" onClick={() => dispatchAddCryptoTx(coin.id)}>
          <Plus className="size-4" /> 매수/매도 기록
        </Button>

        {/* 목록 */}
        {list.length > 0 ? (
          <div className="divide-y divide-border/10 dark:divide-border/50">
            {list.map((t) => {
              const isBuy = t.type === "buy";
              return (
                <div key={t.id} className="flex items-center gap-3 py-2.5">
                  <span className={`text-xs font-bold shrink-0 w-8 ${isBuy ? "text-red-500" : "text-blue-500"}`}>
                    {isBuy ? "매수" : "매도"}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-sm tabular-nums">{t.quantity.toLocaleString(undefined, { maximumFractionDigits: 10 })}개 · {formatCurrency(t.price)}</span>
                      {!t.reflected && <Badge variant="outline" className="text-[10px] px-1 py-0 leading-tight text-muted-foreground">미반영</Badge>}
                    </div>
                    <p className="text-sm text-muted-foreground tabular-nums">{t.date}{t.memo ? ` · ${t.memo}` : ""}</p>
                  </div>
                  <span className={`text-sm font-bold tabular-nums shrink-0 ${isBuy ? "text-red-500" : "text-blue-500"}`}>
                    {isBuy ? "+" : "−"}{formatCurrency(t.price * t.quantity)}
                  </span>
                  <Button size="icon" variant="secondary" className="size-7.5 shrink-0" title="삭제" onClick={() => confirmDelete(t)}>
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="py-8 text-center text-sm text-muted-foreground">매수/매도 기록이 없습니다.</p>
        )}
      </CardContent>

      {/* 반영 거래 삭제 확인 (포지션 롤백) */}
      {deleteTarget && (
        <div className="fixed inset-0 z-[10050] flex items-center justify-center bg-black/50 p-4" onClick={() => setDeleteTarget(null)}>
          <div className="w-full max-w-sm rounded-2xl bg-background p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
            <p className="text-base font-bold">반영된 기록 삭제</p>
            <p className="text-sm text-muted-foreground">
              이 기록은 보유 수량·평단에 반영되어 있습니다. 삭제하면 포지션이 되돌아갑니다.
            </p>
            <div className="text-sm tabular-nums rounded-lg bg-muted/40 p-3 space-y-1">
              <p>
                {coin.quantity.toLocaleString(undefined, { maximumFractionDigits: 10 })}개
                <span className="text-muted-foreground/60"> → </span>
                <span className="font-semibold">{deleteTarget.preview.quantity.toLocaleString(undefined, { maximumFractionDigits: 10 })}개</span>
              </p>
              <p>
                {formatCurrency(coin.averagePrice)}
                <span className="text-muted-foreground/60"> → </span>
                <span className="font-semibold">{formatCurrency(deleteTarget.preview.avgPrice)}</span>
              </p>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="secondary" onClick={() => setDeleteTarget(null)}>취소</Button>
              <Button variant="destructive" onClick={runReflectedDelete}>삭제</Button>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
