import { createStore } from "zustand/vanilla";
import { readTutorialStatus, writeTutorialStatus } from "@/lib/local-storage";

export type TutorialStep = 0 | 1 | 2 | 3 | 4 | 5;
export type StepStatus = "pending" | "done" | "skipped";

export interface TutorialState {
  activeStep: TutorialStep | null;
  step5Sub: "activity" | "profit"; // Step 5 내부 sub-step
  statuses: Record<TutorialStep, StepStatus>;
  isTutorialFinished: boolean;
  isWaiting: boolean; // 타겟 클릭 후 5초 대기 중
  isStandaloneStep0: boolean; // 메뉴-앱가이드 보기 단독 진입 (확인 버튼, 다음 단계 미진행)

  initTutorial: () => void;
  completeStep: (step: TutorialStep) => void;
  skipStep: (step: TutorialStep) => void;
  advanceStep5: () => void; // activity → profit 전환
  startWaiting: (step: TutorialStep) => void; // 타겟 클릭 → 5초 후 completeStep
  showStep0: (standalone?: boolean) => void;
  closeStandaloneStep0: () => void;
}

const ALL_STEPS: TutorialStep[] = [0, 1, 2, 3, 4, 5];

function nextPendingStep(statuses: Record<TutorialStep, StepStatus>): TutorialStep | null {
  for (const step of ALL_STEPS) {
    if (statuses[step] === "pending") return step;
  }
  return null;
}

let waitingTimer: ReturnType<typeof setTimeout> | null = null;

export const tutorialStore = createStore<TutorialState>()((set, get) => ({
  activeStep: null,
  step5Sub: "activity",
  statuses: { 0: "pending", 1: "pending", 2: "pending", 3: "pending", 4: "pending", 5: "pending" },
  isTutorialFinished: false,
  isWaiting: false,
  isStandaloneStep0: false,

  initTutorial: () => {
    if (typeof window === "undefined") return;

    const statuses = readTutorialStatus();
    const activeStep = nextPendingStep(statuses);
    const isTutorialFinished = activeStep === null;

    set({ statuses, activeStep, isTutorialFinished, step5Sub: "activity" });
  },

  completeStep: (step: TutorialStep) => {
    const { statuses } = get();
    if (statuses[step] !== "pending") return; // 이미 처리됨

    const newStatuses = { ...statuses, [step]: "done" as StepStatus };
    writeTutorialStatus(newStatuses);

    const activeStep = nextPendingStep(newStatuses);
    const isTutorialFinished = activeStep === null;

    set({ statuses: newStatuses, activeStep, isTutorialFinished, isWaiting: false });
  },

  skipStep: (step: TutorialStep) => {
    const { statuses } = get();
    if (statuses[step] !== "pending") return;

    const newStatuses = { ...statuses, [step]: "skipped" as StepStatus };
    writeTutorialStatus(newStatuses);

    const activeStep = nextPendingStep(newStatuses);
    const isTutorialFinished = activeStep === null;

    set({ statuses: newStatuses, activeStep, isTutorialFinished });
  },

  advanceStep5: () => {
    set({ step5Sub: "profit" });
  },

  startWaiting: (step: TutorialStep) => {
    const { activeStep, statuses } = get();
    if (activeStep !== step || statuses[step] !== "pending") return;

    set({ isWaiting: true });
    if (waitingTimer) clearTimeout(waitingTimer);
    waitingTimer = setTimeout(() => {
      waitingTimer = null;
      set({ isWaiting: false });
      get().completeStep(step);
    }, 5000);
  },

  showStep0: (standalone = false) => {
    const { statuses } = get();
    set({
      activeStep: 0,
      isTutorialFinished: false,
      statuses: { ...statuses, 0: "pending" as StepStatus },
      isStandaloneStep0: standalone,
    });
  },

  closeStandaloneStep0: () => {
    set({ activeStep: null, isStandaloneStep0: false });
  },
}));
