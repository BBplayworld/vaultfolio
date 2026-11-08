"use client";

import { useEffect, useState, useRef } from "react";
import { track, trackThemeMode } from "@/lib/analytics/ga";
import { Moon, RefreshCw, Trash2, ShieldCheck } from "lucide-react";
import { APP_CONFIG } from "@/config/app";
import { persistThemeModeCookie, updateThemeMode } from "@/lib/theme-utils";
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
import { clearAssetData, clearUserCaches } from "@/lib/asset/asset-storage";
import { clearBackupStatus } from "@/lib/asset/backup-status";
import { clearAssetRefreshStatus } from "@/lib/asset/asset-refresh-status";
import { APP_VERSION } from "@/config/app-version";
import { InlineSelector } from "../layout/ui/inline-selector";
import { InfoHint } from "../layout/ui/info-hint";
import { useProfitBasisStore } from "@/stores/profit-basis-store";
import type { ProfitBasis } from "@/lib/finance/profit-utils";
import { useAssetData } from "@/contexts/asset-data-context";
import { useCloudSync } from "@/lib/cloud-sync/cloud-sync-provider";
import { MENU_COLUMN, MENU_ROW, MENU_ROW_DESTRUCTIVE, MENU_SECTION_LABEL, MENU_ICON, MENU_LABEL, MENU_DESC, menuBadge } from "./menu-styles";
import { isPwaAuthEnabled, setPwaAuthPin, disablePwaAuth, verifyPwaAuthPin } from "@/lib/pwa/app-lock";

