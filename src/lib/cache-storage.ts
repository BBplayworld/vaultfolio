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

import type { ExchangeRates, StockPriceResult, DividendPayoutResult } from "./finance/finance-service";
import type { CoinPriceResult } from "./finance/upbit-service";
import type { ProfitPeriod } from "./finance/profit-utils";
import type { StockClassification } from "./xray/classification-store";
import type { AssetEnvelope } from "./cloud-sync/config";

// ─────────────────────────────────────────────────────────
// 인터페이스
// ─────────────────────────────────────────────────────────

export interface ICacheStorage {
  // Cloud Sync (E2EE Asset)
  getAssetEnvelope(assetId: string): Promise<AssetEnvelope | null>;
  setAssetEnvelope(assetId: string, envelope: AssetEnvelope): Promise<void>;
  // 원자적 compare-and-set — "현재 버전 조회 → 비교 → 저장"을 단일 연산으로 묶어 두 기기가
  // 거의 동시에 push해도 lost update(TOCTOU 레이스)가 나지 않게 한다. baseVersion보다 서버가
  // 최신이면 실패(현재 버전 반환), 아니면 version+1로 저장하고 성공(신규 버전 반환).
  compareAndSetAssetEnvelope(
    assetId: string,
    baseVersion: number,
    data: { pubKey: string; iv: string; ciphertext: string },
  ): Promise<{ ok: true; version: number } | { ok: false; currentVersion: number }>;

  // Finance
  getExchange(): Promise<ExchangeRates | null>;
  setExchange(rates: ExchangeRates): Promise<void>;
  // 환율 일자별 이력(최근 2일치) — 해외 일별수익의 전날 환율을 기기 무관하게 보충
  getExchangeHistory(): Promise<Record<string, { USD: number; JPY: number }>>;
  getStock(cacheKey: string): Promise<StockPriceResult | null>;
  setStock(cacheKey: string, result: StockPriceResult, todayStr: string, ticker: string): Promise<void>;
  getKisToken(todayStr: string): Promise<string | null>;
  setKisToken(token: string, todayStr: string): Promise<void>;
  // KIS 토큰 발급 실패 서킷 브레이커 상태 (5회 이상 실패 시 쿨다운 동안 외부 호출 차단)
  getKisFailState(): Promise<{ count: number; openUntil: number } | null>;
  setKisFailState(state: { count: number; openUntil: number }, ttlSec: number): Promise<void>;
  clearKisFailState(): Promise<void>;
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
  // dateStr은 KIS 응답의 실거래일(res.date) 기준
  getRefPrice(ticker: string, dateStr: string): Promise<number | null>;
  setRefPrice(ticker: string, dateStr: string, price: number, period: ProfitPeriod): Promise<void>;
  // 요청일 → 응답일(실거래일) 매핑. 휴장/공휴일로 요청일과 응답일이 다른 경우 영구 hit 보장
  getRefDateForRequest(ticker: string, requestDate: string, period: ProfitPeriod): Promise<string | null>;
  setRefDateForRequest(ticker: string, requestDate: string, actualDate: string, period: ProfitPeriod): Promise<void>;
  // Rate Limit (로컬 개발에서는 항상 통과)
  checkRateLimit(ip: string): Promise<boolean>;
  // Gemini 사용량 관리
  getGeminiDailyCount(todayStr: string): Promise<number>;
  incrementGeminiDailyCount(todayStr: string): Promise<number>;
  checkGeminiDailyLimit(todayStr: string): Promise<boolean>;
  // 기업/ETF 로고 캐시 (TTL 1년)
  getTickerLogo(key: string): Promise<{ data: string; contentType: string } | null>;
  setTickerLogo(key: string, base64: string, contentType: string): Promise<void>;
  // 종목 분류 캐시 (X-Ray, 90일 TTL)
  getStockClassification(ticker: string): Promise<StockClassification | null>;
  setStockClassification(ticker: string, value: StockClassification): Promise<void>;

