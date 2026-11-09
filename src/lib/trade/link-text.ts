import type { AssetData } from "@/types/asset";
import { cashBalanceFloor } from "./cash-tx-utils";
import { buildLink, linkCandidates, type BuildLinkResult, type LinkChoice, type LinkTrade, type RemoveLinkPlan } from "./linked-record";

// 연결 계좌 화면 문구·선택값 해석(#103). 금지어(연동·계좌 연결·자동 반영·자동 차감·자동·동기화)는 쓰지 않는다(ui.md 5절).

export const LINK_NONE = "none";
export const linkValueOf = (c: LinkChoice): string => (c.kind === "cash" ? `cash:${c.cashId}` : `loan:${c.loanId}`);
export function parseLinkValue(v: string): LinkChoice | null {
  if (v.startsWith("cash:")) return { kind: "cash", cashId: v.slice(5) };
  if (v.startsWith("loan:")) return { kind: "loan", loanId: v.slice(5) };
  return null;
}

export const fmtMoney = (n: number, currency: "KRW" | "USD" | "JPY" = "KRW"): string => {
  if (currency === "USD") return `$${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
  if (currency === "JPY") return `¥${Math.round(n).toLocaleString("en-US")}`;
  return `${Math.round(n).toLocaleString("ko-KR")}원`;
};

export type LinkEval =
  | { state: "none" } // 연결 안 함이거나 선택이 후보에 없음: 저장은 연결 없이
  | { state: "ok"; choice: LinkChoice; result: Extract<BuildLinkResult, { ok: true }>; name: string; currency: "KRW" | "USD" | "JPY" }
  | { state: "error"; choice: LinkChoice; testId: "cash-link-error" | "loan-link-error"; message: string };

/** 선택값 + 입력 중 거래로 연결 가능 여부·미리보기·오류 문구를 계산(화면 표시와 제출 차단이 같은 함수) */
export function evaluateLink(data: AssetData, trade: Omit<LinkTrade, "id">, value: string, reflected: boolean): LinkEval {
  const choice = reflected ? parseLinkValue(value) : null;
  if (!choice) return { state: "none" };
  const cands = linkCandidates(data, trade);
  const acct = choice.kind === "cash" ? cands.cash.find((c) => c.id === choice.cashId) : cands.loans.find((l) => l.id === choice.loanId);
  if (!acct) return { state: "none" };
  const r = buildLink(data, { ...trade, id: "__link_preview__" }, choice);
  const testId = choice.kind === "cash" ? "cash-link-error" : "loan-link-error";
  if (r.ok) return { state: "ok", choice, result: r, name: acct.name, currency: choice.kind === "cash" ? trade.currency : "KRW" };
  if (r.reason === "balance") {
    return {
      state: "error", choice, testId,
      message: choice.kind === "cash"
        ? `${acct.name} 잔액이 부족해요. 다른 계좌를 고르거나 연결 안 함으로 저장해 주세요.`
        : `${acct.name} 잔액보다 많이 갚을 수 없어요. 다른 계좌를 고르거나 연결 안 함으로 저장해 주세요.`,
    };
  }
  if (r.reason === "zero") return { state: "error", choice, testId, message: `${acct.name} 잔액을 ${fmtMoney(0, choice.kind === "cash" ? trade.currency : "KRW")}으로 둘 수 없어요. 연결 안 함으로 저장하거나 맞추기로 잔액을 고쳐 주세요.` };
  if (r.reason === "amount") return { state: "error", choice, testId: "cash-link-error", message: "연결할 금액이 0원 이하예요. 수수료를 확인하거나 연결 안 함으로 저장해 주세요." };
  return { state: "error", choice, testId, message: "이 계좌는 연결할 수 없어요. 다른 계좌를 고르거나 연결 안 함으로 저장해 주세요." };
}

/** 미리보기 [계좌명, 이전 잔액, 이후 잔액] + 보조 1줄 */
export function linkPreviewText(ev: Extract<LinkEval, { state: "ok" }>, type: "buy" | "sell", hasFee: boolean): { main: [string, string, string]; sub: string } {
  const { choice, result, name, currency } = ev;
  const sub = choice.kind === "cash"
    ? `거래 금액만큼 현금이 ${type === "buy" ? "줄어요" : "늘어요"}${hasFee ? " (수수료 포함)" : ""}`
    : type === "buy" ? "대출이 늘어요" : "대출이 줄어요";
  return { main: [name, fmtMoney(result.before, currency), fmtMoney(result.after, currency)], sub };
}

/** 저장 성공 토스트 */
export const linkSavedToast = (type: "buy" | "sell", kind: "cash" | "loan") =>
  `${type === "buy" ? "매수" : "매도"} 거래가 기록되었습니다. ${kind === "cash" ? "현금" : "대출"} 기록도 남겼어요`;

/** 삭제 확인 안내 1줄(하한 꼬리 포함, ui.md 3절). plan.delta = 실제 잔액 변화 */
export function revertNoteText(plan: RemoveLinkPlan): string {
  const kindLabel = plan.kind === "cash" ? "현금" : "대출";
  const head = `연결된 ${kindLabel} 기록도 함께 지워져요.`;
  if (plan.clamped && plan.delta === 0) return plan.kind === "cash" ? `${head} ${plan.accountName} 잔액은 더 줄지 않아요` : `${head} ${plan.accountName} 잔액은 이미 0원이에요`;
  const sign = plan.delta > 0 ? "+" : plan.delta < 0 ? "-" : "";
  const amount = `${plan.accountName} 잔액 ${sign}${fmtMoney(Math.abs(plan.delta), plan.currency)}`;
  if (!plan.clamped) return `${head} ${amount}`;
  return `${head} ${amount}, ${plan.kind === "cash" ? `잔액이 부족해 ${fmtMoney(cashBalanceFloor(plan.currency), plan.currency)}만 남아요` : "남은 대출보다 커서 0원이 돼요"}`;
}

/** 삭제 완료 토스트 꼬리 */
export const revertToastSuffix = (kind: "cash" | "loan") => ` 연결된 ${kind === "cash" ? "현금" : "대출"} 기록도 지웠어요`;
