/**
 * price-freshness.ts (#309, 5.155)
 * 시세 신선도 순수 함수 — 복귀 재조회 사전 판정·실패 종목 집계·'언제 시세' 표시.
 * 저장 키 0: 기존 Stock.baseDate(캐시 칸)·exchangeSyncDate와 메모리 값만 읽는다.
 */
import type { Crypto, Stock } from "@/types/asset";
import { normalizeTicker } from "./finance-service";
import { getEffectiveDateStr, getStockCacheSlot, isUsEasternDST } from "./stock-cache-slot";
import { getCoinCacheSlot } from "./coin-cache-slot";

const KST_MS = 9 * 60 * 60 * 1000;

export interface PriceSlots {
  domestic: string;
  foreign: string;
  coin: string;
  /** 오늘(KST) YYYY-MM-DD */
  today: string;
  /** 환율 유효 날짜(09시 전이면 어제) — 서버 updated_at이 이 값이라 09시 전 동기화도 최신으로 본다 */
  exchangeEffective: string;
}

/** 지금 시각의 캐시 칸들 */
export function currentPriceSlots(): PriceSlots {
  return {
    domestic: getStockCacheSlot("domestic"),
    foreign: getStockCacheSlot("foreign"),
    coin: getCoinCacheSlot(),
    today: new Date(Date.now() + KST_MS).toISOString().split("T")[0],
    exchangeEffective: getEffectiveDateStr("exchange"),
  };
}

/** 이번 세션에서 마지막으로 받기를 시도한 칸(메모리). 같은 칸에서 실패한 종목을 복귀마다 다시 부르지 않게 한다 */
export interface PriceAttempts {
  domestic: string | null;
  foreign: string | null;
  coin: string | null;
  exchange: string | null;
}

export const EMPTY_PRICE_ATTEMPTS: PriceAttempts = { domestic: null, foreign: null, coin: null, exchange: null };

export interface ResyncPlan {
  exchange: boolean;
  stock: boolean;
  coin: boolean;
}

/**
 * 복귀 재조회 사전 판정(호출 전). syncTodayStockPrices의 outdated 판정(티커·칸)과 같은 규칙.
 * 하나도 true가 아니면 어떤 시세 함수도 부르지 않는다(요청 0·abort 0·dataResetVersion 증가 0).
 * 칸이 달라도 이번 세션에 같은 칸으로 이미 시도했으면(응답에서 빠진 종목·서킷) 다시 부르지 않는다.
 */
export function planPriceResync(input: {
  stocks: readonly Stock[];
  crypto: readonly Crypto[];
  exchangeSyncDate: string | null;
  slots: PriceSlots;
  attempts: PriceAttempts;
}): ResyncPlan {
  const { stocks, crypto, exchangeSyncDate, slots, attempts } = input;

  let domesticOutdated = false;
  let foreignOutdated = false;
  for (const s of stocks) {
    if (!normalizeTicker(s)) continue;
    const foreign = s.category === "foreign";
    if (s.baseDate === (foreign ? slots.foreign : slots.domestic)) continue;
    if (foreign) foreignOutdated = true;
    else domesticOutdated = true;
  }
  const stock =
    (domesticOutdated && attempts.domestic !== slots.domestic) ||
    (foreignOutdated && attempts.foreign !== slots.foreign);

  const coinOutdated = crypto.some((c) => !!c.symbol?.trim() && c.baseDate !== slots.coin);
  const coin = coinOutdated && attempts.coin !== slots.coin;

  const exchangeFresh = exchangeSyncDate === slots.today || exchangeSyncDate === slots.exchangeEffective;
  const exchange = !exchangeFresh && attempts.exchange !== slots.today;

  return { exchange, stock, coin };
}

export const hasResyncWork = (p: ResyncPlan): boolean => p.exchange || p.stock || p.coin;

/** 받으려던 티커 중 패치가 만들어지지 않은 티커(정렬). 서킷으로 요청하지 못한 배치도 패치가 없으므로 포함된다 */
export function failedPriceTickers(intended: Iterable<string>, patched: Iterable<string>): string[] {
  const ok = new Set(patched);
  return Array.from(new Set(intended)).filter((t) => !ok.has(t)).sort();
}

// ─── '언제 시세' 표시 ────────────────────────────────────────────────────────

export type PriceMarket = "domestic" | "foreign";

