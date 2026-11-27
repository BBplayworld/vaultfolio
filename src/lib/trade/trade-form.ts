// 직접 입력 기록 폼 공용 순수 함수(5.158 #311) — 저장값·표시 조건을 화면과 테스트가 같은 함수로 계산한다.
// trade-utils(포지션 정·역 계산)와 분리: 그쪽은 저장된 포지션과 대칭이어야 해서 손대지 않는다.
import { computeNewPosition, deriveBaseSnapshot, recomputeFromLog, type PositionLike, type TxLike } from "./trade-utils";
import type { PositionPreview } from "@/types/transaction";

/**
 * 해외 거래 체결 환율의 단일 값 — 칸·미리보기·연결 금액·`÷ N`·저장이 모두 이 값을 쓴다.
 * 칸 값 > 0 이면 그 값, 아니면 현재 환율(> 0일 때), 둘 다 없으면 undefined. 0은 돌려주지 않는다. 국내 종목은 항상 undefined.
 */
export function resolveTradeRate(opts: { input: number | undefined; currentRate: number; isForeign: boolean }): number | undefined {
  if (!opts.isForeign) return undefined;
  if (opts.input !== undefined && opts.input > 0) return opts.input;
  return opts.currentRate > 0 ? opts.currentRate : undefined;
}

/**
 * 과거 날짜 질문('이미 들어 있나요?') 표시 조건 — 날짜가 KST 오늘보다 앞이고 비어 있지 않을 때.
 * 신규 자산(항상 반영)은 묻지 않는다. today는 todayKst()를 넘긴다(UTC 자정 기준이면 00~09시에 어긋남).
 */
export function shouldAskPastDate(opts: { date: string; today: string; isNewSelected?: boolean }): boolean {
  if (opts.isNewSelected || !opts.date) return false;
  return opts.date < opts.today;
}

/** '현재가 넣기' 값 — 체결 단가 칸 자릿수와 같게 반올림(USD 3·JPY 4·KRW 0) */
export function roundTradePrice(value: number, currency: "KRW" | "USD" | "JPY" | undefined): number {
  const d = currency === "USD" ? 3 : currency === "JPY" ? 4 : 0;
  return Math.round(value * 10 ** d) / 10 ** d;
}

// ─────────────────────────────────────────────
// 기준 환율 0(미입력) 보유에 매수할 때 환율 희석 방지(#349)
// computeNewPosition(성적표·세금 replay·relink·코인 공용)은 그대로 두고, 주식 쓰기 3곳에서만 쓴다.
// ─────────────────────────────────────────────

type RatePosition = { quantity: number; avgExchangeRate: number };
type RateTx = { type: "buy" | "sell"; exchangeRate?: number };

/**
 * 기준 수량 > 0 · 기준 환율 ≤ 0 · 매수 · 체결 환율 > 0 이면 기준 환율을 체결 환율로 채운 포지션.
 * 0이 가중 평균에 섞여 저장 환율이 절반(예: 1,400 → 700)이 되는 것을 막는다. 그 밖에는 pos 그대로(같은 객체).
 * 기준 보유 0(앱 거래로만 만든 종목)·매도·국내(체결 환율 없음)는 해당 없음.
 */
export function fillBaseRateForBuy<P extends RatePosition>(pos: P, tx: RateTx): P {
  if (tx.type !== "buy" || !(pos.quantity > 0) || pos.avgExchangeRate > 0) return pos;
  if (!(tx.exchangeRate !== undefined && tx.exchangeRate > 0)) return pos;
  return { ...pos, avgExchangeRate: tx.exchangeRate };
}

/** 주식 거래 1건 반영 후 포지션 — 기록 화면(미리보기·저장)과 사진 가져오기 시뮬레이션이 쓴다(#349) */
export function applyStockTrade<P extends PositionLike>(pos: P, tx: TxLike): PositionPreview {
  return computeNewPosition(fillBaseRateForBuy(pos, tx), tx);
}

/**
 * 반영 거래 삭제 롤백(거래내역 화면, #349) — rollbackTransaction과 같되, 역산한 기준 보유분의 환율이 ≤ 0이면
 * 남은 반영 거래 중 재계산 순서상 첫 매수의 체결 환율로 채운 뒤 재계산한다(fillBaseRateForBuy와 같은 규칙).
 */
export function rollbackStockTrade<P extends PositionLike, T extends TxLike & { id: string }>(
  currentPosition: P,
  allTransactions: T[],
  removeTxId: string,
): P {
  const remaining = allTransactions.filter((t) => t.id !== removeTxId);
  const firstBuy = [...remaining]
    .filter((t) => t.reflected && t.type === "buy")
    .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt))[0];
  const base = deriveBaseSnapshot(currentPosition, allTransactions);
  return recomputeFromLog(firstBuy ? fillBaseRateForBuy(base, firstBuy) : base, remaining);
}
