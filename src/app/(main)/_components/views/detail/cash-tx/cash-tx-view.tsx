"use client";

import { useMemo, useState } from "react";
import { ArrowLeftRight, Trash2, ArrowDownLeft, ArrowUpRight, Plus } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { InlineSelector } from "../../../layout/ui/inline-selector";
import { useAssetData } from "@/contexts/asset-data-context";
import { useCashTxViewStore } from "@/stores/cash-tx-view-store";
import { dispatchAddCashTx } from "../../../layout/navigation/asset-dispatch";
import { formatCurrencyDisplay } from "../asset-detail-tabs";
import { ASSET_THEME, getProfitLossColor } from "@/config/theme";
import type { CashTransaction } from "@/types/asset";

type DatePreset = "1m" | "3m" | "1y" | "all";
type TypeFilter = "all" | "deposit" | "withdrawal";

const DATE_PRESETS = [
  { value: "1m" as DatePreset, label: "1개월" },
  { value: "3m" as DatePreset, label: "3개월" },
  { value: "1y" as DatePreset, label: "1년" },
  { value: "all" as DatePreset, label: "전체" },
];
const TYPE_FILTERS = [
  { value: "all" as TypeFilter, label: "전체" },
  { value: "deposit" as TypeFilter, label: "입금" },
  { value: "withdrawal" as TypeFilter, label: "출금" },
];

function presetFrom(preset: DatePreset): string {
  if (preset === "all") return "0000-01-01";
  const d = new Date();
  if (preset === "1m") d.setMonth(d.getMonth() - 1);
  else if (preset === "3m") d.setMonth(d.getMonth() - 3);
  else if (preset === "1y") d.setFullYear(d.getFullYear() - 1);
  return d.toISOString().split("T")[0];
}

