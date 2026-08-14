import { create } from "zustand";

// 온보딩 마법사 열림 상태(S-4.29) — WelcomeGuide CTA·더보기 재진입 양쪽에서 open() 호출.
// trade-view-store.ts와 동일한 최소 zustand 패턴(persist 없음, 상태만).
interface OnboardingWizardState {
  isOpen: boolean;
  open: () => void;
  close: () => void;
}

export const useOnboardingWizardStore = create<OnboardingWizardState>((set) => ({
  isOpen: false,
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
}));
