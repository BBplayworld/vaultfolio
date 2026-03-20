/**
 * finance-service.ts
 * 외부 주식·환율 데이터 조회 및 클라이언트 동기화를 단계별로 관리합니다.
 *
 * ─────────────────────────────────────────────
 * Step 1. 타입 정의
 * Step 2. 티커 정규화
 * Step 3. 종목 분류 (국내 / 해외)
 * Step 4. 외부 API 호출 - 해외 주식 (Twelve Data)
 * Step 5. 외부 API 호출 - 국내 주식 (Yahoo Finance)
 * Step 6. 외부 API 호출 - 환율 (Twelve Data)
 * Step 7. 종목명 결정
 * Step 8. 클라이언트 동기화 (/api/finance 경유)
 *
 * [클라이언트 localStorage 캐시 키]
 *   vaultfolio_exchange_last_sync_date  환율 마지막 동기화 날짜 (KST)
 *   vaultfolio_stock_sync_status        주식 항목별 일일 동기화 상태 { date, synced[] } (자산 데이터와 분리)
 *
 * [서버 파일 캐시] data/finance-cache.json
 *   EXCHANGE: { USD, JPY, updated_at }
 *   STOCKS:   { "TICKER-DATE": { price, name, updated_at } }
 * ─────────────────────────────────────────────
 */

import { AssetData, Stock } from "@/types/asset";

// ─────────────────────────────────────────────
// Step 1. 타입 정의
// ─────────────────────────────────────────────

export interface StockPriceResult {
  price: number;
  name: string;
  updated_at: string;
}

export interface ExchangeRates {
  USD: number;
  JPY: number;
  updated_at?: string;
}

export interface FinanceSyncResult {
  updatedStocks: Stock[];
  syncedTickers: string[];        // 이번 배치에서 실제 갱신된 티커 목록
  updatedExchangeRates: ExchangeRates;
  synced: boolean;
}

export const STORAGE_KEY_EXCHANGE_SYNC_DATE = "vaultfolio_exchange_last_sync_date";

// 주식 항목별 오늘 동기화 완료 여부 추적 (vaultfolio-asset-data와 완전히 분리)
export const STORAGE_KEY_STOCK_SYNC_STATUS  = "vaultfolio_stock_sync_status";

interface StockSyncStatus {
  date: string;
  synced: string[]; // 오늘 갱신 완료된 정규화 티커 목록
}

export function getStockSyncStatus(): StockSyncStatus {
  const todayStr = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().split("T")[0];
  try {
    const saved = localStorage.getItem(STORAGE_KEY_STOCK_SYNC_STATUS);
    if (saved) {
      const parsed: StockSyncStatus = JSON.parse(saved);
      if (parsed.date === todayStr) return parsed;
    }
  } catch {}
  return { date: todayStr, synced: [] };
}

function markTickersSynced(tickers: string[]): void {
  const status = getStockSyncStatus();
  const updated: StockSyncStatus = {
    date: status.date,
    synced: [...new Set([...status.synced, ...tickers])],
  };
  localStorage.setItem(STORAGE_KEY_STOCK_SYNC_STATUS, JSON.stringify(updated));
}

// ─────────────────────────────────────────────
// Step 2. 티커 정규화
// 서버 API가 기대하는 형식으로 변환합니다.
// - 국내 주식: 6자리 숫자 추출 (예: "005930KQ" → "005930")
// - 해외 주식: 대문자 그대로 사용 (예: "tsla" → "TSLA")
// ─────────────────────────────────────────────

export function normalizeTicker(stock: Partial<Stock>): string {
  if (!stock.ticker) return "";
  const ticker = stock.ticker.trim().toUpperCase();

  const isDomestic =
    stock.category === "domestic" ||
    stock.category === "irp" ||
    stock.category === "isa" ||
    stock.category === "pension";

  if (isDomestic && /^\d{6}/.test(ticker)) {
    return ticker.match(/^\d{6}/)?.[0] || ticker;
  }

  return ticker;
}

// ─────────────────────────────────────────────
// Step 3. 종목 분류 (국내 / 해외)
// - 6자리 숫자로 시작하면 국내 (KRX) → Yahoo Finance 사용
// - 그 외는 해외 → Twelve Data 사용
// ─────────────────────────────────────────────

export function classifyTickers(tickers: string[]): {
  usTickers: string[];
  krTickers: string[];
} {
  return {
    usTickers: tickers.filter((t) => !/^\d{6}/.test(t) && !t.includes(":")),
    krTickers: tickers.filter((t) => /^\d{6}/.test(t)),
  };
}

