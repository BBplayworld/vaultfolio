"use client";

import { useMemo, useState } from "react";
import { ArrowLeftRight, Trash2, ArrowDownLeft, ArrowUpRight, Plus } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { InlineSelector } from "../../../layout/ui/inline-selector";
import { useAssetData } from "@/contexts/asset-data-context";
import { useLoanTxViewStore } from "@/stores/loan-tx-view-store";
import { dispatchAddLoanTx } from "../../../layout/navigation/asset-dispatch";
import { formatCurrency } from "@/lib/number-utils";
import { ASSET_THEME, getProfitLossColor } from "@/config/theme";
import type { LoanTransaction } from "@/types/asset";

type DatePreset = "1m" | "3m" | "1y" | "all";
type TypeFilter = "all" | "repay" | "borrow";

const DATE_PRESETS = [
  { value: "1m" as DatePreset, label: "1개월" },
  { value: "3m" as DatePreset, label: "3개월" },
  { value: "1y" as DatePreset, label: "1년" },
  { value: "all" as DatePreset, label: "전체" },
];
const TYPE_FILTERS = [
  { value: "all" as TypeFilter, label: "전체" },
  { value: "repay" as TypeFilter, label: "상환" },
  { value: "borrow" as TypeFilter, label: "추가대출" },
];

function presetFrom(preset: DatePreset): string {
  if (preset === "all") return "0000-01-01";
  const d = new Date();
  if (preset === "1m") d.setMonth(d.getMonth() - 1);
  else if (preset === "3m") d.setMonth(d.getMonth() - 3);
  else if (preset === "1y") d.setFullYear(d.getFullYear() - 1);
  return d.toISOString().split("T")[0];
}