  // ── 암호화폐 (업비트) ──
  // market 단위 레코드 하나에 slot·값·갱신시각을 함께 저장(3시간 TTL) — 슬롯 일치 여부로 "신선"을,
  // 갱신시각(TTL)으로 "3시간 이내 stale"을 같은 레코드에서 판정해 쓰기를 1회로 줄인다.
  getCoin(market: string, slot: string): Promise<CoinPriceResult | null>;
  getCoinStale(market: string): Promise<CoinPriceResult | null>;
  setCoin(market: string, slot: string, result: CoinPriceResult): Promise<void>;
  // 원화 마켓 페어 목록 (TTL 1일) — 무효 심볼로 ticker 요청 전체가 실패하는 것 방지
  getUpbitMarkets(): Promise<string[] | null>;
  setUpbitMarkets(markets: string[]): Promise<void>;
  // 외부 호출 직렬화용 락 — 획득 성공 시 true. TTL 후 자동 해제
  acquireUpbitLock(ttlSec: number): Promise<boolean>;
  releaseUpbitLock(): Promise<void>;
  // 마지막 외부 호출 시각(ms) — 최소 호출 간격 강제용
  getUpbitLastCallAt(): Promise<number | null>;
  setUpbitLastCallAt(ms: number): Promise<void>;
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
const CSYNC_TTL_SECONDS = 90 * 24 * 3600; // 90일
const CSYNC_TTL_MS = CSYNC_TTL_SECONDS * 1000;
const RATE_LIMIT_WINDOW_SECONDS = 60;
const RATE_LIMIT_MAX = 10;
export const GEMINI_SERVER_DAILY_LIMIT = 300; // 서버 전역 하루 최대 호출 수
const STOCK_CLASSIFICATION_TTL_MS = 90 * 24 * 60 * 60 * 1000; // 90일
const STOCK_CLASSIFICATION_TTL_SEC = 90 * 24 * 60 * 60;
// 코인: 슬롯 1시간 캐시 + 3시간 stale 폴백 (갱신 실패해도 최근 값 제공)
const COIN_TTL_SEC = 3600;
const COIN_STALE_TTL_SEC = 3 * 3600;
const COIN_STALE_TTL_MS = COIN_STALE_TTL_SEC * 1000;
const UPBIT_MARKETS_TTL_SEC = 24 * 3600;
const UPBIT_MARKETS_TTL_MS = UPBIT_MARKETS_TTL_SEC * 1000;

// 서버/클라이언트 공통 캐시 슬롯 유틸 (stock-cache-slot.ts에서 re-export)
import { getEffectiveDateStr as _getEffectiveDateStr, getStockCacheSlot as _getStockCacheSlot } from "./finance/stock-cache-slot";
export { _getEffectiveDateStr as getEffectiveDateStr, _getStockCacheSlot as getStockCacheSlot };
// 내부 사용을 위한 로컬 바인딩
const getEffectiveDateStr = _getEffectiveDateStr;

// 환율 이력에 새 일자를 반영하고 최근 7일치만 남김 (연휴·주말 컷오프 버퍼)
const EXCHANGE_HISTORY_DAYS = 7;
function mergeExchangeHistoryEntry(
  history: Record<string, { USD: number; JPY: number }>,
  rates: ExchangeRates,
): Record<string, { USD: number; JPY: number }> {
  const date = rates.updated_at;
  if (!date) return history;
  const next: Record<string, { USD: number; JPY: number }> = { ...history, [date]: { USD: rates.USD, JPY: rates.JPY } };
  const kept = Object.keys(next).sort().slice(-EXCHANGE_HISTORY_DAYS);
  return Object.fromEntries(kept.map((d) => [d, next[d]]));
}

// JWT access_token의 exp(초)를 디코드. 형식 오류면 null.
function getJwtExpMs(token: string): number | null {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const payloadB64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = payloadB64 + "=".repeat((4 - payloadB64.length % 4) % 4);
    const json = Buffer.from(padded, "base64").toString("utf8");
    const payload = JSON.parse(json) as { exp?: number };
    if (typeof payload.exp !== "number") return null;
    return payload.exp * 1000;
  } catch {
    return null;
  }
}

