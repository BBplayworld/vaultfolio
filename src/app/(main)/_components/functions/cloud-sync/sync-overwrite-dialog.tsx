"use client";

/**
 * 동기화로 바뀐 내 변경 목록 + 되돌리기(#84). 항상 마운트 — 토스트·안내 카드 어디서든 같은 상태로 연다.
 * 목록 정본은 overwrite-guard(메모리). 열 때·확정 때 목록을 다시 계산한다(R1).
 */

import { useEffect, useState } from "react";
import { History } from "lucide-react";
import { toast } from "sonner";

import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { track } from "@/lib/analytics/ga";
import { useCloudSync } from "@/lib/cloud-sync/cloud-sync-provider";
import type { OverwriteKind } from "@/lib/cloud-sync/overwrite-guard";

const KIND_TEXT: Record<OverwriteKind, string> = {
  modified: "내 수정이 다른 기기 값으로 바뀌었어요",
  resurrected: "내가 삭제한 항목이 다시 생겼어요",
  remoteDeleted: "내가 수정한 항목이 다른 기기에서 삭제됐어요",
};

export function SyncOverwriteDialog() {
  const cs = useCloudSync();
  const open = cs.showOverwriteList;
  const [confirming, setConfirming] = useState(false);
  const [droppedNote, setDroppedNote] = useState(0);

  // 열 때 재계산(R1)
  useEffect(() => {
    if (!open) return;
    setConfirming(false);
    setDroppedNote(0);
    cs.refreshOverwrites();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const entries = cs.overwriteEntries;
  const count = entries.length;

  const confirmRevert = () => {
    // 확정 때 재계산 — 그사이 바뀐 항목이 있으면 바로 적용하지 않고 갱신 건수로 한 번 더 확인
    const { dropped, count: remain } = cs.refreshOverwrites();
    if (dropped > 0) {
      setDroppedNote((n) => n + dropped);
      return;
    }
    if (remain === 0) return;
    track("feature_use", { category: "sync_overwrite_undo" });
    cs.revertOverwrites();
    toast.success("되돌렸어요", { id: "sync-overwrite" });
  };

  return (
    <Dialog open={open} onOpenChange={cs.setShowOverwriteList}>
      <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto touch-pan-y">
        <DialogHeader className="text-left">
          <DialogTitle className="flex items-center gap-2">
            <History aria-hidden className="size-5 text-primary" />
            바뀐 내 변경 <span className="tabular-nums">{count}</span>건
          </DialogTitle>
          <DialogDescription className="text-left text-pretty break-keep">
            다른 기기에서 먼저 저장한 내용이 반영됐어요. 이 기기에서 아직 올라가지 않은 변경이 아래처럼 바뀌었어요.
          </DialogDescription>
        </DialogHeader>

        {count === 0 ? (
          <div data-testid="sync-overwrite-empty" className="py-6 text-center text-sm text-muted-foreground">
            되돌릴 변경이 없어요.
          </div>
        ) : (
          <>
            <ul
              data-testid="sync-overwrite-list"
              tabIndex={0}
              className="max-h-[40vh] overflow-y-auto rounded-lg bg-muted/40 divide-y divide-border dark:divide-border/40"
            >
              {entries.map((e) => (
                <li key={e.key} data-testid="sync-overwrite-row" className="flex min-h-10 flex-col gap-0.5 px-3 py-2.5">
                  <span className="line-clamp-2 break-words text-sm font-medium text-foreground">{e.label}</span>
                  <span className="text-sm text-muted-foreground text-pretty break-keep">{KIND_TEXT[e.kind]}</span>
                </li>
              ))}
            </ul>
            <p className="text-sm text-muted-foreground text-pretty break-keep">앱을 닫거나 새로고침하면 되돌릴 수 없어요.</p>
          </>
        )}

        {count > 0 && confirming ? (
          <div data-testid="sync-overwrite-confirm" role="group" aria-labelledby="sync-overwrite-confirm-title" className="space-y-2 rounded-lg bg-muted/40 p-3 motion-safe:animate-in motion-safe:fade-in duration-150">
            <p id="sync-overwrite-confirm-title" tabIndex={-1} className="text-sm font-semibold text-foreground">이 기기에서 고친 값으로 되돌릴까요?</p>
            {droppedNote > 0 && (
              <p className="text-sm text-foreground text-pretty break-keep">그사이 바뀐 <span className="tabular-nums">{droppedNote}</span>건은 목록에서 뺐어요.</p>
            )}
            <p className="text-sm leading-relaxed text-muted-foreground text-pretty break-keep">
              목록의 <span className="tabular-nums">{count}</span>건을 이 기기 값으로 되돌리고 다른 기기에도 반영해요. 같은 항목을 다른 기기에서 바꾸거나 지운 내용도 함께 되돌려질 수 있어요.
            </p>
            <div className="flex gap-2">
              <Button variant="brand" className="min-h-10 flex-1" onClick={confirmRevert}>되돌리기 확정</Button>
              <Button variant="secondary" className="min-h-10 flex-1" onClick={() => { setConfirming(false); setDroppedNote(0); }}>취소</Button>
            </div>
          </div>
        ) : (
          <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            {count > 0 && (
              <Button variant="brand" className="min-h-10" onClick={() => setConfirming(true)}>되돌리기</Button>
            )}
            <Button variant="secondary" className="min-h-10" onClick={count > 0 ? cs.dismissOverwrites : () => cs.setShowOverwriteList(false)}>
              {count > 0 ? "그대로 두기" : "닫기"}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
