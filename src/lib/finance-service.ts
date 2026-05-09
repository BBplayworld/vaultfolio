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
  market?: string;
}

export interface ExchangeRates {
  USD: number;
  JPY: number;
  updated_at?: string;
}

// ─────────────────────────────────────────────
// Step 2. 티커 정규화
// 서버 API가 기대하는 형식으로 변환합니다.
// - 국내 주식: 6자리 숫자 추출 (예: "005930KQ" → "005930")
// - 해외 주식: 대문자 그대로 사용 (예: "tsla" → "TSLA")
// ─────────────────────────────────────────────

export function normalizeTicker(stock: Partial<Stock>): string {
  if (!stock.ticker) return "";
  const ticker = stock.ticker.trim();

  const isDomestic =
    stock.category === "domestic" ||
    stock.category === "irp" ||
    stock.category === "isa" ||
    stock.category === "pension";

  if (isDomestic) {
    const upper = ticker.toUpperCase();
    return upper.match(/^[A-Z0-9]{6}/)?.[0] || upper;
  }

  return ticker.toUpperCase().replace(/\./g, "/");
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
    usTickers: tickers.filter((t) => !/^[A-Z0-9]{6}$/.test(t) && !t.includes(":")),
    krTickers: tickers.filter((t) => /^[A-Z0-9]{6}$/.test(t)),
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
        const isDelisted = !!(output?.lstg_abol_dt && output.lstg_abol_dt.trim() !== "");
        if (price > 0 && !isDelisted) {
          const market = prdtTypeCd === "512" ? "NASDAQ" : prdtTypeCd === "513" ? "NYSE" : "AMEX";
          results[ticker] = { price, name: output?.prdt_name || ticker, updated_at: todayStr, market };
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
    console.log("[KIS 토큰 발급 시도]: POST /oauth2/tokenP");
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
    const token = (data.access_token as string) ?? null;
    console.log(`[KIS 토큰 발급 결과]: ${token ? "성공" : "실패(access_token 없음)"}, rt_cd=${data.rt_cd ?? "-"}, msg1=${data.msg1 ?? "-"}`);
    return token;
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
        const sctyGrp = output?.scty_grp_id_cd ?? "";
        const mketId = output?.mket_id_cd ?? "";
        const market = sctyGrp === "EF" ? "국내ETF" : mketId === "STK" ? "코스피" : mketId === "KSQ" ? "코스닥" : undefined;
        results[ticker] = { price, name, updated_at: todayStr, market };
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
// Step 7. 배당 조회 - 국내주식 (한국투자증권 OpenAPI)
// 예탁원정보(배당일정) [국내주식-145]
// GET /uapi/domestic-stock/v1/ksdinfo/dividend
// 파라미터: SHT_CD(종목코드), STR_DT(시작일YYYYMMDD), END_DT(종료일YYYYMMDD)
// ─────────────────────────────────────────────

export type DividendFrequency = "annual" | "semiannual" | "quarterly" | "monthly";

export interface DividendPayoutResult {
  payoutDate: string; // YYYY-MM-DD
  amountPerShare: number; // 원화(국내) 또는 환산 원화(해외)
  amountForeign?: number; // 외화 주당 금액 (해외주식 달러 등)
  currency?: string; // 통화코드 (USD, KRW 등)
  frequency?: DividendFrequency; // 배당 빈도 (건수 기반 추정)
  isEstimated?: boolean; // true = 예상 지급 (전년도 패턴 기반 추정)
}

function inferFrequency(count: number): DividendFrequency {
  if (count >= 10) return "monthly";
  if (count >= 4) return "quarterly";
  if (count >= 2) return "semiannual";
  return "annual";
}

export async function fetchDividendDomestic(
  ticker: string,
  fdt: string,
  tdt: string,
  accessToken: string,
  appKey: string,
  appSecret: string
): Promise<DividendPayoutResult[]> {
  try {
    const url = `https://openapi.koreainvestment.com:9443/uapi/domestic-stock/v1/ksdinfo/dividend?CTS=&GB1=0&F_DT=${fdt}&T_DT=${tdt}&SHT_CD=${ticker}&HIGH_GB=`;
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        appkey: appKey,
        appsecret: appSecret,
        tr_id: "HHKDB669102C0",
        "content-type": "application/json; charset=utf-8",
      },
      cache: "no-store",
    });
    if (!res.ok) {
      console.error(`[KIS 국내배당 조회 오류 - ${ticker}]: HTTP ${res.status} ${res.statusText}`);
      return [];
    }
    const data = await res.json();
    console.log(`[KIS 국내배당 응답 - ${ticker}]: rt_cd=${data.rt_cd ?? "-"}, msg1=${data.msg1 ?? "-"}, output1 건수=${Array.isArray(data.output1) ? data.output1.length : "배열아님(" + typeof data.output1 + ")"}`);
    if (data.rt_cd !== "0") {
      console.error(`[KIS 국내배당 API 오류 - ${ticker}]: rt_cd=${data.rt_cd}, msg1=${data.msg1}`);
    }
    const output = data.output1 as Record<string, string>[] | undefined;
    if (!Array.isArray(output)) return [];
    const rows = output
      .map((row) => {
        // divi_pay_dt: "YYYY/MM/DD" 또는 "YYYYMMDD" 두 형식 모두 처리
        const raw = row.divi_pay_dt ?? "";
        const payoutDate = raw.includes("/") ? raw.replace(/\//g, "-") : raw
          ? `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`
          : "";
        return {
          payoutDate,
          amountPerShare: parseFloat(row.per_sto_divi_amt ?? "0"),
          currency: "KRW",
        };
      })
      .filter((r) => r.payoutDate && r.amountPerShare > 0);
    const frequency = inferFrequency(rows.length);
    return rows.map((r) => ({ ...r, frequency }));
  } catch (e) {
    console.error(`[KIS 국내배당 조회 오류 - ${ticker}]:`, e);
    return [];
  }
}

