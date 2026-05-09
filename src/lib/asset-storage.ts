"use client";

import { z } from "zod";
import { AssetData, assetDataSchema, AssetSnapshots, DailyAssetSnapshot, MonthlyAssetSnapshot } from "@/types/asset";
import LZString from "lz-string";
import { STORAGE_KEYS } from "@/lib/local-storage";
export { STORAGE_KEYS, migrateStorageKeys } from "@/lib/local-storage";
export const DEFAULT_EXCHANGE_RATE = 1380;

// 읽기 전용 완화 스키마 — superRefine 없이 ticker 빈 값 허용 (스크린샷 가져오기 경로 대응)
const stockSchemaLoose = z.object({
  id: z.string(),
  category: z.enum(["domestic", "foreign", "irp", "isa", "pension", "unlisted"]),
  name: z.string(),
  ticker: z.string().optional().default(""),
  quantity: z.number(),
  averagePrice: z.number(),
  currentPrice: z.number(),
  currency: z.enum(["KRW", "USD", "JPY"]).default("KRW"),
  purchaseDate: z.string(),
  description: z.string().optional().default(""),
  baseDate: z.string().optional(),
  purchaseExchangeRate: z.number().optional(),
  broker: z.string().optional(),
});

const assetDataSchemaLoose = assetDataSchema.omit({ stocks: true }).extend({
  stocks: z.array(stockSchemaLoose).default([]),
});

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
    return assetDataSchemaLoose.parse(JSON.parse(data)) as AssetData;
  } catch (error) {
    console.error("Failed to load asset data:", error);
    return EMPTY_ASSET_DATA;
  }
}

export function saveAssetData(data: AssetData): boolean {
  if (typeof window === "undefined") return false;
  try {
    const validated = assetDataSchemaLoose.parse(data);
    validated.lastUpdated = new Date().toISOString();
    localStorage.setItem(STORAGE_KEYS.assetData, JSON.stringify(validated));
    return true;
  } catch (error) {
    console.error("Failed to save asset data:", error);
    return false;
  }
}

function collectSnapshotsFromStorage(): AssetSnapshots {
  try {
    const rawDaily = localStorage.getItem(STORAGE_KEYS.dailySnapshots);
    const rawMonthly = localStorage.getItem(STORAGE_KEYS.monthlySnapshots);
    return {
      daily: rawDaily ? JSON.parse(rawDaily) : [],
      monthly: rawMonthly ? JSON.parse(rawMonthly) : [],
    };
  } catch {
    return { daily: [], monthly: [] };
  }
}