export interface PriceAsOf {
  market: PriceMarket;
  /** intraday = 장중 1시간 칸, close = 날짜 칸(종가) */
  kind: "intraday" | "close";
  /** intraday: 실제 KST 달력 날짜 / close: 그 시장의 거래일 */
  date: string;
  /** intraday의 KST 시(0~23), close는 null */
  hour: number | null;
  /** 비교용 실제 시각(epoch ms) */
  at: number;
}

const SLOT_RE = /^(\d{4})-(\d{2})-(\d{2})(?:-H(\d{2}))?$/;

const kstMs = (y: number, m: number, d: number, h: number, min = 0) => Date.UTC(y, m - 1, d, h, min) - KST_MS;
const ymd = (ms: number) => new Date(ms + KST_MS).toISOString().split("T")[0];

/**
 * baseDate(캐시 칸) → 기준 시각. getStockCacheSlot의 역함수.
 * 장중 칸 날짜는 effectiveDate라 달력 날짜와 다르다: 국내 16시 전(09~15시)·해외 07시 전(00~06시)은 전날 날짜가 붙는다.
 * 국내 날짜 칸 D = D 15:30 마감, 해외 날짜 칸 D = 미국 D 16:00 ET 마감(KST 다음 날 05시 DST / 06시 표준).
 */
export function priceAsOf(baseDate: string | undefined, market: PriceMarket): PriceAsOf | null {
  const m = baseDate ? SLOT_RE.exec(baseDate) : null;
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (m[4] !== undefined) {
    const hour = Number(m[4]);
    const nextDay = market === "domestic" ? hour < 16 : hour < 7;
    const at = kstMs(y, mo, d + (nextDay ? 1 : 0), hour);
    return { market, kind: "intraday", date: ymd(at), hour, at };
  }
  if (market === "domestic") {
    return { market, kind: "close", date: `${m[1]}-${m[2]}-${m[3]}`, hour: null, at: kstMs(y, mo, d, 15, 30) };
  }
  const dst = isUsEasternDST(new Date(Date.UTC(y, mo - 1, d, 17)));
  return { market, kind: "close", date: `${m[1]}-${m[2]}-${m[3]}`, hour: null, at: kstMs(y, mo, d + 1, dst ? 5 : 6) };
}

const md = (date: string) => `${Number(date.slice(5, 7))}/${Number(date.slice(8, 10))}`;

/** 기준 시각 → 라벨(`14시 시세`·`11/25 14시 시세`·`11/21 종가`·`미국 11/25 종가`) */
export function priceAsOfText(asOf: PriceAsOf, today: string): string {
  if (asOf.kind === "intraday") return `${asOf.date === today ? "" : `${md(asOf.date)} `}${asOf.hour}시 시세`;
  return `${asOf.market === "foreign" ? "미국 " : ""}${md(asOf.date)} 종가`;
}

/** 표시 대상 종목: 티커 있음·비상장 아님·상장폐지 아님 */
export const isPriceAsOfTarget = (s: Stock): boolean =>
  !!normalizeTicker(s) && s.category !== "unlisted" && s.inactiveStatus !== "delisted";

export interface PriceAsOfLineValue {
  /** 대표값 글자(없으면 "") */
  main: string;
  /** `N종목 이전 시세`(없으면 "") */
  failedText: string;
}

/**
 * '언제 시세' 한 줄. 대표값 = 실패 집합을 뺀 대상 중 가장 오래된 기준 시각(국내·해외 혼재 시 오래된 쪽 1개).
 * 실패 집합이 비면(새 세션·받기 전) 대상 전체의 최솟값. 대표값도 실패도 없으면 null(줄을 그리지 않음).
 */
export function priceAsOfLine(
  stocks: readonly Stock[],
  failedTickers: readonly string[],
  opts: { today: string; prefix?: string },
): PriceAsOfLineValue | null {
  const failed = new Set(failedTickers);
  const failedHit = new Set<string>();
  let rep: PriceAsOf | null = null;
  for (const s of stocks) {
    if (!isPriceAsOfTarget(s)) continue;
    const ticker = normalizeTicker(s);
    if (failed.has(ticker)) {
      failedHit.add(ticker);
      continue;
    }
    const asOf = priceAsOf(s.baseDate, s.category === "foreign" ? "foreign" : "domestic");
    if (asOf && (!rep || asOf.at < rep.at)) rep = asOf;
  }
  const n = failedHit.size;
  if (!rep && n === 0) return null;
  return {
    main: rep ? `${opts.prefix ?? ""}${priceAsOfText(rep, opts.today)}` : "",
    failedText: n > 0 ? `${n}종목 이전 시세` : "",
  };
}
