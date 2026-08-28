import { create } from "zustand";

// 세금 관리 페이지 진입 시 초기 탭 지정 — loan-tx-view-store.ts와 동일 골격.
// #tax 페이지 내부 탭(세금 일정관리/절세 시뮬레이션)은 URL이 아닌 로컬 state라
// 외부(홈 팁 박스 등)에서 직접 지정할 방법이 없어 "진입 대상 미리 지정 후 navigate" 패턴을 사용한다.
export type TaxInitialTab = "schedule" | "simulator";

interface TaxViewState {
  initialTab: TaxInitialTab | null;
  setInitialTab: (t: TaxInitialTab) => void;
  clear: () => void;
}

export const useTaxViewStore = create<TaxViewState>((set) => ({
  initialTab: null,
  setInitialTab: (t) => set({ initialTab: t }),
  clear: () => set({ initialTab: null }),
}));
