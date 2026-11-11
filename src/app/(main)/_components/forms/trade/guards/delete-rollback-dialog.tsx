"use client";

import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatPriceByCurrency } from "@/lib/number-utils";
import type { Stock } from "@/types/asset";
import type { Transaction, PositionPreview } from "@/types/transaction";

interface DeleteRollbackDialogProps {
  open: boolean;
  tx: Transaction;
  stock: Stock;
  rollbackPreview: PositionPreview;
  linkedNote?: string; // 연결 계좌 되돌림 안내 1줄(#103) — 짝 기록이 실제로 있을 때만
  onConfirm: () => void;
  onCancel: () => void;
}

export function DeleteRollbackDialog({
  open,
  tx,
  stock,
  rollbackPreview,
  linkedNote,
  onConfirm,
  onCancel,
}: DeleteRollbackDialogProps) {
  const currency = stock.currency || "KRW";

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onCancel(); }}>
      <DialogContent className="sm:max-w-md touch-pan-y">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <Trash2 className="size-5" />
            반영된 거래 삭제
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="rounded-lg bg-card shadow-xs p-3">
            <div className="flex items-center gap-2 text-sm">
              <span className={tx.type === "buy" ? "text-red-500 font-medium" : "text-blue-500 font-medium"}>
                [{tx.type === "buy" ? "매수" : "매도"}]
              </span>
              <span className="font-medium">{tx.stockName}</span>
              <span>{tx.quantity}주</span>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {tx.date} · {formatPriceByCurrency(tx.price, currency)} · ✓반영됨
            </p>
          </div>

          <div className="rounded-lg bg-muted/30 p-3 space-y-2">
            <p className="text-sm font-medium text-muted-foreground">삭제 시 자동 롤백</p>
            <div className="grid grid-cols-[1fr_auto_1fr] gap-x-2 gap-y-1 text-sm">
              <span className="text-muted-foreground">수량</span>
              <span className="text-muted-foreground">→</span>
              <span className="font-medium">{stock.quantity}주 → {rollbackPreview.quantity}주</span>

              <span className="text-muted-foreground">평단가</span>
              <span className="text-muted-foreground">→</span>
              <span className="font-medium">
                {formatPriceByCurrency(stock.averagePrice, currency)} → {formatPriceByCurrency(rollbackPreview.avgPrice, currency)}
              </span>
            </div>
          </div>

          {linkedNote && (
            <p data-testid="delete-linked-record-note" className="text-sm text-muted-foreground break-keep text-pretty tabular-nums">
              {linkedNote}
            </p>
          )}
        </div>

        <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button
            variant="destructive"
            onClick={onConfirm}
            className="flex-1 sm:flex-initial"
          >
            삭제 + 롤백
          </Button>
          <Button variant="secondary" onClick={onCancel} className="flex-1 sm:flex-initial">
            취소
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
