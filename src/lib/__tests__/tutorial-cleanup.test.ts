import { describe, it, expect, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { nextPendingStep, tutorialStore, ACTIVE_TUTORIAL_STEPS } from "@/stores/tutorial/tutorial-store";
import { TUTORIAL_STEP_CONFIGS } from "@/app/(main)/_components/tutorial/tutorial-step-config";
import { STORAGE_KEYS, readTutorialStatus } from "@/lib/local-storage";

// 튜토리얼 정리(#4.85): 2단계(더보기) 삭제·PWA 1단계 건너뜀. 저장 키 tutorial 형식은 1~5 그대로

function memoryStorage(): Storage {
  const m = new Map<string, string>();
  return {
    get length() { return m.size; },
    clear: () => m.clear(),
    getItem: (k) => (m.has(k) ? m.get(k)! : null),
    key: (i) => Array.from(m.keys())[i] ?? null,
    removeItem: (k) => { m.delete(k); },
    setItem: (k, v) => { m.set(k, String(v)); },
  };
}
const g = globalThis as unknown as { window?: unknown; localStorage?: Storage };

beforeEach(() => {
  g.window = {};
  g.localStorage = memoryStorage();
});

describe("튜토리얼 정리", () => {
  it("단계는 1·3·4·5이고 2단계(더보기) 설정은 없다", () => {
    expect(ACTIVE_TUTORIAL_STEPS).toEqual([1, 3, 4, 5]);
    expect(Object.keys(TUTORIAL_STEP_CONFIGS)).toEqual(["1", "3", "4", "5"]);
    expect(JSON.stringify(TUTORIAL_STEP_CONFIGS)).not.toContain("더보기");
  });

  it("2단계가 pending이어도 다음 단계는 3으로 넘어가고, 1·3·4·5만 끝나면 완료", () => {
    const base = { 1: "done", 2: "pending", 3: "pending", 4: "pending", 5: "pending" } as const;
    expect(nextPendingStep({ ...base })).toBe(3);
    expect(nextPendingStep({ ...base, 3: "done", 4: "skipped", 5: "done" })).toBeNull();
  });

  it("이전 버전 저장값(2단계 pending 포함)에서 이어 하고 완료 시 저장 형식이 유지된다", () => {
    localStorage.setItem(STORAGE_KEYS.tutorialStatus, JSON.stringify({ 1: "done", 2: "pending", 3: "done", 4: "done", 5: "pending" }));
    tutorialStore.getState().initTutorial();
    expect(tutorialStore.getState().activeStep).toBe(5);
    tutorialStore.getState().completeStep(5);
    expect(tutorialStore.getState().isTutorialFinished).toBe(true);
    expect(readTutorialStatus()).toEqual({ 1: "done", 2: "pending", 3: "done", 4: "done", 5: "done" });
  });

  it("1단계를 건너뛰면(PWA) 3단계로 진행하고 skipped로 기록된다", () => {
    tutorialStore.getState().initTutorial();
    expect(tutorialStore.getState().activeStep).toBe(1);
    tutorialStore.getState().skipStep(1);
    expect(tutorialStore.getState().activeStep).toBe(3);
    expect(readTutorialStatus()[1]).toBe("skipped");
  });

  it("오버레이는 PWA에서 1단계를 건너뛰고, 말풍선 순번은 삭제된 단계를 뺀다", () => {
    const src = readFileSync(path.resolve(__dirname, "../../app/(main)/_components/tutorial/tutorial-overlay.tsx"), "utf8");
    expect(src).toMatch(/activeStep === 1 && isStandaloneDisplay\(\)\) skipStep\(1\)/);
    expect(src).toContain("ACTIVE_TUTORIAL_STEPS.indexOf(step) + 1");
  });
});
