import { create } from "zustand";
import type { WizardCategory } from "@/lib/onboarding-wizard-status";

// 온보딩 마법사 열림 상태(S-4.29) — WelcomeGuide CTA·더보기 재진입 양쪽에서 open() 호출.
// trade-view-store.ts와 동일한 최소 zustand 패턴(persist 없음, 상태만).
// startCategory(#249): 체험 복귀 등록 칸이 넘기는 시작 단계 — 메모리만(저장 형식 무변경), pending일 때만 쓰인다(resolveWizardStart)
interface OnboardingWizardState {
  isOpen: boolean;
  startCategory: WizardCategory | null;
  open: (start?: WizardCategory) => void;
  close: () => void;
}

export const useOnboardingWizardStore = create<OnboardingWizardState>((set) => ({
  isOpen: false,
  startCategory: null,
  open: (start) => set({ isOpen: true, startCategory: start ?? null }),
  close: () => set({ isOpen: false, startCategory: null }),
}));
