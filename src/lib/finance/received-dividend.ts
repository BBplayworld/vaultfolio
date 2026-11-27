/**
 * finance/received-dividend.ts
 * 받은 배당 기록(#329) 합계 — 사용자가 현금 입금에 '배당으로 받은 돈'으로 적은 실제 입금액(입금일 기준).
 * 세전 계산값(지급·예상, dividend-calc.ts)과 섞지 않는다: 더하지도 빼지도 대체하지도 않는다.
 *  - 금액·날짜의 정본은 현금 거래 레코드다. 분류 표시(cash-tx-tags)는 '어느 입금이 배당인가'만 알려 준다
 *  - 반영·기록만 모두 합산, 입금만(출금 제외). 외화 입금은 지금 환율로 환산(엔화 포함)
 *  - 합계(C150): 달별 합을 원 단위로 반올림한 뒤 더한 값이 연 합계 → 12개 달 표시 금액의 합 = 연 합계 표시 금액
 */
import type { CashTransaction } from "@/types/asset";

export interface ReceivedDividend {
  /** 1~12월(인덱스 0 = 1월) — 원 단위 반올림 값 */
  months: number[];
  /** 달별 반올림 값의 합 */
  annual: number;
  /** 합산한 기록 수 */
  count: number;
}

/**
 * @param tagged 배당 표시가 붙은 현금 거래 id(살아 있는 거래와 조인한 값 — readDividendTags 결과)
 * @param year 합산할 연도(입금일의 연, KST 오늘 기준 올해)
 * @param mul 통화 → 원화 배수(getMultiplier)
 */
export function sumReceivedDividend(
  cashTransactions: readonly CashTransaction[],
  tagged: Readonly<Record<string, unknown>>,
  year: number,
  mul: (currency: string | undefined) => number,
): ReceivedDividend {
  const raw = new Array<number>(12).fill(0);
  let count = 0;
  const prefix = `${year}-`;
  for (const t of cashTransactions) {
    if (t.type !== "deposit" || !Object.prototype.hasOwnProperty.call(tagged, t.id)) continue;
    if (typeof t.date !== "string" || !t.date.startsWith(prefix)) continue;
    const month = Number(t.date.slice(5, 7));
    if (!Number.isInteger(month) || month < 1 || month > 12) continue;
    const krw = t.amount * mul(t.currency);
    if (!Number.isFinite(krw) || krw <= 0) continue;
    raw[month - 1] += krw;
    count += 1;
  }
  const months = raw.map((v) => Math.round(v));
  return { months, annual: months.reduce((s, v) => s + v, 0), count };
}
