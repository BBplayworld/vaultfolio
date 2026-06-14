"use client";

import { useState, useEffect } from "react";
import { Download, Share, Lock, Unlock, Loader2 } from "lucide-react";
import { usePWAInstall } from "@/hooks/use-pwa-install";
import { useAssetData } from "@/contexts/asset-data-context";
import { MAIN_PALETTE } from "@/config/theme";
import { generateShareToken, STORAGE_KEYS } from "@/lib/asset-storage";
import { getProfitBasis } from "@/lib/profit-utils";
import { usePreferencesStore } from "@/stores/preferences/preferences-provider";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import type { AssetSnapshots } from "@/types/asset";
import { PwaInstallGuideDialog } from "./pwa-install-guide-dialog";

const ICON_BTN = "inline-flex items-center justify-center h-9 sm:h-11 w-9 sm:w-11 rounded-lg shrink-0 transition-opacity hover:opacity-85";

function collectSnapshots(): AssetSnapshots {
  try {
    const rawDaily = localStorage.getItem(STORAGE_KEYS.dailySnapshots);
    const rawMonthly = localStorage.getItem(STORAGE_KEYS.monthlySnapshots);
    return {
      daily: rawDaily ? JSON.parse(rawDaily) : [],
      monthly: rawMonthly ? JSON.parse(rawMonthly) : [],
    };
  } catch {
    return { daily: [], monthly: [] };
  }
}

