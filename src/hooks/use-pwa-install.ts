"use client";

import { useEffect, useState } from "react";

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
    const isInAppBrowser = /kakaotalk|instagram|fbav|fban|fb_iab|line\/|naver\(inapp/.test(userAgent);
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
   * manifest 교체 후 Chrome이 재발생시키는 새 beforeinstallprompt를 대기.
   * 타임아웃 시 현재 window.__bipEvent로 폴백.
   */
  const waitForFreshPrompt = (timeoutMs = 3000): Promise<BeforeInstallPromptEvent | null> => {
    return new Promise((resolve) => {
      let done = false;
      const finish = (evt: BeforeInstallPromptEvent | null) => {
        if (done) return;
        done = true;
        window.removeEventListener("bip-captured", onCaptured);
        window.removeEventListener("beforeinstallprompt", onBip);
        resolve(evt);
      };
      const onCaptured = () => {
        const evt = (window as any).__bipEvent as BeforeInstallPromptEvent | null;
        if (evt) finish(evt);
      };
      const onBip = (e: Event) => {
        e.preventDefault();
        (window as any).__bipEvent = e;
        finish(e as BeforeInstallPromptEvent);
      };
      window.addEventListener("bip-captured", onCaptured);
      window.addEventListener("beforeinstallprompt", onBip);
      setTimeout(() => finish(((window as any).__bipEvent as BeforeInstallPromptEvent | null) ?? null), timeoutMs);
    });
  };

  /**
   * 설치 준비: manifest를 startUrl 포함 엔드포인트로 교체하고
   * 재발생하는 유효한 beforeinstallprompt를 확보한다.
   * 설치 버튼 클릭 "이전"에 호출하여, 클릭 시점엔 await 없이 prompt()만 부르도록 한다.
   */
  const prepareInstall = async (startUrl: string): Promise<boolean> => {
    const manifestLink = document.querySelector('link[rel="manifest"]') as HTMLLinkElement | null;
    if (!manifestLink) return Boolean((window as any).__bipEvent || deferredPrompt);

    // 새 BIP 유도: 기존 캡처 이벤트 초기화 후 manifest 교체
    (window as any).__bipEvent = null;
    manifestLink.href = `/api/pwa-manifest?startUrl=${encodeURIComponent(startUrl)}`;

    const fresh = await waitForFreshPrompt();
    if (fresh) {
      (window as any).__bipEvent = fresh;
      setDeferredPrompt(fresh);
      setIsInstallable(true);
      return true;
    }
    // 폴백: 새 이벤트가 없으면 기존 이벤트라도 사용
    return Boolean(deferredPrompt);
  };

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

  /**
   * iOS용: manifest link를 동적으로 교체 (홈 화면 추가 전 호출)
   */
  const setManifestStartUrl = (startUrl: string) => {
    const manifestLink = document.querySelector('link[rel="manifest"]');
    if (manifestLink) {
      (manifestLink as HTMLLinkElement).href = `/api/pwa-manifest?startUrl=${encodeURIComponent(startUrl)}`;
    }
  };

  /**
   * iOS용: manifest link 자체를 제거.
   * iOS는 manifest가 있으면 그 start_url(해시 제거됨)로 PWA를 시작하므로, 홈 화면 추가 전
   * manifest를 제거해 '주소창 URL(해시 포함)'이 북마크로 캡처되게 한다. (standalone은 apple 메타로 유지)
   */
  const removeManifestLink = () => {
    const manifestLink = document.querySelector('link[rel="manifest"]');
    if (manifestLink) manifestLink.parentElement?.removeChild(manifestLink);
  };

  /**
   * manifest link를 원래대로 복원 (제거됐으면 재생성)
   */
  const restoreManifest = () => {
    let manifestLink = document.querySelector('link[rel="manifest"]') as HTMLLinkElement | null;
    if (!manifestLink) {
      manifestLink = document.createElement("link");
      manifestLink.rel = "manifest";
      document.head.appendChild(manifestLink);
    }
    manifestLink.href = "/manifest.webmanifest";
  };

  return {
    isInstallable: isInstallable && !isStandalone,
    isIOS: isIOS && !isStandalone,
    isInApp,
    isStandalone,
    prepareInstall,
    installPWA,
    setManifestStartUrl,
    removeManifestLink,
    restoreManifest,
  };
}
