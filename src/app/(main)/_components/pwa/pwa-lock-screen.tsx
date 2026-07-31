"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { ShieldCheck, AlertTriangle } from "lucide-react";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { MAIN_PALETTE, Z_LAYER } from "@/config/theme";
import { useAssetData } from "@/contexts/asset-data-context";
import { focusOtpFromGesture, useOtpAutoFocus } from "@/hooks/use-otp-focus";

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
  // 검증 중 중복 실행 가드 — input을 disabled로 막으면 iOS가 blur시켜 키보드가 닫히고 돌아오지 않는다
  const checkingRef = useRef(false);

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

  useOtpAutoFocus(otpRef, locked);

  const handlePinChange = useCallback(async (value: string) => {
    setPin(value);
    if (value.length !== 4 || checkingRef.current) return;

    checkingRef.current = true;
    setChecking(true);
    const ok = await verifyPwaAuthPin(value);
    setChecking(false);
    checkingRef.current = false;

    if (ok) {
      sessionStorage.setItem(SESSION_AUTH_KEY, "true");
      window.dispatchEvent(new Event(PWA_UNLOCKED_EVENT));
      setLocked(false);
      void unlockAndLoad();
    } else {
      setFailCount((c) => c + 1);
      // 입력만 비운다 — 재포커스를 호출하면 iOS에서 오히려 키보드가 닫힌다(포커스는 유지된 상태)
      setPin("");
    }
  }, [unlockAndLoad]);

  if (!mounted || !locked) return null;

  return (
    // 키보드가 올라와도 PIN 입력이 가리지 않도록 중앙 정렬 대신 상단 정렬 + 스크롤 허용
    // (iOS standalone은 fixed 오버레이를 키보드에 맞춰 밀어주지 않는다). 상태바는 black-translucent라 safe-area 확보.
    <div
      className="fixed inset-0 bg-background flex flex-col items-center justify-start overflow-y-auto gap-6 px-6 pb-8 pt-[max(env(safe-area-inset-top),15vh)]"
      style={{ zIndex: Z_LAYER.lock }}
    >
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

      {/* 탭은 반드시 제스처 안에서 포커스를 전환시킨다 — iOS에서 숫자패드가 뜨는 유일한 경로 */}
      <div onPointerDown={() => focusOtpFromGesture(otpRef.current)} className={checking ? "opacity-60" : undefined}>
        <InputOTP ref={otpRef} maxLength={4} value={pin} onChange={handlePinChange}>
          <InputOTPGroup>
            <InputOTPSlot index={0} />
            <InputOTPSlot index={1} />
            <InputOTPSlot index={2} />
            <InputOTPSlot index={3} />
          </InputOTPGroup>
        </InputOTP>
      </div>

      {failCount >= 3 && (
        <div className="flex items-center gap-1.5 text-sm text-amber-600 dark:text-amber-400">
          <AlertTriangle className="size-3.5" />
          <span>비밀번호를 다시 확인해주세요</span>
        </div>
      )}
      {failCount > 0 && failCount < 3 && (
        <p className="text-sm text-muted-foreground">
          비밀번호가 일치하지 않습니다
        </p>
      )}
    </div>
  );
}
