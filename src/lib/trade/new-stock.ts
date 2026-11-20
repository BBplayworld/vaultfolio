import { normalizeTicker } from "@/lib/finance/finance-service";
import type { Stock } from "@/types/asset";

// #258 거래 입력에서 검색으로 고른 '처음 사는 종목' 판정·초안 순수 함수 (저장 함수·스키마 무변경)

export type TickerMarket = "kr" | "us";

// 검색 시장별 허용 종류 — 비상장은 없다(주식 추가에서 등록). 국내는 IRP·ISA·연금 포함
export const MARKET_CATEGORIES: Record<TickerMarket, Stock["category"][]> = {
  kr: ["domestic", "irp", "isa", "pension"],
  us: ["foreign"],
};

export const marketDefaultCategory = (market: TickerMarket): Stock["category"] => MARKET_CATEGORIES[market][0];

export interface PickedTicker {
  ticker: string;
  name: string;
  market: TickerMarket;
  /** 검색 결과의 거래 시장 표기(코스피·나스닥 등, API 값 그대로) */
  exchange?: string;
}

// AC-4 — 고른 종목이 보유(카테고리 필터와 무관, delisted 제외는 호출부)와 같은 종목인지.
// 양쪽 모두 normalizeTicker(카테고리 반영)를 거친 값으로 비교하고, 시장 군(국내 4종/해외)이 다르면 비교하지 않는다
export function findHeldByPicked(stocks: readonly Stock[], picked: Pick<PickedTicker, "ticker" | "market">): Stock[] {
  const want = normalizeTicker({ ticker: picked.ticker, category: marketDefaultCategory(picked.market) });
  if (!want) return [];
  const group = MARKET_CATEGORIES[picked.market];
  return stocks.filter((s) => group.includes(s.category) && !!s.ticker && normalizeTicker({ ticker: s.ticker, category: s.category }) === want);
}

// 신규 종목 초안 — 증권사·종류는 picker 선택값. 시세·포지션은 저장 직전에 채운다
export function buildPickedStockDraft(id: string, picked: PickedTicker, target: { broker: string; category: Stock["category"] }): Stock {
  return {
    id,
    name: picked.name,
    ticker: picked.ticker,
    category: target.category,
    currency: picked.market === "us" ? "USD" : "KRW",
    broker: target.broker,
    quantity: 0,
    averagePrice: 0,
    currentPrice: 0,
    purchaseDate: "",
  } as Stock;
}

export interface InitialQuote {
  price: number;
  /** 시세 기준일(조회 응답 값) — 없으면 비운다 */
  baseDate?: string;
}

// AC-9 — 현재가: 조회 성공이면 그 시세·기준일, 실패면 유효 체결 단가(USD 환산 후)로 임시 채우고 baseDate는 비운다
// (오늘 날짜를 넣으면 시세 갱신이 그 슬롯을 건너뛰어 현재가가 갱신되지 않는다)
export function withInitialPrice(stock: Stock, quote: InitialQuote | undefined, effectiveTxPrice: number): Stock {
  const { baseDate: _drop, ...rest } = stock;
  void _drop;
  if (quote && quote.price > 0) return { ...rest, currentPrice: quote.price, ...(quote.baseDate ? { baseDate: quote.baseDate } : {}) } as Stock;
  return { ...rest, currentPrice: effectiveTxPrice } as Stock;
}

// 시세 응답 이름 적용 규칙(직접 추가·거래 입력 공용): 해외는 응답 이름 그대로, 그 밖은 종목코드·심볼 형식이면 무시. 적용할 이름이 없으면 undefined
export function resolveQuotedName(fetchedName: string | undefined | null, category: Stock["category"] | string): string | undefined {
  const name = fetchedName || "";
  if (!name) return undefined;
  const isCodeLike = /^\d{6}/.test(name) || /\.\w{2,}$/.test(name);
  return category === "foreign" || !isCodeLike ? name : undefined;
}
