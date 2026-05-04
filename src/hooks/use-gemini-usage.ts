"use client";

// 기기(브라우저)별 하루 Gemini AI 인식 사용 한도
const CLIENT_DAILY_LIMIT = 15;

type ParseAssetType = "stock" | "crypto" | "cash" | "loan";

interface GeminiUsageData {
  date: string;
  count: number;
  byType: Record<ParseAssetType, number>;
}

const DEFAULT_USAGE: GeminiUsageData = {
  date: "",
  count: 0,
  byType: { stock: 0, crypto: 0, cash: 0, loan: 0 },
};

// KST 기준 오늘 날짜 문자열 (YYYY-MM-DD)
function getTodayKST(): string {
  return new Date(Date.now() + 9 * 3600 * 1000).toISOString().split("T")[0];
}

import { STORAGE_KEYS } from "@/lib/local-storage";

function readUsage(): GeminiUsageData {
  if (typeof window === "undefined") return { ...DEFAULT_USAGE, date: getTodayKST() };
  const today = getTodayKST();
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.geminiUsage);
    if (!raw) return { ...DEFAULT_USAGE, date: today };
    const parsed = JSON.parse(raw) as GeminiUsageData;

    // 날짜가 다르면(오늘이 아니면) 초기화된 데이터 반환 (자동 만료 효과)
    if (parsed.date !== today) {
      return { ...DEFAULT_USAGE, date: today };
    }

    return {
      date: parsed.date,
      count: parsed.count ?? 0,
      byType: { ...DEFAULT_USAGE.byType, ...parsed.byType },
    };
  } catch {
    return { ...DEFAULT_USAGE, date: today };
  }
}

function writeUsage(data: GeminiUsageData): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEYS.geminiUsage, JSON.stringify(data));

    // 기존의 일별 키(구버전)가 남아있다면 청소 (하위 호환성 및 정리)
    const today = getTodayKST();
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith("secretasset-gemini-") && key !== STORAGE_KEYS.geminiUsage) {
        localStorage.removeItem(key);
      }
    }
  } catch {
    // ignore
  }
}

export function useGeminiUsage() {
  const getUsage = (): GeminiUsageData => readUsage();

  const increment = (assetType: ParseAssetType): GeminiUsageData => {
    const usage = readUsage();
    const next: GeminiUsageData = {
      ...usage,
      count: usage.count + 1,
      byType: {
        ...usage.byType,
        [assetType]: (usage.byType[assetType] ?? 0) + 1,
      },
    };
    writeUsage(next);
    return next;
  };

  const canUse = (): boolean => readUsage().count < CLIENT_DAILY_LIMIT;

  const remaining = (): number =>
    Math.max(0, CLIENT_DAILY_LIMIT - readUsage().count);

  return { getUsage, increment, canUse, remaining, limit: CLIENT_DAILY_LIMIT };
}
