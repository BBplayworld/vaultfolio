import { create } from "zustand";

// 현금 입출금 내역 조회 페이지 진입 대상 — 현금 상세에서 선택 후 cash-transactions 탭으로 전달
export interface CashTxViewTarget {
  cashId: string;
  name: string;
}

interface CashTxViewState {
  target: CashTxViewTarget | null;
  setTarget: (t: CashTxViewTarget) => void;
  clear: () => void;
}

export const useCashTxViewStore = create<CashTxViewState>((set) => ({
  target: null,
  setTarget: (t) => set({ target: t }),
  clear: () => set({ target: null }),
}));
