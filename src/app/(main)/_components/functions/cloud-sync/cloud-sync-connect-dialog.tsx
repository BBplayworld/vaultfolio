"use client";

/**
 * 링크(#asset=) 진입 시 자동으로 뜨는 "이 기기 연결" 모달.
 * 메뉴 탐색 없이 금고 암호만 입력하면 자산을 불러와 동기화 시작(비숙련자 배려).
 * 항상 마운트 — 현재 화면과 무관하게 표시(layout에서 Provider 하위 렌더).
 */

import { useState } from "react";
import { Cloud, Loader2, KeyRound } from "lucide-react";
import { toast } from "sonner";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useCloudSync } from "@/lib/cloud-sync/cloud-sync-provider";

export function CloudSyncConnectDialog() {
  const cs = useCloudSync();
  const [passphrase, setPassphrase] = useState("");
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState(false);

  const open = cs.enabled && !!cs.pendingConnectAssetId;

  const doConnect = async () => {
    if (!cs.pendingConnectAssetId || !passphrase) { toast.error("금고 암호를 입력하세요."); return; }
    setBusy(true);
    const r = await cs.connect(cs.pendingConnectAssetId, passphrase, remember);
    setBusy(false);
    if (r.ok) {
      toast.success("이 기기가 연결되었습니다. 자동 동기화가 시작됩니다.");
      setPassphrase("");
      cs.clearPendingConnect();
    } else {
      toast.error(r.message || "연결에 실패했습니다.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { setPassphrase(""); cs.clearPendingConnect(); } }}>
      <DialogContent className="sm:max-w-md touch-pan-y">
        <DialogHeader className="text-left">
          <DialogTitle className="flex items-center gap-2">
            <Cloud className="size-5 text-primary" /> 이 기기 연결
          </DialogTitle>
          <DialogDescription className="text-left">
            금고 암호를 입력하면 클라우드의 자산을 이 기기로 불러오고 자동 동기화를 시작합니다.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-1">
          <div className="space-y-1.5">
            <Label className="text-sm flex items-center gap-1.5"><KeyRound className="size-3.5 text-primary" /> 금고 암호</Label>
            <Input
              type="password" value={passphrase} onChange={(e) => setPassphrase(e.target.value)}
              placeholder="동기화 켤 때 정한 금고 암호"
              onKeyDown={(e) => { if (e.key === "Enter") doConnect(); }}
              autoFocus
            />
            <p className="text-[11px] text-muted-foreground">암호는 저장·전송되지 않습니다. 틀리면 불러올 수 없습니다.</p>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <Checkbox checked={remember} onCheckedChange={(v) => setRemember(!!v)} />
            <span className="text-sm">이 기기 기억하기 <span className="text-muted-foreground">(공용 PC면 해제)</span></span>
          </label>
        </div>
        <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button
            variant="brand"
            onClick={doConnect}
            disabled={busy || !passphrase}
            className="flex-1 sm:flex-initial"
          >
            {busy ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Cloud className="mr-2 size-4" />} 연결하기
          </Button>
          <Button
            variant="outline"
            onClick={() => { setPassphrase(""); cs.clearPendingConnect(); }}
            className="flex-1 sm:flex-initial"
          >
            취소
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
