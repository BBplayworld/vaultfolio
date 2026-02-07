"use client";

import { AssetData, assetDataSchema } from "@/types/asset";

const STORAGE_KEY = "personal-asset-data";

// 기본 자산 데이터
const defaultAssetData: AssetData = {
  realEstate: [],
  stocks: [],
  crypto: [],
  loans: [],
  yearlyNetAssets: [],
  lastUpdated: new Date().toISOString(),
};

// LocalStorage에서 자산 데이터 가져오기
export function getAssetData(): AssetData {
  if (typeof window === "undefined") {
    return defaultAssetData;
  }

  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) {
      return defaultAssetData;
    }

    const parsed = JSON.parse(data);
    return assetDataSchema.parse(parsed);
  } catch (error) {
    console.error("Failed to load asset data:", error);
    return defaultAssetData;
  }
}

// LocalStorage에 자산 데이터 저장
export function saveAssetData(data: AssetData): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  try {
    const validated = assetDataSchema.parse(data);
    validated.lastUpdated = new Date().toISOString();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(validated));
    return true;
  } catch (error) {
    console.error("Failed to save asset data:", error);
    return false;
  }
}

// 자산 데이터를 JSON 파일로 내보내기
export function exportAssetData(): void {
  const data = getAssetData();
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `personal-asset-data-${new Date().toISOString().split("T")[0]}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// JSON 파일에서 자산 데이터 가져오기
export function importAssetData(file: File): Promise<AssetData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const parsed = JSON.parse(text);
        const validated = assetDataSchema.parse(parsed);
        saveAssetData(validated);
        resolve(validated);
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

// 자산 데이터 초기화
export function clearAssetData(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  try {
    localStorage.removeItem(STORAGE_KEY);
    return true;
  } catch (error) {
    console.error("Failed to clear asset data:", error);
    return false;
  }
}
