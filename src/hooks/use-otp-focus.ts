"use client";

import { useEffect, type RefObject } from "react";

/**
 * OTP(PIN) 입력 포커스 제어 — iOS 소프트 키보드 대응.
 *
 * iOS는 **사용자 제스처 밖에서 호출한 `focus()`로 키보드를 열지 않으면서 `activeElement`만** 잡는다.
 * 그 뒤 사용자가 입력란을 탭해도 이미 포커스된 상태라 focus 전환이 없어 숫자패드가 끝내 뜨지 않는다
 * (탭할 때마다 input-otp의 selectionchange 리스너가 캐럿만 리셋해 화면이 튀어 보인다).
 */

/** 사용자 제스처 안에서 호출 — 이미 포커스돼 있으면 blur→focus로 전환을 강제해 키보드를 띄운다. */
export function focusOtpFromGesture(el: HTMLInputElement | null): void {
  if (!el) return;
  if (document.activeElement === el) el.blur();
  el.focus();
}

/**
 * 자동 포커스는 **마우스 환경에서만** 수행한다(데스크톱 UX 보존).
 * 터치 환경은 위 이유로 자동 포커스가 오히려 키보드를 막으므로 사용자의 탭에 맡긴다.
 */
export function useOtpAutoFocus(ref: RefObject<HTMLInputElement | null>, active: boolean): void {
  useEffect(() => {
    if (!active || typeof window === "undefined") return;
    if (!window.matchMedia?.("(pointer: fine)").matches) return;
    const t = setTimeout(() => ref.current?.focus(), 150);
    return () => clearTimeout(t);
  }, [ref, active]);
}
