"use client";

// 기기(브라우저)별 하루 Gemini AI 인식 사용 한도
const CLIENT_DAILY_LIMIT = 15;

type ParseAssetType = "stock" | "crypto" | "cash" | "loan";

interface GeminiUsageData {
  count: number;
  byType: Record<ParseAssetType, number>;
}

const DEFAULT_USAGE: GeminiUsageData = {
  count: 0,
  byType: { stock: 0, crypto: 0, cash: 0, loan: 0 },
};

// KST 기준 오늘 날짜 문자열 (YYYY-MM-DD)
function getTodayKST(): string {
  return new Date(Date.now() + 9 * 3600 * 1000).toISOString().split("T")[0];
}

function getStorageKey(): string {
  return `secretasset-gemini-${getTodayKST()}`;
}

function readUsage(): GeminiUsageData {
  if (typeof window === "undefined") return { ...DEFAULT_USAGE };
  try {
    const raw = localStorage.getItem(getStorageKey());
    if (!raw) return { ...DEFAULT_USAGE };
    const parsed = JSON.parse(raw) as GeminiUsageData;
    return {
      count: parsed.count ?? 0,
      byType: { ...DEFAULT_USAGE.byType, ...parsed.byType },
    };
  } catch {
    return { ...DEFAULT_USAGE };
  }
}

function writeUsage(data: GeminiUsageData): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(getStorageKey(), JSON.stringify(data));
  } catch {
    // localStorage 쓰기 실패 시 무시 (용량 초과 등)
  }
}

export function useGeminiUsage() {
  const getUsage = (): GeminiUsageData => readUsage();

  const increment = (assetType: ParseAssetType): GeminiUsageData => {
    const usage = readUsage();
    const next: GeminiUsageData = {
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