export function CashTxView() {
  const { assetData, deleteCashTransaction, deleteCashTransactionWithBalance } = useAssetData();
  const target = useCashTxViewStore((s) => s.target);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [datePreset, setDatePreset] = useState<DatePreset>("all");
  const [deleteTarget, setDeleteTarget] = useState<CashTransaction | null>(null);

  const cash = assetData.cash.find((c) => c.id === target?.cashId);
  const currency = cash?.currency || "KRW";

  const fromDate = presetFrom(datePreset);
  const list = useMemo(() => {
    return (assetData.cashTransactions || [])
      .filter((t) => t.cashId === target?.cashId)
      .filter((t) => (typeFilter === "all" ? true : t.type === typeFilter))
      .filter((t) => t.date >= fromDate)
      .sort((a, b) => (a.date === b.date ? b.createdAt.localeCompare(a.createdAt) : b.date.localeCompare(a.date)));
  }, [assetData.cashTransactions, target?.cashId, typeFilter, fromDate]);

  // 통계 — 필터 범위 기준
  const stats = useMemo(() => {
    let dep = 0, wd = 0;
    for (const t of list) {
      if (t.type === "deposit") dep += t.amount;
      else wd += t.amount;
    }
    return { dep, wd, net: dep - wd };
  }, [list]);

  const confirmDelete = (tx: CashTransaction) => {
    if (tx.reflected) {
      setDeleteTarget(tx); // 잔액 역가감 확인
    } else {
      if (!confirm("이 기록을 삭제하시겠습니까?")) return;
      if (deleteCashTransaction(tx.id)) toast.success("삭제되었습니다.");
    }
  };

  const runReflectedDelete = () => {
    const tx = deleteTarget;
    if (!tx || !cash) return;
    // 반영 역가감: 입금 삭제=−amount / 출금 삭제=+amount
    const newBalance = cash.balance + (tx.type === "deposit" ? -tx.amount : tx.amount);
    if (deleteCashTransactionWithBalance(tx.id, cash.id, { balance: Math.max(0, newBalance) })) {
      toast.success("삭제하고 잔액을 되돌렸습니다.");
    }
    setDeleteTarget(null);
  };

  if (!target || !cash) {
    return (
      <Card className={`min-w-0 ${ASSET_THEME.contentCard}`}>
        <CardContent className={`py-10 text-center text-sm text-muted-foreground ${ASSET_THEME.contentPad}`}>
          현금 계좌를 선택하면 입출금 내역이 표시됩니다.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={`min-w-0 ${ASSET_THEME.contentCard}`}>
      <CardHeader className={ASSET_THEME.contentPad}>
        <CardTitle className="flex items-center gap-2">
          <ArrowLeftRight className="size-5 text-primary" />
          {target.name} · 입출금 내역
        </CardTitle>
      </CardHeader>
      <CardContent className={`space-y-4 min-w-0 ${ASSET_THEME.contentPad}`}>
        {/* 요약 */}
        <div className="grid grid-cols-3 gap-2 rounded-lg bg-muted/30 px-3 py-3">
          <div>
            <p className="text-sm text-muted-foreground">입금</p>
            <p className="text-sm font-bold tabular-nums text-red-500">+{formatCurrencyDisplay(stats.dep, currency)}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">출금</p>
            <p className="text-sm font-bold tabular-nums text-blue-500">−{formatCurrencyDisplay(stats.wd, currency)}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">순유입</p>
            <p className={`text-sm font-bold tabular-nums ${getProfitLossColor(stats.net)}`}>{stats.net >= 0 ? "+" : "−"}{formatCurrencyDisplay(Math.abs(stats.net), currency)}</p>
          </div>
        </div>

        {/* 필터 */}
        <div className="flex flex-col gap-2">
          <InlineSelector value={typeFilter} onChange={(v) => setTypeFilter(v as TypeFilter)} options={TYPE_FILTERS} ariaLabel="유형 필터" />
          <InlineSelector value={datePreset} onChange={(v) => setDatePreset(v as DatePreset)} options={DATE_PRESETS} ariaLabel="기간 필터" />
        </div>

        {/* 기록 버튼 */}
        <Button variant="brand" className="w-full gap-1" onClick={() => dispatchAddCashTx(cash.id)}>
          <Plus className="size-4" /> 입출금 기록
        </Button>

        {/* 목록 */}
        {list.length > 0 ? (
          <div className="divide-y divide-border/10 dark:divide-border/50">
            {list.map((t) => {
              const isDep = t.type === "deposit";
              return (
                <div key={t.id} className="flex items-center gap-3 py-2.5">
                  <div className={`size-8 rounded-full flex items-center justify-center shrink-0 ${isDep ? "bg-red-500/10 text-red-500" : "bg-blue-500/10 text-blue-500"}`}>
                    {isDep ? <ArrowDownLeft className="size-4" /> : <ArrowUpRight className="size-4" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-sm font-semibold">{isDep ? "입금" : "출금"}</span>
                      {isDep && t.recurring && <Badge variant="outline" className="text-[10px] px-1 py-0 leading-tight text-amber-600 border-amber-600">정기</Badge>}
                      {!t.reflected && <Badge variant="outline" className="text-[10px] px-1 py-0 leading-tight text-muted-foreground">미반영</Badge>}
                    </div>
                    <p className="text-sm text-muted-foreground tabular-nums">{t.date}{t.memo ? ` · ${t.memo}` : ""}</p>
                  </div>
                  <span className={`text-sm font-bold tabular-nums shrink-0 ${isDep ? "text-red-500" : "text-blue-500"}`}>
                    {isDep ? "+" : "−"}{formatCurrencyDisplay(t.amount, t.currency)}
                  </span>
                  <Button size="icon" variant="secondary" className="size-7.5 shrink-0" title="삭제" onClick={() => confirmDelete(t)}>
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="py-8 text-center text-sm text-muted-foreground">입출금 기록이 없습니다.</p>
        )}
      </CardContent>

      {/* 반영 거래 삭제 확인 (잔액 역가감) */}
      {deleteTarget && (
        <div className="fixed inset-0 z-[10050] flex items-center justify-center bg-black/50 p-4" onClick={() => setDeleteTarget(null)}>
          <div className="w-full max-w-sm rounded-2xl bg-background p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
            <p className="text-base font-bold">반영된 기록 삭제</p>
            <p className="text-sm text-muted-foreground">
              이 기록은 잔액에 반영되어 있습니다. 삭제하면 잔액이 되돌아갑니다.
            </p>
            <p className="text-sm tabular-nums rounded-lg bg-muted/40 p-3">
              {formatCurrencyDisplay(cash.balance, currency)}
              <span className="text-muted-foreground/60"> → </span>
              <span className="font-semibold">{formatCurrencyDisplay(Math.max(0, cash.balance + (deleteTarget.type === "deposit" ? -deleteTarget.amount : deleteTarget.amount)), currency)}</span>
            </p>
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
