"use client";

import { useCallback, useState } from "react";
import { track } from "@/lib/analytics/ga";
import { openExternalBrowser } from "@/lib/pwa/open-external-browser";

/**
 * 인앱 브라우저 → 외부 브라우저 이동(#60). 인앱 게이트·웰컴 인앱 슬롯이 공용으로 쓴다(단일 구현).
 *  - Android: 스킴으로 자동 이동(openExternalBrowser).
 *  - iOS: 자동 이동 스킴이 없어 주소를 클립보드에 복사하고 수동 가이드로 폴백.
 */

/**
 * iOS 클립보드 복사. urlOrPromise를 받아 사용자 제스처가 만료되기 전에 ClipboardItem에 Promise를 담아 복사한다.
 * WebKit: await fetch 뒤 writeText는 제스처 만료로 실패 → write에 Promise 담은 ClipboardItem 전달, 실패 시 writeText 폴백.
 */
export async function copyUrlForIOS(urlOrPromise: string | Promise<string>): Promise<void> {
  const blobPromise = Promise.resolve(urlOrPromise).then((u) => new Blob([u], { type: "text/plain" }));
  let copied = false;
  if (typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) {
    try {
      await navigator.clipboard.write([new ClipboardItem({ "text/plain": blobPromise })]);
      copied = true;
    } catch { /* 폴백: 아래 writeText */ }
  }
  if (!copied) {
    try { await navigator.clipboard.writeText(await Promise.resolve(urlOrPromise)); } catch { /* 가이드에 안내 */ }
  }
}

export interface ExternalMoveDeps {
  isIOS: boolean;
  url: string | Promise<string>;
  copy: (urlOrPromise: string | Promise<string>) => Promise<void>;
  openExternal: (url: string) => boolean;
  onTrack: () => void;
}

/** 이동 판정(순수) — iOS면 복사 후 "ios-fallback", 그 외는 스킴 이동 후 "opened". 호출당 GA 1회 */
export async function moveExternal({ isIOS, url, copy, openExternal, onTrack }: ExternalMoveDeps): Promise<"ios-fallback" | "opened"> {
  onTrack();
  if (isIOS) {
    await copy(url);
    return "ios-fallback";
  }
  openExternal(await Promise.resolve(url));
  return "opened";
}

/** 외부 이동 훅 — go(url): 이동 실행, iosFallback: iOS 수동 가이드 표시 여부 */
export function useExternalMove(isIOS: boolean) {
  const [iosFallback, setIosFallback] = useState(false);

  const go = useCallback(async (urlOrPromise: string | Promise<string>) => {
    const result = await moveExternal({
      isIOS,
      url: urlOrPromise,
      copy: copyUrlForIOS,
      openExternal: openExternalBrowser,
      onTrack: () => track("pwa_install", { method: "inapp_move", source: "inapp" }),
    });
    if (result === "ios-fallback") setIosFallback(true);
  }, [isIOS]);

  return { go, iosFallback };
}