// ─────────────────────────────────────────────
// Step 4. 외부 API 호출 - 해외 주식 (Twelve Data)
// 미국 등 해외 주식 현재가를 Twelve Data quote API로 조회합니다.
// ─────────────────────────────────────────────

export async function fetchStocksFromTwelveData(
  tickers: string[],
  apiKey: string,
  todayStr: string
): Promise<Record<string, StockPriceResult>> {
  if (!apiKey || tickers.length === 0) return {};

  const results: Record<string, StockPriceResult> = {};
  const symbols = tickers.join(",");

  try {
    const res = await fetch(
      `https://api.twelvedata.com/quote?symbol=${symbols}&apikey=${apiKey}`,
      { cache: "no-store" }
    );
    const data = await res.json();

    if (data.status === "error") throw new Error(data.message);

    tickers.forEach((ticker) => {
      const item = tickers.length === 1 ? data : data[ticker];
      // Twelve Data는 에러 시 item.status 필드가 존재함
      if (item && !item.status) {
        const price = parseFloat(item.close || item.price || item.last);
        if (price > 0) {
          results[ticker] = { price, name: item.name || ticker, updated_at: todayStr };
        }
      }
    });
  } catch (e) {
    console.error("[Twelve Data 오류]:", e);
  }

  return results;
}

// ─────────────────────────────────────────────
// Step 5. 외부 API 호출 - 국내 주식 (Yahoo Finance)
// 한국 주식 현재가를 Yahoo Finance v8 chart API로 조회합니다.
// API 키 불필요, 6자리 코드를 자동으로 ".KS" 심볼로 변환합니다.
// ─────────────────────────────────────────────

export async function fetchStocksFromYahooFinance(
  tickers: string[],
  todayStr: string
): Promise<Record<string, StockPriceResult>> {
  const results: Record<string, StockPriceResult> = {};

  for (const ticker of tickers) {
    try {
      const yahooSymbol = ticker.includes(".") ? ticker : `${ticker}.KS`;
      const res = await fetch(
        `https://query1.finance.yahoo.com/v8/finance/chart/${yahooSymbol}`,
        { cache: "no-store" }
      );
      const data = await res.json();

      const meta = data.chart?.result?.[0]?.meta;
      if (meta?.regularMarketPrice) {
        // longName(정식 영문명) → shortName → 빈 문자열 순으로 사용
        // meta.symbol은 "005930.KS" 같은 코드 형식이므로 종목명으로 사용하지 않음
        const name = meta.longName || meta.shortName || "";
        results[ticker] = {
          price: meta.regularMarketPrice,
          name,
          updated_at: todayStr,
        };
      }
    } catch (e) {
      console.error(`[Yahoo Finance 오류 - ${ticker}]:`, e);
    }
  }

  return results;
}

// ─────────────────────────────────────────────
// Step 6. 외부 API 호출 - 환율 (Twelve Data)
// USD/KRW, JPY/KRW 환율을 Twelve Data price API로 조회합니다.
// JPY는 100엔 기준으로 환산합니다.
// ─────────────────────────────────────────────

export async function fetchExchangeRatesFromTwelveData(
  apiKey: string,
  todayStr: string
): Promise<ExchangeRates | null> {
  if (!apiKey) return null;

  try {
    const res = await fetch(
      `https://api.twelvedata.com/price?symbol=USD/KRW,JPY/KRW&apikey=${apiKey}`,
      { cache: "no-store" }
    );
    const data = await res.json();

    if (data.status === "error") throw new Error(data.message);

    return {
      USD: parseFloat(data["USD/KRW"].price),
      JPY: parseFloat(data["JPY/KRW"].price) * 100,
      updated_at: todayStr,
    };
  } catch (e) {
    console.error("[환율 조회 오류]:", e);
    return null;
  }
}

// ─────────────────────────────────────────────
// Step 7. 종목명 결정
// 해외주식은 API 반환값을 그대로 사용하고,
// 국내·IRP·ISA·연금은 종목코드/심볼 형식("005930", "005930.KS")을 걸러낸 뒤
// 유효한 이름이 있을 때만 덮어씁니다.
// ─────────────────────────────────────────────

function resolveStockName(
  category: string | undefined,
  apiName: string,
  existingName: string
): string {
  if (category === "foreign") {
    return apiName || existingName;
  }
  // 종목코드(6자리 숫자) 또는 심볼(".KS", ".KQ" 등) 형식이면 무시
  const isCodeLike = !apiName || /^\d{6}/.test(apiName) || /\.\w{2,}$/.test(apiName);
  return isCodeLike ? existingName : apiName;
}

