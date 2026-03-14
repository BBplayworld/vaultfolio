"use client";

import { AssetData, assetDataSchema } from "@/types/asset";
import LZString from "lz-string";

// ─── localStorage 키 (중앙 관리) ────────────────────────────────────────────
export const STORAGE_KEYS = {
  assetData: "personal-asset-data",
  exchangeRate: "exchange-rate-usd-krw",
  defaultExchangeRate: 1380,
} as const;

// ─── 기본 자산 데이터 ───────────────────────────────────────────────────────
const EMPTY_ASSET_DATA: AssetData = {
  realEstate: [],
  stocks: [],
  crypto: [],
  cash: [],
  loans: [],
  yearlyNetAssets: [],
  lastUpdated: "",
};

export function getAssetData(): AssetData {
  if (typeof window === "undefined") return EMPTY_ASSET_DATA;
  try {
    const data = localStorage.getItem(STORAGE_KEYS.assetData);
    if (!data) return EMPTY_ASSET_DATA;
    return assetDataSchema.parse(JSON.parse(data));
  } catch (error) {
    console.error("Failed to load asset data:", error);
    return EMPTY_ASSET_DATA;
  }
}

export function saveAssetData(data: AssetData): boolean {
  if (typeof window === "undefined") return false;
  try {
    const validated = assetDataSchema.parse(data);
    validated.lastUpdated = new Date().toISOString();
    localStorage.setItem(STORAGE_KEYS.assetData, JSON.stringify(validated));
    return true;
  } catch (error) {
    console.error("Failed to save asset data:", error);
    return false;
  }
}

