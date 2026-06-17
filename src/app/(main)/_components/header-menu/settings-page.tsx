"use client";

import { useEffect, useState } from "react";
import { Moon, Sun, RefreshCw, Trash2, ShieldCheck, Upload, Download } from "lucide-react";
import { ASSET_THEME } from "@/config/theme";
import { updateThemeMode } from "@/lib/theme-utils";
import { setValueToCookie } from "@/server/server-actions";
import { usePreferencesStore } from "@/stores/preferences/preferences-provider";
import { toast } from "sonner";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Label } from "@/components/ui/label";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { clearAssetData, clearUserCaches, exportAssetData } from "@/lib/asset-storage";
import { useAssetData } from "@/contexts/asset-data-context";
import { useCloudSync } from "@/lib/cloud-sync/cloud-sync-provider";
import { useAssetImport } from "@/hooks/use-asset-import";
import { isPwaAuthEnabled, setPwaAuthPin, disablePwaAuth, verifyPwaAuthPin } from "../pwa/pwa-lock-screen";

export function SettingsPage() {
  const { refreshData, assetData } = useAssetData();
  const cs = useCloudSync();
  const themeMode = usePreferencesStore((s) => s.themeMode);
  const setThemeMode = usePreferencesStore((s) => s.setThemeMode);
  const { fileInputRef, isImporting, openFilePicker, handleFileChange } = useAssetImport();

  const hasAssets =
    assetData.realEstate.length > 0 ||
    assetData.stocks.length > 0 ||
    assetData.crypto.length > 0 ||
    assetData.cash.length > 0 ||
    assetData.loans.length > 0;

  const [showClearDialog, setShowClearDialog] = useState(false);
  const [showAuthDialog, setShowAuthDialog] = useState(false);
  const [authMode, setAuthMode] = useState<"enable" | "disable">("enable");
  const [authPin, setAuthPin] = useState("");
  const [authPinConfirm, setAuthPinConfirm] = useState("");
  const [authStep, setAuthStep] = useState<"pin" | "confirm">("pin");
  const [pwaAuthEnabled, setPwaAuthEnabled] = useState(false);

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
    setPwaAuthEnabled(isPwaAuthEnabled());
  }, []);

  const handleToggleTheme = async () => {
    const next = themeMode === "dark" ? "light" : "dark";
    updateThemeMode(next);
    setThemeMode(next);
    await setValueToCookie("theme_mode", next);
  };

  const handleClearCache = () => {
    const count = clearUserCaches();
    refreshData();
    toast.success(`캐시 ${count}개를 초기화했습니다.`);
  };

  const handleExport = () => {
    try {
      exportAssetData();
      toast.success("자산 데이터가 다운로드되었습니다.");
      window.dispatchEvent(new CustomEvent("tutorial-complete-step2"));
    } catch (error) {
      toast.error("데이터 내보내기에 실패했습니다.");
    }
  };

  const handleClear = () => {
    // 동기화 연결을 먼저 해제(forget) → 빈 자산이 클라우드로 자동 push되어 백업이
    // 덮어써지는 것을 차단한다. 클라우드 금고 자체는 보존(다른 기기·재연결로 복구 가능).
    cs.forget();
    const success = clearAssetData();
    if (success) {
      refreshData();
      toast.success("모든 자산 데이터가 삭제되었습니다.");
    } else {
      toast.error("데이터 삭제에 실패했습니다.");
    }
    setShowClearDialog(false);
  };

  const handleToggleAuth = () => {
    setAuthPin("");
    setAuthPinConfirm("");
    setAuthStep("pin");
    setAuthMode(pwaAuthEnabled ? "disable" : "enable");
    setShowAuthDialog(true);
  };

  const handleAuthSubmit = async () => {
    if (authMode === "enable") {
      if (authStep === "pin") {
        if (authPin.length !== 4) {
          toast.error("PIN 번호 4자리를 입력해주세요.");
          return;
        }
        setAuthStep("confirm");
        setAuthPinConfirm("");
        return;
      }
      if (authPinConfirm !== authPin) {
        toast.error("비밀번호가 일치하지 않습니다.");
        setAuthPinConfirm("");
        return;
      }
      await setPwaAuthPin(authPin);
      setPwaAuthEnabled(true);
      toast.success("웹앱 인증이 활성화되었습니다.");
      setShowAuthDialog(false);
    } else {
      if (authPin.length !== 4) {
        toast.error("PIN 번호 4자리를 입력해주세요.");
        return;
      }
      const ok = await verifyPwaAuthPin(authPin);
      if (!ok) {
        toast.error("비밀번호가 일치하지 않습니다.");
        setAuthPin("");
        return;
      }
      disablePwaAuth();
      setPwaAuthEnabled(false);
      toast.success("웹앱 인증이 해제되었습니다.");
      setShowAuthDialog(false);
    }
  };

  if (!mounted) return null;

  const ROW = "w-full flex items-center gap-3 px-4 py-3.5 rounded-xl border bg-card hover:bg-accent transition-colors text-left disabled:opacity-50 disabled:cursor-not-allowed";
  const ROW_DESTRUCTIVE = "w-full flex items-center gap-3 px-4 py-3.5 rounded-xl border border-rose-300/40 dark:border-rose-900/40 bg-rose-500/5 hover:bg-rose-500/10 transition-colors text-left text-rose-600 dark:text-rose-400 disabled:opacity-50 disabled:cursor-not-allowed";
  const SECTION_LABEL = `text-xs font-semibold ${ASSET_THEME.primary.text} mb-2 mt-1 px-1`;

  return (
    <>
      <div className="flex flex-col gap-5">
        <section>
          <p className={SECTION_LABEL}>보안</p>
          <div className="flex flex-col gap-2">
            <button type="button" className={ROW} onClick={handleToggleAuth}>
              <ShieldCheck className="size-5 text-primary shrink-0" />
              <div className="flex-1 min-w-0">
                <span className="font-medium">웹앱 인증</span>
                <p className="text-[11px] text-muted-foreground mt-0.5">앱 실행 시 비밀번호 입력</p>
              </div>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded ${pwaAuthEnabled ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"}`}>
                {pwaAuthEnabled ? "ON" : "OFF"}
              </span>
            </button>
          </div>
        </section>

        <section>
          <p className={SECTION_LABEL}>화면</p>
          <div className="flex flex-col gap-2">
            <button type="button" className={ROW} onClick={handleToggleTheme}>
              {themeMode === "dark" ? <Sun className="size-5 text-primary shrink-0" /> : <Moon className="size-5 text-primary shrink-0" />}
              <span className="font-medium">{themeMode === "dark" ? "라이트 모드" : "다크 모드"}</span>
            </button>
          </div>
        </section>

        <section>
          <p className={SECTION_LABEL}>데이터</p>
          <div className="flex flex-col gap-2">
            <button type="button" className={ROW} onClick={handleExport} disabled={!hasAssets}>
              <Upload className="size-5 text-primary shrink-0" />
              <div className="flex-1 min-w-0">
                <span className="font-medium">데이터 내보내기</span>
                <p className="text-[11px] text-muted-foreground mt-0.5">현재 자산 데이터를 JSON 파일로 다운로드</p>
              </div>
            </button>
            <button type="button" className={ROW} onClick={openFilePicker} disabled={isImporting}>
              <Download className="size-5 text-primary shrink-0" />
              <div className="flex-1 min-w-0">
                <span className="font-medium">{isImporting ? "데이터 가져오는 중..." : "데이터 가져오기"}</span>
                <p className="text-[11px] text-muted-foreground mt-0.5">JSON 백업 파일로부터 자산 복원</p>
              </div>
            </button>
            <button type="button" className={ROW} onClick={handleClearCache} disabled={!hasAssets}>
              <RefreshCw className="size-5 text-primary shrink-0" />
              <div className="flex-1 min-w-0">
                <span className="font-medium">캐시 초기화</span>
                <p className="text-[11px] text-muted-foreground mt-0.5">수익·환율 캐시 재설정</p>
              </div>
            </button>
            <button type="button" className={ROW_DESTRUCTIVE} onClick={() => setShowClearDialog(true)} disabled={!hasAssets}>
              <Trash2 className="size-5 shrink-0" />
              <span className="font-medium">모든 데이터 삭제</span>
            </button>
          </div>
        </section>
      </div>

      <AlertDialog open={showClearDialog} onOpenChange={setShowClearDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>정말 모든 데이터를 삭제하시겠습니까?</AlertDialogTitle>
            <AlertDialogDescription>
              이 작업은 되돌릴 수 없습니다. 모든 자산 데이터가 영구적으로 삭제됩니다.
              {cs.status !== "none" && " 클라우드 동기화 연결도 해제됩니다. 클라우드 백업은 보존되어 재연결 시 복구할 수 있습니다."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <AlertDialogAction onClick={handleClear} className="bg-destructive text-destructive-foreground hover:bg-destructive/90 border-none">
              삭제
            </AlertDialogAction>
            <AlertDialogCancel>취소</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={showAuthDialog} onOpenChange={setShowAuthDialog}>
        <DialogContent className="sm:max-w-md touch-pan-y">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="size-5 text-primary" />
              {authMode === "enable" ? "웹앱 인증 설정" : "웹앱 인증 해제"}
            </DialogTitle>
            <DialogDescription>
              {authMode === "enable"
                ? "PWA 앱 실행 시 매번 비밀번호를 입력해야 합니다."
                : "현재 비밀번호를 입력하여 인증을 해제합니다."}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col items-center justify-center space-y-4 py-4">
            <div className="flex flex-col items-center gap-3 space-y-2">
              <Label className="text-sm font-medium">
                {authMode === "enable" && authStep === "confirm"
                  ? "비밀번호 확인"
                  : "비밀번호 (4자리)"}
              </Label>
              {authMode === "enable" && authStep === "confirm" ? (
                <InputOTP maxLength={4} value={authPinConfirm} onChange={setAuthPinConfirm}>
                  <InputOTPGroup>
                    <InputOTPSlot index={0} />
                    <InputOTPSlot index={1} />
                    <InputOTPSlot index={2} />
                    <InputOTPSlot index={3} />
                  </InputOTPGroup>
                </InputOTP>
              ) : (
                <InputOTP maxLength={4} value={authPin} onChange={setAuthPin}>
                  <InputOTPGroup>
                    <InputOTPSlot index={0} />
                    <InputOTPSlot index={1} />
                    <InputOTPSlot index={2} />
                    <InputOTPSlot index={3} />
                  </InputOTPGroup>
                </InputOTP>
              )}
            </div>
          </div>

          <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button
              variant="brand"
              onClick={handleAuthSubmit}
              disabled={
                authMode === "enable"
                  ? authStep === "pin" ? authPin.length !== 4 : authPinConfirm.length !== 4
                  : authPin.length !== 4
              }
              type="button"
            >
              {authMode === "enable" && authStep === "pin" ? "다음" : authMode === "enable" ? "설정 완료" : "인증 해제"}
            </Button>
            <Button variant="outline" onClick={() => setShowAuthDialog(false)}>
              취소
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <input
        ref={fileInputRef}
        type="file"
        accept="application/json"
        onChange={handleFileChange}
        className="hidden"
      />
    </>
  );
}