export function SettingsPage() {
  const { refreshData, assetData } = useAssetData();
  const cs = useCloudSync();
  const themeMode = usePreferencesStore((s) => s.themeMode);
  const setThemeMode = usePreferencesStore((s) => s.setThemeMode);

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
  const [pwaAuthEnabled, setPwaAuthEnabled] = useState(false);

  const [mounted, setMounted] = useState(false);
  const otpRef = useRef<HTMLInputElement>(null);

  // GA 수집 제외 숨김 트리거: '화면' 라벨 7회 연속 탭 → ga-optout 토글 (본인 전용)
  const gaTapRef = useRef({ count: 0, timer: 0 });
  const handleGaOptoutTap = () => {
    const s = gaTapRef.current;
    window.clearTimeout(s.timer);
    s.count += 1;
    s.timer = window.setTimeout(() => (s.count = 0), 3000);
    if (s.count < 7) return;
    s.count = 0;
    const on = localStorage.getItem("ga-optout") === "1";
    if (on) {
      localStorage.removeItem("ga-optout");
      window[`ga-disable-${APP_CONFIG.gaId}`] = false;
      toast.success("GA 수집 제외 OFF");
    } else {
      localStorage.setItem("ga-optout", "1");
      window[`ga-disable-${APP_CONFIG.gaId}`] = true;
      toast.success("GA 수집 제외 ON");
    }
  };

  useEffect(() => {
    if (showAuthDialog) {
      setTimeout(() => otpRef.current?.focus(), 150);
    }
  }, [showAuthDialog]);

  useEffect(() => {
    setMounted(true);
    setPwaAuthEnabled(isPwaAuthEnabled());
  }, []);

  const handleToggleTheme = () => {
    const next = themeMode === "dark" ? "light" : "dark";
    updateThemeMode(next);
    setThemeMode(next);
    persistThemeModeCookie(next);
    track("feature_use", { category: "theme", method: "toggle" });
    trackThemeMode(next);
  };

  const handleClearCache = () => {
    const count = clearUserCaches();
    refreshData();
    toast.success(`캐시 ${count}개를 초기화했습니다.`);
    track("data_action", { method: "clear_cache", source: "settings", result: "success" });
  };

  // 종가 기준 — 성과 탭에만 있던 설정값을 설정 화면에서도 바꿀 수 있게 노출
  const profitBasis = useProfitBasisStore((s) => s.basis);
  const profitBasisHydrated = useProfitBasisStore((s) => s.hydrated);
  const setProfitBasis = useProfitBasisStore((s) => s.setBasis);
  const hydrateProfitBasis = useProfitBasisStore((s) => s.hydrate);
  useEffect(() => { hydrateProfitBasis(); }, [hydrateProfitBasis]);

  const handleClear = () => {
    // 동기화 연결을 먼저 해제(forget) → 빈 자산이 클라우드로 자동 push되어 백업이
    // 덮어써지는 것을 차단한다. 클라우드 금고 자체는 보존(다른 기기·재연결로 복구 가능).
    cs.forget();
    const success = clearAssetData();
    // clearAssetData는 백업 시각을 보존하지만(가져오기 경로 보호), 전체 삭제는 사용자의
    // 명시적 의도이므로 여기서만 함께 지운다 — 남은 데이터가 없으니 "백업함" 상태도 무의미.
    clearBackupStatus();
    // 자산 최신화 이력도 동일 이유로 함께 제거 — 남은 자산이 없으니 "최신화함" 상태도 무의미
    clearAssetRefreshStatus();
    if (success) {
      refreshData();
      toast.success("모든 자산 데이터가 삭제되었습니다.");
    } else {
      toast.error("데이터 삭제에 실패했습니다.");
    }
    track("data_action", { method: "clear_all", source: "settings", result: success ? "success" : "fail" });
    setShowClearDialog(false);
  };

  const handleToggleAuth = () => {
    setAuthPin("");
    setAuthMode(pwaAuthEnabled ? "disable" : "enable");
    setShowAuthDialog(true);
  };

  const handleAuthSubmit = async () => {
    if (authPin.length !== 4) {
      toast.error("PIN 번호 4자리를 입력해주세요.");
      return;
    }
    if (authMode === "enable") {
      await setPwaAuthPin(authPin);
      setPwaAuthEnabled(true);
      toast.success("앱 잠금이 활성화되었습니다.");
      track("app_lock", { method: "enable", result: "success" });
      setShowAuthDialog(false);
    } else {
      const ok = await verifyPwaAuthPin(authPin);
      if (!ok) {
        toast.error("비밀번호가 일치하지 않습니다.");
        track("app_lock", { method: "disable", result: "pin_mismatch" });
        setAuthPin("");
        setTimeout(() => otpRef.current?.focus(), 100);
        return;
      }
      disablePwaAuth();
      setPwaAuthEnabled(false);
      toast.success("앱 잠금이 해제되었습니다.");
      track("app_lock", { method: "disable", result: "success" });
      setShowAuthDialog(false);
    }
  };

  if (!mounted) return null;

  return (
    <>
      <div className={MENU_COLUMN}>
        <section data-testid="settings-section-security">
          <p className={MENU_SECTION_LABEL}>보안</p>
          <div className="flex flex-col gap-2">
            <button type="button" className={MENU_ROW} aria-pressed={pwaAuthEnabled} onClick={handleToggleAuth}>
              <ShieldCheck className={MENU_ICON} />
              <div className="flex-1 min-w-0">
                <span className={MENU_LABEL}>앱 잠금 설정 (App Lock)</span>
                <p className={MENU_DESC}>앱 실행 시 4자리 PIN 번호 잠금</p>
              </div>
              <span className={menuBadge(pwaAuthEnabled)}>
                {pwaAuthEnabled ? "ON" : "OFF"}
              </span>
            </button>
          </div>
        </section>

        <section data-testid="settings-section-screen">
          <p className={MENU_SECTION_LABEL} onClick={handleGaOptoutTap}>화면</p>
          <div className="flex flex-col gap-2">
            <button type="button" data-testid="settings-row-theme" className={MENU_ROW} aria-pressed={themeMode === "dark"} onClick={handleToggleTheme}>
              <Moon className={MENU_ICON} />
              <span className={`${MENU_LABEL} flex-1`}>다크 모드</span>
              <span data-testid="settings-theme-badge" className={menuBadge(themeMode === "dark")}>
                {themeMode === "dark" ? "ON" : "OFF"}
              </span>
            </button>
          </div>
        </section>

        <section data-testid="settings-section-display">
          <p className={MENU_SECTION_LABEL}>표시</p>
          <div className="px-4 py-3 rounded-xl bg-card shadow-xs space-y-2">
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-medium">기간 수익 종가 기준</span>
              <InfoHint summary="국내·해외 종가를 어느 날짜로 묶어 합산할지 정하는 기준이에요.">
                <p><span className="font-semibold text-foreground">동일 영업일</span> — 국내·해외를 같은 영업일의 종가로 합산합니다. (해외는 익일 새벽 마감)</p>
                <p><span className="font-semibold text-foreground">KST 접속일</span> — KST 접속일 기준으로 국내·해외 각 시장의 종가를 합산합니다.</p>
              </InfoHint>
            </div>
            {/* hydrate 전에는 기본값이 렌더돼 실제 설정과 어긋나므로 확정 후 노출 */}
            {profitBasisHydrated && (
              <InlineSelector
                value={profitBasis}
                onChange={(v) => setProfitBasis(v as ProfitBasis)}
                options={[
                  { value: "sameBusinessDay", label: "동일 영업일" },
                  { value: "kstAccessDay", label: "KST 접속일" },
                ]}
                size="sm"
                className="relative z-10"
                ariaLabel="기간 수익 종가 기준"
              />
            )}
          </div>
        </section>

        <section data-testid="settings-section-data">
          <p className={MENU_SECTION_LABEL}>데이터</p>
          <div className="flex flex-col gap-2">
            <button type="button" data-testid="settings-row-clear-cache" className={MENU_ROW} onClick={handleClearCache} disabled={!hasAssets}>
              <RefreshCw className={MENU_ICON} />
              <div className="flex-1 min-w-0">
                <span className={MENU_LABEL}>캐시 초기화</span>
                <p className={MENU_DESC}>수익·환율 캐시 재설정</p>
              </div>
            </button>
            <button type="button" data-testid="settings-row-delete-all" className={MENU_ROW_DESTRUCTIVE} onClick={() => setShowClearDialog(true)} disabled={!hasAssets}>
              <Trash2 className="size-5 shrink-0" />
              <span className="font-medium">모든 데이터 삭제</span>
            </button>
          </div>
        </section>

        <section data-testid="settings-section-version">
          <p className={MENU_SECTION_LABEL}>버전</p>
          <div className="px-4 py-3 rounded-xl bg-card shadow-xs">
            <p className="text-sm text-muted-foreground tabular-nums">v{APP_VERSION}</p>
          </div>
        </section>
      </div>

      <AlertDialog open={showClearDialog} onOpenChange={setShowClearDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>정말 모든 데이터를 삭제하시겠습니까?</AlertDialogTitle>
            <AlertDialogDescription>
              이 작업은 되돌릴 수 없습니다. 모든 자산 데이터가 영구적으로 삭제됩니다.
              {cs.status !== "none" && " 기기 동기화 연결도 끊어집니다. 동기화 데이터는 보존되어 재연결 시 복구할 수 있습니다."}
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
              {authMode === "enable" ? "앱 잠금 설정 (App Lock)" : "앱 잠금 해제"}
            </DialogTitle>
            <DialogDescription>
              {authMode === "enable"
                ? "앱 실행 시 기기 보호를 위해 입력할 4자리 PIN 비밀번호를 설정합니다. (설치 시 사용했던 데이터 전송용 PIN과는 무관한 독립된 잠금 장치입니다)"
                : "현재 비밀번호를 입력하여 앱 잠금을 해제합니다."}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col items-center justify-center space-y-4 py-4">
            <div className="flex flex-col items-center gap-3 space-y-2">
              <Label className="text-sm font-medium">
                비밀번호 (4자리)
              </Label>
              <InputOTP ref={otpRef} maxLength={4} value={authPin} onChange={setAuthPin}>
                <InputOTPGroup>
                  <InputOTPSlot index={0} />
                  <InputOTPSlot index={1} />
                  <InputOTPSlot index={2} />
                  <InputOTPSlot index={3} />
                </InputOTPGroup>
              </InputOTP>
            </div>
          </div>

          <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button
              variant="brand"
              onClick={handleAuthSubmit}
              disabled={authPin.length !== 4}
              type="button"
            >
              {authMode === "enable" ? "설정 완료" : "앱 잠금 해제"}
            </Button>
            <Button variant="secondary" onClick={() => setShowAuthDialog(false)}>
              취소
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