export function PwaInstallButton() {
  const { isInstallable, isIOS, isStandalone, prepareInstall, installPWA, setManifestStartUrl, restoreManifest } = usePWAInstall();
  const { assetData, exchangeRates } = useAssetData();
  const themeMode = usePreferencesStore((s) => s.themeMode);
  const [showDialog, setShowDialog] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [ready, setReady] = useState(false);
  const [mounted, setMounted] = useState(false);

  const hasAssets =
    assetData.realEstate.length > 0 ||
    assetData.stocks.length > 0 ||
    assetData.crypto.length > 0 ||
    assetData.cash.length > 0 ||
    assetData.loans.length > 0;

  const nickname = (() => {
    try { return localStorage.getItem(STORAGE_KEYS.nickname) || ""; } catch { return ""; }
  })();

  // 공유 토큰 생성 → 서버 저장 → start_url 구성
  const generateStartUrl = async (): Promise<string | null> => {
    if (!hasAssets) return "/";

    const localKey = Math.random().toString(36).substring(2, 14);
    const token = generateShareToken(
      assetData, exchangeRates, pin || undefined, localKey,
      collectSnapshots(), getProfitBasis(), nickname || undefined,
    );

    const ownerId = localStorage.getItem(STORAGE_KEYS.shareOwnerId) ?? undefined;
    try {
      const res = await fetch("/api/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, owner_id: ownerId }),
      });
      const json = await res.json() as { key?: string; owner_id?: string };
      if (json.owner_id) {
        localStorage.setItem(STORAGE_KEYS.shareOwnerId, json.owner_id);
      }
      if (json.key) {
        return `/#share=s:${json.key}_${localKey}&theme=${themeMode}`;
      }
    } catch {
      // fallback: 서버 실패 시 start_url 없이 설치
    }
    return null;
  };

  // PIN 4자리 입력 완료 시 백그라운드로 설치 준비:
  // 토큰 생성 + manifest 교체 + 재발생 BIP 확보까지 끝내 두어,
  // "설치하기" 클릭 시점엔 사용자 제스처 안에서 await 없이 prompt()만 호출되게 한다.
  // (비-iOS · 자산 보유 시에만)
  useEffect(() => {
    if (!showDialog || isIOS || !hasAssets) return;
    if (pin.length !== 4) { setReady(false); return; }
    let cancelled = false;
    setPreparing(true);
    setReady(false);
    (async () => {
      const startUrl = await generateStartUrl();
      if (cancelled) return;
      const ok = startUrl ? await prepareInstall(startUrl) : false;
      if (cancelled) return;
      setReady(ok);
      setPreparing(false);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showDialog, pin, isIOS, hasAssets]);

  useEffect(() => { setMounted(true); }, []);

  if (!mounted || isStandalone) return null;

  const handleInstall = async () => {
    if (pin.length !== 4) {
      toast.error("PIN 번호 4자리를 입력해주세요.");
      return;
    }

    if (isIOS) {
      setLoading(true);
      try {
        const startUrl = await generateStartUrl();
        if (startUrl) {
          setManifestStartUrl(startUrl);
          const fullUrl = window.location.origin + startUrl;
          if (navigator.share) {
            await navigator.share({
              title: "시크릿에셋",
              text: "서버 저장 없는 나만의 암호화 자산 금고",
              url: fullUrl,
            });
            toast.info("공유 메뉴에서 '홈 화면에 추가'를 선택해 주세요.");
          } else {
            toast.success("공유 버튼을 눌러 '홈 화면에 추가'를 선택해주세요.");
          }
        }
      } catch (err) {
        console.error("iOS 공유 실패:", err);
      } finally {
        setLoading(false);
        setShowDialog(false);
        setTimeout(restoreManifest, 30000);
      }
      return;
    }

    if (!ready) {
      toast.error("설치 준비 중입니다. 잠시 후 다시 시도해주세요.");
      return;
    }

    // Chrome/Edge: 준비된 유효 이벤트로 즉시 프롬프트 (중간 await 없음 → 제스처 유지)
    setLoading(true);
    try {
      const success = await installPWA();
      if (success) {
        toast.success("앱이 설치되었습니다! PWA에서 PIN을 입력하면 데이터가 연동됩니다.");
        setShowDialog(false);
      }
    } catch {
      toast.error("설치 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  // 자산 없이 설치 (빈 상태)
  const handleInstallEmpty = async () => {
    setLoading(true);
    try {
      if (isIOS) {
        if (navigator.share) {
          await navigator.share({
            title: "시크릿에셋",
            text: "서버 저장 없는 나만의 암호화 자산 금고",
            url: window.location.origin + "/",
          });
          toast.info("공유 메뉴에서 '홈 화면에 추가'를 선택해 주세요.");
        } else {
          toast.success("Safari 하단 공유 버튼 → 홈 화면에 추가를 선택해주세요.");
        }
        setShowDialog(false);
        return;
      }
      const success = await installPWA();
      if (success) {
        toast.success("앱이 설치되었습니다!");
        setShowDialog(false);
      }
    } catch {
      toast.error("설치 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const openDialog = () => {
    setPin("");
    setShowDialog(true);
  };

  const handleButtonClick = async () => {
    if (isInstallable || isIOS) {
      if (hasAssets) {
        openDialog();
      } else {
        handleInstallEmpty();
      }
    } else {
      // 설치 불가능 / 기존 설치 레지스트리 잔존 상태 (PC Chrome 고스트 등)
      // PC Chrome/Edge 환경인 경우 주소 자동 복사
      const isMobile = /Mobi|Android|iPhone/i.test(navigator.userAgent);
      if (!isMobile) {
        try {
          await navigator.clipboard.writeText("chrome://apps");
          toast.success("재설치 주소(chrome://apps)가 클립보드에 자동 복사되었습니다! 새 탭을 열어 붙여넣기(Ctrl+V)해 주세요.");
        } catch (err) {
          console.error("클립보드 복사 실패:", err);
        }
      }
      setShowGuide(true);
    }
  };

  return (
    <>
      <button
        onClick={handleButtonClick}
        className={`${ICON_BTN} border-none text-white`}
        style={{ backgroundColor: MAIN_PALETTE[0] }}
        aria-label="앱 설치"
        title="앱 설치"
      >
        <Download className="size-5 sm:size-6" />
      </button>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-md touch-pan-y">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Download className="size-5 text-primary" />
              {isIOS ? "홈 화면에 추가" : "앱 설치"}
            </DialogTitle>
            <DialogDescription asChild>
              <div className="space-y-1 text-sm text-muted-foreground">
                <p>현재 자산 데이터를 앱에 연동합니다.</p>
                <p className="text-xs">
                  PIN으로 암호화된 데이터가 서버를 경유하여 전송됩니다.
                  {isIOS && " 설치 후 앱을 열면 PIN을 입력하여 데이터를 불러옵니다."}
                </p>
              </div>
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col items-center justify-center space-y-4 py-4">
            <div className="flex flex-col items-center gap-3 space-y-2">
              <Label className="text-sm font-medium flex items-center gap-1.5">
                {pin.length === 4 ? <Lock className="size-3.5 text-primary" /> : <Unlock className="size-3.5 text-muted-foreground" />}
                비밀번호 <span className="text-rose-500 font-semibold">(4자리, 필수)</span>
              </Label>
              <InputOTP maxLength={4} value={pin} onChange={setPin}>
                <InputOTPGroup>
                  <InputOTPSlot index={0} />
                  <InputOTPSlot index={1} />
                  <InputOTPSlot index={2} />
                  <InputOTPSlot index={3} />
                </InputOTPGroup>
              </InputOTP>
              <p className="text-[11px] text-muted-foreground">
                앱 최초 실행 시 동일한 PIN으로 데이터를 불러옵니다.
              </p>
            </div>
          </div>

          {isIOS && (
            <div className="rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground space-y-1">
              <p className="font-medium text-foreground flex items-center gap-1">
                <Share className="size-3.5" /> 설치 방법
              </p>
              <p>1. 아래 버튼으로 데이터를 준비합니다.</p>
              <p>2. Safari 하단의 <span className="font-semibold text-foreground">공유</span> 버튼을 누릅니다.</p>
              <p>3. <span className="font-semibold text-foreground">홈 화면에 추가</span>를 선택합니다.</p>
            </div>
          )}

          <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button
              variant="brand"
              onClick={handleInstall}
              disabled={loading || pin.length !== 4 || (!isIOS && (preparing || !ready))}
              type="button"
            >
              {loading || (!isIOS && preparing) ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Download className="mr-2 size-4" />}
              {isIOS ? "데이터 준비 완료" : preparing ? "준비 중…" : "설치하기"}
            </Button>
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              취소
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PwaInstallGuideDialog open={showGuide} onOpenChange={setShowGuide} />
    </>
  );
}
