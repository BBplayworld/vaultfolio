"use client";

import { AssetData, assetDataSchema } from "@/types/asset";
import LZString from "lz-string";

// ─── localStorage 키 (중앙 관리) ────────────────────────────────────────────
export const STORAGE_KEYS = {
  assetData: "vaultfolio-asset-data",
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
  a.download = `vaultfolio-${new Date().toISOString().split("T")[0]}.json`;
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

// ─── 공유 토큰 시스템 V7.1 (PIN Support) ──────────────────────────────────

const SHARED_KEY_V7 = "vlt-fl-v7.1";
const PIVOT_DATE = Date.UTC(2020, 0, 1); // 2020-01-01 UTC 기준

/**
 * [V7.1 수정 사항]
 * 1. 4자리 PIN 인증 지원: PIN 입력 시 데이터를 XOR 암호화하여 보호
 * 2. PIN 검증 기능: 복호화 후 "OK|" 접두사를 확인하여 비밀번호 일치 여부 판단
 */

const DICT = {
  re: ["apartment", "house", "land", "commercial", "other"],
  st: ["domestic", "foreign", "irp", "isa", "pension", "unlisted"],
  lo: ["credit", "minus", "mortgage-home", "mortgage-stock", "mortgage-insurance", "mortgage-deposit", "mortgage-other"],
  ca: ["bank", "cash", "deposit", "savings"],
  cu: ["KRW", "USD", "JPY"],
  ins: [
    "Upbit", "Bithumb", "Binance", "Coinone", "Korbit", "신한", "국민", "우리", "하나", "농협", "기업", "산업", "외환", "수협", "새마을", "신협", "우체국", "카카오", "토스", "케이",
    "SC제일", "경남", "광주", "대구", "부산", "전북", "제주", "저축은행", "증권", "기타", "MEXC", "OKX", "Gate.io", "Bybit", "Bitget", "KuCoin"
  ]
} as const;

// lz-string URI safe alphabet: 64+1 characters
const URI_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+-$";

const cryptWithPin = (str: string, pin: string, decrypt = false) => {
  if (!pin || pin.length !== 4) return str;
  const pinNumbers = pin.split("").map(Number);
  const len = URI_ALPHABET.length;
  return str.split("").map((c, i) => {
    const idx = URI_ALPHABET.indexOf(c);
    if (idx === -1) return c; // Alphabet 외의 문자는 그대로 유지 (실제로는 lz-string URI 압축기에선 발생 안함)
    const shift = pinNumbers[i % pinNumbers.length];
    const newIdx = decrypt
      ? (idx - shift + len) % len
      : (idx + shift) % len;
    return URI_ALPHABET[newIdx];
  }).join("");
};

// 숫자 패턴 압축 (V7.1 개량형: 소수점 정밀도 유지 및 0 처리)
const pNum = (n: any) => {
  if (typeof n !== "number") return "";
  if (n === 0) return "0";

  if (Number.isInteger(n)) {
    if (n % 1000000 === 0) return (n / 1000000).toString(36) + "M";
    if (n % 1000 === 0) return (n / 1000).toString(36) + "K";
    return n.toString(36);
  }

  // 소수점 압축 (최대 12자리 보존)
  const floatStr = n.toFixed(12).replace(/\.?0+$/, "");
  const dotIdx = floatStr.indexOf(".");
  if (dotIdx > -1) {
    const decimals = floatStr.length - dotIdx - 1;
    const scaled = Math.round(n * Math.pow(10, decimals));
    // decimals(Base36 0-c) + scaled(Base36)
    return "_" + decimals.toString(36) + scaled.toString(36);
  }
  return n.toString(36);
};

const uNum = (v: any) => {
  if (!v) return 0;
  if (v === "0") return 0;
  if (typeof v === "string") {
    if (v.startsWith("_")) {
      const decimals = parseInt(v[1], 36);
      const scaled = parseInt(v.substring(2), 36);
      if (isNaN(decimals) || isNaN(scaled)) return 0;
      return scaled / Math.pow(10, decimals);
    }
    if (v.startsWith("F")) return parseFloat(v.substring(1)); // V6 하위 호환용
    if (v.endsWith("M")) return parseInt(v.slice(0, -1), 36) * 1000000;
    if (v.endsWith("K")) return parseInt(v.slice(0, -1), 36) * 1000;
    const p = parseInt(v, 36);
    return isNaN(p) ? 0 : p;
  }
  return typeof v === "number" ? v : 0;
};

// 날짜 패턴 압축 (경과일수)
const pDate = (d?: string) => {
  if (!d) return "";
  const [y, m, day] = d.split('-').map(Number);
  const utcMs = Date.UTC(y, m - 1, day);
  const days = Math.round((utcMs - PIVOT_DATE) / 86400000);
  return days.toString(36);
};

const uDate = (v?: string) => {
  if (!v) return "";
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
  return idx > -1 ? `#${idx}` : clean;
};
const uTxt = (s?: any) => {
  if (typeof s === "string" && s.startsWith("#")) return DICT.ins[parseInt(s.substring(1))] || s;
  return s || "";
};

function packV7(data: AssetData, rates?: { USD: number; JPY: number }): string {
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

function unpackV7(raw: string): { data: any, rates?: { USD: number, JPY: number } } {
  const parts = raw.split("^");
  const gid = () => Math.random().toString(36).substring(2, 11);
  const getIdx = (idx: any, list: readonly string[]) => list[parseInt(idx)] || list[0];

  const section = (idx: number) => (parts[idx] ? parts[idx].split("~") : []).filter(r => r !== "");
  const fields = (r: string) => r.split("|");

  const data = {
    realEstate: section(0).map(r => {
      const f = fields(r);
      const name = uTxt(f[1]) || "무명";
      return { id: gid(), type: getIdx(f[0], DICT.re), name, address: uTxt(f[2]), purchasePrice: uNum(f[3]), currentValue: uNum(f[4]), purchaseDate: uDate(f[5]), tenantDeposit: uNum(f[6]), description: uTxt(f[7]) };
    }),
    stocks: section(1).map(r => {
      const f = fields(r);
      const name = uTxt(f[1]) || "무명";
      return { id: gid(), category: getIdx(f[0], DICT.st), name, ticker: f[2] === "*" ? name : (uTxt(f[2]) || ""), quantity: uNum(f[3]), averagePrice: uNum(f[4]), currentPrice: uNum(f[5]), currency: getIdx(f[6], DICT.cu), purchaseDate: uDate(f[7]), description: uTxt(f[8]) };
    }),
    crypto: section(2).map(r => {
      const f = fields(r);
      const name = uTxt(f[0]) || "무명";
      return { id: gid(), name, symbol: f[1] === "*" ? name : (uTxt(f[1]) || "SYMBOL"), quantity: uNum(f[2]), averagePrice: uNum(f[3]), currentPrice: uNum(f[4]), purchaseDate: uDate(f[5]), exchange: uTxt(f[6]), description: uTxt(f[7]) };
    }),
    cash: section(3).map(r => {
      const f = fields(r);
      return { id: gid(), type: getIdx(f[0], DICT.ca), name: uTxt(f[1]) || "무명", balance: uNum(f[2]), currency: getIdx(f[3], DICT.cu), institution: uTxt(f[4]), description: uTxt(f[5]) };
    }),
    loans: section(4).map(r => {
      const f = fields(r);
      return { id: gid(), type: getIdx(f[0], DICT.lo), name: uTxt(f[1]) || "무명", balance: uNum(f[2]), interestRate: (parseInt(f[3]) || 0) / 1000, startDate: uDate(f[4]), endDate: uDate(f[5]), institution: uTxt(f[6]), description: uTxt(f[7]) };
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

export function generateShareToken(data: AssetData, rates?: { USD: number; JPY: number }, pin?: string): string {
  try {
    const dsv = "OK|" + packV7(data, rates); // PIN 검증 및 무결성 확인용 접두사
    const compressed = LZString.compressToEncodedURIComponent(dsv);

    if (pin && pin.length === 4) {
      // V7.1: 압축된 결과물에 PIN 기반 시프팅 적용 (압축률 유지 및 길이 최소화)
      return "v71P" + cryptWithPin(compressed, pin);
    }
    return "v71N" + compressed;
  } catch (error) {
    return "";
  }
}

export type ParseResult = { data: AssetData, rates?: { USD: number, JPY: number } } | { pinRequired: true } | null;

export function parseShareToken(token: string, pin?: string): ParseResult {
  if (!token) return null;
  try {
    // 최신 버전 (v71P, v71N) 처리 (압축 결과에 시프팅 적용)
    if (token.startsWith("v71")) {
      const type = token[3]; // N or P
      let compressed = token.substring(4);

      if (type === "P") {
        if (!pin) return { pinRequired: true };
        compressed = cryptWithPin(compressed, pin, true);
      }

      const dsv = LZString.decompressFromEncodedURIComponent(compressed);
      if (!dsv || !dsv.startsWith("OK|")) return null; // PIN 틀림 또는 데이터 손상

      const result = unpackV7(dsv.substring(3));
      return {
          data: assetDataSchema.parse(result.data),
          rates: result.rates
      };
    }

    // 하위 호환성 (V7.1:N:, V7.1:P:, V7.0)
    let decompressed = LZString.decompressFromEncodedURIComponent(token);
    
    if (decompressed && decompressed.startsWith("vlt-fl-v7.1:")) {
      const parts = decompressed.split(":");
      const flag = parts[2];
      let dsv = parts.slice(3).join(":");
      if (flag === "P") {
        if (!pin) return { pinRequired: true };
        const decrypted = xor(dsv, pin);
        if (!decrypted.startsWith("OK|")) return null;
        dsv = decrypted.substring(3);
      }
      const result = unpackV7(dsv);
      return { data: assetDataSchema.parse(result.data), rates: result.rates };
    }

    if (decompressed && decompressed.startsWith("vlt-fl-v7.0:")) {
      const dsv = decompressed.substring("vlt-fl-v7.0:".length);
      const result = unpackV7(dsv);
      return { data: assetDataSchema.parse(result.data), rates: result.rates };
    }

    // V6.x 하위 호환 (Base64 + XOR)
    const fromSafe = (s: string) => s.replace(/\./g, '+').replace(/_/g, '/');
    const SHARED_KEY_V6 = "vlt-fl-v6.2";
    const raw = LZString.decompressFromBase64(fromSafe(token));
    if (raw) {
        const deob = raw.split("").map((char, i) =>
            String.fromCharCode(char.charCodeAt(0) ^ SHARED_KEY_V6.charCodeAt(i % SHARED_KEY_V6.length))
        ).join("");
        const result = unpackV7(deob);
        return { data: assetDataSchema.parse(result.data), rates: result.rates };
    }

    return null;
  } catch (error) {
    console.error("Token parsing error:", error);
    return null;
  }
}

const xor = (str: string, key: string) => {
  return str.split("").map((c, i) => String.fromCharCode(c.charCodeAt(0) ^ key.charCodeAt(i % key.length))).join("");
};

