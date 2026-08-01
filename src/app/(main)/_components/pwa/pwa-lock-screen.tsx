"use client";

import { useState, useEffect, useCallback, useRef, type ReactNode } from "react";
import { ShieldCheck, AlertTriangle, Delete } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MAIN_PALETTE, Z_LAYER } from "@/config/theme";
import { useAssetData } from "@/contexts/asset-data-context";
import { cn } from "@/lib/utils";
import { emitPwaUnlocked, isPwaLocked, markPwaAuthenticated, verifyPwaAuthPin } from "@/lib/pwa/app-lock";

const PIN_LENGTH = 4;
const KEYPAD_DIGITS = ["1", "2", "3", "4", "5", "6", "7", "8", "9"] as const;

/**
 * 키패드 키 — 누르는 순간(pointerdown) 반영한다.
 * `click`은 pointerup 이후에 오므로 손가락을 뗄 때 입력돼 굼뜨게 느껴진다.
 * 접근성을 위해 click도 받되, 키보드·보조기술 활성화(detail===0)이면서
 * 직전 pointerdown이 없을 때만 통과시켜 중복 입력을 막는다.
 */
function KeypadKey({
  label,
  onPress,
  variant = "secondary",
  className,
  children,
}: {
  label: string;
  onPress: () => void;
  variant?: "secondary" | "ghost";
  className?: string;
  children: ReactNode;
}) {
  const pressedAt = useRef(0);
  return (
    <Button
      type="button"
      variant={variant}
      aria-label={label}
      className={cn(
        // touch-none: 세로 팬을 허용하면 iOS가 "탭 vs 스크롤"을 판별하느라 pointerdown을 늦춘다.
        // 잠금화면은 스크롤할 것이 없으므로 모호성을 없애 즉시 발화시킨다.
        "h-14 duration-50 select-none touch-none [-webkit-tap-highlight-color:transparent]",
        className,
      )}
      onPointerDown={() => { pressedAt.current = Date.now(); onPress(); }}
      onClick={(e) => { if (e.detail === 0 && Date.now() - pressedAt.current > 500) onPress(); }}
    >
      {children}
    </Button>
  );
}

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

    // 잠금 판정은 isPwaLocked() 단일 소스 (웹·PWA 모두 동작)
    if (isPwaLocked()) setLocked(true);
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
        // ① 세션 인증부터 기록 — 이게 없으면 unlockAndLoad가 백그라운드 가드에 스스로 막힌다
        markPwaAuthenticated();
        setLocked(false);
        // ② 로컬 로드를 먼저 끝내고 ③ 해제 이벤트로 원격 pull을 트리거한다.
        // 병렬로 두면 pull(clearAssetData→전체 교체)과 구 데이터 기준 시세·스냅샷 저장이
        // 동시에 진행돼 서로를 덮어쓴다. finally로 감싸야 unlockAndLoad가 throw해도
        // (스토리지 차단 환경에서 실제 가능) 해제 알림이 유실되지 않는다.
        try {
          await unlockRef.current();
        } finally {
          emitPwaUnlocked();
        }
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
              // 전환 없음 — 누르는 즉시 채워져야 반응이 빠르게 읽힌다
              "size-3.5 rounded-full",
              i < pin.length ? "bg-foreground" : "bg-muted-foreground/30",
            )}
          />
        ))}
      </div>

      <div className={cn("grid grid-cols-3 gap-3 w-full max-w-[260px]", checking && "pointer-events-none opacity-60")}>
        {KEYPAD_DIGITS.map((d) => (
          <KeypadKey key={d} label={`숫자 ${d}`} className="text-xl font-semibold tabular-nums" onPress={() => push(d)}>
            {d}
          </KeypadKey>
        ))}
        <span />
        <KeypadKey label="숫자 0" className="text-xl font-semibold tabular-nums" onPress={() => push("0")}>
          0
        </KeypadKey>
        <KeypadKey label="한 자리 지우기" variant="ghost" onPress={pop}>
          <Delete className="size-5" />
        </KeypadKey>
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
