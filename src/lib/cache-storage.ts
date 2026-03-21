/**
 * cache-storage.ts
 * 스토리지 추상화 계층: 환경에 따라 자동 선택
 *
 * - 로컬 개발 (UPSTASH 환경변수 없음): 파일 기반 (data/finance-cache.json, data/share-tokens.json)
 * - Vercel 배포 (UPSTASH 환경변수 설정): Upstash for Redis
 */

import type { ExchangeRates, StockPriceResult } from "./finance-service";

// ─────────────────────────────────────────────────────────
// 인터페이스
// ─────────────────────────────────────────────────────────

export interface ICacheStorage {
  getExchange(): Promise<ExchangeRates | null>;
  setExchange(rates: ExchangeRates): Promise<void>;
  getStock(cacheKey: string): Promise<StockPriceResult | null>;
  setStock(cacheKey: string, result: StockPriceResult, todayStr: string): Promise<void>;
  getKisToken(todayStr: string): Promise<string | null>;
  setKisToken(token: string, todayStr: string): Promise<void>;
  getShareToken(key: string): Promise<string | null>;
  setShareToken(key: string, token: string): Promise<void>;
}

// ─────────────────────────────────────────────────────────
// 팩토리: 환경 자동 감지
// ─────────────────────────────────────────────────────────

export function getCacheStorage(): ICacheStorage {
  if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
    return new UpstashCacheStorage();
  }
  return new FileCacheStorage();
}

// ─────────────────────────────────────────────────────────
// 공통 유틸: KST 자정까지 남은 초 (Upstash TTL 계산용)
// ─────────────────────────────────────────────────────────

function secondsUntilMidnightKST(): number {
  const KST_OFFSET_MS = 9 * 3600 * 1000;
  const nowMs = Date.now();
  const nowKSTMs = nowMs + KST_OFFSET_MS;
  const kstDate = new Date(nowKSTMs);
  const nextMidnightUTC =
    Date.UTC(kstDate.getUTCFullYear(), kstDate.getUTCMonth(), kstDate.getUTCDate() + 1) - KST_OFFSET_MS;
  return Math.max(60, Math.floor((nextMidnightUTC - nowMs) / 1000));
}

// ─────────────────────────────────────────────────────────
// 파일 기반 구현 (로컬 개발)
// ─────────────────────────────────────────────────────────

import * as fs from "fs";
import * as path from "path";

const FINANCE_CACHE_PATH = path.join(process.cwd(), "data", "finance-cache.json");
const SHARE_TOKENS_PATH = path.join(process.cwd(), "data", "share-tokens.json");

interface FileCacheData {
  EXCHANGE?: ExchangeRates;
  STOCKS?: Record<string, StockPriceResult>;
  KIS_TOKEN?: { access_token: string; updated_at: string };
}

interface ShareTokenEntry {
  token: string;
  expires_at: number; // Unix timestamp (ms)
}

interface ShareTokensData {
  tokens: Record<string, ShareTokenEntry>;
}

class FileCacheStorage implements ICacheStorage {
  private readFinanceCache(): FileCacheData {
    if (!fs.existsSync(FINANCE_CACHE_PATH)) return { STOCKS: {} };
    try {
      return JSON.parse(fs.readFileSync(FINANCE_CACHE_PATH, "utf8")) as FileCacheData;
    } catch {
      return { STOCKS: {} };
    }
  }

  private writeFinanceCache(data: FileCacheData, todayStr: string): void {
    try {
      // 오늘 날짜 외 STOCKS 항목 정리 (키 형식: "TICKER-YYYY-MM-DD")
      if (data.STOCKS && todayStr) {
        data.STOCKS = Object.fromEntries(
          Object.entries(data.STOCKS).filter(([key]) => key.endsWith(`-${todayStr}`))
        );
      }
      fs.mkdirSync(path.dirname(FINANCE_CACHE_PATH), { recursive: true });
      fs.writeFileSync(FINANCE_CACHE_PATH, JSON.stringify(data, null, 2), "utf8");
    } catch (e) {
      console.error("[FileCacheStorage 저장 오류]:", e);
    }
  }

