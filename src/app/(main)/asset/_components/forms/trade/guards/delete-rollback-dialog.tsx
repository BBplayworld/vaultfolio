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
import { formatCurrency } from "@/lib/number-utils";
import type { Stock } from "@/types/asset";
import type { Transaction, PositionPreview } from "@/types/transaction";

interface DeleteRollbackDialogProps {
  open: boolean;
  tx: Transaction;
  stock: Stock;
  rollbackPreview: PositionPreview;
  onConfirm: () => void;
  onCancel: () => void;
}

const formatPrice = (value: number, currency: string) => {
  if (currency === "USD") return `$${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  if (currency === "JPY") return `¥${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  return formatCurrency(value);
};

export function DeleteRollbackDialog({
  open,
  tx,
  stock,
  rollbackPreview,
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
          <div className="rounded-lg border p-3">
            <div className="flex items-center gap-2 text-sm">
              <span className={tx.type === "buy" ? "text-red-500 font-medium" : "text-blue-500 font-medium"}>
                [{tx.type === "buy" ? "매수" : "매도"}]
              </span>
              <span className="font-medium">{tx.stockName}</span>
              <span>{tx.quantity}주</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {tx.date} · {formatPrice(tx.price, currency)} · ✓반영됨
            </p>
          </div>

          <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
            <p className="text-xs font-medium text-muted-foreground">삭제 시 자동 롤백</p>
            <div className="grid grid-cols-[1fr_auto_1fr] gap-x-2 gap-y-1 text-sm">
              <span className="text-muted-foreground">수량</span>
              <span className="text-muted-foreground">→</span>
              <span className="font-medium">{stock.quantity}주 → {rollbackPreview.quantity}주</span>

              <span className="text-muted-foreground">평단가</span>
              <span className="text-muted-foreground">→</span>
              <span className="font-medium">
                {formatPrice(stock.averagePrice, currency)} → {formatPrice(rollbackPreview.avgPrice, currency)}
              </span>
            </div>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={onCancel} className="flex-1">
            취소
          </Button>
          <Button
            variant="destructive"
            onClick={onConfirm}
            className="flex-1"
          >
            삭제 + 롤백
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