// ─────────────────────────────────────────────
// Step 8. 클라이언트 동기화 (/api/finance 경유)
// /api/finance 엔드포인트를 경유하여 서버 캐시를 활용합니다.
// 동기화 완료 여부는 STORAGE_KEY_STOCK_SYNC_STATUS에 별도 추적하여
// 자산 데이터(vaultfolio-asset-data)와 완전히 분리합니다.
// ─────────────────────────────────────────────

export async function syncFinanceData(
  assetData: AssetData,
  currentExchangeRates: ExchangeRates
): Promise<FinanceSyncResult> {
  const todayStr = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().split("T")[0];
  const lastExchangeSync = localStorage.getItem(STORAGE_KEY_EXCHANGE_SYNC_DATE);
  const needExchangeSync = lastExchangeSync !== todayStr;

  // 오늘 미갱신된 주식 필터링 (해외 우선 정렬)
  // 동기화 상태는 자산 데이터와 별도 키(STORAGE_KEY_STOCK_SYNC_STATUS)로 추적
  const syncStatus = getStockSyncStatus();
  const outdatedStocks = assetData.stocks
    .filter((s) => {
      const ticker = normalizeTicker(s);
      // sync status에 있거나, 이미 오늘 baseDate로 갱신된 종목은 제외
      return ticker !== "" && !syncStatus.synced.includes(ticker) && s.baseDate !== todayStr;
    })
    .sort((a, b) => {
      if (a.category === "foreign" && b.category !== "foreign") return -1;
      if (a.category !== "foreign" && b.category === "foreign") return 1;
      return 0;
    });

  if (!needExchangeSync && outdatedStocks.length === 0) {
    return { updatedStocks: assetData.stocks, syncedTickers: [], updatedExchangeRates: currentExchangeRates, synced: false };
  }

  try {
    let newExchangeRates: ExchangeRates = {
      ...currentExchangeRates,
      updated_at: lastExchangeSync || undefined,
    };

    // 환율 동기화 (서버 캐시 → 외부 API 순서는 서버에서 처리)
    if (needExchangeSync) {
      try {
        const res = await fetch("/api/finance?type=exchange");
        const data = await res.json();
        if (data && !data.error) {
          newExchangeRates = {
            USD: Math.round(data.USD * 10) / 10,
            JPY: Math.round(data.JPY * 10) / 10,
            updated_at: data.updated_at || todayStr,
          };
          localStorage.setItem(STORAGE_KEY_EXCHANGE_SYNC_DATE, newExchangeRates.updated_at!);
        }
      } catch (e) {
        console.error("환율 동기화 실패:", e);
      }
    }

    let updatedStocks = [...assetData.stocks];
    let syncedTickers: string[] = [];

    // 주식 동기화: 미갱신 종목 전체를 서버에 전달
    // 서버가 파일캐시 기준으로 히트/미스를 판단하고, 미캐시 항목만 외부 API 호출(2개씩 제한)
    if (outdatedStocks.length > 0) {
      const targets = outdatedStocks;
      const tickersParam = targets.map(normalizeTicker).join(",");
      const res = await fetch(`/api/finance?type=stock&tickers=${tickersParam}`);
      const stocksData = await res.json();

      if (stocksData && !stocksData.error) {
        updatedStocks = assetData.stocks.map((stock) => {
          const ticker = normalizeTicker(stock);
          const result = stocksData[ticker];
          if (result?.price !== undefined && result?.updated_at) {
            return {
              ...stock,
              currentPrice: result.price,
              baseDate: result.updated_at,
              // 해외주식: API 반환 name 그대로 사용
              // 국내 등: 유효한 이름(종목코드·심볼 형식 제외)인 경우에만 덮어씀
              name: resolveStockName(stock.category, result.name, stock.name),
            };
          }
          return stock;
        });
        // 갱신 완료 티커를 별도 sync status에 기록 (자산 데이터와 완전히 분리)
        syncedTickers = targets.map(normalizeTicker).filter((t) => stocksData[t]);
        markTickersSynced(syncedTickers);
      }
    }

    return { updatedStocks, syncedTickers, updatedExchangeRates: newExchangeRates, synced: true };
  } catch (error) {
    console.error("금융 데이터 동기화 실패:", error);
    return { updatedStocks: assetData.stocks, syncedTickers: [], updatedExchangeRates: currentExchangeRates, synced: false };
  }
}
