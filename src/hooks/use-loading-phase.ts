"use client";

// 외부 데이터 대기 단계(4.84 공통 로딩 UI) — quiet(0~0.5초: 스켈레톤만, 빠른 응답은 깜빡임 없이) → note(0.5초~: 상태 문구) → slow(5초~: 지연 문구).
// 타이머 로직은 순수 함수(startLoadingPhase)로 분리해 훅 없이 fake timer로 테스트한다. 영역(LoadingNote) 단위로 타이머 1개.
import { useEffect, useState } from "react";

export type LoadingPhase = "quiet" | "note" | "slow";

export const NOTE_DELAY_MS = 500;
export const SLOW_DELAY_MS = 5000;

/** 경과 시간 → 단계 */
export function loadingPhaseAt(elapsedMs: number): LoadingPhase {
  return elapsedMs >= SLOW_DELAY_MS ? "slow" : elapsedMs >= NOTE_DELAY_MS ? "note" : "quiet";
}

/** 타이머 시작 — 단계가 바뀔 때만 콜백. 반환 함수로 취소(타이머 중복 0) */
export function startLoadingPhase(onPhase: (p: LoadingPhase) => void): () => void {
  onPhase("quiet");
  const a = setTimeout(() => onPhase("note"), NOTE_DELAY_MS);
  const b = setTimeout(() => onPhase("slow"), SLOW_DELAY_MS);
  return () => {
    clearTimeout(a);
    clearTimeout(b);
  };
}

/** active=true인 동안 단계를 돌려준다. 꺼지면 null(다음에 켜지면 quiet부터 다시) */
export function useLoadingPhase(active: boolean): LoadingPhase | null {
  const [phase, setPhase] = useState<LoadingPhase>("quiet");
  useEffect(() => {
    if (!active) return;
    const stop = startLoadingPhase(setPhase);
    return () => {
      stop();
      setPhase("quiet");
    };
  }, [active]);
  return active ? phase : null;
}
