import { create } from "zustand";
import type { XrayAxis } from "@/lib/xray/stock-xray";

// X-Ray 페이지 진입 시 초기 축 지정(4.83) — tax-view-store와 같은 "진입 대상 미리 지정 후 navigate, 진입 쪽이 1회 소비" 패턴.
// 상세·주식 X-Ray 타일이 값의 축을 그대로 열 때 쓴다. 저장소·해시 0.
interface XrayViewState {
  initialAxis: XrayAxis | null;
  setInitialAxis: (a: XrayAxis) => void;
  clear: () => void;
}

export const useXrayViewStore = create<XrayViewState>((set) => ({
  initialAxis: null,
  setInitialAxis: (a) => set({ initialAxis: a }),
  clear: () => set({ initialAxis: null }),
}));
