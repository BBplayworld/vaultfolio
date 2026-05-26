"use client";

import { useEffect, useState } from "react";
import { STORAGE_KEYS } from "@/lib/local-storage";

const EVENT = "secretasset-nickname-change";

// 한글·영문·숫자만, 최대 8자
export const NICKNAME_MAX = 8;
export function sanitizeNickname(input: string): string {
  return input.replace(/[^A-Za-z0-9가-힣ㄱ-ㅎㅏ-ㅣ]/g, "").slice(0, NICKNAME_MAX);
}

function readNickname(): string {
  if (typeof window === "undefined") return "";
  try {
    return localStorage.getItem(STORAGE_KEYS.nickname) ?? "";
  } catch {
    return "";
  }
}

export function useNickname(): [string, (next: string) => void] {
  const [nickname, setNicknameState] = useState<string>("");

  useEffect(() => {
    setNicknameState(readNickname());
    const handler = () => setNicknameState(readNickname());
    window.addEventListener(EVENT, handler);
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener(EVENT, handler);
      window.removeEventListener("storage", handler);
    };
  }, []);

  const setNickname = (next: string) => {
    const clean = sanitizeNickname(next);
    try {
      if (clean) localStorage.setItem(STORAGE_KEYS.nickname, clean);
      else localStorage.removeItem(STORAGE_KEYS.nickname);
    } catch { /* ignore */ }
    setNicknameState(clean);
    window.dispatchEvent(new CustomEvent(EVENT));
  };

  return [nickname, setNickname];
}
