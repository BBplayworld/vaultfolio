"use client";

import { useState, useEffect } from "react";
import { Sparkles, X, Download, Share } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePWAInstall } from "@/hooks/use-pwa-install";
import { MAIN_PALETTE } from "@/config/theme";

export function PwaInstallBanner() {
  const { isInstallable, isIOS, isStandalone, installPWA } = usePWAInstall();
  const [dismissed, setDismissed] = useState(true); // Hydration mismatch 방지를 위해 true로 초기화
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      const isDismissed = localStorage.getItem("secretasset_pwa_banner_dismissed");
      if (!isDismissed) {
        setDismissed(false);
      }
    } catch {
      setDismissed(false);
    }
  }, []);

  if (!mounted || isStandalone || dismissed) {
    return null;
  }

  const handleDismiss = () => {
    try {
      localStorage.setItem("secretasset_pwa_banner_dismissed", "true");
    } catch { /* 무시 */ }
    setDismissed(true);
  };

  const handleInstall = async () => {
    const success = await installPWA();
    if (success) {
      handleDismiss();
    }
  };

  // 1. 일반 설치 가능 브라우저 (Chrome, Edge, Samsung Internet 등)
  if (isInstallable) {
    return (
      <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-[380px] z-50 animate-in fade-in slide-in-from-bottom-5 duration-300">
        <div className="rounded-xl border border-primary/20 bg-background/95 backdrop-blur-md shadow-2xl p-4 flex flex-col gap-3 relative overflow-hidden">
          {/* 브랜드 데코 그라디언트 */}
          <div className="absolute top-0 left-0 w-full h-[3px]" style={{ backgroundColor: MAIN_PALETTE[0] }} />

          <button
            onClick={handleDismiss}
            className="absolute top-2 right-2 text-muted-foreground hover:text-foreground transition-colors p-1 rounded-full hover:bg-muted/50 after:absolute after:-inset-2 after:content-['']"
            aria-label="닫기"
          >
            <X className="size-4" />
          </button>

          <div className="flex gap-3 items-start pr-6">
            <div className="rounded-lg p-2 shrink-0 bg-primary/10 text-primary">
              <Sparkles className="size-5" />
            </div>
            <div>
              <h4 className="text-sm font-semibold flex items-center gap-1.5">
                앱으로 더 안전하고 빠르게!
              </h4>
              <p className="text-sm text-muted-foreground leading-relaxed mt-1 text-pretty">
                홈 화면에 시크릿에셋을 설치하면 브라우저 주소창 없이 앱의 형태로 편리하고 안전하게 금고를 연동하여 사용할 수 있습니다.
              </p>
            </div>
          </div>

          <div className="flex gap-2 justify-end mt-1">
            <Button
              variant="outline"
              size="sm"
              onClick={handleDismiss}
              className="text-sm h-9"
            >
              다음에 할게요
            </Button>
            <Button
              size="sm"
              onClick={handleInstall}
              className="text-sm h-9 text-white hover:opacity-90 border-none"
              style={{ backgroundColor: MAIN_PALETTE[0] }}
            >
              <Download className="mr-1.5 size-3.5" />
              앱 설치하기
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // 2. iOS Safari (수동 추가 가이드 배너)
  if (isIOS) {
    return (
      <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-[380px] z-50 animate-in fade-in slide-in-from-bottom-5 duration-300">
        <div className="rounded-xl border border-primary/20 bg-background/95 backdrop-blur-md shadow-2xl p-4 flex flex-col gap-3 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-[3px]" style={{ backgroundColor: MAIN_PALETTE[0] }} />

          <button
            onClick={handleDismiss}
            className="absolute top-2 right-2 text-muted-foreground hover:text-foreground transition-colors p-1 rounded-full hover:bg-muted/50 after:absolute after:-inset-2 after:content-['']"
            aria-label="닫기"
          >
            <X className="size-4" />
          </button>

          <div className="flex gap-3 items-start pr-6">
            <div className="rounded-lg p-2 shrink-0 bg-primary/10 text-primary">
              <Sparkles className="size-5" />
            </div>
            <div>
              <h4 className="text-sm font-semibold flex items-center gap-1.5">
                홈 화면에 추가하고 앱처럼 사용!
              </h4>
              <p className="text-sm text-muted-foreground leading-relaxed mt-1 text-pretty">
                Safari 브라우저 하단의 <span className="font-semibold text-foreground flex inline-flex items-center gap-0.5 mx-0.5"><Share className="size-3" /> [공유]</span> 버튼을 누른 후,
                <span className="font-semibold text-foreground"> [홈 화면에 추가]</span>를 선택하면 네이티브 앱처럼 시크릿에셋 금고를 연동할 수 있습니다.
              </p>
            </div>
          </div>

          <div className="flex justify-end mt-1">
            <Button
              variant="outline"
              size="sm"
              onClick={handleDismiss}
              className="text-sm h-9"
            >
              확인했습니다
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
