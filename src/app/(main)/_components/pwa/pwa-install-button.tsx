"use client";

import { useState, useEffect } from "react";
import { Download, Share, Lock, Unlock, Loader2, CheckCircle2, SquarePlus, ExternalLink, Copy, MoreHorizontal } from "lucide-react";
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
import { IosShareStep, IosChromeShareStep, IosWhaleShareStep, IosAddToHomeStep } from "./pwa-guide-illustrations";

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
  const { isInstallable, isIOS, isInApp, isStandalone, prepareInstall, installPWA } = usePWAInstall();
  const { assetData, exchangeRates } = useAssetData();
  const themeMode = usePreferencesStore((s) => s.themeMode);
  const [showDialog, setShowDialog] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [ready, setReady] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [iosStep, setIosStep] = useState(false); // 데이터 준비 후 '홈 화면 추가' 가이드 단계
  const [inAppStep, setInAppStep] = useState(false); // 인앱 브라우저: 외부 브라우저 유도 단계
  const [iosBrowser, setIosBrowser] = useState<"safari" | "chrome" | "whale">("safari"); // iOS 상세 브라우저 선택 가이드 (Rebuild Trigger)
  const [shareCode, setShareCode] = useState<string | null>(null); // iOS: 앱에서 붙여넣을 연결 코드 (자동 복사됨)

  const hasAssets =
    assetData.realEstate.length > 0 ||
    assetData.stocks.length > 0 ||
    assetData.crypto.length > 0 ||
    assetData.cash.length > 0 ||
    assetData.loans.length > 0;

  const nickname = (() => {
    try { return localStorage.getItem(STORAGE_KEYS.nickname) || ""; } catch { return ""; }
  })();

  // 공유 토큰 생성 → 서버 저장 → { url(start_url용), code(연결 코드용) } 반환. 자산 없거나 실패 시 null.
  const generateShareArtifacts = async (): Promise<{ url: string; code: string } | null> => {
    if (!hasAssets) return null;

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
        const code = `s:${json.key}_${localKey}`;
        return { url: `/#share=${code}&theme=${themeMode}`, code };
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
      const artifacts = await generateShareArtifacts();
      if (cancelled) return;
      const ok = artifacts ? await prepareInstall(artifacts.url) : false;
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
      // iOS는 설치 API가 없고, '홈 화면 추가' 시 URL 해시(#share)가 제거된다.
      // → 데이터는 서버(/api/share)에 올리고, 짧은 연결 코드를 클립보드에 자동 복사해
      //   앱 첫 실행 시 사용자가 붙여넣어 가져오도록 안내한다.
      setLoading(true);
      try {
        const artifacts = await generateShareArtifacts();
        if (artifacts) {
          setShareCode(artifacts.code);
          try {
            await navigator.clipboard.writeText(artifacts.code);
          } catch {
            // 복사 실패해도 가이드 카드에 코드를 노출하므로 수동 복사 가능
          }
        } else {
          setShareCode(null);
          toast.error("연결 코드 생성에 실패했습니다. 잠시 후 다시 시도해주세요.");
        }
        setIosStep(true);
      } catch (err) {
        console.error("iOS 데이터 준비 실패:", err);
        toast.error("데이터 준비 중 오류가 발생했습니다.");
      } finally {
        setLoading(false);
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
    setShareCode(null);
    setIosStep(false);
    setInAppStep(false);
    setShowDialog(true);
  };

  // 다이얼로그 닫힘: 상태 초기화
  const handleDialogChange = (open: boolean) => {
    setShowDialog(open);
    if (!open) {
      setIosStep(false);
      setInAppStep(false);
    }
  };

  // 인앱 브라우저(카카오톡 등): 현재 주소를 복사하고 외부 브라우저 유도 가이드 표시
  const openInAppGuide = async () => {
    try {
      const artifacts = hasAssets ? await generateShareArtifacts() : null;
      const fullUrl = window.location.origin + (artifacts?.url ?? "/");
      try {
        await navigator.clipboard.writeText(fullUrl);
      } catch {
        // 클립보드 실패 시에도 가이드는 표시
      }
    } finally {
      setInAppStep(true);
      setShowDialog(true);
    }
  };

  const handleButtonClick = async () => {
    // 인앱 브라우저는 홈 화면 추가가 불가능 → 외부 브라우저로 유도
    if (isInApp) {
      openInAppGuide();
      return;
    }
    if (isInstallable || isIOS) {
      if (isIOS && !hasAssets) {
        // iOS 빈 상태: 데이터 준비 없이 곧바로 가이드 표시 (연결 코드 없음)
        setPin("");
        setShareCode(null);
        setIosStep(true);
        setShowDialog(true);
      } else if (hasAssets) {
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

      <Dialog open={showDialog} onOpenChange={handleDialogChange}>
        <DialogContent className="sm:max-w-[600px] max-h-[95dvh] flex flex-col p-0 gap-0 overflow-hidden rounded-2xl touch-pan-y">
          <DialogHeader className="px-6 pt-6 pb-3 text-left border-b border-border/50">
            <DialogTitle className="flex items-center gap-2 text-lg font-bold">
              {inAppStep ? <ExternalLink className="size-5 text-primary" /> : iosStep ? <Share className="size-5 text-primary" /> : <Download className="size-5 text-primary" />}
              {inAppStep ? "기본 브라우저에서 실행하기" : iosStep ? "시크릿에셋 앱 설치 가이드" : "홈 화면에 앱 설치"}
            </DialogTitle>
            {!iosStep && !inAppStep && (
              <DialogDescription asChild>
                <div className="space-y-1.5 text-sm text-muted-foreground leading-relaxed mt-1">
                  <p className="text-foreground font-semibold">안전한 자산 연동과 브라우저 세션 끊김으로 인한 데이터 유실을 막기 위해 앱으로 설치해야 합니다.</p>
                  <p className="text-sm">
                    설정할 PIN으로 자산이 로컬 암호화되며, 설치 완료 후 앱을 열어 동일한 PIN을 입력하면 즉시 데이터가 복원됩니다.
                  </p>
                </div>
              </DialogDescription>
            )}
            {iosStep && (
              <DialogDescription className="text-sm text-muted-foreground leading-relaxed mt-1">
                iOS 환경은 브라우저 보안 규정으로 인해 자동 설치가 불가능합니다. <span className="font-semibold text-foreground">아래 공유 기능을 통해 1분 만에 설치할 수 있습니다.</span>
              </DialogDescription>
            )}
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-6 py-4">
            {inAppStep ? (
              /* 인앱 브라우저(카카오톡 등): 홈 화면 추가 불가 → 외부 브라우저로 유도 */
              <div className="flex flex-col gap-4 py-1">
                <div className="flex items-start gap-2.5 rounded-lg bg-amber-500/10 px-3.5 py-3 text-sm font-medium text-amber-600 dark:text-amber-400 border border-amber-500/20 leading-relaxed">
                  <Copy className="size-4 shrink-0 mt-0.5" />
                  <div>
                    <strong>현재 웹페이지 주소가 복사되었습니다!</strong>
                    <p className="text-sm text-amber-600/80 dark:text-amber-400/80 mt-0.5">
                      카카오톡, 인스타그램 등의 브라우저에서는 앱 설치 기능이 지원되지 않으므로 Chrome, Safari 등 외부 브라우저로 접속해 주세요.
                    </p>
                  </div>
                </div>
                
                <ol className="space-y-3.5 py-1">
                  <li className="flex items-start gap-3.5 text-sm leading-relaxed">
                    <span className="shrink-0 size-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">1</span>
                    <span>
                      화면 우측 상단 또는 하단의{" "}
                      <span className="inline-flex items-center gap-1 font-semibold text-foreground">
                        메뉴 <MoreHorizontal className="size-3.5" />
                      </span>{" "}
                      를 누릅니다.
                    </span>
                  </li>
                  <li className="flex items-start gap-3.5 text-sm leading-relaxed">
                    <span className="shrink-0 size-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">2</span>
                    <span>
                      <span className="font-semibold text-foreground">&ldquo;다른 브라우저로 열기&rdquo;</span>(또는 Safari/Chrome으로 열기)를 선택합니다.
                    </span>
                  </li>
                  <li className="flex items-start gap-3.5 text-sm leading-relaxed">
                    <span className="shrink-0 size-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">3</span>
                    <span>
                      이동한 기본 브라우저에서 다시 우측 상단의 <span className="font-semibold text-foreground">앱 설치</span> 버튼을 터치하여 홈 화면에 추가합니다.
                    </span>
                  </li>
                </ol>
                <div className="rounded-lg bg-muted/40 p-2.5 text-sm text-muted-foreground border">
                  메뉴에 위 항목이 보이지 않는다면, 복사된 주소를 복사하여 스마트폰의 기본 브라우저(Safari 또는 크롬) 주소창에 직접 붙여넣어 접속해 주세요.
                </div>
              </div>
            ) : iosStep ? (
              /* iOS: 브라우저 공유 메뉴에서 직접 추가하도록 단계별 가이드 (브라우저 무관) */
              <div className="flex flex-col gap-4 py-1">
                {/* 2단계 진행 배너 — 사용자가 해야 할 두 액션을 먼저 명확히 인지 */}
                {shareCode && (
                  <div className="flex items-stretch gap-1.5 rounded-xl border border-primary/20 bg-primary/5 p-2 text-center">
                    <div className="flex-1 rounded-lg bg-background/60 px-2 py-2">
                      <p className="text-xs font-bold text-primary">STEP 1</p>
                      <p className="text-[11px] sm:text-xs font-medium text-foreground mt-0.5">홈 화면에 추가</p>
                    </div>
                    <div className="flex items-center text-primary/50 font-bold">→</div>
                    <div className="flex-1 rounded-lg bg-background/60 px-2 py-2">
                      <p className="text-xs font-bold text-primary">STEP 2</p>
                      <p className="text-[11px] sm:text-xs font-medium text-foreground mt-0.5">앱에서 연결 코드 붙여넣기</p>
                    </div>
                  </div>
                )}

                {/* 브라우저별 선택 칩 */}
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm text-muted-foreground font-medium">사용 중인 브라우저:</span>
                  <div className="flex gap-1 bg-muted/50 p-0.5 rounded-lg border">
                    {(["safari", "chrome", "whale"] as const).map((b) => (
                      <button
                        key={b}
                        type="button"
                        onClick={() => setIosBrowser(b)}
                        className={`text-xs sm:text-sm px-2.5 py-0.5 rounded-md font-semibold transition-colors capitalize ${
                          iosBrowser === b ? "bg-background text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {b === "safari" ? "Safari" : b === "chrome" ? "Chrome" : "Whale"}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* 1단계 */}
                  <div className="flex flex-col space-y-2.5 p-3.5 rounded-xl border border-border/50 bg-muted/10">
                    <div className="flex items-center gap-2">
                      <span className="shrink-0 size-5.5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">1</span>
                      <p className="font-semibold text-sm text-foreground">
                        {iosBrowser === "safari" ? "Safari" : iosBrowser === "chrome" ? "Chrome" : "Whale"} 공유 메뉴 클릭
                      </p>
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed h-12">
                      {iosBrowser === "safari" && (
                        <>
                          Safari 하단 우측 메뉴(<span className="font-semibold text-foreground font-mono">⋯</span>) 터치 후, 메뉴창 상단의 <span className="font-semibold text-foreground inline-flex items-center gap-0.5">공유 <Share className="size-3" /></span> 버튼을 선택합니다.
                        </>
                      )}
                      {iosBrowser === "chrome" && (
                        <>
                          크롬 상단 주소창 옆 메뉴(<span className="font-semibold text-foreground font-mono">⋯</span>) 터치 후, 메뉴 상단의 <span className="font-semibold text-foreground inline-flex items-center gap-0.5">공유 <Share className="size-3" /></span> 버튼을 선택합니다.
                        </>
                      )}
                      {iosBrowser === "whale" && (
                        <>
                          웨일 상단 주소창 옆 메뉴(<span className="font-semibold text-foreground font-mono">☰</span>) 터치 후, 메뉴 상단의 <span className="font-semibold text-foreground inline-flex items-center gap-0.5">공유 <Share className="size-3" /></span> 버튼을 선택합니다.
                        </>
                      )}
                    </p>
                    <div className="flex-1 flex items-center justify-center pt-1">
                      {iosBrowser === "safari" && (
                        <IosShareStep className="w-full max-w-[280px] text-foreground transition-all hover:scale-[1.02]" />
                      )}
                      {iosBrowser === "chrome" && (
                        <IosChromeShareStep className="w-full max-w-[280px] text-foreground transition-all hover:scale-[1.02]" />
                      )}
                      {iosBrowser === "whale" && (
                        <IosWhaleShareStep className="w-full max-w-[280px] text-foreground transition-all hover:scale-[1.02]" />
                      )}
                    </div>
                  </div>

                  {/* 2단계 */}
                  <div className="flex flex-col space-y-2.5 p-3.5 rounded-xl border border-border/50 bg-muted/10">
                    <div className="flex items-center gap-2">
                      <span className="shrink-0 size-5.5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">2</span>
                      <p className="font-semibold text-sm text-foreground">홈 화면에 추가 선택</p>
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed h-12">
                      공유 메뉴 창을 아래로 올려 <span className="font-semibold text-foreground inline-flex items-center gap-0.5">홈 화면에 추가 <SquarePlus className="size-3" /></span>를 터치합니다.
                    </p>
                    <div className="flex-1 flex items-center justify-center pt-1">
                      <IosAddToHomeStep className="w-full max-w-[280px] text-foreground transition-all hover:scale-[1.02]" />
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 rounded-xl bg-emerald-500/10 px-3.5 py-3 text-sm font-medium text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  <CheckCircle2 className="size-4 shrink-0" />
                  <span>
                    마지막으로 우측 상단의 <strong className="text-foreground font-semibold">[추가]</strong> 버튼을 누르면 홈 화면에 앱 아이콘이 생성됩니다.
                  </span>
                </div>

                {/* STEP 2 — 연결 코드 카드 (자산 보유 시): 클립보드 자동 복사됨 + 재복사 버튼 */}
                {shareCode && (
                  <div className="flex flex-col gap-2.5 rounded-xl border-2 border-primary/30 bg-primary/5 p-3.5">
                    <div className="flex items-center gap-2">
                      <span className="shrink-0 size-5.5 rounded-full bg-primary text-white flex items-center justify-center text-xs font-bold">2</span>
                      <p className="font-semibold text-sm text-foreground">앱을 열고 연결 코드 붙여넣기</p>
                    </div>
                    <div className="flex items-center gap-2 rounded-lg bg-emerald-500/10 px-3 py-2 text-xs font-medium text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                      <CheckCircle2 className="size-3.5 shrink-0" />
                      연결 코드가 클립보드에 복사되었습니다.
                    </div>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 truncate rounded-lg bg-muted/60 px-3 py-2 text-xs font-mono text-foreground border">{shareCode}</code>
                      <Button
                        variant="secondary"
                        size="sm"
                        type="button"
                        className="h-9 px-3 shrink-0"
                        onClick={async () => {
                          try { await navigator.clipboard.writeText(shareCode); toast.success("연결 코드를 복사했습니다."); }
                          catch { toast.error("복사에 실패했습니다. 코드를 길게 눌러 복사해주세요."); }
                        }}
                      >
                        <Copy className="mr-1.5 size-3.5" /> 복사
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      홈 화면에 추가된 <span className="font-semibold text-foreground">시크릿에셋 앱을 처음 열면</span> 연결 화면이 나옵니다. <span className="font-semibold text-foreground">붙여넣기</span> 후 설치 시 정한 <span className="font-semibold text-foreground">PIN 4자리</span>를 입력하면 자산이 복원됩니다.
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center space-y-4 py-4">
                <div className="flex flex-col items-center gap-3 space-y-2">
                  <Label className="text-sm font-medium flex items-center gap-1.5">
                    {pin.length === 4 ? <Lock className="size-3.5 text-primary" /> : <Unlock className="size-3.5 text-muted-foreground" />}
                    접근 비밀번호 <span className="text-rose-500 font-semibold">(4자리, 필수)</span>
                  </Label>
                  <InputOTP maxLength={4} value={pin} onChange={setPin}>
                    <InputOTPGroup>
                      <InputOTPSlot index={0} />
                      <InputOTPSlot index={1} />
                      <InputOTPSlot index={2} />
                      <InputOTPSlot index={3} />
                    </InputOTPGroup>
                  </InputOTP>
                  <p className="text-sm text-muted-foreground text-center">
                    설치된 앱 최초 실행 시 동일한 PIN 번호를 입력하면<br />암호화된 내 자산 정보가 자동으로 동기화됩니다.
                  </p>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="px-6 py-4 border-t border-border/50 bg-muted/20 flex flex-col gap-2 sm:flex-row sm:justify-end">
            {iosStep || inAppStep ? (
              <Button variant="brand" onClick={() => handleDialogChange(false)} type="button" className="text-sm h-10 px-5 shadow-sm font-semibold text-white">
                가이드 확인 완료
              </Button>
            ) : (
              <>
                <Button
                  variant="brand"
                  onClick={handleInstall}
                  disabled={loading || pin.length !== 4 || (!isIOS && (preparing || !ready))}
                  type="button"
                  className="text-sm h-10 px-5 font-semibold text-white"
                >
                  {loading || (!isIOS && preparing) ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Download className="mr-2 size-4" />}
                  {isIOS ? "추가 방법 보기" : preparing ? "준비 중…" : "설치하기"}
                </Button>
                <Button variant="outline" onClick={() => handleDialogChange(false)} className="text-sm h-10 px-4 font-semibold">
                  취소
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PwaInstallGuideDialog open={showGuide} onOpenChange={setShowGuide} />
    </>
  );
}