// ─────────────────────────────────────────────
// Step 8. 배당 조회 - 해외주식 (한국투자증권 OpenAPI)
// 해외주식 기간별권리조회 [해외주식-052]
// GET /uapi/overseas-price/v1/quotations/period-rights
// 파라미터: RGHT_TYPE_CD=03(배당), INQR_DVSN_CD=02(현지기준일),
//           INQR_STRT_DT, INQR_END_DT, PDNO(상품번호=공백)
// ─────────────────────────────────────────────

export async function fetchDividendOverseas(
  ticker: string,
  excd: string,
  fdt: string,
  tdt: string,
  accessToken: string,
  appKey: string,
  appSecret: string
): Promise<DividendPayoutResult[]> {
  try {
    const url = `https://openapi.koreainvestment.com:9443/uapi/overseas-price/v1/quotations/period-rights?RGHT_TYPE_CD=03&INQR_DVSN_CD=02&INQR_STRT_DT=${fdt}&INQR_END_DT=${tdt}&PDNO=${ticker}&PRDT_TYPE_CD=&CTX_AREA_NK50=&CTX_AREA_FK50=`;
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        appkey: appKey,
        appsecret: appSecret,
        tr_id: "CTRGT011R",
        "content-type": "application/json; charset=utf-8",
      },
      cache: "no-store",
    });
    if (!res.ok) {
      console.error(`[KIS 해외배당 조회 오류 - ${ticker}/${excd}]: HTTP ${res.status} ${res.statusText}`);
      return [];
    }
    const data = await res.json();
    console.log(`[KIS 해외배당 RAW - ${ticker}/${excd}]:`, JSON.stringify(data));
    const output = data.output as Record<string, string>[] | undefined;
    if (!Array.isArray(output)) return [];
    const rows = output
      .map((row) => {
        const raw = row.acpl_bass_dt ?? "";
        const payoutDate = raw ? `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}` : "";
        const amountForeign = parseFloat(row.alct_frcr_unpr ?? "0");
        const currency = row.crcy_cd || "USD";
        return { payoutDate, amountPerShare: amountForeign, amountForeign, currency };
      })
      .filter((r) => r.payoutDate && r.amountPerShare > 0);
    const frequency = inferFrequency(rows.length);
    return rows.map((r) => ({ ...r, frequency }));
  } catch (e) {
    console.error(`[KIS 해외배당 조회 오류 - ${ticker}/${excd}]:`, e);
    return [];
  }
}

// ─────────────────────────────────────────────
// Step 9. 종목명 결정
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

