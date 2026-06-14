"use client";

/**
 * 더보기 > 클라우드 동기화 진입점 (공개 무료, 결제 없음 — "추후 Plus" 명시).
 * 상태·동기화 로직은 CloudSyncProvider(useCloudSync)에 위임 — 이 컴포넌트는 UI만.
 *
 * 상태별 UI: none(동기화 시작) / locked(금고 암호로 잠금 해제) / armed(링크·QR·공유 + 백업/불러오기).
 */

import { useState } from "react";
import {
  Cloud, CloudUpload, CloudDownload, Loader2, KeyRound, AlertTriangle, RefreshCw, Lock, Copy, QrCode, Share2, Link2,
} from "lucide-react";
import { toast } from "sonner";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useCloudSync } from "@/lib/cloud-sync/cloud-sync-provider";
import { SyncQr } from "./sync-qr";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CloudSyncMenuEntry({ open, onOpenChange }: Props) {
  const cs = useCloudSync();
  const [passphrase, setPassphrase] = useState("");
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [confirmPull, setConfirmPull] = useState(false);

  if (!cs.enabled) return null;

  const resetLocal = () => { setPassphrase(""); setConfirmPull(false); setShowQr(false); };

  const doEnable = async () => {
    if (!passphrase) { toast.error("금고 암호를 입력하세요."); return; }
    setBusy(true);
    const r = await cs.enableSync(passphrase, remember);
    setBusy(false);
    if (r.ok) { toast.success("클라우드 동기화가 켜졌습니다."); setPassphrase(""); }
    else toast.error(r.message || "동기화 시작에 실패했습니다.");
  };

  const doUnlock = async () => {
    if (!passphrase) { toast.error("금고 암호를 입력하세요."); return; }
    setBusy(true);
    const r = await cs.unlock(passphrase, remember);
    setBusy(false);
    if (r.ok) { toast.success("잠금 해제 — 자동 동기화 시작."); setPassphrase(""); }
    else toast.error(r.message || "잠금 해제에 실패했습니다.");
  };

  const doPull = async () => {
    setConfirmPull(false);
    const r = await cs.pullNow();
    if (r.status === "ok") toast.success("클라우드에서 불러왔습니다.");
    else if (r.status === "empty") toast.info("클라우드에 저장된 금고가 없습니다.");
    else toast.error(r.message);
  };

  const shareLink = async () => {
    const link = cs.syncLink;
    if (!link) return;
    if (typeof navigator !== "undefined" && navigator.share) {
      try { await navigator.share({ title: "시크릿에셋 동기화", url: link }); return; } catch { /* 취소/미지원 → 복사 폴백 */ }
    }
    try { await navigator.clipboard.writeText(link); toast.success("링크가 복사되었습니다."); }
    catch { toast.error("복사에 실패했습니다."); }
  };

  const copyLink = async () => {
    if (!cs.syncLink) return;
    try { await navigator.clipboard.writeText(cs.syncLink); toast.success("링크가 복사되었습니다."); }
    catch { toast.error("복사에 실패했습니다."); }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) resetLocal(); }}>
      <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto touch-pan-y">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Cloud className="size-5 text-primary" /> 클라우드 동기화</DialogTitle>
          <DialogDescription>
            새 기기로 자산을 안전하게 전달하고(공유), 실시간으로 데이터를 일치시킵니다(지속 자동 동기화). 서버는 E2EE 암호문만 보관하므로 금고 암호 없이는 열 수 없습니다.
          </DialogDescription>
        </DialogHeader>

        {/* none: 동기화 시작 */}
        {cs.status === "none" && (
          <div className="space-y-3 py-1">
            <div className="rounded-md bg-primary/5 border border-primary/20 px-3 py-2 text-[11px] text-muted-foreground">
              <span className="text-primary font-semibold">Plus 요금제</span> 공식 출시 전 제공되는 <span className="text-foreground font-medium">사전 무료 체험 서비스</span>입니다.
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm flex items-center gap-1.5"><KeyRound className="size-3.5 text-primary" /> 금고 암호</Label>
              <Input
                type="password" value={passphrase} onChange={(e) => setPassphrase(e.target.value)}
                placeholder="단어 조합 권장 (예: 노을 바다 커피)"
                onKeyDown={(e) => { if (e.key === "Enter") doEnable(); }}
              />
              <p className="text-[11px] text-muted-foreground">저장·전송되지 않습니다. <span className="text-foreground">잊으면 복구할 수 없으니</span> 꼭 기억하세요.</p>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox checked={remember} onCheckedChange={(v) => setRemember(!!v)} />
              <span className="text-sm">이 기기 기억하기 <span className="text-muted-foreground">(공용 PC면 해제)</span></span>
            </label>
            <Button variant="brand" className="w-full" onClick={doEnable} disabled={busy || !passphrase}>
              {busy ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Cloud className="mr-2 size-4" />} 동기화 시작
            </Button>
          </div>
        )}

        {/* locked: 잠금 해제 */}
        {cs.status === "locked" && (
          <div className="space-y-3 py-1">
            <div className="rounded-md bg-amber-500/10 border border-amber-500/20 px-3 py-2 text-[11px] text-amber-600 dark:text-amber-400">
              이 기기는 금고에 연결돼 있어요. 금고 암호로 잠금을 해제하면 동기화가 재개됩니다.
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm flex items-center gap-1.5"><KeyRound className="size-3.5 text-primary" /> 금고 암호</Label>
              <Input
                type="password" value={passphrase} onChange={(e) => setPassphrase(e.target.value)}
                placeholder="금고 암호"
                onKeyDown={(e) => { if (e.key === "Enter") doUnlock(); }}
              />
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox checked={remember} onCheckedChange={(v) => setRemember(!!v)} />
              <span className="text-sm">이 기기 기억하기</span>
            </label>
            <Button variant="brand" className="w-full" onClick={doUnlock} disabled={busy || !passphrase}>
              {busy ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Lock className="mr-2 size-4" />} 잠금 해제
            </Button>
            <Button variant="ghost" size="sm" className="w-full text-xs text-muted-foreground" onClick={cs.forget}>
              이 기기 연결 해제(다른 금고로 새로 시작)
            </Button>
          </div>
        )}

        {/* armed: 링크/QR/공유 + 동기화 */}
        {cs.status === "armed" && (
          <div className="space-y-3 py-1">
            <div className="rounded-md bg-primary/5 border border-primary/20 px-3 py-2 text-xs flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-foreground font-medium">
                <RefreshCw className={`size-3.5 text-primary ${cs.syncing ? "animate-spin" : ""}`} />
                자동 동기화 켜짐{cs.syncing ? " · 동기화 중…" : ""}
              </span>
              <span className="text-muted-foreground">{cs.lastSyncedAt ? new Date(cs.lastSyncedAt).toLocaleTimeString("ko-KR") : "-"}</span>
            </div>

            <div className="space-y-2">
              <Label className="text-sm flex items-center gap-1.5"><Link2 className="size-3.5 text-primary" /> 다른 기기 연결 링크</Label>
              <p className="text-[11px] text-muted-foreground">이 링크를 다른 기기에서 열고 금고 암호를 입력하면 같은 자산을 봅니다.</p>
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" className="flex-1" onClick={copyLink}><Copy className="mr-1.5 size-3.5" /> 복사</Button>
                <Button variant="secondary" size="sm" className="flex-1" onClick={() => setShowQr((v) => !v)}><QrCode className="mr-1.5 size-3.5" /> QR</Button>
                <Button variant="secondary" size="sm" className="flex-1" onClick={shareLink}><Share2 className="mr-1.5 size-3.5" /> 공유</Button>
              </div>
              {showQr && cs.syncLink && (
                <div className="flex flex-col items-center gap-1.5 pt-1">
                  <SyncQr value={cs.syncLink} />
                  <p className="text-[11px] text-muted-foreground">다른 기기 카메라로 스캔</p>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-2 pt-1 border-t border-border/50">
              <Button variant="brand" onClick={async () => { await cs.pushNow(); }} disabled={cs.syncing}>
                {cs.syncing ? <Loader2 className="mr-2 size-4 animate-spin" /> : <CloudUpload className="mr-2 size-4" />} 지금 백업
              </Button>
              {!confirmPull ? (
                <Button variant="secondary" onClick={() => setConfirmPull(true)} disabled={cs.syncing}>
                  <CloudDownload className="mr-2 size-4" /> 클라우드 → 이 기기 불러오기
                </Button>
              ) : (
                <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 space-y-2">
                  <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                    <AlertTriangle className="size-3.5" /> 이 기기의 현재 자산을 클라우드 데이터로 덮어씁니다.
                  </p>
                  <div className="flex gap-2">
                    <Button className="flex-1 bg-destructive text-destructive-foreground hover:bg-destructive/90 border-none" onClick={doPull} disabled={cs.syncing}>
                      {cs.syncing ? <Loader2 className="mr-2 size-4 animate-spin" /> : null} 덮어쓰기
                    </Button>
                    <Button variant="secondary" className="flex-1" onClick={() => setConfirmPull(false)} disabled={cs.syncing}>취소</Button>
                  </div>
                </div>
              )}
              <Button variant="ghost" size="sm" className="text-xs text-muted-foreground" onClick={cs.forget}>
                <Lock className="mr-1.5 size-3.5" /> 이 기기 연결 해제
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
