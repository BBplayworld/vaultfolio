// 스크린샷 일괄 온보딩 마법사 진행 상태(S-4.29) — tutorialStatus(스팟라이트 튜토리얼, 별개 기능)와
// 코드 패턴만 동일(단일 키 + step map)하게 재사용하고 값은 절대 공유하지 않는다.

import { STORAGE_KEYS } from "./local-storage";

export const WIZARD_CATEGORIES = ["stock", "crypto", "cash", "loan"] as const;
export type WizardCategory = typeof WIZARD_CATEGORIES[number];
export type WizardCategoryStatus = "pending" | "done" | "skipped";
export type WizardCategoryMap = Record<WizardCategory, WizardCategoryStatus>;

interface OnboardingWizardStatus {
  categories: WizardCategoryMap;
  dismissed: boolean; // 완료 또는 전체 건너뛰기 — true면 자동 재노출하지 않는다(AC2)
}

const DEFAULT_STATUS: OnboardingWizardStatus = {
  categories: { stock: "pending", crypto: "pending", cash: "pending", loan: "pending" },
  dismissed: false,
};

export function readOnboardingWizardStatus(): OnboardingWizardStatus {
  if (typeof window === "undefined") return { ...DEFAULT_STATUS, categories: { ...DEFAULT_STATUS.categories } };
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.onboardingWizardStatus);
    if (!raw) return { ...DEFAULT_STATUS, categories: { ...DEFAULT_STATUS.categories } };
    const parsed = JSON.parse(raw) as Partial<OnboardingWizardStatus>;
    const categories: WizardCategoryMap = { ...DEFAULT_STATUS.categories };
    for (const c of WIZARD_CATEGORIES) {
      const v = parsed.categories?.[c];
      if (v === "pending" || v === "done" || v === "skipped") categories[c] = v;
    }
    return { categories, dismissed: parsed.dismissed === true };
  } catch {
    return { ...DEFAULT_STATUS, categories: { ...DEFAULT_STATUS.categories } };
  }
}

export function writeOnboardingWizardStatus(status: OnboardingWizardStatus): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEYS.onboardingWizardStatus, JSON.stringify(status));
  } catch { /* 저장 실패 무시 */ }
}

export function markCategoryStatus(category: WizardCategory, status: WizardCategoryStatus): OnboardingWizardStatus {
  const current = readOnboardingWizardStatus();
  const next = { ...current, categories: { ...current.categories, [category]: status } };
  writeOnboardingWizardStatus(next);
  return next;
}

export function markWizardDismissed(): OnboardingWizardStatus {
  const next = { ...readOnboardingWizardStatus(), dismissed: true };
  writeOnboardingWizardStatus(next);
  return next;
}

/** 재실행 시 재개 지점(AC6) — 아직 pending인 첫 카테고리. 전부 처리됐으면 null(완료 화면으로) */
export function getResumeCategory(status: OnboardingWizardStatus): WizardCategory | null {
  return WIZARD_CATEGORIES.find((c) => status.categories[c] === "pending") ?? null;
}

