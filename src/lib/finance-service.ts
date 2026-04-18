/**
 * finance-service.ts
 * 외부 주식·환율 데이터 조회를 단계별로 관리합니다.
 *
 * ─────────────────────────────────────────────
 * Step 1. 타입 정의
 * Step 2. 티커 정규화
 * Step 3. 종목 분류 (국내 / 해외)
 * Step 4. 외부 API 호출 - 해외 주식 (한국투자증권 OpenAPI)
 * Step 5. 외부 API 호출 - 국내 주식 (한국투자증권 OpenAPI)
 * Step 6. 외부 API 호출 - 환율 (한국투자증권 OpenAPI)
 * Step 7. 종목명 결정
 *
 * [서버 파일 캐시] data/finance-cache.json
 *   EXCHANGE: { USD, updated_at }
 *   STOCKS:   { "TICKER-DATE": { price, name, updated_at } }
 * ─────────────────────────────────────────────
 */

import { Stock } from "@/types/asset";

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

export const STORAGE_KEY_EXCHANGE_SYNC_DATE = "secretasset_exchange_last_sync_date";

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
// - 6자리 숫자로 시작하면 국내 (KRX) → 한국투자증권 국내주식 API
// - 그 외는 해외 → 한국투자증권 해외주식 API
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
// Step 4. 외부 API 호출 - 해외 주식 (한국투자증권 OpenAPI)
// /uapi/overseas-price/v1/quotations/search-info (tr_id: CTPF1702R)
// PRDT_TYPE_CD: 512(나스닥) → 513(뉴욕) 순으로 시도, 티커 간 300ms sleep
// ─────────────────────────────────────────────

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export async function fetchStocksFromKisOverseas(
  tickers: string[],
  todayStr: string,
  accessToken: string,
  appKey: string,
  appSecret: string
): Promise<Record<string, StockPriceResult>> {
  if (!accessToken || tickers.length === 0) return {};

  const results: Record<string, StockPriceResult> = {};

  for (let i = 0; i < tickers.length; i++) {
    if (i > 0) await sleep(350);
    const ticker = tickers[i];

    // 512: 나스닥, 513: 뉴욕, 529: 미국아멕스 순으로 시도
    for (const prdtTypeCd of ["512", "513", "529"]) {
      try {
        const res = await fetch(
          `https://openapi.koreainvestment.com:9443/uapi/overseas-price/v1/quotations/search-info?PRDT_TYPE_CD=${prdtTypeCd}&PDNO=${ticker}`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              appkey: appKey,
              appsecret: appSecret,
              tr_id: "CTPF1702R",
              "content-type": "application/json; charset=utf-8",
            },
            cache: "no-store",
          }
        );

        const data = await res.json();

        if (!res.ok || !data.output) {
          console.error(`[KIS 해외주식 조회 오류 - ${ticker}/${prdtTypeCd}]: HTTP ${res.status} ${res.statusText}`);
          continue;
        }

        const output = data.output as Record<string, string> | undefined;
        const price = parseFloat(output?.ovrs_now_pric1 ?? "0");
        if (price > 0) {
          results[ticker] = { price, name: output?.prdt_name || ticker, updated_at: todayStr };
          break; // 성공 시 다음 거래소 시도 불필요
        }
      } catch (e) {
        console.error(`[KIS 해외주식 조회 오류 - ${ticker}/${prdtTypeCd}]:`, e);
      }
    }
  }

  return results;
}

// ─────────────────────────────────────────────
// Step 5. 외부 API 호출 - 국내 주식 (한국투자증권 OpenAPI)
// access_token 발급: POST /oauth2/tokenP (24시간 유효, 서버에서 캐싱)
// 종목 조회: GET /uapi/domestic-stock/v1/quotations/search-stock-info
// ─────────────────────────────────────────────

export async function fetchKisToken(
  appKey: string,
  appSecret: string
): Promise<string | null> {
  if (!appKey || !appSecret) return null;
  try {
    const res = await fetch(
      "https://openapi.koreainvestment.com:9443/oauth2/tokenP",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ grant_type: "client_credentials", appkey: appKey, appsecret: appSecret }),
        cache: "no-store",
      }
    );
    if (!res.ok) {
      console.error(`[KIS 토큰 발급 오류]: HTTP ${res.status} ${res.statusText}`);
      return null;
    }
    const data = await res.json();
    return (data.access_token as string) ?? null;
  } catch (e) {
    console.error("[KIS 토큰 발급 오류]:", e);
    return null;
  }
}

