// #103 연결 계좌 화면 문구·평가·금지어 단언 (ui.md 5절·spec 3-L 11·14)
import { describe, expect, it, vi, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { evaluateLink, linkPreviewText, linkSavedToast, revertNoteText, revertToastSuffix, LINK_NONE } from "@/lib/trade/link-text";
import { planRemoveLink } from "@/lib/trade/linked-record";
import type { AssetData } from "@/types/asset";

afterEach(() => vi.useRealTimers());
const data = (o: Partial<AssetData> = {}): AssetData => ({
  realEstate: [], stocks: [], crypto: [], cash: [{ id: "a", type: "bank", name: "주거래", balance: 10_000_000, currency: "KRW" }],
  loans: [{ id: "l", type: "credit", name: "신용대출", balance: 3_000_000, interestRate: 3, startDate: "2025-01-01" }],
  yearlyNetAssets: [], transactions: [], cashTransactions: [], loanTransactions: [], cryptoTransactions: [],
  lastUpdated: "x", nickname: "", ...o,
});
const trade = (o = {}) => ({ type: "buy" as const, quantity: 10, price: 100_000, currency: "KRW" as const, date: "2026-11-10", name: "삼성", ...o });
const now = () => { vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date("2026-11-12T03:00:00Z")); };

describe("evaluateLink", () => {
  it("연결 안 함·반영 해제·후보 밖이면 none", () => {
    now();
    expect(evaluateLink(data(), trade(), LINK_NONE, true).state).toBe("none");
    expect(evaluateLink(data(), trade(), "cash:a", false).state).toBe("none");
    expect(evaluateLink(data(), trade(), "cash:zz", true).state).toBe("none");
    expect(evaluateLink(data(), trade({ date: "2026-10-30" }), "cash:a", true).state).toBe("none"); // 지난달 불가
  });
  it("현금 미리보기 문구", () => {
    now();
    const ev = evaluateLink(data(), trade(), "cash:a", true);
    if (ev.state !== "ok") throw new Error();
    expect(linkPreviewText(ev, "buy", false)).toEqual({ main: ["주거래", "10,000,000원", "9,000,000원"], sub: "거래 금액만큼 현금이 줄어요" });
    expect(linkPreviewText(ev, "buy", true).sub).toContain("(수수료 포함)");
  });
  it("오류 문구: 현금 부족·초과 상환·대금 0 이하", () => {
    now();
    const cash = evaluateLink(data(), trade({ quantity: 1000 }), "cash:a", true);
    expect(cash).toMatchObject({ state: "error", testId: "cash-link-error", message: "주거래 잔액이 부족해요. 다른 계좌를 고르거나 연결 안 함으로 저장해 주세요." });
    const loan = evaluateLink(data(), trade({ type: "sell", quantity: 1000 }), "loan:l", true);
    expect(loan).toMatchObject({ state: "error", testId: "loan-link-error", message: "신용대출 잔액보다 많이 갚을 수 없어요. 다른 계좌를 고르거나 연결 안 함으로 저장해 주세요." });
    const zero = evaluateLink(data(), trade({ quantity: 0.0000001, price: 1 }), "cash:a", true);
    expect(zero).toMatchObject({ state: "error", message: "연결할 금액이 0원 이하예요. 수수료를 확인하거나 연결 안 함으로 저장해 주세요." });
  });
  it("잔액 = 대금(전액 사용): zero 문구, 초과는 부족 문구", () => {
    now();
    const d = data({ cash: [{ id: "a", type: "bank", name: "주거래", balance: 1_000_000, currency: "KRW" }] });
    expect(evaluateLink(d, trade(), "cash:a", true)).toMatchObject({ state: "error", testId: "cash-link-error", message: "주거래은 0원으로 둘 수 없어요. 연결 안 함으로 저장하거나 맞추기로 잔액을 고쳐 주세요." });
    expect(evaluateLink(d, trade({ quantity: 11 }), "cash:a", true)).toMatchObject({ message: expect.stringContaining("잔액이 부족해요") });
  });
  it("토스트 문구", () => {
    expect(linkSavedToast("buy", "cash")).toBe("매수 거래가 기록되었습니다. 현금 기록도 남겼어요");
    expect(linkSavedToast("sell", "loan")).toBe("매도 거래가 기록되었습니다. 대출 기록도 남겼어요");
    expect(revertToastSuffix("cash")).toBe(" 연결된 현금 기록도 지웠어요");
  });
});

describe("삭제 안내 문구", () => {
  const rec = (type: "deposit" | "withdrawal", amount: number) => ({ id: "ctx_link_tx_1", cashId: "a", type, amount, currency: "KRW", date: "2026-11-10", reflected: true, createdAt: "x" }) as AssetData["cashTransactions"][number];
  it("매수 삭제 = 현금 복구(+), 매도 삭제 = 감소(-)", () => {
    expect(revertNoteText(planRemoveLink(data({ cashTransactions: [rec("withdrawal", 1_000_000)] }), "tx_1")!)).toBe("연결된 현금 기록도 함께 지워져요. 주거래 잔액 +1,000,000원");
    expect(revertNoteText(planRemoveLink(data({ cashTransactions: [rec("deposit", 1_000_000)] }), "tx_1")!)).toBe("연결된 현금 기록도 함께 지워져요. 주거래 잔액 -1,000,000원");
  });
  it("하한에 걸리면 실제 감소액 + 꼬리", () => {
    const plan = planRemoveLink(data({ cash: [{ id: "a", type: "bank", name: "주거래", balance: 150, currency: "KRW" }], cashTransactions: [rec("deposit", 500)] }), "tx_1")!;
    expect(revertNoteText(plan)).toBe("연결된 현금 기록도 함께 지워져요. 주거래 잔액 -149원, 잔액이 부족해 1원만 남아요");
    const loanRec = { id: "ltx_link_tx_1", loanId: "l", type: "borrow", amount: 400, date: "2026-11-10", reflected: true, createdAt: "x" } as AssetData["loanTransactions"][number];
    const lp = planRemoveLink(data({ loans: [{ id: "l", type: "credit", name: "신용대출", balance: 100, interestRate: 3, startDate: "2025-01-01" }], loanTransactions: [loanRec] }), "tx_1")!;
    expect(revertNoteText(lp)).toBe("연결된 대출 기록도 함께 지워져요. 신용대출 잔액 -100원, 남은 대출보다 커서 0원이 돼요");
  });
});

describe("신규 화면 문자열 금지어", () => {
  const FORBIDDEN = /연동|계좌 연결|자동 반영|자동 차감|자동|동기화|현금도 맞추기/;
  const root = path.resolve(__dirname, "../..");
  it.each(["lib/trade/link-text.ts", "app/(main)/_components/forms/trade/link-account-row.tsx"])("%s", (rel) => {
    const src = readFileSync(path.join(root, rel), "utf8");
    // 주석을 제외한 문자열 리터럴·JSX 텍스트만 검사
    const noComments = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
    expect(noComments).not.toMatch(FORBIDDEN);
  });
});
