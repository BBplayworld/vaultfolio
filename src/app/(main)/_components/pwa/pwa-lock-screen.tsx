"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { ShieldCheck, AlertTriangle } from "lucide-react";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { MAIN_PALETTE } from "@/config/theme";
import { useAssetData } from "@/contexts/asset-data-context";

const AUTH_ENABLED_KEY = "secretasset_pwa_auth_enabled";
const AUTH_PIN_HASH_KEY = "secretasset_pwa_auth_pin_hash";
const SESSION_AUTH_KEY = "secretasset_pwa_authenticated";

/** SHA-256 해시 생성 (브라우저 WebCrypto) */
async function sha256(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** 인증 활성화 여부 */
export function isPwaAuthEnabled(): boolean {
  try { return localStorage.getItem(AUTH_ENABLED_KEY) === "true"; } catch { return false; }
}

/** 앱잠금 상태(인증 활성화 + 세션 미인증) 여부 — 동기화 pull 게이트 등에서 재사용 */
export function isPwaLocked(): boolean {
  try {
    return isPwaAuthEnabled() && sessionStorage.getItem(SESSION_AUTH_KEY) !== "true";
  } catch { return false; }
}

/** 잠금 해제 직후 발행되는 이벤트 — CloudSyncProvider가 즉시 pull 트리거 */
export const PWA_UNLOCKED_EVENT = "secretasset:pwa-unlocked";

/** 인증 PIN 해시 저장 */
export async function setPwaAuthPin(pin: string): Promise<void> {
  const hash = await sha256(pin);
  localStorage.setItem(AUTH_PIN_HASH_KEY, hash);
  localStorage.setItem(AUTH_ENABLED_KEY, "true");
}

/** 인증 비활성화 */
export function disablePwaAuth(): void {
  localStorage.removeItem(AUTH_ENABLED_KEY);
  localStorage.removeItem(AUTH_PIN_HASH_KEY);
}

/** 저장된 PIN 해시 검증 */
export async function verifyPwaAuthPin(pin: string): Promise<boolean> {
  const storedHash = localStorage.getItem(AUTH_PIN_HASH_KEY);
  if (!storedHash) return false;
  const inputHash = await sha256(pin);
  return inputHash === storedHash;
}

export function PwaLockScreen() {
  const { unlockAndLoad } = useAssetData();
  const [locked, setLocked] = useState(false);
  const [pin, setPin] = useState("");
  const [failCount, setFailCount] = useState(0);
  const [checking, setChecking] = useState(false);
  const [mounted, setMounted] = useState(false);
  const otpRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setMounted(true);
    if (typeof window === "undefined") return;

    // 인증 활성화 + 세션 미인증 → 잠금 (웹·PWA 모두 동작)
    const authEnabled = isPwaAuthEnabled();
    const alreadyAuth = sessionStorage.getItem(SESSION_AUTH_KEY) === "true";

    if (authEnabled && !alreadyAuth) {
      setLocked(true);
    }
  }, []);

  useEffect(() => {
    if (locked) {
      setTimeout(() => otpRef.current?.focus(), 150);
    }
  }, [locked]);

  const handlePinChange = useCallback(async (value: string) => {
    setPin(value);
    if (value.length !== 4) return;

    setChecking(true);
    const ok = await verifyPwaAuthPin(value);
    setChecking(false);

    if (ok) {
      sessionStorage.setItem(SESSION_AUTH_KEY, "true");
      window.dispatchEvent(new Event(PWA_UNLOCKED_EVENT));
      setLocked(false);
      void unlockAndLoad();
    } else {
      setFailCount((c) => c + 1);
      setPin("");
      setTimeout(() => otpRef.current?.focus(), 100);
    }
  }, []);

  if (!mounted || !locked) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-background flex flex-col items-center justify-center gap-6 px-6">
      <div className="flex flex-col items-center gap-3">
        <div
          className="flex items-center justify-center size-16 rounded-2xl text-white"
          style={{ backgroundColor: MAIN_PALETTE[0] }}
        >
          <ShieldCheck className="size-8" />
        </div>
        <h1 className="text-lg font-bold">시크릿에셋</h1>
        <p className="text-sm text-muted-foreground">비밀번호를 입력해주세요</p>
      </div>

      <InputOTP ref={otpRef} maxLength={4} value={pin} onChange={handlePinChange} disabled={checking}>
        <InputOTPGroup>
          <InputOTPSlot index={0} />
          <InputOTPSlot index={1} />
          <InputOTPSlot index={2} />
          <InputOTPSlot index={3} />
        </InputOTPGroup>
      </InputOTP>

      {failCount >= 3 && (
        <div className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
          <AlertTriangle className="size-3.5" />
          <span>비밀번호를 다시 확인해주세요</span>
        </div>
      )}
      {failCount > 0 && failCount < 3 && (
        <p className="text-xs text-muted-foreground">
          비밀번호가 일치하지 않습니다
        </p>
      )}
    </div>
  );
}