export async function fetchStocksFromKorea(
  tickers: string[],
  todayStr: string,
  accessToken: string,
  appKey: string,
  appSecret: string
): Promise<Record<string, StockPriceResult>> {
  const results: Record<string, StockPriceResult> = {};

  for (const ticker of tickers) {
    try {
      const res = await fetch(
        `https://openapi.koreainvestment.com:9443/uapi/domestic-stock/v1/quotations/search-stock-info?PRDT_TYPE_CD=300&PDNO=${ticker}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            appkey: appKey,
            appsecret: appSecret,
            tr_id: "CTPF1002R",
          },
          cache: "no-store",
        }
      );
      if (!res.ok) {
        console.error(`[KIS 국내주식 조회 오류 - ${ticker}]: HTTP ${res.status} ${res.statusText}`);
        continue;
      }
      const data = await res.json();
      const output = data.output as Record<string, string> | undefined;
      const price = parseFloat(output?.thdt_clpr ?? "0");
      const name: string = output?.prdt_abrv_name ?? "";
      if (price > 0) {
        results[ticker] = { price, name, updated_at: todayStr };
      }
    } catch (e) {
      console.error(`[KIS 주식 조회 오류 - ${ticker}]:`, e);
    }
  }

  return results;
}

// ─────────────────────────────────────────────
// Step 6. 외부 API 호출 - 환율 (한국투자증권 OpenAPI)
// price-detail 응답의 output.t_rate(해당 통화 환율)를 추출합니다.
// - USD: AAPL(NAS) 조회 → t_rate = USD/KRW
// - JPY: 도요타 7203(TSE) 조회 → t_rate = JPY/KRW(1엔 기준) × 100 = 100엔 기준
// ─────────────────────────────────────────────

async function fetchKisRate(
  excd: string,
  symb: string,
  accessToken: string,
  appKey: string,
  appSecret: string
): Promise<number> {
  const res = await fetch(
    `https://openapi.koreainvestment.com:9443/uapi/overseas-price/v1/quotations/price-detail?AUTH=&EXCD=${excd}&SYMB=${symb}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        appkey: appKey,
        appsecret: appSecret,
        tr_id: "HHDFS76200200",
        "content-type": "application/json; charset=utf-8",
      },
      cache: "no-store",
    }
  );
  if (!res.ok) {
    console.error(`[KIS 환율 조회 오류 - ${excd}/${symb}]: HTTP ${res.status} ${res.statusText}`);
    return 0;
  }
  const data = await res.json();
  return parseFloat(data.output?.t_rate ?? "0");
}

export async function fetchExchangeRateFromKis(
  accessToken: string,
  appKey: string,
  appSecret: string,
  todayStr: string
): Promise<ExchangeRates | null> {
  if (!accessToken) return null;

  try {
    const [usdRate, jpyRateRaw] = await Promise.all([
      fetchKisRate("NAS", "AAPL", accessToken, appKey, appSecret),
      fetchKisRate("TSE", "7203", accessToken, appKey, appSecret), // 도요타: JPY 환율 추출용
    ]);

    if (usdRate > 0) {
      return {
        USD: usdRate,
        JPY: jpyRateRaw > 0 ? Math.round(jpyRateRaw * 100 * 10) / 10 : 0, // 1엔 → 100엔 기준
        updated_at: todayStr,
      };
    }
    return null;
  } catch (e) {
    console.error("[KIS 환율 조회 오류]:", e);
    return null;
  }
}

// ─────────────────────────────────────────────
// Step 7. 종목명 결정
// 해외주식은 API 반환값을 그대로 사용하고,
// 국내·IRP·ISA·연금은 종목코드/심볼 형식("005930", "005930.KS")을 걸러낸 뒤
// 유효한 이름이 있을 때만 덮어씁니다.
// ─────────────────────────────────────────────

export function resolveStockName(
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

