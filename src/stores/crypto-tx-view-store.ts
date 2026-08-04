import { create } from "zustand";

// 암호화폐 매수/매도 내역 조회 페이지 진입 대상 — 코인 상세에서 선택 후 crypto-transactions 탭으로 전달
export interface CryptoTxViewTarget {
  cryptoId: string;
  name: string;
}

interface CryptoTxViewState {
  target: CryptoTxViewTarget | null;
  setTarget: (t: CryptoTxViewTarget) => void;
  clear: () => void;
}

export const useCryptoTxViewStore = create<CryptoTxViewState>((set) => ({
  target: null,
  setTarget: (t) => set({ target: t }),
  clear: () => set({ target: null }),
}));
