import { create } from "zustand";
import type { StockDisplayCurrency } from "@/app/(main)/_components/views/detail/asset-detail-tabs";

// 종목 한 장(#157) 진입 대상 — 해시에는 종목명·티커를 싣지 않고(#detail/stocks-item 고정) 메모리 store로만 전달한다.
// 새로고침하면 사라져 상세·주식으로 이동한다(저장소 0).
export interface StockPageTarget {
  groupStockIds: string[]; // 누른 행의 그룹(상세·주식 groupKeyOf 기준) stockId 목록
  name: string;
  ticker: string;
  category: string;
  displayCurrency: StockDisplayCurrency; // 누른 시점 KRW/USD 토글 — 머리 값 = 누른 행 값
  origin: "stocks" | "market-compare"; // 뒤로 동작·라벨 결정
}

interface StockPageState {
  target: StockPageTarget | null;
  // 거래내역을 종목 한 장에서 열었는지 — 거래내역 뒤로 = 종목 한 장(그 밖 진입은 상세·주식)
  tradesFromStockPage: boolean;
  setTarget: (t: StockPageTarget) => void;
  setTradesFromStockPage: (v: boolean) => void;
  clear: () => void;
}

export const useStockPageStore = create<StockPageState>((set) => ({
  target: null,
  tradesFromStockPage: false,
  setTarget: (t) => set({ target: t, tradesFromStockPage: false }),
  setTradesFromStockPage: (v) => set({ tradesFromStockPage: v }),
  clear: () => set({ target: null, tradesFromStockPage: false }),
}));