export function LoanTxView() {
  const { assetData, deleteLoanTransaction, deleteLoanTransactionWithBalance } = useAssetData();
  const target = useLoanTxViewStore((s) => s.target);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [datePreset, setDatePreset] = useState<DatePreset>("all");
  const [deleteTarget, setDeleteTarget] = useState<LoanTransaction | null>(null);

  const loan = assetData.loans.find((l) => l.id === target?.loanId);

  const fromDate = presetFrom(datePreset);
  const list = useMemo(() => {
    return (assetData.loanTransactions || [])
      .filter((t) => t.loanId === target?.loanId)
      .filter((t) => (typeFilter === "all" ? true : t.type === typeFilter))
      .filter((t) => t.date >= fromDate)
      .sort((a, b) => (a.date === b.date ? b.createdAt.localeCompare(a.createdAt) : b.date.localeCompare(a.date)));
  }, [assetData.loanTransactions, target?.loanId, typeFilter, fromDate]);

  // 통계 — 필터 범위 기준
  const stats = useMemo(() => {
    let repay = 0, borrow = 0;
    for (const t of list) {
      if (t.type === "repay") repay += t.amount;
      else borrow += t.amount;
    }
    return { repay, borrow, net: repay - borrow };
  }, [list]);

  const confirmDelete = (tx: LoanTransaction) => {
    if (tx.reflected) {
      setDeleteTarget(tx); // 잔액 역가감 확인
    } else {
      if (!confirm("이 기록을 삭제하시겠습니까?")) return;
      if (deleteLoanTransaction(tx.id)) toast.success("삭제되었습니다.");
    }
  };

  const runReflectedDelete = () => {
    const tx = deleteTarget;
    if (!tx || !loan) return;
    // 반영 역가감: 상환 삭제=+amount / 추가대출 삭제=−amount
    const newBalance = loan.balance + (tx.type === "repay" ? tx.amount : -tx.amount);
    if (deleteLoanTransactionWithBalance(tx.id, loan.id, { balance: Math.max(0, newBalance) })) {
      toast.success("삭제하고 잔액을 되돌렸습니다.");
    }
    setDeleteTarget(null);
  };

  if (!target || !loan) {
    return (
      <Card className={`min-w-0 ${ASSET_THEME.contentCard}`}>
        <CardContent className={`py-10 text-center text-sm text-muted-foreground ${ASSET_THEME.contentPad}`}>
          대출을 선택하면 상환/대출 내역이 표시됩니다.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={`min-w-0 ${ASSET_THEME.contentCard}`}>
      <CardHeader className={ASSET_THEME.contentPad}>
        <CardTitle className="flex items-center gap-2">
          <ArrowLeftRight className="size-5 text-primary" />
          {target.name} · 상환/대출 내역
          {loan.balance === 0 && <Badge variant="outline" className="text-[10px] px-1.5 py-0 leading-tight">완납</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent className={`space-y-4 min-w-0 ${ASSET_THEME.contentPad}`}>
        {/* 요약 */}
        <div className="grid grid-cols-3 gap-2 rounded-lg bg-muted/30 px-3 py-3">
          <div>
            <p className="text-sm text-muted-foreground">상환</p>
            <p className="text-sm font-bold tabular-nums text-red-500">+{formatCurrency(stats.repay)}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">추가대출</p>
            <p className="text-sm font-bold tabular-nums text-blue-500">−{formatCurrency(stats.borrow)}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">순상환</p>
            <p className={`text-sm font-bold tabular-nums ${getProfitLossColor(stats.net)}`}>{stats.net >= 0 ? "+" : "−"}{formatCurrency(Math.abs(stats.net))}</p>
          </div>
        </div>

        {/* 필터 */}
        <div className="flex flex-col gap-2">
          <InlineSelector value={typeFilter} onChange={(v) => setTypeFilter(v as TypeFilter)} options={TYPE_FILTERS} ariaLabel="유형 필터" />
          <InlineSelector value={datePreset} onChange={(v) => setDatePreset(v as DatePreset)} options={DATE_PRESETS} ariaLabel="기간 필터" />
        </div>

        {/* 기록 버튼 */}
        <Button variant="brand" className="w-full gap-1" onClick={() => dispatchAddLoanTx(loan.id)}>
          <Plus className="size-4" /> 상환/대출 기록
        </Button>

        {/* 목록 */}
        {list.length > 0 ? (
          <div className="divide-y divide-border/10 dark:divide-border/50">
            {list.map((t) => {
              const isRepay = t.type === "repay";
              return (
                <div key={t.id} className="flex items-center gap-3 py-2.5">
                  <div className={`size-8 rounded-full flex items-center justify-center shrink-0 ${isRepay ? "bg-red-500/10 text-red-500" : "bg-blue-500/10 text-blue-500"}`}>
                    {isRepay ? <ArrowDownLeft className="size-4" /> : <ArrowUpRight className="size-4" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-sm font-semibold">{isRepay ? "상환" : "추가 대출"}</span>
                      {!t.reflected && <Badge variant="outline" className="text-[10px] px-1 py-0 leading-tight text-muted-foreground">미반영</Badge>}
                    </div>
                    <p className="text-sm text-muted-foreground tabular-nums">{t.date}{t.memo ? ` · ${t.memo}` : ""}</p>
                  </div>
                  <span className={`text-sm font-bold tabular-nums shrink-0 ${isRepay ? "text-red-500" : "text-blue-500"}`}>
                    {isRepay ? "+" : "−"}{formatCurrency(t.amount)}
                  </span>
                  <Button size="icon" variant="secondary" className="size-7.5 shrink-0" title="삭제" onClick={() => confirmDelete(t)}>
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="py-8 text-center text-sm text-muted-foreground">상환/대출 기록이 없습니다.</p>
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
              {formatCurrency(loan.balance)}
              <span className="text-muted-foreground/60"> → </span>
              <span className="font-semibold">{formatCurrency(Math.max(0, loan.balance + (deleteTarget.type === "repay" ? deleteTarget.amount : -deleteTarget.amount)))}</span>
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
