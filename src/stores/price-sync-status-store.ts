import { create } from "zustand";

// 이번 세션 마지막 주식 시세 받기의 실패 티커(#309) — 받으려던 대상 중 패치가 없는 티커(서킷으로 요청 못 한 배치 포함).
// 메모리 전용(저장 키 0). 홈·주식 요약 '언제 시세' 줄의 `N종목 이전 시세`와 대표값 제외 집합, 앱 열기 토스트 N이 같은 값을 읽는다.
interface PriceSyncStatusState {
  failedTickers: string[];
  setFailedTickers: (tickers: string[]) => void;
}

export const usePriceSyncStatusStore = create<PriceSyncStatusState>((set) => ({
  failedTickers: [],
  setFailedTickers: (tickers) => set({ failedTickers: tickers }),
}));
