import { createStore } from "zustand/vanilla";
import { STORAGE_KEYS } from "@/lib/local-storage";

export type TutorialStep = 0 | 1 | 2 | 3 | 4 | 5;
export type StepStatus = "pending" | "done" | "skipped";

export interface TutorialState {
  activeStep: TutorialStep | null;
  step5Sub: "activity" | "profit"; // Step 5 내부 sub-step
  statuses: Record<TutorialStep, StepStatus>;
  isTutorialFinished: boolean;
  isWaiting: boolean; // 타겟 클릭 후 5초 대기 중

  initTutorial: () => void;
  completeStep: (step: TutorialStep) => void;
  skipStep: (step: TutorialStep) => void;
  advanceStep5: () => void; // activity → profit 전환
  startWaiting: (step: TutorialStep) => void; // 타겟 클릭 → 5초 후 completeStep
  showStep0: () => void;
}

type DoneKey = keyof typeof STORAGE_KEYS & `tutorialStep${TutorialStep}Done`;
type SkippedKey = keyof typeof STORAGE_KEYS & `tutorialStep${TutorialStep}Skipped`;

const DONE_KEYS: Record<TutorialStep, DoneKey> = {
  0: "tutorialStep0Done",
  1: "tutorialStep1Done",
  2: "tutorialStep2Done",
  3: "tutorialStep3Done",
  4: "tutorialStep4Done",
  5: "tutorialStep5Done",
};

const SKIPPED_KEYS: Record<TutorialStep, SkippedKey> = {
  0: "tutorialStep0Skipped",
  1: "tutorialStep1Skipped",
  2: "tutorialStep2Skipped",
  3: "tutorialStep3Skipped",
  4: "tutorialStep4Skipped",
  5: "tutorialStep5Skipped",
};

const ALL_STEPS: TutorialStep[] = [0, 1, 2, 3, 4, 5];

function readStatus(step: TutorialStep): StepStatus {
  if (typeof window === "undefined") return "pending";
  if (localStorage.getItem(STORAGE_KEYS[DONE_KEYS[step]]) === "1") return "done";
  if (localStorage.getItem(STORAGE_KEYS[SKIPPED_KEYS[step]]) === "1") return "skipped";
  return "pending";
}

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

  initTutorial: () => {
    if (typeof window === "undefined") return;

    const statuses = {} as Record<TutorialStep, StepStatus>;
    for (const step of ALL_STEPS) {
      statuses[step] = readStatus(step);
    }

    const activeStep = nextPendingStep(statuses);
    const isTutorialFinished = activeStep === null;

    set({ statuses, activeStep, isTutorialFinished, step5Sub: "activity" });
  },

  completeStep: (step: TutorialStep) => {
    const { statuses } = get();
    if (statuses[step] !== "pending") return; // 이미 처리됨

    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEYS[DONE_KEYS[step]], "1");
    }

    const newStatuses = { ...statuses, [step]: "done" as StepStatus };
    const activeStep = nextPendingStep(newStatuses);
    const isTutorialFinished = activeStep === null;

    set({ statuses: newStatuses, activeStep, isTutorialFinished, isWaiting: false });
  },

  skipStep: (step: TutorialStep) => {
    const { statuses } = get();
    if (statuses[step] !== "pending") return;

    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEYS[SKIPPED_KEYS[step]], "1");
    }

    const newStatuses = { ...statuses, [step]: "skipped" as StepStatus };
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

  showStep0: () => {
    const { statuses } = get();
    set({
      activeStep: 0,
      isTutorialFinished: false,
      statuses: { ...statuses, 0: "pending" as StepStatus },
    });
  },
}));
