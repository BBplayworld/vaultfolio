// 스냅샷 localStorage 읽기 헬퍼 — 성적표·브리핑 등 뷰 공용 (원본 전체 반환, 필터 없음)

import type { DailyAssetSnapshot, MonthlyAssetSnapshot } from "@/types/asset";
import { STORAGE_KEYS } from "@/lib/local-storage";

export function readDailySnapshots(): DailyAssetSnapshot[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.dailySnapshots);
    return raw ? (JSON.parse(raw) as DailyAssetSnapshot[]) : [];
  } catch {
    return [];
  }
}

export function readMonthlySnapshots(): MonthlyAssetSnapshot[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.monthlySnapshots);
    return raw ? (JSON.parse(raw) as MonthlyAssetSnapshot[]) : [];
  } catch {
    return [];
  }
}