export function exportAssetData(): void {
  const assetData = getAssetData();
  const snapshots = collectSnapshotsFromStorage();
  const hasSnapshots = snapshots.daily.length > 0 || snapshots.monthly.length > 0;
  const payload = hasSnapshots ? { assetData, snapshots } : { assetData };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `secretasset-${new Date().toISOString().split("T")[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function importAssetData(file: File): Promise<{ assetData: AssetData; snapshotRestored: boolean }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const parsed = JSON.parse(text);

        // 신규 포맷 { assetData, snapshots? } 또는 구버전 직접 AssetData 포맷 모두 지원
        const rawAsset = parsed.assetData ?? parsed;
        const validated = assetDataSchema.parse(rawAsset);
        saveAssetData(validated);

        let snapshotRestored = false;
        if (parsed.snapshots) {
          try {
            const { daily, monthly } = parsed.snapshots as AssetSnapshots;
            if (Array.isArray(daily)) {
              localStorage.setItem(STORAGE_KEYS.dailySnapshots, JSON.stringify(daily));
            }
            if (Array.isArray(monthly)) {
              localStorage.setItem(STORAGE_KEYS.monthlySnapshots, JSON.stringify(monthly));
            }
            snapshotRestored = true;
          } catch {
            // 스냅샷 복원 실패는 무시
          }
        }

        resolve({ assetData: validated, snapshotRestored });
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

// 스크린샷 가져오기 전용: stockSchema superRefine(ticker 필수) 우회 저장
export function saveAssetDataRaw(data: AssetData): boolean {
  if (typeof window === "undefined") return false;
  try {
    const payload = { ...data, lastUpdated: new Date().toISOString() };
    localStorage.setItem(STORAGE_KEYS.assetData, JSON.stringify(payload));
    return true;
  } catch {
    return false;
  }
}

export function clearAssetData(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const keysToRemove = Object.keys(localStorage).filter((k) => k.startsWith("secretasset_"));
    for (const key of keysToRemove) {
      localStorage.removeItem(key);
    }
    return true;
  } catch (error) {
    return false;
  }
}

// ─── 공유 토큰 시스템 V7.1 (PIN Support) ──────────────────────────────────

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
  ca: ["bank", "cash", "deposit", "savings", "cma"],
  cu: ["KRW", "USD", "JPY"],
  ins: [
    // 1금융권 (시중은행) - financialInstitutions
    "KB국민은행", "신한은행", "우리은행", "하나은행", "NH농협은행", "IBK기업은행", "KDB산업은행", "SC제일은행", "한국씨티은행",
    // 인터넷전문은행
    "카카오뱅크", "토스뱅크", "케이뱅크",
    // 지방은행
    "부산은행", "경남은행", "대구은행", "광주은행", "전북은행", "제주은행", "iM뱅크",
    // 2금융권
    "새마을금고", "신협", "수협", "우체국", "저축은행", "삼성생명", "한화생명", "교보생명",
    // 기타
    "기타",
    // 대형 증권사 - securitiesFirms
    "미래에셋증권", "삼성증권", "한국투자증권", "NH투자증권", "KB증권", "메리츠증권", "신한투자증권", "하나증권", "대신증권", "교보증권",
    // 온라인/기타 증권사
    "키움증권", "유안타증권", "이베스트투자증권", "카카오페이증권", "토스증권",
    // 암호화폐 거래소
    "Upbit", "Bithumb", "Binance", "Coinone", "Korbit", "Bybit", "OKX", "Coinbase", "Kraken", "MEXC", "Gate.io", "Bitget", "KuCoin"
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
    if (idx === -1) return c; // Alphabet 외의 문자는 그대로 유지
    const shift = pinNumbers[i % pinNumbers.length];
    const newIdx = decrypt
      ? (idx - shift + len) % len
      : (idx + shift) % len;
    return URI_ALPHABET[newIdx];
  }).join("");
};

// Zero-Knowledge용 가변 길이 문자열 암호화 (PIN + LocalKey)
const cryptWithKey = (str: string, key: string, decrypt = false) => {
  if (!key) return str;
  const len = URI_ALPHABET.length;
  return str.split("").map((c, i) => {
    const idx = URI_ALPHABET.indexOf(c);
    if (idx === -1) return c;
    const shift = key.charCodeAt(i % key.length);
    const newIdx = decrypt
      ? (idx - shift + len * 256) % len
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

// 월 패턴 압축 ("YYYY-MM" ↔ 2020-01 기준 경과 월수 base36)
const pMonth = (m: string) => {
  if (!m) return "";
  const [y, mo] = m.split("-").map(Number);
  return ((y - 2020) * 12 + (mo - 1)).toString(36);
};
const uMonth = (v: string) => {
  if (!v) return "";
  const total = parseInt(v, 36);
  const year = 2020 + Math.floor(total / 12);
  const month = String((total % 12) + 1).padStart(2, "0");
  return `${year}-${month}`;
};

// 스냅샷 직렬화: daily섹션;monthly섹션 (packV7의 ^ 구분자와 충돌 방지)
const packSnapshots = (s: AssetSnapshots): string => {
  const daily = s.daily
    .map(d => `${pDate(d.date)}|${pNum(d.netAsset)}|${pNum(d.financialAsset)}`)
    .join("~");
  const monthly = s.monthly
    .map(m => `${pMonth(m.month)}|${pNum(m.netAsset)}|${pNum(m.financialAsset)}`)
    .join("~");
  return `${daily};${monthly}`;
};

const unpackSnapshots = (raw: string): AssetSnapshots => {
  // 구 버전 호환: ^ 구분자로 저장된 토큰도 처리
  const sep = raw.includes(";") ? ";" : "^";
  const [dailyRaw, monthlyRaw] = raw.split(sep);
  const daily: DailyAssetSnapshot[] = (dailyRaw ? dailyRaw.split("~") : [])
    .filter(Boolean)
    .map(r => { const f = r.split("|"); return { date: uDate(f[0]), netAsset: uNum(f[1]), financialAsset: uNum(f[2]) }; });
  const monthly: MonthlyAssetSnapshot[] = (monthlyRaw ? monthlyRaw.split("~") : [])
    .filter(Boolean)
    .map(r => { const f = r.split("|"); return { month: uMonth(f[0]), netAsset: uNum(f[1]), financialAsset: uNum(f[2]) }; });
  return { daily, monthly };
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

function packV7(data: AssetData, rates?: { USD: number; JPY: number }, snapshots?: AssetSnapshots): string {
  const row = (arr: any[]) => {
    while (arr.length > 0 && (arr[arr.length - 1] === "" || arr[arr.length - 1] === 0 || arr[arr.length - 1] === undefined || arr[arr.length - 1] === null)) arr.pop();
    return arr.join("|");
  };
  const section = (items: any[]) => items.map(i => row(i)).join("~");

  const parts = [
    section(data.realEstate.map(i => [DICT.re.indexOf(i.type), sTxt(i.name), sTxt(i.address), pNum(i.purchasePrice), pNum(i.currentValue), pDate(i.purchaseDate), pNum(i.tenantDeposit), sTxt(i.description)])),
    section(data.stocks.map(i => [DICT.st.indexOf(i.category), sTxt(i.name), i.name === i.ticker ? "*" : sTxt(i.ticker), pNum(i.quantity), pNum(i.averagePrice), pNum(i.currentPrice), DICT.cu.indexOf(i.currency || "KRW"), pDate(i.purchaseDate), sTxt(i.description), pNum(i.purchaseExchangeRate ?? 0), sTxt(i.broker)])),
    section(data.crypto.map(i => [sTxt(i.name), i.name === i.symbol ? "*" : sTxt(i.symbol), pNum(i.quantity), pNum(i.averagePrice), pNum(i.currentPrice), pDate(i.purchaseDate), sTxt(i.exchange), sTxt(i.description)])),
    section(data.cash?.map(i => [DICT.ca.indexOf(i.type), sTxt(i.name), pNum(i.balance), DICT.cu.indexOf(i.currency || "KRW"), sTxt(i.institution), sTxt(i.description)]) || []),
    section(data.loans?.map(i => {
      const reIdx = i.linkedRealEstateId ? data.realEstate.findIndex(r => r.id === i.linkedRealEstateId) : -1;
      const stIdx = i.linkedStockId ? data.stocks.findIndex(s => s.id === i.linkedStockId) : -1;
      const caIdx = i.linkedCashId ? data.cash?.findIndex(c => c.id === i.linkedCashId) ?? -1 : -1;
      return [DICT.lo.indexOf(i.type as any), sTxt(i.name), pNum(i.balance), Math.round((i.interestRate || 0) * 1000), pDate(i.startDate), pDate(i.endDate), sTxt(i.institution), sTxt(i.description), reIdx >= 0 ? `r${reIdx}` : "", caIdx >= 0 ? `c${caIdx}` : "", stIdx >= 0 ? `s${stIdx}` : ""];
    }) || []),
    section(data.yearlyNetAssets.map(i => [i.year, pNum(i.netAsset), sTxt(i.note)])),
    pDate(data.lastUpdated.split('T')[0]),
    rates ? `${pNum(rates.USD)}|${pNum(rates.JPY)}` : "",
    snapshots ? packSnapshots(snapshots) : ""
  ];

  return parts.join("^");
}

function unpackV7(raw: string): { data: any, rates?: { USD: number, JPY: number }, snapshots?: AssetSnapshots } {
  const parts = raw.split("^");
  const gid = () => Math.random().toString(36).substring(2, 11);
  const getIdx = (idx: any, list: readonly string[]) => list[parseInt(idx)] || list[0];

  const section = (idx: number) => (parts[idx] ? parts[idx].split("~") : []).filter(r => r !== "");
  const fields = (r: string) => r.split("|");

  // 각 섹션을 먼저 ID 배열과 함께 생성하여 loans에서 인덱스로 역참조
  const reIds: string[] = [];
  const stIds: string[] = [];
  const caIds: string[] = [];

  const realEstate = section(0).map(r => {
    const f = fields(r);
    const name = uTxt(f[1]) || "무명";
    const id = gid();
    reIds.push(id);
    return { id, type: getIdx(f[0], DICT.re), name, address: uTxt(f[2]), purchasePrice: uNum(f[3]), currentValue: uNum(f[4]), purchaseDate: uDate(f[5]), tenantDeposit: uNum(f[6]), description: uTxt(f[7]) };
  });
  const stocks = section(1).map(r => {
    const f = fields(r);
    const name = uTxt(f[1]) || "무명";
    const id = gid();
    stIds.push(id);
    const purchaseExchangeRate = uNum(f[9]);
    const broker = uTxt(f[10]);
    return { id, category: getIdx(f[0], DICT.st), name, ticker: f[2] === "*" ? name : (uTxt(f[2]) || ""), quantity: uNum(f[3]), averagePrice: uNum(f[4]), currentPrice: uNum(f[5]), currency: getIdx(f[6], DICT.cu), purchaseDate: uDate(f[7]), description: uTxt(f[8]), ...(purchaseExchangeRate > 0 ? { purchaseExchangeRate } : {}), ...(broker ? { broker } : {}) };
  });
  const crypto = section(2).map(r => {
    const f = fields(r);
    const name = uTxt(f[0]) || "무명";
    return { id: gid(), name, symbol: f[1] === "*" ? name : (uTxt(f[1]) || "SYMBOL"), quantity: uNum(f[2]), averagePrice: uNum(f[3]), currentPrice: uNum(f[4]), purchaseDate: uDate(f[5]), exchange: uTxt(f[6]), description: uTxt(f[7]) };
  });
  const cash = section(3).map(r => {
    const f = fields(r);
    const id = gid();
    caIds.push(id);
    return { id, type: getIdx(f[0], DICT.ca), name: uTxt(f[1]) || "무명", balance: uNum(f[2]), currency: getIdx(f[3], DICT.cu), institution: uTxt(f[4]), description: uTxt(f[5]) };
  });
  const loans = section(4).map(r => {
    const f = fields(r);
    const reIdx = f[8]?.startsWith("r") ? parseInt(f[8].substring(1)) : -1;
    const caIdx = f[9]?.startsWith("c") ? parseInt(f[9].substring(1)) : -1;
    const stIdx = f[10]?.startsWith("s") ? parseInt(f[10].substring(1)) : -1;
    return {
      id: gid(),
      type: getIdx(f[0], DICT.lo),
      name: uTxt(f[1]) || "무명",
      balance: uNum(f[2]),
      interestRate: (parseInt(f[3]) || 0) / 1000,
      startDate: uDate(f[4]),
      endDate: uDate(f[5]),
      institution: uTxt(f[6]),
      description: uTxt(f[7]),
      ...(reIdx >= 0 && reIds[reIdx] ? { linkedRealEstateId: reIds[reIdx] } : {}),
      ...(caIdx >= 0 && caIds[caIdx] ? { linkedCashId: caIds[caIdx] } : {}),
      ...(stIdx >= 0 && stIds[stIdx] ? { linkedStockId: stIds[stIdx] } : {}),
    };
  });

  const data = {
    realEstate,
    stocks,
    crypto,
    cash,
    loans,
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

  let snapshots: AssetSnapshots | undefined;
  if (parts[8]) {
    snapshots = unpackSnapshots(parts[8]);
  }

  return { data, rates, snapshots };
}

export function generateShareToken(data: AssetData, rates?: { USD: number; JPY: number }, pin?: string, localKey?: string, snapshots?: AssetSnapshots): string {
  try {
    const dsv = "OK|" + packV7(data, rates, snapshots); // PIN 검증 및 무결성 확인용 접두사
    const compressed = LZString.compressToEncodedURIComponent(dsv);

    if (pin && pin.length === 4) {
      if (localKey) {
        // V7.2 Zero-Knowledge: PIN + localKey 조합으로 초강력 암호화
        const fullKey = pin + localKey;
        return "v72Z" + cryptWithKey(compressed, fullKey);
      }
      // V7.1: 압축된 결과물에 PIN 기반 시프팅 적용
      return "v71P" + cryptWithPin(compressed, pin);
    }
    return "v71N" + compressed;
  } catch (error) {
    return "";
  }
}

export type ParseResult = { data: AssetData, rates?: { USD: number, JPY: number }, snapshots?: AssetSnapshots } | { pinRequired: true } | null;

export function parseShareToken(token: string, pin?: string, localKey?: string): ParseResult {
  if (!token) return null;
  try {
    // 최신 Zero-Knowledge 버전 (v72Z)
    if (token.startsWith("v72Z")) {
      if (!localKey) return null; // localKey가 없으면 인증키가 누락된 잘못된 접근이므로 즉시 실패
      if (!pin) return { pinRequired: true };

      const fullKey = pin + localKey;
      const compressed = cryptWithKey(token.substring(4), fullKey, true);

      const dsv = LZString.decompressFromEncodedURIComponent(compressed);
      if (!dsv || !dsv.startsWith("OK|")) return null; // PIN/Key 틀림 또는 데이터 손상

      const result = unpackV7(dsv.substring(3));
      return {
        data: assetDataSchema.parse(result.data),
        rates: result.rates,
        snapshots: result.snapshots,
      };
    }

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
        rates: result.rates,
        snapshots: result.snapshots,
      };
    }

    // 하위 호환성 (V7.1:N:, V7.1:P:, V7.0)
    const decompressed = LZString.decompressFromEncodedURIComponent(token);

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
      return { data: assetDataSchema.parse(result.data), rates: result.rates, snapshots: result.snapshots };
    }

    if (decompressed && decompressed.startsWith("vlt-fl-v7.0:")) {
      const dsv = decompressed.substring("vlt-fl-v7.0:".length);
      const result = unpackV7(dsv);
      return { data: assetDataSchema.parse(result.data), rates: result.rates, snapshots: result.snapshots };
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
      return { data: assetDataSchema.parse(result.data), rates: result.rates, snapshots: result.snapshots };
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

