import { create } from "zustand";

// 거래내역 조회 페이지 진입 대상 — 상세에서 선택 후 stocks-trades 탭으로 전달
export interface TradeViewTarget {
  groupStockIds: string[]; // 동일 티커 그룹의 증권사별 stockId 목록
  name: string;
  ticker: string;
  category: string;
  initialStockId: string | null; // 진입 시 프리선택할 증권사 항목(없으면 전체)
}

interface TradeViewState {
  target: TradeViewTarget | null;
  setTarget: (t: TradeViewTarget) => void;
  clear: () => void;
}

export const useTradeViewStore = create<TradeViewState>((set) => ({
  target: null,
  setTarget: (t) => set({ target: t }),
  clear: () => set({ target: null }),
}));
