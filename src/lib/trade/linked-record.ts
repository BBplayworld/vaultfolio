import type { AssetData, Cash, Loan } from "@/types/asset";
import type { CashTransaction, LoanTransaction } from "@/types/transaction";
import { todayKst } from "@/lib/tax-utils";
import { isCashWithdrawalValid, pruneCashTransactions } from "./cash-tx-utils";
import { isLoanRepaymentValid, pruneLoanTransactions } from "./loan-tx-utils";

// 거래 ↔ 현금·대출 '연결 계좌'(#103, 4.56) — 짝 기록 id 규칙 정본.
// 연결 = 거래 id에서 파생한 id를 가진 현금 입출금/대출 상환 기록. 새 필드·스키마·저장 키 0
// (모르는 키는 구버전 zod parse가 지우므로 id 문자열만 쓴다). 접두어 문자열은 이 파일 밖에서 쓰지 않는다.
// 모든 함수는 순수 함수(입력 data를 바꾸지 않고 새 객체 반환).

const CASH_LINK_PREFIX = "ctx_link_";
const LOAN_LINK_PREFIX = "ltx_link_";

export type LinkChoice = { kind: "cash"; cashId: string } | { kind: "loan"; loanId: string };

/** 연결 대상 거래(주식·코인 공통 최소 필드). 코인은 currency "KRW", fee 없을 수 있음 */
export interface LinkTrade {
  id: string;
  type: "buy" | "sell";
  quantity: number;
  price: number;
  fee?: number;
  currency: "KRW" | "USD" | "JPY";
  date: string;
  name: string;
}

export type LinkFailReason =
  | "no-account" // 선택 계좌가 없음
  | "currency" // 통화 불일치(현금) 또는 외화 거래의 대출 연결
  | "amount" // 연결 금액 0 이하
  | "balance" // 출금·상환이 잔액 초과
  | "duplicate" // 같은 거래 id의 짝 기록이 이미 있음
  | "month"; // 거래일이 이번 달(KST)이 아님

export type BuildLinkResult =
  | { ok: true; data: AssetData; amount: number; before: number; after: number }
  | { ok: false; reason: LinkFailReason };

export const cashLinkId = (txId: string) => `${CASH_LINK_PREFIX}${txId}`;
export const loanLinkId = (txId: string) => `${LOAN_LINK_PREFIX}${txId}`;

/** 짝 기록 id에서 거래 id 복원. 짝 id가 아니면 null */
export function linkedTradeIdOf(rec: { id: string }): string | null {
  if (rec.id.startsWith(CASH_LINK_PREFIX)) return rec.id.slice(CASH_LINK_PREFIX.length) || null;
  if (rec.id.startsWith(LOAN_LINK_PREFIX)) return rec.id.slice(LOAN_LINK_PREFIX.length) || null;
  return null;
}

/** 거래 통화 최소 단위 반올림(KRW·JPY 1, USD 0.01) — 미리보기·짝 기록·되돌림이 같은 값 */
export function roundMoney(value: number, currency: "KRW" | "USD" | "JPY"): number {
  if (currency === "USD") return Math.round(value * 100) / 100;
  return Math.round(value);
}

/** 연결 금액 = 수량×단가 (+수수료 매수 / −수수료 매도), 거래 통화 최소 단위 반올림 */
export function linkAmount(t: Pick<LinkTrade, "type" | "quantity" | "price" | "fee" | "currency">): number {
  const gross = t.quantity * t.price;
  const fee = t.fee ?? 0;
  return roundMoney(t.type === "buy" ? gross + fee : gross - fee, t.currency);
}

/** 연결 허용 거래일 = 오늘(KST)과 같은 달만(지난 결산 달의 서술을 바꾸지 않기 위함, cto 5-5 ④) */
export function isLinkDateAllowed(date: string, today: string = todayKst()): boolean {
  return date.length >= 7 && date.slice(0, 7) === today.slice(0, 7);
}