// ─────────────────────────────────────────────
// Step 10. 과거 기준일 종가 조회
// 수익률 계산을 위해 특정 날짜의 종가를 조회합니다.
// 데이터가 없으면 하루씩 앞으로 roll-back (최대 5회) → 공휴일/주말 자동 처리.
// ─────────────────────────────────────────────

export interface HistoricalPriceResult {
  price: number;
  date: string; // YYYY-MM-DD
}

export async function fetchDomesticHistoricalPrice(
  ticker: string,
  dateStr: string,
  accessToken: string,
  appKey: string,
  appSecret: string
): Promise<HistoricalPriceResult | null> {
  const dateParts = dateStr.replace(/-/g, "");
  for (let i = 0; i < 5; i++) {
    const d = new Date(Date.UTC(
      parseInt(dateParts.slice(0, 4)),
      parseInt(dateParts.slice(4, 6)) - 1,
      parseInt(dateParts.slice(6, 8)) - i
    ));
    const tryDate = `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}${String(d.getUTCDate()).padStart(2, "0")}`;
    try {
      const res = await fetch(
        `https://openapi.koreainvestment.com:9443/uapi/domestic-stock/v1/quotations/inquire-daily-itemchartprice?FID_COND_MRKT_DIV_CODE=J&FID_INPUT_ISCD=${ticker}&FID_INPUT_DATE_1=${tryDate}&FID_INPUT_DATE_2=${tryDate}&FID_PERIOD_DIV_CODE=D&FID_ORG_ADJ_PRC=0`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            appkey: appKey,
            appsecret: appSecret,
            tr_id: "FHKST03010100",
            "content-type": "application/json; charset=utf-8",
          },
          cache: "no-store",
        }
      );
      if (!res.ok) continue;
      const data = await res.json();
      const output = data.output2 as Record<string, string>[] | undefined;
      if (Array.isArray(output) && output.length > 0) {
        const price = parseFloat(output[0].stck_clpr ?? "0");
        if (price > 0) {
          const date = `${tryDate.slice(0, 4)}-${tryDate.slice(4, 6)}-${tryDate.slice(6, 8)}`;
          return { price, date };
        }
      }
    } catch (e) {
      console.error(`[KIS 국내주식 과거종가 오류 - ${ticker}/${tryDate}]:`, e);
    }
  }
  return null;
}

export async function fetchOverseasHistoricalPrice(
  ticker: string,
  dateStr: string,
  accessToken: string,
  appKey: string,
  appSecret: string
): Promise<HistoricalPriceResult | null> {
  const targetDate = dateStr.replace(/-/g, ""); // YYYYMMDD
  for (const excd of ["NAS", "NYS", "AMS"]) {
    try {
      // NCNT=5로 최대 5개 row 조회 → xymd 날짜 일치하는 row 탐색 (휴장일 처리)
      const res = await fetch(
        `https://openapi.koreainvestment.com:9443/uapi/overseas-price/v1/quotations/dailyprice?AUTH=&EXCD=${excd}&SYMB=${ticker}&GUBN=0&MODP=0&BYMD=${targetDate}&NCNT=5`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            appkey: appKey,
            appsecret: appSecret,
            tr_id: "HHDFS76240000",
            "content-type": "application/json; charset=utf-8",
          },
          cache: "no-store",
        }
      );
      if (!res.ok) continue;
      const data = await res.json();
      const output = data.output2 as Record<string, string>[] | undefined;
      if (!Array.isArray(output) || output.length === 0) continue;
      // xymd가 targetDate와 일치하는 row 우선 탐색, 없으면 다음 유효한 row 사용
      const matched = output.find((row) => row.xymd === targetDate);
      const row = matched ?? output.find((r) => parseFloat(r.clos ?? "0") > 0);
      if (!row) continue;
      const price = parseFloat(row.clos ?? "0");
      if (price > 0) {
        const xymd = row.xymd ?? targetDate;
        const date = `${xymd.slice(0, 4)}-${xymd.slice(4, 6)}-${xymd.slice(6, 8)}`;
        return { price, date };
      }
    } catch (e) {
      console.error(`[KIS 해외주식 과거종가 오류 - ${ticker}/${excd}/${targetDate}]:`, e);
    }
  }
  return null;
}

