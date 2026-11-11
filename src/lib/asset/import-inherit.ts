// 스크린샷 첫 등록(#146, 4.77) — 새 종목 매수일 일괄 입력 + `교체`·`초기화 후 등록`의 같은 종목 이어받기(순수).
// 맞추기(apply.ts)와 같은 원칙: 같은 키 기존 항목이 있으면 새 id·오늘 매수일로 다시 만들지 않고 id·매수일·매입 환율·메모를 이어받아
// 거래 기록(stockId·cryptoId)이 끊기지 않게 한다. `holdings-conflict.ts`의 resolveKept는 현금·대출과 공용이라 건드리지 않는다(C1).
import type { Crypto, Stock } from "@/types/asset";
import { keyOfCrypto, keyOfStock, resolveKept, type ConflictMode } from "./holdings-conflict";
import { sameBroker } from "./resync/match";
import { resyncNewPurchaseDate } from "./resync/apply";

/** KST 오늘(YYYY-MM-DD) */
export const kstTodayString = (now: number = Date.now()): string => new Date(now + 9 * 3600 * 1000).toISOString().slice(0, 10);

/** 새 종목 매수일 입력 기본값 = 올해 1월 1일. 사용자가 고칠 수 있다 */
export const defaultNewPurchaseDate = (today: string = kstTodayString()): string => resyncNewPurchaseDate(today);

/** 빈 값·형식 오류·오늘 이후 날짜는 불가(오늘이나 그 이전만) */
export function isValidNewPurchaseDate(v: string, today: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(v) && v <= today;
}

interface PairOpts<E, I> {
  keyOfExisting: (e: E) => string;
  /** 키를 만들 수 없는 행(티커 없음)은 null → 이어받지 않는다 */
  keyOfIncoming: (i: I) => string | null;
  brokerOfExisting: (e: E) => string | undefined;
  brokerOfIncoming: (i: I) => string | undefined;
  purchaseDateOf: (e: E) => string;
}

/**
 * 화면 행 index → 이어받는 기존 항목(1:1). 같은 키 기존 항목 중 증권사 같음 → 매수일 이른 것 → 기존 순서로 고른다
 * (맞추기 pickPredecessor와 같은 순서). 충돌 단계 `교체` 판정·입력 줄 신규 건수·저장이 모두 이 함수를 쓴다(C75).
 */
export function pairImportPredecessors<E, I>(existing: E[], incoming: I[], o: PairOpts<E, I>): Map<number, E> {
  const out = new Map<number, E>();
  const taken = new Set<number>();
  incoming.forEach((inc, idx) => {
    const key = o.keyOfIncoming(inc);
    if (!key) return;
    const broker = o.brokerOfIncoming(inc);
    const rank = (e: E) => (broker && sameBroker(o.brokerOfExisting(e), broker) ? 0 : 1);
    const best = existing
      .map((e, i) => ({ e, i }))
      .filter(({ e, i }) => !taken.has(i) && o.keyOfExisting(e) === key)
      .sort(
        (a, b) =>
          rank(a.e) - rank(b.e) ||
          (o.purchaseDateOf(a.e) || "9999").localeCompare(o.purchaseDateOf(b.e) || "9999") ||
          a.i - b.i,
      )[0];
    if (!best) return;
    taken.add(best.i);
    out.set(idx, best.e);
  });
  return out;
}

const stockOpts = (tickerOf: (s: Stock) => string): PairOpts<Stock, Stock> => ({
  keyOfExisting: keyOfStock,
  keyOfIncoming: (s) => (tickerOf(s) ? keyOfStock({ ticker: tickerOf(s), category: s.category }) : null),
  brokerOfExisting: (s) => s.broker,
  brokerOfIncoming: (s) => s.broker,
  purchaseDateOf: (s) => s.purchaseDate,
});

const cryptoOpts: PairOpts<Crypto, Crypto> = {
  keyOfExisting: keyOfCrypto,
  keyOfIncoming: (c) => (c.symbol ? keyOfCrypto(c) : null),
  brokerOfExisting: (c) => c.exchange,
  brokerOfIncoming: (c) => c.exchange,
  purchaseDateOf: (c) => c.purchaseDate,
};

/** 주식 이어받기 짝. incoming의 ticker는 최종 티커(입력값 반영)여야 한다 */
export const pairStockImport = (existing: Stock[], incoming: Stock[]) => pairImportPredecessors(existing, incoming, stockOpts((s) => s.ticker ?? ""));
export const pairCryptoImport = (existing: Crypto[], incoming: Crypto[]) => pairImportPredecessors(existing, incoming, cryptoOpts);

/** 입력 줄·보조 줄 N = 선택 행 − 이어받는 행(C4) */
export const freshImportCount = (incoming: unknown[], pairs: Map<number, unknown>): number => incoming.length - pairs.size;

/** 이어받은 주식 = 기존 + 수량·평단·증권사·계좌만 화면 값(apply.ts 맞추기 이어받기와 같은 필드 규칙, C2). id·매수일·매입 환율·메모 유지 */
export function inheritStock(pred: Stock, item: Stock, today: string): Stock {
  return {
    ...pred,
    category: item.category,
    quantity: item.quantity,
    averagePrice: item.averagePrice,
    ...(item.broker ? { broker: item.broker } : {}),
    positionSource: "manual",
    positionEffectiveDate: today,
  };
}

export function inheritCrypto(pred: Crypto, item: Crypto, today: string): Crypto {
  return {
    ...pred,
    quantity: item.quantity,
    averagePrice: item.averagePrice,
    ...(item.exchange ? { exchange: item.exchange } : {}),
    positionSource: "manual",
    positionEffectiveDate: today,
  };
}

export interface ImportPlan<T> {
  /** 저장할 전체 목록 */
  items: T[];
  /** 이어받은 건수 */
  inherited: number;
  /** 새로 만든 건수(매수일 = 입력값) */
  fresh: number;
}

/**
 * 첫 등록 주식 저장 목록. merge = 이번 키와 겹치지 않는 기존 유지, reset = 기존 전부 제거 — 어느 쪽이든 짝지어진 기존은 이어받는다(C3).
 * 짝 없는 신규만 purchaseDate = 입력값. 새 id는 서버가 준 `stock_import_<ms>_N` 그대로(재생성 금지, D3)
 */
export function planStockImport(existing: Stock[], incoming: Stock[], mode: ConflictMode, purchaseDate: string, today: string): ImportPlan<Stock> {
  const pairs = pairStockImport(existing, incoming);
  const kept = resolveKept(existing, new Set(incoming.map(keyOfStock)), mode, keyOfStock);
  const items = incoming.map((s, i) => {
    const pred = pairs.get(i);
    return pred ? inheritStock(pred, s, today) : { ...s, purchaseDate };
  });
  return { items: [...kept, ...items], inherited: pairs.size, fresh: incoming.length - pairs.size };
}

/** 첫 등록 코인 저장 목록(규칙 동일). 새 id는 호출부가 만든 `crypto_import_<ms>_N` */
export function planCryptoImport(existing: Crypto[], incoming: Crypto[], mode: ConflictMode, purchaseDate: string, today: string): ImportPlan<Crypto> {
  const pairs = pairCryptoImport(existing, incoming);
  const kept = resolveKept(existing, new Set(incoming.map(keyOfCrypto)), mode, keyOfCrypto);
  const items = incoming.map((c, i) => {
    const pred = pairs.get(i);
    return pred ? inheritCrypto(pred, c, today) : { ...c, purchaseDate };
  });
  return { items: [...kept, ...items], inherited: pairs.size, fresh: incoming.length - pairs.size };
}
