"use client";

/**
 * 링크(#sync=, 구 #asset=) 진입 시 자동으로 뜨는 "이 기기 연결" 모달.
 * 메뉴 탐색 없이 금고 암호만 입력하면 자산을 불러와 동기화 시작(비숙련자 배려).
 * 항상 마운트 — 현재 화면과 무관하게 표시(layout에서 Provider 하위 렌더).
 */

import { useState, useEffect } from "react";
import { Cloud, Loader2, KeyRound, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useCloudSync } from "@/lib/cloud-sync/cloud-sync-provider";
import { useAssetData } from "@/contexts/asset-data-context";

function validateSyncCode(input: string): { ok: boolean; assetId?: string; message?: string } {
  const trimmed = input.trim();
  if (!trimmed) {
    return { ok: false, message: "동기화 코드를 입력해주세요." };
  }

  // 1. URL/주소 형식 검사 (슬래시, 물음표, 해시 차단)
  if (trimmed.includes("/") || trimmed.includes("#") || trimmed.includes("?")) {
    return { ok: false, message: "올바르지 않은 코드 형식입니다. 복구 링크는 브라우저 주소창에 직접 입력해 접속해 주세요." };
  }

  let assetId = trimmed;
  if (trimmed.startsWith("sync:")) {
    assetId = trimmed.slice(5).trim();
  }

  // assetId 정규식 검사 (알파벳, 숫자, -, _ 로 이루어진 20~24자)
  const assetIdRegex = /^[A-Za-z0-9-_]{20,24}$/;
  if (!assetIdRegex.test(assetId)) {
    return { ok: false, message: "동기화 코드 포맷이 올바르지 않습니다. (예: sync:xxxx...)" };
  }

  return { ok: true, assetId };
}

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

export function CloudSyncConnectDialog() {
  const cs = useCloudSync();
  const { assetData } = useAssetData();
  const [syncCode, setSyncCode] = useState("");
  const [passphrase, setPassphrase] = useState("");
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState(false);

  const hasAssets =
    assetData.realEstate.length > 0 ||
    assetData.stocks.length > 0 ||
    assetData.crypto.length > 0 ||
    assetData.cash.length > 0 ||
    assetData.loans.length > 0;

  const isManual = !cs.pendingConnectAssetId;
  const open = cs.enabled && cs.showConnectDialog;

  useEffect(() => {
    if (open) {
      setSyncCode("");
      setPassphrase("");
      setRemember(true);
      setBusy(false);
    }
  }, [open]);

  const doConnect = async () => {
    let targetAssetId = cs.pendingConnectAssetId;
    if (isManual) {
      const valCode = validateSyncCode(syncCode);
      if (!valCode.ok) {
        toast.error(valCode.message);
        return;
      }
      targetAssetId = valCode.assetId!;
    } else {
      // 링크로 자동 진입했더라도 assetId 형식을 사전 검사
      const valCode = validateSyncCode(`sync:${targetAssetId}`);
      if (!valCode.ok) {
        toast.error("링크의 동기화 코드가 유효하지 않습니다.");
        return;
      }
    }

    if (!targetAssetId) {
      toast.error("동기화 코드가 올바르지 않습니다.");
      return;
    }

    // 금고 암호 포맷 검증
    const valPass = validatePassphrase(passphrase);
    if (!valPass.ok) {
      toast.error(valPass.message);
      return;
    }

    setBusy(true);
    const r = await cs.connect(targetAssetId, passphrase, remember);
    setBusy(false);

    if (r.ok) {
      toast.success("이 기기가 연결되었습니다. 자동 동기화가 시작됩니다.");
      setPassphrase("");
      setSyncCode("");
      cs.clearPendingConnect();
    } else {
      toast.error(r.message || "연결에 실패했습니다. 암호나 코드를 확인해주세요.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { setPassphrase(""); setSyncCode(""); cs.clearPendingConnect(); } }}>
      <DialogContent className="sm:max-w-md touch-pan-y">
        <DialogHeader className="text-left">
          <DialogTitle className="flex items-center gap-2">
            <Cloud className="size-5 text-primary" /> 이 기기 연결
          </DialogTitle>
          <DialogDescription className="text-left">
            금고 암호{isManual ? "와 동기화 코드" : ""}를 입력하면 클라우드의 자산을 이 기기로 불러오고 자동 동기화를 시작합니다.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-1">
          {isManual ? (
            <div className="space-y-1.5">
              <Label className="text-sm flex items-center gap-1.5">
                <KeyRound className="size-3.5 text-primary" /> 동기화 코드 (Sync Code)
              </Label>
              <Input
                type="text"
                value={syncCode}
                onChange={(e) => setSyncCode(e.target.value)}
                placeholder="sync:xxxx... 또는 22자리 코드"
                onKeyDown={(e) => { if (e.key === "Enter") doConnect(); }}
                autoFocus
              />
              <p className="text-[11px] text-muted-foreground">다른 기기 설정에서 복사한 동기화 코드를 입력하세요.</p>
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label className="text-sm flex items-center gap-1.5">
                <KeyRound className="size-3.5 text-primary" /> 동기화 코드 (Sync Code)
              </Label>
              <Input
                readOnly
                value={`sync:${cs.pendingConnectAssetId}`}
                className="font-mono text-xs text-center select-all bg-muted/40 h-9"
              />
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-sm flex items-center gap-1.5">
              <KeyRound className="size-3.5 text-primary" /> 금고 암호
            </Label>
            <Input
              type="password"
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              placeholder="동기화 켤 때 정한 금고 암호"
              onKeyDown={(e) => { if (e.key === "Enter") doConnect(); }}
              autoFocus={!isManual}
            />
            <p className="text-[11px] text-muted-foreground">암호는 저장·전송되지 않습니다. 틀리면 불러올 수 없습니다.</p>
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <Checkbox checked={remember} onCheckedChange={(v) => setRemember(!!v)} />
            <span className="text-sm">이 기기 기억하기 <span className="text-muted-foreground">(공용 PC면 해제)</span></span>
          </label>

          {hasAssets && (
            <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3">
              <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                <AlertTriangle className="size-4 shrink-0 text-amber-500" />
                연결 시 이 기기의 현재 자산이 삭제되고 클라우드 데이터로 대체됩니다.
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          {hasAssets ? (
            <Button
              variant="brand"
              onClick={doConnect}
              disabled={busy || !passphrase || (isManual && !syncCode.trim())}
              className="flex-1 sm:flex-initial bg-destructive text-destructive-foreground hover:bg-destructive/90 border-none"
            >
              {busy ? <Loader2 className="mr-2 size-4 animate-spin" /> : null} 기존 자산 덮어쓰고 연결하기
            </Button>
          ) : (
            <Button
              variant="brand"
              onClick={doConnect}
              disabled={busy || !passphrase || (isManual && !syncCode.trim())}
              className="flex-1 sm:flex-initial"
            >
              {busy ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Cloud className="mr-2 size-4" />} 연결하기
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() => { setPassphrase(""); setSyncCode(""); cs.clearPendingConnect(); }}
            className="flex-1 sm:flex-initial"
          >
            취소
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
