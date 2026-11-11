import { createStore } from "zustand/vanilla";
import { readTutorialStatus, writeTutorialStatus } from "@/lib/local-storage";
import { track } from "@/lib/analytics/ga";

export type TutorialStep = 1 | 2 | 3 | 4 | 5;
/** 안내에서 빠진 단계(2: 더보기 — 사실과 달라 삭제). 저장 키 형식은 1~5 그대로 두고 진행에서만 건너뛴다(#4.85) */
export type ActiveTutorialStep = Exclude<TutorialStep, 2>;
export const ACTIVE_TUTORIAL_STEPS: ActiveTutorialStep[] = [1, 3, 4, 5];
export type StepStatus = "pending" | "done" | "skipped";

export interface TutorialState {
  activeStep: ActiveTutorialStep | null;
  step5Sub: "activity" | "profit"; // Step 5 내부 sub-step
  statuses: Record<TutorialStep, StepStatus>;
  isTutorialFinished: boolean;
  isWaiting: boolean; // 타겟 클릭 후 5초 대기 중

  initTutorial: () => void;
  completeStep: (step: TutorialStep) => void;
  skipStep: (step: TutorialStep) => void;
  advanceStep5: () => void; // activity → profit 전환
  startWaiting: (step: TutorialStep) => void; // 타겟 클릭 → 5초 후 completeStep
}

/** 다음 진행할 단계(삭제된 2단계는 건너뜀) */
export function nextPendingStep(statuses: Record<TutorialStep, StepStatus>): ActiveTutorialStep | null {
  for (const step of ACTIVE_TUTORIAL_STEPS) {
    if (statuses[step] === "pending") return step;
  }
  return null;
}

let waitingTimer: ReturnType<typeof setTimeout> | null = null;

export const tutorialStore = createStore<TutorialState>()((set, get) => ({
  activeStep: null,
  step5Sub: "activity",
  statuses: { 1: "pending", 2: "pending", 3: "pending", 4: "pending", 5: "pending" },
  isTutorialFinished: false,
  isWaiting: false,

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

    const wasFresh = Object.values(statuses).every((v) => v === "pending");
    const newStatuses = { ...statuses, [step]: "done" as StepStatus };
    writeTutorialStatus(newStatuses);

    const activeStep = nextPendingStep(newStatuses);
    const isTutorialFinished = activeStep === null;

    set({ statuses: newStatuses, activeStep, isTutorialFinished, isWaiting: false });

    // GA 튜토리얼 퍼널(S-4.28) — 이미 처리된 스텝은 위에서 걸러지므로 스텝당 1회
    if (wasFresh) track("tutorial_begin");
    track("tutorial_step", { step: String(step) as "1" | "2" | "3" | "4" | "5" });
    if (isTutorialFinished) track("tutorial_complete");
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
}));
