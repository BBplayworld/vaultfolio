"use client";

import { useState, useEffect, useCallback } from "react";
import { ShieldCheck, AlertTriangle } from "lucide-react";
import { usePWAInstall } from "@/hooks/use-pwa-install";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { MAIN_PALETTE } from "@/config/theme";
import { pwaDebugLog } from "@/lib/pwa-debug"; // [임시 진단] PWA 빈 자산 원인 판별

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
  const { isStandalone } = usePWAInstall();
  const [locked, setLocked] = useState(false);
  const [pin, setPin] = useState("");
  const [failCount, setFailCount] = useState(0);
  const [checking, setChecking] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (typeof window === "undefined") return;

    // 스탠드얼론 + 인증 활성화 + 세션 미인증 → 잠금
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true;
    const authEnabled = isPwaAuthEnabled();
    const alreadyAuth = sessionStorage.getItem(SESSION_AUTH_KEY) === "true";

    pwaDebugLog("lock", `standalone=${standalone} authEnabled=${authEnabled} alreadyAuth=${alreadyAuth}`);
    if (standalone && authEnabled && !alreadyAuth) {
      pwaDebugLog("lock", "잠금 화면 표시(공유 PIN 프롬프트보다 우선 가로챔)");
      setLocked(true);
    }
  }, []);

  const handlePinChange = useCallback(async (value: string) => {
    setPin(value);
    if (value.length !== 4) return;

    setChecking(true);
    const ok = await verifyPwaAuthPin(value);
    setChecking(false);

    if (ok) {
      sessionStorage.setItem(SESSION_AUTH_KEY, "true");
      setLocked(false);
    } else {
      setFailCount((c) => c + 1);
      setPin("");
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

      <InputOTP maxLength={4} value={pin} onChange={handlePinChange} disabled={checking}>
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
