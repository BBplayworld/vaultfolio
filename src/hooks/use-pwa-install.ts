"use client";

import { useEffect, useState } from "react";

import { IN_APP_BROWSER_RE } from "@/lib/pwa/detect-browser";

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isInApp, setIsInApp] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // 이미 설치된 Standalone 환경인지 검사
    const checkStandalone = () => {
      const isStandaloneMode =
        window.matchMedia("(display-mode: standalone)").matches ||
        (window.navigator as any).standalone === true;
      setIsStandalone(isStandaloneMode);
    };

    checkStandalone();

    // iOS 기기 감지 (브라우저 무관: iOS는 모든 브라우저가 beforeinstallprompt 미지원 → 수동 추가)
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isAppleDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(isAppleDevice);

    // 인앱 브라우저 감지 (홈 화면 추가 불가 → 외부 브라우저 유도)
    const isInAppBrowser = IN_APP_BROWSER_RE.test(userAgent);
    setIsInApp(isInAppBrowser);

    const handleBeforeInstallPrompt = (e: Event) => {
      // 브라우저의 기본 설치 배너 방지
      e.preventDefault();
      (window as any).__bipEvent = e;
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setIsInstallable(true);
    };

    // head 스크립트가 마운트 전에 캡처한 이벤트 반영
    const syncCapturedPrompt = () => {
      const captured = (window as any).__bipEvent as BeforeInstallPromptEvent | null;
      if (captured) {
        setDeferredPrompt(captured);
        setIsInstallable(true);
      }
    };
    syncCapturedPrompt();

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("bip-captured", syncCapturedPrompt);

    // 설치 완료 이벤트 리스닝
    const handleAppInstalled = () => {
      console.log("PWA installed successfully");
      setIsInstallable(false);
      setDeferredPrompt(null);
      setIsStandalone(true);
    };

    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("bip-captured", syncCapturedPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  /**
   * PWA 설치 트리거. 항상 "현재 유효한" 이벤트(window.__bipEvent 우선)로
   * 사용자 제스처 안에서 await 없이 prompt()를 호출한다.
   */
  const installPWA = async (): Promise<boolean> => {
    const evt = ((window as any).__bipEvent as BeforeInstallPromptEvent | null) ?? deferredPrompt;
    if (!evt) {
      return false;
    }

    try {
      await evt.prompt();
      const choiceResult = await evt.userChoice;
      if (choiceResult.outcome === "accepted") {
        console.log("User accepted the A2HS prompt");
        (window as any).__bipEvent = null;
        setIsInstallable(false);
        setDeferredPrompt(null);
        return true;
      } else {
        console.log("User dismissed the A2HS prompt");
        return false;
      }
    } catch (error) {
      console.error("Error triggering PWA install:", error);
      return false;
    }
  };

  return {
    isInstallable: isInstallable && !isStandalone,
    isIOS: isIOS && !isStandalone,
    isInApp,
    isStandalone,
    installPWA,
  };
}
