"use client";

import { useEffect, useState } from "react";
import { STORAGE_KEYS } from "@/lib/local-storage";
import { getAssetData, saveAssetData } from "@/lib/asset-storage";

export const NICKNAME_EVENT = "secretasset-nickname-change";

// 한글·영문·숫자만, 최대 8자
export const NICKNAME_MAX = 8;
export function sanitizeNickname(input: string): string {
  return input.replace(/[^A-Za-z0-9가-힣ㄱ-ㅎㅏ-ㅣ]/g, "").slice(0, NICKNAME_MAX);
}

// 닉네임 localStorage 기록 + 변경 이벤트 디스패치 (React 외부·가져오기/공유 적용 시 공용 사용)
export function persistNickname(next: string): void {
  if (typeof window === "undefined") return;
  const clean = sanitizeNickname(next);
  try {
    const data = getAssetData();
    data.nickname = clean;
    saveAssetData(data);
    // 단독 키 제거(마이그레이션 완료)
    localStorage.removeItem(STORAGE_KEYS.nickname);
  } catch { /* ignore */ }
  window.dispatchEvent(new CustomEvent(NICKNAME_EVENT));
}

function readNickname(): string {
  if (typeof window === "undefined") return "";
  try {
    return getAssetData().nickname ?? "";
  } catch {
    return "";
  }
}

export function useNickname(): [string, (next: string) => void] {
  const [nickname, setNicknameState] = useState<string>("");

  useEffect(() => {
    setNicknameState(readNickname());
    const handler = () => setNicknameState(readNickname());
    window.addEventListener(NICKNAME_EVENT, handler);
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener(NICKNAME_EVENT, handler);
      window.removeEventListener("storage", handler);
    };
  }, []);

  const setNickname = (next: string) => {
    const clean = sanitizeNickname(next);
    persistNickname(clean);
    setNicknameState(clean);
  };

  return [nickname, setNickname];
}