  private readShareTokens(): ShareTokensData {
    if (!fs.existsSync(SHARE_TOKENS_PATH)) return { tokens: {} };
    try {
      const raw = JSON.parse(fs.readFileSync(SHARE_TOKENS_PATH, "utf8")) as ShareTokensData;
      return { tokens: raw.tokens ?? {} };
    } catch {
      return { tokens: {} };
    }
  }

  private writeShareTokens(data: ShareTokensData): void {
    try {
      fs.mkdirSync(path.dirname(SHARE_TOKENS_PATH), { recursive: true });
      fs.writeFileSync(SHARE_TOKENS_PATH, JSON.stringify(data, null, 2), "utf8");
    } catch (e) {
      console.error("[ShareTokens 저장 오류]:", e);
    }
  }

  async getExchange(): Promise<ExchangeRates | null> {
    return this.readFinanceCache().EXCHANGE ?? null;
  }

  async setExchange(rates: ExchangeRates): Promise<void> {
    const cache = this.readFinanceCache();
    cache.EXCHANGE = rates;
    this.writeFinanceCache(cache, rates.updated_at ?? "");
  }

  async getStock(cacheKey: string): Promise<StockPriceResult | null> {
    return this.readFinanceCache().STOCKS?.[cacheKey] ?? null;
  }

  async setStock(cacheKey: string, result: StockPriceResult, todayStr: string): Promise<void> {
    const cache = this.readFinanceCache();
    if (!cache.STOCKS) cache.STOCKS = {};
    cache.STOCKS[cacheKey] = result;
    this.writeFinanceCache(cache, todayStr);
  }

  async getKisToken(todayStr: string): Promise<string | null> {
    const kisToken = this.readFinanceCache().KIS_TOKEN;
    if (kisToken?.updated_at === todayStr) return kisToken.access_token;
    return null;
  }

  async setKisToken(token: string, todayStr: string): Promise<void> {
    const cache = this.readFinanceCache();
    cache.KIS_TOKEN = { access_token: token, updated_at: todayStr };
    this.writeFinanceCache(cache, todayStr);
  }

  async getShareToken(key: string): Promise<string | null> {
    const entry = this.readShareTokens().tokens[key];
    if (!entry) return null;
    // 만료 확인
    if (entry.expires_at < Date.now()) return null;
    return entry.token;
  }

  async setShareToken(key: string, token: string): Promise<void> {
    const data = this.readShareTokens();
    data.tokens[key] = {
      token,
      expires_at: Date.now() + 30 * 24 * 3600 * 1000, // 30일
    };
    this.writeShareTokens(data);
  }

}

// ─────────────────────────────────────────────────────────
// Upstash Redis 구현 (Vercel 배포)
// ─────────────────────────────────────────────────────────

import { Redis } from "@upstash/redis";

class UpstashCacheStorage implements ICacheStorage {
  private redis: Redis;

  constructor() {
    this.redis = new Redis({
      url: process.env.KV_REST_API_URL!,
      token: process.env.KV_REST_API_TOKEN!,
    });
  }

  async getExchange(): Promise<ExchangeRates | null> {
    return this.redis.get<ExchangeRates>("finance:exchange");
  }

  async setExchange(rates: ExchangeRates): Promise<void> {
    await this.redis.set("finance:exchange", rates, { ex: secondsUntilMidnightKST() });
  }

  async getStock(cacheKey: string): Promise<StockPriceResult | null> {
    return this.redis.get<StockPriceResult>(`finance:stock:${cacheKey}`);
  }

  async setStock(cacheKey: string, result: StockPriceResult, _todayStr: string): Promise<void> {
    await this.redis.set(`finance:stock:${cacheKey}`, result, { ex: secondsUntilMidnightKST() });
  }

  async getKisToken(todayStr: string): Promise<string | null> {
    const data = await this.redis.get<{ access_token: string }>(`finance:kis_token:${todayStr}`);
    return data?.access_token ?? null;
  }

  async setKisToken(token: string, todayStr: string): Promise<void> {
    await this.redis.set(
      `finance:kis_token:${todayStr}`,
      { access_token: token, updated_at: todayStr },
      { ex: 86400 }
    );
  }

  async getShareToken(key: string): Promise<string | null> {
    return this.redis.get<string>(`share:${key}`);
  }

  async setShareToken(key: string, token: string): Promise<void> {
    await this.redis.set(`share:${key}`, token, { ex: 2592000 }); // 30일
  }

}
