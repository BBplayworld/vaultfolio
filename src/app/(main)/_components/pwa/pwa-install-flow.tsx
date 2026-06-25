"use client";

import { useState, useEffect, useRef } from "react";
import { Download, Share, Lock, Unlock, Loader2, CheckCircle2, ExternalLink, Copy, MoreHorizontal, Smartphone } from "lucide-react";
import { usePWAInstall } from "@/hooks/use-pwa-install";
import { useAssetData } from "@/contexts/asset-data-context";
import { MAIN_PALETTE } from "@/config/theme";
import { generateShareToken, STORAGE_KEYS } from "@/lib/asset-storage";
import { getAssetId } from "@/lib/cloud-sync/sync-state";
import { isCloudSyncEnabled, SYNC_HASH_PARAM } from "@/lib/cloud-sync/config";
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
import { InstallGuideContent } from "./pwa-install-guide-content";
import { detectBrowserEnv, type BrowserEnv } from "@/lib/pwa/detect-browser";

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

/** 트리거에 전달되는 설치 진입 상태/핸들러 */
export interface PwaInstallTrigger {
  onClick: () => void;
  loading: boolean;
  isIOS: boolean;
  isInApp: boolean;
  isInstallable: boolean;
}

interface PwaInstallFlowProps {
  /** 설치 진입 트리거(버튼 등). 홈 아이콘 버튼·웰컴가이드 버튼이 동일 흐름을 공유한다. */
  children: (trigger: PwaInstallTrigger) => React.ReactNode;
}

/**
 * PWA 설치 흐름 공용 컴포넌트.
 * 홈 설치 버튼과 웰컴가이드가 동일한 설치 다이얼로그(PIN/동기화/iOS step/인앱/복원코드)를 공유한다.
 * 트리거 UI만 children(render-prop)으로 외부에서 주입한다.
 */