export function exportAssetData(): void {
  const data = getAssetData();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `personal-asset-data-${new Date().toISOString().split("T")[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

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

export function clearAssetData(): boolean {
  if (typeof window === "undefined") return false;
  try {
    localStorage.removeItem(STORAGE_KEYS.assetData);
    return true;
  } catch (error) {
    return false;
  }
}

// ─── 공유 토큰 시스템 V6.1 (Historical Date Fix + High Precision) ────────────

const SHARED_KEY = "vlt-fl-v6.1";
const PIVOT_DATE = Date.UTC(2020, 0, 1); // 2020-01-01 UTC 기준

const DICT = {
  re: ["apartment", "house", "land", "commercial", "other"],
  st: ["domestic", "foreign", "irp", "isa", "pension", "unlisted"],
  lo: ["credit", "minus", "mortgage-home", "mortgage-stock", "mortgage-insurance", "mortgage-deposit", "mortgage-other"],
  ca: ["bank", "cash", "deposit", "savings"],
  cu: ["KRW", "USD", "JPY"],
  ins: ["Upbit", "Bithumb", "Binance", "Coinone", "Korbit", "신한", "국민", "우리", "하나", "농협", "기업", "산업", "외환", "수협", "새마을", "신협", "우체국", "카카오", "토스", "케이"]
} as const;

/**
 * [V6.1 수정 사항]
 * 1. Historical Date Fix: PIVOT_DATE(2020년) 이전의 날짜도 정상 압축 및 복구 (음수 허용)
 * 2. Fallback 제거: 파싱 시 데이터가 없으면 오늘 날짜로 덮어쓰지 않고 원본 유지 보장
 * 3. High Precision 보존: 코인 수량 등 소수점 15자리 유지
 */

// 숫자 패턴 압축
const pNum = (n: any) => {
  if (typeof n !== "number" || n === 0) return "";
  if (Number.isInteger(n)) {
    if (n % 1000000 === 0) return (n / 1000000).toString(36) + "m";
    if (n % 1000 === 0) return (n / 1000).toString(36) + "k";
    return n.toString(36);
  }
  // 소수점 보존 (지수 표기 방지하여 15자리까지)
  const floatStr = n.toFixed(15).replace(/\.?0+$/, "");
  return "f" + floatStr;
};

const uNum = (v: any) => {
  if (!v) return 0;
  if (typeof v === "string" && v.startsWith("f")) return parseFloat(v.substring(1));
  if (typeof v === "string" && v.endsWith("m")) return parseInt(v.slice(0, -1), 36) * 1000000;
  if (typeof v === "string" && v.endsWith("k")) return parseInt(v.slice(0, -1), 36) * 1000;
  return parseInt(v, 36);
};

// 날짜 패턴 압축 (경과일수 - 2020년 이전 음수 허용)
const pDate = (d?: string) => {
  if (!d) return "";
  const [y, m, day] = d.split('-').map(Number);
  const utcMs = Date.UTC(y, m - 1, day);
  const days = Math.round((utcMs - PIVOT_DATE) / 86400000);
  // days가 음수여도 toString(36)은 "-1p" 처럼 정상 작동함
  return days.toString(36);
};

const uDate = (v?: string) => {
  if (!v) return "";
  // parseInt("-1p", 36)은 음수를 정상적으로 반환함
  const ms = PIVOT_DATE + parseInt(v, 36) * 86400000;
  const d = new Date(ms);
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// 텍스트 정제
const sTxt = (s?: string) => {
  if (!s) return "";
  const clean = s.replace(/\|/g, " ").replace(/~/g, " ").replace(/\^/g, " ");
  const idx = DICT.ins.findIndex(v => clean.includes(v));
  return idx > -1 ? `i${idx}` : clean;
};
const uTxt = (s?: any) => {
  if (typeof s === "string" && s.startsWith("i")) return DICT.ins[parseInt(s.substring(1))] || s;
  return s || "";
};

function packV6(data: AssetData, rates?: { USD: number; JPY: number }): string {
  const row = (arr: any[]) => {
    while (arr.length > 0 && (arr[arr.length - 1] === "" || arr[arr.length - 1] === 0 || arr[arr.length - 1] === undefined || arr[arr.length - 1] === null)) arr.pop();
    return arr.join("|");
  };
  const section = (items: any[]) => items.map(i => row(i)).join("~");

  const parts = [
    section(data.realEstate.map(i => [DICT.re.indexOf(i.type), sTxt(i.name), sTxt(i.address), pNum(i.purchasePrice), pNum(i.currentValue), pDate(i.purchaseDate), pNum(i.tenantDeposit), sTxt(i.description)])),
    section(data.stocks.map(i => [DICT.st.indexOf(i.category), sTxt(i.name), i.name === i.ticker ? "*" : sTxt(i.ticker), pNum(i.quantity), pNum(i.averagePrice), pNum(i.currentPrice), DICT.cu.indexOf(i.currency || "KRW"), pDate(i.purchaseDate), sTxt(i.description)])),
    section(data.crypto.map(i => [sTxt(i.name), i.name === i.symbol ? "*" : sTxt(i.symbol), pNum(i.quantity), pNum(i.averagePrice), pNum(i.currentPrice), pDate(i.purchaseDate), sTxt(i.exchange), sTxt(i.description)])),
    section(data.cash?.map(i => [DICT.ca.indexOf(i.type), sTxt(i.name), pNum(i.balance), DICT.cu.indexOf(i.currency || "KRW"), sTxt(i.institution), sTxt(i.description)]) || []),
    section(data.loans?.map(i => [DICT.lo.indexOf(i.type as any), sTxt(i.name), pNum(i.balance), Math.round((i.interestRate || 0) * 1000), pDate(i.startDate), pDate(i.endDate), sTxt(i.institution), sTxt(i.description)]) || []),
    section(data.yearlyNetAssets.map(i => [i.year, pNum(i.netAsset), sTxt(i.note)])),
    pDate(data.lastUpdated.split('T')[0]),
    rates ? `${pNum(rates.USD)}|${pNum(rates.JPY)}` : ""
  ];

  return parts.join("^");
}

function unpackV6(raw: string): { data: any, rates?: { USD: number, JPY: number } } {
  const parts = raw.split("^");
  const gid = () => Math.random().toString(36).substring(2, 11);
  const getIdx = (idx: any, list: readonly string[]) => list[parseInt(idx)] || list[0];
  
  const section = (idx: number) => (parts[idx] ? parts[idx].split("~") : []).filter(r => r !== "");
  const fields = (r: string) => r.split("|");

  const data = {
    realEstate: section(0).map(r => {
      const f = fields(r);
      const name = uTxt(f[1]) || "무명";
      return { id: gid(), type: getIdx(f[0], DICT.re), name, address: uTxt(f[2]), purchasePrice: uNum(f[3]) || 1, currentValue: uNum(f[4]) || 1, purchaseDate: uDate(f[5]), tenantDeposit: uNum(f[6]), description: uTxt(f[7]) };
    }),
    stocks: section(1).map(r => {
      const f = fields(r);
      const name = uTxt(f[1]) || "무명";
      return { id: gid(), category: getIdx(f[0], DICT.st), name, ticker: f[2] === "*" ? name : (uTxt(f[2]) || ""), quantity: uNum(f[3]) || 1, averagePrice: uNum(f[4]) || 1, currentPrice: uNum(f[5]) || 1, currency: getIdx(f[6], DICT.cu), purchaseDate: uDate(f[7]), description: uTxt(f[8]) };
    }),
    crypto: section(2).map(r => {
      const f = fields(r);
      const name = uTxt(f[0]) || "무명";
      return { id: gid(), name, symbol: f[1] === "*" ? name : (uTxt(f[1]) || "SYMBOL"), quantity: uNum(f[2]) || 0.000001, averagePrice: uNum(f[3]) || 1, currentPrice: uNum(f[4]) || 1, purchaseDate: uDate(f[5]), exchange: uTxt(f[6]), description: uTxt(f[7]) };
    }),
    cash: section(3).map(r => {
      const f = fields(r);
      return { id: gid(), type: getIdx(f[0], DICT.ca), name: uTxt(f[1]) || "무명", balance: uNum(f[2]) || 1, currency: getIdx(f[3], DICT.cu), institution: uTxt(f[4]), description: uTxt(f[5]) };
    }),
    loans: section(4).map(r => {
      const f = fields(r);
      return { id: gid(), type: getIdx(f[0], DICT.lo), name: uTxt(f[1]) || "무명", balance: uNum(f[2]) || 1, interestRate: (parseInt(f[3]) || 0) / 1000, startDate: uDate(f[4]), endDate: uDate(f[5]), institution: uTxt(f[6]), description: uTxt(f[7]) };
    }),
    yearlyNetAssets: section(5).map(r => {
      const f = fields(r);
      return { year: parseInt(f[0]) || new Date().getFullYear(), netAsset: uNum(f[1]), note: uTxt(f[2]) };
    }),
    lastUpdated: new Date().toISOString()
  };

  let rates;
  if (parts[7]) {
    const r = parts[7].split("|");
    rates = { USD: uNum(r[0]), JPY: uNum(r[1]) };
  }

  return { data, rates };
}

const toSafe = (s: string) => s.replace(/\+/g, '.').replace(/\//g, '_').replace(/=/g, '');
const fromSafe = (s: string) => s.replace(/\./g, '+').replace(/_/g, '/');

export function generateShareToken(data: AssetData, rates?: { USD: number; JPY: number }): string {
  try {
    const dsv = packV6(data, rates);
    const obfuscated = dsv.split("").map((char, i) => 
      String.fromCharCode(char.charCodeAt(0) ^ SHARED_KEY.charCodeAt(i % SHARED_KEY.length))
    ).join("");
    return toSafe(LZString.compressToBase64(obfuscated));
  } catch (error) {
    return "";
  }
}

export function parseShareToken(token: string): { data: AssetData, rates?: { USD: number, JPY: number } } | null {
  if (!token) return null;
  try {
    const raw = LZString.decompressFromBase64(fromSafe(token));
    if (!raw) return null;
    const deob = raw.split("").map((char, i) => 
      String.fromCharCode(char.charCodeAt(0) ^ SHARED_KEY.charCodeAt(i % SHARED_KEY.length))
    ).join("");
    const result = unpackV6(deob);
    return {
      data: assetDataSchema.parse(result.data),
      rates: result.rates
    };
  } catch (error) {
    console.error("Token parsing error:", error);
    return null;
  }
}
