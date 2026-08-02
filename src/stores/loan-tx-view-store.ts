import { create } from "zustand";

// 대출 상환/추가 대출 내역 조회 페이지 진입 대상 — 대출 상세에서 선택 후 loan-transactions 탭으로 전달
// cash-tx-view-store 미러링 (S-4.24)
export interface LoanTxViewTarget {
  loanId: string;
  name: string;
}

interface LoanTxViewState {
  target: LoanTxViewTarget | null;
  setTarget: (t: LoanTxViewTarget) => void;
  clear: () => void;
}

export const useLoanTxViewStore = create<LoanTxViewState>((set) => ({
  target: null,
  setTarget: (t) => set({ target: t }),
  clear: () => set({ target: null }),
}));