// KIS 토큰이 현재 시각 기준 유효한지(만료 60초 전부터는 만료로 간주)
function isKisTokenValid(token: string): boolean {
  const expMs = getJwtExpMs(token);
  if (expMs === null) return false;
  return expMs - 60_000 > Date.now();
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
const CLOUD_SYNC_PATH = path.join(process.cwd(), "data", "cloud-sync.json");

interface AssetEnvelopeEntry {
  envelope: AssetEnvelope;
  expires_at: number;
}

interface CloudSyncFileData {
  assets?: Record<string, AssetEnvelopeEntry | AssetEnvelope>;
  vaults?: Record<string, AssetEnvelope>;
}

interface FileCacheData {
  EXCHANGE?: ExchangeRates;
  EXCHANGE_HISTORY?: Record<string, { USD: number; JPY: number }>;
  STOCKS?: Record<string, StockPriceResult>;
  KIS_TOKEN?: { access_token: string; updated_at: string };
  KIS_FAIL?: { count: number; openUntil: number };
  GEMINI_COUNT?: { count: number; date: string };
  DIVIDENDS?: Record<string, DividendPayoutResult[]>;
  REF_PRICES?: Record<string, number>;
  // 키: "{ticker}:{period}:{requestDate}" → 값: actualDate (KIS 응답일)
  REF_DATE_MAP?: Record<string, string>;
  // X-Ray 종목 분류 v1 (deprecated — themes/indices 도입 전 GICS 섹터). 잔존 가능, 무해.
  STOCK_CLASSIFICATION?: Record<string, { value: StockClassification; updated_at: number }>;
  // X-Ray 종목 분류 v2 (deprecated — marketCapTier 산출 오류 잔존). 무해, 미사용.
  STOCK_CLASSIFICATION_V2?: Record<string, { value: StockClassification; updated_at: number }>;
  // X-Ray 종목 분류 v3 (90일 TTL, per-ticker, themes/indices/marketCapTier — Gemini 시총 일원 추정)
  STOCK_CLASSIFICATION_V3?: Record<string, { value: StockClassification; updated_at: number }>;
  // 암호화폐 캐시 — STOCKS와 반드시 분리(writeFinanceCache의 prune이 주식 유효일 기준이라
  // 같은 버킷에 넣으면 매 write마다 코인 항목이 통째로 삭제된다)
  // market 단위 레코드 1개(slot+값+갱신시각) — 슬롯 일치 여부(신선)와 3시간 이내(stale)를
  // 같은 레코드에서 판정
  COINS?: Record<string, { value: CoinPriceResult; slot: string; updated_at: number }>;
  UPBIT_MARKETS?: { markets: string[]; updated_at: number };
  UPBIT_LAST_CALL?: number;
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

export class FileCacheStorage implements ICacheStorage {
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
        // includes 사용: 슬롯 키(TSLA-2026-05-15-H22)도 유효 날짜를 포함하므로 유지
        const effectiveForeign = getEffectiveDateStr("foreign");
        const effectiveDomestic = getEffectiveDateStr("domestic");
        data.STOCKS = Object.fromEntries(
          Object.entries(data.STOCKS).filter(([key]) =>
            key.includes(`-${effectiveForeign}`) || key.includes(`-${effectiveDomestic}`)
          )
        );
      }
      // KST 기준 오늘 (호출자 todayStr 의존 제거 — setStock 등은 effectiveDate를 넘기므로 어제가 들어올 수 있음)
      const nowKST = new Date(Date.now() + 9 * 60 * 60 * 1000);
      const todayKST = nowKST.toISOString().split("T")[0];

      // 날짜 불일치 EXCHANGE / KIS_TOKEN도 함께 정리
      const effectiveExchange = getEffectiveDateStr("exchange");
      if (data.EXCHANGE?.updated_at && data.EXCHANGE.updated_at !== effectiveExchange) {
        delete data.EXCHANGE;
      }
      // KIS 토큰: JWT exp 기준 만료 시 정리
      if (data.KIS_TOKEN?.access_token && !isKisTokenValid(data.KIS_TOKEN.access_token)) {
        delete data.KIS_TOKEN;
      }
      if (data.GEMINI_COUNT?.date && data.GEMINI_COUNT.date !== todayKST) {
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

  async getAssetEnvelope(assetId: string): Promise<AssetEnvelope | null> {
    if (!fs.existsSync(CLOUD_SYNC_PATH)) return null;
    try {
      const raw = JSON.parse(fs.readFileSync(CLOUD_SYNC_PATH, "utf8")) as CloudSyncFileData;
      const entry = raw.assets?.[assetId] ?? raw.vaults?.[assetId] ?? null;
      if (!entry) return null;

      // 하위 호환: 만약 래핑되지 않은 레거시 데이터라면 그대로 반환
      if (!("envelope" in entry)) {
        return entry;
      }

      // 만료 판단
      if (entry.expires_at < Date.now()) {
        delete raw.assets?.[assetId];
        fs.writeFileSync(CLOUD_SYNC_PATH, JSON.stringify(raw, null, 2), "utf8");
        return null;
      }

      // Sliding TTL 갱신
      entry.expires_at = Date.now() + CSYNC_TTL_MS;
      fs.writeFileSync(CLOUD_SYNC_PATH, JSON.stringify(raw, null, 2), "utf8");
      return entry.envelope;
    } catch {
      return null;
    }
  }

  async setAssetEnvelope(assetId: string, envelope: AssetEnvelope): Promise<void> {
    try {
      let data: CloudSyncFileData = { assets: {} };
      if (fs.existsSync(CLOUD_SYNC_PATH)) {
        try {
          data = JSON.parse(fs.readFileSync(CLOUD_SYNC_PATH, "utf8")) as CloudSyncFileData;
        } catch {
          // ignore
        }
      }
      if (!data.assets) data.assets = {};
      data.assets[assetId] = {
        envelope,
        expires_at: Date.now() + CSYNC_TTL_MS,
      };
      fs.mkdirSync(path.dirname(CLOUD_SYNC_PATH), { recursive: true });
      fs.writeFileSync(CLOUD_SYNC_PATH, JSON.stringify(data, null, 2), "utf8");
    } catch (e) {
      console.error("[FileCacheStorage setAssetEnvelope 오류]:", e);
    }
  }

  // 읽기·비교·쓰기를 전부 동기 fs 호출로만 구성(중간에 await 없음) — Node 단일 이벤트루프에서
  // 다른 요청이 이 함수 실행 중간에 끼어들 yield point가 없어, 로컬 dev(단일 프로세스)에서는
  // 이 구간의 레이스가 원천적으로 닫힌다.
  async compareAndSetAssetEnvelope(
    assetId: string,
    baseVersion: number,
    data: { pubKey: string; iv: string; ciphertext: string },
  ): Promise<{ ok: true; version: number } | { ok: false; currentVersion: number }> {
    try {
      let raw: CloudSyncFileData = { assets: {} };
      if (fs.existsSync(CLOUD_SYNC_PATH)) {
        try {
          raw = JSON.parse(fs.readFileSync(CLOUD_SYNC_PATH, "utf8")) as CloudSyncFileData;
        } catch {
          // ignore
        }
      }
      if (!raw.assets) raw.assets = {};
      const entry = raw.assets[assetId] ?? raw.vaults?.[assetId] ?? null;
      const current = entry && "envelope" in entry ? entry.envelope : (entry as AssetEnvelope | null);
      const currentVersion = current?.version ?? 0;
      if (current && currentVersion > baseVersion) {
        return { ok: false, currentVersion };
      }
      const envelope: AssetEnvelope = { ...data, version: currentVersion + 1, updatedAt: new Date().toISOString() };
      raw.assets[assetId] = { envelope, expires_at: Date.now() + CSYNC_TTL_MS };
      fs.mkdirSync(path.dirname(CLOUD_SYNC_PATH), { recursive: true });
      fs.writeFileSync(CLOUD_SYNC_PATH, JSON.stringify(raw, null, 2), "utf8");
      return { ok: true, version: envelope.version };
    } catch (e) {
      console.error("[FileCacheStorage compareAndSetAssetEnvelope 오류]:", e);
      return { ok: false, currentVersion: 0 };
    }
  }

  async getExchange(): Promise<ExchangeRates | null> {
    return this.readFinanceCache().EXCHANGE ?? null;
  }

  async setExchange(rates: ExchangeRates): Promise<void> {
    const cache = this.readFinanceCache();
    cache.EXCHANGE = rates;
    // 일자별 이력에 반영 후 최근 3일치만 유지
    cache.EXCHANGE_HISTORY = mergeExchangeHistoryEntry(cache.EXCHANGE_HISTORY ?? {}, rates);
    const todayStr = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().split("T")[0];
    this.writeFinanceCache(cache, todayStr);
  }

  async getExchangeHistory(): Promise<Record<string, { USD: number; JPY: number }>> {
    return this.readFinanceCache().EXCHANGE_HISTORY ?? {};
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

  async getKisToken(_todayStr: string): Promise<string | null> {
    const kisToken = this.readFinanceCache().KIS_TOKEN;
    if (!kisToken?.access_token) return null;
    // JWT exp 기반: 실제 만료 시각이 남아 있을 때만 재사용
    if (!isKisTokenValid(kisToken.access_token)) return null;
    return kisToken.access_token;
  }

  async setKisToken(token: string, todayStr: string): Promise<void> {
    const cache = this.readFinanceCache();
    cache.KIS_TOKEN = { access_token: token, updated_at: todayStr };
    this.writeFinanceCache(cache, todayStr);
  }

  async getKisFailState(): Promise<{ count: number; openUntil: number } | null> {
    return this.readFinanceCache().KIS_FAIL ?? null;
  }

  async setKisFailState(state: { count: number; openUntil: number }, _ttlSec: number): Promise<void> {
    const cache = this.readFinanceCache();
    cache.KIS_FAIL = state;
    const todayStr = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().split("T")[0];
    this.writeFinanceCache(cache, todayStr);
  }

  async clearKisFailState(): Promise<void> {
    const cache = this.readFinanceCache();
    if (!cache.KIS_FAIL) return;
    delete cache.KIS_FAIL;
    const todayStr = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().split("T")[0];
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

  async getRefDateForRequest(ticker: string, requestDate: string, period: ProfitPeriod): Promise<string | null> {
    const key = `${ticker}:${period}:${requestDate}`;
    return this.readFinanceCache().REF_DATE_MAP?.[key] ?? null;
  }

  async setRefDateForRequest(ticker: string, requestDate: string, actualDate: string, period: ProfitPeriod): Promise<void> {
    const nowKST = new Date(Date.now() + 9 * 60 * 60 * 1000);
    const todayStr = nowKST.toISOString().split("T")[0];
    const cache = this.readFinanceCache();
    if (!cache.REF_DATE_MAP) cache.REF_DATE_MAP = {};
    cache.REF_DATE_MAP[`${ticker}:${period}:${requestDate}`] = actualDate;
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

  async getStockClassification(ticker: string): Promise<StockClassification | null> {
    if (!ticker) return null;
    const entry = this.readFinanceCache().STOCK_CLASSIFICATION_V3?.[ticker.toUpperCase()];
    if (!entry) return null;
    if (Date.now() - entry.updated_at > STOCK_CLASSIFICATION_TTL_MS) return null;
    return entry.value;
  }

  async setStockClassification(ticker: string, value: StockClassification): Promise<void> {
    if (!ticker) return;
    const cache = this.readFinanceCache();
    if (!cache.STOCK_CLASSIFICATION_V3) cache.STOCK_CLASSIFICATION_V3 = {};
    const key = ticker.toUpperCase();
    const prev = cache.STOCK_CLASSIFICATION_V3[key]?.value;
    cache.STOCK_CLASSIFICATION_V3[key] = { value: mergeClassificationValue(prev, value), updated_at: Date.now() };
    const todayStr = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().split("T")[0];
    this.writeFinanceCache(cache, todayStr);
  }

  // ── 암호화폐 ──
  private writeCoinCache(cache: FileCacheData): void {
    const todayStr = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().split("T")[0];
    this.writeFinanceCache(cache, todayStr);
  }

  async getCoin(market: string, slot: string): Promise<CoinPriceResult | null> {
    const entry = this.readFinanceCache().COINS?.[market];
    if (!entry || entry.slot !== slot) return null;
    if (Date.now() - entry.updated_at > COIN_TTL_SEC * 1000) return null;
    return entry.value;
  }

  async getCoinStale(market: string): Promise<CoinPriceResult | null> {
    const entry = this.readFinanceCache().COINS?.[market];
    if (!entry) return null;
    if (Date.now() - entry.updated_at > COIN_STALE_TTL_MS) return null;
    return entry.value;
  }

  async setCoin(market: string, slot: string, result: CoinPriceResult): Promise<void> {
    const cache = this.readFinanceCache();
    if (!cache.COINS) cache.COINS = {};
    const now = Date.now();
    cache.COINS[market] = { value: result, slot, updated_at: now };
    // 만료된 항목 정리 (STOCKS와 달리 자체 TTL 기준)
    for (const [k, v] of Object.entries(cache.COINS)) {
      if (now - v.updated_at > COIN_STALE_TTL_MS) delete cache.COINS[k];
    }
    this.writeCoinCache(cache);
  }

  async getUpbitMarkets(): Promise<string[] | null> {
    const entry = this.readFinanceCache().UPBIT_MARKETS;
    if (!entry) return null;
    if (Date.now() - entry.updated_at > UPBIT_MARKETS_TTL_MS) return null;
    return entry.markets;
  }

  async setUpbitMarkets(markets: string[]): Promise<void> {
    const cache = this.readFinanceCache();
    cache.UPBIT_MARKETS = { markets, updated_at: Date.now() };
    this.writeCoinCache(cache);
  }

  // 로컬은 단일 프로세스 — 라우트의 in-flight dedup이 직렬화를 담당하므로 락은 항상 성공 처리
  async acquireUpbitLock(_ttlSec: number): Promise<boolean> {
    return true;
  }

  async releaseUpbitLock(): Promise<void> {
    // no-op
  }

  async getUpbitLastCallAt(): Promise<number | null> {
    return this.readFinanceCache().UPBIT_LAST_CALL ?? null;
  }

  async setUpbitLastCallAt(ms: number): Promise<void> {
    const cache = this.readFinanceCache();
    cache.UPBIT_LAST_CALL = ms;
    this.writeCoinCache(cache);
  }
}

// 서버 캐시용 분류 머지 — indices만 배열 합집합, 나머지는 spread (후행 우선)
function mergeClassificationValue(prev: StockClassification | undefined, patch: StockClassification): StockClassification {
  if (!prev) return patch;
  const merged: StockClassification = { ...prev, ...patch };
  const prevIdx = Array.isArray(prev.indices) ? prev.indices : [];
  const patchIdx = Array.isArray(patch.indices) ? patch.indices : [];
  if (prevIdx.length || patchIdx.length) {
    const set = new Set<string>();
    for (const v of prevIdx) if (typeof v === "string" && v) set.add(v);
    for (const v of patchIdx) if (typeof v === "string" && v) set.add(v);
    merged.indices = Array.from(set);
  }
  return merged;
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

  async getAssetEnvelope(assetId: string): Promise<AssetEnvelope | null> {
    const key = `csync:asset:${assetId}`;
    const envelope = await this.redis.get<AssetEnvelope>(key);
    if (envelope) {
      await this.redis.expire(key, CSYNC_TTL_SECONDS);
    }
    return envelope;
  }

  async setAssetEnvelope(assetId: string, envelope: AssetEnvelope): Promise<void> {
    await this.redis.set(`csync:asset:${assetId}`, envelope, { ex: CSYNC_TTL_SECONDS });
  }

  // Lua 스크립트로 "GET → 버전비교 → SET"을 Redis 내부에서 단일 원자 연산으로 실행한다(Lua
  // 스크립트는 Redis에서 항상 원자적으로 실행됨) — 두 서버리스 인스턴스가 거의 동시에 호출해도
  // 레이스 불가능. route.ts의 read-then-write(TOCTOU) 구조를 대체하기 위한 핵심 장치.
  private static readonly CAS_SCRIPT = `
    local raw = redis.call('GET', KEYS[1])
    local currentVersion = 0
    if raw then
      local cur = cjson.decode(raw)
      currentVersion = cur.version or 0
      if currentVersion > tonumber(ARGV[1]) then
        return {0, currentVersion}
      end
    end
    local envelope = cjson.decode(ARGV[2])
    envelope.version = currentVersion + 1
    envelope.updatedAt = ARGV[3]
    redis.call('SET', KEYS[1], cjson.encode(envelope), 'EX', ARGV[4])
    return {1, envelope.version}
  `;

  async compareAndSetAssetEnvelope(
    assetId: string,
    baseVersion: number,
    data: { pubKey: string; iv: string; ciphertext: string },
  ): Promise<{ ok: true; version: number } | { ok: false; currentVersion: number }> {
    const key = `csync:asset:${assetId}`;
    const [ok, version] = await this.redis.eval(
      UpstashCacheStorage.CAS_SCRIPT,
      [key],
      [String(baseVersion), JSON.stringify(data), new Date().toISOString(), String(CSYNC_TTL_SECONDS)],
    ) as [number, number];
    return ok === 1 ? { ok: true, version } : { ok: false, currentVersion: version };
  }

  async getExchange(): Promise<ExchangeRates | null> {
    return this.redis.get<ExchangeRates>("finance:exchange");
  }

  async setExchange(rates: ExchangeRates): Promise<void> {
    await this.redis.set("finance:exchange", rates, { ex: secondsUntilMidnightKST() });
    // 일자별 이력(최근 3일치) — read-modify-prune-write, TTL 5일 (주말 버퍼)
    const history = (await this.redis.get<Record<string, { USD: number; JPY: number }>>("finance:exchange:history")) ?? {};
    const next = mergeExchangeHistoryEntry(history, rates);
    await this.redis.set("finance:exchange:history", next, { ex: 5 * 24 * 3600 });
  }

  async getExchangeHistory(): Promise<Record<string, { USD: number; JPY: number }>> {
    return (await this.redis.get<Record<string, { USD: number; JPY: number }>>("finance:exchange:history")) ?? {};
  }

  async getStock(cacheKey: string): Promise<StockPriceResult | null> {
    return this.redis.get<StockPriceResult>(`finance:stock:${cacheKey}`);
  }

  async setStock(cacheKey: string, result: StockPriceResult, _todayStr: string, ticker: string): Promise<void> {
    const fullKey = `finance:stock:${cacheKey}`;
    // 슬롯 단위(1시간) 캐시 — 장중엔 매시간 갱신, 장외엔 다음 슬롯 전환까지 유지
    await this.redis.set(fullKey, result, { ex: 3600 });
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

  async getKisToken(_todayStr: string): Promise<string | null> {
    const data = await this.redis.get<{ access_token: string }>(`finance:kis_token`);
    if (!data?.access_token) return null;
    if (!isKisTokenValid(data.access_token)) return null;
    return data.access_token;
  }

  async setKisToken(token: string, todayStr: string): Promise<void> {
    // JWT exp 기준 TTL: 만료 시각까지 남은 초 (만료된 토큰은 저장하지 않음)
    const expMs = getJwtExpMs(token);
    const ttlSec = expMs ? Math.max(60, Math.floor((expMs - Date.now()) / 1000)) : 86400;
    await this.redis.set(
      `finance:kis_token`,
      { access_token: token, updated_at: todayStr },
      { ex: ttlSec }
    );
  }

  async getKisFailState(): Promise<{ count: number; openUntil: number } | null> {
    return this.redis.get<{ count: number; openUntil: number }>(`finance:kis_fail`);
  }

  async setKisFailState(state: { count: number; openUntil: number }, ttlSec: number): Promise<void> {
    await this.redis.set(`finance:kis_fail`, state, { ex: Math.max(60, ttlSec) });
  }

  async clearKisFailState(): Promise<void> {
    await this.redis.del(`finance:kis_fail`);
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

  async getRefDateForRequest(ticker: string, requestDate: string, period: ProfitPeriod): Promise<string | null> {
    return this.redis.get<string>(`finance:refdatemap:${ticker}:${period}:${requestDate}`);
  }

  async setRefDateForRequest(ticker: string, requestDate: string, actualDate: string, period: ProfitPeriod): Promise<void> {
    await this.redis.set(`finance:refdatemap:${ticker}:${period}:${requestDate}`, actualDate, {
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

  async getStockClassification(ticker: string): Promise<StockClassification | null> {
    if (!ticker) return null;
    return this.redis.get<StockClassification>(`xray:classification:v3:${ticker.toUpperCase()}`);
  }

  async setStockClassification(ticker: string, value: StockClassification): Promise<void> {
    if (!ticker) return;
    const key = `xray:classification:v3:${ticker.toUpperCase()}`;
    const prev = await this.redis.get<StockClassification>(key);
    const merged = mergeClassificationValue(prev ?? undefined, value);
    await this.redis.set(key, merged, { ex: STOCK_CLASSIFICATION_TTL_SEC });
  }

  // ── 암호화폐 ──
  // 키 접두를 finance:coin:으로 분리 — finance:stock: SCAN 정리와 서로 지우지 않도록.
  // market 단위 레코드 1개(slot+값+갱신시각, TTL 3시간)로 신선/stale 판정을 겸한다.
  private async getCoinRecord(market: string): Promise<{ value: CoinPriceResult; slot: string; updatedAtMs: number } | null> {
    return this.redis.get<{ value: CoinPriceResult; slot: string; updatedAtMs: number }>(`finance:coin:${market}`);
  }

  async getCoin(market: string, slot: string): Promise<CoinPriceResult | null> {
    const entry = await this.getCoinRecord(market);
    if (!entry || entry.slot !== slot) return null;
    return entry.value;
  }

  async getCoinStale(market: string): Promise<CoinPriceResult | null> {
    // 레코드가 존재하면 곧 3시간 TTL 이내라는 뜻(만료 시 Redis가 자동 삭제)
    const entry = await this.getCoinRecord(market);
    return entry?.value ?? null;
  }

  async setCoin(market: string, slot: string, result: CoinPriceResult): Promise<void> {
    await this.redis.set(
      `finance:coin:${market}`,
      { value: result, slot, updatedAtMs: Date.now() },
      { ex: COIN_STALE_TTL_SEC },
    );
  }

  async getUpbitMarkets(): Promise<string[] | null> {
    return this.redis.get<string[]>("finance:upbit:markets");
  }

  async setUpbitMarkets(markets: string[]): Promise<void> {
    await this.redis.set("finance:upbit:markets", markets, { ex: UPBIT_MARKETS_TTL_SEC });
  }

  // SET NX EX — 획득자만 외부 호출. TTL로 홀더가 죽어도 자동 해제
  async acquireUpbitLock(ttlSec: number): Promise<boolean> {
    const res = await this.redis.set("finance:upbit:lock", "1", { nx: true, ex: ttlSec });
    return res === "OK";
  }

  async releaseUpbitLock(): Promise<void> {
    await this.redis.del("finance:upbit:lock");
  }

  async getUpbitLastCallAt(): Promise<number | null> {
    return this.redis.get<number>("finance:upbit:last");
  }

  async setUpbitLastCallAt(ms: number): Promise<void> {
    await this.redis.set("finance:upbit:last", ms, { ex: 60 });
  }
}