/** 후보 계좌: 같은 통화 현금 + (KRW 거래일 때만) 대출. 잔액 0 대출은 매도(상환) 후보에서 제외 */
export function linkCandidates(
  data: Pick<AssetData, "cash" | "loans">,
  trade: Pick<LinkTrade, "type" | "currency" | "date">,
  today?: string,
): { cash: Cash[]; loans: Loan[] } {
  if (!isLinkDateAllowed(trade.date, today)) return { cash: [], loans: [] };
  const cash = (data.cash || []).filter((c) => (c.currency || "KRW") === trade.currency);
  const loans =
    trade.currency === "KRW"
      ? (data.loans || []).filter((l) => (trade.type === "sell" ? l.balance > 0 : true))
      : [];
  return { cash, loans };
}

/** 거래 id의 짝 기록 조회(현금 → 대출 순, 1개 또는 null) */
export function findLinkedRecord(
  data: Pick<AssetData, "cashTransactions" | "loanTransactions">,
  txId: string,
): { kind: "cash"; record: CashTransaction } | { kind: "loan"; record: LoanTransaction } | null {
  const c = (data.cashTransactions || []).find((r) => r.id === cashLinkId(txId));
  if (c) return { kind: "cash", record: c };
  const l = (data.loanTransactions || []).find((r) => r.id === loanLinkId(txId));
  if (l) return { kind: "loan", record: l };
  return null;
}

/** 짝 기록 + 계좌 잔액 변경을 data에 적용(저장은 호출 쪽 saveData 1회). 가드 실패 시 reason 반환 */
export function buildLink(
  data: AssetData,
  trade: LinkTrade,
  link: LinkChoice,
  today: string = todayKst(),
  now: Date = new Date(),
): BuildLinkResult {
  if (!isLinkDateAllowed(trade.date, today)) return { ok: false, reason: "month" };
  if (findLinkedRecord(data, trade.id)) return { ok: false, reason: "duplicate" };
  const amount = linkAmount(trade);
  if (!(amount > 0)) return { ok: false, reason: "amount" };
  const memo = `${trade.name} ${trade.type === "buy" ? "매수" : "매도"}`;
  const stamp = { reflected: true, reflectedAt: now.toISOString(), reflectionId: `ref_${now.getTime()}`, createdAt: now.toISOString() };

  if (link.kind === "cash") {
    const cash = (data.cash || []).find((c) => c.id === link.cashId);
    if (!cash) return { ok: false, reason: "no-account" };
    if ((cash.currency || "KRW") !== trade.currency) return { ok: false, reason: "currency" };
    const isBuy = trade.type === "buy";
    if (isBuy && !isCashWithdrawalValid(cash.balance, amount)) return { ok: false, reason: "balance" };
    const after = roundMoney(cash.balance + (isBuy ? -amount : amount), trade.currency);
    const rec: CashTransaction = {
      id: cashLinkId(trade.id), cashId: cash.id, type: isBuy ? "withdrawal" : "deposit",
      amount, currency: trade.currency, date: trade.date, memo, ...stamp,
    };
    return {
      ok: true, amount, before: cash.balance, after,
      data: {
        ...data,
        cashTransactions: pruneCashTransactions([...(data.cashTransactions || []), rec]),
        cash: data.cash.map((c) => (c.id === cash.id ? { ...c, balance: after } : c)),
      },
    };
  }

  const loan = (data.loans || []).find((l) => l.id === link.loanId);
  if (!loan) return { ok: false, reason: "no-account" };
  if (trade.currency !== "KRW") return { ok: false, reason: "currency" };
  const isBuy = trade.type === "buy";
  if (!isBuy && !isLoanRepaymentValid(loan.balance, amount)) return { ok: false, reason: "balance" };
  const after = loan.balance + (isBuy ? amount : -amount);
  const rec: LoanTransaction = {
    id: loanLinkId(trade.id), loanId: loan.id, type: isBuy ? "borrow" : "repay",
    amount, date: trade.date, memo, ...stamp,
  };
  return {
    ok: true, amount, before: loan.balance, after,
    data: {
      ...data,
      loanTransactions: pruneLoanTransactions([...(data.loanTransactions || []), rec]),
      loans: data.loans.map((l) => (l.id === loan.id ? { ...l, balance: after } : l)),
    },
  };
}