export function PwaInstallFlow({ children }: PwaInstallFlowProps) {
  const { isInstallable, isIOS, isInApp, isStandalone, installPWA } = usePWAInstall();
  const { assetData, exchangeRates } = useAssetData();
  const themeMode = usePreferencesStore((s) => s.themeMode);
  const [showDialog, setShowDialog] = useState(false);
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const otpRef = useRef<HTMLInputElement>(null);

  const [iosStep, setIosStep] = useState(false); // 데이터 준비 후 '홈 화면 추가' 가이드 단계
  const [inAppStep, setInAppStep] = useState(false); // 인앱 브라우저: 외부 브라우저 유도 단계
  const [guideStep, setGuideStep] = useState(false); // 설치불가 폴백: 환경별 설치 가이드/문제해결
  const [env, setEnv] = useState<BrowserEnv>({ platform: "ios", browser: "safari", isInApp: false }); // 접속 환경 자동감지
  const [shareCode, setShareCode] = useState<string | null>(null); // iOS: 앱에서 붙여넣을 복원 코드 (자동 복사됨)

  const hasAssets =
    assetData.realEstate.length > 0 ||
    assetData.stocks.length > 0 ||
    assetData.crypto.length > 0 ||
    assetData.cash.length > 0 ||
    assetData.loans.length > 0;

  // 클라우드 동기화 사용 기기 → PIN·공유 토큰 없이 assetId 포인터(sync:)로 연동.
  // 새 기기에서 [동기화 코드 + 금고 암호]만으로 자산 pull + 동기화 armed가 동시에 완료된다.
  const syncAssetId = mounted && isCloudSyncEnabled() ? getAssetId() : null;
  const isSyncMode = !!syncAssetId;
  const codeLabel = isSyncMode ? "동기화 코드" : "복원 코드"; // 화면 표시 명칭(데이터 성격이 달라 구분)

  const nickname = assetData.nickname || "";

  useEffect(() => {
    if (showDialog && !iosStep && !inAppStep && !isSyncMode) {
      setTimeout(() => otpRef.current?.focus(), 150);
    }
  }, [showDialog, iosStep, inAppStep, isSyncMode]);

  // 공유 토큰 생성 → 서버 저장 → { url(start_url용), code(복원 코드용) } 반환. 자산 없거나 실패 시 null.
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
        const code = `share:${json.key}_${localKey}`;
        return { url: `/#share=${code}&theme=${themeMode}`, code };
      }
    } catch {
      // fallback: 서버 실패 시 start_url 없이 설치
    }
    return null;
  };



  useEffect(() => { setMounted(true); setEnv(detectBrowserEnv()); }, []);

  if (!mounted || isStandalone) return null;

  const handleInstall = async () => {
    if (!isSyncMode && pin.length !== 4) {
      toast.error("PIN 번호 4자리를 입력해주세요.");
      return;
    }

    // iOS는 설치 API가 없고, '홈 화면 추가' 시 URL 해시가 제거된다.
    // → 복원 코드를 클립보드에 자동 복사해 앱 첫 실행 시 붙여넣게 한다.
    //   동기화 모드: sync:<assetId> 포인터(서버 업로드 불필요). 그 외: 공유 토큰 s: 코드.
    setLoading(true);
    try {
      if (isSyncMode && syncAssetId) {
        const code = `sync:${syncAssetId}`;
        setShareCode(code);
        try { await navigator.clipboard.writeText(code); } catch { /* 가이드 카드에 노출되므로 수동 복사 가능 */ }
      } else {
        // WebKit(iOS): await fetch 뒤 writeText는 제스처 만료로 실패 → write에 Promise 담은
        // ClipboardItem을 동기 시점에 전달해 자동 복사 보존
        const artifactsPromise = generateShareArtifacts();
        let copied = false;
        if (typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) {
          try {
            await navigator.clipboard.write([
              new ClipboardItem({
                "text/plain": artifactsPromise.then(a => new Blob([a?.code ?? ""], { type: "text/plain" })),
              }),
            ]);
            copied = true;
          } catch { /* 폴백: 아래 writeText */ }
        }
        const artifacts = await artifactsPromise;
        if (artifacts) {
          setShareCode(artifacts.code);
          if (!copied) { try { await navigator.clipboard.writeText(artifacts.code); } catch { /* 수동 복사 가능 */ } }
        } else {
          setShareCode(null);
          toast.error("복원 코드 생성에 실패했습니다. 잠시 후 다시 시도해주세요.");
        }
      }
      setIosStep(true);
    } catch (err) {
      console.error("iOS 데이터 준비 실패:", err);
      toast.error("데이터 준비 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const openDialog = () => {
    setPin("");
    setShareCode(null);
    setIosStep(false);
    setInAppStep(false);
    setGuideStep(false);
    setShowDialog(true);
  };

  // 다이얼로그 닫힘: 상태 초기화
  const handleDialogChange = (open: boolean) => {
    setShowDialog(open);
    if (!open) {
      setIosStep(false);
      setInAppStep(false);
      setGuideStep(false);
    }
  };

  // 인앱 브라우저(카카오톡 등): 현재 주소를 복사하고 외부 브라우저 유도 가이드 표시
  const openInAppGuide = async () => {
    try {
      // WebKit: await fetch 뒤 writeText는 제스처 만료로 실패 → write에 Promise 담은 ClipboardItem 전달
      const artifactsPromise = hasAssets ? generateShareArtifacts() : Promise.resolve(null);
      const toUrl = (a: { url: string; code: string } | null) => window.location.origin + (a?.url ?? "/");
      let copied = false;
      if (typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) {
        try {
          await navigator.clipboard.write([
            new ClipboardItem({ "text/plain": artifactsPromise.then(a => new Blob([toUrl(a)], { type: "text/plain" })) }),
          ]);
          copied = true;
        } catch { /* 폴백: 아래 writeText */ }
      }
      if (!copied) {
        try { await navigator.clipboard.writeText(toUrl(await artifactsPromise)); } catch { /* 클립보드 실패 시에도 가이드는 표시 */ }
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
    if (isIOS) {
      if (isSyncMode) {
        // 동기화 기기: PIN 없이 연동 다이얼로그 (자산 유무 무관)
        openDialog();
      } else if (!hasAssets) {
        // iOS 빈 상태: 데이터 준비 없이 곧바로 가이드 표시 (복원 코드 없음)
        setPin("");
        setShareCode(null);
        setIosStep(true);
        setShowDialog(true);
      } else {
        openDialog();
      }
    } else if (isInstallable) {
      // 비-iOS 환경 (Android, PC 등): 즉시 브라우저 순정 설치 창 호출
      setLoading(true);
      try {
        const success = await installPWA();
        if (success) {
          toast.success("앱이 성공적으로 설치되었습니다!");
        }
      } catch (err) {
        console.error("PWA 설치 오류:", err);
        toast.error("설치 중 오류가 발생했습니다.");
      } finally {
        setLoading(false);
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
      // 통합 설치 가이드(환경별 + 문제해결)를 같은 다이얼로그로 노출
      setPin("");
      setShareCode(null);
      setIosStep(false);
      setInAppStep(false);
      setGuideStep(true);
      setShowDialog(true);
    }
  };

  return (
    <>
      {children({ onClick: handleButtonClick, loading, isIOS, isInApp, isInstallable })}

      <Dialog open={showDialog} onOpenChange={handleDialogChange}>
        <DialogContent className="sm:max-w-[600px] max-h-[95dvh] flex flex-col p-0 gap-0 overflow-hidden rounded-2xl touch-pan-y">
          <DialogHeader className="px-6 pt-6 pb-3 text-left border-b border-border/50">
            <DialogTitle className="flex items-center gap-2 text-lg font-bold">
              {inAppStep ? <ExternalLink className="size-5 text-primary" /> : iosStep ? <Share className="size-5 text-primary" /> : guideStep ? <Smartphone className="size-5 text-primary" /> : <Download className="size-5 text-primary" />}
              {inAppStep ? "기본 브라우저에서 실행하기" : iosStep ? "시크릿에셋 앱 설치 가이드" : guideStep ? "앱 설치 가이드" : "홈 화면에 앱 설치"}
            </DialogTitle>
            {guideStep && (
              <DialogDescription className="text-sm text-muted-foreground leading-relaxed mt-1 text-pretty">
                현재 접속 환경에 맞는 설치 방법입니다. 설치가 안 된다면 아래 <span className="font-semibold text-foreground">설치가 안 되나요?</span>를 펼쳐 확인해 주세요.
              </DialogDescription>
            )}
            {!iosStep && !inAppStep && !guideStep && (
              <DialogDescription asChild>
                <div className="space-y-1.5 text-sm text-muted-foreground leading-relaxed mt-1">
                  <p className="text-foreground font-semibold">안전한 자산 연동과 브라우저 세션 끊김으로 인한 데이터 유실을 막기 위해 앱으로 설치해야 합니다.</p>
                  {isSyncMode ? (
                    <p className="text-sm">
                      이 기기는 <span className="font-semibold text-foreground">기기 동기화 중</span>입니다. 설치 후 앱을 열어 <span className="font-semibold text-foreground">금고 암호</span>만 입력하면 자산이 복원되고 동기화가 이어집니다. (PIN 불필요)
                    </p>
                  ) : (
                    <p className="text-sm">
                      설정할 PIN으로 자산이 로컬 암호화되며, 설치 완료 후 앱을 열어 동일한 PIN을 입력하면 즉시 데이터가 복원됩니다.
                    </p>
                  )}
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
            ) : guideStep ? (
              /* 설치불가 폴백: 접속 환경 자동감지 통합 가이드 + 문제해결 */
              <div className="py-1">
                <InstallGuideContent env={env} />
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
                      <p className="text-[11px] sm:text-xs font-medium text-foreground mt-0.5">앱에서 {codeLabel} 붙여넣기</p>
                    </div>
                  </div>
                )}

                {/* STEP 1 섹션 헤더 (복원 코드 있을 때만 — STEP 2와 위계 일치) */}
                {shareCode && (
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-md bg-primary text-white text-xs font-bold">STEP 1</span>
                    <p className="text-sm font-semibold text-foreground">홈 화면에 앱 설치 (PWA)</p>
                  </div>
                )}

                {/* 환경 자동감지 통합 가이드 (브라우저별 3단계 + 접이식 문제해결) */}
                <InstallGuideContent env={env} />

                {/* STEP 2 — 복원 코드 카드 (자산 보유 시): 클립보드 자동 복사됨 + 재복사 버튼 */}
                {shareCode && (
                  <div className="flex flex-col gap-2.5 mt-3 border-t border-border/50 pt-5">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-md bg-primary text-white text-xs font-bold">STEP 2</span>
                      <p className="font-semibold text-sm text-foreground">앱을 열고 {codeLabel} 붙여넣기</p>
                    </div>
                    <div className="flex items-center gap-2 rounded-lg bg-emerald-500/10 px-3 py-2 text-xs font-medium text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                      <CheckCircle2 className="size-3.5 shrink-0" />
                      {codeLabel}가 클립보드에 복사되었습니다.
                    </div>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 truncate rounded-lg bg-muted/60 px-3 py-2 text-xs font-mono text-foreground border">{shareCode}</code>
                      <Button
                        variant="secondary"
                        size="sm"
                        type="button"
                        className="h-9 px-3 shrink-0"
                        onClick={async () => {
                          try { await navigator.clipboard.writeText(shareCode); toast.success(`${codeLabel}를 복사했습니다.`); }
                          catch { toast.error("복사에 실패했습니다. 코드를 길게 눌러 복사해주세요."); }
                        }}
                      >
                        <Copy className="mr-1.5 size-3.5" /> 복사
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      홈 화면에 추가된 <span className="font-semibold text-foreground">시크릿에셋 앱을 처음 열면</span> 연결 화면이 나옵니다. <span className="font-semibold text-foreground">붙여넣기</span> 후 {isSyncMode ? <><span className="font-semibold text-foreground">금고 암호</span>를 입력하면 자산이 복원되고 동기화가 이어집니다.</> : <><span className="font-semibold text-foreground">PIN 4자리</span>를 입력하면 자산이 복원됩니다.</>}
                    </p>
                  </div>
                )}
              </div>
            ) : isSyncMode ? (
              /* 동기화 기기: PIN 입력 없이 안내만 — 새 기기에서 금고 암호로 복원 */
              <div className="flex flex-col items-center justify-center space-y-4 py-6">
                <div className="flex items-center justify-center size-14 rounded-2xl text-white" style={{ backgroundColor: MAIN_PALETTE[0] }}>
                  <CheckCircle2 className="size-7" />
                </div>
                <p className="text-sm text-muted-foreground text-center leading-relaxed max-w-xs">
                  기기 동기화 중인 기기입니다.<br />
                  아래 <span className="font-semibold text-foreground">설치하기</span>를 누르면 바로 설치되고,<br />
                  설치된 앱을 열어 <span className="font-semibold text-foreground">금고 암호</span>를 입력하면 자산이 복원됩니다.
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center space-y-4 py-4">
                <div className="flex flex-col items-center gap-3 space-y-2">
                  <Label className="text-sm font-medium flex items-center gap-1.5">
                    {pin.length === 4 ? <Lock className="size-3.5 text-primary" /> : <Unlock className="size-3.5 text-muted-foreground" />}
                    데이터 전송용 PIN 번호 <span className="text-rose-500 font-semibold">(4자리, 필수)</span>
                  </Label>
                  <InputOTP ref={otpRef} maxLength={4} value={pin} onChange={setPin}>
                    <InputOTPGroup>
                      <InputOTPSlot index={0} />
                      <InputOTPSlot index={1} />
                      <InputOTPSlot index={2} />
                      <InputOTPSlot index={3} />
                    </InputOTPGroup>
                  </InputOTP>
                  <p className="text-sm text-muted-foreground text-center">
                    이 PIN 번호는 웹 데이터를 설치할 앱으로 안전하게 전송하기 위한 1회성 비밀번호이며,<br />
                    앱 최초 실행 시에만 복원을 위해 한 번 사용됩니다.
                  </p>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="px-6 py-4 border-t border-border/50 bg-muted/20 flex flex-col gap-2 sm:flex-row sm:justify-end">
            {iosStep || inAppStep || guideStep ? (
              <Button variant="brand" onClick={() => handleDialogChange(false)} type="button" className="text-sm h-10 px-5 shadow-sm font-semibold text-white">
                가이드 확인 완료
              </Button>
            ) : (
              <>
                <Button
                  variant="brand"
                  onClick={handleInstall}
                  disabled={loading || (!isSyncMode && pin.length !== 4)}
                  type="button"
                  className="text-sm h-10 px-5 font-semibold text-white"
                >
                  {loading ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Download className="mr-2 size-4" />}
                  {isIOS ? "추가 방법 보기" : "설치하기"}
                </Button>
                <Button variant="outline" onClick={() => handleDialogChange(false)} className="text-sm h-10 px-4 font-semibold">
                  취소
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
