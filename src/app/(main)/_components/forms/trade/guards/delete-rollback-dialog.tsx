"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { NumberInput } from "@/components/ui/number-input";
import { formatPriceByCurrency } from "@/lib/number-utils";
import { applyRollbackAvgInput, needsRollbackAvgInput } from "@/lib/trade/trade-form";
import type { Stock } from "@/types/asset";
import type { Transaction, PositionPreview } from "@/types/transaction";

interface DeleteRollbackDialogProps {
  open: boolean;
  tx: Transaction;
  stock: Stock;
  rollbackPreview: PositionPreview;
  recordOnly?: boolean; // 반영 안 된 기록 — 롤백 미리보기 없이 기록만 삭제 확인
  linkedNote?: string; // 연결 계좌 되돌림 안내 1줄(#103) — 짝 기록이 실제로 있을 때만
  onConfirm: (avgPriceInput?: number) => void; // 결과 평단 미상일 때만 입력한 평단을 넘긴다(#354)
  onCancel: () => void;
}

export function DeleteRollbackDialog({
  open,
  tx,
  stock,
  rollbackPreview,
  recordOnly,
  linkedNote,
  onConfirm,
  onCancel,
}: DeleteRollbackDialogProps) {
  const currency = stock.currency || "KRW";
  // 결과 수량 > 0 · 평단 ≤ 0(전량 매도를 지운 경우) — 평단을 입력받아야 저장할 수 있다(#354)
  const needsAvg = !recordOnly && needsRollbackAvgInput(rollbackPreview);
  const [avgInput, setAvgInput] = useState(0);
  const resolved = applyRollbackAvgInput(rollbackPreview, needsAvg ? avgInput : undefined);

  if (recordOnly) {
    return (
      <Dialog open={open} onOpenChange={(o) => { if (!o) onCancel(); }}>
        <DialogContent data-testid="tx-delete-confirm" className="sm:max-w-md touch-pan-y">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="size-5" />
              기록 삭제
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground text-pretty break-keep">이 기록만 지워요. 보유 수량은 그대로예요</p>
          <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button data-testid="tx-delete-confirm-ok" size="lg" variant="destructive" onClick={() => onConfirm()} className="flex-1 min-h-10 sm:flex-initial">
              삭제
            </Button>
            <Button data-testid="tx-delete-confirm-cancel" size="lg" variant="secondary" autoFocus onClick={onCancel} className="flex-1 min-h-10 sm:flex-initial">
              취소
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

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
                {formatPriceByCurrency(stock.averagePrice, currency)} → {resolved ? formatPriceByCurrency(resolved.avgPrice, currency) : "?"}
              </span>
            </div>
            {needsAvg && (
              <div className="space-y-2 pt-1">
                <label id="rollback-avg-unknown-label" htmlFor="rollback-avg-input" data-testid="rollback-avg-unknown" className="block text-sm font-medium text-foreground break-keep">
                  평단을 알 수 없어요
                </label>
                <NumberInput
                  id="rollback-avg-input"
                  data-testid="rollback-avg-input"
                  placeholder={`평단가 입력 (${currency === "KRW" ? "원" : currency})`}
                  className="tabular-nums"
                  value={avgInput}
                  onChange={setAvgInput}
                  allowDecimals={currency !== "KRW"}
                  maxDecimals={currency === "USD" ? 3 : currency === "KRW" ? 0 : 4}
                  quickButtons={[]}
                />
              </div>
            )}
          </div>

          {linkedNote && (
            <p data-testid="delete-linked-record-note" className="text-sm text-muted-foreground break-keep text-pretty tabular-nums">
              {linkedNote}
            </p>
          )}
        </div>

        <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button
            data-testid="rollback-delete-ok"
            variant="destructive"
            disabled={!resolved}
            aria-describedby={needsAvg ? "rollback-avg-unknown-label" : undefined}
            onClick={() => { if (resolved) onConfirm(needsAvg ? resolved.avgPrice : undefined); }}
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