export interface RemoveLinkPlan {
  kind: "cash" | "loan";
  accountId: string;
  accountName: string;
  /** 실제 잔액 변화(하한 0 clamp 반영, 부호 포함). 미반영 기록이면 0 */
  delta: number;
  /** 감소 방향이 하한 0에 걸려 기록 금액보다 적게 줄어듦 */
  clamped: boolean;
  currency: "KRW" | "USD" | "JPY";
}

/**
 * 삭제 되돌림 계획 — 짝 기록의 '현재' 금액·통화·계좌로 역가감(거래 금액 재계산 금지, cto 5-5 ①②).
 * null = 되돌릴 짝 없음(짝 기록 없음, 또는 계좌가 없는 고아 → 짝 기록은 건드리지 않음).
 */
export function planRemoveLink(
  data: Pick<AssetData, "cash" | "loans" | "cashTransactions" | "loanTransactions">,
  txId: string,
): RemoveLinkPlan | null {
  const found = findLinkedRecord(data, txId);
  if (!found) return null;
  if (found.kind === "cash") {
    const r = found.record;
    const cash = (data.cash || []).find((c) => c.id === r.cashId);
    if (!cash) return null;
    const currency = r.currency || "KRW";
    if (!r.reflected) return { kind: "cash", accountId: cash.id, accountName: cash.name, delta: 0, clamped: false, currency };
    const raw = r.type === "deposit" ? -r.amount : r.amount; // 입금 되돌림 = 감소(하한 0)
    const next = roundMoney(Math.max(0, cash.balance + raw), currency);
    return { kind: "cash", accountId: cash.id, accountName: cash.name, delta: roundMoney(next - cash.balance, currency), clamped: raw < 0 && cash.balance + raw < 0, currency };
  }
  const r = found.record;
  const loan = (data.loans || []).find((l) => l.id === r.loanId);
  if (!loan) return null;
  if (!r.reflected) return { kind: "loan", accountId: loan.id, accountName: loan.name, delta: 0, clamped: false, currency: "KRW" };
  const raw = r.type === "borrow" ? -r.amount : r.amount; // 대출 증가 되돌림 = 감소(하한 0)
  const next = Math.max(0, loan.balance + raw);
  return { kind: "loan", accountId: loan.id, accountName: loan.name, delta: next - loan.balance, clamped: raw < 0 && loan.balance + raw < 0, currency: "KRW" };
}

/** 짝 기록 삭제 + 잔액 역가감을 data에 적용. 되돌림 대상이 없으면 data 그대로 반환 */
export function removeLink(data: AssetData, txId: string): { data: AssetData; plan: RemoveLinkPlan | null } {
  const plan = planRemoveLink(data, txId);
  if (!plan) return { data, plan: null };
  if (plan.kind === "cash") {
    return {
      plan,
      data: {
        ...data,
        cashTransactions: (data.cashTransactions || []).filter((r) => r.id !== cashLinkId(txId)),
        cash: data.cash.map((c) => (c.id === plan.accountId ? { ...c, balance: roundMoney(c.balance + plan.delta, plan.currency) } : c)),
      },
    };
  }
  return {
    plan,
    data: {
      ...data,
      loanTransactions: (data.loanTransactions || []).filter((r) => r.id !== loanLinkId(txId)),
      loans: data.loans.map((l) => (l.id === plan.accountId ? { ...l, balance: l.balance + plan.delta } : l)),
    },
  };
}
