"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { ShieldCheck, AlertTriangle, Delete } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MAIN_PALETTE, Z_LAYER } from "@/config/theme";
import { useAssetData } from "@/contexts/asset-data-context";
import { cn } from "@/lib/utils";

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

const PIN_LENGTH = 4;
const KEYPAD_DIGITS = ["1", "2", "3", "4", "5", "6", "7", "8", "9"] as const;

/**
 * 앱 잠금 화면.
 *
 * **소프트 키보드를 쓰지 않는다 — 포커스 가능한 입력 요소를 두지 않는 것이 이 화면의 규약이다.**
 * iOS standalone에서 소프트 키보드는 포커스 강탈·present/dismiss 경합에 취약해 앱 코드로
 * 결정론적 제어가 불가능했고(키패드가 열리려다 닫히는 반복), `focus()`/`blur()` 개입과
 * 오버레이 스크롤 컨테이너화로 오히려 고정 회귀를 만든 이력이 있다.
 * 자체 숫자패드는 원인이 무엇이든 그 경합 자체가 성립하지 않게 한다. 물리 키보드는 window keydown으로 받는다.
 */
export function PwaLockScreen() {
  const { unlockAndLoad } = useAssetData();
  const [locked, setLocked] = useState(false);
  const [pin, setPin] = useState("");
  const [failCount, setFailCount] = useState(0);
  const [checking, setChecking] = useState(false);
  const [mounted, setMounted] = useState(false);
  // 검증 중 중복 실행 가드
  const checkingRef = useRef(false);
  // unlockAndLoad는 비메모 context value에서 와 식별자가 흔들린다 → deps에 넣지 않고 최신 참조만 유지
  const unlockRef = useRef(unlockAndLoad);
  useEffect(() => { unlockRef.current = unlockAndLoad; }, [unlockAndLoad]);

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

  const push = useCallback((d: string) => {
    if (checkingRef.current) return;
    setPin((p) => (p.length >= PIN_LENGTH ? p : p + d));
  }, []);

  const pop = useCallback(() => {
    if (checkingRef.current) return;
    setPin((p) => p.slice(0, -1));
  }, []);

  // 자동 제출은 별도 effect로 — 상태 updater 안에서 검증하면 StrictMode 이중 실행에 노출된다
  useEffect(() => {
    if (pin.length !== PIN_LENGTH || checkingRef.current) return;
    checkingRef.current = true;
    setChecking(true);
    void (async () => {
      const ok = await verifyPwaAuthPin(pin);
      setChecking(false);
      checkingRef.current = false;
      if (ok) {
        sessionStorage.setItem(SESSION_AUTH_KEY, "true");
        window.dispatchEvent(new Event(PWA_UNLOCKED_EVENT));
        setLocked(false);
        void unlockRef.current();
      } else {
        setFailCount((c) => c + 1);
        setPin("");
      }
    })();
  }, [pin]);

  // 물리 키보드(데스크톱·외장) — 포커스 대상이 없으므로 window에서 직접 받는다
  useEffect(() => {
    if (!locked) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key >= "0" && e.key <= "9") push(e.key);
      else if (e.key === "Backspace") pop();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [locked, push, pop]);

  if (!mounted || !locked) return null;

  return (
    <div className="fixed inset-0 bg-background flex flex-col items-center justify-center gap-5 px-6" style={{ zIndex: Z_LAYER.lock }}>
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

      {/* 입력 자릿수 표시 — 값을 담는 input이 아니라 순수 표시용 */}
      <div className="flex items-center gap-3" role="status" aria-label={`${pin.length}자리 입력됨`}>
        {Array.from({ length: PIN_LENGTH }, (_, i) => (
          <span
            key={i}
            className={cn(
              "size-3.5 rounded-full transition-colors duration-150",
              i < pin.length ? "bg-foreground" : "bg-muted-foreground/30",
            )}
          />
        ))}
      </div>

      <div className={cn("grid grid-cols-3 gap-3 w-full max-w-[260px]", checking && "pointer-events-none opacity-60")}>
        {KEYPAD_DIGITS.map((d) => (
          <Button
            key={d}
            type="button"
            variant="secondary"
            className="h-14 text-xl font-semibold tabular-nums"
            aria-label={`숫자 ${d}`}
            onClick={() => push(d)}
          >
            {d}
          </Button>
        ))}
        <span />
        <Button
          type="button"
          variant="secondary"
          className="h-14 text-xl font-semibold tabular-nums"
          aria-label="숫자 0"
          onClick={() => push("0")}
        >
          0
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="h-14"
          aria-label="한 자리 지우기"
          onClick={pop}
        >
          <Delete className="size-5" />
        </Button>
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
