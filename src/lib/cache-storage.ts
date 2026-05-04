/**
 * cache-storage.ts
 * 스토리지 추상화 계층: 환경에 따라 자동 선택
 *
 * - 로컬 개발 (UPSTASH 환경변수 없음): 파일 기반 (data/finance-cache.json, data/share-tokens.json)
 * - Vercel 배포 (UPSTASH 환경변수 설정): Upstash for Redis
 *
 * Share URL 전략:
 *   - 키 = sha256(token)[:10] (콘텐츠 기반, IP 제거) → 같은 자산 = 같은 키
 *   - owner_id (localStorage UUID) 추적으로 자산 업데이트 시 구 키 즉시 삭제
 *   - Sliding Window TTL: GET 시마다 30일 리셋 → 활성 링크는 자동 연장
 */

import type { ExchangeRates, StockPriceResult, DividendPayoutResult } from "./finance-service";
import type { ProfitPeriod } from "./profit-utils";

// ─────────────────────────────────────────────────────────
// 인터페이스
// ─────────────────────────────────────────────────────────

export interface ICacheStorage {
  // Finance
  getExchange(): Promise<ExchangeRates | null>;
  setExchange(rates: ExchangeRates): Promise<void>;
  getStock(cacheKey: string): Promise<StockPriceResult | null>;
  setStock(cacheKey: string, result: StockPriceResult, todayStr: string, ticker: string): Promise<void>;
  getKisToken(todayStr: string): Promise<string | null>;
  setKisToken(token: string, todayStr: string): Promise<void>;
  // Share URL
  getShareToken(key: string): Promise<string | null>;
  setShareToken(key: string, token: string): Promise<void>;
  deleteShareToken(key: string): Promise<void>;
  getOwnerKey(ownerHash: string): Promise<string | null>;
  setOwnerKey(ownerHash: string, shareKey: string): Promise<void>;
  // 배당 캐시 (캐시키: "TICKER-YYYY-MM")
  getDividend(cacheKey: string): Promise<DividendPayoutResult[] | null>;
  setDividend(cacheKey: string, data: DividendPayoutResult[]): Promise<void>;
  // 과거 기준일 종가 캐시 (수익률 계산용, period별 차등 TTL)
  getRefPrice(ticker: string, dateStr: string): Promise<number | null>;
  setRefPrice(ticker: string, dateStr: string, price: number, period: ProfitPeriod): Promise<void>;
  // Rate Limit (로컬 개발에서는 항상 통과)
  checkRateLimit(ip: string): Promise<boolean>;
  // Gemini 사용량 관리
  getGeminiDailyCount(todayStr: string): Promise<number>;
  incrementGeminiDailyCount(todayStr: string): Promise<number>;
  checkGeminiDailyLimit(todayStr: string): Promise<boolean>;
  // 기업/ETF 로고 캐시 (TTL 1년)
  getTickerLogo(key: string): Promise<{ data: string; contentType: string } | null>;
  setTickerLogo(key: string, base64: string, contentType: string): Promise<void>;
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
// 공통 유틸
// ─────────────────────────────────────────────────────────

const SHARE_TTL_SECONDS = 30 * 24 * 3600; // 30일
const SHARE_TTL_MS = SHARE_TTL_SECONDS * 1000;
const RATE_LIMIT_WINDOW_SECONDS = 60;
const RATE_LIMIT_MAX = 10;
export const GEMINI_SERVER_DAILY_LIMIT = 300; // 서버 전역 하루 최대 호출 수

/**
 * 시장 마감 시간 기준 유효 캐시 날짜 반환 (KST)
 * - foreign: 미국 장 마감 후 오전 07:00 KST 이후 → 오늘 날짜 유효
 * - domestic: 국내 장 마감 오후 16:00 KST 이후 → 오늘 날짜 유효
 * - exchange: 서울외국환중개 기준 오전 09:00 KST 이후 → 오늘 날짜 유효
 * 마감 전이면 어제 날짜를 반환 (전일 종가/환율이 최신)
 */
export function getEffectiveDateStr(type: "domestic" | "foreign" | "exchange"): string {
  const nowKST = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const hhmm = nowKST.getUTCHours() * 100 + nowKST.getUTCMinutes();

  const cutoff = type === "foreign" ? 700 : type === "domestic" ? 1600 : 900;
  const todayStr = nowKST.toISOString().split("T")[0];
  if (hhmm >= cutoff) return todayStr;

  const yesterday = new Date(nowKST);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  return yesterday.toISOString().split("T")[0];
}

function secondsUntilMidnightKST(): number {
  const KST_OFFSET_MS = 9 * 3600 * 1000;
  const nowMs = Date.now();
  const nowKSTMs = nowMs + KST_OFFSET_MS;
  const kstDate = new Date(nowKSTMs);
  const nextMidnightUTC =
    Date.UTC(kstDate.getUTCFullYear(), kstDate.getUTCMonth(), kstDate.getUTCDate() + 1) - KST_OFFSET_MS;
  return Math.max(60, Math.floor((nextMidnightUTC - nowMs) / 1000));
}

// period별 다음 기준일 경계까지의 초 (KST 기준)
// daily: 다음 자정, weekly: 다음 월요일 자정, monthly: 다음 달 1일 자정, yearly: 내년 1/1 자정
function secondsUntilNextRefBoundary(period: ProfitPeriod): number {
  const KST_OFFSET_MS = 9 * 3600 * 1000;
  const nowMs = Date.now();
  const kst = new Date(nowMs + KST_OFFSET_MS);
  const y = kst.getUTCFullYear();
  const m = kst.getUTCMonth();
  const d = kst.getUTCDate();

  let boundaryUTC: number;
  if (period === "daily") {
    boundaryUTC = Date.UTC(y, m, d + 1) - KST_OFFSET_MS;
  } else if (period === "weekly") {
    // 다음 월요일 KST 자정
    const day = kst.getUTCDay(); // 0=일, 1=월, ..., 6=토
    const daysToNextMonday = day === 0 ? 1 : 8 - day;
    boundaryUTC = Date.UTC(y, m, d + daysToNextMonday) - KST_OFFSET_MS;
  } else if (period === "monthly") {
    boundaryUTC = Date.UTC(y, m + 1, 1) - KST_OFFSET_MS;
  } else {
    // yearly
    boundaryUTC = Date.UTC(y + 1, 0, 1) - KST_OFFSET_MS;
  }
  return Math.max(60, Math.floor((boundaryUTC - nowMs) / 1000));
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
  GEMINI_COUNT?: { count: number; date: string };
  DIVIDENDS?: Record<string, DividendPayoutResult[]>;
  REF_PRICES?: Record<string, number>;
}

interface ShareTokenEntry {
  token: string;
  expires_at: number;
}

interface OwnerEntry {
  share_key: string;
  expires_at: number;
}

interface ShareTokensData {
  tokens: Record<string, ShareTokenEntry>;
  owners: Record<string, OwnerEntry>;
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
      if (data.STOCKS && todayStr) {
        // 유효 날짜(국내/해외 각각 다를 수 있음) 이외 STOCKS 항목 정리
        const effectiveForeign = getEffectiveDateStr("foreign");
        const effectiveDomestic = getEffectiveDateStr("domestic");
        data.STOCKS = Object.fromEntries(
          Object.entries(data.STOCKS).filter(([key]) =>
            key.endsWith(`-${effectiveForeign}`) || key.endsWith(`-${effectiveDomestic}`)
          )
        );
      }
      // 날짜 불일치 EXCHANGE / KIS_TOKEN도 함께 정리
      const effectiveExchange = getEffectiveDateStr("exchange");
      if (data.EXCHANGE?.updated_at && data.EXCHANGE.updated_at !== effectiveExchange) {
        delete data.EXCHANGE;
      }
      if (data.KIS_TOKEN?.updated_at && data.KIS_TOKEN.updated_at !== todayStr) {
        delete data.KIS_TOKEN;
      }
      if (data.GEMINI_COUNT?.date && data.GEMINI_COUNT.date !== todayStr) {
        delete data.GEMINI_COUNT;
      }
      fs.mkdirSync(path.dirname(FINANCE_CACHE_PATH), { recursive: true });
      fs.writeFileSync(FINANCE_CACHE_PATH, JSON.stringify(data, null, 2), "utf8");
    } catch (e) {
      console.error("[FileCacheStorage 저장 오류]:", e);
    }
  }

  private readShareTokens(): ShareTokensData {
    if (!fs.existsSync(SHARE_TOKENS_PATH)) return { tokens: {}, owners: {} };
    try {
      const raw = JSON.parse(fs.readFileSync(SHARE_TOKENS_PATH, "utf8")) as ShareTokensData;
      return { tokens: raw.tokens ?? {}, owners: raw.owners ?? {} };
    } catch {
      return { tokens: {}, owners: {} };
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

  async setStock(cacheKey: string, result: StockPriceResult, todayStr: string, _ticker: string): Promise<void> {
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
    const data = this.readShareTokens();
    const entry = data.tokens[key];
    if (!entry || entry.expires_at < Date.now()) return null;
    // Sliding Window: 접근 시 만료 시간 갱신
    entry.expires_at = Date.now() + SHARE_TTL_MS;
    this.writeShareTokens(data);
    return entry.token;
  }

  async setShareToken(key: string, token: string): Promise<void> {
    const data = this.readShareTokens();
    const existing = data.tokens[key];
    if (existing && existing.expires_at > Date.now()) {
      // 이미 유효한 키 존재 → TTL만 갱신
      existing.expires_at = Date.now() + SHARE_TTL_MS;
    } else {
      data.tokens[key] = { token, expires_at: Date.now() + SHARE_TTL_MS };
    }
    this.writeShareTokens(data);
  }

  async deleteShareToken(key: string): Promise<void> {
    const data = this.readShareTokens();
    delete data.tokens[key];
    this.writeShareTokens(data);
  }

  async getOwnerKey(ownerHash: string): Promise<string | null> {
    const entry = this.readShareTokens().owners[ownerHash];
    if (!entry || entry.expires_at < Date.now()) return null;
    return entry.share_key;
  }

  async setOwnerKey(ownerHash: string, shareKey: string): Promise<void> {
    const data = this.readShareTokens();
    data.owners[ownerHash] = { share_key: shareKey, expires_at: Date.now() + SHARE_TTL_MS };
    this.writeShareTokens(data);
  }

  async getDividend(cacheKey: string): Promise<DividendPayoutResult[] | null> {
    return this.readFinanceCache().DIVIDENDS?.[cacheKey] ?? null;
  }

  async setDividend(cacheKey: string, data: DividendPayoutResult[]): Promise<void> {
    const nowKST = new Date(Date.now() + 9 * 60 * 60 * 1000);
    const todayStr = nowKST.toISOString().split("T")[0];
    const cache = this.readFinanceCache();
    if (!cache.DIVIDENDS) cache.DIVIDENDS = {};
    cache.DIVIDENDS[cacheKey] = data;
    this.writeFinanceCache(cache, todayStr);
  }

  async getRefPrice(ticker: string, dateStr: string): Promise<number | null> {
    const key = `${ticker}:${dateStr}`;
    return this.readFinanceCache().REF_PRICES?.[key] ?? null;
  }

  async setRefPrice(ticker: string, dateStr: string, price: number, _period: ProfitPeriod): Promise<void> {
    const nowKST = new Date(Date.now() + 9 * 60 * 60 * 1000);
    const todayStr = nowKST.toISOString().split("T")[0];
    const cache = this.readFinanceCache();
    if (!cache.REF_PRICES) cache.REF_PRICES = {};
    cache.REF_PRICES[`${ticker}:${dateStr}`] = price;
    this.writeFinanceCache(cache, todayStr);
  }

  // 로컬 개발에서는 Rate Limit 적용 없음
  async checkRateLimit(_ip: string): Promise<boolean> {
    return true;
  }

  // 로컬 개발에서는 로고 캐시 없음 (파일 비대화 방지)
  async getTickerLogo(_key: string): Promise<null> {
    return null;
  }

  async setTickerLogo(_key: string, _base64: string, _contentType: string): Promise<void> {
    // no-op
  }

  async getGeminiDailyCount(todayStr: string): Promise<number> {
    const entry = this.readFinanceCache().GEMINI_COUNT;
    if (!entry || entry.date !== todayStr) return 0;
    return entry.count;
  }

  async incrementGeminiDailyCount(todayStr: string): Promise<number> {
    const cache = this.readFinanceCache();
    const current = cache.GEMINI_COUNT?.date === todayStr ? cache.GEMINI_COUNT.count : 0;
    const next = current + 1;
    cache.GEMINI_COUNT = { count: next, date: todayStr };
    this.writeFinanceCache(cache, todayStr);
    return next;
  }

  async checkGeminiDailyLimit(todayStr: string): Promise<boolean> {
    const count = await this.getGeminiDailyCount(todayStr);
    return count < GEMINI_SERVER_DAILY_LIMIT;
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

  async setStock(cacheKey: string, result: StockPriceResult, _todayStr: string, ticker: string): Promise<void> {
    const fullKey = `finance:stock:${cacheKey}`;
    await this.redis.set(fullKey, result, { ex: secondsUntilMidnightKST() });
    // 같은 티커의 옛 날짜 키 정리 (best-effort)
    try {
      const pattern = `finance:stock:${ticker}-*`;
      let cursor = "0";
      const stale: string[] = [];
      do {
        const result = await this.redis.scan(cursor, { match: pattern, count: 50 });
        const next = String(result[0]);
        const keys = result[1] as string[];
        for (const k of keys) {
          if (k !== fullKey) stale.push(k);
        }
        cursor = next;
      } while (cursor !== "0");
      if (stale.length > 0) await this.redis.del(...stale);
    } catch (e) {
      console.error("[setStock 옛 키 정리 실패]:", e);
    }
  }

  async getKisToken(todayStr: string): Promise<string | null> {
    const data = await this.redis.get<{ access_token: string }>(`finance:kis_token:${todayStr}`);
    return data?.access_token ?? null;
  }

  async setKisToken(token: string, todayStr: string): Promise<void> {
    // 전일 키 명시 삭제 (24h TTL 만료 전 즉시 정리)
    const prevDate = new Date(Date.now() + 9 * 3600 * 1000 - 86400 * 1000)
      .toISOString().split("T")[0];
    await this.redis.del(`finance:kis_token:${prevDate}`);
    await this.redis.set(
      `finance:kis_token:${todayStr}`,
      { access_token: token, updated_at: todayStr },
      { ex: 86400 }
    );
  }

  async getShareToken(key: string): Promise<string | null> {
    const token = await this.redis.get<string>(`share:${key}`);
    if (!token) return null;
    // Sliding Window: 접근 시 TTL 30일 리셋
    await this.redis.expire(`share:${key}`, SHARE_TTL_SECONDS);
    return token;
  }

  async setShareToken(key: string, token: string): Promise<void> {
    const exists = await this.redis.exists(`share:${key}`);
    if (exists) {
      // 이미 유효한 키 존재 → TTL만 갱신
      await this.redis.expire(`share:${key}`, SHARE_TTL_SECONDS);
    } else {
      await this.redis.set(`share:${key}`, token, { ex: SHARE_TTL_SECONDS });
    }
  }

  async deleteShareToken(key: string): Promise<void> {
    await this.redis.del(`share:${key}`);
  }

  async getOwnerKey(ownerHash: string): Promise<string | null> {
    return this.redis.get<string>(`share:owner:${ownerHash}`);
  }

  async setOwnerKey(ownerHash: string, shareKey: string): Promise<void> {
    await this.redis.set(`share:owner:${ownerHash}`, shareKey, { ex: SHARE_TTL_SECONDS });
  }

  async checkRateLimit(ip: string): Promise<boolean> {
    const key = `share:rl:${ip}`;
    const count = await this.redis.incr(key);
    if (count === 1) await this.redis.expire(key, RATE_LIMIT_WINDOW_SECONDS);
    return count <= RATE_LIMIT_MAX;
  }

  async getDividend(cacheKey: string): Promise<DividendPayoutResult[] | null> {
    return this.redis.get<DividendPayoutResult[]>(`finance:dividend:${cacheKey}`);
  }

  async setDividend(cacheKey: string, data: DividendPayoutResult[]): Promise<void> {
    const DIVIDEND_TTL = 30 * 24 * 3600; // 30일
    await this.redis.set(`finance:dividend:${cacheKey}`, data, { ex: DIVIDEND_TTL });
  }

  async getRefPrice(ticker: string, dateStr: string): Promise<number | null> {
    return this.redis.get<number>(`finance:refprice:${ticker}:${dateStr}`);
  }

  async setRefPrice(ticker: string, dateStr: string, price: number, period: ProfitPeriod): Promise<void> {
    await this.redis.set(`finance:refprice:${ticker}:${dateStr}`, price, {
      ex: secondsUntilNextRefBoundary(period),
    });
  }

  async getGeminiDailyCount(todayStr: string): Promise<number> {
    const val = await this.redis.get<number>(`gemini:daily:${todayStr}`);
    return val ?? 0;
  }

  async incrementGeminiDailyCount(todayStr: string): Promise<number> {
    const key = `gemini:daily:${todayStr}`;
    const count = await this.redis.incr(key);
    if (count === 1) await this.redis.expire(key, secondsUntilMidnightKST());
    return count;
  }

  async checkGeminiDailyLimit(todayStr: string): Promise<boolean> {
    const count = await this.getGeminiDailyCount(todayStr);
    return count < GEMINI_SERVER_DAILY_LIMIT;
  }

  async getTickerLogo(key: string): Promise<{ data: string; contentType: string } | null> {
    return this.redis.get<{ data: string; contentType: string }>(`finance:logo:${key}`);
  }

  async setTickerLogo(key: string, base64: string, contentType: string): Promise<void> {
    const LOGO_TTL = 365 * 24 * 3600; // 1년
    await this.redis.set(`finance:logo:${key}`, { data: base64, contentType }, { ex: LOGO_TTL });
  }
}
