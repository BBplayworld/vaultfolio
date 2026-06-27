"use client";

/**
 * 더보기 > 클라우드 동기화 진입점.
 * 상태·동기화 로직은 CloudSyncProvider(useCloudSync)에 위임 — 이 컴포넌트는 UI만.
 *
 * 상태별 UI: none(동기화 시작) / locked(금고 암호로 잠금 해제) / armed(링크·QR·공유 + 백업/불러오기).
 */

import { useState, useEffect } from "react";
import {
  Cloud, CloudUpload, CloudDownload, Loader2, KeyRound, AlertTriangle, RefreshCw, Lock, Copy, QrCode, Share2, Link2, Sparkles,
} from "lucide-react";
import { toast } from "sonner";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useCloudSync } from "@/lib/cloud-sync/cloud-sync-provider";
import { SyncQr } from "./sync-qr";

function validatePassphrase(passphrase: string): { ok: boolean; message?: string } {
  if (!passphrase) {
    return { ok: false, message: "금고 암호를 입력해주세요." };
  }
  if (passphrase.length < 8) {
    return { ok: false, message: "금고 암호는 최소 8자리 이상이어야 합니다." };
  }
  if (passphrase.length > 50) {
    return { ok: false, message: "금고 암호는 최대 50자리 이하이어야 합니다." };
  }

  // 소문자, 숫자, 특수문자 필수 포함 검사
  const hasLowercase = /[a-z]/.test(passphrase);
  const hasNumber = /[0-9]/.test(passphrase);
  const hasSpecial = /[^A-Za-z0-9]/.test(passphrase);

  if (!hasLowercase || !hasNumber || !hasSpecial) {
    return {
      ok: false,
      message: "금고 암호는 영문 소문자, 숫자, 특수문자를 각각 최소 1자 이상 포함해야 합니다."
    };
  }

  return { ok: true };
}

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

  useEffect(() => {
    if (open) {
      setPassphrase("");
      setRemember(true);
      setBusy(false);
      setShowQr(false);
      setConfirmPull(false);
    }
  }, [open]);

  if (!cs.enabled) return null;

  const resetLocal = () => { setPassphrase(""); setConfirmPull(false); setShowQr(false); };

  const doEnable = async () => {
    const valPass = validatePassphrase(passphrase);
    if (!valPass.ok) {
      toast.error(valPass.message);
      return;
    }
    setBusy(true);
    const r = await cs.enableSync(passphrase, remember);
    setBusy(false);
    if (r.ok) { toast.success("기기 동기화가 켜졌습니다."); setPassphrase(""); }
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

  const copySyncCode = async () => {
    if (!cs.assetId) return;
    try {
      await navigator.clipboard.writeText(`sync:${cs.assetId}`);
      toast.success("동기화 코드가 복사되었습니다.");
    } catch {
      toast.error("복사에 실패했습니다.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) resetLocal(); }}>
      <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto touch-pan-y">
        <DialogHeader className="text-left">
          <DialogTitle className="flex items-center gap-2">
            <Cloud className="size-5 text-primary" /> 기기 동기화
            <span className="rounded-md bg-primary/15 px-1.5 py-0.5 text-[11px] font-bold text-primary">Plus</span>
            <span className="rounded-md bg-muted px-1.5 py-0.5 text-[9px] font-semibold text-muted-foreground">베타 무료</span>
          </DialogTitle>
          <DialogDescription className="text-left">
            새 기기로 자산을 안전하게 전달하고(공유), 실시간으로 데이터를 일치시킵니다(지속 자동 동기화). 서버는 E2EE 암호문만 보관하므로 금고 암호 없이는 열 수 없습니다.
          </DialogDescription>
        </DialogHeader>


        {/* none: 동기화 시작 */}
        {cs.status === "none" && (
          <div className="space-y-3 py-1">
            {/* Plus 프로모션 넛지 — 가치 인지 + 베타 무료 안내 */}
            <div className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2.5 space-y-1">
              <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Sparkles className="size-3.5 text-primary" /> 언제 어디서나 안전하게 기록을 이어가세요
              </p>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                베타 무료 기간입니다.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm flex items-center gap-1.5"><KeyRound className="size-3.5 text-primary" /> 금고 암호</Label>
              <Input
                type="password"
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
                placeholder="영문 소문자, 숫자, 특수문자 포함 8~50자"
                onKeyDown={(e) => { if (e.key === "Enter") doEnable(); }}
              />
              <p className="text-[11px] text-muted-foreground">
                설정 조건: <span className="text-foreground font-semibold">8~50자, 영문 소문자 + 숫자 + 특수문자 필수 포함</span>
              </p>
              <p className="text-[11px] text-muted-foreground">저장·전송되지 않습니다. <span className="text-foreground">잊으면 복구할 수 없으니</span> 꼭 기억하세요.</p>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox checked={remember} onCheckedChange={(v) => setRemember(!!v)} />
              <span className="text-sm">이 기기 기억하기 <span className="text-muted-foreground">(공용 PC면 해제)</span></span>
            </label>
            <Button variant="brand" className="w-full" onClick={doEnable} disabled={busy || !passphrase}>
              {busy ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Cloud className="mr-2 size-4" />} 동기화 시작
            </Button>

            <div className="border-t border-border/50 pt-3 mt-3 flex flex-col gap-2">
              <p className="text-[11px] text-muted-foreground text-center">다른 기기에서 이미 기기 동기화를 사용 중이신가요?</p>
              <Button
                variant="outline"
                className="w-full text-xs gap-1.5"
                onClick={() => {
                  onOpenChange(false);
                  cs.setShowConnectDialog(true);
                }}
              >
                <Link2 className="size-3.5" /> 기존 기기 동기화 연결
              </Button>
            </div>
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
              이 기기 연결 끊기(다른 금고로 새로 시작)
            </Button>
          </div>
        )}

        {/* armed: 링크/QR/공유 + 동기화 */}
        {cs.status === "armed" && (
          <div className="space-y-4 py-1">
            <div className="rounded-md bg-primary/5 border border-primary/20 px-3 py-2 text-xs flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-foreground font-medium">
                <RefreshCw className={`size-3.5 text-primary ${cs.syncing ? "animate-spin" : ""}`} />
                자동 동기화 켜짐{cs.syncing ? " · 동기화 중…" : ""}
              </span>
              <span className="text-muted-foreground">{cs.lastSyncedAt ? new Date(cs.lastSyncedAt).toLocaleTimeString("ko-KR") : "-"}</span>
            </div>

            {/* 카드 1: 다른 기기 동기화 링크 */}
            <div className="rounded-lg border border-border bg-card/50 p-3 space-y-2.5">
              <Label className="text-sm font-semibold flex items-center gap-1.5 text-foreground">
                <Link2 className="size-3.5 text-primary" /> 다른 기기 동기화 링크
              </Label>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                이 링크를 다른 기기에서 열어 연동하거나, <strong>기기 분실 및 로컬 데이터 초기화 시 복구용</strong>으로 백업해 두세요. 금고 암호와 이 링크가 모두 있어야 복구가 가능합니다.
              </p>
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" className="flex-1 text-xs" onClick={copyLink}>
                  <Copy className="mr-1 size-3" /> 복사
                </Button>
                <Button variant="secondary" size="sm" className="flex-1 text-xs" onClick={() => setShowQr((v) => !v)}>
                  <QrCode className="mr-1 size-3" /> QR 코드
                </Button>
                <Button variant="secondary" size="sm" className="flex-1 text-xs" onClick={shareLink}>
                  <Share2 className="mr-1 size-3" /> 공유
                </Button>
              </div>
              {showQr && cs.syncLink && (
                <div className="flex flex-col items-center gap-1.5 pt-2 border-t border-border/50">
                  <SyncQr value={cs.syncLink} />
                  <p className="text-[11px] text-muted-foreground">다른 기기 카메라로 스캔</p>
                </div>
              )}
            </div>

            {/* 카드 2: 동기화 코드 (Sync Code) */}
            <div className="rounded-lg border border-border bg-card/50 p-3 space-y-2.5">
              <Label className="text-sm font-semibold flex items-center gap-1.5 text-foreground">
                <KeyRound className="size-3.5 text-primary" /> PWA/네이티브 앱 연동 코드
              </Label>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                PWA 앱이나 네이티브 앱 최초 설치 시 (또는 초기화 후) 아래의 동기화 코드를 붙여넣어 자산을 즉시 복원하고 연동할 수 있습니다.
              </p>
              <div className="flex gap-1.5 items-center">
                <Input
                  readOnly
                  value={`sync:${cs.assetId}`}
                  className="font-mono text-xs text-center select-all bg-muted/40 h-8 flex-1"
                />
                <Button variant="secondary" size="sm" className="shrink-0 h-8 w-8 p-0" onClick={copySyncCode}>
                  <Copy className="size-3.5" />
                </Button>
              </div>
            </div>

            <div className="flex flex-col gap-2 pt-2 border-t border-border/50">
              <Button variant="brand" onClick={async () => { await cs.pushNow(); }} disabled={cs.syncing}>
                {cs.syncing ? <Loader2 className="mr-2 size-4 animate-spin" /> : <CloudUpload className="mr-2 size-4" />} 지금 동기화
              </Button>
              {!confirmPull ? (
                <Button variant="secondary" onClick={() => setConfirmPull(true)} disabled={cs.syncing}>
                  <CloudDownload className="mr-2 size-4" /> 기기 데이터 가져오기
                </Button>
              ) : (
                <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 space-y-2">
                  <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                    <AlertTriangle className="size-3.5" /> 이 기기의 현재 자산을 클라우드 데이터로 덮어씁니다.
                  </p>
                  <div className="flex gap-2">
                    <Button className="flex-1 bg-destructive text-destructive-foreground hover:bg-destructive/90 border-none text-xs" onClick={doPull} disabled={cs.syncing}>
                      {cs.syncing ? <Loader2 className="mr-2 size-4 animate-spin" /> : null} 덮어쓰기
                    </Button>
                    <Button variant="secondary" className="flex-1 text-xs" onClick={() => setConfirmPull(false)} disabled={cs.syncing}>취소</Button>
                  </div>
                </div>
              )}
              <Button variant="ghost" size="sm" className="text-xs text-muted-foreground" onClick={cs.forget}>
                <Lock className="mr-1.5 size-3.5" /> 이 기기 연결 끊기
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
